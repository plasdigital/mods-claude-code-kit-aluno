export type Entrega = {
  /** caminho absoluto, como a ferramenta recebeu */
  p: string
  /** quando, ms desde a época */
  t: number
  /** Write, Edit, NotebookEdit ou SendUserFile */
  op: string
  /** conversa que escreveu */
  s: string
}

declare module 'claude-code' {
  interface PluginState {
    entregas: { filtro: string; lista: Entrega[]; sessao: string; carregando: boolean }
  }
}
