import { StrictMode, type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void

const h = vi.hoisted(() => {
  const listeners = new Map<string, Listener[]>()
  const emitted: Array<{ event: string; args: unknown[] }> = []
  const lifecycle: string[] = []
  const ioCalls: Array<{ url: unknown; opts: Record<string, unknown> }> = []
  const state: { currentUser: unknown } = { currentUser: null }
  const fake = {
    connected: false,
    on(event: string, fn: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), fn])
      return fake
    },
    off(event: string, fn?: Listener) {
      listeners.set(event, fn ? (listeners.get(event) ?? []).filter((f) => f !== fn) : [])
      return fake
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args })
      return fake
    },
    connect() {
      lifecycle.push('connect')
      return fake
    },
    disconnect() {
      lifecycle.push('disconnect')
      return fake
    },
    listeners(event: string) {
      return [...(listeners.get(event) ?? [])]
    },
  }
  return { listeners, emitted, lifecycle, ioCalls, fake, state }
})

vi.mock('socket.io-client', () => ({
  io: (url: unknown, opts: Record<string, unknown>) => {
    h.ioCalls.push({ url, opts })
    return h.fake
  },
}))

vi.mock('../../firebase', () => ({
  auth: {
    get currentUser() {
      return h.state.currentUser
    },
  },
  googleProvider: {},
  app: {},
}))

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/auth')>()),
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb(null)
    return () => {}
  },
}))

const SERVER_EVENTS = [
  'joined',
  'host_claimed',
  'join_error',
  'leave_ack',
  'lobby_update',
  'config_updated',
  'game_started',
  'day_opened',
  'your_state',
  'host_state',
  'decision_submitted',
  'day_closed',
  'your_day_closed',
  'participant_disconnected',
  'participant_reconnected',
  'host_disconnected',
  'host_reconnected',
  'game_finished',
  'game_persisted',
  'error',
] as const

const FULL_CONFIG = {
  random_seed: null,
  transport: { unit_cost: 1, failure_probability: 0.1 },
  stock: { holding_cost: 0.2 },
}

function fire(event: string, payload?: unknown): void {
  const fns = h.fake.listeners(event)
  expect(fns.length, `a listener is registered for ${event}`).toBeGreaterThan(0)
  for (const fn of fns) fn(payload)
}

function emittedEvents(): Array<[string, unknown]> {
  return h.emitted.map((e) => [e.event, e.args[0]])
}

async function load() {
  vi.resetModules()
  h.listeners.clear()
  h.emitted.length = 0
  h.lifecycle.length = 0
  h.ioCalls.length = 0
  h.state.currentUser = null
  await import('../api/socketHandlers')
  const { useGameStore } = await import('../store/gameStore')
  const storage = await import('../utils/storage')
  return { useGameStore, storage }
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registration (criterion 3)', () => {
  it('registers exactly one listener per spec 12.2 event on import', async () => {
    await load()
    for (const event of SERVER_EVENTS) {
      expect(h.fake.listeners(event), event).toHaveLength(1)
    }
  })

  it('importing the handlers a second time in the same module graph registers nothing more', async () => {
    await load()
    await import('../api/socketHandlers')
    for (const event of SERVER_EVENTS) expect(h.fake.listeners(event), event).toHaveLength(1)
  })
})

describe('the socket (failure mode 9)', () => {
  it('is built with autoConnect false, the websocket+polling transports, reconnection and the /socket.io path', async () => {
    await load()
    expect(h.ioCalls).toHaveLength(1)
    const { opts } = h.ioCalls[0]
    expect(opts.autoConnect).toBe(false)
    expect(opts.path).toBe('/socket.io')
    expect(opts.transports).toEqual(['websocket', 'polling'])
    expect(opts.reconnection).toBe(true)
    expect(typeof opts.auth).toBe('function')
  })

  it('does not connect by itself: importing the socket, the handlers, the games module and the store never calls connect', async () => {
    await load()
    await import('../api/games')
    await import('../api/socket')
    expect(h.lifecycle).not.toContain('connect')
    expect(h.fake.connected).toBe(false)
  })

  it('the auth callback sends the ID token and a null guest id when signed in', async () => {
    await load()
    h.state.currentUser = { getIdToken: async () => 'id-token-1' }
    const auth = h.ioCalls[0].opts.auth as (cb: (d: unknown) => void) => void
    const sent = await new Promise<unknown>((resolve) => auth(resolve))
    expect(sent).toEqual({ idToken: 'id-token-1', guestId: null })
  })

  it('the auth callback asks for a fresh token on every call', async () => {
    await load()
    let n = 0
    h.state.currentUser = { getIdToken: async () => `tok-${++n}` }
    const auth = h.ioCalls[0].opts.auth as (cb: (d: unknown) => void) => void
    expect(await new Promise<unknown>((resolve) => auth(resolve))).toEqual({ idToken: 'tok-1', guestId: null })
    expect(await new Promise<unknown>((resolve) => auth(resolve))).toEqual({ idToken: 'tok-2', guestId: null })
  })

  it('the auth callback sends a null token and the stored guest id when signed out', async () => {
    const { storage } = await load()
    const auth = h.ioCalls[0].opts.auth as (cb: (d: unknown) => void) => void
    const first = (await new Promise<unknown>((resolve) => auth(resolve))) as { idToken: unknown; guestId: string }
    expect(first.idToken).toBeNull()
    expect(first.guestId).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(first.guestId).toBe(storage.getGuestId())
    const second = (await new Promise<unknown>((resolve) => auth(resolve))) as { guestId: string }
    expect(second.guestId).toBe(first.guestId)
  })

  it('the auth callback falls back to the guest id when the token cannot be read', async () => {
    await load()
    h.state.currentUser = {
      getIdToken: async () => {
        throw new Error('network')
      },
    }
    const auth = h.ioCalls[0].opts.auth as (cb: (d: unknown) => void) => void
    const sent = (await new Promise<unknown>((resolve) => auth(resolve))) as { idToken: unknown; guestId: string }
    expect(sent.idToken).toBeNull()
    expect(sent.guestId).toMatch(/^guest_[0-9a-f-]{36}$/)
  })
})

