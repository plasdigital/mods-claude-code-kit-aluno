import type { EngineInterface, Register } from 'claude-code'

// Cada conversa grava o que editou no seu próprio arquivo desta pasta; as outras
// conversas leem os arquivos umas das outras. Um arquivo por conversa evita corrida de escrita.
// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')
const pasta = async ($: EngineInterface) => `${await casa($)}/.claude/mods-estado/conflito-de-edicao`
const JANELA_MS = 30 * 60 * 1000 // só avisa se o arquivo mudou nos últimos 30 min
const FOLGA_MS = 3000 // tolerância entre o fim da minha edição e o mtime gravado no disco
const VALIDADE_MS = 2 * 60 * 60 * 1000 // esquece registros com mais de 2 h

type Livro = { rotulo: string; arquivos: Record<string, number> }

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()

const haQuanto = (ms: number) => {
  const min = Math.round(ms / 60000)
  if (min < 1) return 'menos de 1 minuto'
  return min === 1 ? '1 minuto' : `${min} minutos`
}

const lerLivro = async ($: EngineInterface, sid: string): Promise<Livro> => {
  try {
    return JSON.parse(await $.fs.read(`${(await pasta($))}/${sid}.json`)) as Livro
  } catch {
    return { rotulo: '', arquivos: {} }
  }
}

// Procura, nas outras conversas, quem gravou este arquivo no mesmo instante em que ele mudou.
const quemMexeu = async ($: EngineInterface, sid: string, chave: string, mtimeMs: number) => {
  try {
    for (const f of await $.fs.list((await pasta($)))) {
      if (f.kind !== 'file' || f.name === `${sid}.json`) continue
      const livro = JSON.parse(await $.fs.read(`${(await pasta($))}/${f.name}`)) as Livro
      const quando = livro.arquivos[chave]
      if (quando !== undefined && Math.abs(quando - mtimeMs) < 10_000) {
        return livro.rotulo || f.name.replace('.json', '').slice(0, 8)
      }
    }
  } catch {
    // pasta ainda não existe: nenhuma outra conversa gravou nada
  }
  return null
}

const registrar = async ($: EngineInterface, sid: string, chave: string, rotulo: string) => {
  const agora = await $.clock.now()
  const livro = await lerLivro($, sid)
  const arquivos: Record<string, number> = {}
  for (const [k, t] of Object.entries(livro.arquivos)) {
    if (agora - t < VALIDADE_MS) arquivos[k] = t
  }
  arquivos[chave] = agora
  await $.fs.write(`${(await pasta($))}/${sid}.json`, JSON.stringify({ rotulo: rotulo || livro.rotulo, arquivos }))
}

// Começo do primeiro pedido desta conversa (preenchido no prompt.submit, lá embaixo).
let rotulo = ''

const cuidar = async <R extends { deny?: string }>(
  $: EngineInterface,
  caminho: string,
  seguir: () => Promise<R>,
): Promise<R | { deny: string }> => {
  const sid = await $.session.id()
  const agora = await $.clock.now()
  const chave = norm(caminho)

  let mtimeMs = 0
  try {
    const st = await $.fs.stat(caminho)
    if (st.kind === 'file') mtimeMs = st.mtimeMs
  } catch {
    // arquivo novo: nada a conferir
  }

  const idade = agora - mtimeMs
  if (mtimeMs > 0 && idade < JANELA_MS) {
    const meu = (await lerLivro($, sid)).arquivos[chave] ?? 0
    if (mtimeMs > meu + FOLGA_MS) {
      const outra = await quemMexeu($, sid, chave, mtimeMs)
      const nome = caminho.replace(/\\/g, '/').split('/').pop()
      const onde = outra
        ? `na outra conversa "${outra}"`
        : 'fora desta conversa (IDE, script ou outro programa)'
      let escolha = 'Cancelar'
      try {
        escolha = await $.ui.ask(
          `"${nome}" foi alterado há ${haQuanto(idade)}, ${onde}. Editar mesmo assim?`,
          ['Editar mesmo assim', 'Cancelar'],
        )
      } catch {
        // diálogo dispensado conta como cancelar
      }
      if (escolha !== 'Editar mesmo assim') {
        return {
          deny: `O usuário cancelou: ${nome} foi alterado há ${haQuanto(idade)} ${onde}. Confirme com ele antes de editar.`,
        }
      }
    }
  }

  const resposta = await seguir()
  if (resposta.deny === undefined) await registrar($, sid, chave, rotulo)
  return resposta
}

export const register: Register = on => {
  // O rótulo da conversa é o começo do primeiro pedido: é como o aviso diz "qual conversa".
  on('prompt.submit', ($, e, next) => {
    if (rotulo === '' && (e.origin.kind === 'composer' || e.origin.kind === 'bridge')) {
      rotulo = e.text.replace(/\s+/g, ' ').trim().slice(0, 45)
    }
    return next(e)
  })

  on('tool.call', { tool: 'Edit' }, ($, e, next) => cuidar($, e.file_path, () => next(e)))
  on('tool.call', { tool: 'Write' }, ($, e, next) => cuidar($, e.file_path, () => next(e)))
}
