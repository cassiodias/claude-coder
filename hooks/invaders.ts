// The game on the laptop screen: a row of invaders marches, and each tool call shoots one down.

export const GAME_COLUMNS = 22
export const GAME_ROWS = 3
const WAVE = 5
const SLOT = 4
// The order the invaders fall in, so a wave does not empty from one side.
const ORDER = [2, 0, 4, 1, 3]
const FORMATION = (WAVE - 1) * SLOT + 2
const EXPLOSION_TICKS = 4

export type Cell = { char: string; kind?: 'invader' | 'ship' | 'shot' | 'boom' }

function bounce(n: number, span: number): number {
  if (span <= 0) return 0
  const p = n % (2 * span)

  return p < span ? p : 2 * span - p
}

// Draws the screen for a score and the ticks since the last shot; a still game once the work is done.
export function invaderRows(tick: number, score: number, sinceShot: number, isPlaying: boolean): Cell[][] {
  const rows: Cell[][] = Array.from({ length: GAME_ROWS }, () =>
    Array.from({ length: GAME_COLUMNS }, () => ({ char: ' ' })),
  )
  const march = isPlaying ? bounce(Math.floor(tick / 5), GAME_COLUMNS - FORMATION) : 0
  const killed = score % WAVE
  const target = score > 0 ? ORDER[(score - 1) % WAVE]! : -1
  const isShooting = isPlaying && score > 0 && sinceShot < EXPLOSION_TICKS
  const legs = isPlaying && Math.floor(tick / 3) % 2 === 0 ? '▞▚' : '▚▞'
  const at = (slot: number) => march + slot * SLOT
  const alive = new Set(ORDER.slice(killed))
  if (killed === 0 && isShooting) alive.delete(target)

  alive.forEach(slot => [...legs].forEach((char, i) => (rows[0]![at(slot) + i] = { char, kind: 'invader' })))
  if (isShooting && sinceShot >= 1) rows[0]![at(target)] = { char: '✶', kind: 'boom' }
  if (isShooting && sinceShot >= 1) rows[0]![at(target) + 1] = { char: '✶', kind: 'boom' }
  if (isShooting && sinceShot < 1) [...legs].forEach((char, i) => (rows[0]![at(target) + i] = { char, kind: 'invader' }))

  const ship = isShooting ? at(target) : isPlaying ? bounce(Math.floor(tick / 2), GAME_COLUMNS - 2) : Math.floor(GAME_COLUMNS / 2) - 1
  if (isShooting && sinceShot < 1) rows[1]![ship] = { char: '╻', kind: 'shot' }
  rows[2]![ship] = { char: '▟', kind: 'ship' }
  rows[2]![ship + 1] = { char: '▙', kind: 'ship' }

  return rows
}