describe('re-asserting identity on connect (criterion 5)', () => {
  it('a host with a stored secret emits join_waiting {room_id, host_secret}', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', true)
    storage.setHostSecret('ABC234', 'host-secret-1')
    fire('connect')
    expect(emittedEvents()).toEqual([['join_waiting', { room_id: 'ABC234', host_secret: 'host-secret-1' }]])
  })

  it('a host without a stored secret emits join_waiting with no host_secret key (host recovery)', async () => {
    const { useGameStore } = await load()
    useGameStore.getState().setRoom('ABC234', true)
    fire('connect')
    expect(emittedEvents()).toEqual([['join_waiting', { room_id: 'ABC234' }]])
    expect(h.emitted[0].args[0]).not.toHaveProperty('host_secret')
  })

  it('a player with a stored session token emits join {room_id, session_token, display_name?}', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    storage.setSessionToken('ABC234', 'tok-1')
    storage.setDisplayName('Ana')
    fire('connect')
    expect(emittedEvents()).toEqual([['join', { room_id: 'ABC234', session_token: 'tok-1', display_name: 'Ana' }]])
  })

  it('a player with a token but no stored name omits display_name', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    storage.setSessionToken('ABC234', 'tok-1')
    fire('connect')
    expect(emittedEvents()).toEqual([['join', { room_id: 'ABC234', session_token: 'tok-1' }]])
    expect(h.emitted[0].args[0]).not.toHaveProperty('display_name')
  })

  it('a player without a session token emits nothing', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    storage.setDisplayName('Ana')
    fire('connect')
    expect(h.emitted).toEqual([])
  })

  it('a player with a token for another room only emits nothing', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    storage.setSessionToken('XYZ789', 'tok-other')
    fire('connect')
    expect(h.emitted).toEqual([])
  })

  it('emits nothing when no room is set', async () => {
    const { storage } = await load()
    storage.setSessionToken('ABC234', 'tok-1')
    storage.setHostSecret('ABC234', 's')
    fire('connect')
    expect(h.emitted).toEqual([])
  })

  it('emits once per connect and again on each reconnect', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    storage.setSessionToken('ABC234', 'tok-1')
    fire('connect')
    expect(h.emitted).toHaveLength(1)
    fire('connect')
    expect(h.emitted).toHaveLength(2)
  })
})

describe('connect_error (criterion 7)', () => {
  const COPY = 'Could not reach the game server.'

  it('sets connectionError and raises exactly one error alert across repeated failures', async () => {
    const { useGameStore } = await load()
    fire('connect_error', new Error('xhr poll error'))
    fire('connect_error', new Error('xhr poll error'))
    fire('connect_error', new Error('websocket error'))
    const s = useGameStore.getState()
    expect(s.connectionError).toBe(COPY)
    expect(s.alerts).toHaveLength(1)
    expect(s.alerts[0]).toMatchObject({ kind: 'error', message: COPY })
  })

  it('a connect clears the error, so the next failure alerts again', async () => {
    const { useGameStore } = await load()
    fire('connect_error', new Error('x'))
    fire('connect')
    expect(useGameStore.getState().connectionError).toBeNull()
    expect(useGameStore.getState().alerts).toHaveLength(1)
    fire('connect_error', new Error('x'))
    expect(useGameStore.getState().connectionError).toBe(COPY)
    expect(useGameStore.getState().alerts).toHaveLength(2)
  })
})

