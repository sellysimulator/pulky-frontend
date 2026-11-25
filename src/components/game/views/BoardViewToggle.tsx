import type { ReactElement } from 'react'
import InfoTip from '../../shared/InfoTip'
import { usePhoneViewport } from './board3d/phoneViewport'
import type { BoardView, BoardViewSupport } from './boardView'

interface BoardViewToggleProps {
  value: BoardView
  support: BoardViewSupport
  onChange(view: BoardView): void
}

const VIEWS: readonly BoardView[] = ['2D', '3D']

const TO_2D = 'Switch to the 2D board'

/**
 * Board view: 2D | 3D. Where 3D is unavailable it stays on screen, disabled, with the reason beside it (design.md §14.4).
 *
 * On a phone's 3D board it is one round **2D** button, left of the "?" (`PhoneHud`), the only thing of the header that
 * stays. It is fixed, so it stands over the scene, and drawn only over one: while the room is joined there is no scene
 * yet and the header is still there. On its side it steps aside while a panel fills the screen's height
 * (`data-phone-panel`, set by `ScenePanels`).
 */
export default function BoardViewToggle({ value, support, onChange }: BoardViewToggleProps): ReactElement {
  const phone = usePhoneViewport()

  if (phone && value === '3D' && support.ok) {
    return (
      <button
        type="button"
        onClick={() => onChange('2D')}
        aria-label={TO_2D}
        title={TO_2D}
        className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[calc(max(0.75rem,env(safe-area-inset-right))_+_3.25rem)] z-50 hidden h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-border-control bg-card text-sm font-semibold text-ink shadow-card phone-scene:flex landscape:right-[calc(max(0.75rem,env(safe-area-inset-right))_+_6.5rem)] landscape:[body:has([data-phone-panel])_&]:hidden"
      >
        2D
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        role="group"
        aria-label="Board view"
        className="inline-flex items-center gap-1 rounded-md border border-border-control bg-card p-0.5"
      >
        {VIEWS.map((view) => {
          const pressed = value === view
          const disabled = view === '3D' && !support.ok
          return (
            <button
              key={view}
              type="button"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => {
                if (!pressed) onChange(view)
              }}
              className={[
                'h-9 min-w-11 rounded-sm px-3 text-sm font-semibold',
                disabled
                  ? 'cursor-not-allowed bg-muted text-ink-subtle'
                  : pressed
                    ? 'cursor-pointer bg-accent text-on-accent'
                    : 'cursor-pointer text-ink-muted hover:bg-inset',
              ].join(' ')}
            >
              {view}
            </button>
          )
        })}
      </span>
      {support.ok ? null : <InfoTip label="3D view">{support.reason}</InfoTip>}
    </span>
  )
}
