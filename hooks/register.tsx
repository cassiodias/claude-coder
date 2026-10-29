import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer, ToolCallInput } from 'claude-code'

import type { Desk, Display } from '../types'
import { Coder } from './components'
import { NO_DESK, sitDown, standUp, work } from './desk'
import type { Work } from './desk'

const PANE = 'puppet-coder'
const PANE_COLUMNS = 42
const DONE_MS = 8000

const desk = atom({ plugin: 'puppet-coder', key: 'desk' } as const, NO_DESK, { shape: 'desk-2' })

let tick = 0
let timer: Timer | undefined
let shotAt = -100
let demo: Timer[] = []

const DEMO: Work[] = ['read', 'read', 'edit', 'run', 'other', 'edit', 'run', 'edit', 'read', 'edit', 'run', 'run']

// Ten frames a second while the coder works; one clock however many sessions start.
function startClock($: EngineInterface) {
  timer ??= $.clock.every(100, () => {
    tick++
    $.ui.invalidate('ui.render')
  })
}

function stopClock() {
  timer?.cancel()
  timer = undefined
}

async function sit($: EngineInterface, opened: Desk) {
  await update($, desk, () => opened)
  if (opened.display === 'pane') void $.ui.open({ id: PANE, title: 'Coder', columns: PANE_COLUMNS })
  else void $.ui.close({ id: PANE })
  startClock($)
}

async function type($: EngineInterface, kind: Work) {
  if (!(await read($, desk)).isLive) return

  shotAt = tick
  await update($, desk, d => work(d, kind))
}

// The command is done: the coder stops typing, and the desk clears a little later.
async function leave($: EngineInterface) {
  if (!(await read($, desk)).isLive) return

  const after = await update($, desk, standUp)
  stopClock()
  $.ui.invalidate('ui.render')
  $.clock.after(DONE_MS, () => {
    if (after.display === 'pane') void $.ui.close({ id: PANE })
    else void update($, desk, () => NO_DESK)
  })
}

async function draw($: EngineInterface, ui: Parameters<typeof Coder>[0]['ui']) {
  const now = await read($, desk)

  return <Coder ui={ui} desk={now} tick={tick} sinceShot={tick - shotAt} />
}

function kindOf(e: ToolCallInput): Work {
  if (e.tool === 'Edit' || e.tool === 'Write') return 'edit'
  if (e.tool === 'Bash') return 'run'
  if (e.tool === 'Read') return 'read'

  return 'other'
}

// A listed command starts when the person types it or Claude calls it through the Skill tool.
async function begin($: EngineInterface, commands: Set<string>, name: string, display: Display) {
  if (commands.has(name) && !(await read($, desk)).isLive) await sit($, sitDown(name, display))
}

export const register: Register = (on, options) => {
  const commands = new Set(
    String(options.commands ?? '')
      .split(/[\s,]+/)
      .map(name => name.replace(/^\//, ''))
      .filter(Boolean),
  )
  const display: Display = options.display === 'pane' ? 'pane' : 'band'

  on('session.start', async ($, e, next) => {
    if ((await read($, desk)).isLive) startClock($)
    await $.command.register({
      name: 'coder-demo',
      description: 'Watch the coder work for 20 seconds; add pane or band to try one display',
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command) await begin($, commands, e.command.name, display)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Skill') {
      await begin($, commands, e.skill, display)

      return next(e)
    }
    await type($, kindOf(e))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) await leave($)

    return next(e)
  })

  on('command.run', { command: 'coder-demo' }, async ($, e) => {
    const shown: Display = /band/i.test(e.args) ? 'band' : /pane/i.test(e.args) ? 'pane' : display
    // A new demo cancels the last one's timers so they cannot end this session early.
    demo.forEach(one => one.cancel())
    await sit($, sitDown('coder-demo', shown))
    demo = [
      ...DEMO.map((kind, i) => $.clock.after(1000 + i * 1500, () => void type($, kind))),
      $.clock.after(20000, () => void leave($)),
    ]

    return { text: `The coder sat down in the ${shown}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => draw($, $.ui.resolve(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, desk)
    if (now.display !== 'band' || !now.command || e.props.hasSurvey) return next(e)

    return draw($, $.ui.resolve(e))
  })
}
