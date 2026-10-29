import { expect, mock, test } from 'claude-code/testing'

import { NO_DESK, sitDown, standUp, work } from '../hooks/desk'
import { invaderRows } from '../hooks/invaders'

test('work is counted by kind and every tool call scores', async () => {
  const desk = work(work(work(work(sitDown('dev', 'band'), 'edit'), 'run'), 'read'), 'other')
  expect([desk.edits, desk.runs, desk.reads, desk.score]).toEqual([1, 1, 1, 4])
  expect(standUp(desk).isLive).toBe(false)
  expect(NO_DESK.command).toBe('')
})

test('a listed command seats the coder above the prompt and its tool calls show', { options: { commands: 'dev' } }, async ($, on) => {
  on('ui.close', () => ({ value: undefined }))
  on('tool.call', () => ({ result: {} }))
  mock.clock(on)

  await $.tool.call({ tool: 'Skill', skill: 'dev' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'puppet-coder',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: true, maxRows: 9, bodyColumns: 60, scroll: { offset: 0, bodyRows: 9 } },
    } as never)
    expect((await ui.find({ type: 'Text', text: /^dev · 0 edits · 1 runs · 0 reads$/ }))?.text).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /00001/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('each shot takes one invader down and a cleared wave comes back', async () => {
  const invaders = (score: number) =>
    invaderRows(0, score, 99, true)[0]!.filter(cell => cell.kind === 'invader').length / 2
  expect([0, 1, 2, 4, 5, 6].map(invaders)).toEqual([5, 4, 3, 1, 5, 4])
  expect(invaderRows(0, 1, 2, true)[0]!.some(cell => cell.kind === 'boom')).toBe(true)
})
