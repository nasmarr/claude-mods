import { describe, test, expect } from 'claude-code/testing'
import { fitLine, folderName, formatLine, formatSegments, parseGit, prettyModel, LEAD, MOCHA, SEP } from './format.ts'

describe('prettyModel', () => {
  test('turns model ids into short names', () => {
    expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
    expect(prettyModel('claude-haiku-5-5')).toBe('Haiku 5.5')
    expect(prettyModel('claude-sonnet-4-5-20250929')).toBe('Sonnet 4.5')
    expect(prettyModel('claude-opus-4-20250514')).toBe('Opus 4')
    expect(prettyModel('claude-3-5-sonnet-20241022')).toBe('Sonnet 3.5')
  })
  test('handles the 1M variant and cloud ids', () => {
    expect(prettyModel('claude-opus-5-5[1m]')).toBe('Opus 5.5 1M')
    expect(prettyModel('us.anthropic.claude-sonnet-4-5-20250929-v1:0')).toBe('Sonnet 4.5')
    expect(prettyModel('claude-sonnet-4-5@20250929')).toBe('Sonnet 4.5')
  })
  test('leaves names it does not know alone', () => {
    expect(prettyModel('Opus 5.5')).toBe('Opus 5.5')
    expect(prettyModel('gpt-oss-120b')).toBe('gpt-oss-120b')
  })
})

describe('parseGit', () => {
  test('reads branch, changes and ahead/behind', () => {
    const out = '# branch.oid abcdef1234\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n1 .M N... 100644 100644 100644 a b f.ts\n? new.txt\n'
    expect(parseGit(out)).toEqual({ branch: 'main', changed: 2, ahead: 2, behind: 1 })
  })
  test('shows a detached head by commit', () => {
    expect(parseGit('# branch.oid abcdef1234\n# branch.head (detached)\n')?.branch).toBe('@abcdef1')
  })
})

describe('formatLine', () => {
  test('joins the segments neovim-style', () => {
    const line = formatLine({
      git: { branch: 'main', changed: 3, ahead: 1, behind: 0 },
      cwd: '/home/user/proj',
      model: 'claude-opus-5-5',
      contextPercent: 41.6,
      costUsd: 0.314,
      rateLimits: [{ kind: 'seven_day', percentUsed: 55 }, { kind: 'five_hour', percentUsed: 20 }],
      time: '14:05',
    })
    expect(line).toBe('⎇ main ●3 ↑1 │ ~/proj │ Opus 5.5 │ ctx 42% │ $0.31 │ 5h 20% │ 7d 55% │ 14:05')
  })
  test('colors each usage window by how full it is', () => {
    const segs = formatSegments({ cwd: '/tmp', rateLimits: [{ kind: 'seven_day', percentUsed: 90 }, { kind: 'five_hour', percentUsed: 12 }] })
    expect(segs.slice(-3)).toEqual([
      { text: '5h 12%', color: MOCHA.green },
      { text: ' │ ', color: MOCHA.overlay0 },
      { text: '7d 90%', color: MOCHA.red },
    ])
  })
})

describe('formatSegments', () => {
  test('colors each part in Catppuccin', () => {
    const segs = formatSegments({ git: { branch: 'main', changed: 1, ahead: 0, behind: 0 }, cwd: '/tmp', contextPercent: 90 })
    expect(segs).toEqual([
      { text: '⎇ main', color: MOCHA.mauve },
      { text: ' ●1', color: MOCHA.peach },
      { text: ' │ ', color: MOCHA.overlay0 },
      { text: '/tmp', color: MOCHA.blue },
      { text: ' │ ', color: MOCHA.overlay0 },
      { text: 'ctx 90%', color: MOCHA.red },
    ])
  })
})

describe('fitLine', () => {
  const l = { git: { branch: 'main', changed: 0, ahead: 0, behind: 0 }, cwd: '/home/user/work/proj', model: 'claude-opus-5-5', time: '14:05' }
  const hint = '(shift+tab to cycle)'
  const text = (f: ReturnType<typeof fitLine>) => f.segments.map(s => s.text).join('') + (f.hint ? SEP + f.hint : '')
  const full = formatLine(l) + SEP + hint

  test('keeps everything when there is room', () => {
    expect(text(fitLine(l, hint, LEAD + full.length))).toBe(full)
  })
  test('drops the hint first', () => {
    expect(text(fitLine(l, hint, LEAD + full.length - 1))).toBe('⎇ main │ ~/work/proj │ Opus 5.5 │ 14:05')
  })
  test('then the time', () => {
    const noTime = '⎇ main │ ~/work/proj │ Opus 5.5'
    expect(text(fitLine(l, hint, LEAD + [...noTime].length))).toBe(noTime)
  })
  test('then the folder\'s parents', () => {
    expect(text(fitLine(l, hint, LEAD + 20))).toBe('⎇ main │ proj │ Opus 5.5')
  })
  test('keeps everything when the width is unknown', () => {
    expect(text(fitLine(l, hint, Infinity))).toBe(full)
  })
})

describe('folderName', () => {
  test('keeps only the last folder', () => {
    expect(folderName('/home/user/work/proj')).toBe('proj')
    expect(folderName('/home/user')).toBe('~')
    expect(folderName('/')).toBe('/')
  })
})
