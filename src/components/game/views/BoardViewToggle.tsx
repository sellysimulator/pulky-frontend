import type { ReactElement } from 'react'
import InfoTip from '../../shared/InfoTip'
import type { BoardView, BoardViewSupport } from './boardView'

interface BoardViewToggleProps {
  value: BoardView
  support: BoardViewSupport
  onChange(view: BoardView): void
}

const VIEWS: readonly BoardView[] = ['2D', '3D']

/** Board view: 2D | 3D. Where 3D is unavailable it stays on screen, disabled, with the reason beside it (design.md §14.4). */
export default function BoardViewToggle({ value, support, onChange }: BoardViewToggleProps): ReactElement {
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
