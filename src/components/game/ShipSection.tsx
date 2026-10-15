import { ShieldCheck } from 'lucide-react'
import type { ReactElement } from 'react'
import { tierFee } from '../../game/estimates'
import type { Incoterm, InsurancePlan, PlayerView } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { roundCents } from '../../utils/money'
import RadioCards from '../shared/RadioCards'
import { FormRow } from './OrderSection'
import PlanDetails from './PlanDetails'

function refundLine(plan: InsurancePlan): string {
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
  incoterm: Incoterm
  onChange(incoterm: Incoterm): void
  shipmentMax: number
  locked: boolean
}

export default function ShipSection({ view, incoterm, onChange, shipmentMax, locked }: ShipSectionProps): ReactElement {
  const plans = view.insurance_plans.filter((p) => p.enabled)
  const fee = tierFee(incoterm, view)
  return (
    <FormRow icon={ShieldCheck}>
      <RadioCards
        legend="Ship"
        name="incoterm"
        value={incoterm}
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
