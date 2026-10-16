import { CalendarDays } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import type { MyGameRow } from '../../types/game'
import { formatMoney } from '../../utils/format'
import Badge from '../shared/Badge'
import DataTable from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `d MMM yyyy` of an ISO 8601 UTC instant, read in UTC so every browser shows the same day. */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Plan 3.2: the games the user played, newest first. */
export default function GamesTable({ games }: { games: MyGameRow[] }): ReactElement {
  if (games.length === 0) {
    return (
      <EmptyState icon={CalendarDays} title="No games yet" body="Finished games you play signed in appear here." />
    )
  }
  const rows = [...games].sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at))
  return (
    <DataTable
      caption="Your games"
      captionVisible
      rows={rows}
      rowKey={(g) => g.game_id}
      columns={[
        { key: 'date', header: 'Date', render: (g) => formatDate(g.finished_at) },
        { key: 'room', header: 'Room', render: (g) => <span className="font-mono">{g.room_code}</span> },
        { key: 'name', header: 'Pulquería', render: (g) => g.display_name },
        { key: 'rank', header: 'Rank', render: (g) => `${g.rank} of ${g.player_count}` },
        { key: 'profit', header: 'Profit', align: 'right', render: (g) => formatMoney(g.total_profit) },
        {
          key: 'days',
          header: 'Days',
          render: (g) => (
            <span className="inline-flex items-center gap-2">
              <span>{`${g.days_played}/${g.duration_days}`}</span>
              {g.ended_early ? <Badge tone="neutral">Ended early</Badge> : null}
            </span>
          ),
        },
        {
          key: 'open',
          header: 'Open',
          render: (g) => (
            <Link
              to={`/profile/games/${g.game_id}`}
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
