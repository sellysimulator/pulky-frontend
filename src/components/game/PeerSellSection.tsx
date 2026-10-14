import { ArrowLeftRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { LIMITS, type PlayerView, type PublicConfig } from '../../types/game'
import { unitsOnOffer } from '../../game/estimates'
import { formatMoney, formatQty } from '../../utils/format'
import Checkbox from '../shared/Checkbox'
import NumberField from '../shared/NumberField'
import { FormRow } from './OrderSection'
import { QualityField } from './PeerBuySection'

interface PeerSellSectionProps {
  view: PlayerView
  config: PublicConfig
  conserveLots: string[]
  ticked: boolean
  onTick(ticked: boolean): void
  price: number | null
  onPrice(value: number | null): void
  maxQuality: number | null
  onMaxQuality(value: number | null): void
  maxUnits: number | null
  onMaxUnits(value: number | null): void
  priceError?: string
  qualityError?: string
  unitsError?: string
  locked: boolean
}

export default function PeerSellSection({
  view,
  config,
  conserveLots,
  ticked,
  onTick,
  price,
  onPrice,
  maxQuality,
  onMaxQuality,
  maxUnits,
  onMaxUnits,
  priceError,
  qualityError,
  unitsError,
  locked,
}: PeerSellSectionProps): ReactElement {
  const fieldsOff = !ticked
  const prices = `retail ${formatMoney(config.demand.retail_price)} · spot ${formatMoney(view.brief?.supplier.spot_price ?? 0)}`
  let context: string | null = null
  if (maxQuality !== null) {
    const offer = unitsOnOffer(maxQuality, maxUnits ?? Number.MAX_SAFE_INTEGER, conserveLots, view)
    context =
      offer.lotIds.length === 0
        ? `now in your cellar: no lots at ${maxQuality}% or less · ${prices}`
        : `now in your cellar: ${formatQty(offer.units)} u at ${maxQuality}% or less (${offer.lotIds.join(', ')}) · ${prices}`
  }
  return (
    <FormRow icon={ArrowLeftRight} label="Sell">
      <Checkbox checked={ticked} onChange={onTick} disabled={locked} label="Offer units to other pulquerías" />
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 pt-1">
        <span className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-2.5 text-base">
            at
          </span>
          <NumberField
            label="at"
            hideLabel
            kind="decimal"
            prefix="$"
            suffix="/u"
            min={0.01}
            max={LIMITS.MAX_PEER_PRICE}
            value={price}
            onChange={onPrice}
            disabled={fieldsOff}
            readOnly={locked}
            error={ticked ? priceError : undefined}
          />
        </span>
        <span className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-2.5 text-base">
            quality up to
          </span>
          <QualityField
            label="quality up to"
            value={maxQuality}
            onChange={onMaxQuality}
            disabled={fieldsOff}
            readOnly={locked}
            error={ticked ? qualityError : undefined}
          />
        </span>
        <span className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-2.5 text-base">
            max
          </span>
          <NumberField
            label="max"
            hideLabel
            kind="quantity"
            suffix="u"
            min={1}
            max={LIMITS.MAX_ORDER}
            value={maxUnits}
            onChange={onMaxUnits}
            disabled={fieldsOff}
            readOnly={locked}
            error={ticked ? unitsError : undefined}
          />
        </span>
      </div>
      {context ? <p className="px-3 pt-2 text-sm text-ink-muted tabular-nums">{context}</p> : null}
    </FormRow>
  )
}
