import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'

import type { Aberto, Chave } from '../types'

// Cofre dos .env:
// - a IA não lê mais .env / .env.local: Read, Grep e cat/Get-Content/grep... no terminal são
//   respondidos pelo mod com o NOME de cada chave e se está preenchida ou vazia, nunca o valor;
// - os scripts continuam lendo o arquivo (node --env-file, dotenv), e a IA ainda grava uma chave
//   que o usuário colou (>> ou sed -i), sem imprimir o arquivo;
// - sempre que um .env entra na conversa, aparece para o usuário uma faixa com o link do arquivo,
//   as chaves vazias e o botão de abrir no Bloco de Notas. /env <ferramenta> abre a mesma faixa.

// /env <nome> procura <pasta da conversa>\ferramentas\<nome>\.env.local. Guarda as chaves
// em outra pasta? Troque 'ferramentas' pelo nome dela.
const PASTA_DAS_CHAVES = 'ferramentas'
const VALIDADE_MIN = 30

const aberto = atom({ plugin: 'cofre-env', key: 'aberto' } as const, null)

const ENV_NOME = /^\.env(\.[\w-]+)*$/i
const EXEMPLO = /\.(example|sample|template|exemplo|modelo)$/i
const LEITOR =
  /(^|[\s;&|(`$])(cat|type|more|less|head|tail|bat|nl|strings|xxd|od|cut|sort|uniq|awk|grep|egrep|rg|findstr|Get-Content|gc|Select-String|sls|Import-Csv|ConvertFrom-StringData|sed(?![^;&|]*\s-i))\b/i
const SCRIPT_QUE_IMPRIME = /\b(node|python3?|py)\b[^;&|]*\s-(e|c|p)\s[^;&|]*(readFileSync|open\(|read_text|Get-Content)/i
const PEDE_LINK = /(\benv\b|\.env|chave|token|senha|secret|api ?key)/i
const PEDE_LINK_2 = /\b(link|preench\w*|colar|cola|caminho|abr[ei]r?)\b/i

const ehEnv = (p: string) => {
  const nome = p.split(/[\\/]/).pop() ?? ''
  return ENV_NOME.test(nome) && !EXEMPLO.test(nome)
}
const normal = (p: string) => p.replace(/\//g, '\\').replace(/\\{2,}/g, '\\')
const absoluto = (p: string) => /^[a-zA-Z]:[\\/]/.test(p)

function link(p: string): string {
  const [drive, ...resto] = normal(p).split('\\')
  return `file:///${drive}/${resto.map(encodeURIComponent).join('/')}`
}

// Os caminhos de .env citados num comando (entre aspas ou não).
function envsDoComando(cmd: string): string[] {
  const achados = new Set<string>()
  const re = /"([^"]*)"|'([^']*)'|([^\s"'|;&<>()]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cmd))) {
    const tok = (m[1] ?? m[2] ?? m[3] ?? '').replace(/^--?[\w-]+=/, '')
    if (tok && ehEnv(tok)) achados.add(tok)
  }
  // Segunda passada: .env dentro de uma string maior (node -e "...readFileSync('.env.local')...").
  for (const x of cmd.match(/[^\s"'`(),;=]*\.env(?:\.[\w-]+)*(?![\w.-])/g) ?? []) {
    if (ehEnv(x) && ![...achados].some(a => a.endsWith(x) || x.endsWith(a))) achados.add(x)
  }
  return [...achados]
}

// Só gravação (>> .env.local, > .env.local)? Então não é leitura.
function soGrava(cmd: string, alvos: string[]): boolean {
  let resto = cmd
  for (const a of alvos) {
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    resto = resto.replace(new RegExp(`>>?\\s*["']?${esc}["']?`, 'g'), ' ')
  }
  return alvos.every(a => !resto.includes(a))
}

async function resolver($: EngineInterface, p: string, cmd = ''): Promise<string> {
  if (absoluto(p)) return normal(p)
  const base: string[] = []
  const cd = cmd.match(/\bcd\s+(?:"([^"]+)"|'([^']+)'|(\S+))/)
  const dir = cd?.[1] ?? cd?.[2] ?? cd?.[3]
  if (dir && absoluto(dir)) base.push(dir)
  base.push(await $.session.cwd())
  for (const b of base) {
    const c = normal(`${b}\\${p}`)
    try {
      if (await $.fs.exists(c)) return c
    } catch {}
  }
  return normal(`${base[0]}\\${p}`)
}

async function chavesDe($: EngineInterface, caminho: string): Promise<Chave[] | null> {
  let texto: string
  try {
    texto = await $.fs.read(caminho)
  } catch {
    return null
  }
  const chaves: Chave[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*)$/)
    if (!m) continue
    const valor = (m[2] ?? '').replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2').trim()
    chaves.push({ nome: m[1] ?? '', cheia: valor.length > 0 })
  }
  return chaves
}

