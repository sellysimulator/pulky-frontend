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
 * Section 27 - CellarPanel: LotTable, StockByAgeChart, InTransit, FuturesBook (spec 13.7, 3.5).
 * Acceptance criteria 6, 6a; failure modes 6, 13.
 */

import { describe, expect, it } from 'vitest'

function cellarRows(): string[][] {
  const table = screen.getByRole('table', { name: 'Your lots' })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent ?? ''))
}

describe('CellarPanel header and LotTable', () => {
  it('shows the cellar meta line', () => {
    renderBoard()
    expect(screen.getByText('42 units · backlog 3 · expected demand ~27')).toBeInTheDocument()
  })

  it('has the specified columns', () => {
    renderBoard()
    const table = screen.getByRole('table', { name: 'Your lots' })
    const heads = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(heads).toEqual(['Lot', 'Units', 'Age', 'Quality', 'Risk tonight', 'Last day', 'Expected loss tonight'])
  })

  it('shows one row per cellar lot in the view order, bought lots among them', () => {
    renderBoard({
      view: makeView({
        cellar: [makeLot('L3', 12, 33), makeLot('B5-1', 6, 62), makeLot('L4', 30, 57)],
      }),
    })
    expect(cellarRows().map((r) => r[0])).toEqual(['L3', 'B5-1', 'L4'])
  })

  it('shows quality, risk as 100 minus quality, the label and the last day (worked example)', () => {
    renderBoard({
      view: makeView({ cellar: [makeLot('L3', 12, 33), makeLot('L4', 30, 57, { risk_tonight: 0.4333, expected_loss_tonight: 13 })] }),
    })
    const row = cellarRows().find((r) => r[0].startsWith('L4'))
    expect(row).toBeDefined()
    expect(row![1]).toBe('30')
    expect(row![3]).toContain('57%')
    expect(row![4]).toContain('43%')
    expect(row![4]).toContain('At risk')
    expect(row![5]).toBe('Day 7')
    expect(row![6]).toContain('13')
  })

  it('failure mode 13: quality 57 shows risk 43%, never 44% or 0.43', () => {
    renderBoard({
      view: makeView({ cellar: [makeLot('L4', 30, 57, { risk_tonight: 0.4366 })] }),
    })
    const row = cellarRows()[0]
    expect(row[4]).toContain('43%')
    expect(row[4]).not.toContain('44%')
    expect(row[4]).not.toContain('0.43')
    expect(Number.parseInt(row[3], 10) + Number.parseInt(row[4], 10)).toBe(100)
  })

  it('failure mode 6: a lot at 67% risk says Likely to spoil in words', () => {
    renderBoard({ view: makeView({ cellar: [makeLot('L3', 12, 33)] }) })
    const row = cellarRows()[0]
    expect(row[3]).toContain('33%')
    expect(row[4]).toContain('67%')
    expect(row[4]).toContain('Likely to spoil')
  })

  it('a fresh lot is Safe at 0%', () => {
    renderBoard({ view: makeView({ cellar: [makeLot('L5', 10, 100)] }) })
    const row = cellarRows()[0]
    expect(row[4]).toContain('0%')
    expect(row[4]).toContain('Safe')
  })

  it('marks only conserved lots with the Conserved chip', () => {
    renderBoard({
      view: makeView({ cellar: [makeLot('L3', 12, 33, { conserved: true }), makeLot('L4', 30, 57)] }),
    })
    const rows = cellarRows()
    expect(rows[0][0]).toContain('Conserved')
    expect(rows[1][0]).not.toContain('Conserved')
  })

  it('shows the empty state for an empty cellar', () => {
    renderBoard({ view: makeView({ cellar: [] }) })
    expect(screen.getByText('The cellar is empty')).toBeInTheDocument()
    expect(screen.getByText('Stock arrives with your next delivery.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Your lots' })).toBeNull()
  })
})

