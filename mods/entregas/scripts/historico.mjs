#!/usr/bin/env node
/**
 * Histórico do mod entregas: lê as conversas dos últimos 30 dias (~/.claude/projects/**.jsonl)
 * e grava em historico.json todo arquivo que a IA escreveu, editou ou enviou ao usuário.
 * Cobre o que o mod não viu ao vivo (conversas de antes dele, ou com o mod desligado).
 *
 * Uso: node historico.mjs <saida.json>
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';

const saida = process.argv[2];
const raiz = join(homedir(), '.claude', 'projects');
const corte = Date.now() - 30 * 86400e3;
const FERRAMENTAS = new Set(['Write', 'Edit', 'NotebookEdit', 'SendUserFile']);
// Arquivo que um script gerou (docx do contrato, pdf da nota): só se o caminho aparece no comando.
const GERADO = /[a-zA-Z]:[\\/][^"'<>|*?\n]*?\.(docx|pdf|xlsx|pptx|html|mp4|mov|png|jpg|csv|xml|zip)\b/g;
const TEMPORARIO = /[\\/](Temp|node_modules)[\\/]/i;

function arquivos(dir, fundo = 0) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory() && fundo < 3) out.push(...arquivos(p, fundo + 1));
    else if (nome.endsWith('.jsonl') && st.mtimeMs >= corte) out.push(p);
  }
  return out;
}

const porCaminho = new Map();
for (const f of arquivos(raiz)) {
  const sessao = basename(f, '.jsonl');
  let texto;
  try { texto = readFileSync(f, 'utf8'); } catch { continue; }
  for (const linha of texto.split('\n')) {
    if (!linha.includes('"tool_use"') || !/"name":"(Write|Edit|NotebookEdit|SendUserFile|Bash|PowerShell)"/.test(linha)) continue;
    let o;
    try { o = JSON.parse(linha); } catch { continue; }
    const t = Date.parse(o.timestamp ?? '') || 0;
    if (t < corte) continue;
    for (const b of o.message?.content ?? []) {
      if (b.type !== 'tool_use') continue;
      let caminhos;
      if (FERRAMENTAS.has(b.name)) caminhos = b.name === 'SendUserFile' ? b.input?.files ?? [] : [b.input?.file_path ?? b.input?.notebook_path];
      else if (b.name === 'Bash' || b.name === 'PowerShell')
        caminhos = (String(b.input?.command ?? '').match(GERADO) ?? []).filter((c) => !TEMPORARIO.test(c) && existsSync(c));
      else continue;
      for (const c of caminhos) {
        if (typeof c !== 'string' || !/^[a-zA-Z]:[\\/]/.test(c)) continue;
        const p = c.replace(/\//g, '\\').replace(/\\{2,}/g, '\\');
        const k = p.toLowerCase();
        const ja = porCaminho.get(k);
        if (!ja || ja.t < t) porCaminho.set(k, { p, t, op: b.name === 'PowerShell' ? 'Bash' : b.name, s: o.sessionId ?? sessao });
      }
    }
  }
}

const lista = [...porCaminho.values()].sort((a, b) => b.t - a.t).slice(0, 3000);
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify({ geradoEm: Date.now(), lista }));
console.log(lista.length);
