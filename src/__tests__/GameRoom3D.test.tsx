/**
 * Section 32 - GameRoom with the 3D board (plan 32 section 3.4; acceptance 3, 4, 5, 6;
 * failure modes 1, 2, 3, 15). Board3D is mocked: jsdom has no WebGL.
 */
import { createElement, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', { 'data-testid': `chart-${type}`, 'data-chart': JSON.stringify({ type, data: props.data }) })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

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

const board3d = vi.hoisted(() => ({ throws: false, seen: [] as Array<Record<string, unknown>> }))
const support = vi.hoisted(() => ({ value: { ok: true } as { ok: true } | { ok: false; reason: string } }))

vi.mock('../components/game/views/Board3D', () => ({
  default: (props: Record<string, unknown>) => {
    if (board3d.throws) throw new Error('chunk failed')
    board3d.seen.push(props)
    return <div data-testid="board3d">3D board</div>
  },
}))

vi.mock('../components/game/views/boardView', async (importActual) => ({
  ...(await importActual<typeof import('../components/game/views/boardView')>()),
  useBoardViewSupport: () => support.value,
}))

import http from '../api/http'
import { socket } from '../api/socket'
import Board2D, { type BoardViewProps } from '../components/game/views/Board2D'
import SceneLoading from '../components/game/views/SceneLoading'
import GameRoom, { BOARD_VIEWS } from '../pages/GameRoom'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { getBoardView, setBoardView, setDisplayName, setSessionToken } from '../utils/storage'
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
      { tier: 'exw', label: 'No insurance — you carry the risk', enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
      { tier: 'cip', label: 'Paid-price insurance — refund what you paid', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.55 },
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

const ALERT = 'The 3D view stopped working, so the board switched to 2D.'
const REASON = 'The 3D pulquería needs a window at least 1,024 pixels wide.'
let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  board3d.throws = false
  board3d.seen = []
  support.value = { ok: true }
  useGameStore.setState({ ...INITIAL_STATE })
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

function mount(code = 'K7M2QX') {
  const router = createMemoryRouter([{ path: '/game/:roomCode', element: <GameRoom /> }], {
    initialEntries: [`/game/${code}`],
  })
  return render(<RouterProvider router={router} />)
}

function seedRunning(state: Partial<typeof INITIAL_STATE> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    roomCode: 'K7M2QX',
    myAlias: 'P1',
    roomState: 'running',
    participants: PARTICIPANTS,
    config: makeConfig(true),
    playerView: makeView({ prefill_decision: makeDecision(5) }),
    ...state,
  })
}

const decisionCard = () => screen.queryByRole('region', { name: "Today's decision" })
const toggle = () => screen.queryByRole('group', { name: 'Board view' })

describe('BOARD_VIEWS', () => {
  it('maps 2D to Board2D and 3D to a lazy component', () => {
    expect(BOARD_VIEWS['2D']).toBe(Board2D)
    expect(BOARD_VIEWS['3D']).toBeDefined()
    expect(BOARD_VIEWS['3D']).not.toBe(Board2D)
  })
})

