/**
 * Section 28 — HostRoom page (plan 28 §3.1).
 * Acceptance 1, 2, 5 (daily host_state), 7 (page state); failure modes 3, 6, 7.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
  Line: () => <canvas data-testid="chart-canvas" />,
  Pie: () => <canvas data-testid="chart-canvas" />,
  Doughnut: () => <canvas data-testid="chart-canvas" />,
}))
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  getConfigDefaults: vi.fn(() => new Promise(() => {})),
  validateConfig: vi.fn(() => new Promise(() => {})),
}))
vi.mock('../api/rooms', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/rooms')>()),
  getRoomConfig: vi.fn(() => new Promise(() => {})),
}))

import { socket } from '../api/socket'
import HostRoom, { route } from '../pages/HostRoom'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { Brief, DayRecord, HostView, MarketDay, PublicDayResults } from '../types/game'
import { getHostSecret, setHostSecret } from '../utils/storage'

const CODE = 'ABC234'
const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal' }
const WD = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
type Obj = Record<string, unknown>

let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
})
afterEach(() => emit.mockRestore())

const calls = (event: string) => emit.mock.calls.filter((c: unknown[]) => c[0] === event)

function mount(code = 'abc234') {
  const router = createMemoryRouter(
    [
      { path: '/host/:roomCode', element: <HostRoom /> },
      { path: '/home', element: <p>home page</p> },
      { path: '/results/*', element: <p>results page</p> },
    ],
    { initialEntries: [`/host/${code}`] },
  )
  const utils = render(<RouterProvider router={router} />)
  return { router, ...utils }
}

function brief(): Brief {
  return {
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    weekday_multiplier: 1,
    weekday_multipliers: { mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 },
    expected_demand: 100,
    supplier: { capacity: 81, disrupted: false, disruption_message: null, spot_price: 13.4, base_price: 12, lead_time_days: 1 },
    spot: { open: true, arrives_day: 6 },
    futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
    transport: { shared: false },
    reputation: { P1: 0.62, P2: 0.55, P3: 0.5 },
  } as unknown as Brief
}

function hostView(over: Obj = {}, submitted: string[] = ['P1'], extra: Obj = {}): HostView {
  const players: Obj = {}
  for (const [a, name] of Object.entries(NAMES)) {
    players[a] = {
      display_name: name,
      connected: true,
      has_submitted: submitted.includes(a),
      stock_units: 42,
      expected_spoil_tonight: 3.4,
      in_transit_units: 30,
      open_futures_units: 25,
      backlog: 0,
      reputation: 0.6,
      market_share: 0.33,
      cumulative_profit: 1120.55,
      cash: 6120.55,
      fill_rate: 0.9,
      waste_rate: 0.05,
      last_incoterm_tier: 'cip',
      last_peer_bought: 10,
      last_peer_sold: 4,
      ...extra,
    }
  }
  return {
    full: true,
    state: 'running',
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    brief: brief(),
    seed: 987654321,
    config: {
      random_seed: 987654321,
      peer_market: { enabled: true },
      supplier: { base_price: 12, spot_spread: 0.337 },
      transport: { failure_probability: 0.1234 },
    },
    awaiting: ['P2', 'P3'],
    players,
    leaderboard: [],
    ...over,
  } as unknown as HostView
}

function market(day: number, over: Obj = {}): MarketDay {
  return {
    day,
    weekday: WD[day - 1],
    weekday_multiplier: 1,
    expected_demand: 100,
    demand_total: 100,
    capacity: 81,
    disrupted: false,
    spot_price: 12.5,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    units_sold_total: 90,
    peer_units: 0,
    peer_avg_price: null,
    ...over,
  } as unknown as MarketDay
}

function pub(day: number): PublicDayResults {
  const players: Obj = {}
  for (const [a, name] of Object.entries(NAMES)) {
    players[a] = { display_name: name, units_sold: 30, market_share: 0.33, reputation: 0.6 }
  }
  return {
    day,
    weekday: WD[day - 1],
    demand_total: 100,
    units_sold_total: 90,
    spot_price: 12.5,
    capacity: 81,
    disrupted: false,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    peer_units: 16,
    peer_avg_price: 14.25,
    players,
  } as unknown as PublicDayResults
}

function record(day: number): DayRecord {
  return { day, weekday: WD[day - 1], order_spot: 10, futures_due: 5, spoiled: 2, lost_transport: 0, peer_trades: [] } as unknown as DayRecord
}

/** A running room as the host's store holds it after a full host_state and four closed days. */
function seedRunning(state: Partial<typeof INITIAL_STATE> = {}, view: HostView = hostView()): void {
  useGameStore.setState({
    ...INITIAL_STATE,
    roomCode: CODE,
    isHost: true,
    hostClaimed: true,
    roomState: 'running',
    durationDays: 14,
    brief: brief(),
    hostView: view,
    publicHistory: [pub(1), pub(2), pub(3), pub(4)],
    marketHistory: [market(1), market(2), market(3, { disrupted: true }), market(4)],
    hostHistories: { P1: [record(4)], P2: [record(4)], P3: [record(4)] },
    ...state,
  })
}

