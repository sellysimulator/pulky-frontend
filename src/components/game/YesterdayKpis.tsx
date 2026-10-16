import { ArrowLeftRight, CircleCheck, CircleDollarSign, ClockAlert, ThermometerSun, Trash, Users } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Yesterday } from '../../types/game'
import { formatMoney, formatQty } from '../../utils/format'
import StatTile from '../shared/StatTile'

interface YesterdayKpisProps {
  yesterday: Yesterday
  peerMarket: boolean
}

/** Spec §8.4: yesterday's headline numbers, all from `view.yesterday`. */
export default function YesterdayKpis({ yesterday: y, peerMarket }: YesterdayKpisProps): ReactElement {
  const change = y.backlog_change
  const failed = y.refrigeration_failure
  const Refrigeration = failed ? ThermometerSun : CircleCheck
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
      <StatTile size="lg" label="Demand" icon={Users} value={formatQty(y.demand)} />
      <StatTile size="lg" label="Sold" value={formatQty(y.sold)} />
      <StatTile
        size="lg"
        label="Backlog"
        icon={ClockAlert}
        value={formatQty(y.backlog_end)}
        delta={
          change === 0
            ? undefined
            : {
                text: `${change > 0 ? '+' : '−'}${formatQty(Math.abs(change))}`,
                direction: change > 0 ? 'up' : 'down',
                tone: change > 0 ? 'bad' : 'good',
              }
        }
      />
      <StatTile
        size="lg"
        label="Spoiled"
        icon={Trash}
        value={formatQty(y.spoiled)}
        sub={y.revenue_salvage > 0 ? `salvaged ${formatMoney(y.revenue_salvage)}` : undefined}
      />
      <StatTile size="lg" label="Profit" icon={CircleDollarSign} value={formatMoney(y.profit)} />
      <StatTile
        size="lg"
        label="Refrigeration"
        value={
          <span className="inline-flex items-center gap-1.5">
            <Refrigeration size={18} aria-hidden="true" className={failed ? 'text-danger' : 'text-success'} />
            {failed ? 'Failed' : 'OK'}
          </span>
        }
      />
      {peerMarket ? (
        <StatTile
          size="lg"
          label="Peer market"
          icon={ArrowLeftRight}
          value={`bought ${formatQty(y.peer_bought)} · sold ${formatQty(y.peer_sold)}`}
          sub={`paid ${formatMoney(y.cost_peer)} · earned ${formatMoney(y.revenue_peer)}`}
        />
      ) : null}
    </div>
  )
}
