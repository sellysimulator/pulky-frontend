import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
    })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

import Board2D, { type BoardViewProps } from '../components/game/views/Board2D'
import type {
  Brief,
  CellarLot,
  Decision,
  DayRecord,
  Participant,
  PlayerView,
  PublicConfig,
  PublicDayResults,
  QualityGuideRow,
  Yesterday,
} from '../types/game'

export const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal', P4: 'Los Magueyes' }

export const PARTICIPANTS: Participant[] = Object.entries(NAMES).map(([alias, display_name]) => ({
  alias,
  display_name,
  connected: true,
}))

export function makeConfig(peer = true): PublicConfig {
  return {
    demand: { retail_price: 30 },
    stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
    peer_market: { enabled: peer },
    transport: { unit_cost: 1 },
  }
}

export function makeLot(id: string, qty: number, quality: number, extra: Partial<CellarLot> = {}): CellarLot {
  return {
    id,
    qty,
    age: 1,
    unit_cost: 12,
    initial_quality: 100,
    conserved: false,
    quality,
    last_day: 7,
    risk_tonight: (100 - quality) / 100,
    expected_loss_tonight: (qty * (100 - quality)) / 100,
    ...extra,
  }
}

function guide(): QualityGuideRow[] {
  const rows: QualityGuideRow[] = []
  for (let q = 100; q >= 0; q -= 5) rows.push({ quality: q, half_spoiled_day: 6, last_day: q === 0 ? 5 : 8 })
  return rows
}

export function makeBrief(over: Partial<Brief> = {}, day = 5): Brief {
  return {
    day,
    duration_days: 14,
    weekday: 'fri',
    weekday_multiplier: 1,
    weekday_multipliers: { mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 },
    expected_demand: 99.6,
    supplier: {
      capacity: 81,
      disrupted: false,
      disruption_message: null,
      spot_price: 13.4,
      base_price: 12,
      lead_time_days: 1,
    },
    spot: { open: true, arrives_day: day + 1 },
    futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
    transport: { shared: false },
    reputation: { P1: 0.62 },
    ...over,
  }
}

export function makeYesterday(over: Partial<Yesterday> = {}): Yesterday {
  return {
    day: 4,
    demand: 311,
    sold: 287,
    backlog_end: 3,
    backlog_change: 3,
    spoiled: 6,
    revenue_salvage: 12,
    reputation: 0.62,
    reputation_change: 0.03,
    profit: 1234,
    cash_end: 6120,
    futures_bought: 25,
    futures_filled: 25,
    futures_vs_spot: 35,
    futures_unfilled: 0,
    refund_futures: 0,
    refrigeration_failure: false,
    lost_transport: 0,
    refund_insurance: 0,
    market_share: 0.25,
    shortfall_spot: 0,
    peer_bought: 10,
    cost_peer: 140,
    peer_sold: 4,
    revenue_peer: 60,
    ...over,
  }
}

export interface ViewOver extends Partial<Omit<PlayerView, 'brief' | 'yesterday'>> {
  brief?: Brief
  yesterday?: Yesterday | null
}

