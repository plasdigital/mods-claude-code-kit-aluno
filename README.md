# Mods do Claude Code — 12 prontos para usar

Mods são pedaços de código que se encaixam **dentro** do Claude Code: mostram coisa nova na tela,
perguntam antes de uma ação, mudam a ação e criam comandos seus. Esta pasta traz 12 mods prontos e
um instalador que liga todos (ou só os que você escolher) no seu Claude Code.

Você não precisa programar. Abra o Claude Code dentro desta pasta e peça em português:
*"instala esses mods pra mim"*.

## Os 12 mods

| Mod | O que resolve | Comando |
|---|---|---|
| **raio-de-explosao** | Antes de apagar arquivos, mostra quantos vão embora e oferece mandar para a lixeira | — |
| **pasta-certa** | Avisa quando o pedido fala de um cliente e a conversa está na pasta de outro | — |
| **conflito-de-edicao** | Avisa antes de editar um arquivo que outra conversa (ou você) mexeu há pouco | — |
| **painel-de-obra** | Painel ao lado com o que o Claude está fazendo, ao vivo | `/obra` |
| **medidor-de-caixa** | Faixa com o custo da conversa, o contexto usado e quando o cache esfria | `/sem-cache` · `/com-cache` |
| **proximos-passos** | 3 botões com os próximos pedidos depois de cada resposta | `/passos` |
| **passar-o-bastao** | Resumo da conversa para continuar numa conversa nova, sem perder nada | `/bastao` |
| **modo-gravacao** | Borra e-mail, telefone, CPF, chaves e nomes da sua lista na tela | `/gravar` |
| **cofre-env** | A IA não lê mais os seus `.env`: vê só o nome das chaves e se estão vazias | `/env` |
| **entregas** | Guarda todo arquivo que a IA criou; "cadê o arquivo X?" já chega respondido | `/entregas` |
| **acabei-de-baixar** | "Baixei um PDF agora": o pedido já chega com os arquivos novos de Downloads | — |
| **glossario-fala** | Corrige os nomes que o ditado por voz erra antes de chegar na IA | — |

O que cada um faz em detalhe, em que momento entra e se gasta uso: [docs/os-mods.md](docs/os-mods.md).

## O que você precisa

- **Claude Code atualizado** (app de desktop ou terminal). Mods são recurso novo; versão velha não carrega.
- **Node.js** instalado (o instalador e o mod `entregas` usam).

## Ordem de leitura

1. [COMECE-AQUI.md](COMECE-AQUI.md) — instalar, uma vez só.
2. [docs/os-mods.md](docs/os-mods.md) — o que cada mod faz.
3. [docs/como-funciona-um-mod.md](docs/como-funciona-um-mod.md) — para mudar um mod ou criar o seu.
4. [docs/auditoria.md](docs/auditoria.md) — o pedido que lê as suas conversas e sugere os mods que **você** precisa.

> ⚠️ Mods são recurso em teste (early access) do Claude Code: a forma de escrever pode mudar entre
> versões. Os mods foram feitos e testados no Windows; no Mac a maioria funciona, e os pontos que
> dependem do Windows estão listados no [CLAUDE.md](CLAUDE.md).
