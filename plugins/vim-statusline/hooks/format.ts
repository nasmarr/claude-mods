import type { Segment } from '../types'

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

// Catppuccin Mocha.
export const MOCHA = {
  red: '#f38ba8',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  blue: '#89b4fa',
  lavender: '#b4befe',
  mauve: '#cba6f7',
  overlay0: '#6c7086',
} as const

export const SEP = ' │ '

// Parses `git status --porcelain=v2 --branch`.
export const parseGit = (out: string): Git | undefined => {
  let branch = ''
  let oid = ''
  let ahead = 0
  let behind = 0
  let changed = 0
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) branch = line.slice(14)
    else if (line.startsWith('# branch.oid ')) oid = line.slice(13, 20)
    else if (line.startsWith('# branch.ab ')) {
      const [a, b] = line.slice(12).split(' ')
      ahead = Number(a)
      behind = -Number(b)
    } else if (line && !line.startsWith('#')) changed++
  }
  if (!branch) return undefined
  if (branch === '(detached)') branch = oid ? `@${oid}` : 'detached'
  return { branch, changed, ahead, behind }
}

export const shortenPath = (path: string): string =>
  path.replace(/^\/home\/[^/]+(?=\/|$)/, '~')

const RATE_LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const shortRateLimit = (kind: string): string => RATE_LIMIT_LABELS[kind] ?? kind
// Shortest window first: 5h, then 7d, then anything else.
const rateLimitOrder = (kind: string): number => {
  const i = Object.keys(RATE_LIMIT_LABELS).indexOf(kind)
  return i === -1 ? Infinity : i
}

// Green while there's room, warming toward red as it fills.
const fillColor = (percent: number): string =>
  percent >= 85 ? MOCHA.red : percent >= 60 ? MOCHA.peach : percent >= 40 ? MOCHA.yellow : MOCHA.green

// Each group is one `│`-separated section; segments within it sit side by side.
export const formatGroups = (l: Line): Segment[][] => {
  const groups: Segment[][] = []
  if (l.git) {
    const g: Segment[] = [{ text: `⎇ ${l.git.branch}`, color: MOCHA.mauve }]
    if (l.git.changed) g.push({ text: ` ●${l.git.changed}`, color: MOCHA.peach })
    if (l.git.ahead) g.push({ text: ` ↑${l.git.ahead}`, color: MOCHA.green })
    if (l.git.behind) g.push({ text: ` ↓${l.git.behind}`, color: MOCHA.red })
    groups.push(g)
  }
  groups.push([{ text: shortenPath(l.cwd), color: MOCHA.blue }])
  if (l.model) groups.push([{ text: l.model, color: MOCHA.lavender }])
  if (l.contextPercent !== undefined) {
    const pct = Math.round(l.contextPercent)
    groups.push([{ text: `ctx ${pct}%`, color: fillColor(pct) }])
  }
  if (l.costUsd !== undefined) groups.push([{ text: `$${l.costUsd.toFixed(2)}`, color: MOCHA.yellow }])
  // Each usage window its own section, colored by how full it is.
  const limits = [...(l.rateLimits ?? [])].sort((a, b) => rateLimitOrder(a.kind) - rateLimitOrder(b.kind))
  for (const r of limits) {
    const pct = Math.round(r.percentUsed)
    groups.push([{ text: `${shortRateLimit(r.kind)} ${pct}%`, color: fillColor(pct) }])
  }
  if (l.time) groups.push([{ text: l.time, color: MOCHA.sky }])
  return groups
}

// Flattens the groups with colored separators between them.
export const formatSegments = (l: Line): Segment[] =>
  formatGroups(l).flatMap((g, i) => (i ? [{ text: SEP, color: MOCHA.overlay0 }, ...g] : g))

export const formatLine = (l: Line): string => formatSegments(l).map(s => s.text).join('')
