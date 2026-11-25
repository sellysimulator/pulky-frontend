import { TriangleAlert, X } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import type { PlayerView } from '../../../../types/game'
import { formatMoney, weekdayShort } from '../../../../utils/format'
import { isPhoneHelpHidden, setPhoneHelpHidden } from '../../../../utils/storage'
import { PLAYER_MANUAL_PATH } from '../../../manual/ManualLink'
import Joystick from './Joystick'
import ModelCredits from './ModelCredits'
import { PANEL_ICONS } from './panelIcons'
import type { MoveKey } from './playerMotion'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from './sceneLayout'

interface PhoneHudProps {
  view: PlayerView
  /** The disruption alert and the Shared transport badge, when there are any. */
  notices: ReactNode
  openPanel: PanelId | null
  onPanelButton(panel: PanelId, button: HTMLButtonElement): void
  prompt: string | null
  onInteract(): void
  onMove(key: MoveKey, pressed: boolean): void
}

/** The same sentence in every Novus game. */
const PHONE_WARNING = '3D mode may not be very well optimized for phones.'

/** The help card's lines. The same three in every Novus game. */
const HELP_LINES = ['Joystick: walk', 'Drag: look around', 'Icons: open everything']

/** Today's decision first: it is the one a day needs. Then the panels' own order. */
const DOCK: readonly PanelId[] = ['decision', ...PANEL_ORDER.filter((id) => id !== 'decision')]

/** The "?" and its card: the corner upright, beside the dock's column on its side. The 2D button (`BoardViewToggle`)
 *  stands to its left. */
const HELP_RIGHT =
  'right-[max(0.75rem,env(safe-area-inset-right))] landscape:right-[calc(max(0.75rem,env(safe-area-inset-right))_+_3.25rem)]'

/** Under the status pill and the "?". */
const SECOND_ROW = 'top-[calc(max(0.75rem,env(safe-area-inset-top))_+_3.25rem)]'

const ROUND =
  'pointer-events-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border shadow-card'

/**
 * The HUD on a phone: the day and the cash on the left, "2D" and "?" on the right, every panel in one dock of icons, a
 * joystick to walk, and the Open button under the crosshair at a station.
 *
 * The dock is a row along the bottom of an upright phone and a column on the right of one on its side (40px icons
 * there: six of them fit the 286px Safari's open bars leave), and the panels (`ScenePanels`) leave it uncovered, so a
 * player can look at the market and go back to a half-typed decision. Upright, the notices and the help card share a
 * column, so neither covers the other.
 */
export default function PhoneHud({
  view,
  notices,
  openPanel,
  onPanelButton,
  prompt,
  onInteract,
  onMove,
}: PhoneHudProps): ReactElement {
  const [helpOpen, setHelpOpen] = useState(() => !isPhoneHelpHidden())
  const panelShown = openPanel !== null
  const toggleHelp = (): void => {
    setPhoneHelpHidden(helpOpen)
    setHelpOpen(!helpOpen)
  }

  return (
    <>
      <p
        className={`absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] flex h-11 max-w-[calc(100%_-_max(0.75rem,env(safe-area-inset-left))_-_max(0.75rem,env(safe-area-inset-right))_-_6.5rem)] items-center rounded-full border border-border bg-card px-4 text-sm leading-tight font-semibold text-ink tabular-nums shadow-card ${panelShown ? 'landscape:hidden' : ''}`}
      >
        Day {view.day}/{view.duration_days} · {weekdayShort(view.weekday)} · {formatMoney(view.cash)}
      </p>

      {panelShown ? null : (
        <button
          type="button"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-label={helpOpen ? 'Hide the 3D controls' : 'Show the 3D controls'}
          className={`${ROUND} absolute ${HELP_RIGHT} top-[max(0.75rem,env(safe-area-inset-top))] border-border-control bg-card text-lg font-semibold text-ink-muted`}
        >
          {helpOpen ? <X size={20} aria-hidden="true" /> : '?'}
        </button>
      )}

      <div
        className={`absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_4rem)] left-[max(0.75rem,env(safe-area-inset-left))] ${HELP_RIGHT} ${SECOND_ROW} flex flex-col gap-2 landscape:flex-row landscape:items-start ${panelShown ? 'landscape:hidden' : ''}`}
      >
        <div className="flex flex-col items-start gap-2 empty:hidden landscape:max-w-xs">{notices}</div>
        {helpOpen && !panelShown ? (
          <div className="pointer-events-auto max-h-[calc(100dvh-9rem)] landscape:max-h-[calc(100dvh-5.5rem)] max-w-[15rem] self-end overflow-y-auto rounded-md border border-border bg-card text-xs text-ink-muted shadow-card landscape:ml-auto landscape:self-start">
            <button type="button" onClick={toggleHelp} className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2 text-left">
              <span className="flex gap-1.5 font-semibold text-warning-ink">
                <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{PHONE_WARNING}</span>
              </span>
              {HELP_LINES.map((line) => (
                <span key={line}>{line}</span>
              ))}
              <span className="font-semibold">Tap to hide</span>
            </button>
            <div className="flex flex-col border-t border-border px-3">
              <a
                href={PLAYER_MANUAL_PATH}
                target="_blank"
                rel="noopener"
                className="flex min-h-11 items-center font-semibold text-accent underline-offset-2 hover:underline"
              >
                Player manual
              </a>
              <ModelCredits inline />
            </div>
          </div>
        ) : null}
      </div>

      {panelShown ? null : (
        <span aria-hidden="true" className="absolute inset-0 m-auto size-2 rounded-full bg-black/50" />
      )}

      <div role="status" aria-live="polite" className="absolute top-[calc(50%+1.25rem)] left-1/2 -translate-x-1/2">
        {prompt === null || panelShown ? null : (
          <button
            type="button"
            onClick={onInteract}
            aria-label={`Open ${prompt}`}
            className="pointer-events-auto cursor-pointer rounded-full bg-accent px-8 py-3 text-base font-semibold text-on-accent shadow-raised"
          >
            Open
          </button>
        )}
      </div>

      {panelShown ? null : (
        <Joystick
          onMove={onMove}
          className="bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_4rem)] left-[max(0.75rem,env(safe-area-inset-left))] landscape:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
        />
      )}

      <nav
        aria-label="Panels"
        className="absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center gap-1 landscape:inset-x-auto landscape:top-3 landscape:right-[max(0.75rem,env(safe-area-inset-right))] landscape:bottom-3 landscape:flex-col landscape:flex-wrap-reverse landscape:content-start"
      >
        {DOCK.map((id) => {
          const Icon = PANEL_ICONS[id]
          const shown = openPanel === id
          return (
            <button
              key={id}
              type="button"
              onClick={(event) => onPanelButton(id, event.currentTarget)}
              title={PANEL_TITLES[id]}
              aria-label={PANEL_TITLES[id]}
              aria-pressed={shown}
              aria-controls={`scene-panel-${id}`}
              className={`${ROUND} landscape:h-10 landscape:w-10 ${
                id === 'decision'
                  ? `border-accent bg-accent text-on-accent ${shown ? 'ring-2 ring-card ring-inset' : ''}`
                  : shown
                    ? 'border-accent bg-accent-subtle text-accent-hover ring-2 ring-accent ring-inset'
                    : 'border-border-control bg-card text-ink-muted'
              }`}
            >
              <Icon size={22} aria-hidden="true" />
            </button>
          )
        })}
      </nav>
    </>
  )
}
