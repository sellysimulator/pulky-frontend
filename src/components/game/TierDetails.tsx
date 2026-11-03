import type { ReactElement } from 'react'
import type { DraftTierPlan, IncotermTierPlan } from '../../types/game'
import { INCOTERM_TIER_MEANINGS, PREVIEW_PLACEHOLDER, formatMoney, formatQty } from '../../utils/format'
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
  if (plan.refund_value_today === null) return plan.refund_basis === 'none' ? formatMoney(0) : 'Set on the arrival day'
  const value = formatMoney(plan.refund_value_today)
  const shipment = plan.refund_shipment
  if (shipment === null) return value
  return `${value}, the average price of today's shipment: ${formatQty(shipment.spot_units)} spot and ${formatQty(shipment.futures_units)} futures units`
}

function hasShipmentFee(plan: IncotermTierPlan | DraftTierPlan): plan is DraftTierPlan {
  return 'fee_for_shipment' in plan
}

interface TierDetailsProps {
  /** The tier card: the server's preview for the draft (with today's fee), or the view's own card. */
  plan: IncotermTierPlan | DraftTierPlan
  /** Show today's figures; off for a shipment already on its way. */
  today?: boolean
  /** The server's figures for the draft are on their way: the ones that depend on it show a placeholder. */
  pending?: boolean
}

/** Spec §6.3: what one tier refunds and costs, in its card's tooltip. It never shows a failure chance. */
export default function TierDetails({ plan, today = false, pending = false }: TierDetailsProps): ReactElement {
  // Only Paid-price insurance with futures shipping today depends on the spot order (spec §6.3).
  const refund = pending && plan.refund_shipment !== null ? PREVIEW_PLACEHOLDER : refundPerUnit(plan)
  const fee = !pending && hasShipmentFee(plan) ? `~${formatMoney(plan.fee_for_shipment)}` : PREVIEW_PLACEHOLDER
  return (
    <InfoTip label={`${plan.label} details`}>
      <span className="font-semibold">{INCOTERM_TIER_MEANINGS[plan.tier]}</span>
      <span>Refunds: {BASIS_WORDS[plan.refund_basis] ?? plan.refund_basis}</span>
      {today ? (
        <>
          <span className="tabular-nums">Refund per lost unit: {refund}</span>
          <span className="tabular-nums">
            Fee: {formatMoney(plan.fee_per_unit)}/unit · {fee} for today&apos;s shipment
          </span>
        </>
      ) : null}
    </InfoTip>
  )
}
