export type Display = 'pane' | 'band'
export type Desk = {
  command: string
  edits: number
  runs: number
  reads: number
  score: number
  isLive: boolean
  display: Display
}

declare module 'claude-code' {
  interface PluginState {
    'puppet-coder': { desk: Shaped<Desk> }
  }
}
