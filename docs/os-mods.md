# Os 12 mods

Todo mod entra num momento do Claude Code e age **antes** (pergunta, avisa), **no lugar** (muda o
que acontece) ou **depois** (mostra). Só dois chamam a IA e gastam uso; os outros dez são código
rodando na sua máquina, de graça.

| Mod | Momento | Age | Gasta uso? |
|---|---|---|---|
| raio-de-explosao | o Claude vai rodar um comando | antes + no lugar | não |
| pasta-certa | você manda um pedido | antes | não |
| conflito-de-edicao | o Claude vai editar um arquivo | antes | não |
| painel-de-obra | cada pedido e cada ação do Claude | depois | não |
| medidor-de-caixa | fim de cada resposta + a cada minuto | depois | não |
| proximos-passos | fim de cada resposta | depois | **sim**, uma chamada por resposta |
| passar-o-bastao | você roda `/bastao` | comando | **sim**, uma chamada por `/bastao` |
| modo-gravacao | a tela vai desenhar uma mensagem | no lugar | não |
| cofre-env | o Claude vai ler um arquivo ou rodar um comando | no lugar | não |
| entregas | o Claude escreveu um arquivo + você pergunta "cadê" | depois + antes | não |
| acabei-de-baixar | você manda um pedido | antes | não (o pedido fica um pouco maior) |
| glossario-fala | você manda um pedido | antes | não |

---

## raio-de-explosao

**O problema:** o Claude apaga uma pasta e não tem volta.

Quando o Claude vai rodar `rm …` ou `Remove-Item …`, o mod conta o que vai embora e pergunta:

> 🧨 Este comando apaga 41 arquivos (2,3 MB) em: build. Como seguir?
> **Mandar para a lixeira** · **Apagar de vez** · **Cancelar**

"Mandar para a lixeira" troca o comando por um que **move** os arquivos para
`~/.claude/mods-estado/lixeira/<data-e-hora>/`. Depois aparece o recibo: *🧾 41 arquivos foram para a lixeira*.

Limite: só entende o comando simples. `rm -rf build && npm run build` passa direto.

## pasta-certa

**O problema:** muita conversa aberta, e você pede coisa do cliente A na pasta do cliente B.

Se a conversa está em `…/clientes/acme/`, a barra mostra `📍 cliente: acme`. Mande um pedido que cita
outro cliente (outra pasta dentro de `clientes/`) e ele pergunta:

> Esta conversa está na pasta do cliente "acme", mas o pedido fala do cliente "beta". Continuar aqui?

Ajustes no começo do arquivo: `COMUNS` (primeiros nomes de pasta comuns demais, como "joao") e
`ASSUNTOS_DA_EMPRESA` (assuntos que não são de cliente nenhum, como o nome da sua empresa).

## conflito-de-edicao

**O problema:** duas conversas mexendo no mesmo arquivo, uma desfaz a outra.

Cada conversa anota o que editou. Antes de editar, o mod confere se o arquivo mudou nos últimos 30
minutos fora desta conversa:

> "proposta.html" foi alterado há 2 minutos, na outra conversa "ajusta o preço da proposta". Editar mesmo assim?

Também pega mudança feita por você no editor ou por um script.

## painel-de-obra

**O problema:** você manda o Claude trabalhar e não sabe o que ele está fazendo.

Um painel ao lado, que abre sozinho na primeira ação, lista ao vivo: `👀 lendo…`, `✏️ editando…`,
`⚙️ rodando…`, com ⏳ / ✅ / ❌ e um contador no topo (ações, arquivos mexidos, erros). Cada pedido seu
abre um bloco novo. `/obra` reabre o painel.

## medidor-de-caixa

**O problema:** quanto essa conversa está custando? E o cache?

Uma faixa acima do campo de texto:

> 💰 US$ 1,84 nesta conversa (preço de API) · último pedido +US$ 0,12 · contexto 34% (68 mil de 200 mil) · ❄️ cache esfria em 52 min

- **Preço de API:** na assinatura você não paga isso; serve de régua.
- **Contexto:** fica amarelo em 60% e vermelho em 80%.
- **Cache:** cada mensagem manda a conversa inteira de novo. Respondendo rápido, ela sai quase de
  graça (está em cache). Parado tempo demais, o cache esfria e o próximo pedido paga tudo. O mod conta
  1 hora depois da última resposta (`CACHE_MS`, no começo do arquivo; confira o tempo do seu plano) e
  avisa 5 minutos antes.
