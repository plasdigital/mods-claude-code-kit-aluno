import type { EngineInterface, Register } from 'claude-code'

// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')

const PEDIDO = `Escreva um RESUMO DE PASSAGEM desta conversa, para outra conversa continuar o trabalho sem perder nada.
Em português, markdown, no máximo 40 linhas, com estas seções:
## Objetivo — o que o usuário quer, em 1-2 frases
## Feito — o que já foi feito, com caminhos absolutos dos arquivos mexidos
## Decisões — o que foi decidido e por quê (inclui o que foi descartado)
## Falta — próximos passos, na ordem
## Contexto útil — comandos, ids, URLs e cuidados que a próxima conversa precisa saber
Responda só com o resumo.`

// O primeiro pedido da conversa nova: o resumo, e a ordem de esperar.
const abertura = (resumo: string, arquivo: string) => `Estou continuando o trabalho de outra conversa. Este é o resumo de passagem dela (salvo em ${arquivo}):

${resumo}

Leia, me diga em até 3 linhas onde paramos e qual é o próximo passo, e espere a minha instrução antes de mexer em qualquer coisa.`

const ABRIR = 'Abrir a conversa nova com o resumo'
const SO_SALVAR = 'Só salvar e copiar'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bastao',
      description: 'Resumo de passagem: salva, copia e abre uma conversa nova já com o resumo',
    })
    return next(e)
  })

  on('command.run', { command: 'bastao' }, async $ => {
    $.ui.toast('Gerando o resumo de passagem…')
    const resposta = await $.model.fork({ prompt: PEDIDO })
    if (!resposta.isAnswered) {
      return { text: `Não consegui gerar o resumo (${resposta.reason}).` }
    }
    const resumo = resposta.text.trim()

    const quando = new Date(await $.clock.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const sid = (await $.session.id()).slice(0, 8)
    const arquivo = `${await casa($)}/.claude/mods-estado/passar-o-bastao/${quando}-${sid}.md`
    await $.fs.write(arquivo, `${resumo}\n`)

    const copia = await $.ui.copy({ text: resumo })
    const copiou = copia.isCopied ? 'Copiado para a área de transferência.' : 'Não deu para copiar; está salvo no arquivo.'

    let escolha = SO_SALVAR
    try {
      escolha = await $.ui.ask('Resumo pronto. Abro a conversa nova já com ele?', [ABRIR, SO_SALVAR])
    } catch {
      // pergunta dispensada: fica só o resumo
    }

    if (escolha === ABRIR) {
      // Fora do hook: o /clear e o envio só rodam com a sessão parada.
      $.clock.after(0, async () => {
        try {
          await $.command.run({ command: 'clear', args: '' })
          await $.prompt.submit({ text: abertura(resumo, arquivo), asUser: true })
        } catch (erro) {
          $.ui.toast(`Não consegui abrir a conversa nova (${String(erro)}). O resumo está em ${arquivo}.`, { timeoutMs: 15_000 })
        }
      })
      return { text: `${copiou} Salvo em ${arquivo}\nAbrindo a conversa nova com o resumo…` }
    }

    return {
      text: `${resumo}\n\n---\n${copiou} Salvo em ${arquivo}\nPara continuar em outra conversa: abra uma nova e cole.`,
    }
  })
}
