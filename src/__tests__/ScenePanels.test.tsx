/** Section 32 - ScenePanels (plan 32 section 3.7; acceptance 8; failure mode 11). */
import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', { 'data-testid': `chart-${type}`, 'data-chart': JSON.stringify({ type, data: props.data }) })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

import type { BoardViewProps } from '../components/game/views/Board2D'
import ScenePanels from '../components/game/views/board3d/ScenePanels'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from '../components/game/views/board3d/sceneLayout'
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

function mount(openPanel: PanelId | null, over: Partial<BoardViewProps> = {}) {
  const props = makeProps(over)
  const onClose = vi.fn()
  const ui = (panel: PanelId | null) => <ScenePanels {...props} openPanel={panel} onClose={onClose} />
  const utils = render(ui(openPanel))
  return { props, onClose, show: (panel: PanelId | null) => utils.rerender(ui(panel)), ...utils }
}

const wrapper = (id: PanelId) => document.getElementById(`scene-panel-${id}`) as HTMLElement

describe('shell', () => {
  it('is one hidden section while no panel is open', () => {
    const { container } = mount(null)
    const section = container.querySelector(':scope > section') as HTMLElement
    expect(section).not.toBeNull()
    expect(section).toHaveAttribute('hidden')
  })

  it.each(PANEL_ORDER as readonly PanelId[])('opening %s shows the section labelled with its title', (id) => {
    const { container } = mount(id)
    const section = container.querySelector(':scope > section') as HTMLElement
    expect(section).not.toHaveAttribute('hidden')
    expect(section).toHaveAttribute('aria-label', PANEL_TITLES[id])
  })

  it('has a Close button named for the open panel that calls onClose', () => {
    const { onClose } = mount('cellar')
    const close = screen.getByRole('button', { name: 'Close Your cellar' })
    expect(close).toHaveTextContent('Close')
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('six wrappers', () => {
  it('mounts all six, in PANEL_ORDER, visible only for the open one', () => {
    mount('yesterday')
    const wrappers = PANEL_ORDER.map(wrapper)
    wrappers.forEach((w) => expect(w).not.toBeNull())
    for (let i = 1; i < wrappers.length; i += 1) {
      expect(wrappers[i - 1].compareDocumentPosition(wrappers[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const id of PANEL_ORDER) {
      if (id === 'yesterday') expect(wrapper(id)).not.toHaveAttribute('hidden')
      else expect(wrapper(id)).toHaveAttribute('hidden')
    }
  })

  it('holds each 2D panel in its own wrapper', () => {
    mount(null)
    expect(within(wrapper('day-stats')).getByText('Your demand', { exact: false })).toBeTruthy()
    expect(wrapper('decision').querySelector('input')).not.toBeNull()
    expect(within(wrapper('cellar')).getAllByText('Your cellar').length).toBeGreaterThan(0)
    expect(within(wrapper('market')).getAllByText('Market').length).toBeGreaterThan(0)
    expect(within(wrapper('yesterday')).getAllByText('Yesterday').length).toBeGreaterThan(0)
    expect(within(wrapper('details')).getAllByText('Details').length).toBeGreaterThan(0)
  })

  it('failure mode 11: with Market open, no other panel is visible', () => {
    mount('market')
    for (const id of PANEL_ORDER) {
      if (id === 'market') continue
      expect(screen.queryAllByRole('region', { name: PANEL_TITLES[id] })).toHaveLength(0)
    }
    expect(screen.getAllByRole('region', { name: 'Market' }).length).toBeGreaterThan(0)
  })

  it('failure mode 11: the decision draft survives switching away and back', async () => {
    const user = userEvent.setup()
    const { show } = mount('decision', { initialDecision: { ...makeDecision(5), order_spot: 0 } })
    const field = () => screen.getByLabelText('Buy from Supplier') as HTMLInputElement
    await user.clear(field())
    await user.type(field(), '40')
    expect(field()).toHaveValue('40')
    show('market')
    show('decision')
    expect(field()).toHaveValue('40')
  })

  it('failure mode 11: the DOM never holds a second decision form', () => {
    const { show } = mount('decision')
    expect(screen.getAllByRole('button', { name: 'Submit day', hidden: true })).toHaveLength(1)
    show('market')
    expect(screen.getAllByRole('button', { name: 'Submit day', hidden: true })).toHaveLength(1)
    show(null)
    expect(screen.getAllByRole('button', { name: 'Submit day', hidden: true })).toHaveLength(1)
  })

  it('does not unmount the decision form when another panel opens', () => {
    const { show } = mount('decision')
    const before = wrapper('decision').querySelector('input')
    show('details')
    show('decision')
    expect(wrapper('decision').querySelector('input')).toBe(before)
  })

  it('feeds the decision form onSubmit and the locked footer', () => {
    const { props } = mount('decision', { initialDecision: makeDecision(5) })
    fireEvent.click(screen.getByRole('button', { name: 'Submit day' }))
    expect(props.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows the waiting panel as the locked footer of the form', () => {
    mount('decision', { locked: true, awaiting: ['P2'] })
    expect(screen.getByText('Day submitted. Waiting for La Chula.')).toBeInTheDocument()
  })
})

describe('focus', () => {
  it('moves to the Close button when a panel opens from null', () => {
    const { show } = mount(null)
    show('market')
    expect(screen.getByRole('button', { name: 'Close Market' })).toHaveFocus()
  })

  it('moves to the Close button when one panel replaces another', () => {
    const { show } = mount('market')
    show('details')
    expect(screen.getByRole('button', { name: 'Close Details' })).toHaveFocus()
  })
})
