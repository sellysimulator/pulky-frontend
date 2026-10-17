/**
 * Pulquería slot colours (design.md §3.1): P*n* wears slot *n*, and P7-P12
 * reuse the slot of P*n−6* plus a second channel. Values are full literals so
 * Tailwind's scanner sees them.
 */

/** The *n* of `Pn`; an alias of any other form counts as P1. */
function aliasN(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? 1)
}

/** 0-based slot: P1 → 0 … P6 → 5, P7 → 0 … P12 → 5; an unparseable alias → 0. */
export function slotIndex(alias: string): number {
  const slot = (((aliasN(alias) - 1) % 6) + 6) % 6
  return Number.isNaN(slot) ? 0 : slot
}

/** P7-P12: the slot's hue with a second channel (hatched fills, dashed lines). */
export function hasSecondChannel(alias: string): boolean {
  return aliasN(alias) > 6
}

export const SLOT_FILL = ['fill-p1', 'fill-p2', 'fill-p3', 'fill-p4', 'fill-p5', 'fill-p6'] as const

export const SLOT_BG = ['bg-p1', 'bg-p2', 'bg-p3', 'bg-p4', 'bg-p5', 'bg-p6'] as const
