import type { ReactElement } from 'react'
import DebriefNotes from './DebriefNotes'
import DecisionsCharts from './DecisionsCharts'
import DemandSupplyChart from './DemandSupplyChart'
import ExportControls from './ExportControls'
import GuestClaimPrompt from './GuestClaimPrompt'
import Leaderboard from './Leaderboard'
import PlayAgainButton from './PlayAgainButton'
import RatioTable from './RatioTable'
import type { ResultsView } from './resultsView'
import SectionCard from '../shared/SectionCard'
import WherePulqueWent from './WherePulqueWent'

interface ResultsSummaryProps {
  view: ResultsView
  /**
   * `isHost`: this browser holds the game's host secret (hides the leaderboard, offers Play again and
   * the debrief notes). The export is offered to every viewer, host or not (spec §13.8 block 6).
   */
  viewer: { isHost: boolean; myAlias: string | null }
  showActions: boolean
}

/** The six blocks of spec §13.8, in order, built from one `ResultsView`. */
export default function ResultsSummary({ view, viewer, showActions }: ResultsSummaryProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="print:break-inside-avoid">
        <Leaderboard view={view} revealedByDefault={!viewer.isHost} myAlias={viewer.myAlias} />
      </div>
      <div className="print:break-inside-avoid">
        <DemandSupplyChart view={view} />
      </div>
      <div className="print:hidden">
        <WherePulqueWent view={view} myAlias={viewer.myAlias} />
      </div>
      <div className="print:break-inside-avoid">
        <RatioTable view={view} myAlias={viewer.myAlias} />
      </div>
      <div className="print:hidden">
        <DecisionsCharts view={view} />
      </div>
      {showActions ? (
        <div className="print:hidden">
          <SectionCard title="6. Actions">
            <div className="flex flex-col gap-4">
              <ExportControls gameId={view.game_id} roomCode={view.room_code} />
              <GuestClaimPrompt gameId={view.game_id} />
              {viewer.isHost ? <PlayAgainButton gameId={view.game_id} /> : null}
              {viewer.isHost ? <DebriefNotes leadTimeDays={view.config?.supplier.lead_time_days ?? null} /> : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