const gameFinished = (seq = 90) =>
  act(() =>
    useGameStore.getState().applyGameFinished({
      seq,
      game_id: 'g-host-1',
      days_played: 14,
      ended_early: false,
      leaderboard: [],
      stats: { players: {}, market: {} } as never,
    }),
  )

const lobbyUpdate = (over: Obj = {}) =>
  ({
    seq: 3,
    state: 'configuring',
    participants: [
      { alias: 'P1', display_name: 'Don Agave', connected: true },
      { alias: 'P2', display_name: 'La Chula', connected: true },
    ],
    seats_total: 4,
    config_locked: false,
    can_start: true,
    start_blocked_reason: null,
    ...over,
  }) as never

describe('HostRoom module', () => {
  it('declares its route', () => {
    expect(route).toEqual({ path: '/host/:roomCode', guard: 'auth+backend' })
  })
})

describe('HostRoom mount (acceptance 1, failure mode 7)', () => {
  it('upper-cases the code and sets the room as a host room', () => {
    mount('abc234')
    expect(useGameStore.getState().roomCode).toBe(CODE)
    expect(useGameStore.getState().isHost).toBe(true)
  })

  it('emits join_waiting once with the stored host secret', () => {
    setHostSecret(CODE, 's3cret')
    mount()
    expect(calls('join_waiting')).toHaveLength(1)
    expect(calls('join_waiting')[0][1]).toEqual({ room_id: CODE, host_secret: 's3cret' })
  })

  it('failure mode 7: with no stored secret it still emits join_waiting, without a host_secret key', () => {
    mount()
    expect(calls('join_waiting')).toHaveLength(1)
    const payload = calls('join_waiting')[0][1] as Obj
    expect(payload).toEqual({ room_id: CODE })
    expect('host_secret' in payload).toBe(false)
  })

  it('shows the room code chip in the header', () => {
    mount()
    expect(screen.getAllByText(CODE).length).toBeGreaterThan(0)
  })
})