- **Desligar o cache:** `/sem-cache` esconde o relógio e o aviso só na conversa aberta; `/com-cache`
  traz de volta. Conversa nova começa sempre ligada.

## proximos-passos

**O problema:** terminou, e agora?

Depois de cada resposta aparecem 3 botões com pedidos curtos (*"Testa o mod no terminal"*). Um clique
(ou a tecla 1, 2, 3) manda o pedido. `/passos` liga e desliga.

💸 Gasta uso: para sugerir, o mod faz uma pergunta à IA a cada resposta.

## passar-o-bastao

**O problema:** a conversa ficou enorme e você não quer perder o que foi feito.

`/bastao` pede à IA um resumo de passagem (objetivo, feito, decisões, falta, contexto útil), salva em
`~/.claude/mods-estado/passar-o-bastao/`, copia para a área de transferência e pergunta se abre a
conversa nova. Abrindo, a conversa é limpa e já começa com o resumo, e o Claude diz onde parou.

💸 Gasta uso: uma chamada à IA por `/bastao`.

## modo-gravacao

**O problema:** você grava a tela e aparece e-mail, telefone, chave.

`/gravar` liga: e-mails, telefones, CPF, CNPJ, tokens, chaves de API e os termos da sua lista aparecem
como `▒▒▒▒▒▒▒▒` na tela, inclusive nos painéis dos outros mods. A barra mostra
`🔴 GRAVANDO · dados sensíveis borrados`. O Claude continua lendo tudo normalmente; só a tela esconde.

A sua lista: `~/.claude/mods-estado/modo-gravacao/termos.txt`, um termo por linha.

Limite: a barra lateral do app (a lista de conversas) não é do mod. Recolha ela antes de gravar.

## cofre-env

**O problema:** a IA lê os seus `.env` e as chaves aparecem na conversa.

Quando o Claude tenta ler um `.env` (pelo leitor de arquivos, pela busca ou por `cat`/`Get-Content`
no terminal), o mod bloqueia e devolve só o **nome** de cada chave e se está preenchida ou vazia.
Para você aparece uma faixa com o link do arquivo, as chaves vazias e os botões *abrir o arquivo*,
*copiar caminho*, *reler*.

- Os seus scripts continuam lendo o `.env` normalmente (dotenv, `node --env-file`).
- O Claude ainda grava uma chave que você colou, sem imprimir o arquivo.
- `/env <nome>` mostra o arquivo `ferramentas/<nome>/.env.local` da pasta da conversa (ajuste
  `PASTA_DAS_CHAVES` no começo do arquivo se as suas chaves moram em outro lugar).

## entregas

**O problema:** "cadê aquele arquivo que a IA fez ontem?"

Todo arquivo que o Claude cria ou edita fica anotado, de todas as conversas. `/entregas` abre um
painel com a lista, agrupada por pasta, com link e filtro. E um pedido com *cadê* / *onde está*
já chega para a IA com os arquivos que casam, sem ela gastar uma volta procurando.

Uma vez a cada 6 horas o mod lê as suas conversas dos últimos 30 dias (os arquivos `.jsonl` em
`~/.claude/projects/`) para pegar o que foi feito antes de ele existir. Isso roda na sua máquina,
com o Node, e não chama a IA.

## acabei-de-baixar

**O problema:** "pega o PDF que eu baixei agora" e a IA sai procurando.

Se o pedido fala em *baixei*, *gerei*, *exportei* ou *Downloads*, o mod anexa ao pedido a lista dos
arquivos que chegaram em `~/Downloads` nas últimas 3 horas (ou os 5 mais novos de 48 horas), com
caminho completo, tamanho e hora.

## glossario-fala

**O problema:** você dita por voz e o ditado erra os nomes ("cloud code", "supa base").

Antes do pedido chegar na IA, o mod troca os nomes errados pelos certos e mostra o que trocou. Nome
que pode ser palavra comum não é trocado: a IA só recebe a dica. Links, caminhos e código entre
crases nunca são mexidos.

A lista: `mods/glossario-fala/glossario.json`. Acrescente os nomes dos seus clientes e ferramentas.
