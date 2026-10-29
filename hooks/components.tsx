import type { Elements } from 'claude-code'

import type { Desk } from '../types'
import { GAME_COLUMNS, invaderRows } from './invaders'
import type { Cell } from './invaders'

// The coder at a table with its laptop, as components; each takes the surface's element table as `ui`.

type Ui = Elements['terminal' | 'desktop' | 'vscode' | 'mobile']
type Run = { text: string; color?: string; bg?: string }

const CLAY = '#D97757'
const LAPTOP = '#D0D0D0'
const INVADER = '#8FD18B'
const SHOT = '#F2F2F2'
const BOOM = '#F2C14E'
const TABLE = '#8A6A4F'
const COLORS: Record<NonNullable<Cell['kind']>, string> = { invader: INVADER, ship: CLAY, shot: SHOT, boom: BOOM }

// The puppet from the side at a small `_|` laptop, paws on its keyboard; one paw taps while it works.
function puppet(tick: number, isTyping: boolean): Run[][] {
  const isUp = isTyping && tick % 4 < 2

  return [
    [{ text: '            ' }],
    [{ text: '            ' }],
    [{ text: ' ▄████▄     ', color: CLAY }],
    [{ text: ' ███ ██   ', color: CLAY }, { text: '▐', color: LAPTOP }, { text: ' ' }],
    [
      { text: ' ██████', color: CLAY },
      { text: isUp ? '▀' : '▀▀', color: CLAY, bg: LAPTOP },
      { text: isUp ? '▄▄' : '▄', color: LAPTOP },
      { text: '▟', color: LAPTOP },
      { text: ' ' },
    ],
  ]
}

// Joins neighbouring cells of one kind into runs of text, so each row is a few Texts.
function runs(cells: Cell[]): Run[] {
  const out: Run[] = []
  for (const cell of cells) {
    const color = cell.kind ? COLORS[cell.kind] : undefined
    const last = out[out.length - 1]
    if (last && last.color === color) last.text += cell.char
    else out.push({ text: cell.char, color })
  }

  return out
}

// The laptop: a lid with the score, the game, and the keyboard.
function laptop(desk: Desk, tick: number, sinceShot: number): Run[][] {
  const score = String(desk.score).padStart(5, '0')
  const lid = `╭${'─'.repeat(GAME_COLUMNS - score.length - 2)} ${score} ╮`
  const game = invaderRows(tick, desk.score, sinceShot, desk.isLive).map(row => [
    { text: '│', color: LAPTOP },
    ...runs(row),
    { text: '│', color: LAPTOP },
  ])

  return [[{ text: lid, color: LAPTOP }], ...game, [{ text: `╰${'▀'.repeat(GAME_COLUMNS)}╯`, color: LAPTOP }]]
}

function Header({ ui, desk }: { ui: Ui; desk: Desk }) {
  const { Text } = ui

  return (
    <Text weight="bold" wrap="truncate">
      {desk.command} · {desk.edits} edits · {desk.runs} runs · {desk.reads} reads{desk.isLive ? '' : ' ✓'}
    </Text>
  )
}

export function Coder({ ui, desk, tick, sinceShot }: { ui: Ui; desk: Desk; tick: number; sinceShot: number }) {
  const { Box, Text } = ui
  const body = puppet(tick, desk.isLive)
  const screen = laptop(desk, tick, sinceShot)
  const width = body[0]![0]!.text.length + GAME_COLUMNS + 2

  return (
    <Box flexDirection="column">
      <Header ui={ui} desk={desk} />
      {screen.map((row, i) => (
        <Text wrap="truncate" dimColor={!desk.isLive}>
          {body[i]!.map(run => <Text color={run.color} backgroundColor={run.bg}>{run.text}</Text>)}
          {row.map(run => <Text color={run.color}>{run.text}</Text>)}
        </Text>
      ))}
      <Text wrap="truncate" color={TABLE} dimColor={!desk.isLive}>{'▀'.repeat(width + 2)}</Text>
    </Box>
  )
}
