/**
 * Section 29 - resultsView.ts (spec 13.8 `ResultsView`, one view model, two sources).
 * Acceptance criteria 2, 3, 13; failure modes 1, 2, 9, 11 (normaliser side).
 */
import { describe, expect, it } from 'vitest'
import { resultsViewFromLive, resultsViewFromResponse } from '../components/results/resultsView'
import type { GameFinishedPayload, ResultsResponse } from '../types/game'
import {
  DAYS,
  MARKET_KEYS,
  PEER_PLAYER_KEYS,
  PLAYER_SCALAR_KEYS,
  RANK_ORDER,
  ROOM,
  SERIES_KEYS,
  makeFinished,
  makeResponse,
  makeStats,
  makeView,
  withoutPeer,
} from './fixtures/results'

type Dict = Record<string, unknown>

const live = (p: Dict = makeFinished()) =>
  resultsViewFromLive(p as unknown as GameFinishedPayload, { roomCode: ROOM, durationDays: DAYS })
const stored = (r: Dict = makeResponse()) => resultsViewFromResponse(r as unknown as ResultsResponse)
const asDict = (v: unknown) => v as Dict
/** The view without the two dates that only a response can carry. */
const withoutDates = (v: unknown): Dict => {
  const copy = { ...asDict(v) }
  delete copy.started_at
  delete copy.finished_at
  return copy
}

describe('the same game from the two sources (criterion 2)', () => {
  it('gives deep-equal views except started_at / finished_at', () => {
    expect(withoutDates(live())).toEqual(withoutDates(stored()))
  })

  it('matches the field-by-field oracle on both paths', () => {
    const expected = asDict(makeView())
    for (const view of [live(), stored()]) expect(withoutDates(view)).toEqual(expected)
  })

  it('sets started_at and finished_at only from a response', () => {
    const a = live()
    const b = stored()
    expect(a.started_at).toBeUndefined()
    expect(a.finished_at).toBeUndefined()
    expect(b.started_at).toBe('2026-10-12T15:00:00Z')
    expect(b.finished_at).toBe('2026-10-12T15:42:00Z')
  })

  it('takes room_code and duration_days from the context live and from the response when stored', () => {
    const a = resultsViewFromLive(makeFinished() as unknown as GameFinishedPayload, { roomCode: 'XYZ789', durationDays: 21 })
    expect(a.room_code).toBe('XYZ789')
    expect(a.duration_days).toBe(21)
    expect(a.days_played).toBe(DAYS)
    const response = { ...makeResponse(), room_code: 'QQQ222', duration_days: 30, days_played: 9, ended_early: true }
    const b = stored(response)
    expect(b.room_code).toBe('QQQ222')
    expect(b.duration_days).toBe(30)
    expect(b.days_played).toBe(9)
    expect(b.ended_early).toBe(true)
  })

  it('carries ended_early from the live payload', () => {
    expect(live({ ...makeFinished(), ended_early: true, days_played: 6 }).ended_early).toBe(true)
    expect(live({ ...makeFinished(), ended_early: true, days_played: 6 }).days_played).toBe(6)
  })
})

describe('field copying (failure mode 1: live/URL drift)', () => {
  const stats = makeStats()

  it.each([
    ['live', () => live()],
    ['stored', () => stored()],
  ])('every PulqueriaResultView key of %s reaches the view, with its value', (_name, build) => {
    const view = build()
    for (const alias of Object.keys(stats.players)) {
      const p = view.players.find((x) => x.alias === alias) as unknown as Dict
      expect(p, alias).toBeDefined()
      for (const key of PLAYER_SCALAR_KEYS) {
        expect(p[key], `${alias}.${key}`).toEqual(stats.players[alias][key])
      }
      for (const key of SERIES_KEYS) {
        expect(asDict(p.series)[key], `${alias}.series.${key}`).toEqual(asDict(stats.players[alias].series)[key])
      }
    }
  })

  it.each([
    ['live', () => live()],
    ['stored', () => stored()],
  ])('every market series of %s reaches view.market, with its value', (_name, build) => {
    const market = asDict(build().market)
    const series = asDict(stats.market.series)
    for (const key of MARKET_KEYS) {
      expect(market[key], key).toEqual(series[key])
    }
  })

  it('keeps null entries of peer_avg_price as null', () => {
    for (const view of [live(), stored()]) {
      const prices = view.market.peer_avg_price!
      expect(prices[0]).toBeNull()
      expect(prices[1]).toBe(15.5)
      expect(prices.filter((p) => p === null)).toHaveLength(DAYS - 2)
    }
  })
})

