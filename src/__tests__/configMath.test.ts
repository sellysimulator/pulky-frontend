import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  breakEvenFee,
  chanceOfAtLeastOneFailure,
  daysLeft,
  expectedFailures,
  feeFromMargin,
  hazard,
  lostPerUnit,
  marketLambda,
  quality,
  qualityGuide,
  qualityStepPerNight,
  ratioBadge,
  reputationStep,
  shares,
  spotRange,
  weekdayMultiplier,
  weekdayMultipliers,
  worstSingleFailureLoss,
  type BreakEvenInput,
  type Tier,
} from '../game/configMath'
import type { Weekday } from '../types/game'

const TOL = 1e-6
const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

interface Fixture {
  weekday_multiplier: { day: Weekday; from: Weekday; to: Weekday; expected: number }[]
  hazard: { age: number; fresh_days: number; max_days: number; initial_quality: number; expected: number }[]
  quality: {
    age: number
    fresh_days: number
    max_days: number
    initial_quality: number
    expected_quality: number
    expected_days_left: number
  }[]
  quality_guide: {
    day: number
    fresh_days: number
    max_days: number
    expected: { quality: number; half_spoiled_day: number; last_day: number }[]
  }[]
  reputation_step: {
    reputation: number
    fill: number
    waste: number
    smoothing: number
    waste_weight: number
    expected: number
  }[]
  break_even_fee: {
    tier: Tier
    failure_probability: number
    loss_fraction: number
    shared: boolean
    n_ref: number
    reference_shipment: number
    base_price: number
    retail_price: number
    expected: number
  }[]
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_math_cases.json'), 'utf8'),
) as Fixture

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(TOL)
}

const d: BreakEvenInput = {
  failureProbability: 0.1,
  lossFraction: 0.3,
  shared: false,
  nRef: 4,
  referenceShipment: 20,
  basePrice: 12,
  retailPrice: 30,
}

describe('shared fixture cases (AC 4)', () => {
  it('loads every group', () => {
    expect(fixture.weekday_multiplier.length).toBeGreaterThan(20)
    expect(fixture.hazard.length).toBeGreaterThan(10)
    expect(fixture.quality.length).toBeGreaterThan(5)
    expect(fixture.quality_guide.length).toBeGreaterThan(0)
    expect(fixture.reputation_step.length).toBeGreaterThan(3)
    expect(fixture.break_even_fee.length).toBeGreaterThan(10)
  })

  it.each(fixture.weekday_multiplier.map((c) => [c.day, c.from, c.to, c.expected] as const))(
    'weekdayMultiplier(%s, %s, %s) = %j',
    (day, from, to, expected) => {
      near(weekdayMultiplier(day, from, to), expected)
    },
  )

  it.each(fixture.hazard.map((c) => [c.age, c.fresh_days, c.max_days, c.initial_quality, c.expected] as const))(
    'hazard(age %j, F %j, M %j, q0 %j) = %j',
    (age, f, m, q0, expected) => {
      near(hazard(age, f, m, q0), expected)
    },
  )

  it.each(
    fixture.quality.map(
      (c) => [c.age, c.fresh_days, c.max_days, c.initial_quality, c.expected_quality, c.expected_days_left] as const,
    ),
  )('quality and daysLeft(age %j, F %j, M %j, q0 %j) = %j / %j, exactly', (age, f, m, q0, eq, el) => {
    expect(quality(age, f, m, q0)).toBe(eq)
    expect(daysLeft(age, f, m, q0)).toBe(el)
  })

  it.each(fixture.quality_guide.map((c) => [c.day, c.fresh_days, c.max_days, c.expected] as const))(
    'qualityGuide(day %j, F %j, M %j) matches all 21 rows exactly',
    (day, f, m, expected) => {
      const rows = qualityGuide(day, f, m)
      expect(rows).toHaveLength(21)
      expect(rows.map((r) => r.quality)).toEqual(Array.from({ length: 21 }, (_, i) => 100 - 5 * i))
      expect(rows).toEqual(expected)
    },
  )

  it.each(
    fixture.reputation_step.map((c) => [c.reputation, c.fill, c.waste, c.smoothing, c.waste_weight, c.expected] as const),
  )('reputationStep(%j, fill %j, waste %j, rho %j, w %j) = %j', (rep, fill, waste, rho, w, expected) => {
    near(reputationStep(rep, fill, waste, rho, w), expected)
  })

  it.each(fixture.break_even_fee.map((c, i) => [i, c] as const))('breakEvenFee case %j', (_i, c) => {
    const input: BreakEvenInput = {
      failureProbability: c.failure_probability,
      lossFraction: c.loss_fraction,
      shared: c.shared,
      nRef: c.n_ref,
      referenceShipment: c.reference_shipment,
      basePrice: c.base_price,
      retailPrice: c.retail_price,
    }
    near(breakEvenFee(c.tier, input), c.expected)
  })

  it('includes the float-noise case (shared, n_ref 3, reference shipment 20)', () => {
    expect(fixture.break_even_fee.some((c) => c.shared && c.n_ref === 3 && c.reference_shipment === 20)).toBe(true)
  })
})

