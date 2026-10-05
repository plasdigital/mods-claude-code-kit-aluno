import { test, expect } from 'claude-code/testing'

// O kit de teste não dá acesso a disco ao mod: aqui nenhum .env "existe". O bloqueio de um
// .env real no terminal foi conferido ao vivo (05/10/2026).
const FALSO = 'C:\\temp\\env-falso\\.env.local'

test('Read de .env é negado e não vaza valor', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => ({ result: { type: 'text', file: { filePath: FALSO, content: 'NÃO DEVIA CHEGAR', numLines: 1, startLine: 1, totalLines: 1 } } }) as never)
  const r = await $.tool.call({ tool: 'Read', file_path: FALSO })
  const texto = String((r as { deny?: string; text?: string }).deny ?? (r as { text?: string }).text ?? '')
  expect(texto).toContain('cofre-env')
  expect(texto.includes('valor-secreto-123')).toBe(false)
  expect(texto.includes('NÃO DEVIA CHEGAR')).toBe(false)
})

test('".env" citado num texto não bloqueia o comando', async ($, on) => {
  let rodou = 0
  on('tool.call', { tool: 'Bash' }, () => {
    rodou += 1
    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })
  await $.tool.call({ tool: 'Bash', command: `printf -- '- cofre do .env + 4 mods\\n' >> MEMORY.md && tail -2 MEMORY.md` })
  await $.tool.call({ tool: 'Bash', command: `printf 'NOVA=1\\n' >> "${FALSO}"` })
  await $.tool.call({ tool: 'Bash', command: `node --env-file="${FALSO}" -e "1"` })
  expect(rodou).toBe(3)
})
