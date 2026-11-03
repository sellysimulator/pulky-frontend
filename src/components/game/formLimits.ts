/**
 * The decision form's bound checks and messages (spec §4.3), with the server's limits
 * from `useLimits()` (spec §13.6). The client holds no copy of a limit: until they
 * load, a field checks only its lower bound and its message names only that bound,
 * and the server's own check stands.
 */
import { isWholeCents } from '../../game/estimates'
import type { Limits } from '../../types/game'
import { formatMoney, formatQty } from '../../utils/format'

export function orderMessage(limits: Limits | null): string {
  return limits === null
    ? 'Orders must be whole numbers, 0 or more.'
    : `Orders must be whole numbers from 0 to ${formatQty(limits.MAX_ORDER)}.`
}

export function priceMessage(limits: Limits | null): string {
  return limits === null
    ? 'Peer prices must be at least $0.01, in whole cents.'
    : `Peer prices must be from $0.01 to ${formatMoney(limits.MAX_PEER_PRICE)}, in whole cents.`
}

export function unitsMessage(limits: Limits | null): string {
  return limits === null ? 'You can offer 1 unit or more.' : `You can offer from 1 to ${formatQty(limits.MAX_ORDER)} units.`
}

/** A whole number from 0 up to `MAX_ORDER` (no upper bound while the limits load). Negatives never pass. */
export function isValidQuantity(value: number | null, limits: Limits | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 0 && (limits === null || value <= limits.MAX_ORDER)
}

export function isValidPrice(value: number | null, limits: Limits | null): boolean {
  return (
    value !== null &&
    Number.isFinite(value) &&
    isWholeCents(value) &&
    value >= 0.01 &&
    (limits === null || value <= limits.MAX_PEER_PRICE)
  )
}

export function isValidUnits(value: number | null, limits: Limits | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 1 && (limits === null || value <= limits.MAX_ORDER)
}
