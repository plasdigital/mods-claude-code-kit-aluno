import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const passos = atom({ plugin: 'proximos-passos', key: 'passos' } as const, [])
const ligado = atom({ plugin: 'proximos-passos', key: 'ligado' } as const, true)
// "compactar antes": o passo escolhido vai depois de um /compact, numa conversa já enxuta.
const compactarAntes = atom({ plugin: 'proximos-passos', key: 'compactarAntes' } as const, false)

// /compact e o pedido em seguida, sem o usuário digitar os dois.
const compactarEMandar = async ($: EngineInterface, texto: string) => {
  try {
    const r = await $.session.compact()
    if ('skip' in r && r.skip) $.ui.toast(`Não compactou (${String(r.skip)}); mandando assim mesmo.`)
  } catch (err) {
    $.ui.toast(`Não deu para compactar agora: ${String(err).slice(0, 100)}. Mandando assim mesmo.`)
  }
  await $.prompt.submit({ text: texto })
}

const PEDIDO = `Olhando esta conversa, sugira os 3 próximos passos mais úteis que o usuário poderia pedir agora.
Cada um é um pedido curto, no imperativo, em português, com no máximo 7 palavras (ex.: "Testa o mod no terminal").
Responda SÓ com um array JSON de 3 strings, sem mais nada.`

const sugerir = async ($: EngineInterface) => {
  const r = await $.model.fork({ prompt: PEDIDO })
  if (!r.isAnswered) return
  const m = /\[[\s\S]*\]/.exec(r.text)
  if (!m) return
  try {
    const lista = (JSON.parse(m[0]) as unknown[])
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      .map(x => x.trim().slice(0, 60))
      .slice(0, 3)
    await update($, passos, () => lista)
  } catch {
    // resposta fora do formato: fica sem sugestão nesta rodada
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'passos', description: 'Liga/desliga as sugestões de próximos passos' })
    await $.command.register({ name: 'seguir', description: 'Compacta a conversa e manda o próximo pedido', argumentHint: '<próximo pedido>' })
    return next(e)
  })

  on('command.run', { command: 'seguir' }, async ($, e) => {
    const texto = e.args.trim()
    await update($, passos, () => [])
    if (!texto) {
      $.clock.after(0, () => void $.session.compact().catch(err => $.ui.toast(`Não compactou: ${String(err).slice(0, 100)}`)))
      return { text: 'Compactando… (para mandar o próximo pedido junto: /seguir <pedido>)' }
    }
    $.clock.after(0, () => void compactarEMandar($, texto))
    return { text: 'Compactando a conversa e mandando o próximo pedido…' }
  })

  on('command.run', { command: 'passos' }, async $ => {
    let agora = true
    await update($, ligado, antes => {
      agora = !antes
      return agora
    })
    if (!agora) await update($, passos, () => [])
    return { text: agora ? 'Próximos passos LIGADO.' : 'Próximos passos DESLIGADO.' }
  })

  // Pedido novo apaga as sugestões velhas.
  on('prompt.submit', async ($, e, next) => {
    await update($, passos, () => [])
    return next(e)
  })

  // Fim de resposta da conversa principal: pede as sugestões fora do caminho da resposta.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && e.reason === 'answer' && (await read($, ligado))) {
      $.clock.after(0, () => void sugerir($))
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const lista = await read($, passos)
    const abaixo = await next(e)
    if (e.props.hasSurvey || e.props.isWorking || lista.length === 0) return abaixo

    const { Box, Text, Button } = $.ui.resolve(e)
    const compactar = await read($, compactarAntes)
    const escolher = async (texto: string) => {
      await update($, passos, () => [])
      if (compactar) await compactarEMandar($, texto)
      else await $.prompt.submit({ text: texto })
    }

    return (
      <Box flexDirection="column">
        {abaixo}
        <Box flexDirection="row" flexWrap="wrap">
          <Text color="cyan">➜ próximo: </Text>
          {lista.map((p, i) => (
            <Button key={`passo-${i}`} label={p} hotkey={String(i + 1)} onPress={() => void escolher(p)} />
          ))}
          <Button
            key="compactar"
            label={compactar ? '🗜 compactar antes: sim' : '🗜 compactar antes: não'}
            hotkey="c"
            plain
            dimColor={!compactar}
            onPress={() => void update($, compactarAntes, v => !v)}
          />
          <Button key="fechar" label="✕" plain dimColor onPress={() => void update($, passos, () => [])} />
        </Box>
      </Box>
    )
  })
}
