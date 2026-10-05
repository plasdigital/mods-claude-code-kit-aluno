import type { EngineInterface, Register } from 'claude-code'

// A sua pasta de usuário (a mesma em que mora a pasta .claude), no Windows ou no Mac.
// O que o mod guarda fica em .claude/mods-estado, fora da pasta do mod: arquivo novo lá
// dentro faria o mod recarregar.
const casa = async ($: EngineInterface) =>
  ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.').replace(/\\/g, '/')
const LIMITE = 5000 // para de contar depois disso (pasta gigante)

type Alvo = { original: string; caminho: string }
type Contagem = { arquivos: number; bytes: number; existe: boolean; cortou: boolean }

// Separa os argumentos respeitando aspas: rm -rf "minha pasta" build
const argumentos = (t: string) =>
  [...t.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')

// Só entende o comando simples (um rm ou um Remove-Item sozinho); encadeado passa direto.
const alvosDoComando = (comando: string): string[] | null => {
  const c = comando.trim()
  if (/[;&|]|\n/.test(c)) return null
  const rm = /^rm\s+(.+)$/.exec(c)
  if (rm?.[1]) return argumentos(rm[1]).filter(a => !a.startsWith('-'))
  const ri = /^Remove-Item\s+(.+)$/i.exec(c)
  if (ri?.[1]) return argumentos(ri[1]).filter(a => !a.startsWith('-'))
  return null
}

const resolver = (p: string, cwd: string) => {
  let x = p.replace(/\\/g, '/')
  const posix = /^\/([a-zA-Z])\/(.*)$/.exec(x) // /c/Users/... do Git Bash
  if (posix) x = `${posix[1]?.toUpperCase()}:/${posix[2]}`
  if (/^[a-zA-Z]:\//.test(x) || x.startsWith('/')) return x // Windows ou Mac/Linux
  return `${cwd.replace(/\\/g, '/')}/${x}`
}

const contar = async ($: EngineInterface, caminho: string, c: Contagem) => {
  let st
  try {
    st = await $.fs.stat(caminho)
  } catch {
    return
  }
  c.existe = true
  if (st.kind === 'file') {
    c.arquivos += 1
    c.bytes += st.size
    return
  }
  if (st.kind !== 'dir') return
  const fila = [caminho]
  while (fila.length > 0 && c.arquivos < LIMITE) {
    const dir = fila.pop() as string
    for (const f of await $.fs.list(dir).catch(() => [])) {
      if (f.kind === 'dir') fila.push(`${dir}/${f.name}`)
      else if (f.kind === 'file') {
        c.arquivos += 1
        c.bytes += f.size
      }
    }
  }
  c.cortou = c.arquivos >= LIMITE
}

const tamanho = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`

const comandoDaLixeira = (shell: 'bash' | 'ps', alvos: Alvo[], destino: string) =>
  shell === 'bash'
    ? `mkdir -p "${destino}" && mv ${alvos.map(a => `"${a.caminho}"`).join(' ')} "${destino}/"`
    : `New-Item -ItemType Directory -Force "${destino}" | Out-Null; ${alvos
        .map(a => `Move-Item -LiteralPath "${a.caminho}" -Destination "${destino}"`)
        .join('; ')}`

const vigiar = async <R extends { deny?: string; isError?: boolean }>(
  $: EngineInterface,
  shell: 'bash' | 'ps',
  comando: string,
  seguir: (novoComando?: string) => Promise<R>,
): Promise<R | { deny: string }> => {
  const brutos = alvosDoComando(comando)
  if (!brutos || brutos.length === 0) return seguir()

  const cwd = await $.session.cwd()
  const alvos: Alvo[] = brutos.map(b => ({ original: b, caminho: resolver(b, cwd) }))
  const c: Contagem = { arquivos: 0, bytes: 0, existe: false, cortou: false }
  for (const a of alvos) await contar($, a.caminho, c)
  if (!c.existe) return seguir()

  const quantos = `${c.cortou ? 'mais de ' : ''}${c.arquivos} arquivo${c.arquivos === 1 ? '' : 's'} (${tamanho(c.bytes)})`
  const onde = alvos.map(a => a.original).join(', ')

  let escolha = 'Cancelar'
  try {
    escolha = await $.ui.ask(`🧨 Este comando apaga ${quantos} em: ${onde}. Como seguir?`, [
      'Mandar para a lixeira',
      'Apagar de vez',
      'Cancelar',
    ])
  } catch {
    // diálogo dispensado conta como cancelar
  }

  if (escolha === 'Mandar para a lixeira') {
    const carimbo = new Date(await $.clock.now()).toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const destino = `${await casa($)}/.claude/mods-estado/lixeira/${carimbo}`
    const r = await seguir(comandoDaLixeira(shell, alvos, destino))
    if (r.deny === undefined && !r.isError) $.ui.toast(`🧾 ${quantos} foram para a lixeira: ${destino}`, { timeoutMs: 10_000 })
    return r
  }
  if (escolha === 'Apagar de vez') {
    const r = await seguir()
    if (r.deny === undefined && !r.isError) $.ui.toast(`🧾 Apagados: ${quantos} em ${onde}`, { timeoutMs: 10_000 })
    return r
  }
  return { deny: `O usuário cancelou a exclusão de ${quantos} em ${onde}. Não tente apagar de outro jeito; pergunte a ele.` }
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) =>
    vigiar($, 'bash', e.command, novo => next(novo ? { ...e, command: novo } : e)),
  )

  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => {
    const comando = String((e as unknown as { command?: unknown }).command ?? '')
    return vigiar($, 'ps', comando, novo => next(novo ? ({ ...e, command: novo } as typeof e) : e))
  })
}
