export type Leitura = {
  usd: number
  ultimoPedido: number
  percent: number
  tokens: number
  janela: number
  fimDoTurno: number
}

declare module 'claude-code' {
  interface PluginState {
    'medidor-de-caixa': { leitura: Leitura | null; tique: number }
  }
}
