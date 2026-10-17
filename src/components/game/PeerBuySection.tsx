import { ArrowLeftRight } from 'lucide-react'
import type { KeyboardEvent, ReactElement } from 'react'
import { LIMITS, type PlayerView } from '../../types/game'
import { QUALITY_GUIDE_NOTE } from '../../utils/format'
import Checkbox from '../shared/Checkbox'
import InfoTip from '../shared/InfoTip'
import NumberField from '../shared/NumberField'
import { FormRow } from './OrderSection'
import QualityGuide from './QualityGuide'

interface QualityFieldProps {
  label: string
  value: number | null
  onChange(value: number | null): void
  disabled: boolean
  readOnly: boolean
  error?: string
}

/** A quality limit: whole percent, arrow keys move between multiples of 5. */
export function QualityField({ label, value, onChange, disabled, readOnly, error }: QualityFieldProps): ReactElement {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || readOnly) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    e.stopPropagation()
    const current = value ?? 0
    const next = e.key === 'ArrowUp' ? Math.floor(current / 5) * 5 + 5 : Math.ceil(current / 5) * 5 - 5
    onChange(Math.min(100, Math.max(0, next)))
  }
  return (
    // The wrapper only intercepts arrow keys before the field's own one-step handler.
    <div onKeyDownCapture={handleKeyDown}>
      <NumberField
        label={label}
        hideLabel
        kind="quantity"
        min={0}
        max={100}
        suffix="%"
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        error={error}
      />
    </div>
  )
}

interface PeerBuySectionProps {
  view: PlayerView
  ticked: boolean
  onTick(ticked: boolean): void
  maxPrice: number | null
  onMaxPrice(value: number | null): void
  minQuality: number | null
  onMinQuality(value: number | null): void
  priceError?: string
  qualityError?: string
  closed: boolean
  locked: boolean
}

export default function PeerBuySection({
  view,
  ticked,
  onTick,
  maxPrice,
  onMaxPrice,
  minQuality,
  onMinQuality,
  priceError,
  qualityError,
  closed,
  locked,
}: PeerBuySectionProps): ReactElement {
  const fieldsOff = closed || !ticked
  return (
    <FormRow
      icon={ArrowLeftRight}
      label="Buy from Players"
      info={
        <InfoTip label="Buy from Players">
          <span>
            If the supplier cannot fill your whole order, buy the missing units today from other pulquerías&apos; offers,
            within your price, your minimum quality and your cash.
          </span>
          <span>{QUALITY_GUIDE_NOTE}</span>
        </InfoTip>
      }
    >
      <Checkbox
        checked={ticked}
        onChange={onTick}
        disabled={closed || locked}
        label="Buy the shortfall from other pulquerías"
      />
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 pt-1">
        <span className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-2.5 text-base">
            up to
          </span>
          <NumberField
            label="up to"
            hideLabel
            kind="decimal"
            prefix="$"
            suffix="/unit"
            min={0.01}
            max={LIMITS.MAX_PEER_PRICE}
            value={maxPrice}
            onChange={onMaxPrice}
            disabled={fieldsOff}
            readOnly={locked}
            error={ticked && !closed ? priceError : undefined}
          />
        </span>
        <span className="flex items-start gap-2">
          <span aria-hidden="true" className="pt-2.5 text-base">
            quality at least
          </span>
          <QualityField
            label="quality at least"
            value={minQuality}
            onChange={onMinQuality}
            disabled={fieldsOff}
            readOnly={locked}
            error={ticked && !closed ? qualityError : undefined}
          />
        </span>
      </div>
      <div className="px-3 pt-2">
        {closed ? (
          <p className="text-sm text-ink-muted">Spot orders are closed, so there is no shortfall to cover.</p>
        ) : (
          <QualityGuide view={view} minQuality={minQuality} />
        )}
      </div>
    </FormRow>
  )
}
