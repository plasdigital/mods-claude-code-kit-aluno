export type Termos = string[]

declare module 'claude-code' {
  interface PluginState {
    'modo-gravacao': { ligado: boolean; termos: Termos }
  }
}
