import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ItemDeObra } from '../types'

const PAINEL = 'obra'
const itens = atom({ plugin: 'painel-de-obra', key: 'itens' } as const, [])
// Na casa o painel só abre com /obra (o usuário não quer ele pulando na tela); true é a versão da aula,
// que abre sozinho na primeira ação.
const ABRIR_SOZINHO = true

// Ligado: o painel aparece. /obra troca; conversa nova começa como ABRIR_SOZINHO manda.
const pediu = atom({ plugin: 'painel-de-obra', key: 'pediu' } as const, ABRIR_SOZINHO)

const nomeDoArquivo = (p: unknown) => String(p ?? '').replace(/\\/g, '/').split('/').pop() || '?'
const curto = (t: unknown, n = 60) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// Traduz a chamada de ferramenta numa frase que qualquer um entende na tela.
const descrever = (tool: string, i: Record<string, unknown>) => {
  switch (tool) {
    case 'Edit':
      return `✏️  editando ${nomeDoArquivo(i.file_path)}`
    case 'Write':
      return `📄 criando ${nomeDoArquivo(i.file_path)}`
    case 'Read':
      return `👀 lendo ${nomeDoArquivo(i.file_path)}`
    case 'Grep':
      return `🔎 procurando "${curto(i.pattern, 30)}"`
    case 'Glob':
      return `🔎 listando ${curto(i.pattern, 40)}`
    case 'Bash':
    case 'PowerShell':
      return `⚙️  ${curto(i.description || i.command)}`
    case 'Agent':
      return `🤖 subagente: ${curto(i.description)}`
    case 'WebFetch':
    case 'WebSearch':
      return `🌐 ${curto(i.url || i.query)}`
    case 'Skill':
      return `🧩 skill ${curto(i.skill, 40)}`
    default:
      return `🔧 ${tool.replace(/^mcp__[^_]+__/, '')}`
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'obra', description: 'Liga e desliga o painel do que o Claude está fazendo' })
    // Roda também quando o mod recarrega: fecha o painel nas conversas paradas, sem esperar uma ação.
    if (!(await read($, pediu))) await $.ui.close({ id: PAINEL }).catch(() => {})
    return next(e)
  })

  // /obra é liga-desliga: abre se está fechado, fecha e para de abrir se está aberto.
  on('command.run', { command: 'obra' }, async $ => {
    const ligar = !(await read($, pediu))
    await update($, pediu, () => ligar)
    if (ligar) {
      await $.ui.open({ id: PAINEL, title: 'Obra' })
      return { text: 'Painel de obra ligado. /obra de novo desliga.' }
    }
    await $.ui.close({ id: PAINEL }).catch(() => {})
    return { text: 'Painel de obra desligado nesta conversa.' }
  })

  // Cada pedido abre um bloco novo no painel.
  on('prompt.submit', async ($, e, next) => {
    if ((e.origin.kind === 'composer' || e.origin.kind === 'bridge')) {
      const item: ItemDeObra = { id: `p-${await $.clock.now()}`, tipo: 'pedido', texto: curto(e.text, 70), estado: 'ok' }
      await update($, itens, lista => [...lista, item].slice(-120))
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'AskUserQuestion' || e.tool === 'ToolSearch') return next(e)

    const id = e.tool_use_id ?? `t-${await $.clock.now()}`
    const item: ItemDeObra = {
      id,
      tipo: 'acao',
      texto: descrever(e.tool, e as unknown as Record<string, unknown>),
      estado: 'rodando',
    }
    await update($, itens, lista => [...lista, item].slice(-120))
    if (!(await read($, pediu))) void $.ui.close({ id: PAINEL }).catch(() => {})
    else if (ABRIR_SOZINHO) void $.ui.open({ id: PAINEL, title: 'Obra' })

    const r = await next(e)
    const falhou = r.deny !== undefined || r.isError === true
    await update($, itens, lista => lista.map(x => (x.id === id ? { ...x, estado: (falhou ? 'erro' : 'ok') as ItemDeObra['estado'] } : x)))
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const lista = await read($, itens)
    const cabe = Math.max(3, (e.viewport?.rows ?? 30) - 6)
    const acoes = lista.filter(x => x.tipo === 'acao')
    const editados = new Set(acoes.filter(x => /^(✏️|📄)/.test(x.texto)).map(x => x.texto.split(' ').pop())).size

    return (
      <Box flexDirection="column">
        <Text bold>
          {acoes.length} ações · {editados} arquivos mexidos · {acoes.filter(x => x.estado === 'erro').length} erros
        </Text>
        {lista.length === 0 && <Text dimColor>Nada ainda. Mande um pedido.</Text>}
        {lista.slice(-cabe).map(x =>
          x.tipo === 'pedido' ? (
            <Text bold color="cyan" wrap="truncate">
              ▶ {x.texto}
            </Text>
          ) : (
            <Text
              wrap="truncate"
              dimColor={x.estado === 'ok'}
              color={x.estado === 'erro' ? 'red' : x.estado === 'rodando' ? 'yellow' : undefined}
            >
              {x.estado === 'rodando' ? '⏳' : x.estado === 'erro' ? '❌' : '✅'} {x.texto}
            </Text>
          ),
        )}
      </Box>
    )
  })
}
