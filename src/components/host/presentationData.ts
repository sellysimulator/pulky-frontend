import type { GameState } from '../../store/gameStore'
import type { Brief, DayRecord, HostView, MarketDay, PublicDayResults, Weekday } from '../../types/game'

/** The only data presentation mode may show: public values, copied field by field (spec §11.1, §11.4). */
export interface PresentationData {
  day: number
  durationDays: number
  weekday: Weekday
  isPeak: boolean
  brief: Pick<Brief, 'expected_demand' | 'supplier' | 'futures' | 'transport'>
  latest: PublicDayResults | null
  peerMarket: boolean
  submitted: Array<{ alias: string; displayName: string; submitted: boolean }>
}

export interface HostHistories {
  players: Record<string, DayRecord[]>
  publicHistory: PublicDayResults[]
  marketHistory: MarketDay[]
}

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

function copyLatest(latest: PublicDayResults | undefined): PublicDayResults | null {
  if (latest === undefined) return null
  const players: PublicDayResults['players'] = {}
  for (const [alias, row] of Object.entries(latest.players)) {
    players[alias] = {
      display_name: row.display_name,
      units_sold: row.units_sold,
      market_share: row.market_share,
      reputation: row.reputation,
    }
  }
  return {
    day: latest.day,
    weekday: latest.weekday,
    demand_total: latest.demand_total,
    units_sold_total: latest.units_sold_total,
    spot_price: latest.spot_price,
    disrupted: latest.disrupted,
    cooperation: latest.cooperation,
    cooperators: latest.cooperators,
    refrigeration_failure: latest.refrigeration_failure,
    peer_units: latest.peer_units,
    peer_avg_price: latest.peer_avg_price,
    players,
  }
}

function submittedRows(hostView: HostView): PresentationData['submitted'] {
  return Object.keys(hostView.players)
    .sort((a, b) => aliasNumber(a) - aliasNumber(b))
    .map((alias) => ({
      alias,
      displayName: hostView.players[alias].display_name,
      submitted: hostView.players[alias].has_submitted && !hostView.awaiting.includes(alias),
    }))
}

/** Null before the start. Names every field it copies; nothing else of the host view crosses (spec §9.3, §11.1). */
export function selectPresentationData(state: GameState): PresentationData | null {
  const hostView = state.hostView
  const brief = state.brief ?? hostView?.brief ?? null
  if (hostView === null || brief === null) return null
  const latest = state.publicHistory[state.publicHistory.length - 1]
  return {
    day: brief.day,
    durationDays: brief.duration_days,
    weekday: brief.weekday,
    isPeak: brief.weekday_multiplier === 1,
    brief: {
      expected_demand: brief.expected_demand,
      supplier: {
        disrupted: brief.supplier.disrupted,
        disruption_message: brief.supplier.disruption_message,
        spot_price: brief.supplier.spot_price,
        base_price: brief.supplier.base_price,
        lead_time_days: brief.supplier.lead_time_days,
      },
      futures: {
        open: brief.futures.open,
        price: brief.futures.price,
        horizon_days: brief.futures.horizon_days,
        delivery_day: brief.futures.delivery_day,
        last_day_to_buy: brief.futures.last_day_to_buy,
        days_left_to_buy: brief.futures.days_left_to_buy,
      },
      transport: { shared: brief.transport.shared },
    },
    latest: copyLatest(latest),
    peerMarket: hostView.config.peer_market.enabled,
    submitted: submittedRows(hostView),
  }
}

export function selectHostHistories(state: GameState): HostHistories {
  return {
    players: state.hostHistories,
    publicHistory: state.publicHistory,
    marketHistory: state.marketHistory,
  }
}
