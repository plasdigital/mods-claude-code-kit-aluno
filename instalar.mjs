#!/usr/bin/env node
// instalar.mjs — liga (ou desliga) os mods desta pasta no seu Claude Code.
//
//   node instalar.mjs                              mostra o que vai mudar (não mexe em nada)
//   node instalar.mjs --aplicar                    liga todos os mods
//   node instalar.mjs --aplicar --so medidor-de-caixa,painel-de-obra
//   node instalar.mjs --remover                    mostra o que sai
//   node instalar.mjs --remover --aplicar          desliga os mods desta pasta
//
// Como funciona: o Claude Code carrega como mod cada pasta listada na variável
// CLAUDE_CODE_PLUGIN_DIRS, no bloco "env" do seu ~/.claude/settings.json (uma pasta por mod,
// separadas por ";" no Windows e ":" no Mac). Este script só mexe nessas duas variáveis e
// guarda uma cópia do settings.json antes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODS = path.join(AQUI, 'mods');
const CLAUDE = path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CLAUDE, 'settings.json');
const ESTADO = path.join(CLAUDE, 'mods-estado');

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const remover = args.includes('--remover');
const iSo = args.indexOf('--so');
const so = iSo >= 0 ? (args[iSo + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null;

const todos = fs.readdirSync(MODS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(MODS, d.name, '.claude-plugin', 'plugin.json')))
  .map((d) => d.name)
  .sort();

if (so) {
  const errados = so.filter((m) => !todos.includes(m));
  if (errados.length) {
    console.error(`🔴 Não existe mod com esse nome: ${errados.join(', ')}`);
    console.error(`   Os mods desta pasta: ${todos.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------

let settings = {};
if (fs.existsSync(SETTINGS)) {
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (erro) {
    console.error(`🔴 ${SETTINGS} não é um JSON válido (${erro.message}).`);
    console.error('   Conserte o arquivo antes: este script não reescreve um arquivo que não entende.');
    process.exit(1);
  }
}
const env = { ...(settings.env ?? {}) };

const normal = (p) => path.resolve(p).toLowerCase();
const destaPasta = (p) => normal(p).startsWith(normal(MODS) + path.sep);

const atuais = String(env.CLAUDE_CODE_PLUGIN_DIRS ?? '').split(path.delimiter).map((s) => s.trim()).filter(Boolean);
const deFora = atuais.filter((p) => !destaPasta(p)); // mods de outras pastas: nunca mexe
const jaLigados = atuais.filter(destaPasta).map((p) => path.basename(p));

const escolhidos = remover ? [] : (so ?? todos);
const novos = [...deFora, ...escolhidos.map((m) => path.join(MODS, m))];

const entram = escolhidos.filter((m) => !jaLigados.includes(m));
const saem = jaLigados.filter((m) => !escolhidos.includes(m));

console.log(`\nSettings: ${SETTINGS}`);
console.log(`Mods desta pasta: ${MODS}\n`);
if (deFora.length) console.log(`Mods de outras pastas (ficam como estão): ${deFora.length}`);
console.log(`Ligados hoje desta pasta: ${jaLigados.length ? jaLigados.join(', ') : 'nenhum'}`);
console.log(`Entram: ${entram.length ? entram.join(', ') : 'nada'}`);
console.log(`Saem:   ${saem.length ? saem.join(', ') : 'nada'}`);

if (!entram.length && !saem.length) {
  console.log('\n✓ Nada a mudar.\n');
  process.exit(0);
}

if (!aplicar) {
  console.log('\nNada foi alterado. Para aplicar, rode de novo com --aplicar.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------

fs.mkdirSync(CLAUDE, { recursive: true });
if (fs.existsSync(SETTINGS)) {
  const copia = `${SETTINGS}.antes-dos-mods-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.bak`;
  fs.copyFileSync(SETTINGS, copia);
  console.log(`\nCópia do settings antes da mudança: ${copia}`);
}

if (novos.length) {
  env.CLAUDE_CODE_PLUGIN_DIRS = novos.join(path.delimiter);
  env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS = '1';
} else {
  delete env.CLAUDE_CODE_PLUGIN_DIRS;
  // a outra variável fica: pode haver hook de função que não é desta pasta
}
settings.env = env;
fs.writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);

// As pastas onde os mods guardam o que precisam (lixeira, resumos, livro de edições).
for (const pasta of ['lixeira', 'passar-o-bastao', 'conflito-de-edicao', 'modo-gravacao']) {
  fs.mkdirSync(path.join(ESTADO, pasta), { recursive: true });
}
const termos = path.join(ESTADO, 'modo-gravacao', 'termos.txt');
if (!fs.existsSync(termos)) {
  fs.writeFileSync(termos, [
    '# Um termo por linha: nomes que o /gravar borra na tela (cliente, aluno, empresa).',
    '# Linhas com # são ignoradas. Termos com menos de 3 letras também.',
    '',
  ].join('\n'));
}

console.log('\n✓ Pronto.');
console.log('   Abra uma conversa nova no Claude Code (os mods carregam no começo da conversa).');
console.log('   Se aparecer um aviso pedindo para ativar os mods (Enable), clique nele.\n');
