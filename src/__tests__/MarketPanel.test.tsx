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
      { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.4 },
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
 * Section 27 - MarketPanel (spec 13.7, 9.3). Acceptance criteria 6, 6b; failure modes 10, 11.
 */

import { describe, expect, it } from 'vitest'

const SPOTS = [12.5, 13, 14.2, 13.4]

function history(last: Parameters<typeof makePublic>[1] = {}) {
  return SPOTS.map((spot, i) => makePublic(i + 1, { spot_price: spot, ...(i === SPOTS.length - 1 ? last : {}) }))
}

function owns() {
  return [310, -25, 140, 420].map((profit, i) => makeRecord(i + 1, { profit }))
}

function market(last: Parameters<typeof makePublic>[1] = {}, extra: Partial<BoardViewProps> = {}) {
  const own = owns()
  return renderBoard({ publicHistory: history(last), ownHistory: own, lastRecord: own[own.length - 1], ...extra })
}

describe('ResultsTable', () => {
  it('shows yesterday from the last public entry with the specified columns', () => {
    market()
    const table = screen.getByRole('table', { name: "Yesterday's market" })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Pulquería', 'Sold', 'Share', 'Reputation'])
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    const chula = rowOf(table, 'La Chula')
    expect(chula.textContent).toContain('30')
    expect(chula.textContent).toMatch(/30(\.0)?%/)
    expect(chula.textContent).toMatch(/0\.70/)
  })

  it('highlights the own row with a You chip and no other row', () => {
    market()
    const table = screen.getByRole('table', { name: "Yesterday's market" })
    const own = rowOf(table, 'Don Agave')
    expect(own.textContent).toContain('You')
    expect(own.className).toMatch(/accent-subtle/)
    expect(rowOf(table, 'La Chula').textContent).not.toContain('You')
    expect(rowOf(table, 'La Chula').className).not.toMatch(/accent-subtle/)
  })
})

describe('Peer market totals line (failure modes 10, 11)', () => {
  it('shows the totals variant with the average price as money', () => {
    market({ peer_units: 18, peer_avg_price: 14.11 })
    const line = screen.getByText('Peer market: 18 units at $14.11 on average')
    const host = line.parentElement as HTMLElement
    expect(line.querySelector('.lucide-arrow-left-right') ?? host.querySelector('.lucide-arrow-left-right')).not.toBeNull()
  })

  it('shows the no-trades variant without any price when there were no trades', () => {
    market({ peer_units: 0, peer_avg_price: null })
    const line = screen.getByText('Peer market: no trades')
    expect(line.textContent).not.toMatch(/\$/)
    expect(screen.queryByText(/Peer market: .*\$0\.00/)).toBeNull()
    expect(screen.queryByText(/units at/)).toBeNull()
  })

  it('is hidden entirely when the peer market is off', () => {
    market({ peer_units: 18, peer_avg_price: 14.11 }, { config: makeConfig(false) })
    expect(screen.queryByText(/Peer market/)).toBeNull()
    expect(screen.queryByText(/14\.11/)).toBeNull()
  })
})

describe('Market charts', () => {
  it('SharePie: one slice per pulquería in alias order, own slice offset', () => {
    market()
    const chart = chartOf('Market share yesterday')
    expect(chart.type).toBe('pie')
    const data = chart.data.datasets[0].data
    expect(data).toHaveLength(3)
    const sum = data.reduce((a, b) => a + b, 0)
    const shares = [0.25, 0.3, 0.2]
    const total = shares.reduce((a, b) => a + b, 0)
    shares.forEach((s, i) => expect(data[i] / sum).toBeCloseTo(s / total, 6))
    const offset = chart.data.datasets[0].offset as number[]
    expect(offset[0]).toBe(10)
    expect(offset[1]).toBe(0)
    expect(offset[2]).toBe(0)
  })

  it('SharePie has a table view', () => {
    market()
    const table = tableOf('Market share yesterday')
    expect(within(table).getByText('La Chula')).toBeInTheDocument()
  })

  it('SpotPriceChart: the spot line over the days played and a dashed base line, no range band', () => {
    market()
    const chart = chartOf('Spot price')
    expect(chart.type).toBe('line')
    expect(chart.data.datasets).toHaveLength(2)
    const spot = chart.data.datasets.find((d) => d.data.some((v) => v !== 12))
    const base = chart.data.datasets.find((d) => d.data.every((v) => v === 12))
    expect(spot?.data).toEqual(SPOTS)
    expect(base?.data).toEqual([12, 12, 12, 12])
    expect(base?.borderDash).toEqual([6, 4])
    expect(spot?.borderDash ?? []).toEqual([])
  })

  it('SpotPriceChart table has Day, Spot and Base', () => {
    market()
    const table = tableOf('Spot price')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Day', 'Spot', 'Base'])
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(rowOf(table, '14.20').textContent).toContain('12.00')
  })

  it('Your profit per day: bars from ownHistory', () => {
    market()
    const chart = chartOf('Your profit per day')
    expect(chart.type).toBe('bar')
    expect(chart.data.datasets[0].data).toEqual([310, -25, 140, 420])
  })
})

describe('Before the first day closes', () => {
  it('shows the empty state instead of tables and charts', () => {
    renderBoard({ publicHistory: [], ownHistory: [] })
    expect(screen.getByText('No results yet')).toBeInTheDocument()
    expect(screen.getByText('They appear after the first day closes.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: "Yesterday's market" })).toBeNull()
    expect(screen.queryByText('Market share yesterday')).toBeNull()
  })
})
