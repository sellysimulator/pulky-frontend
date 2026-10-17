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
    tier_plans: [
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
 * Section 27 - DayStats (spec 13.7, 4.2). Acceptance criteria 2, 3.
 * Rendered through Board2D, which is the public surface.
 */

import { describe, expect, it } from 'vitest'

describe('DayStats tiles', () => {
  it('shows day, weekday multiplier, demand, spot, reputation and cash from the brief and view', () => {
    renderBoard()
    expect(tileText('Day').some((t) => t.includes('5/14') && /Fri\w* · weekday ×1\.00/.test(t))).toBe(true)
    expect(tileText('Market demand').some((t) => t.includes('~100') && t.includes('~27 yours'))).toBe(true)
    expect(tileText('Spot price').some((t) => t.includes('$13.40') && t.includes('base $12.00'))).toBe(true)
    expect(tileText('Reputation').some((t) => t.includes('0.62'))).toBe(true)
    expect(tileText('Cash').some((t) => t.includes('$6,120.00'))).toBe(true)
  })

  it('rounds expected demand to whole units', () => {
    renderBoard({
      view: makeView({ brief: makeBrief({ expected_demand: 100.4 }), expected_demand_own: 27.4 }),
    })
    expect(tileText('Market demand').some((t) => t.includes('~100') && !t.includes('100.4') && t.includes('~27 yours'))).toBe(true)
  })

  it('shows the weekday multiplier with two decimals', () => {
    renderBoard({ view: makeView({ brief: makeBrief({ weekday: 'mon', weekday_multiplier: 0.25 }) }) })
    expect(tileText('Day').some((t) => /weekday ×0\.25/.test(t))).toBe(true)
  })

  it('shows the reputation change from yesterday as a delta, up or down', () => {
    const { unmount } = renderBoard({ view: makeView({ yesterday: makeYesterday({ reputation_change: 0.05 }) }) })
    const up = tileText('Reputation').find((t) => t.includes('0.05'))
    expect(up).toBeDefined()
    unmount()
    renderBoard({ view: makeView({ yesterday: makeYesterday({ reputation_change: -0.04 }) }) })
    expect(tileText('Reputation').some((t) => t.includes('0.04'))).toBe(true)
  })

  it('shows no reputation delta on day 1', () => {
    renderBoard({ view: makeView({ day: 1, yesterday: null }) })
    const root = tileRoot('Reputation', '0.62')
    expect(root.textContent).toBe('Reputation0.62')
  })
})

describe('WeekdayStrip and FuturesCountdown', () => {
  it('marks today for screen readers and the peak days (multiplier 1) with a flame', () => {
    renderBoard()
    expect(screen.getAllByText('today')).toHaveLength(1)
    expect(document.querySelectorAll('.lucide-flame')).toHaveLength(3)
  })

  it('shows the futures message in a neutral chip, and a warning chip on the last day to buy', () => {
    const { unmount } = renderBoard()
    const neutral = screen.getByText('Futures: 3 days left to buy (delivery in 7 days, at $12.00)')
    expect(neutral.closest('[class*="warning"]')).toBeNull()
    unmount()
    const brief = makeBrief()
    brief.futures.days_left_to_buy = 1
    renderBoard({
      view: makeView({
        brief,
        order_windows: {
          spot_open: true,
          futures_open: true,
          futures_days_left_to_buy: 1,
          futures_message: 'Futures: last day to buy',
          spot_message: 'Spot open',
        },
      }),
    })
    const warn = screen.getByText('Futures: last day to buy')
    expect(warn.closest('[class*="warning"]')).not.toBeNull()
  })
})

describe('Waiting line', () => {
  it('lists who is still deciding by display name', () => {
    renderBoard({ awaiting: ['P2', 'P1'] })
    expect(screen.getByText('Waiting for: La Chula, Don Agave')).toBeInTheDocument()
    expect(screen.queryByText('Everyone has submitted.')).toBeNull()
  })

  it('says everyone has submitted when nobody is awaited', () => {
    renderBoard({ awaiting: [] })
    expect(screen.getByText('Everyone has submitted.')).toBeInTheDocument()
    expect(screen.queryByText(/Waiting for:/)).toBeNull()
  })
})

describe('Disruption and shared transport', () => {
  it('shows a disruption message verbatim in a warning alert', () => {
    const message = 'The supplier reports a drought: capacity is cut to 40% today.'
    const brief = makeBrief()
    brief.supplier.disrupted = true
    brief.supplier.disruption_message = message
    renderBoard({ view: makeView({ brief }) })
    const text = screen.getByText(message)
    expect(text.closest('[role="status"],[role="alert"]')).not.toBeNull()
    expect(text.closest('[class*="warning"]')).not.toBeNull()
  })

  it('shows no alert for a null message', () => {
    renderBoard()
    const alerts = screen.queryAllByRole('alert')
    expect(alerts).toHaveLength(0)
    expect(screen.queryByText(/capacity is cut/)).toBeNull()
  })

  it('shows the Shared transport chip with a truck only when the truck is shared', () => {
    const { unmount } = renderBoard()
    expect(screen.queryByText('Shared transport')).toBeNull()
    unmount()
    const brief = makeBrief()
    brief.transport.shared = true
    renderBoard({ view: makeView({ brief }) })
    const chip = screen.getByText('Shared transport')
    expect(chip.parentElement?.querySelector('.lucide-truck') ?? chip.querySelector('.lucide-truck')).not.toBeNull()
  })
})
