/** Section 28 — presentationData (plan 28 §2, §3.7). Acceptance 5, 8; failure modes 1, 2, 4, 8. */
import { beforeEach, describe, expect, it } from 'vitest'

import { selectHostHistories, selectPresentationData } from '../components/host/presentationData'
import { INITIAL_STATE, useGameStore, type GameState } from '../store/gameStore'
import type { Brief, DayRecord, HostView, MarketDay, PublicDayResults } from '../types/game'

const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal' }

const PRESENTATION_KEYS = ['brief', 'day', 'durationDays', 'isPeak', 'latest', 'peerMarket', 'submitted', 'weekday']
const BRIEF_KEYS = ['expected_demand', 'futures', 'supplier', 'transport']

function brief(over: Partial<Brief> = {}): Brief {
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
    ...over,
  } as Brief
}

function pub(day: number, over: Record<string, unknown> = {}): PublicDayResults {
  const players: Record<string, unknown> = {}
  for (const a of Object.keys(NAMES)) {
    players[a] = { display_name: NAMES[a], units_sold: 20 + day, market_share: 0.3, reputation: 0.6 }
  }
  return {
    day,
    weekday: 'thu',
    demand_total: 100,
    units_sold_total: 90,
    spot_price: 13.4,
    capacity: 81,
    disrupted: false,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    peer_units: 16,
    peer_avg_price: 14.25,
    players,
    ...over,
  } as unknown as PublicDayResults
}

function record(day: number): DayRecord {
  return {
    day,
    weekday: 'thu',
    cash_end: 6120.55,
    profit: 1120.55,
    peer_trades: [{ side: 'sell', counterparty: 'P1', lot_id: 'L4', qty: 10, quality: 62, price: 13.31 }],
    peer_buy: { max_price: 17.77, min_quality: 50 },
  } as unknown as DayRecord
}

function market(day: number): MarketDay {
  return { day, weekday: 'thu', peer_units: 16, peer_avg_price: 14.25 } as unknown as MarketDay
}

function hostView(over: Record<string, unknown> = {}): HostView {
  const players: Record<string, unknown> = {}
  for (const [a, name] of Object.entries(NAMES)) {
    players[a] = {
      display_name: name,
      connected: true,
      has_submitted: a !== 'P3',
      stock_units: 42,
      cash: 6120.55,
      cumulative_profit: 1120.55,
      fill_rate: 0.9,
      waste_rate: 0.1,
      last_incoterm_tier: 'cip',
      last_peer_bought: 10,
      last_peer_sold: 4,
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
      supplier: { base_price: 12, spot_spread: 0.337, disruption_probability: 0.05 },
      transport: { failure_probability: 0.1234, loss_fraction: 0.3 },
    },
    awaiting: ['P3'],
    players,
    leaderboard: [],
    ...over,
  } as unknown as HostView
}

function seed(over: Partial<GameState> = {}, view: HostView | null = hostView()): void {
  useGameStore.setState({
    ...INITIAL_STATE,
    roomCode: 'ABC234',
    isHost: true,
    hostClaimed: true,
    roomState: 'running',
    durationDays: 14,
    brief: view ? brief() : null,
    hostView: view,
    publicHistory: [pub(1), pub(2), pub(3), pub(4)],
    marketHistory: [market(1), market(2), market(3), market(4)],
    hostHistories: { P1: [record(4)], P2: [record(4)] },
    ...over,
  })
}