export function makeView(over: ViewOver = {}): PlayerView {
  const day = over.day ?? 5
  const view = {
    full: true,
    alias: 'P1',
    display_name: 'Don Agave',
    day,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    has_submitted: false,
    awaiting: [],
    brief: makeBrief({}, day),
    yesterday: makeYesterday(),
    cellar: [makeLot('L3', 12, 33), makeLot('L4', 30, 57, { risk_tonight: 0.4333 })],
    stock_by_age: [],
    quality_guide: guide(),
    expected_spoil_tonight: 0,
    in_transit: [],
    futures_book: [],
    backlog: 3,
    expected_demand_own: 26.6,
    reputation: 0.62,
    market_share: 0.25,
    cash: 6120,
    cumulative_profit: 0,
    insurance_plans: [
      { tier: 'exw', label: 'EXW', enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
      { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.55 },
    ],
    order_windows: {
      spot_open: true,
      futures_open: true,
      futures_days_left_to_buy: 3,
      futures_message: 'Futures: 3 days left to buy (delivery in 7 days, at $12.00)',
      spot_message: 'Spot open',
    },
    prefill_decision: null,
    final_settlement: null,
    ...over,
  }
  return view as unknown as PlayerView
}

export function makeRecord(day: number, over: Partial<DayRecord> = {}): DayRecord {
  return {
    day,
    weekday: 'fri',
    order_spot: 0,
    order_futures: 0,
    incoterm: 'cip',
    conserve_lots: [],
    lots_conserved: 0,
    cooperate: false,
    peer_buy: null,
    peer_sell: null,
    outlay: 0,
    opening_stock: 0,
    futures_due: 0,
    futures_filled: 0,
    futures_unfilled: 0,
    allocated_spot: 0,
    shortfall_spot: 0,
    shipped: 0,
    lost_transport: 0,
    delivered: 0,
    peer_bought: 0,
    peer_sold: 0,
    peer_trades: [],
    demand: 0,
    backlog_open: 0,
    sold: 0,
    backlog_end: 0,
    spoiled: 0,
    closing_stock: 0,
    revenue_sales: 0,
    revenue_salvage: 0,
    revenue_peer: 0,
    refund_insurance: 0,
    refund_futures: 0,
    cost_spot: 0,
    cost_futures: 0,
    cost_peer: 0,
    cost_transport: 0,
    cost_insurance: 0,
    cost_conservation: 0,
    cost_holding: 0,
    cost_backlog: 0,
    profit: 0,
    cash_open: 0,
    cash_end: 0,
    futures_vs_spot: 0,
    fill: 1,
    waste: 0,
    reputation_open: 0.5,
    reputation_end: 0.5,
    market_share: 0.25,
    refrigeration_failure: false,
    ...over,
  }
}

export function makePublic(day: number, over: Partial<PublicDayResults> = {}): PublicDayResults {
  return {
    day,
    weekday: 'fri',
    demand_total: 400,
    units_sold_total: 380,
    spot_price: 13.4,
    capacity: 81,
    disrupted: false,
    cooperation: false,
    cooperators: 2,
    refrigeration_failure: false,
    peer_units: 0,
    peer_avg_price: null,
    players: {
      P1: { display_name: 'Don Agave', units_sold: 24, market_share: 0.25, reputation: 0.62 },
      P2: { display_name: 'La Chula', units_sold: 30, market_share: 0.3, reputation: 0.7 },
      P3: { display_name: 'El Tinacal', units_sold: 20, market_share: 0.2, reputation: 0.5 },
    },
    ...over,
  }
}

export function makeDecision(day = 5): Decision {
  return {
    day,
    order_spot: 40,
    order_futures: 25,
    incoterm: 'cip',
    conserve_lots: [],
    cooperate: true,
    peer_buy: null,
    peer_sell: null,
  }
}

export function makeProps(over: Partial<BoardViewProps> = {}): BoardViewProps {
  const view = over.view ?? makeView()
  return {
    view,
    ownHistory: [],
    publicHistory: [],
    lastRecord: null,
    locked: false,
    gameOver: false,
    initialDecision: makeDecision(view.day),
    config: makeConfig(true),
    participants: PARTICIPANTS,
    awaiting: [],
    onSubmit: vi.fn(),
    ...over,
  }
}

export function renderBoard(over: Partial<BoardViewProps> = {}) {
  const props = makeProps(over)
  const utils = render(createElement(Board2D, props))
  return { props, ...utils }
}

export interface ChartConfig {
  type: string
  data: {
    labels?: unknown[]
    datasets: Array<{
      label?: string
      type?: string
      data: number[]
      borderDash?: number[]
      offset?: number | number[]
    }>
  }
  options?: { scales?: { x?: { stacked?: boolean }; y?: { stacked?: boolean } } }
}

export function figure(title: string): HTMLElement {
  const found = screen
    .queryAllByText(title)
    .map((el) => el.closest('figure'))
    .find((f): f is HTMLElement => f !== null)
  if (!found) throw new Error(`no ChartBox titled ${title}`)
  return found
}

export function chartOf(title: string): ChartConfig {
  const el = figure(title).querySelector('[data-chart]')
  if (!el) throw new Error(`no chart in ${title}`)
  return JSON.parse(el.getAttribute('data-chart') ?? '{}') as ChartConfig
}

export function tableOf(title: string): HTMLElement {
  const box = figure(title)
  fireEvent.click(within(box).getByRole('button', { name: 'Show table' }))
  return within(box).getByRole('table')
}

/** Text of every StatTile whose label is `label` (label row sits in the tile root). */
export function tileText(label: string): string[] {
  return screen.queryAllByText(label).map((el) => el.parentElement?.parentElement?.textContent ?? '')
}

export function tileRoot(label: string, contains: string): HTMLElement {
  const root = screen
    .queryAllByText(label)
    .map((el) => el.parentElement?.parentElement)
    .find((el): el is HTMLElement => !!el && (el.textContent ?? '').includes(contains))
  if (!root) throw new Error(`no ${label} tile containing ${contains}`)
  return root
}

/** Opens the Recap collapsible and returns queries scoped to it. */
export function openRecap() {
  const summary = screen.getByText('Recap')
  const details = summary.closest('details') as HTMLDetailsElement
  if (!details.hasAttribute('open')) fireEvent.click(summary)
  return within(details)
}

export function rowOf(table: HTMLElement, text: string): HTMLElement {
  const row = within(table)
    .getAllByRole('row')
    .find((r) => (r.textContent ?? '').includes(text))
  if (!row) throw new Error(`no row containing ${text}`)
  return row
}

export function before(a: HTMLElement, b: HTMLElement): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/**
 * Section 27 - YesterdayRecap, YesterdayKpis and DayRecap (spec 13.7, 8.1, 8.4).
 * Acceptance criteria 4, 5, 6b; failure modes 3, 4, 5, 9, 10, 12, 14.
 */

import { describe, expect, it } from 'vitest'

/** The names of section 27 4's worked examples: P3 is La Chula and P4 is El Tinacal. */
const DOC_PEOPLE = [
  { alias: 'P1', display_name: 'Don Agave', connected: true },
  { alias: 'P2', display_name: 'Los Magueyes', connected: true },
  { alias: 'P3', display_name: 'La Chula', connected: true },
  { alias: 'P4', display_name: 'El Tinacal', connected: true },
]

function withRecord(record: Partial<DayRecord>, extra: Partial<BoardViewProps> = {}) {
  const full = makeRecord(4, record)
  return renderBoard({
    ownHistory: [full],
    lastRecord: full,
    publicHistory: [makePublic(4, { spot_price: 13.4 })],
    participants: DOC_PEOPLE,
    ...extra,
  })
}

const SHORT_LINE = 'The supplier was short: 16 of your 40 spot units were not allocated.'
const BUY_BASE: Partial<DayRecord> = {
  order_spot: 40,
  shortfall_spot: 16,
  peer_buy: { max_price: 16, min_quality: 50 },
}
const BUYS = [
  { side: 'buy' as const, counterparty: 'P3', lot_id: 'B5-1', qty: 10, quality: 62, price: 15 },
  { side: 'buy' as const, counterparty: 'P4', lot_id: 'B5-2', qty: 6, quality: 55, price: 13 },
]

const ALL_COVERED = 'You bought all 16 from other pulquerías for $228.00.'
const PART_COVERED = 'You bought 2 from other pulquerías for $26.00; 14 found no offer within your price, quality and cash.'
const NONE_COVERED = 'No pulquería offered units within your price, quality and cash.'

describe('YesterdayRecap', () => {
  it('on day 1 shows the first-day card instead of results', () => {
    renderBoard({ view: makeView({ day: 1, yesterday: null }) })
    expect(screen.getByText("Your first day. Yesterday's results appear here from day 2.")).toBeInTheDocument()
    expect(screen.queryByText('Refrigeration')).toBeNull()
  })

  it('from day 2 hides the first-day card', () => {
    renderBoard()
    expect(screen.queryByText(/Your first day/)).toBeNull()
  })

  it('shows the KPI tiles from view.yesterday', () => {
    renderBoard()
    expect(tileText('Demand').some((t) => t.includes('311'))).toBe(true)
    expect(tileText('Sold').some((t) => t.includes('287'))).toBe(true)
    expect(tileText('Backlog').some((t) => t.includes('3'))).toBe(true)
    expect(tileText('Spoiled').some((t) => t.includes('6'))).toBe(true)
    expect(tileText('Profit').some((t) => t.includes('$1,234.00'))).toBe(true)
  })

  it('failure mode 14: Sold is customer sales only, never sold plus peer sold', () => {
    renderBoard({ view: makeView({ yesterday: makeYesterday({ sold: 287, peer_sold: 13 }) }) })
    expect(tileText('Sold').some((t) => t.includes('287'))).toBe(true)
    expect(tileText('Sold').some((t) => t.includes('300'))).toBe(false)
  })

  it('colours the backlog delta bad when up and good when down', () => {
    const { unmount } = renderBoard({ view: makeView({ yesterday: makeYesterday({ backlog_end: 3, backlog_change: 3 }) }) })
    expect(tileRoot('Backlog', '3').querySelector('.text-danger-ink')).not.toBeNull()
    expect(tileRoot('Backlog', '3').querySelector('.text-success-ink')).toBeNull()
    unmount()
    renderBoard({ view: makeView({ yesterday: makeYesterday({ backlog_end: 1, backlog_change: -2 }) }) })
    expect(tileRoot('Backlog', '1').querySelector('.text-success-ink')).not.toBeNull()
    expect(tileRoot('Backlog', '1').querySelector('.text-danger-ink')).toBeNull()
  })

  it('shows salvage under Spoiled only when it is above zero', () => {
    const { unmount } = renderBoard()
    expect(tileText('Spoiled').some((t) => t.includes('salvaged $12.00'))).toBe(true)
    unmount()
    renderBoard({ view: makeView({ yesterday: makeYesterday({ spoiled: 6, revenue_salvage: 0 }) }) })
    expect(tileText('Spoiled').some((t) => /salvaged/.test(t))).toBe(false)
  })

  it('shows refrigeration OK or Failed', () => {
    const { unmount } = renderBoard()
    expect(tileText('Refrigeration').some((t) => t.includes('OK'))).toBe(true)
    unmount()
    renderBoard({ view: makeView({ yesterday: makeYesterday({ refrigeration_failure: true }) }) })
    const t = tileText('Refrigeration')
    expect(t.some((x) => x.includes('Failed'))).toBe(true)
    expect(document.querySelector('.lucide-thermometer-sun')).not.toBeNull()
  })

  it('shows the Peer market tile only when the peer market is on, from view.yesterday', () => {
    const { unmount } = renderBoard()
    expect(tileText('Peer market').some((t) => t.includes('bought 10 · sold 4') && t.includes('paid $140.00 · earned $60.00'))).toBe(true)
    unmount()
    renderBoard({ config: makeConfig(false) })
    expect(screen.queryByText(/Peer market/)).toBeNull()
  })

  it('has a Recap collapsible that is closed by default and opens on click', () => {
    withRecord({})
    const summary = screen.getByText('Recap')
    const details = summary.closest('details') as HTMLDetailsElement
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(summary)
    expect(details).toHaveAttribute('open')
  })
})

describe('DayRecap events', () => {
  it('shows no event for a record where no condition holds, but keeps the ledger', () => {
    withRecord({})
    const recap = openRecap()
    expect(recap.queryByText(/Futures shipped/)).toBeNull()
    expect(recap.queryByText(/supplier was short/)).toBeNull()
    expect(recap.queryByText(/Refrigeration failed/)).toBeNull()
    expect(recap.queryByText(/Insurance refund for units/)).toBeNull()
    expect(recap.queryByText(/spoiled overnight/)).toBeNull()
    expect(recap.queryByText(/went into backlog/)).toBeNull()
    expect(recap.queryByText(/You sold/)).toBeNull()
    expect(recap.queryByText(/You bought/)).toBeNull()
    expect(recap.getByRole('table', { name: 'Ledger' })).toBeInTheDocument()
  })

  it('1: futures shipped with the saving', () => {
    withRecord({ futures_due: 25, futures_filled: 25, futures_vs_spot: 35 })
    expect(openRecap().getByText('Futures shipped 25 units at $12.00 — spot was $13.40, you saved $35.00.')).toBeInTheDocument()
  })

  it('1 (failure mode 4): a negative saving reads as a cost, never as a saving', () => {
    withRecord(
      { futures_due: 25, futures_filled: 25, futures_vs_spot: -15 },
      { publicHistory: [makePublic(4, { spot_price: 11.4 })] },
    )
    const recap = openRecap()
    expect(recap.getByText('Futures shipped 25 units at $12.00 — spot was $11.40, they cost $15.00 more.')).toBeInTheDocument()
    expect(recap.queryByText(/you saved/)).toBeNull()
    expect(recap.queryByText(/-\$15|−\$15/)).toBeNull()
  })

  it('1: no futures event when nothing shipped', () => {
    withRecord({ futures_filled: 0, futures_vs_spot: 0 })
    expect(openRecap().queryByText(/Futures shipped/)).toBeNull()
  })

  it('2: an unfilled futures contract reports the fill percentage and the refund', () => {
    withRecord({ futures_due: 30, futures_filled: 24, futures_unfilled: 6, refund_futures: 72 })
    expect(
      openRecap().getByText(
        'The supplier was short: your futures filled 80%; 6 units cancelled and refunded ($72.00).',
      ),
    ).toBeInTheDocument()
  })

  it('3: refrigeration failure, shipping alone or sharing the truck', () => {
    const { unmount } = withRecord({ lost_transport: 15, refrigeration_failure: true })
    expect(openRecap().getByText('Refrigeration failed: you lost 15 units (shipping alone).')).toBeInTheDocument()
    unmount()
    const brief = makeBrief()
    brief.transport.shared = true
    withRecord({ lost_transport: 15, refrigeration_failure: true }, { view: makeView({ brief }) })
    expect(openRecap().getByText('Refrigeration failed: you lost 15 units (sharing the truck).')).toBeInTheDocument()
  })

  it('3 (failure mode 3): no refrigeration event when lost_transport is 0, even if the flag is set', () => {
    withRecord({ lost_transport: 0, refrigeration_failure: true })
    expect(openRecap().queryByText(/Refrigeration failed/)).toBeNull()
  })

  it('4: insurance refund', () => {
    withRecord({ refund_insurance: 450 })
    expect(openRecap().getByText('Insurance refund for units lost in transit: $450.00.')).toBeInTheDocument()
  })

  it('5: spoiled units with salvage', () => {
    withRecord({ spoiled: 6, revenue_salvage: 12 })
    expect(openRecap().getByText('6 units spoiled overnight → salvaged for $12.00.')).toBeInTheDocument()
  })

  it('5 (failure mode 5): salvage price 0 drops the salvage clause', () => {
    renderBoard({
      view: makeView({ yesterday: makeYesterday({ spoiled: 6, revenue_salvage: 0 }) }),
      lastRecord: makeRecord(4, { spoiled: 6, revenue_salvage: 0 }),
      ownHistory: [makeRecord(4, { spoiled: 6, revenue_salvage: 0 })],
      publicHistory: [makePublic(4)],
    })
    expect(openRecap().getByText('6 units spoiled overnight.')).toBeInTheDocument()
    expect(screen.queryByText(/salvaged/)).toBeNull()
  })

  it('6: backlog with its penalty', () => {
    withRecord({ backlog_end: 3, cost_backlog: 4.5 })
    expect(
      openRecap().getByText('3 units of demand went into backlog (−$4.50 penalty; reputation ▼).'),
    ).toBeInTheDocument()
  })

  it('7: supplier short, all covered, with one sub-line per buy trade in record order and names not aliases', () => {
    withRecord({ ...BUY_BASE, peer_bought: 16, cost_peer: 228, peer_trades: BUYS })
    const recap = openRecap()
    expect(recap.getByText(SHORT_LINE)).toBeInTheDocument()
    expect(recap.getByText(ALL_COVERED)).toBeInTheDocument()
    const first = recap.getByText('10 from La Chula at $15.00 (62%)')
    const second = recap.getByText('6 from El Tinacal at $13.00 (55%)')
    expect(before(first, second)).toBe(true)
    expect(recap.queryByText(PART_COVERED)).toBeNull()
    expect(recap.queryByText(NONE_COVERED)).toBeNull()
  })

  it('7 (failure mode 9): the counterparty is shown by display name, never as its alias', () => {
    withRecord({ ...BUY_BASE, peer_bought: 16, cost_peer: 228, peer_trades: BUYS })
    expect(screen.queryByText(/from P3/)).toBeNull()
    expect(screen.queryByText(/from P4/)).toBeNull()
    expect(openRecap().getByText(/from La Chula/)).toBeInTheDocument()
  })

  it('7: an unknown counterparty alias is shown as the alias', () => {
    const odd = DOC_PEOPLE.filter((p) => p.alias !== 'P3')
    withRecord(
      { ...BUY_BASE, peer_bought: 10, cost_peer: 150, peer_trades: [BUYS[0]] },
      { participants: odd },
    )
    expect(openRecap().getByText(/10 from P3 at \$15\.00 \(62%\)/)).toBeInTheDocument()
  })

  it('7 (failure mode 12): part covered gives the remaining count and only that variant', () => {
    withRecord({
      ...BUY_BASE,
      peer_bought: 2,
      cost_peer: 26,
      peer_trades: [{ side: 'buy', counterparty: 'P3', lot_id: 'B5-1', qty: 2, quality: 62, price: 13 }],
    })
    const recap = openRecap()
    expect(recap.getByText(PART_COVERED)).toBeInTheDocument()
    expect(recap.queryByText(ALL_COVERED)).toBeNull()
    expect(recap.queryByText(NONE_COVERED)).toBeNull()
    expect(recap.getByText('2 from La Chula at $13.00 (62%)')).toBeInTheDocument()
  })

  it('7 (failure mode 12): none covered gives the none line and no sub-lines', () => {
    withRecord({ ...BUY_BASE, peer_bought: 0, cost_peer: 0, peer_trades: [] })
    const recap = openRecap()
    expect(recap.getByText(SHORT_LINE)).toBeInTheDocument()
    expect(recap.getByText(NONE_COVERED)).toBeInTheDocument()
    expect(recap.queryByText(ALL_COVERED)).toBeNull()
    expect(recap.queryByText(PART_COVERED)).toBeNull()
    expect(recap.queryByText(/ from /)).toBeNull()
  })

  it('7 (failure mode 12): with no buy limits only the supplier-short line shows', () => {
    withRecord({ ...BUY_BASE, peer_buy: null, peer_bought: 0, peer_trades: [] })
    const recap = openRecap()
    expect(recap.getByText(SHORT_LINE)).toBeInTheDocument()
    expect(recap.queryByText(ALL_COVERED)).toBeNull()
    expect(recap.queryByText(PART_COVERED)).toBeNull()
    expect(recap.queryByText(NONE_COVERED)).toBeNull()
  })

  it('7 (failure mode 10): a short spot order is still reported with the peer market off', () => {
    withRecord(
      { order_spot: 30, shortfall_spot: 5, peer_buy: null },
      { config: makeConfig(false) },
    )
    expect(openRecap().getByText('The supplier was short: 5 of your 30 spot units were not allocated.')).toBeInTheDocument()
    expect(screen.queryByText(/Peer market/)).toBeNull()
    expect(screen.queryByText(/You bought/)).toBeNull()
  })

  it('7: no supplier-short line when nothing was short', () => {
    withRecord({ order_spot: 30, shortfall_spot: 0 })
    expect(openRecap().queryByText(/spot units were not allocated/)).toBeNull()
  })

  it('8: peer sales with one sub-line per sell trade', () => {
    withRecord({
      peer_sold: 10,
      revenue_peer: 150,
      peer_trades: [{ side: 'sell', counterparty: 'P1', lot_id: 'L4', qty: 10, quality: 62, price: 15 }],
    })
    const recap = openRecap()
    expect(recap.getByText('You sold 10 units to other pulquerías for $150.00.')).toBeInTheDocument()
    expect(recap.getByText('10 to Don Agave at $15.00 (62%)')).toBeInTheDocument()
  })

  it('8: buy and sell trades do not leak into each other', () => {
    withRecord({
      ...BUY_BASE,
      peer_bought: 10,
      cost_peer: 150,
      peer_sold: 4,
      revenue_peer: 60,
      peer_trades: [
        BUYS[0],
        { side: 'sell', counterparty: 'P3', lot_id: 'L2', qty: 4, quality: 40, price: 15 },
      ],
    })
    const recap = openRecap()
    expect(recap.getByText('10 from La Chula at $15.00 (62%)')).toBeInTheDocument()
    expect(recap.getByText('4 to La Chula at $15.00 (40%)')).toBeInTheDocument()
    expect(recap.queryByText('4 from La Chula at $15.00 (40%)')).toBeNull()
    expect(recap.queryByText('10 to La Chula at $15.00 (62%)')).toBeNull()
  })

  it('emits the events in the specified order', () => {
    withRecord({
      futures_due: 30,
      futures_filled: 24,
      futures_unfilled: 6,
      refund_futures: 72,
      futures_vs_spot: 33.6,
      lost_transport: 15,
      refund_insurance: 450,
      spoiled: 6,
      revenue_salvage: 12,
      backlog_end: 3,
      cost_backlog: 4.5,
      ...BUY_BASE,
      peer_bought: 16,
      cost_peer: 228,
      peer_sold: 10,
      revenue_peer: 150,
      peer_trades: [...BUYS, { side: 'sell', counterparty: 'P1', lot_id: 'L4', qty: 10, quality: 62, price: 15 }],
    })
    const recap = openRecap()
    const lines = [
      recap.getByText(/^Futures shipped 24 units/),
      recap.getByText(/your futures filled 80%/),
      recap.getByText(/^Refrigeration failed/),
      recap.getByText(/^Insurance refund for units/),
      recap.getByText(/units spoiled overnight/),
      recap.getByText(/went into backlog/),
      recap.getByText(SHORT_LINE),
      recap.getByText(ALL_COVERED),
      recap.getByText(/^You sold 10 units/),
    ]
    for (let i = 0; i < lines.length - 1; i++) expect(before(lines[i], lines[i + 1])).toBe(true)
  })
})

describe('Ledger (spec 8.1)', () => {
  const LEDGER = {
    revenue_sales: 720,
    revenue_salvage: 12,
    revenue_peer: 60,
    refund_insurance: 5,
    refund_futures: 72,
    cost_spot: 536,
    cost_futures: 300,
    cost_peer: 140,
    cost_transport: 40,
    cost_insurance: 16,
    cost_conservation: 12,
    cost_holding: 20,
    cost_backlog: 4.5,
    profit: 311.5,
    cash_end: 6431.5,
  }

  it('shows the fifteen lines in spec order, costs as negative values', () => {
    withRecord(LEDGER)
    const table = openRecap().getByRole('table', { name: 'Ledger' })
    const rows = within(table).getAllByRole('row').slice(1)
    const cells = rows.map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent))
    expect(cells).toEqual([
      ['Sales', '$720.00'],
      ['Salvage', '$12.00'],
      ['Peer sales', '$60.00'],
      ['Insurance refunds', '$5.00'],
      ['Futures refunds', '$72.00'],
      ['Spot purchases', '−$536.00'],
      ['Futures bought', '−$300.00'],
      ['Peer purchases', '−$140.00'],
      ['Transport', '−$40.00'],
      ['Insurance fees', '−$16.00'],
      ['Conservation', '−$12.00'],
      ['Holding cost', '−$20.00'],
      ['Backlog penalty', '−$4.50'],
      ['Profit', '$311.50'],
      ['Cash at day end', '$6,431.50'],
    ])
  })

  it('shows every line even when it is zero', () => {
    withRecord({})
    const table = openRecap().getByRole('table', { name: 'Ledger' })
    expect(within(table).getAllByRole('row')).toHaveLength(16)
  })
})
