// The playable game behind /invaders: pure functions over a plain value, so a tick is
// `step(game, input)` and a test can replay any game from its seed.

export type Input = { left: number; right: number; fire: boolean }
export type SpawnKind = 'invader' | 'tough' | 'rapid'
export type Phase = 'playing' | 'paused' | 'over'
export type Invader = { x: number; y: number; hp: 1 | 2; tough?: true }
export type Point = { x: number; y: number }
export type Game = {
  columns: number
  rows: number
  shipX: number
  shots: Point[]
  bombs: Point[]
  invaders: Invader[]
  lives: number
  score: number
  wave: number
  tick: number
  phase: Phase
  rapidUntil: number
  seed: number
  // Where the formation's top-left slot is now, which way it marches, and when it next steps.
  originX: number
  originY: number
  dir: 1 | -1
  nextMarch: number
}

export const SHIP_WIDTH = 2
export const NO_INPUT: Input = { left: 0, right: 0, fire: false }

const GRID_ROWS = 3
const GRID_COLUMNS = 6
const PITCH = 3
const FULL = GRID_ROWS * GRID_COLUMNS
const LIVES = 3
const RAPID_TICKS = 100
const POINTS = 10
const TOUGH_POINTS = 30

function grid(originX: number, originY: number): Invader[] {
  return Array.from({ length: FULL }, (_, i) => ({
    x: originX + (i % GRID_COLUMNS) * PITCH,
    y: originY + Math.floor(i / GRID_COLUMNS),
    hp: 1 as const,
  }))
}

function marchInterval(wave: number, alive: number): number {
  return Math.max(1, 6 - (wave - 1) - Math.floor((FULL - alive) / 4))
}

function wave(game: Game, number: number): Game {
  return {
    ...game,
    invaders: grid(2, 1),
    shots: [],
    bombs: [],
    wave: number,
    originX: 2,
    originY: 1,
    dir: 1,
    nextMarch: game.tick + marchInterval(number, FULL),
  }
}

export function newGame(columns: number, rows: number, seed = 1): Game {
  const blank: Game = {
    columns,
    rows,
    shipX: Math.floor((columns - SHIP_WIDTH) / 2),
    shots: [],
    bombs: [],
    invaders: [],
    lives: LIVES,
    score: 0,
    wave: 1,
    tick: 0,
    phase: 'playing',
    rapidUntil: -1,
    seed,
    originX: 2,
    originY: 1,
    dir: 1,
    nextMarch: 0,
  }

  return wave(blank, 1)
}

function next(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff
}

const covers = (inv: Invader, p: Point) => p.y === inv.y && (p.x === inv.x || p.x === inv.x + 1)

// Shots that meet an invader are spent; each hit takes 1 hp and a kill scores.
function resolveHits(game: Game): Game {
  let { score } = game
  let invaders = game.invaders
  const shots = game.shots.filter(shot => {
    const target = invaders.find(inv => covers(inv, shot))
    if (!target) return true
    if (target.hp === 2) {
      invaders = invaders.map(inv => (inv === target ? { ...inv, hp: 1 } : inv))
    } else {
      invaders = invaders.filter(inv => inv !== target)
      score += target.tough ? TOUGH_POINTS : POINTS
    }

    return false
  })

  return { ...game, shots, invaders, score }
}

function march(game: Game): Game {
  if (game.tick < game.nextMarch || game.invaders.length === 0) return game
  const left = Math.min(...game.invaders.map(inv => inv.x))
  const right = Math.max(...game.invaders.map(inv => inv.x)) + 1
  const blocked = right + game.dir > game.columns - 1 || left + game.dir < 0
  const nextMarch = game.tick + marchInterval(game.wave, game.invaders.length)

  if (blocked) {
    return {
      ...game,
      invaders: game.invaders.map(inv => ({ ...inv, y: inv.y + 1 })),
      originY: game.originY + 1,
      dir: game.dir === 1 ? -1 : 1,
      nextMarch,
    }
  }

  return {
    ...game,
    invaders: game.invaders.map(inv => ({ ...inv, x: inv.x + game.dir })),
    originX: game.originX + game.dir,
    nextMarch,
  }
}