describe('HostRoom states (acceptance 1, 2)', () => {
  it('before the claim and without an error: an Opening the room spinner', () => {
    mount()
    expect(screen.getByRole('status')).toHaveTextContent('Opening the room')
  })

  it('a join error before the claim: a danger alert with the message and a Back to home link', () => {
    mount()
    act(() => useGameStore.getState().applyJoinError({ message: 'No room with that code.' }))
    expect(screen.getByText('No room with that code.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument()
    expect(screen.queryByText('Opening the room')).toBeNull()
  })

  it.each(['lobby', 'configuring'] as const)('a claimed %s room: the config panel and the lobby rail', (state) => {
    mount()
    act(() => {
      useGameStore.getState().applyHostClaimed({ room_id: CODE, host_secret: 's3cret' })
      useGameStore.getState().applyLobbyUpdate(lobbyUpdate({ state }))
    })
    expect(screen.getByText('Loading the settings')).toBeInTheDocument() // ConfigPanel, config not loaded yet
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument() // LobbyHost
    expect(screen.queryByRole('heading', { level: 1, name: /Room ABC234/ })).toBeNull()
  })

  it('a running room with a host view: the console', () => {
    seedRunning()
    mount()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room ABC234 · Day 5/14 (Fri)')
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Presentation mode' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
  })

  it('a finished room: the console with See the results to the game by id, and no controls', () => {
    seedRunning({ roomState: 'finished', gamePublicId: 'g8f2c1' }, hostView({ state: 'finished', phase: 'finished' }))
    mount()
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g8f2c1')
    expect(screen.queryByRole('button', { name: 'End game early' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Presentation mode' })).toBeNull()
  })

  it('the link appears with the game id that game_finished carries', () => {
    seedRunning({ roomState: 'finished' }, hostView({ state: 'finished', phase: 'finished' }))
    mount()
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
    gameFinished(95)
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g-host-1')
  })
})

describe('HostRoom at the end of the game (failure mode 6)', () => {
  it('failure mode 6: applying game_finished shows the link but does not change the URL', () => {
    seedRunning()
    const { router } = mount()
    const before = router.state.location.pathname
    gameFinished()
    expect(screen.getByRole('link', { name: 'See the results' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(before)
    act(() => useGameStore.getState().applyGamePersisted({ seq: 91, game_id: 'g1' }))
    expect(router.state.location.pathname).toBe(before)
    expect(screen.queryByText('results page')).toBeNull()
  })

  it('following the link is what navigates', () => {
    seedRunning()
    const { router } = mount()
    gameFinished()
    fireEvent.click(screen.getByRole('link', { name: 'See the results' }))
    expect(router.state.location.pathname).toBe('/results/g-host-1')
  })
})

describe('HostRoom presentation mode (acceptance 7)', () => {
  it('opens on the button, hides the room code chip, and closes on Exit', () => {
    seedRunning()
    mount()
    expect(screen.getAllByText(CODE).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }))
    expect(document.documentElement.getAttribute('data-scale')).toBe('presentation')
    expect(screen.getByText('Day 5 · Friday')).toBeInTheDocument()
    expect(screen.queryAllByText(CODE)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Exit/ }))
    expect(document.documentElement.getAttribute('data-scale')).toBeNull()
    expect(screen.queryByText('Day 5 · Friday')).toBeNull()
    expect(screen.getAllByText(CODE).length).toBeGreaterThan(0)
  })

  it('closes on Escape', () => {
    seedRunning()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.documentElement.getAttribute('data-scale')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room ABC234')
  })

  it('is built from the store: the brief, yesterday and the submissions', () => {
    seedRunning()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }))
    expect(screen.getByText('~100')).toBeInTheDocument()
    expect(screen.getByText('3 days left to buy')).toBeInTheDocument()
    expect(document.body.textContent).toContain('Peer market: 16 units at $14.25 on average')
  })

  it('failure modes 1, 2: the projected screen carries none of the private values of the host view', () => {
    seedRunning()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }))
    // the smallest block that holds both the Exit button and the brief tiles
    const exit = screen.getByRole('button', { name: /Exit/ })
    const tile = screen.getByText('Expected demand')
    let root: HTMLElement | null = exit
    while (root && !root.contains(tile)) root = root.parentElement
    const text = (root?.textContent ?? '').replace(/\s+/g, ' ')
    expect(text.length).toBeGreaterThan(0)
    for (const value of ['6,120.55', '1,120.55', '987654321', '0.1234', '12.34%', '0.337', '33.7%', '7.96', '16.04']) {
      expect(text, value).not.toContain(value)
    }
  })
})

