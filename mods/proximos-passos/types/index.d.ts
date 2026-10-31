declare module 'claude-code' {
  interface PluginState {
    'proximos-passos': { passos: string[]; ligado: boolean; compactarAntes: boolean }
  }
}

export type Passos = string[]
