import type { EngineInterface, Register } from 'claude-code'

// Palavras de um primeiro nome de pasta que são comuns demais para identificar um cliente sozinhas.
// Ex.: com as pastas joao-silva e doce-mania, ponha 'joao' e 'doce' aqui.
const COMUNS = new Set<string>([])
// Assuntos da empresa/conteúdo: se aparecem dentro da pasta de um cliente, o pedido provavelmente é de outro lugar.
// Ex.: ['youtube', 'nome da sua empresa', 'site']
const ASSUNTOS_DA_EMPRESA: string[] = []

const simplificar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const citado = (texto: string, termo: string) =>
  new RegExp(`(^|[^a-z0-9])${termo}([^a-z0-9]|$)`).test(texto)

// Dado "…/Projetos/clientes/acme/…", devolve a raiz de clientes e o cliente atual.
const clienteDe = (cwd: string) => {
  const caminho = cwd.replace(/\\/g, '/')
  const m = /^(.*\/clientes)\/([^/]+)/i.exec(caminho)
  return m && m[1] && m[2] ? { raiz: m[1], nome: m[2].toLowerCase() } : null
}

const apelidos = (pasta: string) => {
  const lista = [pasta.replace(/-/g, ' '), pasta]
  const primeiro = pasta.split('-')[0] ?? ''
  if (primeiro.length >= 5 && !COMUNS.has(primeiro)) lista.push(primeiro)
  return lista
}

const citaCliente = (texto: string, pasta: string) => apelidos(pasta).some(a => citado(texto, a))

const listarClientes = async ($: EngineInterface, raiz: string) => {
  try {
    return (await $.fs.list(raiz)).filter(f => f.kind === 'dir').map(f => f.name.toLowerCase())
  } catch {
    return []
  }
}

export const register: Register = on => {
  const liberados = new Set<string>()

  // Selo na barra de status: em qual cliente esta conversa está.
  on('session.start', async ($, e, next) => {
    const atual = clienteDe(e.cwd)
    $.ui.status(atual ? `📍 cliente: ${atual.nome}` : undefined)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const atual = clienteDe(await $.session.cwd())
    if (!atual || (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge')) return next(e)

    const texto = simplificar(e.text)
    if (citaCliente(texto, atual.nome)) return next(e)

    const outros = (await listarClientes($, atual.raiz)).filter(c => c !== atual.nome)
    const alvo =
      outros.find(c => citaCliente(texto, c)) ??
      ASSUNTOS_DA_EMPRESA.find(a => texto.includes(a))
    if (!alvo) return next(e)

    const chave = `${atual.nome}>${alvo}`
    if (liberados.has(chave)) return next(e)

    const rotuloAlvo = outros.includes(alvo) ? `o cliente "${alvo}"` : `"${alvo}" (assunto da empresa)`
    let escolha = 'Cancelar'
    try {
      escolha = await $.ui.ask(
        `Esta conversa está na pasta do cliente "${atual.nome}", mas o pedido fala de ${rotuloAlvo}. Continuar aqui?`,
        ['Continuar aqui', 'Continuar e não perguntar mais', 'Cancelar'],
      )
    } catch {
      // diálogo dispensado conta como cancelar
    }

    if (escolha === 'Continuar e não perguntar mais') liberados.add(chave)
    if (escolha === 'Continuar aqui' || escolha === 'Continuar e não perguntar mais') return next(e)

    return { drop: `Pedido não enviado: abra uma conversa na pasta certa para ${rotuloAlvo}.` }
  })
}