function resumo(caminho: string, chaves: Chave[] | null): string {
  if (!chaves) return `${caminho}: arquivo não existe (ainda).`
  if (!chaves.length) return `${caminho}: nenhuma chave escrita.`
  return `${caminho}: ` + chaves.map(c => `${c.nome}=${c.cheia ? 'preenchida' : 'VAZIA'}`).join(', ')
}

async function mostrar($: EngineInterface, caminho: string, motivo: string): Promise<Chave[] | null> {
  const chaves = await chavesDe($, caminho)
  await update($, aberto, () => ({ caminho, chaves: chaves ?? [], motivo, em: Date.now() }))
  return chaves
}

async function negar($: EngineInterface, caminhos: string[], como: string) {
  const linhas: string[] = []
  for (const c of caminhos) linhas.push(resumo(c, await mostrar($, c, 'a IA tentou ler')))
  return {
    deny:
      `🔒 cofre-env: a IA não lê arquivos .env — ${como} foi bloqueado. ` +
      `O que dá para saber sem ver valores:\n${linhas.join('\n')}\n` +
      `Os scripts continuam lendo o arquivo normalmente (dotenv, node --env-file). ` +
      `Para gravar uma chave que o usuário colou, use o terminal sem imprimir o arquivo: ` +
      `\`printf 'NOME=valor\\n' >> "<arquivo>"\` ou \`sed -i 's/^NOME=.*/NOME=valor/' "<arquivo>"\`. ` +
      `O usuário já está vendo o link do arquivo na tela; para ele preencher, mande o caminho como link markdown.`,
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'env',
      description: 'Link do arquivo de chaves de uma ferramenta e quais chaves estão vazias',
      argumentHint: '[ferramenta ou caminho]',
    })
    return next(e)
  })

  on('command.run', { command: 'env' }, async ($, e) => {
    const arg = (e.args ?? '').trim().replace(/^["']|["']$/g, '')
    const FERRAMENTAS = `${await $.session.cwd()}\\${PASTA_DAS_CHAVES}`
    let caminho: string | null = null
    if (arg && absoluto(arg)) caminho = normal(ehEnv(arg) ? arg : `${arg}\\.env.local`)
    else if (arg) caminho = `${FERRAMENTAS}\\${arg}\\.env.local`
    else {
      const local = normal(`${await $.session.cwd()}\\.env.local`)
      caminho = (await $.fs.exists(local)) ? local : ((await read($, aberto))?.caminho ?? null)
    }
    if (!caminho) {
      // Sem argumento e sem .env por perto: lista as ferramentas com chave vazia.
      const pastas = (await $.fs.list(FERRAMENTAS).catch(() => [])).filter(x => x.kind === 'dir')
      const linhas: string[] = []
      for (const p of pastas) {
        const c = await chavesDe($, `${FERRAMENTAS}\\${p.name}\\.env.local`)
        const vazias = (c ?? []).filter(x => !x.cheia).map(x => x.nome)
        if (vazias.length) linhas.push(`${p.name}: ${vazias.join(', ')}`)
      }
      return { text: linhas.length ? `Chaves vazias por ferramenta (use /env <ferramenta> para o link):\n${linhas.join('\n')}` : 'Nenhuma ferramenta com chave vazia.' }
    }
    const chaves = await mostrar($, caminho, 'pedido do usuário (/env)')
    return { text: `Link na faixa acima do campo de texto. ${resumo(caminho, chaves)}` }
  })

  on('tool.call', async ($, e, next) => {
    const a = e as unknown as { file_path?: string; path?: string; glob?: string; command?: string }

    if (e.tool === 'Read' && a.file_path && ehEnv(a.file_path)) {
      return negar($, [await resolver($, a.file_path)], 'o Read')
    }

    if (e.tool === 'Grep' && ((a.path && ehEnv(a.path)) || (a.glob && /\.env/i.test(a.glob)))) {
      return negar($, a.path && ehEnv(a.path) ? [await resolver($, a.path)] : [], 'o Grep em .env')
    }

    if ((e.tool === 'Edit' || e.tool === 'Write') && a.file_path && ehEnv(a.file_path)) {
      const r = await next(e)
      await mostrar($, await resolver($, a.file_path), 'a IA gravou no arquivo')
      return r
    }

    if ((e.tool === 'Bash' || e.tool === 'PowerShell') && a.command) {
      const alvos = envsDoComando(a.command)
      if (!alvos.length) return next(e)
      const le = (LEITOR.test(a.command) || SCRIPT_QUE_IMPRIME.test(a.command)) && !soGrava(a.command, alvos)
      // Só conta .env que existe de verdade: ".env" citado num texto (commit, memória) não é leitura.
      const resolvidos = await Promise.all(alvos.map(x => resolver($, x, a.command)))
      const existe = await Promise.all(resolvidos.map(c => $.fs.exists(c).catch(() => false)))
      const caminhos = resolvidos.filter((_, i) => existe[i])
      if (!caminhos.length) return next(e)
      if (le) return negar($, caminhos, 'o comando de leitura')
      const r = await next(e)
      for (const c of caminhos) await mostrar($, c, 'a IA usou o arquivo')
      return r
    }

    return next(e)
  })

  // "me dá o link do env": a IA já recebe o caminho, e o usuário já vê a faixa.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    if (!PEDE_LINK.test(e.text) || !PEDE_LINK_2.test(e.text)) return next(e)
    const atual = await read($, aberto)
    if (!atual) return next(e)
    await mostrar($, atual.caminho, 'o usuário pediu o link')
    return next({
      ...e,
      context: [
        ...(e.context ?? []),
        `[mod cofre-env] O arquivo de chaves desta conversa é ${atual.caminho}. Se o usuário pede o link, responda na primeira linha com [${atual.caminho.split('\\').slice(-2).join('\\')}](${link(atual.caminho)}) — ele também já está na faixa da tela dele.`,
      ],
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const a: Aberto | null = await read($, aberto)
    if (e.props.hasSurvey || !a || Date.now() - a.em > VALIDADE_MIN * 60000) return next(e)
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const vazias = a.chaves.filter(c => !c.cheia).map(c => c.nome)
    const curto = a.caminho.split('\\').slice(-2).join('\\')
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Markdown key="link" text={`🔒 [${curto}](${link(a.caminho)})`} />
          <Text dimColor>· {a.motivo}</Text>
        </Box>
        <Text wrap="truncate-end" color={vazias.length ? 'yellow' : undefined} dimColor={!vazias.length}>
          {a.chaves.length === 0 ? 'arquivo sem chaves (ou não existe ainda)' : vazias.length ? `vazias: ${vazias.join(', ')}` : `todas as ${a.chaves.length} chaves preenchidas`}
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button
            key="abrir"
            label="abrir o arquivo"
            hotkey="o"
            variant="primary"
            onPress={async () => {
              const windows = (await $.env.get('OS')) === 'Windows_NT'
              await $.process.run(windows ? ['cmd.exe', '/c', 'start', '', 'notepad.exe', a.caminho] : ['open', '-t', a.caminho], { timeoutMs: 10000 })
            }}
          />
          <Button key="copiar" label="copiar caminho" hotkey="c" onPress={async ev => { await $.ui.copy({ text: a.caminho, surface: ev.surface }) }} />
          <Button key="reler" label="reler" hotkey="r" dimColor onPress={() => mostrar($, a.caminho, 'relido')} />
          <Button key="fechar" label="fechar" role="dismiss" dimColor onPress={() => update($, aberto, () => null)} />
        </Box>
      </Box>
    )
  })
}
