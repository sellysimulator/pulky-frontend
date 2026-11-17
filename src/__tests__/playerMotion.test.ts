/** Section 32 - player motion (plan 32 sections 3.8 and 4). Failure modes 5 to 9. */
import { describe, expect, it, vi } from 'vitest'
import {
  LOOK_SENSITIVITY,
  MAX_STEP_SECONDS,
  MOVE_SPEED,
  PITCH_LIMITS,
  TURN_SPEED,
  applyLook,
  createChangeReporter,
  createMotionState,
  heldMoves,
  isHeld,
  isTypingTarget,
  keyAction,
  moveKeyFor,
  nearestStation,
  releaseAll,
  stationPanel,
  stepMotion,
  stepPosition,
  stepYaw,
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
    expect(TURN_SPEED).toBe(1.7)
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

  it('starts with an empty pad set of its own, apart from the keyboard set', () => {
    const a = createMotionState()
    expect(a.pad.size).toBe(0)
    expect(a.pad).not.toBe(a.keys)
    a.pad.add('turnLeft')
    expect(createMotionState().pad.size).toBe(0)
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
    ['KeyZ', null],
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

describe('turning (the on-screen pad)', () => {
  it('turnLeft raises the yaw at TURN_SPEED, turnRight lowers it', () => {
    expect(stepYaw(0, keys('turnLeft'), 0.1)).toBeCloseTo(0.17, 9)
    expect(stepYaw(1, keys('turnRight'), 0.05)).toBeCloseTo(1 - 0.085, 9)
  })
  it('turns left the same way a leftward drag does', () => {
    expect(Math.sign(stepYaw(0, keys('turnLeft'), 0.1))).toBe(Math.sign(applyLook({ yaw: 0, pitch: 0 }, -10, 0).yaw))
  })
  it('cancels opposite turns, ignores walking keys and caps a long frame at 0.1 s', () => {
    expect(stepYaw(0.3, keys('turnLeft', 'turnRight'), 0.1)).toBe(0.3)
    expect(stepYaw(0.3, keys('forward', 'left', 'right', 'back'), 0.1)).toBe(0.3)
    expect(stepYaw(0, keys('turnLeft'), 3)).toBeCloseTo(TURN_SPEED * MAX_STEP_SECONDS, 9)
  })
  it('turning alone does not move the player', () => {
    const got = stepPosition(START, keys('turnLeft'), 0, 0.1)
    expect(got).toEqual(START)
  })
})

describe('stepMotion (keyboard and pad merged)', () => {
  const at = (over: Partial<{ keys: Set<MoveKey>; pad: Set<MoveKey>; yaw: number }>) => ({
    keys: keys(),
    pad: keys(),
    x: START.x,
    z: START.z,
    yaw: 0,
    ...over,
  })

  it('walks from the pad as from the keyboard', () => {
    expect(stepMotion(at({ pad: keys('forward') }), 0.1)).toEqual(stepMotion(at({ keys: keys('forward') }), 0.1))
    const got = stepMotion(at({ pad: keys('forward') }), 0.1)
    expect(got.x).toBeCloseTo(0, 6)
    expect(got.z).toBeCloseTo(13.5, 6)
    expect(got.yaw).toBe(0)
  })
  it('merges the two sets: a key on one and a strafe on the other walk a capped diagonal', () => {
    const got = stepMotion(at({ keys: keys('forward'), pad: keys('right') }), 0.1)
    expect(got.x).toBeCloseTo(0.353553, 6)
    expect(got.z).toBeCloseTo(13.646447, 6)
  })
  it('the same move held on both counts once', () => {
    const got = stepMotion(at({ keys: keys('forward'), pad: keys('forward') }), 0.1)
    expect(got.z).toBeCloseTo(13.5, 6)
  })
  it('turns first, then walks along the new yaw', () => {
    const got = stepMotion(at({ pad: keys('turnLeft', 'forward') }), 0.1)
    expect(got.yaw).toBeCloseTo(0.17, 9)
    expect(got.x).toBeCloseTo(-0.5 * Math.sin(0.17), 6)
    expect(got.z).toBeCloseTo(14 - 0.5 * Math.cos(0.17), 6)
  })
  it('keeps the bounds', () => {
    expect(stepMotion({ ...at({ pad: keys('right') }), x: 9.4, z: 0 }, 0.1).x).toBe(MOVEMENT_BOUNDS.maxX)
  })
  it('heldMoves is the union and leaves both sets alone', () => {
    const state = at({ keys: keys('forward'), pad: keys('turnRight') })
    expect([...heldMoves(state)].sort()).toEqual(['forward', 'turnRight'])
    expect([...state.keys]).toEqual(['forward'])
    expect([...state.pad]).toEqual(['turnRight'])
  })
  it('isHeld is true while either set holds a move', () => {
    expect(isHeld(at({}))).toBe(false)
    expect(isHeld(at({ keys: keys('back') }))).toBe(true)
    expect(isHeld(at({ pad: keys('turnLeft') }))).toBe(true)
  })
  it('releaseAll clears both sets', () => {
    const state = at({ keys: keys('forward', 'left'), pad: keys('turnLeft', 'back') })
    releaseAll(state)
    expect(state.keys.size).toBe(0)
    expect(state.pad.size).toBe(0)
    expect(isHeld(state)).toBe(false)
  })
})

describe('stationPanel (E and the interact button)', () => {
  it('maps each station to its panel, and no station to null', () => {
    expect(stationPanel('decision')).toBe('decision')
    expect(stationPanel('day-stats')).toBe('day-stats')
    expect(stationPanel('market')).toBe('market')
    expect(stationPanel('cellar')).toBe('cellar')
    expect(stationPanel(null)).toBeNull()
  })
  it('is the panel E opens', () => {
    for (const near of ['decision', 'day-stats', 'market', 'cellar'] as const) {
      expect(keyAction(input({ code: 'KeyE', key: 'e' }), { panel: null, near })).toEqual({ type: 'open', panel: stationPanel(near) })
    }
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
