import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Leitura } from '../types'

const leitura = atom({ plugin: 'medidor-de-caixa', key: 'leitura' } as const, null)
const tique = atom({ plugin: 'medidor-de-caixa', key: 'tique' } as const, 0)

// O cache da conversa vale 1 hora depois da última resposta; passou disso, o próximo
// pedido paga a conversa inteira de novo.
const CACHE_MS = 60 * 60 * 1000

const dolar = (v: number) => `US$ ${v.toFixed(2).replace('.', ',')}`
const mil = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : `${n}`)

// Lê os números que a barra de status usa e guarda; a faixa redesenha sozinha.
const medir = async ($: EngineInterface, terminouAgora: boolean) => {
  const uso = await $.session.usage()
  const agora = await $.clock.now()
  const usd = uso.cost?.usd ?? 0
  await update($, leitura, antes => {
    const nova: Leitura = {
      usd,
      ultimoPedido: antes ? Math.max(0, usd - antes.usd) : usd,
      percent: uso.context.percent ?? 0,
      tokens: uso.context.tokens ?? 0,
      janela: uso.context.window,
      fimDoTurno: terminouAgora ? agora : (antes?.fimDoTurno ?? 0),
    }
    return nova
  })
}

export const register: Register = on => {
  let avisou = false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await medir($, false)
    // Um tique por minuto faz o relógio do cache andar e dispara o aviso dos 5 minutos.
    $.clock.every(60_000, () => {
      void (async () => {
        await update($, tique, n => n + 1)
        const l = await read($, leitura)
        if (!l || l.fimDoTurno === 0) return
        const resta = CACHE_MS - ((await $.clock.now()) - l.fimDoTurno)
        if (resta > 0 && resta <= 5 * 60_000 && !avisou) {
          avisou = true
          $.ui.toast('❄️ O cache esfria em 5 min. Mande algo ou rode /bastao antes.', { timeoutMs: 15_000 })
        }
      })()
    })
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      avisou = false
      await medir($, true)
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const l = await read($, leitura)
    await read($, tique) // redesenha a cada minuto
    const abaixo = await next(e)
    if (e.props.hasSurvey || l === null) return abaixo

    const { Box, Text } = $.ui.resolve(e)
    const corContexto = l.percent >= 80 ? 'red' : l.percent >= 60 ? 'yellow' : 'green'

    let cache = null
    if (l.fimDoTurno > 0 && !e.props.isWorking) {
      const min = Math.ceil((CACHE_MS - ((await $.clock.now()) - l.fimDoTurno)) / 60_000)
      cache =
        min > 0 ? (
          <Text color={min <= 10 ? 'yellow' : 'cyan'}>  ·  ❄️ cache esfria em {min} min</Text>
        ) : (
          <Text color="red">  ·  🔥 cache frio: o próximo pedido paga a conversa inteira</Text>
        )
    }

    return (
      <Box flexDirection="column">
        <Text wrap="truncate">
          <Text bold>💰 {dolar(l.usd)}</Text>
          <Text dimColor> nesta conversa (preço de API)  ·  último pedido +{dolar(l.ultimoPedido)}  ·  </Text>
          <Text color={corContexto}>contexto {l.percent}%</Text>
          <Text dimColor> ({mil(l.tokens)} de {mil(l.janela)})</Text>
          {cache}
        </Text>
        {abaixo}
      </Box>
    )
  })
}
