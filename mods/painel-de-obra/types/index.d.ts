export type ItemDeObra = {
  id: string
  tipo: 'pedido' | 'acao'
  texto: string
  estado: 'rodando' | 'ok' | 'erro'
}

declare module 'claude-code' {
  interface PluginState {
    'painel-de-obra': { itens: ItemDeObra[] }
  }
}
