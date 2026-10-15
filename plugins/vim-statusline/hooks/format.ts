import type { Segment, Git, Line } from '../types'

export type { Git, Line }

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

const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable']
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

// `claude-opus-5-5` → `Opus 5.5`. Handles date suffixes, `[1m]`, Bedrock/Vertex
// prefixes and the older `claude-3-5-sonnet` order; anything else passes through.
export const prettyModel = (id: string): string => {
  const oneM = /\[1m\]$/i.test(id) ? ' 1M' : ''
  const name = id
    .toLowerCase()
    .replace(/\[1m\]$/, '')
    .replace(/^.*?claude-/, '')
    .replace(/-v\d+(:\d+)?$/, '') // Bedrock `-v1:0`
    .replace(/[-@]\d{8}$/, '') // date suffix, Vertex `@20250929`
  const parts = name.split('-')
  const family = parts.find(p => FAMILIES.includes(p))
  const version = parts.filter(p => /^\d+$/.test(p) && p.length <= 2)
  if (!family || !version.length) return id
  return `${capitalize(family)} ${version.join('.')}${oneM}`
}

export const shortenPath =(path: string): string =>
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
  if (l.model) groups.push([{ text: prettyModel(l.model), color: MOCHA.lavender }])
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

// Room the engine takes before the line: the indent and a mode label like `⏵⏵ auto mode on · `.
export const LEAD = 22

const cells = (s: string): number => [...s].length
const segmentsWidth = (segs: Segment[]): number => segs.reduce((n, s) => n + cells(s.text), 0)

// `~/work/claude-mods` → `claude-mods`.
export const folderName = (path: string): string => shortenPath(path).split('/').filter(Boolean).pop() ?? '/'

// Fits the line to the terminal, giving up the least useful parts first: the
// hint, then the time, then the folder's parents. Past that the row truncates.
export const fitLine = (l: Line, hint: string | undefined, columns: number): { segments: Segment[]; hint?: string } => {
  const room = columns - LEAD
  const full = formatSegments(l)
  if (!hint || segmentsWidth(full) + cells(SEP + hint) <= room) return { segments: full, hint }
  if (segmentsWidth(full) <= room) return { segments: full }
  const noTime = formatSegments({ ...l, time: undefined })
  if (segmentsWidth(noTime) <= room) return { segments: noTime }
  return { segments: formatSegments({ ...l, time: undefined, cwd: folderName(l.cwd) }) }
}
