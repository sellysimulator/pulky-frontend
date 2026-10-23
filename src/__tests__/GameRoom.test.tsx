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
 * Section 27 - GameRoom page (spec 13.7, 13.8, 11.3). Acceptance criteria 1, 8, 9, 10;
 * failure modes 2, 7, 8.
 */
import { act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: 'authenticated',
    user: { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null },
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import { socket } from '../api/socket'
import GameRoom, { BOARD_VIEWS, route } from '../pages/GameRoom'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { setDisplayName, setSessionToken } from '../utils/storage'

let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
})
afterEach(() => emit.mockRestore())

const joins = () => emit.mock.calls.filter((c: unknown[]) => c[0] === 'join')

function mount(code = 'K7M2QX') {
  const router = createMemoryRouter([{ path: '/game/:roomCode', element: <GameRoom /> }], {
    initialEntries: [`/game/${code}`],
  })
  const utils = render(<RouterProvider router={router} />)
  return { router, ...utils }
}

/** A running room as the server would have left the store after your_state. */
function seedRunning(over: Parameters<typeof makeView>[0] = {}, state: Partial<typeof INITIAL_STATE> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    roomCode: 'K7M2QX',
    myAlias: 'P1',
    roomState: 'running',
    participants: PARTICIPANTS,
    config: makeConfig(true),
    playerView: makeView({ prefill_decision: makeDecision(5), ...over }),
    ...state,
  })
}

const finish = () =>
  act(() =>
    useGameStore.getState().applyGameFinished({
      seq: 50,
      game_id: 'g-77',
      days_played: 14,
      ended_early: false,
      leaderboard: [],
      stats: { players: {}, market: {} } as never,
    }),
  )

describe('GameRoom module', () => {
  it('declares its route', () => {
    expect(route).toEqual({ path: '/game/:roomCode', guard: 'auth+backend' })
  })

  it('registers Board2D under 2D', () => {
    expect(BOARD_VIEWS['2D']).toBe(Board2D)
  })
})

describe('GameRoom mount (acceptance 10, failure mode 7)', () => {
  it('upper-cases the room code and sets the room as a player room', () => {
    mount('k7m2qx')
    const s = useGameStore.getState()
    expect(s.roomCode).toBe('K7M2QX')
    expect(s.isHost).toBe(false)
  })

  it('failure mode 7: a returning player with a stored token emits join with that token', () => {
    setSessionToken('K7M2QX', 'tok-123')
    setDisplayName('Don Agave')
    mount()
    expect(joins()).toHaveLength(1)
    expect(joins()[0][1]).toEqual({ room_id: 'K7M2QX', display_name: 'Don Agave', session_token: 'tok-123' })
  })

  it('failure mode 7: with no stored token nothing is emitted on mount', () => {
    setDisplayName('Don Agave')
    mount()
    expect(joins()).toHaveLength(0)
    expect(emit).not.toHaveBeenCalled()
  })

  it('joins with the lower-case route code under its upper-case form', () => {
    setSessionToken('K7M2QX', 'tok-123')
    mount('k7m2qx')
    expect(joins()[0][1]).toMatchObject({ room_id: 'K7M2QX', session_token: 'tok-123' })
  })
})

