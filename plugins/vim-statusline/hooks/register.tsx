import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import { fitLine, parseGit, SEP, MOCHA, type Git } from './format.ts'

const lineAtom = atom({ plugin: 'vim-statusline', key: 'line' } as const, null)

const readGit = async ($: EngineInterface): Promise<Git | undefined> => {
  try {
    const r = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'], { timeoutMs: 3000 })
    return r.exitCode === 0 ? parseGit(r.stdout) : undefined
  } catch {
    return undefined
  }
}

const clockTime = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const refresh = async ($: EngineInterface): Promise<void> => {
  try {
    await draw($)
  } catch {
    // A failed read leaves the last line up rather than breaking anything.
  }
}

const draw = async ($: EngineInterface): Promise<void> => {
  const [git, cwd, model, usage, now] = await Promise.all([
    readGit($),
    $.session.cwd(),
    $.session.model(),
    $.session.usage(),
    $.clock.now(),
  ])
  const line = {
    git,
    cwd,
    model,
    contextPercent: usage.context.percent,
    costUsd: usage.cost?.usd,
    rateLimits: [...usage.rateLimits],
    time: clockTime(now),
  }
  await update($, lineAtom, () => line)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // The line is drawn under the prompt now; drop the old plain-text status.
    $.ui.status(undefined)
    void refresh($)
    // Keeps the clock current and catches branch switches made outside Claude.
    $.clock.every(30_000, () => void refresh($))
    return started
  })

  on('session.measure', ($, e, next) => {
    void refresh($)
    return next(e)
  })

  // A command or an edit may have switched branches or changed files.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.tool === 'Bash' || e.tool === 'Edit' || e.tool === 'Write') void refresh($)
    return result
  }).catch(($, e, next) => next(e))

  // Draws the line in place of the hint under the prompt, keeping the hint dim at the end
  // while there's room. Redrawn on every width change, so it refits as the window resizes.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const line = await read($, lineAtom)
    if (!line) return next(e)
    const { segments, hint } = fitLine(line, e.props.hint, e.viewport?.columns ?? Infinity)
    const { Text } = $.ui.resolve(e)
    return (
      <Text wrap="truncate">
        {segments.map(s => (
          <Text color={s.color}>{s.text}</Text>
        ))}
        {hint ? <Text color={MOCHA.overlay0}>{SEP}{hint}</Text> : null}
      </Text>
    )
  })
}
