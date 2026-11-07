# /invaders: a playable Space Invaders in puppet-coder

Date: 2026-11-07
Status: approved design, awaiting spec review

## Goal

Add a `/invaders` slash command to puppet-coder that opens a pane with a small,
playable Space Invaders. The person plays it with the keyboard. While Claude
works, Claude's tool calls drop extra invaders or a power-up into the game, so
a busy turn changes the game.

The existing auto-play band and pane (`/coder-demo` and the configured
commands) stay as they are.

## Scope

In:

- One grid of invaders: 3 rows × 6 columns. They march sideways and step down
  a row at each edge.
- The player's ship on the bottom row. It moves left and right and fires one
  shot at a time.
- Invaders fire back. The game starts with 3 lives. When the grid is cleared,
  the next wave starts faster. The game is over when lives reach 0 or the
  invaders reach the ship's row.
- Score and lives shown in a one-line header.
- Claude link: each `tool.call` the mod sees adds to the game while it runs (see "Claude events" below).
- Surfaces: terminal and desktop, which draw `Client`. On mobile and VS Code
  the pane shows one line: "/invaders needs the terminal or desktop app".

Out (YAGNI): shields, bonus saucer, saved high score, sound, mouse control.

## Controls

| Key | Action |
| --- | --- |
| ← / → or a / d | move ship |
| space | fire |
| p | pause / resume |
| r | restart (only on game over) |
| Esc | closes the pane (engine-owned; never reaches the game) |

## Architecture

Three units, each with one job:

### `hooks/arcade.ts`: pure game logic

No UI, no engine imports. Deterministic given its inputs, so it can be unit
tested.

```ts
export type Input = { left: boolean; right: boolean; fire: boolean }
export type SpawnKind = 'invader' | 'tough' | 'rapid'
export type Game = { /* board size, ship x, shots, invaders, bombs, lives, score, wave, tick, phase: 'playing' | 'paused' | 'over', rapidUntil */ }

export function newGame(columns: number, rows: number, seed?: number): Game
export function step(game: Game, input: Input): Game   // one 50 ms tick
export function spawn(game: Game, kind: SpawnKind): Game
export function togglePause(game: Game): Game
export function cells(game: Game): string[]             // rows of text to draw
```

- The march speed comes from `wave` and the number of invaders left. Fewer
  invaders and higher waves step more often, as in the classic.
- Bombs use a small seeded RNG kept in `Game`, so tests can repeat a game.
- `tough` invaders take 2 hits and are drawn differently.
- `rapid` allows 3 player shots on screen for 10 s (200 ticks).
- `spawn('invader' | 'tough')` puts the new invader in the top-row slot
  closest to the formation's edge. If the top row is full it does nothing,
  so the game can't become impossible.

### `hooks/invaders-client.tsx`: the `Client` surface module

- On the first call (`state === undefined`), it creates the game with
  `newGame(columns, rows)`, starts `surface.every(50, tick)` once, and sets the
  `onKey` listener.
- Keys set flags in an input. The tick calls `step`, clears `fire`, and
  `setState`s. A held key is treated as tapped, because terminals send key
  repeats rather than key-up events. Movement is 1 cell per key event, plus
  1 cell per tick while that direction was pressed in the last 150 ms.
- Props: `{ claudeEvents: { n: number; kind: SpawnKind }[] }`, a running list
  capped at the last 20. The module remembers the last `n` it applied and
  calls `spawn` for each newer entry. On mount it starts from the newest `n` already in the
  list, so reopening the pane doesn't replay old events.
- Draws a header `Text` (score · lives · wave · "p pause") and the board as
  one `Text` per row from `cells(game)`, coloring invaders, ship, shots and
  bombs.
- If the region is under 30 columns or 12 rows, it draws "widen the pane to
  play" instead and pauses.

### `hooks/register.tsx` additions

- `session.start`: also registers `invaders` ("Play Space Invaders; Claude's
  tool calls join the game").
- `command.run` for `invaders`: `$.ui.open({ id: 'invaders', title:
  'Invaders', focus: true, closeOnEscape: true })`, answers `{ text: 'Invaders
  opened. ←/→ move, space fires, Esc closes.' }`.
- `ui.render` for `{ component: 'Pane', requestId: 'invaders' }`: on
  terminal/desktop it draws `<Client key="game" module="./invaders-client.tsx"
  props={{ claudeEvents }} flexGrow={1} />`, otherwise the one-line notice.
- The existing `tool.call` hook also appends to the `invaders` state value
  (always; it's capped at 20 entries, and a closed pane has no `Client` to read
  it, so the hook doesn't need to track whether the pane is open):
  - Edit / Write → `invader`
  - Bash → `tough`
  - Read → `rapid`
  - other tools → nothing

  It appends after `next(e)`, so a denied call adds nothing.

### State contract (`types/index.d.ts`)

```ts
'puppet-coder': {
  desk: Shaped<Desk>
  invaders: { n: number; kind: SpawnKind }[]
}
```

`n` only ever goes up within a session. Writes use `update` so two calls in
one frame both land.

## Data flow

```
key ──► Client.onKey ──► input flags ──► every(50) ──► step() ──► setState ──► redraw
tool.call ──► update($.state invaders) ──► Pane ui.render ──► Client props ──► spawn()
```

Game state never goes through `$`, so a hook reload does not reset a game in
progress (the `Client` keeps its key).

## Risks and fallbacks

1. **Focus (unproven).** The docs say a `Client` gets keys "while a click has
   given it the focus". It's not confirmed whether a pane opened with
   `focus: true` gives the `Client` the keys with no click. The first plan
   task is a throwaway probe that shows the last key pressed. If a click turns
   out to be needed, the board shows "click to play" until the first key
   arrives.
2. **Esc closes the pane.** That's acceptable: closing ends the game. Pause
   is `p`.
3. **Render-loop guard.** The engine unmounts a `Client` that calls `setState`
   on three renders in a row with no tick or key in between. Only the `every`
   tick and `onKey` call `setState`; render never does.
4. **Frame budget.** A call may take at most ~1 s. A 50 ms tick with a board
   of ~40×16 cells is far under that.

## Testing

- `tests/arcade.test.ts` (unit tests, pure):
  - moving the ship stops at the walls
  - a shot hits and removes an invader and adds score
  - a bomb on the ship costs a life
  - clearing the grid starts wave 2 at a faster march
  - invaders reaching the bottom ends the game
  - `spawn` fills the top-row edge slot, and is ignored when that row is full
  - `tough` takes 2 hits
  - `rapid` allows 3 shots and expires after 200 ticks
- `tests/invaders.test.tsx` (`claude plugin test`), looped over
  `['terminal', 'desktop']`:
  - running `/invaders` opens the pane
  - mounting the pane, sending `right` and space to the `Client` by key, then
    advancing the mocked clock changes the board
  - an Edit `tool.call` while the pane is mounted makes the invader count go up
    on the next frame
- Manual: run `/invaders` in this session with the mod loaded.
