import {
  INTERACT_DISTANCE,
  MOVEMENT_BOUNDS,
  SPAWN,
  STATION_PANEL,
  type PanelId,
  type StationId,
} from './sceneLayout'
import type { SceneStation } from './sceneModel'

/** `left` and `right` strafe; `turnLeft` and `turnRight` turn in place (only the on-screen pad holds those). */
export type MoveKey = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight'

/**
 * `keys` is what the keyboard holds and `pad` what the on-screen movement pad holds. They are separate sets, so a key
 * released on one never lets go of the same move held on the other; every step reads them merged.
 */
export interface MotionState {
  keys: Set<MoveKey>
  pad: Set<MoveKey>
  x: number
  z: number
  yaw: number
  pitch: number
}

export type KeyAction = { type: 'move'; key: MoveKey } | { type: 'open'; panel: PanelId } | { type: 'close' }

export interface KeyInput {
  code: string
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  repeat: boolean
  typing: boolean
}

export const MOVE_SPEED = 5
export const MAX_STEP_SECONDS = 0.1
export const LOOK_SENSITIVITY = 0.0026
export const PITCH_LIMITS = { min: -Math.PI / 3, max: Math.PI / 3.2 } as const
/** Radians per second while a turn button is held. */
export const TURN_SPEED = 1.7

const MOVE_KEYS: Record<string, MoveKey> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const TYPING_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

export function createMotionState(): MotionState {
  return { keys: new Set<MoveKey>(), pad: new Set<MoveKey>(), x: SPAWN.position[0], z: SPAWN.position[2], yaw: SPAWN.yaw, pitch: SPAWN.pitch }
}

export function moveKeyFor(code: string): MoveKey | null {
  return MOVE_KEYS[code] ?? null
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(TYPING_SELECTOR) !== null || (target as HTMLElement).isContentEditable === true
}

export function keyAction(input: KeyInput, state: { panel: PanelId | null; near: StationId | null }): KeyAction | null {
  if (input.key === 'Escape') return state.panel !== null ? { type: 'close' } : null
  if (input.ctrlKey || input.metaKey || input.altKey) return null
  if (state.panel !== null) return null
  if (input.typing) return null
  const move = moveKeyFor(input.code)
  if (move !== null) return { type: 'move', key: move }
  const panel = stationPanel(state.near)
  if (input.code === 'KeyE' && !input.repeat && panel !== null) return { type: 'open', panel }
  return null
}

/** The panel a station opens: one definition for the E key and the on-screen interact button. */
export function stationPanel(near: StationId | null): PanelId | null {
  return near === null ? null : STATION_PANEL[near]
}

/** Whether either input holds a move. */
export function isHeld(state: Pick<MotionState, 'keys' | 'pad'>): boolean {
  return state.keys.size > 0 || state.pad.size > 0
}

/** The keyboard's and the pad's moves as one set. */
export function heldMoves(state: Pick<MotionState, 'keys' | 'pad'>): Set<MoveKey> {
  return new Set<MoveKey>([...state.keys, ...state.pad])
}

/** Lets go of everything both inputs hold: on blur, on a hidden tab and when a panel opens. */
export function releaseAll(state: Pick<MotionState, 'keys' | 'pad'>): void {
  state.keys.clear()
  state.pad.clear()
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** Yaw 0 faces north (-z): forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw). */
export function stepPosition(
  pos: { x: number; z: number },
  keys: ReadonlySet<MoveKey>,
  yaw: number,
  delta: number,
  bounds: typeof MOVEMENT_BOUNDS = MOVEMENT_BOUNDS,
): { x: number; z: number } {
  const forward = (keys.has('forward') ? 1 : 0) - (keys.has('back') ? 1 : 0)
  const right = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
  let dx = forward * -Math.sin(yaw) + right * Math.cos(yaw)
  let dz = forward * -Math.cos(yaw) + right * -Math.sin(yaw)
  const length = Math.hypot(dx, dz)
  if (length === 0) return { x: clamp(pos.x, bounds.minX, bounds.maxX), z: clamp(pos.z, bounds.minZ, bounds.maxZ) }
  const step = MOVE_SPEED * Math.min(delta, MAX_STEP_SECONDS)
  dx = (dx / length) * step
  dz = (dz / length) * step
  return { x: clamp(pos.x + dx, bounds.minX, bounds.maxX), z: clamp(pos.z + dz, bounds.minZ, bounds.maxZ) }
}

/** A held turn changes the yaw at TURN_SPEED; left raises it (yaw 0 faces north, a quarter turn left faces west). */
export function stepYaw(yaw: number, keys: ReadonlySet<MoveKey>, delta: number): number {
  const turn = (keys.has('turnLeft') ? 1 : 0) - (keys.has('turnRight') ? 1 : 0)
  return yaw + turn * TURN_SPEED * Math.min(delta, MAX_STEP_SECONDS)
}

/** One frame of motion from both inputs: turn first, then walk along the new yaw. */
export function stepMotion(
  state: Pick<MotionState, 'keys' | 'pad' | 'x' | 'z' | 'yaw'>,
  delta: number,
  bounds: typeof MOVEMENT_BOUNDS = MOVEMENT_BOUNDS,
): { x: number; z: number; yaw: number } {
  const held = heldMoves(state)
  const yaw = stepYaw(state.yaw, held, delta)
  return { ...stepPosition(state, held, yaw, delta, bounds), yaw }
}

export function applyLook(view: { yaw: number; pitch: number }, dx: number, dy: number): { yaw: number; pitch: number } {
  return {
    yaw: view.yaw - dx * LOOK_SENSITIVITY,
    pitch: clamp(view.pitch - dy * LOOK_SENSITIVITY, PITCH_LIMITS.min, PITCH_LIMITS.max),
  }
}

export function nearestStation(
  pos: { x: number; z: number },
  stations: readonly SceneStation[],
  radius: number = INTERACT_DISTANCE,
): StationId | null {
  let best: StationId | null = null
  let bestDistance = Infinity
  for (const station of stations) {
    const distance = Math.hypot(station.standOff[0] - pos.x, station.standOff[2] - pos.z)
    if (distance <= radius && distance < bestDistance) {
      best = station.id
      bestDistance = distance
    }
  }
  return best
}

/** Calls `onChange` only when the value differs from the last one seen, so a frame loop can report freely. */
export function createChangeReporter<T>(onChange: (value: T) => void, initial: T): (value: T) => void {
  let last = initial
  return (value) => {
    if (value === last) return
    last = value
    onChange(value)
  }
}
