import {
  CalendarDays,
  ChartLine,
  ChartPie,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Hand,
  History,
  Truck,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import type { Participant, PlayerView } from '../../../../types/game'
import { formatMoney, weekdayLong } from '../../../../utils/format'
import { InlineAlert } from '../../../shared/AlertContainer'
import Badge from '../../../shared/Badge'
import Button from '../../../shared/Button'
import { useCoarsePointer } from './coarsePointer'
import ModelCredits from './ModelCredits'
import MovePad from './MovePad'
import type { MoveKey } from './playerMotion'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from './sceneLayout'

interface SceneHudProps {
  view: PlayerView
  participants: Participant[]
  awaiting: string[]
  openPanel: PanelId | null
  onPanelButton(panel: PanelId, button: HTMLButtonElement): void
  prompt: string | null
  /** The touch screen's E: opens the panel of the station in reach. */
  onInteract(): void
  /** The movement pad's presses and releases. */
  onMove(key: MoveKey, pressed: boolean): void
  drawer: ReactNode
}

const PANEL_ICONS: Record<PanelId, LucideIcon> = {
  'day-stats': CalendarDays,
  yesterday: History,
  decision: ClipboardList,
  cellar: Warehouse,
  market: ChartPie,
  details: ChartLine,
}

const KBD = 'rounded-xs border border-border-control bg-inset px-1 font-mono text-ink'

function Key({ children }: { children: string }): ReactElement {
  return <kbd className={KBD}>{children}</kbd>
}

/**
 * The DOM over the canvas (design.md §14.4): every element in its own grid cell, so none overlaps another. From 64rem
 * it is three columns; below, one column (day strip, panel bar, drawer, bottom row), and an open panel takes the
 * bottom row's place. On a touch screen (`(any-pointer: coarse)`) the bottom row adds the movement pad, the prompt is
 * a button and the legend speaks of taps.
 */
export default function SceneHud({
  view,
  participants,
  awaiting,
  openPanel,
  onPanelButton,
  prompt,
  onInteract,
  onMove,
  drawer,
}: SceneHudProps): ReactElement {
  const touch = useCoarsePointer()
  const names = awaiting.map((alias) => participants.find((p) => p.alias === alias)?.display_name ?? alias)
  const waiting = names.length > 0 ? `Waiting for: ${names.join(', ')}` : 'Everyone has submitted.'
  const WaitingIcon = names.length > 0 ? CircleDashed : CircleCheck
  const disruption = view.brief?.supplier.disruption_message ?? null
  const shared = view.brief?.transport.shared === true
  const showPrompt = openPanel === null && prompt !== null

  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_minmax(0,40rem)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-3">
      <div className="col-start-1 row-start-1 flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-ink tabular-nums shadow-card">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={16} aria-hidden="true" className="text-ink-muted" />
            <span>
              Day {view.day}/{view.duration_days} · {weekdayLong(view.weekday)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet size={16} aria-hidden="true" className="text-ink-muted" />
            <span>Cash {formatMoney(view.cash)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WaitingIcon size={16} aria-hidden="true" className="text-ink-muted" />
            <span>{waiting}</span>
          </span>
        </div>
        {disruption ? (
          <div className="pointer-events-auto">
            <InlineAlert tone="warning">{disruption}</InlineAlert>
          </div>
        ) : null}
        {shared ? (
          <div className="pointer-events-auto">
            <Badge tone="neutral" icon={Truck}>
              Shared transport
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none col-span-full row-span-full grid place-items-center">
        <div className="relative">
          {openPanel === null ? <span aria-hidden="true" className="block size-2 rounded-full bg-black/50" /> : null}
          <div
            role="status"
            aria-live="polite"
            className="absolute top-full left-1/2 mt-4 -translate-x-1/2 whitespace-nowrap"
          >
            {showPrompt ? (
              touch ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={Hand}
                  className="pointer-events-auto shadow-raised"
                  onClick={onInteract}
                >
                  Open {prompt}
                </Button>
              ) : (
                <span className="block rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-on-ink shadow-raised">
                  Press E · {prompt}
                </span>
              )
            ) : null}
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Panels"
        className="pointer-events-auto col-start-1 row-start-2 flex flex-wrap justify-end gap-2 lg:col-start-3 lg:row-start-1"
      >
        {PANEL_ORDER.map((id) => {
          const pressed = openPanel === id
          return (
            <Button
              key={id}
              variant="secondary"
              size="sm"
              icon={PANEL_ICONS[id]}
              aria-pressed={pressed}
              aria-controls={`scene-panel-${id}`}
              title={PANEL_TITLES[id]}
              className={[
                'shadow-card any-pointer-coarse:h-11 max-sm:w-11 max-sm:px-0!',
                pressed ? 'bg-accent-subtle ring-2 ring-accent ring-inset' : '',
              ].join(' ')}
              onClick={(event) => onPanelButton(id, event.currentTarget)}
            >
              <span className="max-sm:sr-only">{PANEL_TITLES[id]}</span>
            </Button>
          )
        })}
      </div>

      <div className="pointer-events-none col-start-1 row-span-2 row-start-3 flex min-h-0 flex-col gap-2 lg:col-start-3 lg:row-start-2">
        {drawer}
      </div>

      <div
        className={[
          'col-start-1 row-start-4 flex items-end justify-between gap-2 lg:row-start-3',
          openPanel === null ? '' : 'max-lg:hidden',
        ].join(' ')}
      >
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <div className="pointer-events-auto rounded-md border border-border bg-card px-3 py-2 text-xs text-ink-muted shadow-card">
            {touch ? (
              <>
                <p>Arrow buttons: walk and turn</p>
                <p>Drag: look around</p>
                <p>Open: the station you stand at</p>
              </>
            ) : (
              <>
                <p>
                  <Key>W</Key> <Key>A</Key> <Key>S</Key> <Key>D</Key> or arrow keys: walk
                </p>
                <p>Drag: look around</p>
                <p>
                  <Key>E</Key>: open · <Key>Esc</Key>: close
                </p>
              </>
            )}
          </div>
          <ModelCredits />
        </div>
        {touch && openPanel === null ? <MovePad onMove={onMove} /> : null}
      </div>
    </div>
  )
}
