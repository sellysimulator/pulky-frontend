import { useState, type ReactElement } from 'react'
import type { InsurancePlan } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { roundCents } from '../../utils/money'
import { getUiFlag, setUiFlag } from '../../utils/storage'
import Collapsible from '../shared/Collapsible'

const BASIS_WORDS: Record<string, string> = {
  none: 'Nothing: you carry the risk',
  paid: "What you paid: today's spot price for spot units, the base price for futures units",
  arrival_spot: 'The spot price on the arrival day',
  retail: 'The retail price',
}

function refundPerUnit(plan: InsurancePlan): string {
  if (plan.refund_basis === 'none') return formatMoney(0)
  if (plan.refund_basis === 'arrival_spot' || plan.refund_value_today === null) return 'Set on the arrival day'
  return formatMoney(plan.refund_value_today)
}

interface PlanDetailsProps {
  plans: InsurancePlan[]
  shipmentMax: number
}

/** Spec §6.3: what each enabled tier refunds and costs. It never shows a failure chance. */
export default function PlanDetails({ plans, shipmentMax }: PlanDetailsProps): ReactElement {
  const [open, setOpen] = useState(() => getUiFlag('plan_details_open'))
  const handleOpen = (value: boolean): void => {
    setOpen(value)
    setUiFlag('plan_details_open', value)
  }
  return (
    <Collapsible variant="inline" summary="Plan details" open={open} onOpenChange={handleOpen}>
      <ul className="flex flex-col gap-3">
        {plans.map((plan) => (
          <li key={plan.tier} className="flex flex-col gap-0.5 text-sm">
            <span className="font-semibold">{plan.label}</span>
            <span>
              <span className="text-ink-muted">Refunds:</span> {BASIS_WORDS[plan.refund_basis] ?? plan.refund_basis}
            </span>
            <span className="tabular-nums">
              <span className="text-ink-muted">Refund per lost unit:</span> {refundPerUnit(plan)}
            </span>
            <span className="tabular-nums">
              <span className="text-ink-muted">Fee:</span> {formatMoney(plan.fee_per_unit)}/u · ~
              {formatMoney(roundCents(plan.fee_per_unit * shipmentMax))} for today&apos;s shipment
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">DAP&apos;s refund swings with the market; CIP&apos;s is fixed at what you paid.</p>
    </Collapsible>
  )
}
