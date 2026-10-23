import { ShieldCheck } from 'lucide-react'
import type { ReactElement } from 'react'
import type { IncotermTier, PlayerView } from '../../types/game'
import { formatMoney } from '../../utils/format'
import InfoTip from '../shared/InfoTip'
import RadioCards from '../shared/RadioCards'
import { FormRow } from './OrderSection'
import TierDetails from './TierDetails'

interface ShipSectionProps {
  view: PlayerView
  incoterm_tier: IncotermTier
  onChange(incoterm_tier: IncotermTier): void
  shipmentMax: number
  locked: boolean
}

export default function ShipSection({ view, incoterm_tier, onChange, shipmentMax, locked }: ShipSectionProps): ReactElement {
  const plans = view.tier_plans.filter((p) => p.enabled)
  return (
    <FormRow
      icon={ShieldCheck}
      label="Shipping insurance"
      info={
        <InfoTip label="Shipping insurance">
          <span>
            The insurance covers today&apos;s shipment against a refrigeration failure. Its fee is paid on every unit shipped;
            units lost are refunded on the arrival day.
          </span>
          <span>
            An insured shipment has blockchain tracking: its condition is on a shared record, so the supplier cannot dispute a
            loss.
          </span>
          <span>Market-price insurance&apos;s refund swings with the market; Paid-price insurance&apos;s is fixed at what you paid.</span>
        </InfoTip>
      }
    >
      <RadioCards
        legend="Shipping insurance"
        hideLegend
        name="incoterm_tier"
        value={incoterm_tier}
        locked={locked}
        onChange={onChange}
        options={plans.map((plan) => ({
          value: plan.tier,
          label: plan.label,
          lines: [`Fee ${formatMoney(plan.fee_per_unit)}/unit`],
          info: <TierDetails plan={plan} shipmentMax={shipmentMax} />,
        }))}
      />
    </FormRow>
  )
}