describe('credentials: where they are stored (criterion 4, failure modes 4 and 5)', () => {
  it('joined stores the session token in localStorage for that room only, and never in sessionStorage', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    fire('joined', { alias: 'P2', session_token: 'tok-joined', display_name: 'Bo' })
    expect(storage.getSessionToken('ABC234')).toBe('tok-joined')
    expect(window.localStorage.getItem('pulky.session_token.ABC234')).toBe('tok-joined')
    expect(storage.getSessionToken('XYZ789')).toBeNull()
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i) as string
      expect(window.sessionStorage.getItem(key)).not.toBe('tok-joined')
    }
    expect(useGameStore.getState().myAlias).toBe('P2')
  })

  it('joined does not overwrite another room\'s token', async () => {
    const { useGameStore, storage } = await load()
    storage.setSessionToken('XYZ789', 'tok-x')
    useGameStore.getState().setRoom('ABC234', false)
    fire('joined', { alias: 'P2', session_token: 'tok-a', display_name: 'Bo' })
    expect(storage.getSessionToken('XYZ789')).toBe('tok-x')
    expect(storage.getSessionToken('ABC234')).toBe('tok-a')
  })

  it('joined with a display_name changes nothing else', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    fire('joined', { alias: 'P2', session_token: 'tok-joined', display_name: 'Bo' })
    expect(storage.getDisplayName()).toBeNull()
  })

  it('host_claimed stores the host secret in sessionStorage only', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', true)
    fire('host_claimed', { room_id: 'ABC234', host_secret: 'the-host-secret' })
    expect(storage.getHostSecret('ABC234')).toBe('the-host-secret')
    expect(window.sessionStorage.getItem('pulky.host_secret.ABC234')).toBe('the-host-secret')
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) as string
      expect(window.localStorage.getItem(key)).not.toBe('the-host-secret')
      expect(key).not.toContain('host_secret')
    }
    expect(useGameStore.getState().hostClaimed).toBe(true)
  })

  it('leave_ack clears that room\'s session token only and the alias', async () => {
    const { useGameStore, storage } = await load()
    storage.setSessionToken('ABC234', 'tok-a')
    storage.setSessionToken('XYZ789', 'tok-x')
    useGameStore.getState().setRoom('ABC234', false)
    fire('joined', { alias: 'P2', session_token: 'tok-a2', display_name: 'Bo' })
    fire('leave_ack', { room_id: 'ABC234' })
    expect(storage.getSessionToken('ABC234')).toBeNull()
    expect(storage.getSessionToken('XYZ789')).toBe('tok-x')
    expect(useGameStore.getState().myAlias).toBeNull()
  })
})

describe('game_finished keys this tab\'s credentials by game id (the room code is reissued)', () => {
  const finished = (gameId: string) => ({
    seq: 30,
    game_id: gameId,
    days_played: 14,
    ended_early: false,
    leaderboard: [],
    stats: { players: {}, market: {} },
  })

  it('the host tab copies the room\'s host secret to the game', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', true)
    storage.setHostSecret('ABC234', 'the-host-secret')
    fire('game_finished', finished('9f2c1a'))
    expect(storage.getGameHostSecret('9f2c1a')).toBe('the-host-secret')
    expect(storage.hasPlayedGame('9f2c1a')).toBe(false)
  })

  it('a seated player\'s tab marks the game played and gets no host secret', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    fire('joined', { alias: 'P2', session_token: 'tok', display_name: 'Bo' })
    fire('game_finished', finished('9f2c1a'))
    expect(storage.hasPlayedGame('9f2c1a')).toBe(true)
    expect(storage.getGameHostSecret('9f2c1a')).toBeNull()
  })

  it('a tab with neither credential stores nothing', async () => {
    const { useGameStore, storage } = await load()
    useGameStore.getState().setRoom('ABC234', false)
    fire('game_finished', finished('9f2c1a'))
    expect(storage.hasPlayedGame('9f2c1a')).toBe(false)
    expect(storage.getGameHostSecret('9f2c1a')).toBeNull()
  })
})

