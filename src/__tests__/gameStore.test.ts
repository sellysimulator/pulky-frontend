import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { GameActions } from '../store/gameStore'

const S = () => useGameStore.getState()

/** Calls a store action by name with a wire payload (payloads here carry only the keys a test needs). */
function call<K extends keyof GameActions>(name: K, payload?: object): void {
  const fn = S()[name] as unknown as (p?: unknown) => unknown
  fn(payload)
}

/** The data (non-function) part of the store, deep-copied. */
function data(): Record<string, unknown> {
  const entries = Object.entries(S()).filter(([, v]) => typeof v !== 'function')
  return structuredClone(Object.fromEntries(entries))
}

const rec = (day: number, extra: object = {}) => ({ day, profit: day * 10, ...extra })
const pub = (day: number) => ({ day, weekday: 'mon', demand_total: 100, players: {} })
const mkt = (day: number) => ({ day, weekday: 'mon', spot_price: 12 })
const recs = (...days: number[]) => days.map((d) => rec(d))
const pubs = (...days: number[]) => days.map(pub)
const days = (list: Array<{ day: number }>) => list.map((x) => x.day)

const FULL_CONFIG = {
  random_seed: null,
  max_players: 4,
  duration_days: 14,
  demand: { retail_price: 30, backlog_penalty: 1.5, weekday_peak: { from: 'thu', to: 'sat' } },
  stock: { holding_cost: 0.2, conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
  transport: { unit_cost: 1, failure_probability: 0.1, loss_fraction: 0.3 },
  peer_market: { enabled: true },
}

const PUBLIC_CONFIG = {
  demand: { retail_price: 25 },
  stock: { conservation_extra_fresh_days: 3, conservation_cost_per_unit: 2 },
  peer_market: { enabled: false },
  transport: { unit_cost: 1.5 },
}

function leaves(value: unknown): number {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value as Record<string, unknown>).reduce<number>((n, v) => n + leaves(v), 0)
  }
  return 1
}

const player = (alias: string, connected = true) => ({ alias, display_name: `Name ${alias}`, connected })

function yourState(seq: number, day: number, full: boolean, extra: object = {}) {
  return {
    seq,
    full,
    alias: 'P1',
    display_name: 'Ana',
    day,
    duration_days: 14,
    weekday: 'mon',
    phase: 'deciding',
    has_submitted: false,
    awaiting: ['P1', 'P2'],
    ...extra,
  }
}

function hostPlayer(alias: string, extra: object = {}) {
  return { display_name: `Name ${alias}`, connected: true, has_submitted: false, ...extra }
}

function hostState(seq: number, day: number, full: boolean, extra: object = {}) {
  return {
    seq,
    full,
    state: 'running',
    day,
    duration_days: 14,
    weekday: 'mon',
    phase: 'deciding',
    seed: 1,
    config: FULL_CONFIG,
    awaiting: ['P1'],
    players: {},
    leaderboard: [],
    ...extra,
  }
}

beforeEach(() => {
  useGameStore.setState(structuredClone(INITIAL_STATE))
})

