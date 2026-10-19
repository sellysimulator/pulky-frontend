/** Section 32 - player motion (plan 32 sections 3.8 and 4). Failure modes 5 to 9. */
import { describe, expect, it, vi } from 'vitest'
import {
  LOOK_SENSITIVITY,
  MAX_STEP_SECONDS,
  MOVE_SPEED,
  PITCH_LIMITS,
  applyLook,
  createChangeReporter,
  createMotionState,
  isTypingTarget,
  keyAction,
  moveKeyFor,
  nearestStation,
  stepPosition,
  type KeyInput,
  type MoveKey,
} from '../components/game/views/board3d/playerMotion'
import { MOVEMENT_BOUNDS, SPAWN } from '../components/game/views/board3d/sceneLayout'
import { buildSceneModel, type SceneStation } from '../components/game/views/board3d/sceneModel'
import { baseProps } from './fixtures/sceneProps'

const stations = buildSceneModel(baseProps()).stations
const keys = (...k: MoveKey[]) => new Set<MoveKey>(k)
const START = { x: 0, z: 14 }

function input(over: Partial<KeyInput> = {}): KeyInput {
  return { code: 'KeyW', key: 'w', ctrlKey: false, metaKey: false, altKey: false, repeat: false, typing: false, ...over }
}

describe('constants', () => {
  it('quotes the frozen values', () => {
    expect(MOVE_SPEED).toBe(5)
    expect(MAX_STEP_SECONDS).toBe(0.1)
    expect(LOOK_SENSITIVITY).toBe(0.0026)
    expect(PITCH_LIMITS).toEqual({ min: -Math.PI / 3, max: Math.PI / 3.2 })
  })
})

describe('createMotionState', () => {
  it('starts at the spawn with no keys held', () => {
    const state = createMotionState()
    expect(state.keys.size).toBe(0)
    expect(state).toMatchObject({ x: 0, z: 14, yaw: 0, pitch: -0.08 })
    expect([state.x, state.z, state.yaw, state.pitch]).toEqual([SPAWN.position[0], SPAWN.position[2], SPAWN.yaw, SPAWN.pitch])
  })

  it('gives every call its own key set', () => {
    const a = createMotionState()
    a.keys.add('forward')
    expect(createMotionState().keys.size).toBe(0)
  })
})