/** Every key name anywhere in a tree. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      allKeys(v, out)
    }
  }
  return out
}

beforeEach(() => useGameStore.setState({ ...INITIAL_STATE }))

describe('selectPresentationData', () => {
  it('is null before the start', () => {
    expect(selectPresentationData(useGameStore.getState())).toBeNull()
    seed({ roomState: 'lobby' }, null)
    expect(selectPresentationData(useGameStore.getState())).toBeNull()
  })

  it('copies the day, the weekday, the duration and the peer switch', () => {
    seed()
    const data = selectPresentationData(useGameStore.getState())
    expect(data).toMatchObject({ day: 5, durationDays: 14, weekday: 'fri', peerMarket: true })
  })

  it('peerMarket follows the host config switch', () => {
    const base = hostView() as unknown as { config: { peer_market: { enabled: boolean } } }
    base.config.peer_market.enabled = false
    seed({}, base as unknown as HostView)
    expect(selectPresentationData(useGameStore.getState())?.peerMarket).toBe(false)
  })

  it('isPeak is true on a day whose weekday multiplier is 1 and false otherwise', () => {
    seed()
    expect(selectPresentationData(useGameStore.getState())?.isPeak).toBe(true)
    const low = brief({ weekday: 'mon', weekday_multiplier: 0.25 })
    const view = hostView({ weekday: 'mon', brief: low })
    seed({ brief: low }, view)
    expect(selectPresentationData(useGameStore.getState())?.isPeak).toBe(false)
  })

  it('failure mode 4: the result has exactly the PresentationData keys', () => {
    seed()
    const data = selectPresentationData(useGameStore.getState())
    expect(Object.keys(data!).sort()).toEqual(PRESENTATION_KEYS)
  })

  it('the brief carries only expected_demand, supplier, futures and transport', () => {
    seed()
    const data = selectPresentationData(useGameStore.getState())!
    expect(Object.keys(data.brief).sort()).toEqual(BRIEF_KEYS)
    expect(data.brief.supplier).toEqual(brief().supplier)
    expect(data.brief.futures).toEqual(brief().futures)
    expect(data.brief.expected_demand).toBe(100)
  })

  it('latest is the last entry of the store publicHistory, or null before day 1 closes', () => {
    seed()
    expect(selectPresentationData(useGameStore.getState())?.latest).toEqual(pub(4))
    seed({ publicHistory: [] })
    expect(selectPresentationData(useGameStore.getState())?.latest).toBeNull()
  })

  it('submitted lists every pulquería in alias order with its name and state', () => {
    seed()
    const data = selectPresentationData(useGameStore.getState())!
    expect(data.submitted).toEqual([
      { alias: 'P1', displayName: 'Don Agave', submitted: true },
      { alias: 'P2', displayName: 'La Chula', submitted: true },
      { alias: 'P3', displayName: 'El Tinacal', submitted: false },
    ])
    for (const row of data.submitted) expect(Object.keys(row).sort()).toEqual(['alias', 'displayName', 'submitted'])
  })

  it('submitted orders aliases by number, not as text', () => {
    const view = hostView() as unknown as { players: Record<string, unknown> }
    view.players.P10 = { ...(view.players.P1 as object), display_name: 'Diez' }
    seed({}, view as unknown as HostView)
    const aliases = selectPresentationData(useGameStore.getState())!.submitted.map((s) => s.alias)
    expect(aliases).toEqual(['P1', 'P2', 'P3', 'P10'])
  })

  it('failure modes 1, 2: no private value of the host view survives anywhere in the result', () => {
    seed()
    const text = JSON.stringify(selectPresentationData(useGameStore.getState()))
    for (const secret of ['6120.55', '1120.55', '987654321', '0.1234', '0.337', '0.05', 'spot_spread', 'failure_probability']) {
      expect(text).not.toContain(secret)
    }
    const keys = allKeys(selectPresentationData(useGameStore.getState()))
    for (const k of ['cash', 'cumulative_profit', 'seed', 'config', 'own_history', 'stock_units', 'random_seed', 'hostView']) {
      expect(keys.has(k)).toBe(false)
    }
  })

  it('failure mode 8: no peer decision or trade key anywhere, recursively', () => {
    seed()
    const keys = allKeys(selectPresentationData(useGameStore.getState()))
    for (const k of ['peer_trades', 'peer_buy', 'peer_sell', 'counterparty', 'last_peer_bought', 'last_peer_sold']) {
      expect(keys.has(k)).toBe(false)
    }
    const text = JSON.stringify(selectPresentationData(useGameStore.getState()))
    for (const v of ['13.31', '17.77']) expect(text).not.toContain(v)
    // the public peer totals are the only peer data it keeps
    expect(selectPresentationData(useGameStore.getState())!.latest).toMatchObject({ peer_units: 16, peer_avg_price: 14.25 })
  })

  it('a daily host_state does not change what is selected from the histories', () => {
    seed()
    const before = selectPresentationData(useGameStore.getState())
    useGameStore.getState().applyHostState({
      seq: 9,
      ...(hostView() as unknown as object),
      full: false,
    } as never)
    expect(selectPresentationData(useGameStore.getState())?.latest).toEqual(before?.latest)
  })
})

describe('selectHostHistories', () => {
  it('returns the store hostHistories, publicHistory and marketHistory', () => {
    seed()
    const s = useGameStore.getState()
    const h = selectHostHistories(s)
    expect(Object.keys(h).sort()).toEqual(['marketHistory', 'players', 'publicHistory'])
    expect(h.players).toEqual(s.hostHistories)
    expect(h.publicHistory).toEqual(s.publicHistory)
    expect(h.marketHistory).toEqual(s.marketHistory)
  })

  it('is empty-but-defined before anything has closed', () => {
    seed({ publicHistory: [], marketHistory: [], hostHistories: {} })
    expect(selectHostHistories(useGameStore.getState())).toEqual({ players: {}, publicHistory: [], marketHistory: [] })
  })

  it('a daily host_state (full: false) does not empty the histories', () => {
    seed()
    const before = selectHostHistories(useGameStore.getState())
    useGameStore.getState().applyHostState({
      seq: 9,
      ...(hostView() as unknown as object),
      full: false,
    } as never)
    const after = selectHostHistories(useGameStore.getState())
    expect(after.publicHistory.length).toBe(before.publicHistory.length)
    expect(after.marketHistory.length).toBe(before.marketHistory.length)
    expect(after.players.P1?.length).toBe(before.players.P1.length)
  })
})