describe('INITIAL_STATE and reset (criterion 1)', () => {
  const EXPECTED = {
    roomCode: null,
    isHost: false,
    myAlias: null,
    roomState: null,
    participants: [],
    seatsTotal: null,
    configLocked: false,
    canStart: false,
    startBlockedReason: null,
    joinError: null,
    hostClaimed: false,
    hostConnected: true,
    config: null,
    durationDays: null,
    lastSeq: 0,
    brief: null,
    playerView: null,
    hostView: null,
    submittedAliases: [],
    awaiting: [],
    lastDayClosed: null,
    lastRecord: null,
    ownHistory: [],
    publicHistory: [],
    hostHistories: {},
    marketHistory: [],
    finished: null,
    gamePublicId: null,
    alerts: [],
    connectionError: null,
    lastError: null,
  }

  it('is exactly the documented state', () => {
    expect(INITIAL_STATE).toEqual(EXPECTED)
  })

  it('is what a fresh store holds', () => {
    expect(data()).toEqual(EXPECTED)
  })

  it('reset() restores it after the store has been written to', () => {
    S().setRoom('ABC234', true)
    call('applyJoined', { alias: 'P1', session_token: 't', display_name: 'Ana' })
    call('applyLobbyUpdate', { seq: 3, state: 'configuring', participants: [player('P1')], seats_total: 4, config_locked: true, can_start: true, start_blocked_reason: 'x' })
    call('applyDayOpened', { seq: 4, brief: { day: 2 } })
    call('applyYourDayClosed', { seq: 5, day: 1, record: rec(1) })
    call('applyHostDisconnected', { seq: 6 })
    call('applyError', { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' })
    S().setConnectionError('down')
    expect(data()).not.toEqual(EXPECTED)
    S().reset()
    expect(data()).toEqual(EXPECTED)
  })
})

describe('setRoom', () => {
  it('records the room and the host flag', () => {
    S().setRoom('ABC234', true)
    expect(S().roomCode).toBe('ABC234')
    expect(S().isHost).toBe(true)
  })

  it('resets everything else, lastSeq included, when the code changes', () => {
    S().setRoom('ABC234', false)
    call('applyDayOpened', { seq: 9, brief: { day: 3 } })
    call('applyLobbyUpdate', { seq: 10, state: 'running', participants: [player('P1')], seats_total: 4, config_locked: true, can_start: false, start_blocked_reason: null })
    expect(S().lastSeq).toBe(10)
    S().setRoom('XYZ789', false)
    expect(S().roomCode).toBe('XYZ789')
    expect(S().lastSeq).toBe(0)
    expect(S().brief).toBeNull()
    expect(S().participants).toEqual([])
    expect(S().roomState).toBeNull()
    // the new room's first event applies
    call('applyDayOpened', { seq: 1, brief: { day: 1 } })
    expect(S().brief).toMatchObject({ day: 1 })
  })

  it('keeps the held state when the same code is set again', () => {
    S().setRoom('ABC234', false)
    call('applyDayOpened', { seq: 9, brief: { day: 3 } })
    S().setRoom('ABC234', false)
    expect(S().lastSeq).toBe(9)
    expect(S().brief).toMatchObject({ day: 3 })
  })
})

describe('the seq gate (criterion 2, failure modes 1 and 2)', () => {
  interface Case {
    action: keyof GameActions
    payload: (seq: number) => object
    prepare?: () => void
    applied: () => boolean
  }

  const cases: Case[] = [
    {
      action: 'applyLobbyUpdate',
      payload: (seq) => ({ seq, state: 'configuring', participants: [player('P1')], seats_total: 4, config_locked: false, can_start: false, start_blocked_reason: 'Waiting for at least 2 players.' }),
      applied: () => S().seatsTotal === 4,
    },
    { action: 'applyConfigUpdated', payload: (seq) => ({ seq, config: FULL_CONFIG }), applied: () => S().config !== null },
    {
      action: 'applyGameStarted',
      payload: (seq) => ({ seq, duration_days: 14, participants: [player('P1')], config: PUBLIC_CONFIG }),
      applied: () => S().durationDays === 14,
    },
    { action: 'applyDayOpened', payload: (seq) => ({ seq, brief: { day: 3 } }), applied: () => S().brief !== null },
    { action: 'applyYourState', payload: (seq) => yourState(seq, 3, false), applied: () => S().playerView !== null },
    { action: 'applyHostState', payload: (seq) => hostState(seq, 3, false), applied: () => S().hostView !== null },
    {
      action: 'applyDecisionSubmitted',
      payload: (seq) => ({ seq, day: 3, alias: 'P1', awaiting: ['P2'] }),
      applied: () => S().submittedAliases.includes('P1'),
    },
    { action: 'applyDayClosed', payload: (seq) => ({ seq, day: 3, public: pub(3) }), applied: () => S().lastDayClosed !== null },
    { action: 'applyYourDayClosed', payload: (seq) => ({ seq, day: 3, record: rec(3) }), applied: () => S().lastRecord !== null },
    {
      action: 'applyParticipantDisconnected',
      payload: (seq) => ({ seq, alias: 'P1', display_name: 'Name P1' }),
      prepare: () => useGameStore.setState({ participants: [player('P1', true)] }),
      applied: () => S().participants[0].connected === false,
    },
    {
      action: 'applyParticipantReconnected',
      payload: (seq) => ({ seq, alias: 'P1', display_name: 'Name P1' }),
      prepare: () => useGameStore.setState({ participants: [player('P1', false)] }),
      applied: () => S().participants[0].connected === true,
    },
    { action: 'applyHostDisconnected', payload: (seq) => ({ seq }), applied: () => S().hostConnected === false },
    {
      action: 'applyHostReconnected',
      payload: (seq) => ({ seq }),
      prepare: () => useGameStore.setState({ hostConnected: false }),
      applied: () => S().hostConnected === true,
    },
    {
      action: 'applyGameFinished',
      payload: (seq) => ({ seq, game_id: 'g1', days_played: 3, ended_early: true, leaderboard: [], stats: { players: {}, market: {} } }),
      applied: () => S().finished !== null,
    },
    { action: 'applyGamePersisted', payload: (seq) => ({ seq, game_id: 'abc123' }), applied: () => S().gamePublicId === 'abc123' },
  ]

  describe.each(cases)('$action', ({ action, payload, prepare, applied }) => {
    beforeEach(() => {
      useGameStore.setState({ lastSeq: 7 })
      prepare?.()
    })

    it('ignores a duplicate (seq equal to lastSeq)', () => {
      const before = data()
      call(action, payload(7))
      expect(data()).toEqual(before)
    })

    it('ignores a stale seq', () => {
      const before = data()
      call(action, payload(3))
      expect(data()).toEqual(before)
    })

    it('applies a newer seq and records it', () => {
      expect(applied()).toBe(false)
      call(action, payload(8))
      expect(applied()).toBe(true)
      expect(S().lastSeq).toBe(8)
    })
  })

  it('the worked example: lastSeq 7, seq 7 no-op, seq 8 applies, joined always applies', () => {
    useGameStore.setState({ lastSeq: 7 })
    call('applyDayOpened', { seq: 7, brief: { day: 1 } })
    expect(S().brief).toBeNull()
    call('applyDayOpened', { seq: 8, brief: { day: 1 } })
    expect(S().brief).toMatchObject({ day: 1 })
    call('applyJoined', { alias: 'P2', session_token: 't', display_name: 'Bo' })
    expect(S().myAlias).toBe('P2')
  })

  it('failure mode 1: the same decision_submitted twice leaves one alias', () => {
    call('applyDecisionSubmitted', { seq: 5, day: 2, alias: 'P1', awaiting: ['P2'] })
    call('applyDecisionSubmitted', { seq: 5, day: 2, alias: 'P1', awaiting: ['P2'] })
    expect(S().submittedAliases).toEqual(['P1'])
  })

  it('a later decision_submitted for the same alias still lists it once', () => {
    call('applyDecisionSubmitted', { seq: 5, day: 2, alias: 'P1', awaiting: ['P2'] })
    call('applyDecisionSubmitted', { seq: 6, day: 2, alias: 'P1', awaiting: ['P2'] })
    call('applyDecisionSubmitted', { seq: 7, day: 2, alias: 'P2', awaiting: [] })
    expect(S().submittedAliases).toEqual(['P1', 'P2'])
  })

  it('failure mode 2: a your_state with seq 5 after seq 9 does not replace the newer view', () => {
    call('applyYourState', yourState(9, 6, true, { own_history: recs(1, 2, 3, 4, 5), public_history: pubs(1, 2, 3, 4, 5) }))
    expect(S().playerView).toMatchObject({ day: 6 })
    call('applyYourState', yourState(5, 4, true, { own_history: recs(1, 2, 3), public_history: pubs(1, 2, 3) }))
    expect(S().playerView).toMatchObject({ day: 6 })
    expect(days(S().ownHistory)).toEqual([1, 2, 3, 4, 5])
    expect(days(S().publicHistory)).toEqual([1, 2, 3, 4, 5])
    expect(S().lastSeq).toBe(9)
  })

  it('failure mode 2 for the host: a stale host_state does not replace the newer view', () => {
    S().setRoom('ABC234', true)
    call('applyHostState', hostState(9, 6, true, { public_history: pubs(1, 2), market_history: [mkt(1), mkt(2)] }))
    call('applyHostState', hostState(5, 4, true, { public_history: pubs(1), market_history: [mkt(1)] }))
    expect(S().hostView).toMatchObject({ day: 6 })
    expect(days(S().publicHistory)).toEqual([1, 2])
    expect(days(S().marketHistory)).toEqual([1, 2])
  })

  describe('the five unsequenced events always apply, even with a high lastSeq', () => {
    beforeEach(() => {
      useGameStore.setState({ lastSeq: 50 })
    })

    it('joined', () => {
      call('applyJoined', { alias: 'P3', session_token: 'tok', display_name: 'Cy' })
      expect(S().myAlias).toBe('P3')
      expect(S().lastSeq).toBe(50)
    })

    it('host_claimed', () => {
      call('applyHostClaimed', { room_id: 'ABC234', host_secret: 's' })
      expect(S().hostClaimed).toBe(true)
      expect(S().lastSeq).toBe(50)
    })

    it('join_error', () => {
      call('applyJoinError', { message: 'This room is full.' })
      expect(S().joinError).toBe('This room is full.')
      expect(S().lastSeq).toBe(50)
    })

    it('leave_ack', () => {
      useGameStore.setState({ myAlias: 'P3' })
      call('applyLeaveAck', { room_id: 'ABC234' })
      expect(S().myAlias).toBeNull()
      expect(S().lastSeq).toBe(50)
    })

    it('error', () => {
      call('applyError', { code: 'NOT_IN_ROOM', message: 'You are not in this room.' })
      expect(S().lastError).toMatchObject({ code: 'NOT_IN_ROOM' })
      expect(S().lastSeq).toBe(50)
    })
  })
})

describe('what each applier writes (spec 3.2)', () => {
  it('joined sets myAlias, clears joinError and keeps credentials out of the store', () => {
    useGameStore.setState({ joinError: 'This room is full.' })
    call('applyJoined', { alias: 'P2', session_token: 'super-secret-token', display_name: 'Bo' })
    expect(S().myAlias).toBe('P2')
    expect(S().joinError).toBeNull()
    expect(JSON.stringify(data())).not.toContain('super-secret-token')
  })

  it('host_claimed sets hostClaimed, clears joinError and keeps the secret out of the store', () => {
    useGameStore.setState({ joinError: 'x' })
    call('applyHostClaimed', { room_id: 'ABC234', host_secret: 'super-secret-host' })
    expect(S().hostClaimed).toBe(true)
    expect(S().joinError).toBeNull()
    expect(JSON.stringify(data())).not.toContain('super-secret-host')
  })

  it('join_error sets joinError and raises one error alert with the same message; clearJoinError clears it', () => {
    call('applyJoinError', { message: 'No room with that code.' })
    expect(S().joinError).toBe('No room with that code.')
    expect(S().alerts).toHaveLength(1)
    expect(S().alerts[0]).toMatchObject({ kind: 'error', message: 'No room with that code.' })
    S().clearJoinError()
    expect(S().joinError).toBeNull()
  })

  it('lobby_update writes the lobby fields', () => {
    call('applyLobbyUpdate', {
      seq: 1,
      state: 'configuring',
      participants: [player('P1'), player('P2', false)],
      seats_total: 6,
      config_locked: true,
      can_start: true,
      start_blocked_reason: 'The game has already started.',
    })
    expect(S()).toMatchObject({
      roomState: 'configuring',
      seatsTotal: 6,
      configLocked: true,
      canStart: true,
      startBlockedReason: 'The game has already started.',
    })
    expect(S().participants).toEqual([player('P1'), player('P2', false)])
    expect(S().config).toBeNull()
  })

  it('day_opened sets the brief and empties submittedAliases', () => {
    call('applyDecisionSubmitted', { seq: 1, day: 1, alias: 'P1', awaiting: ['P2'] })
    expect(S().submittedAliases).toEqual(['P1'])
    call('applyDayOpened', { seq: 2, brief: { day: 2, weekday: 'tue' } })
    expect(S().brief).toMatchObject({ day: 2, weekday: 'tue' })
    expect(S().submittedAliases).toEqual([])
  })

  it('decision_submitted replaces awaiting with the server list', () => {
    call('applyDecisionSubmitted', { seq: 1, day: 1, alias: 'P1', awaiting: ['P2', 'P3'] })
    expect(S().awaiting).toEqual(['P2', 'P3'])
    call('applyDecisionSubmitted', { seq: 2, day: 1, alias: 'P2', awaiting: ['P3'] })
    expect(S().awaiting).toEqual(['P3'])
    call('applyDecisionSubmitted', { seq: 3, day: 1, alias: 'P3', awaiting: [] })
    expect(S().awaiting).toEqual([])
  })

  it('day_closed keeps the payload and appends its public results', () => {
    const payload = { seq: 4, day: 2, public: pub(2) }
    call('applyDayClosed', payload)
    expect(S().lastDayClosed).toEqual(payload)
    expect(days(S().publicHistory)).toEqual([2])
  })

  it('your_day_closed sets lastRecord and appends the record', () => {
    call('applyYourDayClosed', { seq: 4, day: 2, record: rec(2, { sold: 11 }) })
    expect(S().lastRecord).toMatchObject({ day: 2, sold: 11 })
    expect(days(S().ownHistory)).toEqual([2])
  })

  it('participant and host presence flip only the named party', () => {
    useGameStore.setState({ participants: [player('P1'), player('P2')] })
    call('applyParticipantDisconnected', { seq: 1, alias: 'P2', display_name: 'Name P2' })
    expect(S().participants.map((p) => p.connected)).toEqual([true, false])
    call('applyParticipantReconnected', { seq: 2, alias: 'P2', display_name: 'Name P2' })
    expect(S().participants.map((p) => p.connected)).toEqual([true, true])
    expect(S().hostConnected).toBe(true)
    call('applyHostDisconnected', { seq: 3 })
    expect(S().hostConnected).toBe(false)
    expect(S().participants.map((p) => p.connected)).toEqual([true, true])
    call('applyHostReconnected', { seq: 4 })
    expect(S().hostConnected).toBe(true)
  })

  it('game_finished keeps the payload, finishes the room and takes the game id; game_persisted keeps it', () => {
    const payload = { seq: 8, game_id: 'f00d', days_played: 14, ended_early: false, leaderboard: [{ rank: 1, alias: 'P1' }], stats: { players: {}, market: {} } }
    call('applyGameFinished', payload)
    expect(S().finished).toEqual(payload)
    expect(S().roomState).toBe('finished')
    expect(S().gamePublicId).toBe('f00d')
    call('applyGamePersisted', { seq: 9, game_id: 'f00d' })
    expect(S().gamePublicId).toBe('f00d')
  })

  describe('error', () => {
    it('keeps the error and raises one error alert with the server message', () => {
      const err = { code: 'INVALID_DECISION', message: 'Orders must be whole numbers from 0 to 9,999.' }
      call('applyError', err)
      expect(S().lastError).toMatchObject(err)
      expect(S().alerts).toHaveLength(1)
      expect(S().alerts[0]).toMatchObject({ kind: 'error', message: err.message })
    })

    it.each(['NOT_IN_ROOM', 'STALE_DAY', 'ALREADY_SUBMITTED', 'INVALID_CONFIG', 'INVALID_HOST_SECRET', 'GAME_NOT_RUNNING', 'SERVER_ERROR'])(
      'code %s raises an alert',
      (code) => {
        call('applyError', { code, message: `message for ${code}` })
        expect(S().alerts.map((a) => a.message)).toEqual([`message for ${code}`])
      },
    )

    it('GAME_FINISHED raises no alert but is still recorded', () => {
      call('applyError', { code: 'GAME_FINISHED', message: 'The game is over.' })
      expect(S().alerts).toEqual([])
      expect(S().lastError).toMatchObject({ code: 'GAME_FINISHED' })
    })

    it('clearLastError clears it', () => {
      call('applyError', { code: 'GAME_FINISHED', message: 'The game is over.' })
      S().clearLastError()
      expect(S().lastError).toBeNull()
    })
  })

  describe('alerts, config and connection error', () => {
    it('addAlert returns the id of the stored alert; dismissAlert removes only that one', () => {
      const a = S().addAlert({ kind: 'info', message: 'one' })
      const b = S().addAlert({ kind: 'success', message: 'two' })
      expect(typeof a).toBe('string')
      expect(a).not.toBe(b)
      expect(S().alerts).toEqual([
        { id: a, kind: 'info', message: 'one' },
        { id: b, kind: 'success', message: 'two' },
      ])
      S().dismissAlert(a)
      expect(S().alerts).toEqual([{ id: b, kind: 'success', message: 'two' }])
      S().dismissAlert('does-not-exist')
      expect(S().alerts).toHaveLength(1)
    })

    it('setConfig stores the config as given; setConnectionError sets and clears', () => {
      S().setConfig(FULL_CONFIG as never)
      expect(S().config).toEqual(FULL_CONFIG)
      S().setConnectionError('down')
      expect(S().connectionError).toBe('down')
      S().setConnectionError(null)
      expect(S().connectionError).toBeNull()
    })
  })
})

describe('config under the host rule (criterion 6, failure mode 3)', () => {
  it.each([
    ['applyConfigUpdated', (seq: number, config: object) => ({ seq, config })],
    ['applyGameStarted', (seq: number, config: object) => ({ seq, duration_days: 14, participants: [], config })],
  ] as const)('%s: a host keeps its full config when the event carries config_public', (action, make) => {
    S().setRoom('ABC234', true)
    call('applyConfigUpdated', { seq: 1, config: FULL_CONFIG })
    expect(S().config).toEqual(FULL_CONFIG)
    call(action, make(2, PUBLIC_CONFIG))
    const config = S().config as unknown as typeof FULL_CONFIG
    expect(config.transport.failure_probability).toBeDefined()
    expect(config.stock.holding_cost).toBeDefined()
    expect(config).toEqual(FULL_CONFIG)
    expect(config.transport.failure_probability).toBe(0.1)
  })

  it('a host takes a config that carries random_seed, even when it is null', () => {
    S().setRoom('ABC234', true)
    call('applyConfigUpdated', { seq: 1, config: FULL_CONFIG })
    const next = { ...FULL_CONFIG, random_seed: null, max_players: 6 }
    call('applyConfigUpdated', { seq: 2, config: next })
    expect(S().config).toEqual(next)
    const seeded = { ...FULL_CONFIG, random_seed: 42, max_players: 8 }
    call('applyConfigUpdated', { seq: 3, config: seeded })
    expect(S().config).toEqual(seeded)
  })

  it('applyHostState also supplies the host config', () => {
    S().setRoom('ABC234', true)
    call('applyHostState', hostState(1, 1, true))
    expect(S().config).toEqual(FULL_CONFIG)
    call('applyConfigUpdated', { seq: 2, config: PUBLIC_CONFIG })
    expect(S().config).toEqual(FULL_CONFIG)
  })

  it.each([
    ['applyConfigUpdated', (seq: number, config: object) => ({ seq, config })],
    ['applyGameStarted', (seq: number, config: object) => ({ seq, duration_days: 14, participants: [], config })],
  ] as const)('%s: a player takes config_public, which has exactly the five shown leaves', (action, make) => {
    S().setRoom('ABC234', false)
    call(action, make(1, PUBLIC_CONFIG))
    expect(S().config).toEqual(PUBLIC_CONFIG)
    expect(leaves(S().config)).toBe(5)
    const config = S().config as unknown as typeof PUBLIC_CONFIG
    expect(config.demand.retail_price).toBe(25)
    expect(config.transport.unit_cost).toBe(1.5)
  })

  it('game_started also writes durationDays, participants and roomState running', () => {
    S().setRoom('ABC234', false)
    call('applyGameStarted', { seq: 1, duration_days: 21, participants: [player('P1'), player('P2')], config: PUBLIC_CONFIG })
    expect(S().durationDays).toBe(21)
    expect(S().participants).toEqual([player('P1'), player('P2')])
    expect(S().roomState).toBe('running')
  })
})

describe('your_state (spec 3.2, 12.6)', () => {
  it('writes the view and awaiting, and leaves roomState alone', () => {
    useGameStore.setState({ roomState: 'running' })
    call('applyYourState', yourState(1, 4, false, { awaiting: ['P2', 'P3'] }))
    expect(S().playerView).toMatchObject({ alias: 'P1', day: 4, full: false })
    expect(S().awaiting).toEqual(['P2', 'P3'])
    expect(S().roomState).toBe('running')
  })

  it('a full state replaces both histories and sets lastRecord to the last own record', () => {
    useGameStore.setState({ ownHistory: recs(1, 2, 3, 4, 5, 6) as never, publicHistory: pubs(1, 2, 3, 4, 5, 6) as never })
    call('applyYourState', yourState(1, 3, true, { own_history: recs(1, 2), public_history: pubs(1, 2) }))
    expect(days(S().ownHistory)).toEqual([1, 2])
    expect(days(S().publicHistory)).toEqual([1, 2])
    expect(S().lastRecord).toMatchObject({ day: 2 })
  })

  it('a full state with no own records sets lastRecord to null', () => {
    useGameStore.setState({ lastRecord: rec(4) as never })
    call('applyYourState', yourState(1, 1, true, { own_history: [], public_history: [] }))
    expect(S().lastRecord).toBeNull()
    expect(S().ownHistory).toEqual([])
  })

  it('failure mode 12: a daily state (no history keys) after a full one leaves the history intact', () => {
    call('applyYourState', yourState(1, 4, true, { own_history: recs(1, 2, 3), public_history: pubs(1, 2, 3) }))
    const lastRecord = S().lastRecord
    call('applyYourState', yourState(2, 4, false))
    expect(days(S().ownHistory)).toEqual([1, 2, 3])
    expect(days(S().publicHistory)).toEqual([1, 2, 3])
    expect(S().lastRecord).toEqual(lastRecord)
  })
})

describe('the append rule (spec 12.6, failure mode 13)', () => {
  beforeEach(() => {
    call('applyYourState', yourState(1, 4, true, { own_history: recs(1, 2, 3), public_history: pubs(1, 2, 3) }))
  })

  it('appends a later day', () => {
    call('applyYourDayClosed', { seq: 2, day: 4, record: rec(4) })
    call('applyDayClosed', { seq: 3, day: 4, public: pub(4) })
    expect(days(S().ownHistory)).toEqual([1, 2, 3, 4])
    expect(days(S().publicHistory)).toEqual([1, 2, 3, 4])
  })

  it('ignores a day already held (after a full resync) and does not add a second entry', () => {
    call('applyYourDayClosed', { seq: 2, day: 3, record: rec(3) })
    call('applyDayClosed', { seq: 3, day: 3, public: pub(3) })
    expect(days(S().ownHistory)).toEqual([1, 2, 3])
    expect(days(S().publicHistory)).toEqual([1, 2, 3])
  })

  it('ignores a day earlier than the last one held', () => {
    call('applyYourDayClosed', { seq: 2, day: 2, record: rec(2) })
    call('applyDayClosed', { seq: 3, day: 1, public: pub(1) })
    expect(days(S().ownHistory)).toEqual([1, 2, 3])
    expect(days(S().publicHistory)).toEqual([1, 2, 3])
  })

  it('criterion 14: a full state for day 5 then the daily events of days 5 and 6 leave days 1-6 once each', () => {
    useGameStore.setState(structuredClone(INITIAL_STATE))
    call('applyYourState', yourState(10, 5, true, { own_history: recs(1, 2, 3, 4, 5), public_history: pubs(1, 2, 3, 4, 5) }))
    call('applyYourDayClosed', { seq: 11, day: 5, record: rec(5) })
    call('applyDayClosed', { seq: 12, day: 5, public: pub(5) })
    call('applyYourState', yourState(13, 6, false))
    call('applyYourDayClosed', { seq: 14, day: 6, record: rec(6) })
    call('applyDayClosed', { seq: 15, day: 6, public: pub(6) })
    call('applyYourState', yourState(16, 7, false))
    expect(days(S().ownHistory)).toEqual([1, 2, 3, 4, 5, 6])
    expect(days(S().publicHistory)).toEqual([1, 2, 3, 4, 5, 6])
    expect(S().lastRecord).toMatchObject({ day: 6 })
  })
})

describe('host_state (spec 3.2, 12.5, 12.6)', () => {
  beforeEach(() => {
    S().setRoom('ABC234', true)
  })

  it('criterion 15: host_claimed, lobby_update and a running host_state end running with durationDays set', () => {
    call('applyHostClaimed', { room_id: 'ABC234', host_secret: 's' })
    call('applyLobbyUpdate', { seq: 1, state: 'configuring', participants: [player('P1'), player('P2')], seats_total: 4, config_locked: false, can_start: true, start_blocked_reason: null })
    expect(S().roomState).toBe('configuring')
    call('applyHostState', hostState(2, 1, true, { duration_days: 14 }))
    expect(S().roomState).toBe('running')
    expect(S().durationDays).toBe(14)
    expect(S().hostView).not.toBeNull()
  })

  it('criterion 15: decision_submitted replaces awaiting with the payload list', () => {
    call('applyHostState', hostState(1, 1, true, { awaiting: ['P1', 'P2', 'P3'] }))
    expect(S().awaiting).toEqual(['P1', 'P2', 'P3'])
    call('applyDecisionSubmitted', { seq: 2, day: 1, alias: 'P2', awaiting: ['P1', 'P3'] })
    expect(S().awaiting).toEqual(['P1', 'P3'])
  })

  it('writes view, state, duration and awaiting', () => {
    call('applyHostState', hostState(1, 2, false, { state: 'finished', duration_days: 10, awaiting: ['P4'] }))
    expect(S().hostView).toMatchObject({ day: 2, full: false })
    expect(S().roomState).toBe('finished')
    expect(S().durationDays).toBe(10)
    expect(S().awaiting).toEqual(['P4'])
  })

  const fullHostState = (seq: number) =>
    hostState(seq, 3, true, {
      players: {
        P1: hostPlayer('P1', { own_history: recs(1, 2) }),
        P2: hostPlayer('P2', { own_history: recs(1, 2, 3) }),
      },
      public_history: pubs(1, 2),
      market_history: [mkt(1), mkt(2)],
    })

  it('a full state replaces hostHistories per alias, publicHistory and marketHistory', () => {
    useGameStore.setState({ hostHistories: { P9: recs(1, 2, 3, 4) as never }, publicHistory: pubs(1, 2, 3, 4) as never, marketHistory: [mkt(1), mkt(2), mkt(3), mkt(4)] as never })
    call('applyHostState', fullHostState(1))
    expect(days(S().hostHistories.P1)).toEqual([1, 2])
    expect(days(S().hostHistories.P2)).toEqual([1, 2, 3])
    expect(days(S().publicHistory)).toEqual([1, 2])
    expect(days(S().marketHistory)).toEqual([1, 2])
  })

  it('a daily state appends each non-null last_record and a non-null last_market_day, once', () => {
    call('applyHostState', fullHostState(1))
    const daily = (seq: number) =>
      hostState(seq, 3, false, {
        players: {
          P1: hostPlayer('P1', { last_record: rec(3) }),
          P2: hostPlayer('P2', { last_record: null }),
        },
        last_market_day: mkt(3),
      })
    call('applyHostState', daily(2))
    expect(days(S().hostHistories.P1)).toEqual([1, 2, 3])
    expect(days(S().hostHistories.P2)).toEqual([1, 2, 3])
    expect(days(S().marketHistory)).toEqual([1, 2, 3])
    // a repeated (later seq) daily state for the same day adds nothing
    call('applyHostState', daily(3))
    expect(days(S().hostHistories.P1)).toEqual([1, 2, 3])
    expect(days(S().marketHistory)).toEqual([1, 2, 3])
  })

  it('a daily state with a null last_market_day leaves marketHistory alone and keeps publicHistory', () => {
    call('applyHostState', fullHostState(1))
    call('applyHostState', hostState(2, 3, false, { players: { P1: hostPlayer('P1', { last_record: null }) }, last_market_day: null }))
    expect(days(S().marketHistory)).toEqual([1, 2])
    expect(days(S().publicHistory)).toEqual([1, 2])
    expect(days(S().hostHistories.P1)).toEqual([1, 2])
  })

  it('day_closed appends to the host public history under the append rule', () => {
    call('applyHostState', fullHostState(1))
    call('applyDayClosed', { seq: 2, day: 3, public: pub(3) })
    call('applyDayClosed', { seq: 3, day: 3, public: pub(3) })
    expect(days(S().publicHistory)).toEqual([1, 2, 3])
  })
})
