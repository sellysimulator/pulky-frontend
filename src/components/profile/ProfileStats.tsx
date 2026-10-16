import type { ReactElement } from 'react'
import type { UserStats } from '../../types/game'
import { formatMoney, formatPercent, formatQty } from '../../utils/format'
import StatTile from '../shared/StatTile'

/** Plan 3.2: seven tiles; a null average is "—", never 0%. */
export default function ProfileStats({ stats }: { stats: UserStats }): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-5 shadow-card md:grid-cols-4">
      <StatTile label="Games played" value={formatQty(stats.games_played)} />
      <StatTile label="Wins" value={formatQty(stats.wins)} />
      <StatTile label="Total profit" value={formatMoney(stats.total_profit)} />
      <StatTile label="Best profit" value={formatMoney(stats.best_profit)} />
      <StatTile label="Avg fill rate" value={formatPercent(stats.avg_fill_rate)} />
      <StatTile label="Avg waste rate" value={formatPercent(stats.avg_waste_rate)} />
      <StatTile label="Avg market share" value={formatPercent(stats.avg_market_share)} />
    </div>
  )
}
