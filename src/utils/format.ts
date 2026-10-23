import type { IncotermTier, QualityGuideRow, Weekday } from '../types/game'

const MINUS = '−'
const DASH = '—'

const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

const WEEKDAY_LONG: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function groupedAbs(value: number, decimals: number): string {
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatMoney(value: number): string {
  const digits = groupedAbs(value, 2)
  const negative = value < 0 && digits !== '0.00'
  return `${negative ? MINUS : ''}$${digits}`
}

export function formatQty(value: number): string {
  const digits = groupedAbs(value, 0)
  return `${value < 0 && digits !== '0' ? MINUS : ''}${digits}`
}

/** A quantity with its unit spelled out: "1 unit", "12 units". */
export function formatUnits(value: number): string {
  return `${formatQty(value)} ${value === 1 ? 'unit' : 'units'}`
}

/** A lot's number from its server id: "L3" → "3"; a lot bought from another pulquería keeps its id ("B5-1"). */
export function lotNumber(id: string): string {
  return /^L\d+$/.test(id) ? id.slice(1) : id
}

/** "Lot #3", "Lot #B5-1" (spec §13.7: no abbreviations on the player screen). */
export function lotLabel(id: string): string {
  return `Lot #${lotNumber(id)}`
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null) return DASH
  return `${(value * 100).toFixed(digits)}%`
}

export function formatSignedMoney(value: number): string {
  const digits = groupedAbs(value, 2)
  if (digits === '0.00') return '$0.00'
  return `${value > 0 ? '+' : MINUS}$${digits}`
}

export function weekdayShort(w: Weekday): string {
  return WEEKDAY_SHORT[w]
}

export function weekdayLong(w: Weekday): string {
  return WEEKDAY_LONG[w]
}

/** Spec §13.7: Safe 0%, At risk below 50%, Likely to spoil from 50%. */
export function riskState(risk: number): 'safe' | 'at_risk' | 'likely' {
  if (risk <= 0) return 'safe'
  if (risk < 0.5) return 'at_risk'
  return 'likely'
}

/** A shipping insurance's name, for tables, legends and signs; its card label comes from the server's tier plan (spec §6.3). */
export const INCOTERM_TIER_NAMES = {
  exw: 'No insurance',
  cip: 'Paid-price insurance',
  dap: 'Market-price insurance',
  ddp: 'Retail-price insurance',
} as const satisfies Record<IncotermTier, string>

/** Spec §6.3: what each shipping insurance means for the trip from the supplier to the cellar. */
export const INCOTERM_TIER_MEANINGS: Record<IncotermTier, string> = {
  exw: 'No insurance: you carry the risk of the whole trip, and a lost unit is gone.',
  cip: 'Paid-price insurance: the supplier carries the risk of the trip and refunds a lost unit at what you paid for it.',
  dap: 'Market-price insurance: the supplier carries the risk of the trip and refunds a lost unit at the spot price on the day the shipment arrives.',
  ddp: 'Retail-price insurance: the supplier carries the risk of the trip and refunds a lost unit at the retail price, so it also covers the sale you lost.',
}

export const RISK_LABELS: Record<'safe' | 'at_risk' | 'likely', string> = {
  safe: 'Safe',
  at_risk: 'At risk',
  likely: 'Likely to spoil',
}

export function formatQuality(quality: number): string {
  return `${quality}%`
}

/** Spec §3.5: the risk shown beside a quality, so the pair adds up to 100. */
export function riskFromQuality(quality: number): number {
  return (100 - quality) / 100
}

/** Spec §3.5 guide copy; `day` is the view's day. */
export function formatQualityGuide(row: QualityGuideRow, day: number): string {
  const q = row.quality
  if (q === 0) return '0%: spoils tonight · sell it today'
  const n = row.last_day - day + 1
  const lasts = `lasts at most ${n} ${n === 1 ? 'day' : 'days'} (through day ${row.last_day})`
  const half =
    row.half_spoiled_day === day
      ? 'half spoiled tonight'
      : `half spoiled by day ${row.half_spoiled_day}`
  return `${q}%: ${100 - q}% risk tonight · ${half} · ${lasts}`
}

export const QUALITY_GUIDE_NOTE =
  'Better units last longer. Conserved pulque keeps its quality for extra nights.'
