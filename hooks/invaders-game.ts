import type { EngineInterface, Timer } from 'claude-code'

import { NO_INPUT, newGame, spawn, step, togglePause } from './arcade'
import type { Game, Input, SpawnKind } from './arcade'

// The /invaders game while its pane is open: one game, stepped ten times a second, fed by
// the person's hotkeys and by Claude's tool calls. A reload of the mod starts it over.

export type Press = 'left' | 'right' | 'fire' | 'pause' | 'restart'

export const BOARD_COLUMNS = 36
export const BOARD_ROWS = 14
const TICK_MS = 100
const MOVE = 2

let game: Game | undefined
let pending: Input = NO_INPUT
let timer: Timer | undefined

export function startGame($: EngineInterface): void {
  game = newGame(BOARD_COLUMNS, BOARD_ROWS)
  pending = NO_INPUT
  timer ??= $.clock.every(TICK_MS, () => {
    if (!game) return
    game = step(game, pending)
    pending = NO_INPUT
    $.ui.invalidate('ui.render')
  })
}

export function stopGame(): void {
  timer?.cancel()
  timer = undefined
  game = undefined
  pending = NO_INPUT
}

// Presses within one tick add up, but the ship moves at most MOVE cells a tick either way.
export function press($: EngineInterface, kind: Press): void {
  if (kind === 'restart') {
    if (!game || game.phase === 'over') startGame($)
  } else if (!game) {
    return
  } else if (kind === 'pause') {
    game = togglePause(game)
  } else if (kind === 'fire') {
    pending = { ...pending, fire: true }
  } else {
    pending = { ...pending, [kind]: Math.min(MOVE, pending[kind] + MOVE) }
  }
  $.ui.invalidate('ui.render')
}

export function feed(kind: SpawnKind): void {
  if (game?.phase === 'playing') game = spawn(game, kind)
}

export function current(): Game | undefined {
  return game
}
