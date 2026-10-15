/** Section 25 — configDraft (plan 25 §2, §4). Pure helpers: getAt, setAt, diffPatch, leafPaths. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { diffPatch, getAt, leafPaths, setAt } from '../components/config/configDraft'
import type { ConfigDefaultsResponse, GameConfig } from '../types/game'

const defaults = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8'),
) as ConfigDefaultsResponse

const fresh = (): GameConfig => structuredClone(defaults.config)

describe('getAt', () => {
  it('reads top-level, nested and deeply nested leaves by dot path', () => {
    const c = fresh()
    expect(getAt(c, 'max_players')).toBe(4)
    expect(getAt(c, 'stock.max_days')).toBe(4)
    expect(getAt(c, 'demand.weekday_peak.from')).toBe('thu')
    expect(getAt(c, 'insurance.tiers.ddp.fee')).toBe(0.99)
    expect(getAt(c, 'peer_market.enabled')).toBe(true)
  })

  it('returns undefined for a path that does not exist', () => {
    const c = fresh()
    expect(getAt(c, 'stock.nope')).toBeUndefined()
    expect(getAt(c, 'nope.deeper.still')).toBeUndefined()
  })
})

describe('setAt', () => {
  it('returns a new object carrying the new value and leaves the input untouched', () => {
    const c = fresh()
    const before = structuredClone(c)
    const next = setAt(c, 'stock.max_days', 5)
    expect(next).not.toBe(c)
    expect(getAt(next, 'stock.max_days')).toBe(5)
    expect(c).toEqual(before)
  })

  it('changes only the addressed leaf', () => {
    const c = fresh()
    const next = setAt(c, 'insurance.tiers.cip.fee', 0.55)
    const expected = fresh()
    expected.insurance.tiers.cip.fee = 0.55
    expect(next).toEqual(expected)
  })

  it('sets a three-level path and a top-level key', () => {
    const c = fresh()
    expect(getAt(setAt(c, 'demand.weekday_peak.to', 'sun'), 'demand.weekday_peak.to')).toBe('sun')
    expect(getAt(setAt(c, 'duration_days', 21), 'duration_days')).toBe(21)
  })

  it('does not mutate nested objects shared with the input', () => {
    const c = fresh()
    const stockBefore = structuredClone(c.stock)
    setAt(c, 'stock.fresh_days', 3)
    expect(c.stock).toEqual(stockBefore)
  })
})

describe('diffPatch', () => {
  it('is {} when the configs are equal', () => {
    expect(diffPatch(fresh(), fresh())).toEqual({})
  })

  it('is exactly the changed leaf, nested (plan 25 §4 example)', () => {
    const base = fresh()
    expect(diffPatch(base, setAt(base, 'stock.max_days', 5))).toEqual({ stock: { max_days: 5 } })
  })

  it('omits unchanged siblings (a quality_min edit does not carry quality_max)', () => {
    const base = fresh()
    expect(diffPatch(base, setAt(base, 'supplier.quality_min', 70))).toEqual({ supplier: { quality_min: 70 } })
  })

  it('carries a top-level leaf and a leaf from another section together', () => {
    const base = fresh()
    const draft = setAt(setAt(base, 'duration_days', 21), 'transport.shared', true)
    expect(diffPatch(base, draft)).toEqual({ duration_days: 21, transport: { shared: true } })
  })

  it('nests a three-level path', () => {
    const base = fresh()
    expect(diffPatch(base, setAt(base, 'demand.weekday_peak.to', 'sun'))).toEqual({
      demand: { weekday_peak: { to: 'sun' } },
    })
    expect(diffPatch(base, setAt(base, 'insurance.tiers.cip.fee', 0.5))).toEqual({
      insurance: { tiers: { cip: { fee: 0.5 } } },
    })
  })

  it('is {} again when an edit is reverted', () => {
    const base = fresh()
    const edited = setAt(base, 'stock.max_days', 5)
    expect(diffPatch(base, setAt(edited, 'stock.max_days', 4))).toEqual({})
  })

  it('compares base to draft, so the patch holds the draft values', () => {
    const base = setAt(fresh(), 'duration_days', 20)
    expect(diffPatch(base, fresh())).toEqual({ duration_days: 14 })
  })

  it('does not change either argument', () => {
    const base = fresh()
    const draft = setAt(base, 'stock.max_days', 5)
    const b = structuredClone(base)
    const d = structuredClone(draft)
    diffPatch(base, draft)
    expect(base).toEqual(b)
    expect(draft).toEqual(d)
  })
})

describe('leafPaths', () => {
  it('lists dot paths alphabetically for a small object', () => {
    expect(leafPaths({ b: { d: 1, c: 2 }, a: 3 })).toEqual(['a', 'b.c', 'b.d'])
  })

  it('lists every non-seed leaf of the defaults, once, in alphabetical order', () => {
    const paths = leafPaths(fresh())
    const nonSeed = Object.keys(defaults.fields).filter((k) => k !== 'random_seed')
    for (const k of nonSeed) expect(paths).toContain(k)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toEqual([...paths].sort())
    for (const p of paths) {
      if (p !== 'random_seed') expect(Object.keys(defaults.fields)).toContain(p)
    }
  })

  it('never lists an intermediate object as a leaf', () => {
    const paths = leafPaths(fresh())
    expect(paths).not.toContain('stock')
    expect(paths).not.toContain('insurance.tiers')
    expect(paths).not.toContain('demand.weekday_peak')
  })
})
