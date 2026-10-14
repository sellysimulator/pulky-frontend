import { describe, expect, it } from 'vitest'
import {
  QUALITY_GUIDE_NOTE,
  RISK_LABELS,
  formatMoney,
  formatPercent,
  formatQty,
  formatQuality,
  formatQualityGuide,
  formatSignedMoney,
  riskFromQuality,
  riskState,
  weekdayLong,
  weekdayShort,
} from '../utils/format'
import type { Weekday } from '../types/game'

const MINUS = '−'

describe('formatMoney', () => {
  it('always shows two decimals and thousands separators', () => {
    expect(formatMoney(904)).toBe('$904.00')
    expect(formatMoney(6120)).toBe('$6,120.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(1234567.891)).toBe('$1,234,567.89')
  })

  it('writes a negative with U+2212, not a hyphen', () => {
    expect(formatMoney(-4.5)).toBe(`${MINUS}$4.50`)
    expect(formatMoney(-4.5)).not.toContain('-')
    expect(formatMoney(-1234.5)).toBe(`${MINUS}$1,234.50`)
  })
})

describe('formatQty', () => {
  it('adds thousands separators to whole numbers', () => {
    expect(formatQty(1234)).toBe('1,234')
    expect(formatQty(0)).toBe('0')
    expect(formatQty(1234567)).toBe('1,234,567')
    expect(formatQty(999)).toBe('999')
  })
})

describe('formatPercent', () => {
  it('turns a fraction into a whole percent by default', () => {
    expect(formatPercent(0.302)).toBe('30%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(1)).toBe('100%')
  })

  it('honours the digits argument', () => {
    expect(formatPercent(0.3042, 1)).toBe('30.4%')
  })

  it('shows an em dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})

describe('formatSignedMoney', () => {
  it('signs gains and losses and leaves zero unsigned', () => {
    expect(formatSignedMoney(35)).toBe('+$35.00')
    expect(formatSignedMoney(-12)).toBe(`${MINUS}$12.00`)
    expect(formatSignedMoney(0)).toBe('$0.00')
  })
})

describe('weekday labels', () => {
  const days: Array<[Weekday, string, string]> = [
    ['mon', 'Mon', 'Monday'],
    ['tue', 'Tue', 'Tuesday'],
    ['wed', 'Wed', 'Wednesday'],
    ['thu', 'Thu', 'Thursday'],
    ['fri', 'Fri', 'Friday'],
    ['sat', 'Sat', 'Saturday'],
    ['sun', 'Sun', 'Sunday'],
  ]
  it.each(days)('%s', (w, short, long) => {
    expect(weekdayShort(w)).toBe(short)
    expect(weekdayLong(w)).toBe(long)
  })
})

describe('riskState and RISK_LABELS (spec 13.7)', () => {
  it('classifies the thresholds', () => {
    expect(riskState(0)).toBe('safe')
    expect(riskState(0.33)).toBe('at_risk')
    expect(riskState(0.49)).toBe('at_risk')
    expect(riskState(0.5)).toBe('likely')
    expect(riskState(1)).toBe('likely')
  })

  it('has the three labels', () => {
    expect(RISK_LABELS).toEqual({ safe: 'Safe', at_risk: 'At risk', likely: 'Likely to spoil' })
  })
})

describe('quality and risk shown together (spec 3.5)', () => {
  it('formats a whole-percent quality', () => {
    expect(formatQuality(57)).toBe('57%')
    expect(formatQuality(0)).toBe('0%')
    expect(formatQuality(100)).toBe('100%')
  })

  it('derives risk as (100 - quality) / 100', () => {
    expect(riskFromQuality(57)).toBe(0.43)
    expect(riskFromQuality(13)).toBe(0.87)
    for (let q = 0; q <= 100; q++) expect(riskFromQuality(q)).toBe((100 - q) / 100)
  })

  it('makes the quality and the risk shown beside it add up to 100 for every quality', () => {
    // A risk taken from risk_tonight = 0.875 would read 88% beside a quality of 13%.
    for (let q = 0; q <= 100; q++) {
      const quality = parseInt(formatQuality(q), 10)
      const risk = parseInt(formatPercent(riskFromQuality(q)), 10)
      expect(quality + risk).toBe(100)
    }
    expect(formatQuality(13)).toBe('13%')
    expect(formatPercent(riskFromQuality(13))).toBe('87%')
  })
})

describe('formatQualityGuide (spec 3.5)', () => {
  it('writes the "half spoiled by day" variant', () => {
    expect(formatQualityGuide({ quality: 90, half_spoiled_day: 7, last_day: 8 }, 5)).toBe(
      '90%: 10% risk tonight · half spoiled by day 7 · lasts at most 4 days (through day 8)',
    )
    expect(formatQualityGuide({ quality: 70, half_spoiled_day: 6, last_day: 9 }, 5)).toBe(
      '70%: 30% risk tonight · half spoiled by day 6 · lasts at most 5 days (through day 9)',
    )
    expect(formatQualityGuide({ quality: 100, half_spoiled_day: 9, last_day: 11 }, 5)).toBe(
      '100%: 0% risk tonight · half spoiled by day 9 · lasts at most 7 days (through day 11)',
    )
  })

  it('writes the "half spoiled tonight" variant when half_spoiled_day equals the view day', () => {
    expect(formatQualityGuide({ quality: 50, half_spoiled_day: 5, last_day: 7 }, 5)).toBe(
      '50%: 50% risk tonight · half spoiled tonight · lasts at most 3 days (through day 7)',
    )
  })

  it('compares half_spoiled_day with the day it is given, not a fixed day', () => {
    const row = { quality: 90, half_spoiled_day: 7, last_day: 8 }
    expect(formatQualityGuide(row, 7)).toBe(
      '90%: 10% risk tonight · half spoiled tonight · lasts at most 2 days (through day 8)',
    )
    expect(formatQualityGuide(row, 5)).toContain('half spoiled by day 7')
  })

  it('says "1 day", singular, when one day is left', () => {
    expect(formatQualityGuide({ quality: 30, half_spoiled_day: 5, last_day: 5 }, 5)).toBe(
      '30%: 70% risk tonight · half spoiled tonight · lasts at most 1 day (through day 5)',
    )
  })

  it('picks the quality-0 variant from the quality alone, even when other fields would match', () => {
    expect(formatQualityGuide({ quality: 0, half_spoiled_day: 5, last_day: 5 }, 5)).toBe(
      '0%: spoils tonight · sell it today',
    )
    expect(formatQualityGuide({ quality: 0, half_spoiled_day: 9, last_day: 9 }, 5)).toBe(
      '0%: spoils tonight · sell it today',
    )
  })

  it('exposes the note shown below the guide verbatim', () => {
    expect(QUALITY_GUIDE_NOTE).toBe(
      'Better units last longer. Conserved pulque keeps its quality for extra nights.',
    )
  })
})
