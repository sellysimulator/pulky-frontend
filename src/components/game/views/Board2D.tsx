import type { ReactElement } from 'react'
import type { DayRecord, Decision, Participant, PlayerView, PublicConfig, PublicDayResults } from '../../../types/game'
import CellarPanel from '../CellarPanel'
import DayStats from '../DayStats'
import DecisionForm from '../DecisionForm'
import DetailsPanel from '../DetailsPanel'
import MarketPanel from '../MarketPanel'
import WaitingPanel from '../WaitingPanel'
import YesterdayRecap from '../YesterdayRecap'

/** The contract every board view implements (spec §13.11): the 3D board takes exactly these props. */
export interface BoardViewProps {
  view: PlayerView
  ownHistory: DayRecord[]
  publicHistory: PublicDayResults[]
  lastRecord: DayRecord | null
  locked: boolean
  gameOver: boolean
  /** `view.prefill_decision`: null once the game is over. */
  initialDecision: Decision | null
  config: PublicConfig
  participants: Participant[]
  awaiting: string[]
  onSubmit(decision: Decision): void
}

/** The player's game screen: one column in spec §13.7's order (D38). It reads props only, never the store. */
export default function Board2D({
  view,
  ownHistory,
  publicHistory,
  lastRecord,
  locked,
  gameOver,
  initialDecision,
  config,
  participants,
  awaiting,
  onSubmit,
}: BoardViewProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <DayStats view={view} awaiting={awaiting} participants={participants} />
      <YesterdayRecap
        view={view}
        config={config}
        lastRecord={lastRecord}
        publicHistory={publicHistory}
        participants={participants}
      />
      {gameOver ? null : (
        <DecisionForm
          view={view}
          config={config}
          initialDecision={initialDecision}
          locked={locked}
          onSubmit={onSubmit}
          lockedFooter={<WaitingPanel awaiting={awaiting} participants={participants} />}
        />
      )}
      <CellarPanel view={view} />
      <MarketPanel view={view} ownHistory={ownHistory} publicHistory={publicHistory} config={config} />
      <DetailsPanel view={view} ownHistory={ownHistory} publicHistory={publicHistory} lastRecord={lastRecord} />
    </div>
  )
}
