/**
 * Section 35 shared test data (test data only): the worked examples of section 35 section 4, and views
 * carrying the spec 8.6 `flow`. Built by hand so they do not depend on the code under test.
 */
import type { PulqueFlow, Weekday } from '../../types/game'
import type { PulqueriaResultView, ResultsView } from '../../components/results/resultsView'
import { makeView } from './results'

/** Section 35 section 4's flow example. */
export const FLOW_EXAMPLE: PulqueFlow = {
  initial_stock: 20, initial_pipeline: 10, shipped_spot: 30, shipped_futures: 0,
  lost_transport: 5, in_transit_end: 0, delivered: 35, peer_bought: 2,
  sold: 50, peer_sold: 1, spoiled: 3, closing_stock: 3,
}

/** Twelve different non-zero values, so a band that reads the wrong field is caught. Not a balanced flow, on purpose. */
export const FLOW_DISTINCT: PulqueFlow = {
  initial_stock: 11, initial_pipeline: 12, shipped_spot: 13, shipped_futures: 14,
  lost_transport: 15, in_transit_end: 16, delivered: 17, peer_bought: 18,
  sold: 19, peer_sold: 20, spoiled: 21, closing_stock: 22,
}

/** A flow that does not balance on purpose: delivered 35 is not 30 - 5. */
export const FLOW_UNBALANCED: PulqueFlow = {
  initial_stock: 10, initial_pipeline: 0, shipped_spot: 30, shipped_futures: 0,
  lost_transport: 5, in_transit_end: 0, delivered: 35, peer_bought: 0,
  sold: 40, peer_sold: 0, spoiled: 2, closing_stock: 3,
}

export const FLOW_KEYS = Object.keys(FLOW_EXAMPLE) as Array<keyof PulqueFlow>

/** The 13 bands of section 35 section 3.3, in order. */
export const BAND_TABLE: Array<{ from: string; to: string; field: keyof PulqueFlow }> = [
  { from: 'spot', to: 'shipped', field: 'shipped_spot' },
  { from: 'futures', to: 'shipped', field: 'shipped_futures' },
  { from: 'pipeline', to: 'shipped', field: 'initial_pipeline' },
  { from: 'shipped', to: 'lost', field: 'lost_transport' },
  { from: 'shipped', to: 'in_transit', field: 'in_transit_end' },
  { from: 'shipped', to: 'delivered', field: 'delivered' },
  { from: 'delivered', to: 'cellar', field: 'delivered' },
  { from: 'initial', to: 'cellar', field: 'initial_stock' },
  { from: 'bought', to: 'cellar', field: 'peer_bought' },
  { from: 'cellar', to: 'sold', field: 'sold' },
  { from: 'cellar', to: 'peer_sold', field: 'peer_sold' },
  { from: 'cellar', to: 'spoiled', field: 'spoiled' },
  { from: 'cellar', to: 'left', field: 'closing_stock' },
]

/** The node order of FLOW_NODE_NAMES (the `priority` of each node is its index here). */
export const NODE_ORDER = [
  'spot', 'futures', 'pipeline', 'shipped', 'lost', 'in_transit', 'delivered',
  'initial', 'bought', 'cellar', 'sold', 'peer_sold', 'spoiled', 'left',
] as const

export const NODE_COLUMNS: Record<string, number> = {
  spot: 0, futures: 0, pipeline: 0, shipped: 1,
  lost: 2, in_transit: 2, delivered: 2, initial: 2, bought: 2,
  cellar: 3, sold: 4, peer_sold: 4, spoiled: 4, left: 4,
}

export const NODE_NAMES: Record<string, string> = {
  spot: 'Spot shipments', futures: 'Futures shipments', pipeline: 'On the way at the start',
  shipped: 'Shipped', lost: 'Lost in transit', in_transit: 'Still in transit at the end',
  delivered: 'Delivered', initial: 'Initial stock', bought: 'Bought from pulquerías', cellar: 'Cellar',
  sold: 'Sold to customers', peer_sold: 'Sold to pulquerías', spoiled: 'Spoiled', left: 'Left at the end',
}

/** What the builder must put in `data` for a flow: the table's rows with a value above 0, in order. */
export function expectedBands(f: PulqueFlow): Array<{ from: string; to: string; flow: number }> {
  return BAND_TABLE.filter((b) => f[b.field] > 0).map((b) => ({ from: b.from, to: b.to, flow: f[b.field] }))
}

/** `cumulative` is the server's `series.cumulative_profit`: profit so far after each day, in cents. */
type Profile = { alias: string; name: string; profit: number[]; cumulative: number[]; total: number; fill: number | null; waste: number | null }

/** Section 35 section 4: three pulquerías by rank P2, P1, P3; 3 days, Mon-Wed, multiplier [0.5, 1, 1]. */
export const EXAMPLE_PROFILES: Profile[] = [
  { alias: 'P2', name: 'La Chula', profit: [100.1, 50.2, 30.3], cumulative: [100.1, 150.3, 180.6], total: 200.6, fill: 0.9, waste: 0.1 },
  { alias: 'P1', name: 'Don Agave', profit: [80, -20.5, 60], cumulative: [80, 59.5, 119.5], total: 139.5, fill: 0.8, waste: 0.3 },
  { alias: 'P3', name: 'El Tinacal', profit: [10, 10, 10], cumulative: [10, 20, 30], total: 30, fill: null, waste: 0.2 },
]

/** A minimal view for the builders: only the fields section 35's builders and charts read. */
export function makeSmallView(profiles: Profile[] = EXAMPLE_PROFILES, multipliers = [0.5, 1, 1], flows?: Record<string, PulqueFlow>): ResultsView {
  const weekdays: Weekday[] = ['mon', 'tue', 'wed']
  const players = profiles.map((p, i) => {
    const out: Record<string, unknown> = {
      alias: p.alias, display_name: p.name, rank: i + 1, total_profit: p.total,
      fill_rate: p.fill, waste_rate: p.waste,
      series: { profit: p.profit, cumulative_profit: p.cumulative },
    }
    if (flows?.[p.alias]) out.flow = flows[p.alias]
    return out as unknown as PulqueriaResultView
  })
  return {
    room_code: 'ABC234', days_played: weekdays.length, duration_days: weekdays.length, ended_early: false,
    market: { weekday: weekdays, weekday_multiplier: multipliers },
    players,
  } as unknown as ResultsView
}

/** Per-alias flows for the 14-day fixture of results.ts. */
export const FLOWS_BY_ALIAS: Record<string, PulqueFlow> = {
  P1: FLOW_EXAMPLE,
  P2: { ...FLOW_DISTINCT },
  P3: { ...FLOW_UNBALANCED },
}

/** The 14-day view of results.ts with a `flow` on every pulquería (or on the aliases given). */
export function makeFlowView(aliases: string[] = ['P1', 'P2', 'P3']): ResultsView {
  const view = makeView()
  for (const p of view.players) {
    if (aliases.includes(p.alias)) (p as PulqueriaResultView).flow = FLOWS_BY_ALIAS[p.alias]
  }
  return view
}

/** A `stats.players[alias]` payload fragment carrying `flow`, for the normalisers. */
export function withFlowInStats(
  s: { players: Record<string, Record<string, unknown>> },
  flows: Record<string, unknown> = FLOWS_BY_ALIAS,
): void {
  for (const [alias, flow] of Object.entries(flows)) s.players[alias].flow = flow
}
