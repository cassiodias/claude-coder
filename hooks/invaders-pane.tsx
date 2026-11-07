import type { Elements } from 'claude-code'

import { cells } from './arcade'
import type { Game } from './arcade'
import { MIN_COLUMNS } from './invaders-game'
import type { Press } from './invaders-game'

// The /invaders pane: a header, the board, and a row of buttons whose hotkeys are the controls.

type Ui = Elements['terminal' | 'desktop' | 'vscode' | 'mobile']

const SHIP = '#D97757'
const INVADER = '#8FD18B'
const TOUGH = '#F2C14E'

// One color per row keeps each row a single Text: the ship's row, a row with a tough invader, or the rest.
function rowColor(row: string, isShipRow: boolean): string | undefined {
  if (isShipRow) return SHIP
  if (row.includes('█')) return TOUGH
  if (row.includes('▞')) return INVADER

  return undefined
}

function header(game: Game): string {
  if (game.phase === 'over') return `game over · score ${game.score}`
  const status = `score ${game.score} · lives ${game.lives} · wave ${game.wave}`

  return game.phase === 'paused' ? `${status} · paused` : status
}

export function InvadersPane({
  ui,
  game,
  columns,
  onPress,
}: {
  ui: Ui
  game: Game | undefined
  columns: number
  onPress: (kind: Press) => void
}) {
  const { Box, Text, Button } = ui
  const restart = <Button key="restart" hotkey="r" plain label="restart" onPress={() => onPress('restart')} />

  if (!game) {
    return (
      <Box flexDirection="column">
        <Text>press r to start</Text>
        {restart}
      </Box>
    )
  }
  if (columns < MIN_COLUMNS) return <Text>widen the pane to play</Text>
  const rows = cells(game)

  return (
    <Box flexDirection="column">
      <Text weight="bold" dimColor={game.phase === 'paused'}>{header(game)}</Text>
      {rows.map((row, i) => (
        <Text wrap="truncate" color={rowColor(row, i === rows.length - 1)} dimColor={game.phase !== 'playing'}>
          {row}
        </Text>
      ))}
      <Box flexDirection="row" gap={1}>
        <Button key="left" hotkey="a" plain label="◀" onPress={() => onPress('left')} />
        <Button key="right" hotkey="d" plain label="▶" onPress={() => onPress('right')} />
        <Button key="fire" hotkey="f" plain label="fire" onPress={() => onPress('fire')} />
        <Button
          key="pause"
          hotkey="p"
          plain
          label={game.phase === 'paused' ? 'resume' : 'pause'}
          onPress={() => onPress('pause')}
        />
        {game.phase === 'over' ? restart : null}
      </Box>
    </Box>
  )
}
