/**
 * Section 29 shared test data: one finished 14-day game (spec 8.6 shapes), as the
 * `game_finished` payload, as a `ResultsResponse`, and as the `ResultsView` that
 * spec 13.8 describes. The view is built here by hand, field by field, so it is an
 * oracle that does not depend on the normalisers under test.
 *
 * Aliases and ranks are deliberately not in the same order: P2 is rank 1, P3 rank 2,
 * P1 rank 3, so any code that orders by alias instead of by rank shows up.
 */
import type { PulqueriaResultView, ResultsView } from '../../components/results/resultsView'

export const DAYS = 14
export const ROOM = 'ABC234'

export const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal' }
export const RANK_ORDER = ['P2', 'P3', 'P1']

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const MULTIPLIERS = [0.25, 0.5, 0.75, 1, 1, 1, 0.75]
/** Thu-Sat of both weeks, as 0-based indices. */
export const PEAK_DAYS = [3, 4, 5, 10, 11, 12]

export const PLAYER_SCALAR_KEYS = [
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
  'incoterm_days',
] as const

export const PEER_PLAYER_KEYS = [
  'shortfall_spot_units',
  'peer_units_bought',
  'peer_units_sold',
  'cost_peer',
  'revenue_peer',
  'peer_net',
] as const

export const SERIES_KEYS = [
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

export const MARKET_KEYS = [
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

type Dict = Record<string, unknown>

function repeat(week: number[]): number[] {
  return Array.from({ length: DAYS }, (_, i) => week[i % week.length])
}

function sparse(entries: Record<number, number>): number[] {
  return Array.from({ length: DAYS }, (_, i) => entries[i] ?? 0)
}

function player(alias: string, rank: number, over: Dict, seriesOver: Dict = {}): Dict {
  const base: Dict = {
    alias,
    display_name: NAMES[alias],
    rank,
    total_profit: 0,
    revenue_sales: 1000,
    revenue_salvage: 20,
    revenue_liquidation: 5,
    refund_insurance: 3,
    units_sold: 100,
    overall_market_share: 0.3,
    fill_rate: 0.9,
    days_with_backlog: 1,
    cost_backlog: 15,
    waste_rate: 0.1,
    units_spoiled: 10,
    liquidated_units: 0,
    units_lost_transport: 0,
    cost_insurance: 10,
    insurance_net: -7,
    futures_units: 50,
    futures_unfilled: 0,
    futures_cancelled_units: 0,
    futures_vs_spot: 4.5,
    futures_share: 0.2,
    cost_conservation: 0,
    lots_conserved: 0,
    shortfall_spot_units: 0,
    peer_units_bought: 0,
    peer_units_sold: 0,
    cost_peer: 0,
    revenue_peer: 0,
    peer_net: 0,
    avg_reputation: 0.6,
    final_reputation: 0.6,
    days_cooperated: 0,
    peak_stock: 80,
    peak_backlog: 0,
    incoterm_days: { exw: 14, cip: 0, dap: 0, ddp: 0 },
    final_settlement: { liquidated_units: 0, revenue_liquidation: 5 },
    series: {
      delivered: repeat([20, 25, 30, 35, 40, 38, 22]),
      peer_bought: sparse({}),
      peer_sold: sparse({}),
      sold: repeat([18, 22, 28, 33, 36, 35, 20]),
      spoiled: repeat([0, 1, 0, 2, 1, 0, 3]),
      backlog_end: repeat([0, 0, 2, 4, 1, 0, 0]),
      closing_stock: repeat([5, 8, 6, 9, 7, 5, 6]),
      reputation: repeat([0.5, 0.52, 0.55, 0.6, 0.62, 0.6, 0.58]),
      profit: repeat([10, 12, 14.5, 20, 22, 18, 9]),
      cooperate: repeat([1, 0, 1, 1, 0, 0, 1]).map((v) => v === 1),
      ...seriesOver,
    },
  }
  return { ...base, ...over }
}

export interface StatsBundle {
  players: Record<string, Dict>
  market: Dict
  leaderboard: Dict[]
}

/** Fresh stats on every call: tests mutate freely. */
export function makeStats(): StatsBundle {
  const players: Record<string, Dict> = {
    P1: player(
      'P1',
      3,
      {
        total_profit: -250.75,
        units_sold: 410,
        units_spoiled: 35,
        units_lost_transport: 12,
        liquidated_units: 8,
        fill_rate: 0.9,
        waste_rate: 0.12,
        avg_reputation: 0.62,
        final_reputation: 0.55,
        overall_market_share: 0.31,
        peak_stock: 120,
        peak_backlog: 7,
        days_with_backlog: 2,
        futures_units: 100,
        futures_unfilled: 5,
        futures_share: 0.25,
        futures_vs_spot: 18.5,
        cost_insurance: 40,
        refund_insurance: 10,
        insurance_net: -30,
        cost_conservation: 5,
        lots_conserved: 2,
        days_cooperated: 3,
        shortfall_spot_units: 30,
        peer_units_bought: 16,
        peer_units_sold: 4,
        cost_peer: 240,
        revenue_peer: 70,
        peer_net: -170,
        incoterm_days: { exw: 1, cip: 2, dap: 3, ddp: 8 },
      },
      { peer_bought: sparse({ 2: 16 }), peer_sold: sparse({ 1: 4 }) },
    ),
    P2: player(
      'P2',
      1,
      {
        total_profit: 5123.45,
        units_sold: 520,
        units_spoiled: 20,
        units_lost_transport: 3,
        liquidated_units: 0,
        fill_rate: 0.97,
        waste_rate: 0.04,
        avg_reputation: 0.8,
        final_reputation: 0.85,
        overall_market_share: 0.4,
        peak_stock: 150,
        peak_backlog: 3,
        days_with_backlog: 5,
        futures_units: 200,
        futures_share: 0.4,
        futures_vs_spot: 41.25,
        cost_insurance: 60,
        refund_insurance: 90,
        insurance_net: 30,
        lots_conserved: 6,
        days_cooperated: 10,
        shortfall_spot_units: 2,
        peer_units_bought: 2,
        peer_units_sold: 0,
        // Deliberately not revenue_peer - cost_peer: the client must show peer_net as sent.
        cost_peer: 30,
        revenue_peer: 55,
        peer_net: 12.34,
        incoterm_days: { exw: 4, cip: 0, dap: 6, ddp: 4 },
      },
      { peer_bought: sparse({ 2: 2 }), peer_sold: sparse({}) },
    ),
    P3: player('P3', 2, {
      total_profit: 3000.5,
      units_sold: 300,
      units_spoiled: 0,
      // A server null with a non-zero units_sold: the client must not recompute it.
      fill_rate: null,
      waste_rate: null,
      futures_share: null,
      futures_units: 0,
      avg_reputation: 0.7,
      overall_market_share: 0.29,
      peak_backlog: 11,
      days_with_backlog: 9,
      lots_conserved: 4,
      days_cooperated: 14,
      incoterm_days: { exw: 5, cip: 5, dap: 2, ddp: 2 },
    }),
  }

  const market: Dict = {
    demand_total: 800,
    units_sold_total: 1230,
    cooperation_days: 6,
    failure_days: 2,
    disruption_days: 1,
    avg_spot_price: 13,
    min_spot_price: 11,
    max_spot_price: 15,
    peer_units_total: 22,
    peer_trade_days: 2,
    avg_peer_price: 14.6,
    series: {
      weekday: repeat([0, 1, 2, 3, 4, 5, 6]).map((i) => WEEKDAYS[i]),
      weekday_multiplier: repeat(MULTIPLIERS),
      demand: repeat([40, 45, 50, 80, 85, 90, 60]),
      delivered: repeat([60, 70, 80, 90, 100, 95, 55]),
      sold: repeat([38, 44, 49, 70, 75, 80, 58]),
      spoiled: repeat([2, 1, 0, 4, 3, 1, 5]),
      backlog_end: repeat([0, 0, 1, 10, 9, 10, 2]),
      spot_price: repeat([12, 12.5, 13, 14, 15, 14.5, 11]),
      capacity: repeat([150, 150, 140, 90, 150, 150, 150]),
      cooperators: repeat([3, 2, 3, 3, 3, 3, 1]),
      cooperation_reached: Array.from({ length: DAYS }, (_, i) => PEAK_DAYS.includes(i)),
      refrigeration_failure: Array.from({ length: DAYS }, (_, i) => i === 2 || i === 9),
      disrupted: Array.from({ length: DAYS }, (_, i) => i === 6),
      peer_units: sparse({ 1: 4, 2: 18 }),
      peer_avg_price: Array.from({ length: DAYS }, (_, i) => (i === 1 ? 15.5 : i === 2 ? 14.25 : null)),
    },
  }

  const leaderboard = RANK_ORDER.map((alias) => {
    const p = players[alias]
    return {
      rank: p.rank,
      alias,
      display_name: p.display_name,
      total_profit: p.total_profit,
      fill_rate: p.fill_rate,
      waste_rate: p.waste_rate,
    }
  })
  return { players, market, leaderboard }
}

/** Removes every peer field of spec 8.6 (a payload from before the peer market). */
export function withoutPeer(stats: StatsBundle): StatsBundle {
  for (const p of Object.values(stats.players)) {
    for (const k of PEER_PLAYER_KEYS) delete p[k]
    const series = p.series as Dict
    delete series.peer_bought
    delete series.peer_sold
  }
  const series = stats.market.series as Dict
  delete series.peer_units
  delete series.peer_avg_price
  return stats
}

/** The `game_finished` payload (spec 12.2). */
export function makeFinished(mutate?: (s: StatsBundle) => void): Record<string, unknown> {
  const s = makeStats()
  mutate?.(s)
  return {
    seq: 40,
    days_played: DAYS,
    ended_early: false,
    leaderboard: s.leaderboard,
    stats: { players: s.players, market: s.market },
  }
}

/** The `ResultsResponse` (spec 13.4) for the same game. */
export function makeResponse(mutate?: (s: StatsBundle) => void): Record<string, unknown> {
  const s = makeStats()
  mutate?.(s)
  return {
    game_id: '9f2c1a',
    room_code: ROOM,
    host_display_name: 'Ana',
    duration_days: DAYS,
    days_played: DAYS,
    ended_early: false,
    started_at: '2026-10-12T15:00:00Z',
    finished_at: '2026-10-12T15:42:00Z',
    leaderboard: s.leaderboard,
    stats: { players: s.players, market: s.market },
  }
}

/** The expected `ResultsView`, copied field by field from the stats. */
export function makeView(mutate?: (s: StatsBundle) => void): ResultsView {
  const s = makeStats()
  mutate?.(s)
  const marketSeries = s.market.series as Dict
  const market: Dict = {}
  for (const k of MARKET_KEYS) if (k in marketSeries) market[k] = marketSeries[k]
  const players = RANK_ORDER.map((alias) => {
    const p = s.players[alias]
    const out: Dict = {}
    for (const k of PLAYER_SCALAR_KEYS) if (k in p) out[k] = p[k]
    const series = p.series as Dict
    const outSeries: Dict = {}
    for (const k of SERIES_KEYS) if (k in series) outSeries[k] = series[k]
    out.series = outSeries
    return out as unknown as PulqueriaResultView
  })
  return {
    room_code: ROOM,
    days_played: DAYS,
    duration_days: DAYS,
    ended_early: false,
    market,
    players,
  } as unknown as ResultsView
}
