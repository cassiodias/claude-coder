import { expect, test } from 'claude-code/testing'

import { NO_INPUT, SHIP_WIDTH, cells, newGame, spawn, step, togglePause } from '../hooks/arcade'
import type { Game, Input } from '../hooks/arcade'

const LEFT: Input = { left: 2, right: 0, fire: false }
const RIGHT: Input = { left: 0, right: 2, fire: false }
const FIRE: Input = { left: 0, right: 0, fire: true }

// A game with no enemy fire, so tests that aren't about bombs are not disturbed by them.
const calm = (g: Game): Game => ({ ...g, bombs: [] })

function run(g: Game, n: number, input: Input = NO_INPUT): Game {
  for (let i = 0; i < n; i++) g = calm(step(g, input))
  return g
}

const formationLeft = (g: Game) => Math.min(...g.invaders.map(i => i.x))

test('a new game', () => {
  const g = newGame(36, 14)
  expect([g.invaders.length, g.lives, g.score, g.wave, g.phase]).toEqual([18, 3, 0, 1, 'playing'])
})

test('the ship stops at the walls', () => {
  expect(run(newGame(36, 14), 100, LEFT).shipX).toBe(0)
  expect(run(newGame(36, 14), 100, RIGHT).shipX).toBe(36 - SHIP_WIDTH)
})

// A far invader that stays alive, so a kill does not clear the wave.
const FAR = { x: 30, y: 1, hp: 1 as const }

// Moves the first invader 4 rows above the ship and puts the gun one cell into the march
// direction, so the shot hits whether or not the formation steps sideways while it flies.
function underFire(g: Game, x = 10): Game {
  const [target, ...rest] = g.invaders
  return { ...g, invaders: [{ ...target!, x, y: g.rows - 4 }, ...rest], shipX: x + 1, dir: 1 }
}

function shoot(g: Game): Game {
  g = calm(step(g, FIRE))
  for (let i = 0; i < 6 && g.shots.length > 0; i++) g = calm(step(g, NO_INPUT))
  return g
}

test('a shot removes an invader and scores 10', () => {
  const g = newGame(36, 14)
  const after = shoot(underFire({ ...g, invaders: [{ x: 0, y: 1, hp: 1 }, FAR] }))
  expect(after.invaders.length).toBe(1)
  expect(after.score).toBe(10)
})

test('fire is ignored while the shot limit is on screen', () => {
  let g = newGame(36, 14)
  for (let i = 0; i < 5; i++) g = calm(step(g, FIRE))
  expect(g.shots.length).toBe(1)

  let r = spawn(newGame(36, 14), 'rapid')
  for (let i = 0; i < 5; i++) r = calm(step(r, FIRE))
  expect(r.shots.length).toBeGreaterThanOrEqual(2)
  expect(r.shots.length).toBeLessThanOrEqual(3)
})

test('rapid expires after 100 ticks', () => {
  const g = run(spawn(newGame(36, 14), 'rapid'), 101)
  expect(g.tick).toBeGreaterThan(g.rapidUntil)
})

test('a bomb on the ship costs a life', () => {
  const g = newGame(36, 14)
  const after = step({ ...g, bombs: [{ x: g.shipX, y: g.rows - 2 }] }, NO_INPUT)
  expect(after.lives).toBe(2)
  expect(after.bombs.some(b => b.y >= g.rows - 1)).toBe(false)
})

test('clearing the grid starts a faster wave 2', () => {
  const firstMove = (g: Game) => {
    const start = formationLeft(g)
    for (let t = 1; t < 50; t++) {
      g = calm(step(g, NO_INPUT))
      if (formationLeft(g) !== start) return t
    }
    return 50
  }
  const wave1 = newGame(36, 14)
  const wave2 = calm(step({ ...wave1, invaders: [] }, NO_INPUT))
  expect(wave2.wave).toBe(2)
  expect(wave2.invaders.length).toBe(18)
  expect(firstMove(wave2)).toBeLessThan(firstMove(wave1))
})

test('invaders reaching the ship row end the game', () => {
  const g = newGame(36, 14)
  const over = step({ ...g, invaders: [{ x: 10, y: g.rows - 1, hp: 1 }] }, NO_INPUT)
  expect(over.phase).toBe('over')
  expect(step(over, FIRE)).toEqual(over)
})

test('tough takes 2 hits', () => {
  let g = newGame(36, 14)
  const top = Math.min(...g.invaders.map(i => i.y))
  const left = g.invaders.filter(i => i.y === top).reduce((a, b) => (b.x < a.x ? b : a))
  g = spawn({ ...g, invaders: g.invaders.filter(i => i !== left) }, 'tough')
  const tough = g.invaders.find(i => i.hp === 2)!
  expect(tough).toBeTruthy()

  const once = shoot(underFire({ ...g, invaders: [tough, FAR] }))
  expect(once.score).toBe(0)
  expect(once.invaders[0]?.hp).toBe(1)
  const twice = shoot(underFire(once))
  expect(twice.invaders.length).toBe(1)
  expect(twice.score).toBe(30)
})

test('spawn fills the top-row edge slot', () => {
  const g = newGame(36, 14)
  const top = Math.min(...g.invaders.map(i => i.y))
  const left = g.invaders.filter(i => i.y === top).reduce((a, b) => (b.x < a.x ? b : a))
  const after = spawn({ ...g, invaders: g.invaders.filter(i => i !== left) }, 'invader')
  expect(after.invaders.some(i => i.x === left.x && i.y === top)).toBe(true)
  expect(after.invaders.length).toBe(18)
})

test('spawn is ignored when the top row is full', () => {
  const g = newGame(36, 14)
  expect(spawn(g, 'invader')).toEqual(g)
  expect(spawn(g, 'tough')).toEqual(g)
})

test('pause', () => {
  const g = newGame(36, 14)
  const paused = togglePause(g)
  expect(paused.phase).toBe('paused')
  expect(step(paused, RIGHT)).toEqual(paused)
  expect(togglePause(paused).phase).toBe('playing')
  const over = { ...g, phase: 'over' as const }
  expect(togglePause(over)).toEqual(over)
})

test('cells', () => {
  const rows = cells(newGame(36, 14))
  expect(rows.length).toBe(14)
  expect(rows.every(r => [...r].length === 36)).toBe(true)
  expect(rows[13]).toContain('▟▙')
})

test('same seed, same game', () => {
  const play = () => {
    let g = newGame(36, 14, 7)
    for (let i = 0; i < 300; i++) g = step(g, i % 7 === 0 ? FIRE : i % 3 === 0 ? RIGHT : NO_INPUT)
    return g
  }
  expect(play()).toEqual(play())
})