describe('every server event reaches the store', () => {
  it('drives each of the twenty events through its listener', async () => {
    const { useGameStore } = await load()
    const S = () => useGameStore.getState()
    S().setRoom('ABC234', true)

    fire('lobby_update', { seq: 1, state: 'configuring', participants: [{ alias: 'P1', display_name: 'Ana', connected: true }], seats_total: 4, config_locked: false, can_start: false, start_blocked_reason: 'Waiting for at least 2 players.' })
    expect(S().participants).toHaveLength(1)
    expect(S().seatsTotal).toBe(4)

    fire('config_updated', { seq: 2, config: FULL_CONFIG })
    expect(S().config).toEqual(FULL_CONFIG)

    fire('game_started', { seq: 3, duration_days: 14, participants: [{ alias: 'P1', display_name: 'Ana', connected: true }], config: { transport: { unit_cost: 1 } } })
    expect(S().roomState).toBe('running')
    expect(S().durationDays).toBe(14)
    expect(S().config).toEqual(FULL_CONFIG)

    fire('day_opened', { seq: 4, brief: { day: 1 } })
    expect(S().brief).toMatchObject({ day: 1 })

    fire('your_state', { seq: 5, full: true, alias: 'P1', day: 1, awaiting: ['P1'], own_history: [], public_history: [] })
    expect(S().playerView).toMatchObject({ day: 1 })

    fire('host_state', { seq: 6, full: true, state: 'running', day: 1, duration_days: 14, config: FULL_CONFIG, awaiting: ['P1'], players: {}, public_history: [], market_history: [], leaderboard: [] })
    expect(S().hostView).toMatchObject({ day: 1 })

    fire('decision_submitted', { seq: 7, day: 1, alias: 'P1', awaiting: [] })
    expect(S().submittedAliases).toEqual(['P1'])

    fire('day_closed', { seq: 8, day: 1, public: { day: 1, players: {} } })
    expect(S().lastDayClosed).toMatchObject({ day: 1 })
    expect(S().publicHistory.map((p) => p.day)).toEqual([1])

    fire('your_day_closed', { seq: 9, day: 1, record: { day: 1, profit: 5 } })
    expect(S().lastRecord).toMatchObject({ day: 1 })

    fire('participant_disconnected', { seq: 10, alias: 'P1', display_name: 'Ana' })
    expect(S().participants[0].connected).toBe(false)
    fire('participant_reconnected', { seq: 11, alias: 'P1', display_name: 'Ana' })
    expect(S().participants[0].connected).toBe(true)

    fire('host_disconnected', { seq: 12 })
    expect(S().hostConnected).toBe(false)
    fire('host_reconnected', { seq: 13 })
    expect(S().hostConnected).toBe(true)

    fire('game_finished', { seq: 14, game_id: 'f00d', days_played: 1, ended_early: true, leaderboard: [], stats: { players: {}, market: {} } })
    expect(S().roomState).toBe('finished')
    expect(S().gamePublicId).toBe('f00d')
    fire('game_persisted', { seq: 15, game_id: 'f00d' })
    expect(S().gamePublicId).toBe('f00d')

    fire('join_error', { message: 'This room is full.' })
    expect(S().joinError).toBe('This room is full.')
    fire('error', { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' })
    expect(S().lastError).toMatchObject({ code: 'SERVER_ERROR' })
  })

  it('drops a replayed sequenced event delivered by the socket', async () => {
    const { useGameStore } = await load()
    fire('decision_submitted', { seq: 4, day: 1, alias: 'P1', awaiting: ['P2'] })
    fire('decision_submitted', { seq: 4, day: 1, alias: 'P1', awaiting: ['P2'] })
    expect(useGameStore.getState().submittedAliases).toEqual(['P1'])
  })
})

describe('the app does not register handlers (criterion 3, failure mode 6)', () => {
  async function renderApp(): Promise<void> {
    const { AuthProvider } = await import('../auth/AuthContext')
    const { BackendStatusProvider } = await import('../contexts/BackendStatusContext')
    const { default: App } = await import('../App')
    const tree: ReactElement = (
      <StrictMode>
        <AuthProvider>
          <BackendStatusProvider>
            <MemoryRouter initialEntries={['/']}>
              <App />
            </MemoryRouter>
          </BackendStatusProvider>
        </AuthProvider>
      </StrictMode>
    )
    render(tree)
    render(tree)
  }

  it('rendering <App/> under StrictMode twice adds no listener to any event', async () => {
    await load()
    const before = SERVER_EVENTS.map((e) => h.fake.listeners(e).length)
    expect(before.every((n) => n === 1)).toBe(true)
    await renderApp()
    expect(SERVER_EVENTS.map((e) => h.fake.listeners(e).length)).toEqual(before)
  })

  it('one emitted decision_submitted appends once and one error event raises one alert after a StrictMode render', async () => {
    const { useGameStore } = await load()
    await renderApp()
    fire('decision_submitted', { seq: 1, day: 1, alias: 'P1', awaiting: ['P2'] })
    expect(useGameStore.getState().submittedAliases).toEqual(['P1'])
    // `error` has no seq, so a duplicated listener would raise two alerts
    fire('error', { code: 'INVALID_DECISION', message: 'Orders must be whole numbers from 0 to 9,999.' })
    expect(useGameStore.getState().alerts).toHaveLength(1)
    fire('day_closed', { seq: 2, day: 1, public: { day: 1, players: {} } })
    expect(useGameStore.getState().publicHistory.map((p) => p.day)).toEqual([1])
  })
})
