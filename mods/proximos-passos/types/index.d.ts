declare module 'claude-code' {
  interface PluginState {
    'proximos-passos': { passos: string[]; ligado: boolean }
  }
}

export type Passos = string[]
