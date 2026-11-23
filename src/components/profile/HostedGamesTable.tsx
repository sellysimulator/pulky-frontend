import { UserCog } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import type { HostedGameRow } from '../../types/game'
import { formatDate } from '../../utils/format'
import { resultsPath } from '../../utils/resultsPath'
import Badge from '../shared/Badge'
import DataTable from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'

/**
 * The games the user hosted signed in, newest first (design.md §8.9, spec §13.4). A list
 * apart from the played games and the stats; each entry opens the game's open results page.
 */
export default function HostedGamesTable({ games }: { games: HostedGameRow[] }): ReactElement {
  if (games.length === 0) {
    return (
      <EmptyState icon={UserCog} title="No hosted games yet" body="Finished games you host signed in appear here." />
    )
  }
  const rows = [...games].sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at))
  return (
    <DataTable
      caption="Games you hosted"
      captionVisible
      rows={rows}
      rowKey={(g) => g.game_id}
      columns={[
        {
          key: 'date',
          header: 'Date',
          render: (g) => (
            <span className="inline-flex items-center gap-2">
              <span>{formatDate(g.finished_at)}</span>
              {g.ended_early ? <Badge tone="neutral">Ended early</Badge> : null}
            </span>
          ),
        },
        { key: 'room', header: 'Room', render: (g) => <span className="font-mono">{g.room_code}</span> },
        { key: 'players', header: 'Players', render: (g) => String(g.player_count) },
        {
          key: 'open',
          header: 'Open',
          render: (g) => (
            <Link
              to={resultsPath(g.game_id)}
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold whitespace-nowrap text-ink-muted transition-colors hover:bg-muted hover:text-ink"
            >
              Open
            </Link>
          ),
        },
      ]}
    />
  )
}
