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
    days_left: 3, // through day 7, from day 5
    last_day: 7,
    risk_tonight: (100 - quality) / 100,
    expected_loss_tonight: (qty * (100 - quality)) / 100,
    conservation_cost: extra.conserved === true ? null : qty, // $1.00 a unit
    ...extra,
  }
}

function guide(): QualityGuideRow[] {
  const rows: QualityGuideRow[] = []
  for (let q = 100; q >= 0; q -= 5) rows.push({ quality: q, half_spoiled_day: 6, days_left: q === 0 ? 1 : 4, last_day: q === 0 ? 5 : 8 })
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
      disrupted: false,
      disruption_message: null,
      spot_price: 13.4,
      base_price: 12,
      lead_time_days: 1,
    },
    spot: { open: true, arrives_day: day + 1, arrives_weekday: (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)[day % 7] },
    futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, delivery_weekday: 'fri', last_day_to_buy: 7, days_left_to_buy: 3 },
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
    tier_plans: [
      { tier: 'exw', label: 'EXW', enabled: true, refund_basis: 'none', refund_value_today: null, refund_shipment: null, fee_per_unit: 0 },
      { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, refund_shipment: null, fee_per_unit: 0.55 },
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
    incoterm_tier: 'cip',
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
    incoterm_tier: 'cip',
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
 * Section 27 - DetailsPanel (spec 13.7, D40). Acceptance criteria 6, 6b, 7.
 * Charts are mocked (no canvas in jsdom); assertions are on the configuration a chart receives
 * and on its table view.
 */

import { describe, expect, it } from 'vitest'
import { act } from '@testing-library/react'
import { beforeEach } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { getUiFlag, setUiFlag } from '../utils/storage'

const OWN = [
  makeRecord(1, {
    closing_stock: 40, backlog_end: 3, sold: 20, spoiled: 2, cooperate: true, reputation_end: 0.5,
    cost_spot: 100, cost_peer: 10, cost_futures: 50, cost_transport: 5, cost_insurance: 1, cost_conservation: 2,
    cost_holding: 4, cost_backlog: 6, revenue_sales: 600, revenue_peer: 30, refund_insurance: 0,
  }),
  makeRecord(2, {
    closing_stock: 55, backlog_end: 0, sold: 35, spoiled: 6, cooperate: false, reputation_end: 0.55,
    cost_spot: 200, cost_peer: 0, cost_futures: 60, cost_transport: 7, cost_insurance: 2, cost_conservation: 0,
    cost_holding: 5, cost_backlog: 0, revenue_sales: 900, revenue_peer: 0, refund_insurance: 5,
  }),
  makeRecord(3, {
    closing_stock: 30, backlog_end: 8, sold: 28, spoiled: 0, cooperate: true, reputation_end: 0.6,
    cost_spot: 300, cost_peer: 20, cost_futures: 70, cost_transport: 9, cost_insurance: 3, cost_conservation: 1,
    cost_holding: 3, cost_backlog: 12, revenue_sales: 800, revenue_peer: 45, refund_insurance: 0,
  }),
]

function pubDay(day: number, cooperators: number, reps: [number, number, number]) {
  return makePublic(day, {
    cooperators,
    players: {
      P1: { display_name: 'Don Agave', units_sold: 24, market_share: 0.25, reputation: reps[0] },
      P2: { display_name: 'La Chula', units_sold: 30, market_share: 0.3, reputation: reps[1] },
      P3: { display_name: 'El Tinacal', units_sold: 20, market_share: 0.2, reputation: reps[2] },
    },
  })
}

const PUBLIC = [pubDay(1, 2, [0.5, 0.7, 0.6]), pubDay(2, 1, [0.55, 0.65, 0.45]), pubDay(3, 3, [0.6, 0.9, 0.3])]

function details(extra: Partial<BoardViewProps> = {}) {
  return renderBoard({ ownHistory: OWN, lastRecord: OWN[2], publicHistory: PUBLIC, ...extra })
}

const showTrend = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Trend' }))
}

const detailsEl = () => screen.getByText('Details').closest('details') as HTMLDetailsElement

const sets = (title: string) => chartOf(title).data.datasets.map((d) => d.data.map((v) => v + 0))
const byLabel = (title: string, label: string) => chartOf(title).data.datasets.find((d) => d.label === label)

