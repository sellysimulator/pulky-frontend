import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { roundCents } from '../utils/money'

interface RoundingCase {
  value: number
  expected: number
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/rounding_cases.json'), 'utf8'),
) as { round_cents: RoundingCase[] }

describe('roundCents (spec 8.1)', () => {
  it('loads the shared fixture', () => {
    expect(fixture.round_cents.length).toBeGreaterThan(10)
  })

  it.each(fixture.round_cents.map((c) => [c.value, c.expected] as const))(
    'rounds %j to %j',
    (value, expected) => {
      expect(roundCents(value)).toBe(expected)
    },
  )

  it('never returns negative zero', () => {
    expect(Object.is(roundCents(-0.004), 0)).toBe(true)
    expect(Object.is(roundCents(-0.001), 0)).toBe(true)
    expect(Object.is(roundCents(-0), 0)).toBe(true)
  })

  it('rounds halves away from zero on both signs, trimming binary noise first', () => {
    expect(roundCents(0.125)).toBe(0.13)
    expect(roundCents(-0.125)).toBe(-0.13)
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(-1.005)).toBe(-1.01)
  })

  it('leaves a value already in cents unchanged', () => {
    for (const c of fixture.round_cents) expect(roundCents(c.expected)).toBe(c.expected)
  })
})
