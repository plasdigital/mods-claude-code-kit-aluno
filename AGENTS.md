# Mods do Claude Code — manual do agente

## Regras que não se pulam

Mods são um recurso do **Claude Code**: só ele carrega estes arquivos. Você pode ler, explicar e
editar os mods, mas quem roda é o Claude Code do dono.

- Nunca rodar `node instalar.mjs --aplicar` sem mostrar a prévia e o dono dizer sim.
- Nunca esvaziar `~/.claude/mods-estado/lixeira/` sem pedido explícito.

Esta pasta traz 12 mods do Claude Code (`mods/<nome>/`) e o `instalar.mjs`, que liga e desliga os
mods no `~/.claude/settings.json` do dono.

## As possibilidades

### Read-only (pode rodar sem perguntar)

| O dono pede | Você faz |
|---|---|
| "o que esses mods fazem?" / "qual mod resolve X?" | Ler `docs/os-mods.md` e responder |
| "quais mods estão ligados?" | `node instalar.mjs` (prévia, não altera nada) |
| "esse mod está certo?" | `claude plugin validate mods/<nome>` |
| "audita como eu uso o Claude Code" | Seguir `docs/auditoria.md` (só lê as conversas e sugere; não constrói nada) |

### Muda o mundo (mostrar a prévia e esperar o "sim")

| O dono pede | Você faz |
|---|---|
| "instala os mods" | `node instalar.mjs` → mostrar o que entra → OK → `node instalar.mjs --aplicar` |
| "instala só X e Y" | `node instalar.mjs --so x,y` → OK → mesmo comando com `--aplicar` |
| "desliga tudo" | `node instalar.mjs --remover` → OK → `--remover --aplicar` |
| "desliga só o X" | `--so` com a lista dos que ficam (os outros saem) → OK → `--aplicar` |
| "muda o mod X para…" | Editar `mods/<x>/hooks/register.ts(x)` → `claude plugin validate mods/<x>` |
| "borra também o nome Y quando eu gravo" | Acrescentar uma linha em `~/.claude/mods-estado/modo-gravacao/termos.txt` |
| "o ditado erra o nome Z" | Acrescentar em `mods/glossario-fala/glossario.json` (`trocas` se não for palavra comum; senão `sugestoes`) |
| "cria um mod novo que…" | Seguir `docs/como-funciona-um-mod.md`; criar em `mods/<nome-novo>/`; validar; `node instalar.mjs --so <lista com o novo>` |

Depois de `--aplicar`: dizer ao dono para abrir uma conversa nova e clicar **Enable** se o aviso aparecer.
Editar um arquivo de um mod já ligado recarrega o mod sozinho nas conversas abertas.

## O que precisa estar configurado

| Para | Precisa | Como checar |
|---|---|---|
| qualquer mod | Claude Code atualizado | `claude --version` (versão velha não tem mods) |
| instalar | Node.js | `node --version` |
| `entregas` (histórico) | Node.js em `C:/Program Files/nodejs/node.exe` no Windows, ou `node` no PATH no Mac | `node --version` |
| `pasta-certa` | conversas abertas em `…/clientes/<cliente>/` | olhar o caminho da pasta da conversa |
| `acabei-de-baixar` | a pasta Downloads em `~/Downloads` | `ls ~/Downloads` |

## As travas

- **Nunca** rodar `instalar.mjs --aplicar` sem antes mostrar a prévia (`node instalar.mjs`) e o dono dizer sim.
- **Nunca** editar `~/.claude/settings.json` à mão para ligar mod: usar o `instalar.mjs`, que guarda cópia e não mexe nos mods de outras pastas.
- **Nunca** esvaziar `~/.claude/mods-estado/lixeira/` sem pedido explícito: é o que salva o dono de um apagão.
- **Nunca** contornar o `cofre-env` (ler `.env` por outro caminho). Bloqueou? Use o resumo de chaves que ele devolve.
- Ao esbarrar numa pergunta de mod ("Continuar aqui?", "Editar mesmo assim?"), quem responde é o dono. Cancelou? Não tente o mesmo de outro jeito.

## As armadilhas

| O que aparece | O que significa |
|---|---|
| `claude plugin validate` dá erro em tudo | O `claude` do terminal é mais velho que o do app. Atualize (`claude update`) |
| Os mods sumiram no meio da conversa | Trocar de modelo reinicia a conversa e os mods ficam desligados até recarregar e clicar **Enable** de novo |
| Mod não carrega e nenhum aviso aparece | A pasta foi movida depois de instalar. Rode `node instalar.mjs --aplicar` de novo |
| Muitos sublinhados vermelhos no editor ao abrir um mod | Falta a pasta de tipos (`.claude-plugin/types/`), que só serve ao editor e não vai no kit (565 KB por mod). O mod roda e valida sem ela |
| `acabei-de-baixar` não anexa nada | Downloads fora de `~/Downloads` (OneDrive, outro disco) |
| `pasta-certa` nunca pergunta | A conversa não está dentro de uma pasta `clientes/<nome>/` |
| `proximos-passos` / `passar-o-bastao` | São os únicos que chamam a IA: gastam uso a cada resposta / a cada `/bastao` |
| No Mac, o resumo do `cofre-env` mostra caminho estranho | Os caminhos dele são de Windows. O bloqueio funciona; o resumo de chaves pode falhar |
| `raio-de-explosao` não perguntou | Ele só lê comando simples (`rm …` ou `Remove-Item …` sozinho). Encadeado com `;`, `&&` ou `|` passa direto |

## Onde está o porquê

- `docs/os-mods.md` — cada mod: o problema, o evento em que entra, antes/no lugar/depois, o que mostra, se gasta uso.
- `docs/como-funciona-um-mod.md` — anatomia de um mod e como criar o seu.
- `docs/auditoria.md` — o pedido que lê as conversas do dono e sugere mods.
