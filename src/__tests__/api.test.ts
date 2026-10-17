import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void

const h = vi.hoisted(() => {
  const emitted: Array<{ event: string; args: unknown[] }> = []
  const state: { currentUser: unknown } = { currentUser: null }
  const fake = {
    connected: false,
    on() {
      return fake
    },
    off() {
      return fake
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args })
      return fake
    },
    connect() {
      return fake
    },
    disconnect() {
      return fake
    },
    listeners(): Listener[] {
      return []
    },
  }
  return { emitted, fake, state }
})

vi.mock('socket.io-client', () => ({ io: () => h.fake }))

vi.mock('../../firebase', () => ({
  auth: {
    get currentUser() {
      return h.state.currentUser
    },
  },
  googleProvider: {},
  app: {},
}))

import http from '../api/http'
import { createRoom, getRoomConfig, getRoomStatus, putRoomConfig } from '../api/rooms'
import { getConfigDefaults, validateConfig } from '../api/config'
import { claimGames, exportGame, getResultsById } from '../api/results'
import { getMe, getMyGame, getMyGames, getMyStats, upsertUser } from '../api/users'
import {
  endGameEarly,
  join,
  joinWaiting,
  leave,
  requestState,
  startGame,
  submitDay,
  updateConfig,
} from '../api/games'
import type { Decision } from '../types/game'

const originalAdapter = http.defaults.adapter
let seen: InternalAxiosRequestConfig[] = []
let reply: { status: number; data: unknown } = { status: 200, data: {} }

beforeEach(() => {
  seen = []
  reply = { status: 200, data: {} }
  h.emitted.length = 0
  h.state.currentUser = null
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    return { data: reply.data, status: reply.status, statusText: 'OK', headers: {}, config }
  }
  http.defaults.adapter = adapter
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.unstubAllEnvs()
})

/** The path relative to the /api/v1 base, without a leading slash or a query string. */
function path(cfg: InternalAxiosRequestConfig): string {
  return (cfg.url ?? '').replace(/^\/+/, '').split('?')[0]
}

function method(cfg: InternalAxiosRequestConfig): string {
  return (cfg.method ?? '').toUpperCase()
}

function header(cfg: InternalAxiosRequestConfig, name: string): string | undefined {
  const v = AxiosHeaders.from(cfg.headers).get(name)
  return v === undefined || v === null || v === false ? undefined : String(v)
}

function body(cfg: InternalAxiosRequestConfig): Record<string, unknown> {
  if (cfg.data === undefined || cfg.data === null || cfg.data === '') return {}
  return (typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data) as Record<string, unknown>
}

function query(cfg: InternalAxiosRequestConfig): URLSearchParams {
  const fromUrl = (cfg.url ?? '').split('?')[1] ?? ''
  const out = new URLSearchParams(fromUrl)
  for (const [k, v] of Object.entries((cfg.params ?? {}) as Record<string, unknown>)) out.set(k, String(v))
  return out
}

describe('the axios instance', () => {
  it('has a baseURL ending in /api/v1', () => {
    expect(http.defaults.baseURL).toMatch(/\/api\/v1$/)
  })

  it('prefixes VITE_API_BASE_URL when it is set, and is just /api/v1 when it is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.resetModules()
    const withBase = (await import('../api/http')).default
    expect(withBase.defaults.baseURL).toBe('https://api.example.test/api/v1')
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    const without = (await import('../api/http')).default
    expect(without.defaults.baseURL).toBe('/api/v1')
  })

  it('attaches Authorization: Bearer <ID token> when a user is signed in', async () => {
    h.state.currentUser = { getIdToken: async () => 'id-token-xyz' }
    await getRoomStatus('ABC234')
    expect(header(seen[0], 'Authorization')).toBe('Bearer id-token-xyz')
  })

  it('attaches no Authorization header when nobody is signed in', async () => {
    await getRoomStatus('ABC234')
    expect(header(seen[0], 'Authorization')).toBeUndefined()
  })
})

