export type Segment = { text: string; color: string }

declare module 'claude-code' {
  interface PluginState {
    'vim-statusline': { segments: Segment[] }
  }
}
