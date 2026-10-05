# Comece aqui

Faça uma vez, na ordem. Leva uns 5 minutos.

## 1. Deixe a pasta num lugar fixo

O Claude Code vai carregar os mods **desta pasta**. Se você mover ou apagar a pasta depois, os mods
param de carregar. Então tire ela de Downloads e ponha num lugar definitivo, por exemplo
`Documentos\mods-claude-code`.

Duas formas de baixar:

- **Com Git:** `git clone https://github.com/plasdigital/mods-claude-code-kit-aluno.git`
- **Sem Git:** no GitHub, botão verde **Code → Download ZIP**, e descompacte.

## 2. Confira o que você precisa

Abra o terminal e rode:

```bash
node --version
```

Apareceu um número (`v20…`, `v22…`)? Tem Node. Não apareceu? Instale a versão LTS em nodejs.org.

E atualize o Claude Code: no app de desktop ele se atualiza sozinho; no terminal, `claude update`.

## 3. Instale (pedindo ao Claude)

Abra o Claude Code **dentro desta pasta** e peça:

> *"Instala esses mods pra mim."*

Ele vai rodar o instalador em modo de prévia, mostrar quais mods entram e pedir o seu OK. Quer só
alguns? Diga quais: *"instala só o medidor de caixa, o painel de obra e o raio de explosão"*.

Prefere fazer à mão:

```bash
node instalar.mjs
```

```bash
node instalar.mjs --aplicar
```

O primeiro só mostra o que vai mudar. O segundo aplica. O instalador guarda uma cópia do seu
`settings.json` antes de mexer.

## 4. Abra uma conversa nova

Os mods carregam no começo da conversa. Abra uma conversa nova e, se aparecer um aviso pedindo para
ativar os mods (**Enable**), clique. Nem o Claude consegue clicar por você.

Você vai ver logo de cara a faixa do custo acima do campo de texto (medidor de caixa). Mande um
pedido qualquer e o painel de obra abre ao lado.

## 5. Ajuste os seus

Alguns mods ficam melhores com o seu dado:

| Mod | O que ajustar | Onde |
|---|---|---|
| **modo-gravacao** | nomes que não podem aparecer quando você grava a tela | `~/.claude/mods-estado/modo-gravacao/termos.txt` (um por linha) |
| **glossario-fala** | nomes que o seu ditado erra | `mods/glossario-fala/glossario.json` |
| **pasta-certa** | só funciona se os seus clientes ficam em `…/clientes/<nome-do-cliente>/` | — |
| **entregas** | sua pasta de projetos, para o painel agrupar por projeto | `RAIZ`, no começo de `mods/entregas/hooks/register.tsx` |

Não precisa abrir arquivo nenhum: peça ao Claude, dentro desta pasta. *"No modo gravação, borra
também o nome dos meus clientes Acme e Beta."*

## Desligar

*"Desliga o mod próximos passos"* ou, à mão:

```bash
node instalar.mjs --remover --aplicar
```

Isso desliga todos os mods desta pasta e deixa como estão os mods de outras pastas.
