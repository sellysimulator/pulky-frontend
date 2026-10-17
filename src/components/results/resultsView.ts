import type { GameFinishedPayload, GameStats, IncotermTier, ResultsResponse, Weekday } from '../../types/game'

/** Spec §13.8, field for field. The peer fields are optional: a stored payload without them renders no peer segment, column or chart. */
export interface PulqueriaResultView {
  alias: string
  display_name: string
  rank: number
  total_profit: number
  revenue_sales: number
  revenue_salvage: number
  revenue_liquidation: number
  units_sold: number
  units_spoiled: number
  units_lost_transport: number
  liquidated_units: number
  fill_rate: number | null
  waste_rate: number | null
  avg_reputation: number
  final_reputation: number
  overall_market_share: number
  peak_stock: number
  peak_backlog: number
  days_with_backlog: number
  futures_units: number
  futures_unfilled: number
  futures_cancelled_units: number
  futures_share: number | null
  futures_vs_spot: number
  cost_insurance: number
  refund_insurance: number
  insurance_net: number
  cost_conservation: number
  lots_conserved: number
  days_cooperated: number
  shortfall_spot_units?: number
  peer_units_bought?: number
  peer_units_sold?: number
  cost_peer?: number
  revenue_peer?: number
  peer_net?: number
  incoterm_tier_days: Record<IncotermTier, number>
  series: {
    delivered: number[]
    peer_bought?: number[]
    peer_sold?: number[]
    sold: number[]
    spoiled: number[]
    backlog_end: number[]
    closing_stock: number[]
    reputation: number[]
    profit: number[]
    cooperate: boolean[]
  }
}

export interface ResultsView {
  game_id: string
  room_code: string
  days_played: number
  duration_days: number
  ended_early: boolean
  started_at?: string
  finished_at?: string
  market: {
    weekday: Weekday[]
    weekday_multiplier: number[]
    demand: number[]
    delivered: number[]
    sold: number[]
    spoiled: number[]
    backlog_end: number[]
    spot_price: number[]
    capacity: number[]
    cooperators: number[]
    cooperation_reached: boolean[]
    refrigeration_failure: boolean[]
    disrupted: boolean[]
    peer_units?: number[]
    peer_avg_price?: (number | null)[]
  }
  players: PulqueriaResultView[]
}

const PLAYER_KEYS = [
  'alias',
  'display_name',
  'rank',
  'total_profit',
  'revenue_sales',
  'revenue_salvage',
  'revenue_liquidation',
  'units_sold',
  'units_spoiled',
  'units_lost_transport',
  'liquidated_units',
  'fill_rate',
  'waste_rate',
  'avg_reputation',
  'final_reputation',
  'overall_market_share',
  'peak_stock',
  'peak_backlog',
  'days_with_backlog',
  'futures_units',
  'futures_unfilled',
  'futures_cancelled_units',
  'futures_share',
  'futures_vs_spot',
  'cost_insurance',
  'refund_insurance',
  'insurance_net',
  'cost_conservation',
  'lots_conserved',
  'days_cooperated',
  'shortfall_spot_units',
  'peer_units_bought',
  'peer_units_sold',
  'cost_peer',
  'revenue_peer',
  'peer_net',
] as const

const SERIES_KEYS = [
  'delivered',
  'peer_bought',
  'peer_sold',
  'sold',
  'spoiled',
  'backlog_end',
  'closing_stock',
  'reputation',
  'profit',
  'cooperate',
] as const

const MARKET_KEYS = [
  'weekday',
  'weekday_multiplier',
  'demand',
  'delivered',
  'sold',
  'spoiled',
  'backlog_end',
  'spot_price',
  'capacity',
  'cooperators',
  'cooperation_reached',
  'refrigeration_failure',
  'disrupted',
  'peer_units',
  'peer_avg_price',
] as const

/** Copies the named keys that the source carries; a missing key stays missing and is never faked. */
function pick(source: object, keys: readonly string[]): Record<string, unknown> {
  const record = source as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in record && record[key] !== undefined) out[key] = record[key]
  }
  return out
}

function normalise(
  stats: GameStats,
  head: Pick<ResultsView, 'game_id' | 'room_code' | 'days_played' | 'duration_days' | 'ended_early'>,
): ResultsView {
  const players = Object.values(stats.players)
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({
      ...pick(p, PLAYER_KEYS),
      incoterm_tier_days: { ...p.incoterm_tier_days },
      series: pick(p.series, SERIES_KEYS),
    })) as unknown as PulqueriaResultView[]
  return {
    ...head,
    market: pick(stats.market.series, MARKET_KEYS) as unknown as ResultsView['market'],
    players,
  }
}

/** Copies the live `game_finished` payload into the view model; nothing is computed here. */
export function resultsViewFromLive(
  p: GameFinishedPayload,
  ctx: { roomCode: string; durationDays: number },
): ResultsView {
  return normalise(p.stats, {
    game_id: p.game_id,
    room_code: ctx.roomCode,
    days_played: p.days_played,
    duration_days: ctx.durationDays,
    ended_early: p.ended_early,
  })
}

/** Copies a stored `ResultsResponse` into the same view model, adding the two timestamps. */
export function resultsViewFromResponse(r: ResultsResponse): ResultsView {
  return {
    ...normalise(r.stats, {
      game_id: r.game_id,
      room_code: r.room_code,
      days_played: r.days_played,
      duration_days: r.duration_days,
      ended_early: r.ended_early,
    }),
    started_at: r.started_at,
    finished_at: r.finished_at,
  }
}
