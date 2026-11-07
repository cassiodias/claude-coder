# /invaders: a playable Space Invaders in puppet-coder

Date: 2026-11-07
Status: approved, revision 2 (after the focus probe)

## Goal

Add a `/invaders` slash command to puppet-coder that opens a pane with a small,
playable Space Invaders. The person plays it with the keyboard. While Claude
works, Claude's tool calls drop extra invaders or a power-up into the game, so
a busy turn changes the game.

The existing auto-play band and pane (`/coder-demo` and the configured
commands) stay as they are.

## Why revision 2

The probe in plan Task 1 showed that a `Client` surface module's `onKey`
receives no keys in this terminal. It failed with a `focus: true` pane, after
a click, and under `CLAUDE_CODE_NO_FLICKER=1` fullscreen, although the kit
test proved the probe code itself works. `Button` hotkeys (one lowercase letter
each) in a pane opened with `focus: true` **do** work with no click. So the
game runs in the hooks module and takes its input from hotkey buttons.

## Scope

In:

- One grid of invaders: 3 rows × 6 columns. They march sideways and step down
  a row at each edge.
- The player's ship on the bottom row. It moves left and right and fires one
  shot at a time.
- Invaders fire back. The game starts with 3 lives. When the grid is cleared,
  the next wave starts faster. The game is over when lives reach 0 or the
  invaders reach the ship's row.
- A one-line header with score, lives and wave.
- Claude link: each `tool.call` the mod sees while a game is running adds to
  that game.
- Every surface. Buttons are drawn everywhere, so desktop, VS Code and mobile
  play by pressing or tapping the buttons.

Out (YAGNI): shields, bonus saucer, saved high score, sound, arrow keys,
mouse, `Client`.

## Controls

The buttons sit in one row under the board. Each one has a hotkey, which works
while the pane holds the keyboard (`focus: true`, so no click is needed).

| Hotkey | Button | Action |
| --- | --- | --- |
| a | `◀` | move ship 2 cells left |
| d | `▶` | move ship 2 cells right |
| f | `fire` | fire |
| p | `pause` / `resume` | toggle pause |
| r | `restart` | new game (drawn only on game over) |
| Esc | (engine) | closes the pane, which ends the game |

Arrow keys move the focus between buttons (engine behaviour). Holding a hotkey
repeats it if the terminal sends key repeats.

## Architecture

### `hooks/arcade.ts`: pure game logic

No UI, no engine imports. Deterministic given its inputs.

```ts
export type Input = { left: number; right: number; fire: boolean } // cells this tick
export type SpawnKind = 'invader' | 'tough' | 'rapid'
export function newGame(columns: number, rows: number, seed?: number): Game
export function step(game: Game, input: Input): Game   // one 100 ms tick
export function spawn(game: Game, kind: SpawnKind): Game
export function togglePause(game: Game): Game
export function cells(game: Game): string[]
```

- The march speed comes from `wave` and the number of invaders left. Fewer
  invaders and higher waves step more often.
- Bombs use a small seeded RNG kept in `Game`, so tests can repeat a game.
- `tough` invaders take 2 hits and are drawn differently.
- `rapid` allows 3 player shots on screen for 10 s (100 ticks).
- `spawn('invader' | 'tough')` puts the new invader in the top-row slot
  closest to the formation's edge. If the top row is full it does nothing.

### `hooks/invaders-game.ts`: the running game (hooks side)

Module-level state: the current `Game | undefined`, the pending `Input`, and
the clock `Timer`.

- `startGame($)` creates `newGame(36, 14)` and starts
  `$.clock.every(100, …)`. Each tick calls `step` with the pending input,
  clears it, and calls `$.ui.invalidate('ui.render')`. The game keeps the
  last result.
- `press(kind)` adds to the pending input: `left`/`right` add 2 (capped at 2
  per tick), `fire` sets fire. `pause` calls `togglePause`, and `restart`
  calls `newGame` (only when `over`).
- `feed(kind: SpawnKind)` calls `spawn` on the running game. It does nothing
  when there's no game or the game isn't `playing`.
- `stopGame()` cancels the timer and drops the game.
- Read access: `current()` returns the game for drawing.

A mod reload (development only) loses the module state, so the open pane shows
"press r to start" and `r` starts a fresh game.

### `hooks/invaders-pane.tsx`: drawing

`InvadersPane({ ui, game, columns })` returns:

- the header `score <n> · lives <n> · wave <n>`, or
  `game over · score <n>` on game over, plus `paused` while paused
- one `Text` per row of `cells(game)`
- the button row: `◀` (a), `▶` (d), `fire` (f), `pause`/`resume` (p), and
  `restart` (r) only on game over

Each button's `onPress` calls `press(...)`. With no game it draws
`press r to start` and only the `restart` button. If `columns < 38` it draws
`widen the pane to play` instead of the board.

### `hooks/register.tsx` additions

- `session.start`: also registers `invaders` ("Play Space Invaders; Claude's
  tool calls join the game").
- `command.run` for `invaders`: `startGame($)`, then `$.ui.open({ id:
  'invaders', title: 'Invaders', focus: true, closeOnEscape: true, rows: 20
  })`. It answers `{ text: 'Invaders opened. a/d move, f fires, p pauses, Esc
  closes.' }`.
- `ui.render` for `{ component: 'Pane', requestId: 'invaders' }`: draws
  `InvadersPane` with `e.props.bodyColumns`.
- `ui.close` for `{ id: 'invaders' }`: `stopGame()`, then `next(e)`.
- The existing `tool.call` hook, after `await next(e)`, calls `feed(kind)`
  unless the result is an error. Edit / Write → `invader`, Bash → `tough`,
  Read → `rapid`, other tools → nothing. The puppet's own `type(...)` call
  stays as it is.

No `$.state` value and no contract change: the game lives in the hooks
module, so tool calls feed it directly.

## Risks

1. **Render cost.** The pane redraws 10 times a second through `ui.render`.
   The existing band already runs a 10 fps invalidate loop.
2. **Reload loses the game.** This only happens during development, and the
   pane recovers with `r`.
3. **Esc closes the pane.** Closing ends the game; `p` pauses.

## Testing

- `tests/arcade.test.ts` (unit tests, pure):
  - the ship stops at the walls
  - a shot hits and removes an invader and adds score
  - fire is ignored while the shot limit is on screen
  - a bomb on the ship costs a life
  - clearing the grid starts wave 2 at a faster march
  - invaders reaching the bottom end the game
  - `spawn` fills the top-row edge slot, and is ignored when the top row is
    full
  - `tough` takes 2 hits
  - `rapid` allows 3 shots and expires after 100 ticks
  - the same seed gives the same game
- `tests/invaders.test.tsx` (`claude plugin test`, looped over
  `['terminal', 'desktop', 'mobile']`):
  - `/invaders` opens a focused pane
  - pressing `▶` then a tick moves the ship
  - `fire` then a tick shows a shot
  - `pause` freezes the board
  - an Edit tool call during a game adds an invader
  - closing the pane stops the clock
  - a narrow pane shows `widen the pane to play`
- Manual: play `/invaders` in this session.
