import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { formatPercent, riskState, RISK_LABELS } from '../../utils/format'

interface RiskIndicatorProps {
  risk: number
  variant?: 'full' | 'compact'
}

type State = ReturnType<typeof riskState>

const ICONS: Record<State, LucideIcon> = { safe: CircleCheck, at_risk: TriangleAlert, likely: OctagonAlert }
const CHIP: Record<State, string> = {
  safe: 'bg-success-subtle text-success-ink',
  at_risk: 'bg-warning-subtle text-warning-ink',
  likely: 'bg-danger-subtle text-danger-ink',
}
const INK: Record<State, string> = { safe: 'text-success-ink', at_risk: 'text-warning-ink', likely: 'text-danger-ink' }
const MARK: Record<State, string> = { safe: 'text-success', at_risk: 'text-warning', likely: 'text-danger' }
const FILL: Record<State, string> = { safe: 'bg-success', at_risk: 'bg-warning', likely: 'bg-danger' }

/** Spec §13.7: number + bar + label, never colour alone. */
export default function RiskIndicator({ risk, variant = 'full' }: RiskIndicatorProps): ReactElement {
  const state = riskState(risk)
  const Icon = ICONS[state]
  const width = Math.round(Math.min(1, Math.max(0, risk)) * 1000) / 10
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-[4ch] text-right text-sm font-semibold tabular-nums">{formatPercent(risk)}</span>
      <span aria-hidden="true" className="h-2 w-16 overflow-hidden rounded-full bg-muted print:border print:border-border-control">
        <span className={['block h-full rounded-full', FILL[state]].join(' ')} style={{ width: `${width}%` }} />
      </span>
      <span
        className={[
          'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
          variant === 'full' ? `h-6 rounded-sm px-2 ${CHIP[state]}` : INK[state],
        ].join(' ')}
      >
        <Icon size={14} aria-hidden="true" className={MARK[state]} />
        {RISK_LABELS[state]}
      </span>
    </span>
  )
}
