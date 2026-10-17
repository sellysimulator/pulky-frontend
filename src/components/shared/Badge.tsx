import type { LucideIcon } from 'lucide-react'
import { useId, type ReactElement, type ReactNode } from 'react'
import { hasSecondChannel, slotIndex, SLOT_FILL } from '../../styles/slots'
import { TONE_CHIP, type StatusTone } from '../../styles/tones'

interface BadgeProps {
  tone: 'neutral' | 'accent' | StatusTone | 'shown'
  icon?: LucideIcon
  children: ReactNode
}

const TONES: Record<BadgeProps['tone'], string> = {
  neutral: 'bg-muted text-ink-muted',
  accent: 'bg-accent-subtle text-accent-hover border border-accent-line',
  ...TONE_CHIP,
  // design.md §2.4: the dashed edge belongs to this badge alone.
  shown: 'bg-muted text-ink border border-dashed border-border-control',
}

export default function Badge({ tone, icon: Icon, children }: BadgeProps): ReactElement {
  return (
    <span
      className={[
        'inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap',
        TONES[tone],
      ].join(' ')}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Pulquería chip: swatch (hatched for P7-P12) then the name in ink (design.md §3.1). */
export function PulqueriaChip({ alias, displayName, you = false }: { alias: string; displayName: string; you?: boolean }): ReactElement {
  const slot = slotIndex(alias)
  const hatched = hasSecondChannel(alias)
  const patternId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 rounded-xs">
        {hatched ? (
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" className={SLOT_FILL[slot]} />
              <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1.5" className="stroke-card" />
            </pattern>
          </defs>
        ) : null}
        <rect width="10" height="10" className={SLOT_FILL[slot]} fill={hatched ? `url(#${patternId})` : undefined} />
      </svg>
      <span>{displayName}</span>
      {you ? <Badge tone="accent">You</Badge> : null}
    </span>
  )
}