describe('moveKeyFor', () => {
  it.each([
    ['KeyW', 'forward'],
    ['ArrowUp', 'forward'],
    ['KeyS', 'back'],
    ['ArrowDown', 'back'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
    ['KeyQ', null],
    ['KeyE', null],
    ['Space', null],
  ])('%s -> %s', (code, expected) => {
    expect(moveKeyFor(code)).toBe(expected)
  })
})

describe('stepPosition (failure mode 7)', () => {
  const close = (got: { x: number; z: number }, x: number, z: number) => {
    expect(got.x).toBeCloseTo(x, 6)
    expect(got.z).toBeCloseTo(z, 6)
  }

  it('walks forward at MOVE_SPEED', () => close(stepPosition(START, keys('forward'), 0, 0.1), 0, 13.5))
  it('walks no faster on a diagonal', () => {
    const got = stepPosition(START, keys('forward', 'right'), 0, 0.1)
    close(got, 0.353553, 13.646447)
    expect(Math.hypot(got.x - START.x, got.z - START.z)).toBeCloseTo(0.5, 6)
  })
  it('follows the yaw: forward at a quarter turn goes west', () =>
    close(stepPosition(START, keys('forward'), Math.PI / 2, 0.1), -0.5, 14))
  it('backs away and strafes', () => {
    close(stepPosition(START, keys('back'), 0, 0.1), 0, 14.5)
    close(stepPosition(START, keys('left'), 0, 0.1), -0.5, 14)
    close(stepPosition(START, keys('right'), 0, 0.1), 0.5, 14)
  })
  it('cancels opposite keys', () => {
    close(stepPosition(START, keys('forward', 'back'), 0, 0.1), 0, 14)
    close(stepPosition(START, keys('left', 'right'), 0, 0.1), 0, 14)
  })
  it('stands still with nothing held', () => close(stepPosition(START, keys(), 0, 0.1), 0, 14))
  it('treats a long frame as 0.1 s', () => close(stepPosition(START, keys('forward'), 0, 2), 0, 13.5))
  it('clamps to the side wall bounds', () => close(stepPosition({ x: 9.4, z: 0 }, keys('right'), 0, 0.1), 9.5, 0))
  it('clamps to the south bound', () => close(stepPosition({ x: 0, z: 15.4 }, keys('back'), 0, 0.1), 0, 15.5))
  it('clamps to the other three bounds', () => {
    close(stepPosition({ x: -9.4, z: 0 }, keys('left'), 0, 0.1), MOVEMENT_BOUNDS.minX, 0)
    close(stepPosition({ x: 0, z: -15.4 }, keys('forward'), 0, 0.1), 0, MOVEMENT_BOUNDS.minZ)
    close(stepPosition({ x: 9.5, z: 0 }, keys('right'), 0, 5), MOVEMENT_BOUNDS.maxX, 0)
  })
  it('takes bounds as an argument', () => {
    close(stepPosition(START, keys('forward'), 0, 0.1, { minX: -1, maxX: 1, minZ: 13.9, maxZ: 20 } as never), 0, 13.9)
  })
})

describe('applyLook (failure mode 8)', () => {
  it('a positive dx lowers the yaw (turns right)', () => {
    const got = applyLook({ yaw: 0, pitch: 0 }, 100, 0)
    expect(got.yaw).toBeCloseTo(-0.26, 6)
    expect(got.pitch).toBe(0)
  })
  it('clamps the pitch upward', () =>
    expect(applyLook({ yaw: 0, pitch: 0 }, 0, -1000)).toEqual({ yaw: 0, pitch: Math.PI / 3.2 }))
  it('clamps the pitch downward', () =>
    expect(applyLook({ yaw: 0, pitch: 0 }, 0, 1000)).toEqual({ yaw: 0, pitch: -Math.PI / 3 }))
  it('scales a small drag by LOOK_SENSITIVITY', () => {
    const got = applyLook({ yaw: 1, pitch: 0.2 }, -10, 10)
    expect(got.yaw).toBeCloseTo(1 + 10 * LOOK_SENSITIVITY, 9)
    expect(got.pitch).toBeCloseTo(0.2 - 10 * LOOK_SENSITIVITY, 9)
  })
})

describe('nearestStation', () => {
  it('finds the decision counter from 1.5 m', () => expect(nearestStation({ x: 0, z: 12 }, stations)).toBe('decision'))
  it('finds nothing from the spawn (3.5 m)', () => expect(nearestStation({ x: 0, z: 14 }, stations)).toBeNull())
  it('finds the chalkboard', () => expect(nearestStation({ x: -8, z: 4 }, stations)).toBe('day-stats'))
  it('finds the market board and the cellar', () => {
    expect(nearestStation({ x: 9, z: 4 }, stations)).toBe('market')
    expect(nearestStation({ x: 0, z: 3 }, stations)).toBe('cellar')
  })
  it('finds nothing 3.75 m from both the counter and the tinacal', () =>
    expect(nearestStation({ x: 0, z: 6.75 }, stations)).toBeNull())
  it('takes a radius argument', () => {
    expect(nearestStation({ x: 0, z: 14 }, stations, 4)).toBe('decision')
    expect(nearestStation({ x: 0, z: 12 }, stations, 1)).toBeNull()
  })
  it('includes a station exactly at the radius', () => expect(nearestStation({ x: 0, z: 13.5 }, stations)).toBe('decision'))
  it('gives a tie to the earlier station in the list', () => {
    const twin = (id: SceneStation['id'], x: number): SceneStation => ({
      id,
      panel: 'cellar',
      title: id,
      standOff: [x, 0, 0],
    })
    const list = [twin('market', 1), twin('cellar', -1)]
    expect(nearestStation({ x: 0, z: 0 }, list)).toBe('market')
    expect(nearestStation({ x: 0, z: 0 }, [list[1], list[0]])).toBe('cellar')
  })
  it('is null for an empty list', () => expect(nearestStation({ x: 0, z: 0 }, [])).toBeNull())
})

describe('isTypingTarget (failure mode 5)', () => {
  const host = (html: string): HTMLElement => {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.appendChild(div)
    return div
  }

  it.each(['<input />', '<textarea></textarea>', '<select><option>a</option></select>'])('%s is typing', (html) => {
    expect(isTypingTarget(host(html).firstElementChild)).toBe(true)
  })
  it('an input of any type counts', () => expect(isTypingTarget(host('<input type="number" />').firstElementChild)).toBe(true))
  it('a child of a contenteditable element is typing', () => {
    const span = host('<div contenteditable="true"><span>x</span></div>').querySelector('span')
    expect(isTypingTarget(span)).toBe(true)
    expect(isTypingTarget(host('<div contenteditable=""><span>x</span></div>').querySelector('span'))).toBe(true)
  })
  it('a button is not typing', () => expect(isTypingTarget(host('<button>x</button>').firstElementChild)).toBe(false))
  it('a span inside a label that wraps an input is not typing', () => {
    expect(isTypingTarget(host('<label><span>x</span><input /></label>').querySelector('span'))).toBe(false)
  })
  it('window and null are not typing', () => {
    expect(isTypingTarget(window)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
  it('honours isContentEditable', () => {
    const el = host('<div><p>x</p></div>').querySelector('p') as HTMLElement
    Object.defineProperty(el, 'isContentEditable', { value: true })
    expect(isTypingTarget(el)).toBe(true)
  })
})

describe('keyAction (failure modes 5 and 6)', () => {
  const free = { panel: null, near: null } as const

  it('moves on a movement key', () => {
    expect(keyAction(input(), free)).toEqual({ type: 'move', key: 'forward' })
    expect(keyAction(input({ code: 'ArrowLeft', key: 'ArrowLeft' }), free)).toEqual({ type: 'move', key: 'left' })
  })
  it('opens the near station with E', () => {
    expect(keyAction(input({ code: 'KeyE', key: 'e' }), { panel: null, near: 'cellar' })).toEqual({ type: 'open', panel: 'cellar' })
    expect(keyAction(input({ code: 'KeyE', key: 'e' }), { panel: null, near: 'decision' })).toEqual({ type: 'open', panel: 'decision' })
  })
  it('does nothing on E when no station is near, or on a repeat', () => {
    expect(keyAction(input({ code: 'KeyE', key: 'e' }), free)).toBeNull()
    expect(keyAction(input({ code: 'KeyE', key: 'e', repeat: true }), { panel: null, near: 'cellar' })).toBeNull()
  })
  it('typing walks nobody and opens nothing', () => {
    expect(keyAction(input({ typing: true }), free)).toBeNull()
    expect(keyAction(input({ code: 'KeyE', key: 'e', typing: true }), { panel: null, near: 'cellar' })).toBeNull()
    expect(keyAction(input({ code: 'ArrowUp', key: 'ArrowUp', typing: true }), free)).toBeNull()
  })
  it('ignores Ctrl, Meta and Alt chords', () => {
    expect(keyAction(input({ ctrlKey: true }), free)).toBeNull()
    expect(keyAction(input({ code: 'KeyE', key: 'e', ctrlKey: true }), { panel: null, near: 'cellar' })).toBeNull()
    expect(keyAction(input({ metaKey: true }), free)).toBeNull()
    expect(keyAction(input({ code: 'KeyD', key: 'd', altKey: true }), free)).toBeNull()
  })
  it('ignores movement and E while a panel is open', () => {
    expect(keyAction(input(), { panel: 'decision', near: null })).toBeNull()
    expect(keyAction(input({ code: 'KeyE', key: 'e' }), { panel: 'decision', near: 'cellar' })).toBeNull()
  })
  it('Escape closes an open panel, even while typing', () => {
    expect(keyAction(input({ code: 'Escape', key: 'Escape', typing: true }), { panel: 'decision', near: null })).toEqual({ type: 'close' })
    expect(keyAction(input({ code: 'Escape', key: 'Escape' }), { panel: 'market', near: null })).toEqual({ type: 'close' })
  })
  it('Escape with no panel open does nothing', () => {
    expect(keyAction(input({ code: 'Escape', key: 'Escape' }), { panel: null, near: 'cellar' })).toBeNull()
  })
  it('an unrelated key does nothing', () => expect(keyAction(input({ code: 'KeyQ', key: 'q' }), free)).toBeNull())
})

describe('createChangeReporter (failure mode 9)', () => {
  it("calls onChange twice for 'cellar' x3 then null", () => {
    const onChange = vi.fn()
    const report = createChangeReporter<string | null>(onChange, null)
    report('cellar')
    report('cellar')
    report('cellar')
    report(null)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls).toEqual([['cellar'], [null]])
  })
  it('does not call for the initial value', () => {
    const onChange = vi.fn()
    const report = createChangeReporter<string | null>(onChange, null)
    report(null)
    expect(onChange).not.toHaveBeenCalled()
  })
})