describe('rooms.ts (spec 13.4)', () => {
  it('createRoom POSTs /rooms/create with host_display_name', async () => {
    reply.data = { room_code: 'ABC234', host_secret: 's', state: 'lobby', config: {} }
    const out = await createRoom('Doña Pulque')
    expect(method(seen[0])).toBe('POST')
    expect(path(seen[0])).toBe('rooms/create')
    expect(body(seen[0])).toEqual({ host_display_name: 'Doña Pulque' })
    expect(out).toEqual(reply.data)
  })

  it('createRoom without a name sends no host_display_name', async () => {
    await createRoom()
    expect(method(seen[0])).toBe('POST')
    expect(path(seen[0])).toBe('rooms/create')
    expect(body(seen[0])).not.toHaveProperty('host_display_name')
  })

  it('getRoomStatus GETs /rooms/{code}/status', async () => {
    reply.data = { ok: true, state: 'lobby', host_display_name: 'H', seats_taken: 1, seats_total: 4 }
    const out = await getRoomStatus('ABC234')
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('rooms/ABC234/status')
    expect(out).toEqual(reply.data)
  })

  it('getRoomConfig GETs /rooms/{code}/config with X-Host-Secret and returns the config', async () => {
    const config = { max_players: 4 }
    reply.data = { config }
    const out = await getRoomConfig('ABC234', 'sekrit')
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('rooms/ABC234/config')
    expect(header(seen[0], 'X-Host-Secret')).toBe('sekrit')
    expect(out).toEqual(config)
  })

  it('putRoomConfig PUTs /rooms/{code}/config with X-Host-Secret and {config: patch}, returning the full config', async () => {
    const full = { max_players: 6, duration_days: 14 }
    reply.data = { config: full }
    const out = await putRoomConfig('ABC234', 'sekrit', { max_players: 6 })
    expect(method(seen[0])).toBe('PUT')
    expect(path(seen[0])).toBe('rooms/ABC234/config')
    expect(header(seen[0], 'X-Host-Secret')).toBe('sekrit')
    expect(body(seen[0])).toEqual({ config: { max_players: 6 } })
    expect(out).toEqual(full)
  })
})

describe('config.ts', () => {
  it('getConfigDefaults GETs /config/defaults', async () => {
    reply.data = { fields: {} }
    const out = await getConfigDefaults()
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('config/defaults')
    expect(out).toEqual(reply.data)
  })

  it('validateConfig POSTs /config/validate with {config}', async () => {
    reply.data = { ok: true, errors: [], warnings: [] }
    const config = { max_players: 4 }
    const out = await validateConfig(config as never)
    expect(method(seen[0])).toBe('POST')
    expect(path(seen[0])).toBe('config/validate')
    expect(body(seen[0])).toEqual({ config })
    expect(out).toEqual(reply.data)
  })
})

describe('results.ts', () => {
  it('getResultsById GETs /games/id/{public_id}/results', async () => {
    reply.data = { game_id: 'f00d' }
    const out = await getResultsById('f00d')
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('games/id/f00d/results')
    expect(out).toEqual(reply.data)
  })

  it('exportGame GETs /games/id/{public_id}/export?format=csv with X-Host-Secret when given one', async () => {
    reply.data = new Blob(['a,b\n1,2\n'], { type: 'text/csv' })
    const out = await exportGame('f00d', 'csv', 'sekrit')
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('games/id/f00d/export')
    expect(query(seen[0]).get('format')).toBe('csv')
    expect(header(seen[0], 'X-Host-Secret')).toBe('sekrit')
    expect(out).toBeInstanceOf(Blob)
  })

  it('exportGame with a null secret sends no X-Host-Secret and relies on the bearer', async () => {
    h.state.currentUser = { getIdToken: async () => 'id-token-xyz' }
    reply.data = new Blob(['{}'], { type: 'application/json' })
    await exportGame('f00d', 'json', null)
    expect(query(seen[0]).get('format')).toBe('json')
    expect(header(seen[0], 'X-Host-Secret')).toBeUndefined()
    expect(header(seen[0], 'Authorization')).toBe('Bearer id-token-xyz')
  })

  it('claimGames POSTs /games/claim with {guest_identity}', async () => {
    reply.data = { claimed: 2 }
    const out = await claimGames('guest_11111111-1111-4111-8111-111111111111')
    expect(method(seen[0])).toBe('POST')
    expect(path(seen[0])).toBe('games/claim')
    expect(body(seen[0])).toEqual({ guest_identity: 'guest_11111111-1111-4111-8111-111111111111' })
    expect(out).toEqual({ claimed: 2 })
  })
})

describe('users.ts', () => {
  it('upsertUser POSTs /users/upsert with {display_name}', async () => {
    reply.data = { display_name: 'Ana', email: 'a@b.c', photo_url: null }
    const out = await upsertUser('Ana')
    expect(method(seen[0])).toBe('POST')
    expect(path(seen[0])).toBe('users/upsert')
    expect(body(seen[0])).toEqual({ display_name: 'Ana' })
    expect(out).toEqual(reply.data)
  })

  it('upsertUser without a name sends no display_name', async () => {
    await upsertUser()
    expect(path(seen[0])).toBe('users/upsert')
    expect(body(seen[0])).not.toHaveProperty('display_name')
  })

  it('getMe and getMyStats GET /users/me and /users/me/stats', async () => {
    reply.data = { display_name: 'Ana' }
    await getMe()
    reply.data = { games_played: 0 }
    const stats = await getMyStats()
    expect(seen.map(method)).toEqual(['GET', 'GET'])
    expect(seen.map(path)).toEqual(['users/me', 'users/me/stats'])
    expect(stats).toEqual({ games_played: 0 })
  })

  it('getMyGames GETs /users/me/games and returns the rows of {games: [...]}', async () => {
    const rows = [{ game_id: 'g1', rank: 1 }, { game_id: 'g2', rank: 3 }]
    reply.data = { games: rows }
    const out = await getMyGames()
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('users/me/games')
    expect(out).toEqual(rows)
  })

  it('getMyGame GETs /users/me/games/{id}', async () => {
    reply.data = { game_id: 'g1', my_alias: 'P2' }
    const out = await getMyGame('g1')
    expect(method(seen[0])).toBe('GET')
    expect(path(seen[0])).toBe('users/me/games/g1')
    expect(out).toEqual(reply.data)
  })
})

