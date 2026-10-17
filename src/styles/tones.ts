/**
 * Status-tone classes shared by every component that colours a state
 * (design.md §2.3: each status has a mark, an ink, a subtle fill and a line).
 * Values are full literals so Tailwind's scanner sees them; never build a
 * class from a tone name.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info'

/** Mark as text: icons that carry the state (≥ 3:1). */
export const TONE_MARK = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
} as const satisfies Record<StatusTone, string>

/** Ink: status text on the card or on the subtle fill (≥ 4.5:1). */
export const TONE_INK = {
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  info: 'text-info-ink',
} as const satisfies Record<StatusTone, string>

/** Chip: subtle fill with the ink on it (design.md §7.10, §7.11). */
export const TONE_CHIP = {
  success: 'bg-success-subtle text-success-ink',
  warning: 'bg-warning-subtle text-warning-ink',
  danger: 'bg-danger-subtle text-danger-ink',
  info: 'bg-info-subtle text-info-ink',
} as const satisfies Record<StatusTone, string>

/** Inline alert: line border, subtle fill, ink text (design.md §7.13). */
export const TONE_INLINE = {
  success: 'border-success-line bg-success-subtle text-success-ink',
  warning: 'border-warning-line bg-warning-subtle text-warning-ink',
  danger: 'border-danger-line bg-danger-subtle text-danger-ink',
  info: 'border-info-line bg-info-subtle text-info-ink',
} as const satisfies Record<StatusTone, string>

/** Line alone: the edge of a toast on the card (design.md §7.13). */
export const TONE_BORDER = {
  success: 'border-success-line',
  warning: 'border-warning-line',
  danger: 'border-danger-line',
  info: 'border-info-line',
} as const satisfies Record<StatusTone, string>

/** Mark as a fill: meter bars (design.md §2.4). */
export const TONE_FILL = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const satisfies Record<StatusTone, string>
