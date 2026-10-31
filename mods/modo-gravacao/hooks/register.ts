import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Um termo por linha (nome de cliente, de aluno, de empresa): também é borrado.
// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')
const arquivoTermos = async ($: EngineInterface) => `${await casa($)}/.claude/mods-estado/modo-gravacao/termos.txt`
const TARJA = '▒▒▒▒▒▒▒▒'

const ligado = atom({ plugin: 'modo-gravacao', key: 'ligado' } as const, false)
const termos = atom({ plugin: 'modo-gravacao', key: 'termos' } as const, [])

const PADROES: RegExp[] = [
  // Dinheiro vem antes dos documentos, para o valor inteiro sumir de uma vez.
  /(?:R\$|US\$|U\$|€|\$|\b(?:BRL|USD|EUR)\b)\s?\d+(?:[.,]\d+)*(?:\s?(?:mil|milh(?:ão|ões)|mi|bi|k)\b)?/gi, // R$ 1.500,00 · R$ 50 mil · US$ 200
  /\b\d+(?:[.,]\d+)*\s?(?:mil\s)?(?:reais|real|d[oó]lar(?:es)?)\b/gi, // 1500 reais · 2 mil reais
  /\b\d{1,3}(?:\.\d{3})*,\d{2}\b(?!\s?%)/g, // 1.234,56 sem símbolo (não pega porcentagem)
  /(?<=\b(?:valor|pre[çc]o|mensalidade|fatura|faturamento|saldo|honor[aá]rio|or[çc]amento|parcela|custo|pagamento|sal[aá]rio|receita|ticket|price|amount)\w*[^\d\n]{0,12})\d+(?:[.,]\d+)*/gi, // valor_nota: 1500 · mensalidade 800
  // Tamanho do negócio e aperto: some o número ("▒▒ clientes") e a palavra que mostra dívida.
  /\b\d+(?=\s+(?:clientes?|contratos?|notas?(?:\s+fiscais?)?|NFS-?e|alunos?|leads?|boletos?|contas?|faturas?)\b)/gi, // 5 clientes · 12 notas
  /\b(?:renegocia\p{L}*|d[ií]vidas?|inadimpl\p{L}*|serasa|protest(?:o|ad[ao]s?)|negativad[ao]s?|empr[ée]stimos?|financiamentos?|em\s+atraso|atrasad[ao]s?)\b/giu, // boleto renegociação
  /\b(?:senha|password|token|secret|api[_-]?key|apikey)\b\s*[:=]\s*\S+/gi, // senha=..., token: ...
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, // JWT
  /\b(?:sk|pk|rk|ghp|gho|github_pat|xox[abp]|AKIA|AIza|EAA)[\w-]{10,}/g, // chaves de API conhecidas
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // e-mail
  /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g, // CNPJ: com pontuação, só números ou com espaços
  /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g, // CPF: idem
  /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, // telefone BR
  /\b\d{12,13}\b/g, // telefone colado (5521999998888)
  /\b[A-Za-z0-9_]{32,}\b/g, // qualquer sequência longa parecida com token
]

// A tarja só pega o que já foi escrito; isto faz o Claude nem escrever. Vai junto de cada mensagem enquanto grava.
const REGRAS_GRAVACAO = `MODO GRAVAÇÃO LIGADO: o usuário está gravando uma aula e esta tela vai aparecer no vídeo. Até ele desligar (/gravar), toda resposta segue isto:
- Nenhum valor em dinheiro, nem total, nem parcela, nem saldo, nem porcentagem de dívida. Onde o valor faria falta, escreva "valor" ou "▒▒▒▒" (ex.: "Luz — vence 11/11 — ▒▒▒▒").
- Nenhuma quantidade que mostre o tamanho do negócio: quantos clientes, contratos, notas fiscais, alunos, leads, contas ou boletos. Escreva "alguns clientes", "as notas do mês", "algumas contas". Ex.: em vez de "emiti a nota dos seus 5 clientes", "emiti as notas desses clientes".
- Contas pessoais pelo nome genérico, que pode levar o banco ou a empresa: "boleto Santander", "cartão Nubank", "luz", "internet", "aluguel", "plano de saúde", "imposto da empresa". Nada que mostre aperto: não escreva dívida, acordo, renegociação, empréstimo, financiamento, atraso, "suspenso por falta de pagamento", cobrança, protesto, Serasa. Ex.: "boleto renegociação Santander" vira "boleto Santander". Se algo está atrasado, diga só "precisa de atenção" ou "confira se foi pago".
- Nota fiscal: pode dizer que emitiu, conferiu ou falta emitir. Sem número da nota, valor, tomador, CNPJ ou descrição do serviço contratado.
- Clientes: só pelo ramo ("um cliente de farmácia", "um cliente de hotelaria"), sem nome de empresa ou pessoa, sem faturamento, contrato, fatura, saldo de anúncio ou problema interno.
- Tabela ou lista na resposta: mostre só o necessário para a aula (2 ou 3 linhas de exemplo), nunca a lista inteira de clientes, notas ou contas.
- Nada de número de conta, final de cartão, código de barras, chave Pix, e-mail, telefone, CPF/CNPJ, endereço ou nome de pessoa.
- Datas de vencimento e a lógica do sistema podem aparecer: é o que a aula ensina. Leia os dados normalmente; o cuidado é só no que vai para a tela.`

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const borrar = (texto: string, lista: readonly string[]) => {
  let saida = texto
  for (const p of PADROES) saida = saida.replace(p, TARJA)
  for (const termo of lista) saida = saida.replace(new RegExp(escapar(termo), 'gi'), TARJA)
  return saida
}

