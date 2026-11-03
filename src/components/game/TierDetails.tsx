import type { ReactElement } from 'react'
import type { IncotermTierPlan } from '../../types/game'
import { INCOTERM_TIER_MEANINGS, formatMoney, formatQty } from '../../utils/format'
import { roundCents } from '../../utils/money'
import InfoTip from '../shared/InfoTip'

const BASIS_WORDS: Record<string, string> = {
  none: 'Nothing: you carry the risk',
  paid: "What you paid, averaged over the shipment: spot units at today's spot price and futures units at the base price give one average price, and every lost unit is refunded at it",
  arrival_spot: 'The spot price on the arrival day',
  retail: 'The retail price',
}

/**
 * Spec §6.3: the server's own figure (`refund_value_today`), what the engine would refund per lost unit; this
 * card computes none. Market-price insurance's is null until the arrival day's price exists (a lead time of 1 or
 * more); a Paid-price figure that depends on the spot order names the shipment it assumed.
 */
function refundPerUnit(plan: IncotermTierPlan): string {
  if (plan.refund_basis === 'none') return formatMoney(0)
  if (plan.refund_value_today === null) return 'Set on the arrival day'
  const value = formatMoney(plan.refund_value_today)
  const shipment = plan.refund_shipment
  if (shipment === null) return value
  return `${value}, the average price of today's shipment: ${formatQty(shipment.spot_units)} spot and ${formatQty(shipment.futures_units)} futures units`
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
      <span className="font-semibold">{INCOTERM_TIER_MEANINGS[plan.tier]}</span>
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