describe('worked examples (AC 5)', () => {
  it('weekday multipliers', () => {
    const thu = weekdayMultipliers('thu', 'sat')
    expect(thu).toEqual({ mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 })
    expect(Object.values(weekdayMultipliers('mon', 'sun'))).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(Object.keys(thu)).toEqual(DAYS)
  })

  it('hazard', () => {
    near(hazard(2, 1, 4), 1 / 3)
    expect(hazard(4, 1, 4)).toBe(1)
    expect(hazard(1, 1, 4)).toBe(0)
    near(hazard(1, 1, 4, 80), 0.2)
    expect(hazard(3, 1, 4, 60)).toBe(1)
  })

  it('quality and days left', () => {
    expect(quality(2, 1, 4, 90)).toBe(23)
    expect(quality(1, 1, 4, 95)).toBe(62)
    expect(quality(0, 1, 4, 85)).toBe(85)
    expect(quality(2, 3, 6, 100)).toBe(100)
    expect(daysLeft(2, 1, 4, 90)).toBe(2)
    expect(daysLeft(0, 1, 4, 85)).toBe(4)
  })

  it('quality guide and step', () => {
    const rows = qualityGuide(5, 1, 4)
    expect(rows).toHaveLength(21)
    expect(rows[0].quality).toBe(100)
    expect(rows[20].quality).toBe(0)
    expect(rows[2]).toEqual({ quality: 90, half_spoiled_day: 7, last_day: 8 })
    near(qualityStepPerNight(1, 4), 100 / 3)
  })

  it('reputation step', () => {
    near(reputationStep(0.6, 0.8, 0.2, 0.3, 0.3), 0.66)
  })

  it('break-even fees and fees from margin', () => {
    near(breakEvenFee('cip', d), 0.36)
    near(breakEvenFee('dap', d), 0.36)
    near(breakEvenFee('ddp', d), 0.9)
    expect(feeFromMargin(0.36, 0.1)).toBe(0.4)
    expect(feeFromMargin(0.9, 0.1)).toBe(0.99)
    near(breakEvenFee('cip', { ...d, shared: true }), 0.06)
    near(breakEvenFee('ddp', { ...d, shared: true }), 0.15)
  })

  it('ratio badges', () => {
    const x = 0.36
    expect(ratioBadge(0.94 * x, x)).toBe('worth_it')
    expect(ratioBadge(x, x)).toBe('break_even')
    expect(ratioBadge(1.06 * x, x)).toBe('not_worth_it')
    expect(ratioBadge(0.4, 0)).toBe('no_risk')
  })

  it('shares', () => {
    const s = shares({ P1: 0.8, P2: 0.5, P3: 0.5, P4: 0.5 })
    near(s.P1, 0.302326)
    near(s.P2, 1 / 4.3)
    near(Object.values(s).reduce((a, b) => a + b, 0), 1)
  })

  it('market lambda, spot range, failure chances', () => {
    expect(marketLambda(25, 4, 1)).toBe(100)
    expect(marketLambda(25, 4, 0.25)).toBe(25)
    expect(spotRange(12, 0.25)).toEqual([9, 15])
    near(chanceOfAtLeastOneFailure(0.1, 14), 1 - 0.9 ** 14)
    expect(chanceOfAtLeastOneFailure(0, 14)).toBe(0)
    near(expectedFailures(0.1, 14), 1.4)
  })

  it('worst single-failure loss', () => {
    expect(worstSingleFailureLoss('cip', d)).toBeCloseTo(6 * 12, 9)
    expect(worstSingleFailureLoss('ddp', d)).toBeCloseTo(6 * 30, 9)
    expect(worstSingleFailureLoss('ddp', { ...d, shared: true })).toBeCloseTo(1 * 30, 9)
  })

  it('lostPerUnit applies the float-noise guard (spec 6.2)', () => {
    // 60 x (0.3 / 3) is 5.999... in floating point and must lose 6 units, not 5
    near(lostPerUnit({ ...d, failureProbability: 1, shared: true, nRef: 3, referenceShipment: 60 }), 6 / 60)
  })
})