// The lowest invader of a random column may drop a bomb; the chance grows with the wave.
function dropBomb(game: Game): Game {
  if (game.invaders.length === 0) return game
  const roll = next(game.seed)
  const pick = next(roll)
  if (roll / 0x7fffffff >= 0.03 * game.wave) return { ...game, seed: pick }
  const columns = [...new Set(game.invaders.map(inv => inv.x))]
  const x = columns[pick % columns.length]!
  const lowest = Math.max(...game.invaders.filter(inv => inv.x === x).map(inv => inv.y))

  return { ...game, seed: pick, bombs: [...game.bombs, { x, y: lowest + 1 }] }
}

export function step(game: Game, input: Input): Game {
  if (game.phase !== 'playing') return game
  const ship = game.rows - 1
  const shipX = Math.min(
    game.columns - SHIP_WIDTH,
    Math.max(0, game.shipX + Math.min(2, input.right) - Math.min(2, input.left)),
  )
  const limit = game.tick <= game.rapidUntil ? 3 : 1
  const fired = input.fire && game.shots.length < limit ? [{ x: shipX, y: ship - 1 }] : []
  let g: Game = {
    ...game,
    shipX,
    shots: [...game.shots, ...fired].map(s => ({ ...s, y: s.y - 1 })).filter(s => s.y >= 0),
    bombs: game.bombs.map(b => ({ ...b, y: b.y + 1 })).filter(b => b.y <= ship),
  }

  g = resolveHits(g)
  const hitShip = g.bombs.filter(b => b.y === ship && (b.x === shipX || b.x === shipX + 1))
  if (hitShip.length > 0) g = { ...g, lives: g.lives - 1, bombs: g.bombs.filter(b => !hitShip.includes(b)) }
  g = resolveHits(march(g))
  g = dropBomb(g)
  g = { ...g, tick: g.tick + 1 }

  if (g.lives <= 0 || g.invaders.some(inv => inv.y >= ship)) return { ...g, phase: 'over' }
  if (g.invaders.length === 0) return wave(g, g.wave + 1)

  return g
}

// Claude's work joins the game: an invader in the free top-row slot nearest an edge, or rapid fire.
export function spawn(game: Game, kind: SpawnKind): Game {
  if (kind === 'rapid') return { ...game, rapidUntil: game.tick + RAPID_TICKS }
  const free = Array.from({ length: GRID_COLUMNS }, (_, c) => c)
    .map(c => ({ c, x: game.originX + c * PITCH }))
    .filter(({ x }) => x >= 0 && x + 1 < game.columns)
    .filter(({ x }) => !game.invaders.some(inv => inv.y === game.originY && inv.x === x))
    .sort((a, b) => Math.min(a.c, GRID_COLUMNS - 1 - a.c) - Math.min(b.c, GRID_COLUMNS - 1 - b.c) || a.c - b.c)
  const slot = free[0]
  if (!slot || game.originY >= game.rows - 2) return game
  const invader: Invader = kind === 'tough' ? { x: slot.x, y: game.originY, hp: 2, tough: true } : { x: slot.x, y: game.originY, hp: 1 }

  return { ...game, invaders: [...game.invaders, invader] }
}

export function togglePause(game: Game): Game {
  if (game.phase === 'over') return game

  return { ...game, phase: game.phase === 'playing' ? 'paused' : 'playing' }
}

export function cells(game: Game): string[] {
  const board = Array.from({ length: game.rows }, () => Array.from({ length: game.columns }, () => ' '))
  const put = (x: number, y: number, ch: string) => {
    if (y >= 0 && y < game.rows && x >= 0 && x < game.columns) board[y]![x] = ch
  }
  game.invaders.forEach(inv => {
    const [a, b] = inv.hp === 2 ? ['█', '▙'] : ['▞', '▚']
    put(inv.x, inv.y, a!)
    put(inv.x + 1, inv.y, b!)
  })
  game.shots.forEach(s => put(s.x, s.y, '╻'))
  game.bombs.forEach(b => put(b.x, b.y, '┇'))
  put(game.shipX, game.rows - 1, '▟')
  put(game.shipX + 1, game.rows - 1, '▙')

  return board.map(row => row.join(''))
}