describe('games.ts emits the spec 12.1 events (criterion 11)', () => {
  const last = () => h.emitted[h.emitted.length - 1]

  it('join_waiting {room_id, host_secret?}', () => {
    joinWaiting('ABC234', 'sekrit')
    expect(last().event).toBe('join_waiting')
    expect(last().args).toEqual([{ room_id: 'ABC234', host_secret: 'sekrit' }])
    joinWaiting('ABC234', null)
    expect(last().args).toEqual([{ room_id: 'ABC234' }])
    expect(last().args[0]).not.toHaveProperty('host_secret')
  })

  it('join {room_id, display_name?, session_token?}', () => {
    join('ABC234', 'Ana', 'tok')
    expect(last().event).toBe('join')
    expect(last().args).toEqual([{ room_id: 'ABC234', display_name: 'Ana', session_token: 'tok' }])
    join('ABC234', 'Ana', null)
    expect(last().args).toEqual([{ room_id: 'ABC234', display_name: 'Ana' }])
    join('ABC234', null, 'tok')
    expect(last().args).toEqual([{ room_id: 'ABC234', session_token: 'tok' }])
  })

  it('failure mode 10: join(code, null, null) emits a payload with no session_token and no display_name key', () => {
    join('ABC234', null, null)
    const payload = last().args[0] as Record<string, unknown>
    expect(payload).toEqual({ room_id: 'ABC234' })
    expect('session_token' in payload).toBe(false)
    expect('display_name' in payload).toBe(false)
    expect(Object.values(payload)).not.toContain(null)
  })

  it('leave, request_state, start_game, end_game_early, config_update', () => {
    leave('ABC234')
    expect(last().event).toBe('leave')
    expect(last().args).toEqual([{ room_id: 'ABC234' }])

    requestState('ABC234')
    expect(last().event).toBe('request_state')
    expect(last().args).toEqual([{ room_id: 'ABC234' }])

    startGame('ABC234', 'sekrit')
    expect(last().event).toBe('start_game')
    expect(last().args).toEqual([{ room_id: 'ABC234', host_secret: 'sekrit' }])

    endGameEarly('ABC234', 'sekrit')
    expect(last().event).toBe('end_game_early')
    expect(last().args).toEqual([{ room_id: 'ABC234', host_secret: 'sekrit' }])

    updateConfig('ABC234', 'sekrit', { max_players: 6 })
    expect(last().event).toBe('config_update')
    expect(last().args).toEqual([{ room_id: 'ABC234', host_secret: 'sekrit', config: { max_players: 6 } }])
  })

  it('every emit carries exactly one payload argument and no acknowledgement callback', () => {
    joinWaiting('ABC234', 's')
    join('ABC234', 'Ana', 't')
    leave('ABC234')
    updateConfig('ABC234', 's', {})
    startGame('ABC234', 's')
    endGameEarly('ABC234', 's')
    requestState('ABC234')
    expect(h.emitted).toHaveLength(7)
    for (const e of h.emitted) expect(e.args).toHaveLength(1)
  })

  const decision: Decision = {
    day: 3,
    order_spot: 40,
    order_futures: 10,
    incoterm_tier: 'cip',
    conserve_lots: ['L1', 'L2'],
    cooperate: true,
    peer_buy: { max_price: 14.5, min_quality: 60 },
    peer_sell: { price: 16, max_quality: 80, max_units: 12 },
  }

  it('submit_day sends the decision as given plus room_id', () => {
    submitDay('ABC234', decision)
    expect(last().event).toBe('submit_day')
    expect(last().args).toEqual([{ room_id: 'ABC234', ...decision }])
  })

  it('failure mode 14: null peer limits stay in the payload as null', () => {
    submitDay('ABC234', { ...decision, peer_buy: null, peer_sell: null })
    const payload = last().args[0] as Record<string, unknown>
    expect('peer_buy' in payload).toBe(true)
    expect('peer_sell' in payload).toBe(true)
    expect(payload.peer_buy).toBeNull()
    expect(payload.peer_sell).toBeNull()
    expect(payload).toEqual({ room_id: 'ABC234', ...decision, peer_buy: null, peer_sell: null })
  })

  it('submit_day keeps an empty conserve_lots and false cooperate', () => {
    submitDay('ABC234', { ...decision, conserve_lots: [], cooperate: false })
    const payload = last().args[0] as Record<string, unknown>
    expect(payload.conserve_lots).toEqual([])
    expect(payload.cooperate).toBe(false)
  })
})
