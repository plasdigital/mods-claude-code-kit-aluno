# A auditoria: os mods que VOCÊ precisa

Os 12 mods desta pasta nasceram de um jeito: o Claude leu as conversas de quem os usa, achou o que
se repetia e sugeriu um mod para cada repetição. O melhor mod para você nasce das **suas** conversas.

## O pedido

Abra uma conversa nova no Claude Code e cole:

> Faça uma auditoria de como eu uso o Claude Code. Leia minhas últimas 30 sessões em
> `~/.claude/projects/` (as transcrições `.jsonl`, das mais recentes para as mais antigas). Procure:
>
> - coisas que eu peço repetidamente
> - coisas que eu confiro manualmente (uso, cache, estado do git, quais arquivos mudaram)
> - passos que eu sempre faço antes ou depois de um certo tipo de tarefa
>
> Depois, sugira 5 mods do Claude Code que resolveriam isso. Para cada um, informe:
>
> - o nome
> - o problema que ele resolve (cite o momento da sessão que mostra isso)
> - o evento em que ele se encaixa, e se ele age antes, depois ou no lugar
> - o que ele mostra na tela
> - se ele consome uso
>
> Ordene os mods pelo tempo que economizariam. Não construa nada ainda.

## Depois

1. Leia as 5 sugestões. Confira se o problema citado é mesmo seu.
2. Escolha **uma** e peça: *"faz o número 2, dentro da pasta mods/ deste kit"*.
3. Peça para ligar: *"liga o mod novo junto com os outros"* (o Claude roda o `instalar.mjs`).
4. Abra uma conversa nova, clique **Enable** se o aviso aparecer, e use.

## Cuidados

- As suas conversas têm tudo o que você já colou nelas. Rode a auditoria numa conversa sua, não
  numa gravação, ou ligue o `/gravar` antes.
- *"Não construa nada ainda"* é de propósito: mod é conversa. Confira a lista do que ele vai fazer
  antes de mandar fazer. Um pedido mal entendido vira um mod que você não pediu.
