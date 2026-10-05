import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { Entrega } from '../types'

// Todo arquivo que a IA cria ou edita fica guardado, de todas as conversas, no store do mod
// (uma chave por conversa, para duas conversas abertas não sobrescreverem uma à outra).
// - /entregas abre um painel com a lista, agrupada por cliente/setor, com link para abrir;
// - um pedido com "cadê"/"onde está" já chega para a IA com os arquivos que casam.

const PAINEL = 'entregas'
// Sua pasta de projetos, terminando em \\ (ex.: 'D:\\Projetos\\'). Com ela o painel agrupa por
// <projeto>\<subpasta>; vazia, agrupa pelas duas pastas acima de cada arquivo.
const RAIZ = ''
const POR_CONVERSA = 300
const DIAS = 30

const filtro = atom({ plugin: 'entregas', key: 'filtro' } as const, '')
const lista = atom({ plugin: 'entregas', key: 'lista' } as const, [])
const sessao = atom({ plugin: 'entregas', key: 'sessao' } as const, '')
const carregando = atom({ plugin: 'entregas', key: 'carregando' } as const, false)

const node = async ($: EngineInterface) =>
  (await $.env.get('OS')) === 'Windows_NT' ? 'C:/Program Files/nodejs/node.exe' : 'node'
const HISTORICO_HORAS = 6
// Fora da pasta do mod: um arquivo novo aqui dentro recarregaria o mod.
// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')
const historico = async ($: EngineInterface) => `${await casa($)}/.claude/mods-dados/entregas-historico.json`
const ESCRITA = new Set(['Write', 'Edit', 'NotebookEdit', 'SendUserFile'])
// Arquivo que um script gerou (docx do contrato, pdf da nota): só se o caminho aparece no comando.
const GERADO = /[a-zA-Z]:[\\/][^"'<>|*?\n]*?\.(docx|pdf|xlsx|pptx|html|mp4|mov|png|jpg|csv|xml|zip)\b/g
const TEMPORARIO = /[\\/](Temp|node_modules)[\\/]/i
const CADE = /\b(cad[eê]|onde (t[aá]|est[aá]|fica|ficou|foi parar|salvou|botou|colocou)|qual (arquivo|pasta)|me (passa|manda|d[aá]) o (arquivo|link|caminho))\b/i

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const normal = (p: string) => p.replace(/\//g, '\\').replace(/\\{2,}/g, '\\')

function area(p: string): string {
  const n = normal(p)
  if (!RAIZ || !n.toLowerCase().startsWith(RAIZ.toLowerCase())) {
    const partes = n.split('\\')
    return partes.slice(-3, -1).join('\\') || n
  }
  const partes = n.slice(RAIZ.length).split('\\')
  const fundo = 2
  return partes.slice(0, Math.min(fundo, partes.length - 1)).join('\\') || partes[0] || n
}

function link(p: string): string {
  const n = normal(p).replace(/\\/g, '/')
  const [drive, ...resto] = n.split('/')
  return `file:///${drive}/${resto.map(encodeURIComponent).join('/')}`
}

function quando(t: number, agora: number): string {
  const min = Math.round((agora - t) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} d`
}

async function lerHistorico($: EngineInterface): Promise<Entrega[]> {
  try {
    const h = JSON.parse(await $.fs.read((await historico($)))) as { lista?: Entrega[] }
    return Array.isArray(h.lista) ? h.lista : []
  } catch {
    return []
  }
}

// Regera o historico.json (≈10 s, lendo as conversas dos últimos 30 dias) se tiver mais de 6 h.
async function renovarHistorico($: EngineInterface, forcar = false) {
  const arquivo = (await historico($))
  try {
    if (!forcar && (await $.fs.exists(arquivo))) {
      const st = await $.fs.stat(arquivo)
      if (Date.now() - st.mtimeMs < HISTORICO_HORAS * 3600e3) return
    }
    await $.process.run([await node($), `${$.plugin.root}/scripts/historico.mjs`, arquivo], { timeoutMs: 180000 })
  } catch (err) {
    $.ui.log(`entregas: histórico não renovou (${String(err).slice(0, 80)})`, { to: 'debug' })
  }
}

async function todas($: EngineInterface): Promise<Entrega[]> {
  const chaves = (await $.store.keys()).filter(k => k.startsWith('s:'))
  const listas: unknown[] = await Promise.all(chaves.map(k => $.store.get(k)))
  listas.push(await lerHistorico($))
  const vistos = new Map<string, Entrega>()
  for (const l of listas) {
    if (!Array.isArray(l)) continue
    for (const x of l as Entrega[]) {
      const k = normal(x.p).toLowerCase()
      const ja = vistos.get(k)
      if (!ja || ja.t < x.t) vistos.set(k, x)
    }
  }
  return [...vistos.values()].sort((a, b) => b.t - a.t)
}

async function guardar($: EngineInterface, caminhos: string[], op: string) {
  const s = await $.session.id()
  const chave = `s:${s}`
  const atual = ((await $.store.get(chave)) as Entrega[] | undefined) ?? []
  const novos = caminhos.map(p => ({ p: normal(p), t: Date.now(), op, s }))
  const fora = new Set(novos.map(x => x.p.toLowerCase()))
  await $.store.set(chave, [...novos, ...atual.filter(x => !fora.has(x.p.toLowerCase()))].slice(0, POR_CONVERSA))
}

function casar(texto: string, entregas: Entrega[]): Entrega[] {
  const palavras = [...new Set(semAcento(texto).match(/[a-z0-9]{4,}/g) ?? [])].filter(
    p => !['cade', 'onde', 'esta', 'fica', 'ficou', 'arquivo', 'pasta', 'link', 'caminho', 'para', 'aqui', 'isso', 'esse', 'essa', 'analisar', 'voce', 'gente'].includes(p),
  )
  if (!palavras.length) return entregas.slice(0, 5)
  return entregas
    .map(x => {
      const alvo = semAcento(x.p).replace(/[\\/_.-]+/g, ' ')
      const nome = semAcento(x.p.split('\\').pop() ?? '')
      const pontos = palavras.reduce((n, p) => n + (nome.includes(p) ? 2 : alvo.includes(p) ? 1 : 0), 0)
      return { x, pontos }
    })
    .filter(y => y.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.x.t - a.x.t)
    .slice(0, 8)
    .map(y => y.x)
}

async function recarregar($: EngineInterface) {
  await update($, carregando, () => true)
  await update($, lista, () => [])
  const l = await todas($)
  await update($, lista, () => l.slice(0, 400))
  await update($, carregando, () => false)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'entregas', description: 'Arquivos que a IA criou ou editou, em todas as conversas', argumentHint: '[filtro]' })
    // Conversa sem escrita há mais de 30 dias sai do store.
    try {
      const corte = Date.now() - DIAS * 86400e3
      for (const k of await $.store.keys()) {
        if (!k.startsWith('s:')) continue
        const l = (await $.store.get(k)) as Entrega[] | undefined
        if (!Array.isArray(l) || !l.length || (l[0]?.t ?? 0) < corte) await $.store.delete(k)
      }
    } catch {}
    void renovarHistorico($)
    return next(e)
  })

  on('command.run', { command: 'entregas' }, async ($, e) => {
    await update($, filtro, () => (e.args ?? '').trim())
    await update($, sessao, () => '')
    const s = await $.session.id()
    await update($, sessao, () => s)
    await $.ui.open({ id: PAINEL, title: 'Entregas' })
    void recarregar($)
    return { text: 'Painel de entregas aberto.' }
  })

  on('tool.call', async ($, e, next) => {
    const comando = e.tool === 'Bash' || e.tool === 'PowerShell'
    if (!ESCRITA.has(e.tool) && !comando) return next(e)
    const antes = Date.now()
    const r = await next(e)
    if (r.deny !== undefined || r.isError) return r
    const a = e as unknown as { file_path?: string; notebook_path?: string; files?: string[]; command?: string }
    let caminhos: string[]
    if (comando) {
      // Só o que o comando acabou de criar ou mudar (mexido depois que ele começou).
      const citados = [...new Set((a.command ?? '').match(GERADO) ?? [])].filter(c => !TEMPORARIO.test(c))
      const mexidos = await Promise.all(
        citados.map(async c => {
          try {
            const st = await $.fs.stat(c)
            return st.kind === 'file' && st.mtimeMs >= antes - 2000 ? c : null
          } catch {
            return null
          }
        }),
      )
      caminhos = mexidos.filter((x): x is string => !!x)
    } else {
      caminhos = e.tool === 'SendUserFile' ? (a.files ?? []) : [a.file_path ?? a.notebook_path].filter((x): x is string => !!x)
    }
    if (caminhos.length) {
      try {
        await guardar($, caminhos, comando ? 'Bash' : e.tool)
      } catch (err) {
        $.ui.log(`entregas: não guardei ${caminhos[0]} (${String(err).slice(0, 80)})`, { to: 'debug' })
      }
    }
    return r
  })

  // "cadê o contrato da acme?" chega para a IA já com os arquivos que casam.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    if (!CADE.test(e.text)) return next(e)
    const achados = casar(e.text, await todas($))
    if (!achados.length) return next(e)
    const s = await $.session.id()
    const agora = Date.now()
    $.ui.toast(`entregas: ${achados.length} arquivo(s) que a IA escreveu e casam com o pedido`)
    const linhas = achados.map(x => `- ${x.p}  (${x.op}, há ${quando(x.t, agora)}, ${x.s === s ? 'esta conversa' : `conversa ${x.s.slice(0, 8)}`})`)
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        `[mod entregas] Arquivos que a IA criou/editou recentemente (em qualquer conversa) e que casam com este pedido, do mais provável para o menos:\n${linhas.join('\n')}\nSe algum é o que o usuário procura, responda com o link dele direto, sem nova busca. Se nenhum servir, busque normalmente.`,
      ],
    })
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button, Markdown } = els
    const f = semAcento(await read($, filtro))
    const s = await read($, sessao)
    const todasL = await read($, lista)
    const l = f ? todasL.filter(x => semAcento(x.p).includes(f)) : todasL
    const agora = Date.now()
    const grupos = new Map<string, Entrega[]>()
    for (const x of l.slice(0, 120)) {
      const g = area(x.p)
      grupos.set(g, [...(grupos.get(g) ?? []), x])
    }
    const md = [...grupos.entries()]
      .map(([g, xs]) => `**${g}**\n` + xs.slice(0, 15).map(x => `- [${x.p.split('\\').pop()}](${link(x.p)}) · ${quando(x.t, agora)}${x.s === s ? ' · esta conversa' : ''}`).join('\n'))
      .join('\n\n')

    const busca =
      'Input' in els && els.Input ? (
        <els.Input
          key="filtro"
          placeholder="filtrar (cliente, nome do arquivo…)"
          value={await read($, filtro)}
          onInput={v => update($, filtro, () => v)}
          onSubmit={v => update($, filtro, () => v)}
        />
      ) : null

    return (
      <Box flexDirection="column">
        {busca}
        <Box flexDirection="row" gap={1}>
          <Button key="recarregar" label="atualizar" hotkey="r" onPress={() => recarregar($)} />
          <Button key="historico" label="reler conversas" hotkey="h" dimColor onPress={async () => { await update($, carregando, () => true); await renovarHistorico($, true); await recarregar($) }} />
          <Text dimColor>{(await read($, carregando)) ? 'lendo…' : `${l.length} arquivo(s)`}</Text>
        </Box>
        {md ? <Markdown key="lista" text={md} /> : <Text dimColor>Nada registrado ainda — o mod guarda a partir de agora.</Text>}
      </Box>
    )
  })
}
