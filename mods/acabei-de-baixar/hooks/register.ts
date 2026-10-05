import type { EngineInterface, Register } from 'claude-code'

// "Pega os PDFs que eu baixei agora há pouco": o pedido já chega para a IA com a lista dos
// arquivos novos de Downloads (caminho completo, tamanho, hora), sem ela gastar uma volta procurando.

// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')
const JANELA_H = 3
const RESERVA_H = 48
const MAX = 10

const GATILHO =
  /\b(baix(ei|ou|amos|aram|ado|ada|ados|adas)|acabei de (baixar|gerar|salvar|exportar)|gerei|exportei|t[aá] (em|na pasta|no) downloads|nos? downloads|(pasta|arquivo) (de )?downloads)\b/i
const IGNORA = /(\.crdownload|\.part|\.tmp|^desktop\.ini|^~\$)/i

function tamanho(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}

function hora(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    if (!GATILHO.test(e.text)) return next(e)

    const DOWNLOADS = `${await casa($)}/Downloads`
    let entradas
    try {
      entradas = await $.fs.list(DOWNLOADS)
    } catch {
      return next(e)
    }
    const agora = Date.now()
    const arquivos = entradas
      .filter(x => x.kind === 'file' && !IGNORA.test(x.name))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    let recentes = arquivos.filter(x => agora - x.mtimeMs <= JANELA_H * 3600e3)
    let janela = `${JANELA_H} h`
    if (!recentes.length) {
      recentes = arquivos.filter(x => agora - x.mtimeMs <= RESERVA_H * 3600e3).slice(0, 5)
      janela = `${RESERVA_H} h`
    }
    if (!recentes.length) return next(e)

    const lista = recentes.slice(0, MAX)
    $.ui.toast(`acabei-de-baixar: anexei ${lista.length} arquivo(s) recente(s) de Downloads`)
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        `[mod acabei-de-baixar] Arquivos que chegaram em ${DOWNLOADS} nas últimas ${janela}, do mais novo para o mais velho:\n` +
          lista.map(x => `- ${DOWNLOADS}/${x.name}  (${tamanho(x.size)}, ${hora(x.mtimeMs)})`).join('\n') +
          `\nSe o usuário fala de um arquivo que acabou de baixar ou gerar, é um destes: use o caminho direto, sem listar a pasta de novo.`,
      ],
    })
  })
}
