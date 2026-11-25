import { X } from 'lucide-react'
import { useEffect, useRef, type ReactElement } from 'react'
import Button from '../../../shared/Button'
import CellarPanel from '../../CellarPanel'
import DayStats from '../../DayStats'
import DecisionForm from '../../DecisionForm'
import DetailsPanel from '../../DetailsPanel'
import MarketPanel from '../../MarketPanel'
import WaitingPanel from '../../WaitingPanel'
import YesterdayRecap from '../../YesterdayRecap'
import type { BoardViewProps } from '../Board2D'
import { usePhoneViewport } from './phoneViewport'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from './sceneLayout'

/**
 * The drawer on a phone: a window in the exact centre of the screen, never larger than the safe area and wider when the
 * phone lies on its side. In its grid cell a sideways phone leaves it 100 to 200 px. It leaves `PhoneHud`'s dock
 * uncovered (2.75rem icons and a 0.5rem gap): the row below it upright, the column beside it on its side. The same is
 * left free on the other side, which is what keeps it in the exact centre.
 */
const PHONE_WINDOW =
  'pointer-events-auto fixed inset-0 z-30 m-auto flex h-fit max-h-[calc(100dvh_-_2*(max(0.75rem,env(safe-area-inset-top),env(safe-area-inset-bottom))_+_3.25rem))] w-[min(40rem,calc(100vw_-_2*max(0.75rem,env(safe-area-inset-left),env(safe-area-inset-right))))] flex-col gap-1 rounded-lg border border-border-strong bg-canvas p-1 shadow-raised landscape:max-h-[calc(100dvh_-_2*max(0.75rem,env(safe-area-inset-top),env(safe-area-inset-bottom)))] landscape:w-[min(48rem,calc(100vw_-_2*(max(0.75rem,env(safe-area-inset-left),env(safe-area-inset-right))_+_3.25rem)))] [&_td]:px-1.5 [&_td]:text-sm [&_th]:px-1.5'

type ScenePanelsProps = BoardViewProps & { openPanel: PanelId | null; onClose(): void }

/**
 * The drawer. All six panels are mounted from the first render and only `hidden` changes, so the decision form keeps
 * its draft and the DOM never holds a second copy of a panel (spec §13.11.6).
 */
export default function ScenePanels({
  view,
  ownHistory,
  publicHistory,
  lastRecord,
  locked,
  initialDecision,
  config,
  participants,
  awaiting,
  onSubmit,
  openPanel,
  onClose,
}: ScenePanelsProps): ReactElement {
  const phone = usePhoneViewport()
  const closeRow = useRef<HTMLDivElement>(null)
  const title = openPanel === null ? null : PANEL_TITLES[openPanel]

  useEffect(() => {
    if (openPanel !== null) closeRow.current?.querySelector('button')?.focus()
  }, [openPanel])

  const bodies: Record<PanelId, ReactElement> = {
    'day-stats': <DayStats view={view} awaiting={awaiting} participants={participants} />,
    yesterday: (
      <YesterdayRecap
        view={view}
        config={config}
        lastRecord={lastRecord}
        publicHistory={publicHistory}
        participants={participants}
      />
    ),
    decision: (
      <DecisionForm
        view={view}
        config={config}
        initialDecision={initialDecision}
        locked={locked}
        onSubmit={onSubmit}
        lockedFooter={<WaitingPanel awaiting={awaiting} participants={participants} />}
      />
    ),
    cellar: <CellarPanel view={view} />,
    market: <MarketPanel view={view} ownHistory={ownHistory} publicHistory={publicHistory} config={config} />,
    details: <DetailsPanel view={view} ownHistory={ownHistory} publicHistory={publicHistory} lastRecord={lastRecord} />,
  }

  return (
    <section
      aria-label={title ?? undefined}
      hidden={openPanel === null}
      // Read by CSS: the 2D button (`BoardViewToggle`) steps aside for a panel that fills a sideways phone's height.
      data-phone-panel={phone && openPanel !== null ? true : undefined}
      className={phone ? PHONE_WINDOW : 'pointer-events-auto flex min-h-0 flex-col gap-2'}
    >
      <div ref={closeRow} className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          icon={X}
          aria-label={title === null ? 'Close' : `Close ${title}`}
          className={phone ? 'h-11! w-11 rounded-full! px-0! shadow-card' : 'shadow-card'}
          onClick={onClose}
        >
          {/* On a phone a button carries no words; its name still says which panel it closes. */}
          {phone ? null : 'Close'}
        </Button>
      </div>
      <div className={`min-h-0 overflow-y-auto overscroll-contain rounded-lg ${phone ? '' : 'flex-1'}`}>
        {PANEL_ORDER.map((id) => (
          <div key={id} id={`scene-panel-${id}`} hidden={openPanel !== id}>
            {bodies[id]}
          </div>
        ))}
      </div>
    </section>
  )
}