describe('GameRoom states (spec 13.7, 3.8)', () => {
  it('no seat and no token: the name form of the player lobby', () => {
    mount()
    expect(screen.getByRole('region', { name: 'Name your pulquería' })).toBeInTheDocument()
  })

  it('a token but nothing from the server yet: a Joining the room spinner', () => {
    setSessionToken('K7M2QX', 'tok-123')
    mount()
    expect(screen.getByRole('status')).toHaveTextContent('Joining the room')
    expect(screen.queryByRole('region', { name: 'Name your pulquería' })).toBeNull()
  })

  it('a join error while unseated is shown, not hidden behind the spinner', () => {
    setSessionToken('K7M2QX', 'tok-123')
    mount()
    act(() => useGameStore.getState().applyJoinError({ message: 'That room no longer exists.' }))
    expect(screen.getByText('That room no longer exists.')).toBeInTheDocument()
  })

  it.each(['lobby', 'configuring'] as const)('seated in a %s room: the waiting lobby', (state) => {
    setSessionToken('K7M2QX', 'tok-123')
    useGameStore.setState({
      ...INITIAL_STATE,
      roomCode: 'K7M2QX',
      myAlias: 'P1',
      roomState: state,
      participants: PARTICIPANTS,
      seatsTotal: 4,
    })
    mount()
    expect(screen.getByRole('region', { name: 'Waiting for the host to start' })).toBeInTheDocument()
  })

  it('running with a player view: the board, with the decision form', () => {
    seedRunning()
    mount()
    expect(screen.getByRole('region', { name: "Today's decision" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit day' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
  })

  it('running but no player view yet: the spinner', () => {
    setSessionToken('K7M2QX', 'tok-123')
    useGameStore.setState({ ...INITIAL_STATE, roomCode: 'K7M2QX', myAlias: 'P1', roomState: 'running', participants: PARTICIPANTS })
    mount()
    expect(screen.getByRole('status')).toHaveTextContent('Joining the room')
  })

  it('running and submitted: locked, with the waiting panel built from the store awaiting list', () => {
    seedRunning({ has_submitted: true }, { awaiting: ['P2', 'P3'] })
    mount()
    expect(screen.queryByRole('button', { name: 'Submit day' })).toBeNull()
    expect(screen.getByText('Day submitted. Waiting for La Chula, El Tinacal.')).toBeInTheDocument()
  })

  it('the header carries the room code and, when seated, the pulquería chip', () => {
    seedRunning()
    mount()
    expect(screen.getAllByText('K7M2QX').length).toBeGreaterThan(0)
    expect(screen.getByText('Don Agave')).toBeInTheDocument()
  })

  it('the header links the player manual in a new tab, so the board and its draft stay put', () => {
    seedRunning()
    mount()
    const link = screen.getByRole('link', { name: 'Player manual' })
    expect(link).toHaveAttribute('href', '/player-manual')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('submitting sends submit_day for the room with the decision', () => {
    seedRunning()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Submit day' }))
    const sent = emit.mock.calls.find((c: unknown[]) => c[0] === 'submit_day')
    expect(sent?.[1]).toMatchObject({ room_id: 'K7M2QX', day: 5, order_spot: 40, order_futures: 25 })
  })
})

describe('GameRoom builds the board props from the store (spec 12.6)', () => {
  it('takes histories, config and awaiting from the store, never from the player view', () => {
    const own = [makeRecord(4, { lost_transport: 15, refrigeration_failure: true })]
    seedRunning(
      { full: false },
      {
        ownHistory: own,
        lastRecord: own[0],
        publicHistory: [makePublic(4)],
        awaiting: ['P2'],
        config: makeConfig(false),
      },
    )
    mount()
    expect(screen.getByText('Waiting for: La Chula')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: "Yesterday's market" })).toBeInTheDocument()
    const summary = screen.getByText('Recap')
    fireEvent.click(summary)
    expect(within(summary.closest('details') as HTMLElement).getByText('Refrigeration failed: you lost 15 units (shipping alone).')).toBeInTheDocument()
    expect(screen.queryByText(/Peer market/)).toBeNull()
  })
})

describe('GameRoom at the end of the game (acceptance 1, 8, 9)', () => {
  it('finished: GameOverPanel above the board, the form gone, the board read-only', () => {
    seedRunning()
    useGameStore.setState({ roomState: 'finished' })
    finish()
    mount()
    const link = screen.getByRole('link', { name: 'See the results' })
    expect(before(link, screen.getByText('Your demand'))).toBe(true)
    expect(screen.getByText('The game is over')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: "Today's decision" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Submit day' })).toBeNull()
  })

  it('ended early: the finished view lands before game_finished, so the form goes without a crash and the link follows', () => {
    seedRunning()
    mount()
    expect(screen.getByRole('region', { name: "Today's decision" })).toBeInTheDocument()
    const finishedView = makeView({ full: false, phase: 'finished', order_windows: null, prefill_decision: null })
    act(() => useGameStore.getState().applyYourState({ ...finishedView, brief: null, seq: 49 }))
    expect(screen.getByText('The game is over')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: "Today's decision" })).toBeNull()
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
    finish()
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g-77')
  })

  it('links to the game by the id game_finished carries, before game_persisted and after it', () => {
    seedRunning()
    finish()
    mount()
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g-77')
    act(() => useGameStore.getState().applyGamePersisted({ seq: 51, game_id: 'g-77' }))
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g-77')
  })

  it('failure mode 2: game_finished and game_persisted do not navigate', () => {
    seedRunning()
    const { router } = mount()
    expect(router.state.location.pathname).toBe('/game/K7M2QX')
    finish()
    act(() => useGameStore.getState().applyGamePersisted({ seq: 51, game_id: 'g-77' }))
    expect(router.state.location.pathname).toBe('/game/K7M2QX')
    expect(screen.getByText('The game is over')).toBeInTheDocument()
  })

  it('failure mode 8: unmounting after game_finished leaves the finished state in the store', () => {
    seedRunning()
    const { unmount } = mount()
    finish()
    unmount()
    const s = useGameStore.getState()
    expect(s.finished).not.toBeNull()
    expect(s.roomState).toBe('finished')
    expect(s.roomCode).toBe('K7M2QX')
    expect(s.playerView).not.toBeNull()
  })

  it('failure mode 8: unmounting mid-game does not reset the store either', () => {
    seedRunning()
    const { unmount } = mount()
    unmount()
    expect(useGameStore.getState().playerView).not.toBeNull()
    expect(useGameStore.getState().roomState).toBe('running')
  })
})
