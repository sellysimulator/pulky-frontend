import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import { TONE_CHIP, TONE_FILL, TONE_INK, TONE_MARK, type StatusTone } from '../../styles/tones'
import { formatPercent, riskState, RISK_LABELS } from '../../utils/format'

interface RiskIndicatorProps {
  risk: number
  variant?: 'full' | 'compact'
}

type State = ReturnType<typeof riskState>

const ICONS: Record<State, LucideIcon> = { safe: CircleCheck, at_risk: TriangleAlert, likely: OctagonAlert }
/** design.md §2.4: the spoil-risk states reuse the status tokens. */
const RISK_TONE: Record<State, StatusTone> = { safe: 'success', at_risk: 'warning', likely: 'danger' }

/** Spec §13.7: number + bar + label, never colour alone. */
export default function RiskIndicator({ risk, variant = 'full' }: RiskIndicatorProps): ReactElement {
  const state = riskState(risk)
  const tone = RISK_TONE[state]
  const Icon = ICONS[state]
  const width = Math.round(Math.min(1, Math.max(0, risk)) * 1000) / 10
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-[4ch] text-right text-sm font-semibold tabular-nums">{formatPercent(risk)}</span>
      <span aria-hidden="true" className="h-2 w-16 overflow-hidden rounded-full bg-muted print:border print:border-border-control">
        <span className={['block h-full rounded-full', TONE_FILL[tone]].join(' ')} style={{ width: `${width}%` }} />
      </span>
      <span
        className={[
          'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
          variant === 'full' ? `h-6 rounded-sm px-2 ${TONE_CHIP[tone]}` : TONE_INK[tone],
        ].join(' ')}
      >
        <Icon size={14} aria-hidden="true" className={TONE_MARK[tone]} />
        {RISK_LABELS[state]}
      </span>
    </span>
  )
}
