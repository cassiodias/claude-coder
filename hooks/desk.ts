import type { Desk, Display } from '../types'

// The coder's session as plain functions over its data: what it counts while the command works.

export type Work = 'edit' | 'run' | 'read' | 'other'

export const NO_DESK: Desk = { command: '', edits: 0, runs: 0, reads: 0, score: 0, isLive: false, display: 'band' }

export function sitDown(command: string, display: Display): Desk {
  return { ...NO_DESK, command, isLive: true, display }
}

export function work(desk: Desk, kind: Work): Desk {
  return {
    ...desk,
    edits: desk.edits + (kind === 'edit' ? 1 : 0),
    runs: desk.runs + (kind === 'run' ? 1 : 0),
    reads: desk.reads + (kind === 'read' ? 1 : 0),
    score: desk.score + 1,
  }
}

export function standUp(desk: Desk): Desk {
  return { ...desk, isLive: false }
}
