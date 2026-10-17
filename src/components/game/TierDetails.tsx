import type { ReactElement } from 'react'
import type { IncotermTier, IncotermTierPlan } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { roundCents } from '../../utils/money'
import InfoTip from '../shared/InfoTip'

/** Spec §6.3: what each Incoterm means for the trip from the supplier to the cellar. */
const MEANING: Record<IncotermTier, string> = {
  exw: "EXW (Ex Works): you collect the pulque at the supplier's door and carry the risk of the whole trip.",
  cip: 'CIP (Carriage and Insurance Paid): the supplier pays for the trip and insures it to your cellar.',
  dap: 'DAP (Delivered at Place): the supplier carries the risk until the pulque reaches your cellar.',
  ddp: 'DDP (Delivered Duty Paid): the supplier carries every cost and risk to your door.',
}

const BASIS_WORDS: Record<string, string> = {
  none: 'Nothing: you carry the risk',
  paid: "What you paid: today's spot price for spot units, the base price for futures units",
  arrival_spot: 'The spot price on the arrival day',
  retail: 'The retail price',
}

function refundPerUnit(plan: IncotermTierPlan): string {
  if (plan.refund_basis === 'none') return formatMoney(0)
  if (plan.refund_basis === 'arrival_spot' || plan.refund_value_today === null) return 'Set on the arrival day'
  return formatMoney(plan.refund_value_today)
}

interface TierDetailsProps {
  plan: IncotermTierPlan
  /** Units in today's shipment, for the fee estimate; omitted for a shipment already on its way. */
  shipmentMax?: number
}

/** Spec §6.3: what one tier refunds and costs, in its card's tooltip. It never shows a failure chance. */
export default function TierDetails({ plan, shipmentMax }: TierDetailsProps): ReactElement {
  return (
    <InfoTip label={`${plan.label} details`}>
      <span className="font-semibold">{MEANING[plan.tier]}</span>
      <span>Refunds: {BASIS_WORDS[plan.refund_basis] ?? plan.refund_basis}</span>
      {shipmentMax === undefined ? null : (
        <>
          <span className="tabular-nums">Refund per lost unit: {refundPerUnit(plan)}</span>
          <span className="tabular-nums">
            Fee: {formatMoney(plan.fee_per_unit)}/unit · ~{formatMoney(roundCents(plan.fee_per_unit * shipmentMax))} for today&apos;s
            shipment
          </span>
        </>
      )}
    </InfoTip>
  )
}