const AGES = [
  { age: 1, plain_qty: 30, conserved_qty: 12, plain_risk_tonight: 0.4333, conserved_risk_tonight: 0 },
  { age: 2, plain_qty: 12, conserved_qty: 0, plain_risk_tonight: 0.67, conserved_risk_tonight: null },
  { age: 3, plain_qty: 5, conserved_qty: 0, plain_risk_tonight: 1, conserved_risk_tonight: null },
]

function lines(label: unknown): string[] {
  return Array.isArray(label) ? label.map(String) : String(label).split('\n')
}

describe('StockByAgeChart', () => {
  it('is a ChartBox titled Units by age with plain and conserved stacked bars', () => {
    renderBoard({ view: makeView({ stock_by_age: AGES as never }) })
    const chart = chartOf('Units by age')
    expect(chart.type).toBe('bar')
    expect(chart.data.datasets).toHaveLength(2)
    expect(chart.data.datasets[0].data).toEqual([30, 12, 5])
    expect(chart.data.datasets[1].data).toEqual([12, 0, 0])
    expect(chart.options?.scales?.x?.stacked).toBe(true)
    expect(chart.options?.scales?.y?.stacked).toBe(true)
  })

  it('puts the age and one risk line per stack present in each x tick, with the server average', () => {
    renderBoard({ view: makeView({ stock_by_age: AGES as never }) })
    const labels = (chartOf('Units by age').data.labels ?? []).map(lines)
    expect(labels[0]).toEqual(['1', 'plain 43%', 'conserved 0%'])
    expect(labels[1]).toEqual(['2', 'plain 67%'])
    expect(labels[2]).toEqual(['3', 'plain 100%'])
  })

  it('has a table view with the specified columns and a dash for a null risk', () => {
    renderBoard({ view: makeView({ stock_by_age: AGES as never }) })
    const table = tableOf('Units by age')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Age', 'Plain', 'Conserved', 'Avg risk tonight (plain)', 'Avg risk tonight (conserved)'])
    const age2 = Array.from(rowOf(table, '67%').querySelectorAll('td,th')).map((c) => c.textContent)
    expect(age2[0]).toBe('2')
    expect(age2[3]).toBe('67%')
    expect(age2[4]).toBe('—')
    const age1 = Array.from(rowOf(table, '43%').querySelectorAll('td,th')).map((c) => c.textContent)
    expect(age1[3]).toBe('43%')
    expect(age1[4]).toBe('0%')
  })
})

describe('InTransit and FuturesBook', () => {
  it('lists shipments with Day cells', () => {
    renderBoard({
      view: makeView({
        in_transit: [{ shipped_day: 4, arrives_day: 6, qty: 40, lost: 15, incoterm: 'cip' }],
      }),
    })
    const table = screen.getByRole('table', { name: 'In transit' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Shipped', 'Arrives', 'Units', 'Lost', 'Tier'])
    const cells = Array.from(within(table).getAllByRole('row')[1].querySelectorAll('td,th')).map((c) => c.textContent ?? '')
    expect(cells.slice(0, 4)).toEqual(['Day 4', 'Day 6', '40', '15'])
    expect(cells[4]).toMatch(/cip/i)
    expect(screen.queryByText('Nothing in transit.')).toBeNull()
  })

  it('shows the empty line when nothing is in transit', () => {
    renderBoard()
    expect(screen.getByText('Nothing in transit.')).toBeInTheDocument()
  })

  it('lists open futures with Day cells', () => {
    renderBoard({
      view: makeView({ futures_book: [{ contract_day: 3, ships_day: 8, delivery_day: 9, qty: 25 }] }),
    })
    const table = screen.getByRole('table', { name: 'Futures book' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Bought', 'Ships', 'Delivered', 'Units'])
    const cells = Array.from(within(table).getAllByRole('row')[1].querySelectorAll('td,th')).map((c) => c.textContent)
    expect(cells).toEqual(['Day 3', 'Day 8', 'Day 9', '25'])
    expect(screen.queryByText('No open futures.')).toBeNull()
  })

  it('shows the empty line when there are no open futures', () => {
    renderBoard()
    expect(screen.getByText('No open futures.')).toBeInTheDocument()
  })
})