describe('HostRoom host secret (failure mode 7)', () => {
  it('uses the secret that host_claimed delivers for Start game, then for End game early', () => {
    mount()
    expect(getHostSecret(CODE)).toBeNull()
    // the claim handler (section 21) stores the secret the server sends; the page must pick it up on its next render
    setHostSecret(CODE, 'srv-secret')
    act(() => {
      useGameStore.getState().applyHostClaimed({ room_id: CODE, host_secret: 'srv-secret' })
      useGameStore.getState().applyLobbyUpdate(lobbyUpdate())
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(calls('start_game')).toHaveLength(1)
    expect(calls('start_game')[0][1]).toEqual({ room_id: CODE, host_secret: 'srv-secret' })

    act(() => {
      useGameStore.setState({ roomState: 'running', brief: brief(), hostView: hostView() })
    })
    fireEvent.click(screen.getByRole('button', { name: 'End game early' }))
    expect(calls('end_game_early')).toHaveLength(0)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End game' }))
    expect(calls('end_game_early')).toHaveLength(1)
    expect(calls('end_game_early')[0][1]).toEqual({ room_id: CODE, host_secret: 'srv-secret' })
  })

  it('uses the secret already in session storage for End game early', () => {
    setHostSecret(CODE, 's3cret')
    seedRunning()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'End game early' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End game' }))
    expect(calls('end_game_early')[0][1]).toEqual({ room_id: CODE, host_secret: 's3cret' })
  })
})

describe('HostRoom histories and submissions across daily host_state (acceptance 5, failure mode 3)', () => {
  const fullState = () => ({
    seq: 10,
    ...(hostView() as unknown as Obj),
    full: true,
    players: Object.fromEntries(
      Object.entries((hostView() as unknown as { players: Obj }).players).map(([a, p]) => [
        a,
        { ...(p as Obj), own_history: [record(2), record(3)] },
      ]),
    ),
    public_history: [pub(1), pub(2), pub(3)],
    market_history: [market(1), market(2), market(3, { disrupted: true })],
  })

  it('a daily host_state leaves the charts and the event history in place', () => {
    useGameStore.getState().setRoom(CODE, true)
    act(() => {
      useGameStore.getState().applyHostClaimed({ room_id: CODE, host_secret: 's3cret' })
      useGameStore.getState().applyHostState(fullState() as never)
    })
    mount()
    expect(screen.getAllByRole('figure').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByRole('region', { name: 'Events' })).toHaveTextContent('Day 3 (Wed): supplier disrupted')

    act(() => {
      useGameStore.getState().applyHostState({ ...(hostView() as unknown as Obj), seq: 11, full: false } as never)
    })
    expect(screen.queryByText('No days closed yet')).toBeNull()
    expect(screen.getAllByRole('figure').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByRole('region', { name: 'Events' })).toHaveTextContent('Day 3 (Wed): supplier disrupted')
  })

  it('failure mode 3: a decision_submitted ticks only the name; no decision content appears', () => {
    useGameStore.getState().setRoom(CODE, true)
    act(() => {
      useGameStore.getState().applyHostClaimed({ room_id: CODE, host_secret: 's3cret' })
      useGameStore.getState().applyHostState(fullState() as never)
    })
    mount()
    const card = () => screen.getByRole('region', { name: 'Submissions' })
    expect(card()).toHaveTextContent('La Chula')
    act(() => {
      useGameStore.getState().applyDecisionSubmitted({ seq: 11, day: 5, alias: 'P2', awaiting: ['P3'] })
      useGameStore
        .getState()
        .applyHostState({ ...(hostView({}, ['P1', 'P2']) as unknown as Obj), seq: 12, full: false, awaiting: ['P3'] } as never)
    })
    const text = (card().textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain('La Chula')
    expect(text).toMatch(/La Chula\s*submitted/)
    expect(text).toMatch(/El Tinacal\s*deciding/)
    expect(text).not.toMatch(/\d/)
  })
})
