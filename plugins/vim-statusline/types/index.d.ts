export type Segment = { text: string; color: string }

export type Git = { branch: string; changed: number; ahead: number; behind: number }

export type Line = {
  git?: Git
  cwd: string
  model?: string
  contextPercent?: number
  costUsd?: number
  rateLimits?: { kind: string; percentUsed: number }[]
  time?: string
}

declare module 'claude-code' {
  interface PluginState {
    'vim-statusline': { line: Line | null }
  }
}
