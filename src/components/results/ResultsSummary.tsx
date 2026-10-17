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
  viewer: { isHost: boolean; myAlias: string | null }
  showActions: boolean
  hostSecret: string | null
}

/** The six blocks of spec §13.8, in order, built from one `ResultsView`. */
export default function ResultsSummary({ view, viewer, showActions, hostSecret }: ResultsSummaryProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="print:break-inside-avoid">
        <Leaderboard view={view} revealedByDefault={!viewer.isHost} myAlias={viewer.myAlias} />
      </div>
      <div className="print:break-inside-avoid">
        <DemandSupplyChart view={view} />
      </div>
      <div className="print:hidden">
        <WherePulqueWent view={view} />
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
              {viewer.isHost ? <ExportControls gameId={view.game_id} roomCode={view.room_code} hostSecret={hostSecret} /> : null}
              <GuestClaimPrompt gameId={view.game_id} />
              {viewer.isHost ? <PlayAgainButton gameId={view.game_id} /> : null}
              {viewer.isHost ? <DebriefNotes /> : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
