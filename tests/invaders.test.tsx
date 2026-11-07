import { expect, mock, test } from 'claude-code/testing'
import type { Mounted, TestBody } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop', 'mobile'] as const

const pane = (surface: (typeof SURFACES)[number], bodyColumns = 40) =>
  ({
    plugin: 'puppet-coder',
    surface,
    component: 'Pane',
    requestId: 'invaders',
    props: { title: 'Invaders', isFocused: true, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as never

// Stands in for the engine beneath the plugin, and hands back what `ui.open` was asked.
function engine(on: Parameters<TestBody>[1]) {
  const opened: unknown[] = []
  on('command.register', () => ({ value: { command: 'x' } }) as never)
  on('ui.open', (_$, e) => (opened.push(e), { value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: {} }) as never)
  const clock = mock.clock(on)

  return { opened, clock }
}

type Ui = Mounted
type Engine = Parameters<TestBody>[0]

const play = ($: Engine) => $.command.run({ command: 'invaders', args: '' } as never)

const rowWith = async (ui: Ui, glyph: RegExp) => (await ui.find({ type: 'Text', text: glyph }))?.text ?? ''
const boardText = async (ui: Ui) => (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')

test('/invaders opens a focused pane', async ($, on) => {
  const { opened } = engine(on)
  const ran = await play($)
  expect(opened[0]).toMatchObject({ id: 'invaders', focus: true, closeOnEscape: true })
  expect(ran.text).toBe('Invaders opened. a/d move, f fires, p pauses, Esc closes.')
})

for (const surface of SURFACES) {
  test(`right moves the ship (${surface})`, async ($, on) => {
    const { clock } = engine(on)
    await play($)
    const ui = await $.ui.mount(pane(surface))
    const before = (await rowWith(ui, /▟▙/)).indexOf('▟')
    await ui.press({ key: 'right' })
    await clock.advance(100)
    expect((await rowWith(ui, /▟▙/)).indexOf('▟')).toBe(before + 2)
    await ui.unmount()
  })

  test(`presses within one tick move at most 2 cells (${surface})`, async ($, on) => {
    const { clock } = engine(on)
    await play($)
    const ui = await $.ui.mount(pane(surface))
    const before = (await rowWith(ui, /▟▙/)).indexOf('▟')
    for (let i = 0; i < 5; i++) await ui.press({ key: 'right' })
    await clock.advance(100)
    expect((await rowWith(ui, /▟▙/)).indexOf('▟')).toBe(before + 2)
    await ui.unmount()
  })

  test(`fire shows a shot (${surface})`, async ($, on) => {
    const { clock } = engine(on)
    await play($)
    const ui = await $.ui.mount(pane(surface))
    await ui.press({ key: 'fire' })
    await clock.advance(100)
    expect(await rowWith(ui, /╻/)).toContain('╻')
    await ui.unmount()
  })

  test(`pause freezes the board (${surface})`, async ($, on) => {
    const { clock } = engine(on)
    await play($)
    const ui = await $.ui.mount(pane(surface))
    await ui.press({ key: 'pause' })
    expect(await rowWith(ui, /paused/)).toContain('paused')
    expect((await ui.find({ type: 'Button', key: 'pause' }))?.text).toContain('resume')
    const frozen = await boardText(ui)
    await clock.advance(1000)
    expect(await boardText(ui)).toBe(frozen)
    await ui.unmount()
  })

  test(`a narrow pane asks to widen (${surface})`, async ($, on) => {
    engine(on)
    await play($)
    const ui = await $.ui.mount(pane(surface, 30))
    expect(await rowWith(ui, /widen/)).toBe('widen the pane to play')
    await ui.unmount()
  })
}

test('a Bash call during a game adds a tough invader', async ($, on) => {
  const { clock } = engine(on)
  await play($)
  const ui = await $.ui.mount(pane('terminal'))
  // The top row starts full, so keep firing until a column clears and the call can land.
  for (let i = 0; i < 400 && !(await rowWith(ui, /█/)); i++) {
    await ui.press({ key: 'fire' })
    await clock.advance(100)
    await $.tool.call({ tool: 'Bash', command: 'true' })
    await clock.advance(100)
  }
  expect(await rowWith(ui, /█/)).toContain('█▙')
  await ui.unmount()
})

test('a tool call with no game changes nothing', async ($, on) => {
  engine(on)
  await $.tool.call({ tool: 'Edit', file_path: '/x', old_string: 'a', new_string: 'b' })
  const ui = await $.ui.mount(pane('terminal'))
  expect(await rowWith(ui, /press r/)).toBe('press r to start')
  await ui.unmount()
})