describe('DetailsPanel collapse (acceptance 7)', () => {
  it('is closed by default', () => {
    details()
    expect(detailsEl()).not.toHaveAttribute('open')
  })

  it('opens on click and remembers the state', () => {
    const { unmount } = details()
    fireEvent.click(screen.getByText('Details'))
    expect(detailsEl()).toHaveAttribute('open')
    expect(getUiFlag('details_open')).toBe(true)
    unmount()
    details()
    expect(detailsEl()).toHaveAttribute('open')
  })

  it('starts open when the flag was stored, and closing clears it', () => {
    setUiFlag('details_open', true)
    details()
    expect(detailsEl()).toHaveAttribute('open')
    fireEvent.click(screen.getByText('Details'))
    expect(detailsEl()).not.toHaveAttribute('open')
    expect(getUiFlag('details_open')).toBe(false)
  })
})

describe('DetailsPanel contents', () => {
  it('lists the charts in the specified order and ends with the last day ledger', () => {
    details()
    showTrend()
    const titles = [
      'Inventory vs backlog',
      'Equal supply votes',
      'Costs per day',
      'Sold vs spoiled',
      'Reputation',
      'Insurance: fees vs refunds',
    ].map(figure)
    for (let i = 0; i < titles.length - 1; i++) expect(before(titles[i], titles[i + 1])).toBe(true)
    const ledgerTitle = within(detailsEl()).getByText("Last day's ledger")
    expect(before(titles[titles.length - 1], ledgerTitle)).toBe(true)
    const tables = within(detailsEl()).getAllByRole('table', { name: 'Ledger' })
    expect(tables).toHaveLength(1)
    expect(before(ledgerTitle, tables[0])).toBe(true)
  })

  it('every chart sits in a ChartBox that can switch to a table', () => {
    details()
    showTrend()
    for (const title of [
      'Inventory vs backlog',
      'Equal supply votes',
      'Costs per day',
      'Sold vs spoiled',
      'Reputation',
      'Insurance: fees vs refunds',
    ]) {
      expect(within(tableOf(title)).getAllByRole('row').length).toBeGreaterThan(1)
    }
  })

  it('last day ledger is the ledger of lastRecord', () => {
    details()
    const table = within(detailsEl()).getByRole('table', { name: 'Ledger' })
    expect(rowOf(table, 'Spot purchases').textContent).toContain('−$300.00')
    expect(rowOf(table, 'Sales').textContent).toContain('$800.00')
  })

  it('Inventory vs backlog: closing stock above zero, backlog below zero', () => {
    details()
    const data = sets('Inventory vs backlog')
    expect(data).toContainEqual([40, 55, 30])
    expect(data).toContainEqual([-3, 0, -8])
  })

  it('Equal supply votes: votes for and against stacked per day, and the own vote marked on its side', () => {
    details()
    expect(chartOf('Equal supply votes').data.datasets.map((d) => d.label)).toEqual([
      'Voted for equal supply',
      'Voted against',
      'Your vote',
    ])
    expect(byLabel('Equal supply votes', 'Voted for equal supply')?.data).toEqual([2, 1, 3])
    expect(byLabel('Equal supply votes', 'Voted against')?.data).toEqual([1, 2, 0])
    // For on day 1 (middle of 2 for), against on day 2 (middle of 2 against above 1 for), for on day 3.
    expect(byLabel('Equal supply votes', 'Your vote')?.data).toEqual([1, 2, 1.5])
  })

  it('Equal supply votes: a day nobody voted for still shows the against bar and the own vote', () => {
    details({ ownHistory: [makeRecord(1, { cooperate: false })], publicHistory: [pubDay(1, 0, [0.5, 0.5, 0.5])] })
    expect(byLabel('Equal supply votes', 'Voted for equal supply')?.data).toEqual([0])
    expect(byLabel('Equal supply votes', 'Voted against')?.data).toEqual([3])
    expect(byLabel('Equal supply votes', 'Your vote')?.data).toEqual([1.5])
    const vote = within(tableOf('Equal supply votes')).getAllByRole('row')[1]
    expect(vote.textContent).toContain('Against')
  })

  it('Costs per day carries the eight cost segments and the two revenue lines, in order', () => {
    details()
    showTrend()
    const chart = chartOf('Costs per day')
    expect(chart.data.datasets.map((d) => d.label)).toEqual([
      'Spot',
      'Peer purchases',
      'Futures',
      'Transport',
      'Insurance fees',
      'Conservation',
      'Holding cost',
      'Backlog penalty',
      'Sales revenue',
      'Peer sales revenue',
    ])
    expect(byLabel('Costs per day', 'Spot')?.data).toEqual([100, 200, 300])
    expect(byLabel('Costs per day', 'Peer purchases')?.data).toEqual([10, 0, 20])
    expect(byLabel('Costs per day', 'Futures')?.data).toEqual([50, 60, 70])
    expect(byLabel('Costs per day', 'Transport')?.data).toEqual([5, 7, 9])
    expect(byLabel('Costs per day', 'Insurance fees')?.data).toEqual([1, 2, 3])
    expect(byLabel('Costs per day', 'Conservation')?.data).toEqual([2, 0, 1])
    expect(byLabel('Costs per day', 'Holding cost')?.data).toEqual([4, 5, 3])
    expect(byLabel('Costs per day', 'Backlog penalty')?.data).toEqual([6, 0, 12])
    expect(byLabel('Costs per day', 'Sales revenue')?.data).toEqual([600, 900, 800])
    expect(byLabel('Costs per day', 'Peer sales revenue')?.data).toEqual([30, 0, 45])
    expect(byLabel('Costs per day', 'Sales revenue')?.type).toBe('line')
    expect(byLabel('Costs per day', 'Peer sales revenue')?.type).toBe('line')
  })

  it('Costs per day table has a Day column and one column per dataset', () => {
    details()
    showTrend()
    const table = tableOf('Costs per day')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      'Day',
      'Spot',
      'Peer purchases',
      'Futures',
      'Transport',
      'Insurance fees',
      'Conservation',
      'Holding cost',
      'Backlog penalty',
      'Sales revenue',
      'Peer sales revenue',
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(4)
  })

  it('Sold vs spoiled: both series from the own history', () => {
    details()
    const data = sets('Sold vs spoiled')
    expect(data).toContainEqual([20, 35, 28])
    expect(data).toContainEqual([2, 6, 0])
  })

  it('Reputation: yours against the market average of the public reputations', () => {
    details()
    const data = sets('Reputation')
    expect(data).toContainEqual([0.5, 0.55, 0.6])
    const averages = [(0.5 + 0.7 + 0.6) / 3, (0.55 + 0.65 + 0.45) / 3, (0.6 + 0.9 + 0.3) / 3]
    const market = data.find((d) => d.length === 3 && Math.abs(d[0] - averages[0]) < 1e-6)
    expect(market).toBeDefined()
    averages.forEach((a, i) => expect(market![i]).toBeCloseTo(a, 6))
  })

  it('Insurance: fees and refunds are running totals', () => {
    details()
    const data = sets('Insurance: fees vs refunds')
    expect(data).toContainEqual([1, 3, 6])
    expect(data).toContainEqual([0, 5, 5])
  })

  it('shows the peer purchases and peer sales series when the peer market is on', () => {
    details({ config: makeConfig(true) })
    showTrend()
    expect(byLabel('Costs per day', 'Peer purchases')).toBeDefined()
    expect(byLabel('Costs per day', 'Peer sales revenue')).toBeDefined()
  })
})

