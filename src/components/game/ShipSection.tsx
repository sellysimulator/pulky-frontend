import { ShieldCheck } from 'lucide-react'
import type { ReactElement } from 'react'
import { tierFee } from '../../game/estimates'
import type { IncotermTier, IncotermTierPlan, PlayerView } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { roundCents } from '../../utils/money'
import RadioCards from '../shared/RadioCards'
import { FormRow } from './OrderSection'
import PlanDetails from './PlanDetails'

function refundLine(plan: IncotermTierPlan): string {
  switch (plan.refund_basis) {
    case 'none':
      return 'No refund'
    case 'arrival_spot':
      return "Refund at the arrival day's spot price"
    default:
      return plan.refund_value_today === null ? 'Refund set on the arrival day' : `Refund ${formatMoney(plan.refund_value_today)}/u lost`
  }
}

interface ShipSectionProps {
  view: PlayerView
  incoterm_tier: IncotermTier
  onChange(incoterm_tier: IncotermTier): void
  shipmentMax: number
  locked: boolean
}

export default function ShipSection({ view, incoterm_tier, onChange, shipmentMax, locked }: ShipSectionProps): ReactElement {
  const plans = view.tier_plans.filter((p) => p.enabled)
  const fee = tierFee(incoterm_tier, view)
  return (
    <FormRow icon={ShieldCheck}>
      <RadioCards
        legend="Ship"
        name="incoterm_tier"
        value={incoterm_tier}
        locked={locked}
        onChange={onChange}
        options={plans.map((plan) => ({
          value: plan.tier,
          label: plan.label,
          lines: [`Fee ${formatMoney(plan.fee_per_unit)}/u`, refundLine(plan)],
        }))}
      />
      <p className="mt-2 text-sm text-ink-muted tabular-nums">
        Fee for today&apos;s shipment: ~{formatMoney(roundCents(fee * shipmentMax))}
      </p>
      <PlanDetails plans={plans} shipmentMax={shipmentMax} />
    </FormRow>
  )
}
