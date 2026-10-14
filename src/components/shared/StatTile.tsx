import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

interface StatTileProps {
  label: string
  icon?: LucideIcon
  value: ReactNode
  sub?: ReactNode
  delta?: { text: string; direction: 'up' | 'down'; tone: 'good' | 'bad' | 'neutral' }
  size?: 'stat' | 'lg'
}

const DELTA_TONE: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'text-success-ink',
  bad: 'text-danger-ink',
  neutral: 'text-ink-muted',
}

export default function StatTile({ label, icon: Icon, value, sub, delta, size = 'stat' }: StatTileProps): ReactElement {
  const Arrow = delta?.direction === 'down' ? TrendingDown : TrendingUp
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <div className={['tabular-nums text-ink', size === 'lg' ? 'text-lg font-semibold' : 'text-stat'].join(' ')}>{value}</div>
      {sub ? <div className="text-sm text-ink-muted">{sub}</div> : null}
      {delta ? (
        <div className={['flex items-center gap-1 text-sm tabular-nums', DELTA_TONE[delta.tone]].join(' ')}>
          <Arrow size={14} aria-hidden="true" />
          <span>{delta.text}</span>
        </div>
      ) : null}
    </div>
  )
}
