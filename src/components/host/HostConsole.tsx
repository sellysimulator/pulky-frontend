import { Presentation } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { endGameEarly } from '../../api/games'
import type { HostView } from '../../types/game'
import { weekdayShort } from '../../utils/format'
import { resultsPath } from '../../utils/resultsPath'
import Button from '../shared/Button'
import EndEarlyControl from './EndEarlyControl'
import EventHistory from './EventHistory'
import MarketCharts from './MarketCharts'
import PlayersTable from './PlayersTable'
import type { HostHistories } from './presentationData'
import SubmissionTracker from './SubmissionTracker'

interface HostConsoleProps {
  hostView: HostView
  histories: HostHistories
  roomCode: string
  hostSecret: string | null
  finished: boolean
  gamePublicId: string | null
  onPresent(): void
}

export default function HostConsole({
  hostView,
  histories,
  roomCode,
  hostSecret,
  finished,
  gamePublicId,
  onPresent,
}: HostConsoleProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl tabular-nums">
          {`Room ${roomCode} · Day ${hostView.day}/${hostView.duration_days} (${weekdayShort(hostView.weekday)})`}
        </h1>
        <div className="ml-auto flex items-center">
          {finished ? (
            gamePublicId !== null ? (
              <Link
                to={resultsPath(gamePublicId)}
                className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base font-semibold whitespace-nowrap text-on-accent transition-colors hover:bg-accent-hover"
              >
                See the results
              </Link>
            ) : null
          ) : (
            <>
              <Button variant="secondary" icon={Presentation} onClick={onPresent}>
                Presentation mode
              </Button>
              <div className="ml-6 border-l border-border pl-6">
                <EndEarlyControl
                  disabled={hostSecret === null}
                  onConfirm={() => {
                    if (hostSecret !== null) endGameEarly(roomCode, hostSecret)
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <SubmissionTracker hostView={hostView} />
      <PlayersTable hostView={hostView} histories={histories} />
      <MarketCharts hostView={hostView} histories={histories} config={hostView.config} />
      <EventHistory hostView={hostView} histories={histories} />
    </div>
  )
}
