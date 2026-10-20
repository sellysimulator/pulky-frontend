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
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from './sceneLayout'

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
      className="pointer-events-auto flex min-h-0 flex-col gap-2"
    >
      <div ref={closeRow} className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          icon={X}
          aria-label={title === null ? 'Close' : `Close ${title}`}
          className="shadow-card"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg">
        {PANEL_ORDER.map((id) => (
          <div key={id} id={`scene-panel-${id}`} hidden={openPanel !== id}>
            {bodies[id]}
          </div>
        ))}
      </div>
    </section>
  )
}