describe('failure modes', () => {
  it('1. wrap-around window: Monday is 0.25 with the window thu..sat, not 0.75', () => {
    near(weekdayMultiplier('mon', 'thu', 'sat'), 0.25)
    near(weekdayMultiplier('sun', 'thu', 'sat'), 0.75)
    // Sunday and Monday are 6 apart: a window ending Sunday gives Monday no help from Sunday.
    near(weekdayMultiplier('mon', 'sat', 'sun'), 1 - 5 / 6)
  })

  it('2. the kernel never reaches zero, for all 28 windows', () => {
    let windows = 0
    for (let a = 0; a < 7; a++) {
      for (let b = a; b < 7; b++) {
        windows += 1
        for (const day of DAYS) {
          const m = weekdayMultiplier(day, DAYS[a], DAYS[b])
          expect(m, `${day} in ${DAYS[a]}..${DAYS[b]}`).toBeGreaterThan(0)
          expect(m).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(windows).toBe(28)
  })

  it('3. the loss is floored, not rounded: shared, N 4, 20 x 0.075 = 1.5 loses 1 unit', () => {
    const input = { ...d, shared: true, nRef: 4 }
    near(lostPerUnit(input), 0.005)
    near(breakEvenFee('cip', input), 0.06)
    expect(worstSingleFailureLoss('cip', input)).toBeCloseTo(12, 9)
  })

  it('4. ratio exactly 0.95 and exactly 1.05 are break_even', () => {
    for (const x of [1, 0.36, 0.9, 0.15, 0.06, 7]) {
      expect(ratioBadge(0.95 * x, x), `0.95 x ${x}`).toBe('break_even')
      expect(ratioBadge(1.05 * x, x), `1.05 x ${x}`).toBe('break_even')
    }
    expect(ratioBadge(0.949, 1)).toBe('worth_it')
    expect(ratioBadge(1.051, 1)).toBe('not_worth_it')
  })

  it('5. a zero break-even is no_risk and never divides', () => {
    expect(ratioBadge(0.4, 0)).toBe('no_risk')
    expect(ratioBadge(0, 0)).toBe('no_risk')
    expect(ratioBadge(1000, 0)).toBe('no_risk')
  })

  it('8. initial quality is not ignored: hazard(1, 1, 4, 80) is 0.2, not 0', () => {
    near(hazard(1, 1, 4, 80), 0.2)
    near(hazard(0, 1, 4, 50), 0.5)
    near(hazard(2, 1, 4, 80), 0.2 + 1 / 3)
    expect(hazard(1, 1, 4)).toBe(0)
  })

  it('9. quality comes from integers: quality(0, 0, 8, 18) is 6, not 5', () => {
    expect(quality(0, 0, 8, 18)).toBe(6)
    // the float route the spec warns about lands at 5.4999...
    expect(Math.round(100 * (1 - hazard(1, 0, 8, 18)))).toBe(5)
  })
})

describe('configMath.ts is pure (AC 7)', () => {
  it('imports nothing from React, the store or the API', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/configMath.ts'), 'utf8')
    const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const s of specifiers) {
      expect(s).not.toMatch(/react/i)
      expect(s).not.toMatch(/store/)
      expect(s).not.toMatch(/api/)
      expect(s).not.toMatch(/socket|firebase|axios/)
    }
  })
})
