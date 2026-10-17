/**
 * Read-only mirror of the engine maths for the host config screen: the help
 * entries (section 24) and the previews and insurance calculator (section 25).
 * Pure: no React, no store, no API. Nothing here is ever sent back to the server.
 */
import { WEEKDAYS, type InsuredTier, type QualityGuideRow, type Weekday } from '../types/game'
import { roundCents } from '../utils/money'

/** 1 (Monday) .. 7 (Sunday). */
function weekdayIndex(day: Weekday): number {
  return WEEKDAYS.indexOf(day) + 1
}

/** Spec 7.1: triangular kernel around the peak window, no wrap-around. */
export function weekdayMultiplier(day: Weekday, from: Weekday, to: Weekday): number {
  const w = weekdayIndex(day)
  const f = weekdayIndex(from)
  const t = weekdayIndex(to)
  const dist = w < f ? f - w : w > t ? w - t : 0
  const reach = Math.max(f - 1, 7 - t) + 1
  return Math.min(1, Math.max(0, 1 - dist / reach))
}

export function weekdayMultipliers(from: Weekday, to: Weekday): Record<Weekday, number> {
  const out = {} as Record<Weekday, number>
  for (const day of WEEKDAYS) out[day] = weekdayMultiplier(day, from, to)
  return out
}

/** Spec 7.2: expected market demand for one day. */
export function marketLambda(perPlayerPeak: number, players: number, multiplier: number): number {
  return perPlayerPeak * players * multiplier
}

/** Spec 7.3: each pulquería's share of market demand. */
export function shares(reputations: Record<string, number>): Record<string, number> {
  const weights = Object.entries(reputations).map(([alias, r]) => [alias, 0.5 + r] as const)
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  const out: Record<string, number> = {}
  for (const [alias, w] of weights) out[alias] = w / total
  return out
}

/** Spec 3.3: the chance a unit of a lot spoils at the check made at this age. */
export function hazard(age: number, freshDays: number, maxDays: number, initialQuality = 100): number {
  const k = Math.max(0, age - freshDays)
  return Math.min(1, 1 - initialQuality / 100 + k / (maxDays - freshDays))
}

/** Spec 3.5: whole-percent quality at tonight's check, in integers. */
export function quality(age: number, freshDays: number, maxDays: number, initialQuality: number): number {
  const r = maxDays - freshDays
  const k = Math.max(0, age + 1 - freshDays)
  return Math.max(0, Math.floor((2 * r * initialQuality - 200 * k + r) / (2 * r)))
}

/** Spec 3.5: days the lot can still be sold, counting today. */
export function daysLeft(age: number, freshDays: number, maxDays: number, initialQuality: number): number {
  const r = maxDays - freshDays
  const ageOfCertainSpoil = Math.max(age + 1, freshDays + Math.floor((initialQuality * r + 99) / 100))
  return ageOfCertainSpoil - age
}

/** Spec 3.5: 21 rows, quality 100 down to 0 in steps of 5. */
export function qualityGuide(day: number, freshDays: number, maxDays: number): QualityGuideRow[] {
  const r = maxDays - freshDays
  const rows: QualityGuideRow[] = []
  for (let q = 100; q >= 0; q -= 5) {
    let survival = 1
    let night = 1
    let half = 0
    for (;;) {
      const qj = Math.max(0, q - ((night - 1) * 100) / r)
      survival *= qj / 100
      if (survival <= 0.5 + 1e-9) {
        half = night
        break
      }
      night += 1
    }
    const k = Math.floor((q * r + 99) / 100) + 1
    rows.push({ quality: q, half_spoiled_day: day + half - 1, last_day: day + k - 1 })
  }
  return rows
}

/** Spec 3.5: quality points a lot loses per night after its fresh period. */
export function qualityStepPerNight(freshDays: number, maxDays: number): number {
  return 100 / (maxDays - freshDays)
}

/** Spec 7.6: the new reputation after one day. */
export function reputationStep(
  reputation: number,
  fill: number,
  waste: number,
  smoothing: number,
  wasteWeight: number,
): number {
  const day = (1 - wasteWeight) * fill + wasteWeight * (1 - waste)
  return (1 - smoothing) * reputation + smoothing * day
}

/** Spec 5.1: the spot price range, rounded to cents. */
export function spotRange(basePrice: number, spread: number): [number, number] {
  return [roundCents(basePrice * (1 - spread)), roundCents(basePrice * (1 + spread))]
}

export interface BreakEvenInput {
  failureProbability: number
  lossFraction: number
  shared: boolean
  nRef: number
  referenceShipment: number
  basePrice: number
  retailPrice: number
}

function lostUnits(input: BreakEvenInput): number {
  const effective = input.shared ? input.lossFraction / input.nRef : input.lossFraction
  return Math.floor(input.referenceShipment * effective + 1e-9)
}

function refundValue(tier: InsuredTier, input: BreakEvenInput): number {
  return tier === 'ddp' ? input.retailPrice : input.basePrice
}

/** Spec 6.4: expected units lost per unit shipped. */
export function lostPerUnit(input: BreakEvenInput): number {
  return (input.failureProbability * lostUnits(input)) / input.referenceShipment
}

/** Spec 6.4: the fee at which the expected refund equals the fee (unrounded). */
export function breakEvenFee(tier: InsuredTier, input: BreakEvenInput): number {
  return lostPerUnit(input) * refundValue(tier, input)
}

export function feeFromMargin(breakEven: number, targetMargin: number): number {
  return roundCents(breakEven * (1 + targetMargin))
}

export type RatioBadge = 'worth_it' | 'break_even' | 'not_worth_it' | 'no_risk'

const BADGE_EPSILON = 1e-9

/** Spec 6.4 table; the boundaries 0.95 and 1.05 belong to break_even. */
export function ratioBadge(fee: number, breakEven: number): RatioBadge {
  if (breakEven <= 0) return 'no_risk'
  const ratio = fee / breakEven
  if (ratio < 0.95 - BADGE_EPSILON) return 'worth_it'
  if (ratio > 1.05 + BADGE_EPSILON) return 'not_worth_it'
  return 'break_even'
}

export function worstSingleFailureLoss(tier: InsuredTier, input: BreakEvenInput): number {
  return lostUnits(input) * refundValue(tier, input)
}

export function chanceOfAtLeastOneFailure(p: number, days: number): number {
  return 1 - (1 - p) ** days
}

export function expectedFailures(p: number, days: number): number {
  return p * days
}