describe('the toggle in the header (acceptance 3)', () => {
  it('appears while the game is running and the player is seated, after the room code and chip', () => {
    seedRunning()
    mount()
    const group = toggle() as HTMLElement
    expect(group).not.toBeNull()
    const code = screen.getAllByText('K7M2QX')[0]
    const chip = screen.getByText('Don Agave')
    expect(code.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(chip.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is absent in the lobby', () => {
    setSessionToken('K7M2QX', 'tok')
    useGameStore.setState({ ...INITIAL_STATE, roomCode: 'K7M2QX', myAlias: 'P1', roomState: 'lobby', participants: PARTICIPANTS, seatsTotal: 4 })
    mount()
    expect(toggle()).toBeNull()
  })

  it('is absent when the player is not seated', () => {
    setSessionToken('K7M2QX', 'tok')
    seedRunning({ myAlias: null })
    mount()
    expect(toggle()).toBeNull()
  })

  it('stores the choice under pulky.board_view and swaps the board', async () => {
    seedRunning()
    mount()
    expect(decisionCard()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    expect(localStorage.getItem('pulky.board_view')).toBe('3D')
    expect(await screen.findByTestId('board3d')).toBeInTheDocument()
    expect(decisionCard()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '2D' }))
    expect(localStorage.getItem('pulky.board_view')).toBe('2D')
    expect(screen.queryByTestId('board3d')).toBeNull()
    expect(decisionCard()).not.toBeNull()
  })

  it('failure mode 3: without support 3D is disabled and the reason is in its InfoTip', () => {
    support.value = { ok: false, reason: REASON }
    seedRunning()
    mount()
    expect(screen.getByRole('button', { name: '3D' })).toBeDisabled()
    fireEvent.focus(screen.getByRole('button', { name: 'About 3D view' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(REASON)
  })
})

describe('which board is shown (acceptance 4)', () => {
  it('a stored 3D with support shows Board3D', async () => {
    setBoardView('3D')
    seedRunning()
    mount()
    expect(await screen.findByTestId('board3d')).toBeInTheDocument()
    expect(decisionCard()).toBeNull()
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('failure mode 3: a stored 3D without support shows Board2D and keeps 3D stored', () => {
    support.value = { ok: false, reason: REASON }
    setBoardView('3D')
    seedRunning()
    mount()
    expect(screen.queryByTestId('board3d')).toBeNull()
    expect(decisionCard()).not.toBeNull()
    expect(getBoardView()).toBe('3D')
  })

  it('failure mode 2: a finished game shows Board2D, the GameOverPanel and no toggle', () => {
    setBoardView('3D')
    seedRunning()
    useGameStore.setState({ roomState: 'finished' })
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
    mount()
    expect(screen.queryByTestId('board3d')).toBeNull()
    expect(screen.getByRole('link', { name: 'See the results' })).toBeInTheDocument()
    expect(toggle()).toBeNull()
    expect(getBoardView()).toBe('3D')
  })

  it('hands Board3D exactly the BoardViewProps the 2D board gets', async () => {
    setBoardView('3D')
    seedRunning({ awaiting: ['P2'] })
    mount()
    await screen.findByTestId('board3d')
    const props = board3d.seen[0] as unknown as BoardViewProps
    expect(Object.keys(props).sort()).toEqual(
      ['awaiting', 'config', 'gameOver', 'initialDecision', 'lastRecord', 'locked', 'onSubmit', 'ownHistory', 'participants', 'publicHistory', 'view'].sort(),
    )
    expect(props.awaiting).toEqual(['P2'])
    expect(props.gameOver).toBe(false)
    expect(props.view).toBe(useGameStore.getState().playerView)
  })

  it('submits through the same onSubmit', async () => {
    setBoardView('3D')
    seedRunning()
    mount()
    await screen.findByTestId('board3d')
    act(() => (board3d.seen[0] as unknown as BoardViewProps).onSubmit(makeDecision(5)))
    const sent = emit.mock.calls.find((c: unknown[]) => c[0] === 'submit_day')
    expect(sent?.[1]).toMatchObject({ room_id: 'K7M2QX', day: 5 })
  })
})

describe('falling back (acceptance 5, failure mode 1)', () => {
  it('a throwing Board3D renders Board2D at once, stores 2D and shows the info alert', async () => {
    board3d.throws = true
    setBoardView('3D')
    seedRunning()
    mount()
    expect(await screen.findByText(ALERT)).toBeInTheDocument()
    expect(decisionCard()).not.toBeNull()
    expect(screen.getAllByRole('region', { name: "Today's decision" })).toHaveLength(1)
    expect(localStorage.getItem('pulky.board_view')).toBe('2D')
    expect(screen.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the alert until the player toggles, then hides it', async () => {
    board3d.throws = true
    setBoardView('3D')
    seedRunning()
    mount()
    await screen.findByText(ALERT)
    board3d.throws = false
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    await waitFor(() => expect(screen.queryByText(ALERT)).toBeNull())
    expect(await screen.findByTestId('board3d')).toBeInTheDocument()
    expect(localStorage.getItem('pulky.board_view')).toBe('3D')
  })

  it('shows no alert when nothing failed', () => {
    seedRunning()
    mount()
    expect(screen.queryByText(ALERT)).toBeNull()
  })
})

describe('both views share every endpoint (acceptance 6, failure mode 15)', () => {
  it('switching 3D, 2D, 3D emits no socket event and makes no HTTP request', async () => {
    setSessionToken('K7M2QX', 'tok-123')
    setDisplayName('Don Agave')
    seedRunning()
    mount()
    const joined = emit.mock.calls.filter((c: unknown[]) => c[0] === 'join')
    expect(joined).toHaveLength(1)

    emit.mockClear()
    const adapter = vi.fn(async (config: unknown) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }))
    const original = http.defaults.adapter
    http.defaults.adapter = adapter as never
    try {
      fireEvent.click(screen.getByRole('button', { name: '3D' }))
      await screen.findByTestId('board3d')
      fireEvent.click(screen.getByRole('button', { name: '2D' }))
      expect(decisionCard()).not.toBeNull()
      expect(screen.queryByTestId('board3d')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '3D' }))
      await screen.findByTestId('board3d')
      expect(board3d.seen.length).toBeGreaterThanOrEqual(2)
      expect(board3d.seen[board3d.seen.length - 1].view).toBe(board3d.seen[0].view)
      expect(emit).not.toHaveBeenCalled()
      expect(adapter).not.toHaveBeenCalled()
    } finally {
      http.defaults.adapter = original
    }
  })

  it('keeps the player seat view in the store untouched by a switch', async () => {
    seedRunning()
    mount()
    const before = useGameStore.getState().playerView
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    await screen.findByTestId('board3d')
    expect(useGameStore.getState().playerView).toBe(before)
  })
})

describe('SceneLoading', () => {
  it('is a status card reading Building your pulquería', () => {
    render(<SceneLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Building your pulquería')
  })
})

describe('within the page', () => {
  it('keeps the section 27 states: the lobby is still the lobby', () => {
    setSessionToken('K7M2QX', 'tok')
    useGameStore.setState({ ...INITIAL_STATE, roomCode: 'K7M2QX', myAlias: 'P1', roomState: 'configuring', participants: PARTICIPANTS, seatsTotal: 4 })
    mount()
    expect(screen.getByRole('region', { name: 'Waiting for the host to start' })).toBeInTheDocument()
    expect(within(document.body).queryByTestId('board3d')).toBeNull()
  })
})