describe('copy, never compute (criterion 3, failure modes 2 and 9)', () => {
  it.each([
    ['live', () => live()],
    ['stored', () => stored()],
  ])('%s: a null ratio stays null although units_sold is positive', (_name, build) => {
    const p3 = build().players.find((p) => p.alias === 'P3')!
    expect(p3.units_sold).toBe(300)
    expect(p3.fill_rate).toBeNull()
    expect(p3.waste_rate).toBeNull()
    expect(p3.futures_share).toBeNull()
  })

  it.each([
    ['live', () => live()],
    ['stored', () => stored()],
  ])('%s: peer_net is the server value, not revenue_peer - cost_peer', (_name, build) => {
    const p2 = build().players.find((p) => p.alias === 'P2')!
    expect((p2.revenue_peer ?? 0) - (p2.cost_peer ?? 0)).not.toBeCloseTo(12.34, 2)
    expect(p2.peer_net).toBe(12.34)
  })

  it('does not take total_profit from the leaderboard when stats say otherwise (stats are the source)', () => {
    const payload = makeFinished((s) => {
      s.players.P2.total_profit = 777.77
    })
    expect(live(payload).players.find((p) => p.alias === 'P2')!.total_profit).toBe(777.77)
  })
})

describe('ordering', () => {
  it.each([
    ['live', (s: Dict) => live(s)],
    ['stored', (s: Dict) => stored(s)],
  ])('%s: players are sorted by rank ascending whatever the order of the payload', (name, build) => {
    const scrambled = (name === 'live' ? makeFinished : makeResponse)((s) => {
      s.leaderboard.reverse()
      const reordered: Record<string, Dict> = {}
      for (const alias of ['P3', 'P1', 'P2']) reordered[alias] = s.players[alias]
      s.players = reordered
    })
    const view = build(scrambled)
    expect(view.players.map((p) => p.alias)).toEqual(RANK_ORDER)
    expect(view.players.map((p) => p.rank)).toEqual([1, 2, 3])
  })
})

describe('a payload without the peer fields (criterion 13, failure mode 11)', () => {
  it.each([
    ['live', () => live(makeFinished(withoutPeer))],
    ['stored', () => stored(makeResponse(withoutPeer))],
  ])('%s: no peer field is invented', (_name, build) => {
    const view = build()
    expect(view.players).toHaveLength(3)
    for (const p of view.players) {
      for (const key of PEER_PLAYER_KEYS) {
        expect(asDict(p)[key], `${p.alias}.${key}`).toBeUndefined()
      }
      expect(asDict(p.series).peer_bought).toBeUndefined()
      expect(asDict(p.series).peer_sold).toBeUndefined()
      expect(p.series.delivered).toHaveLength(DAYS)
    }
    expect(asDict(view.market).peer_units).toBeUndefined()
    expect(asDict(view.market).peer_avg_price).toBeUndefined()
    expect(view.market.demand).toHaveLength(DAYS)
  })

  it('both paths still agree without the peer fields', () => {
    expect(withoutDates(live(makeFinished(withoutPeer)))).toEqual(withoutDates(stored(makeResponse(withoutPeer))))
  })
})

describe('inputs are left alone', () => {
  it('does not mutate the payload or the response', () => {
    const payload = makeFinished()
    const response = makeResponse()
    const payloadBefore = structuredClone(payload)
    const responseBefore = structuredClone(response)
    live(payload)
    stored(response)
    expect(payload).toEqual(payloadBefore)
    expect(response).toEqual(responseBefore)
  })
})