// Borra todo texto dentro de um valor (entrada ou saída de ferramenta), mantendo a forma.
const borrarTudo = (valor: unknown, lista: readonly string[]): unknown => {
  if (typeof valor === 'string') return borrar(valor, lista)
  if (Array.isArray(valor)) return valor.map(v => borrarTudo(v, lista))
  if (valor !== null && typeof valor === 'object') {
    const novo: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor)) novo[k] = borrarTudo(v, lista)
    return novo
  }
  return valor
}

// Borra os textos de uma árvore desenhada por outro mod (painel, faixa), sem mexer na estrutura.
const borrarArvore = (no: unknown, lista: readonly string[]): unknown => {
  if (typeof no === 'string') return borrar(no, lista)
  if (Array.isArray(no)) return no.map(n => borrarArvore(n, lista))
  if (no === null || typeof no !== 'object') return no
  const el = no as { type?: string; props?: Record<string, unknown>; children?: unknown }
  const novo: Record<string, unknown> = { ...el }
  if (el.props) {
    const props = { ...el.props }
    for (const k of ['label', 'value', 'placeholder', 'text']) if (typeof props[k] === 'string') props[k] = borrar(props[k] as string, lista)
    if ('children' in props) props.children = borrarArvore(props.children, lista)
    novo.props = props
  }
  if ('children' in el) novo.children = borrarArvore(el.children, lista)
  return novo
}

const carregarTermos = async ($: EngineInterface) => {
  let lista: string[] = []
  try {
    lista = (await $.fs.read(await arquivoTermos($)))
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length >= 3 && !l.startsWith('#'))
  } catch {
    // sem arquivo de termos: só os padrões
  }
  await update($, termos, () => lista)
}

const mostrarStatus = ($: EngineInterface, estaLigado: boolean) =>
  $.ui.status(estaLigado ? '🔴 GRAVANDO · dados sensíveis borrados' : undefined)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'gravar',
      description: 'Liga/desliga o modo gravação (borra dados sensíveis na tela)',
      immediate: true,
    })
    await carregarTermos($)
    mostrarStatus($, await read($, ligado))
    return next(e)
  })

  on('command.run', { command: 'gravar' }, async $ => {
    await carregarTermos($)
    let agora = false
    await update($, ligado, antes => {
      agora = !antes
      return agora
    })
    mostrarStatus($, agora)
    return {
      text: agora
        ? 'Modo gravação LIGADO: valores em dinheiro, e-mails, telefones, CPF/CNPJ, chaves e os termos da lista aparecem borrados na tela, e o Claude responde no genérico (contas pelo nome genérico, clientes pelo ramo, sem valores nem quantidades). Ele continua lendo tudo normalmente.'
        : 'Modo gravação DESLIGADO.',
      context: [agora ? REGRAS_GRAVACAO : 'MODO GRAVAÇÃO DESLIGADO: as regras de tela da gravação não valem mais.'],
    }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    return next({ ...e, context: [...(e.context ?? []), REGRAS_GRAVACAO] })
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    return next({ ...e, props: { ...e.props, text: borrar(e.props.text, await read($, termos)) } })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    return next({ ...e, props: { ...e.props, text: borrar(e.props.text, await read($, termos)) } })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    const lista = await read($, termos)
    return next({
      ...e,
      props: { ...e.props, input: borrarTudo(e.props.input, lista), output: borrarTudo(e.props.output, lista) },
    })
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    return next({ ...e, props: { ...e.props, output: borrarTudo(e.props.output, await read($, termos)) } })
  })

  // Painéis e faixas dos outros mods (Obra, próximos passos...): desenha primeiro, depois borra o texto.
  for (const component of ['Pane', 'AbovePrompt'] as const) {
    on('ui.render', { component }, async ($, e, next) => {
      const arvore = await next(e)
      if (!arvore || !(await read($, ligado))) return arvore
      return borrarArvore(arvore, await read($, termos)) as typeof arvore
    })
  }
}
