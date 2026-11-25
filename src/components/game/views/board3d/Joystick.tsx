import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { stickMoves, type MoveKey } from './playerMotion'

/** How far the knob travels, in px: its centre stops short of the base's edge. */
const TRAVEL = 34

interface JoystickProps {
  /** Presses or releases one move, as `MovePad` does. Called with `false` on every way a push can end. */
  onMove(key: MoveKey, pressed: boolean): void
  /** Where it sits. */
  className?: string
}

/**
 * The walk control on a phone: push the knob and the player walks that way, while another finger drags the scene to
 * look. One pointer at a time; up, cancel, lost capture and unmount all let go, so no move can stay held.
 */
export default function Joystick({ onMove, className = '' }: JoystickProps): ReactElement {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const pointer = useRef<number | null>(null)
  const held = useRef<readonly MoveKey[]>([])
  const move = useRef(onMove)
  useEffect(() => {
    move.current = onMove
  }, [onMove])

  const hold = (next: readonly MoveKey[]): void => {
    for (const key of held.current) if (!next.includes(key)) move.current(key, false)
    for (const key of next) if (!held.current.includes(key)) move.current(key, true)
    held.current = next
  }

  useEffect(
    () => () => {
      for (const key of held.current) move.current(key, false)
      held.current = []
    },
    [],
  )

  const push = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - (box.left + box.width / 2)
    const dy = event.clientY - (box.top + box.height / 2)
    const reach = Math.min(1, TRAVEL / Math.max(1, Math.hypot(dx, dy)))
    setKnob({ x: dx * reach, y: dy * reach })
    hold(stickMoves(dx, dy, box.width / 2))
  }

  const release = (event: PointerEvent<HTMLDivElement>): void => {
    if (pointer.current !== event.pointerId) return
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    hold([])
  }

  return (
    <div
      role="group"
      aria-label="Movement joystick"
      className={`pointer-events-auto absolute flex h-28 w-28 touch-none items-center justify-center rounded-full border border-border-control bg-card/40 select-none [-webkit-touch-callout:none] ${className}`}
      onPointerDown={(event) => {
        if (pointer.current !== null) return
        event.preventDefault()
        pointer.current = event.pointerId
        // jsdom has no pointer capture; the push still counts without it.
        event.currentTarget.setPointerCapture?.(event.pointerId)
        push(event)
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) push(event)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span
        aria-hidden="true"
        className="h-12 w-12 rounded-full border border-border-control bg-card shadow-card"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