// ── Section 36: ledger / trend, opening on a choice, one crosshair ──

beforeEach(() => {
  useGameStore.getState().reset()
})

const pressed = (name: string): boolean => screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true'
const choose = (day: number | null): void => {
  act(() => useGameStore.getState().selectDay(day))
}
const DAY_TITLE = (d: number): string => `Day ${d}: where the profit came from`

describe('Ledger / Trend (acceptance 5)', () => {
  it('offers a Costs control with Ledger first and pressed', () => {
    details()
    const group = screen.getByRole('group', { name: 'Costs' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ledger', 'Trend'])
    expect(pressed('Ledger')).toBe(true)
    expect(pressed('Trend')).toBe(false)
  })

  it('shows the ledger of the last record, and not Costs per day, by default', () => {
    details()
    expect(screen.getByText(DAY_TITLE(3))).toBeInTheDocument()
    expect(screen.queryByText('Costs per day')).toBeNull()
    expect(chartOf(DAY_TITLE(3)).data.datasets[0].data[0]).toEqual([0, 800])
  })

  it('shows the ledger of the selected day when it was played, else the last record', () => {
    details()
    choose(2)
    expect(screen.getByText(DAY_TITLE(2))).toBeInTheDocument()
    expect(screen.queryByText(DAY_TITLE(3))).toBeNull()
    expect(chartOf(DAY_TITLE(2)).data.datasets[0].data[0]).toEqual([0, 900])
    choose(40)
    expect(screen.getByText(DAY_TITLE(3))).toBeInTheDocument()
  })

  it('keeps Costs per day reachable through Trend, in place of the ledger', () => {
    details()
    showTrend()
    expect(pressed('Trend')).toBe(true)
    expect(screen.getByText('Costs per day')).toBeInTheDocument()
    expect(screen.queryByText(DAY_TITLE(3))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ledger' }))
    expect(screen.getByText(DAY_TITLE(3))).toBeInTheDocument()
    expect(screen.queryByText('Costs per day')).toBeNull()
  })

  it('shows neither with no records', () => {
    details({ ownHistory: [], lastRecord: null, publicHistory: [] })
    expect(screen.queryByText('Costs per day')).toBeNull()
    expect(screen.queryByText(/where the profit came from/)).toBeNull()
    expect(screen.queryByRole('group', { name: 'Costs' })).toBeNull()
  })

  it('still ends with the last day ledger', () => {
    details()
    expect(within(detailsEl()).getByText("Last day's ledger")).toBeInTheDocument()
  })
})

describe('Opening on a choice (acceptance 6; failure mode 5)', () => {
  it('does not open on its first render when a day is already selected', () => {
    useGameStore.setState({ selectedDay: 2 })
    details()
    expect(detailsEl()).not.toHaveAttribute('open')
    expect(getUiFlag('details_open')).toBe(false)
  })

  it('opens, remembers it and shows the Ledger of that day when a day is chosen while mounted', () => {
    details()
    expect(detailsEl()).not.toHaveAttribute('open')
    choose(2)
    expect(detailsEl()).toHaveAttribute('open')
    expect(getUiFlag('details_open')).toBe(true)
    expect(pressed('Ledger')).toBe(true)
    expect(screen.getByText(DAY_TITLE(2))).toBeInTheDocument()
  })

  it('switches Trend back to Ledger when a day is chosen', () => {
    details()
    showTrend()
    choose(1)
    expect(pressed('Ledger')).toBe(true)
    expect(screen.getByText(DAY_TITLE(1))).toBeInTheDocument()
    expect(screen.queryByText('Costs per day')).toBeNull()
  })

  it('reopens after the player closed it, on the next choice', () => {
    details()
    choose(1)
    fireEvent.click(screen.getByText('Details'))
    expect(detailsEl()).not.toHaveAttribute('open')
    choose(2)
    expect(detailsEl()).toHaveAttribute('open')
  })

  it('does not open when the selection is cleared', () => {
    details()
    choose(1)
    fireEvent.click(screen.getByText('Details'))
    choose(null)
    expect(detailsEl()).not.toHaveAttribute('open')
  })
})

describe('One crosshair (acceptance 7)', () => {
  const SIX = [
    'Inventory vs backlog',
    'Equal supply votes',
    'Costs per day',
    'Sold vs spoiled',
    'Reputation',
    'Insurance: fees vs refunds',
  ]
  const groupOf = (title: string): unknown =>
    (chartOf(title) as unknown as { options?: { plugins?: { crosshairSync?: { group?: unknown } } } }).options?.plugins?.crosshairSync?.group

  it('gives the six day-axis charts the same group', () => {
    details()
    showTrend()
    const groups = SIX.map(groupOf)
    expect(typeof groups[0]).toBe('string')
    expect(groups[0]).not.toBe('')
    for (const g of groups) expect(g).toBe(groups[0])
  })

  it('keeps the options the charts already had', () => {
    details()
    showTrend()
    expect(chartOf('Inventory vs backlog').options?.scales?.x?.stacked).toBe(true)
    expect(chartOf('Costs per day').options?.scales?.y?.stacked).toBe(true)
  })

  it('gives a chart outside Details no group', () => {
    details()
    expect(groupOf('Spot price')).toBeUndefined()
    expect(groupOf('Your profit per day')).toBeUndefined()
    expect(groupOf('Market share yesterday')).toBeUndefined()
  })
})
