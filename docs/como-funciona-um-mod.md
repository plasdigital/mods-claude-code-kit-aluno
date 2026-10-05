# Como funciona um mod

## A ideia em uma frase

Toda vez que o Claude Code vai fazer alguma coisa (receber um pedido, ler, editar, apagar, responder,
desenhar a tela), ele dispara um **evento**. Um mod se inscreve nos eventos que interessam e pode
entrar **antes**, **no lugar** ou **depois**.

```
        o Claude vai apagar a pasta build
                      │
   ANTES ────────────►│  "vai apagar 41 arquivos, confirma?"      (perguntar)
   NO LUGAR ─────────►│  em vez de apagar, manda pra lixeira       (mudar a ação)
   DEPOIS ───────────►│  "🧾 apaguei 41 arquivos daqui"            (recibo)
                      ▼
```

**A diferença para o que já existia:**

- **Skill:** você chama, e ela ensina o Claude a fazer uma tarefa.
- **Hook:** roda um script num momento fixo, mas não desenha nada nem pergunta na tela.
- **Mod:** fica ligado, **muda a tela**, **pergunta**, **cria comando** e **muda a ação**.

## A anatomia

```
mods/raio-de-explosao/
├── .claude-plugin/
│   └── plugin.json        nome, versão, descrição
├── hooks/
│   ├── hooks.json         { "modules": ["./register.ts"] } — qual arquivo carregar
│   └── register.ts        o mod de verdade
└── types/index.d.ts       (opcional) o formato do que o mod guarda
```

O `register.ts` exporta uma função que recebe `on` e se inscreve nos eventos:

```ts
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // ANTES: olhar e.command, perguntar com $.ui.ask(...)
    const resposta = await next(e)          // deixa o Claude rodar (ou passe outro comando)
    // DEPOIS: $.ui.toast('feito')
    return resposta                          // ou { deny: 'motivo' } para não deixar rodar
  })
}
```

`next(e)` é "seguir em frente". Não chamar `next` e devolver `{ deny }` é impedir.

## Os eventos que estes 12 mods usam

| Evento | Quando dispara | Quem usa |
|---|---|---|
| `session.start` | a conversa começa (bom para registrar comando) | quase todos |
| `prompt.submit` | você manda um pedido (dá para mudar o texto ou anexar contexto) | pasta-certa, acabei-de-baixar, glossario-fala, entregas, cofre-env |
| `tool.call` | o Claude vai usar uma ferramenta (Bash, Edit, Read…) | raio-de-explosao, conflito-de-edicao, cofre-env, entregas, painel-de-obra |
| `turn.complete` | o Claude terminou de responder | medidor-de-caixa, proximos-passos |
| `ui.render` | a tela vai desenhar um pedaço (faixa acima do campo, painel, mensagem) | medidor-de-caixa, proximos-passos, painel-de-obra, modo-gravacao, cofre-env, entregas |
| `command.run` | você rodou um `/comando` do mod | painel-de-obra, passar-o-bastao, modo-gravacao, proximos-passos, cofre-env, entregas |

## O que o mod consegue fazer (o `$`)

| Para | Use | Exemplo neste kit |
|---|---|---|
| perguntar | `$.ui.ask(pergunta, opções)` | raio-de-explosao |
| avisar rápido | `$.ui.toast(texto)` | medidor-de-caixa (cache esfriando) |
| linha na barra | `$.ui.status(texto)` | pasta-certa, modo-gravacao |
| painel ao lado | `$.ui.open({ id, title })` + `ui.render` no `Pane` | painel-de-obra, entregas |
| criar comando | `$.command.register({ name })` + `command.run` | `/bastao`, `/gravar` |
| ler e gravar arquivo | `$.fs.read`, `$.fs.write`, `$.fs.list`, `$.fs.stat` | conflito-de-edicao |
| perguntar à IA | `$.model.fork({ prompt })` — **gasta uso** | proximos-passos, passar-o-bastao |
| rodar um programa | `$.process.run([...])` | entregas (Node) |
| relógio | `$.clock.now()`, `$.clock.every(ms, fn)` | medidor-de-caixa |
| lembrar entre redesenhos | `atom` + `read` / `update` | medidor-de-caixa, proximos-passos |

## Criar o seu

Não precisa escrever código. Dentro desta pasta, peça ao Claude:

> *"Cria um mod novo em mods/ que, antes de qualquer `git push`, me mostra quais arquivos vão subir e pergunta se pode."*

Ele cria a pasta com o mesmo formato dos outros, valida com `claude plugin validate mods/<nome>` e
liga com o `instalar.mjs`. Depois: conversa nova, **Enable**, e use.

Três regras que os 12 mods seguem e o seu também deve seguir:

1. **Guardar coisas fora da pasta do mod** (`~/.claude/mods-estado/`). Arquivo novo dentro da pasta
   do mod faz o mod recarregar.
2. **Pergunta dispensada conta como "cancelar".** Se você fechar o diálogo, o mod não segue sozinho.
3. **Mod que fala com um sistema seu** (um app de tarefas, um banco) funciona do mesmo jeito: chama
   um script com `$.process.run` e mostra o resultado. Só não serve para outra pessoa sem o sistema.
