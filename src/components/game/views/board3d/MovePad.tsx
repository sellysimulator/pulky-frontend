import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, RotateCw, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactElement } from 'react'
import Button from '../../../shared/Button'
import type { MoveKey } from './playerMotion'

interface MovePadProps {
  /** `true` while the button is held, `false` when it lets go. */
  onMove(key: MoveKey, pressed: boolean): void
}

const PAD_BUTTONS: readonly { key: MoveKey; label: string; icon: LucideIcon }[] = [
  { key: 'turnLeft', label: 'Turn left', icon: RotateCcw },
  { key: 'forward', label: 'Move forward', icon: ArrowUp },
  { key: 'turnRight', label: 'Turn right', icon: RotateCw },
  { key: 'left', label: 'Move left', icon: ArrowLeft },
  { key: 'back', label: 'Move backward', icon: ArrowDown },
  { key: 'right', label: 'Move right', icon: ArrowRight },
]

/**
 * The on-screen movement pad for touch screens: a button holds its move from pointer down until the pointer lets go,
 * is cancelled or loses capture, or the button loses focus. Space and Enter hold it from the keyboard.
 */
export default function MovePad({ onMove }: MovePadProps): ReactElement {
  // A pad that goes away (a panel opens, the touch screen is unplugged) lets go of everything it held.
  useEffect(
    () => () => {
      for (const { key } of PAD_BUTTONS) onMove(key, false)
    },
    [onMove],
  )

  return (
    <div role="group" aria-label="Movement controls" className="pointer-events-auto grid shrink-0 grid-cols-3 gap-1.5">
      {PAD_BUTTONS.map(({ key, label, icon }) => {
        const release = (): void => onMove(key, false)
        return (
          <Button
            key={key}
            variant="secondary"
            size="md"
            icon={icon}
            aria-label={label}
            title={label}
            className="w-11 touch-none px-0! shadow-card select-none [-webkit-touch-callout:none]"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              onMove(key, true)
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onBlur={release}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if (event.key !== ' ' && event.key !== 'Enter') return
              event.preventDefault()
              onMove(key, true)
            }}
            onKeyUp={release}
          />
        )
      })}
    </div>
  )
}
