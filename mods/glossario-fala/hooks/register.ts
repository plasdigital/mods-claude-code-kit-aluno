import type { Register, EngineInterface } from 'claude-code'

// O ditado erra nomes (cloud code, supa base, chat root). Antes do pedido chegar à IA, troca os
// que não têm como ser outra coisa e avisa na tela o que trocou. O que pode ser palavra comum
// ("chat útil", "Êxodo") não é trocado: a IA só recebe a dica. A lista mora em ../glossario.json.

type Troca = { de: string; para: string; porque?: string }
type Glossario = { trocas: Troca[]; sugestoes: Troca[] }

const LETRA = '[\\p{L}\\p{N}]'
let cache: { trocas: Array<{ re: RegExp; para: string }>; sugestoes: Array<{ re: RegExp; para: string; porque: string }> } | null = null

const compilar = (de: string) => new RegExp(`(?<!${LETRA})(?:${de})(?!${LETRA})`, 'giu')

async function carregar($: EngineInterface) {
  if (cache) return cache
  try {
    const g = JSON.parse(await $.fs.read(`${$.plugin.root}/glossario.json`)) as Glossario
    cache = {
      trocas: g.trocas.map(t => ({ re: compilar(t.de), para: t.para })),
      sugestoes: (g.sugestoes ?? []).map(t => ({ re: compilar(t.de), para: t.para, porque: t.porque ?? '' })),
    }
  } catch (err) {
    $.ui.log(`glossario-fala: glossario.json não carregou (${String(err).slice(0, 100)})`)
    cache = { trocas: [], sugestoes: [] }
  }
  return cache
}

// Não mexe em link, caminho de arquivo nem código entre crases: o texto vira pedaços, e só os
// pedaços livres passam pelas trocas.
// Caminho do Windows pode ter espaço numa pasta ("Meus Projetos"): cada pasta vai até a barra seguinte.
const PROTEGIDO = /`[^`]*`|https?:\/\/\S+|[a-zA-Z]:[\\/](?:[^\s"'\\/]+(?: [^\s"'\\/]+)*[\\/])*[^\s"'\\/]*|"[^"\n]*[\\/][^"\n]*"/g

function pedacos(texto: string): Array<{ s: string; livre: boolean }> {
  const out: Array<{ s: string; livre: boolean }> = []
  let i = 0
  for (const m of texto.matchAll(PROTEGIDO)) {
    const ini = m.index ?? 0
    if (ini > i) out.push({ s: texto.slice(i, ini), livre: true })
    out.push({ s: m[0], livre: false })
    i = ini + m[0].length
  }
  if (i < texto.length) out.push({ s: texto.slice(i), livre: true })
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await carregar($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    if (e.text.trim().startsWith('/')) return next(e)
    const g = await carregar($)
    const partes = pedacos(e.text)

    const feitas = new Map<string, string>()
    for (const p of partes) {
      if (!p.livre) continue
      for (const t of g.trocas) {
        p.s = p.s.replace(t.re, (achado: string) => {
          if (achado.toLowerCase() === t.para.toLowerCase()) return achado
          feitas.set(achado, t.para)
          return t.para
        })
      }
    }
    const texto = partes.map(p => p.s).join('')

    const livre = partes.filter(p => p.livre).map(p => p.s).join(' ')
    const dicas: string[] = []
    for (const s of g.sugestoes) {
      const m = livre.match(new RegExp(s.re.source, 'iu'))
      if (m) dicas.push(`"${m[0]}" pode ser ${s.para} (${s.porque})`)
    }

    if (feitas.size) $.ui.toast(`corrigi: ${[...feitas].map(([a, b]) => `${a} → ${b}`).join(', ')}`, { timeoutMs: 6000 })
    if (!feitas.size && !dicas.length) return next(e)
    const contexto = dicas.length
      ? [...(e.context ?? []), `[mod glossario-fala] O usuário dita por voz. Nomes que podem ter saído errados (não troquei): ${dicas.join('; ')}.`]
      : e.context
    return next({ ...e, text: texto, ...(contexto ? { context: contexto } : {}) })
  })
}
