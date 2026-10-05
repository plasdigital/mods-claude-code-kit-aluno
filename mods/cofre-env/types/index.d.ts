export type Chave = { nome: string; cheia: boolean }

export type Aberto = { caminho: string; chaves: Chave[]; motivo: string; em: number }

declare module 'claude-code' {
  interface PluginState {
    'cofre-env': { aberto: Aberto | null }
  }
}
