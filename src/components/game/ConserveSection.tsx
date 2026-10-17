import { ChevronDown, Snowflake } from 'lucide-react'
import { useId, useState, type ReactElement } from 'react'
import type { PlayerView, PublicConfig } from '../../types/game'
import { formatMoney, formatQuality, formatUnits, lotLabel, riskFromQuality } from '../../utils/format'
import { roundCents } from '../../utils/money'
import Badge from '../shared/Badge'
import Checkbox from '../shared/Checkbox'
import InfoTip from '../shared/InfoTip'
import RiskIndicator from '../shared/RiskIndicator'
import { FormRow } from './OrderSection'

/** Lots listed before **Show all**, oldest first (cellar order). */
const SHOWN_LOTS = 3

interface ConserveSectionProps {
  view: PlayerView
  config: PublicConfig
  selected: string[]
  onToggle(lotId: string, checked: boolean): void
  locked: boolean
}

export default function ConserveSection({ view, config, selected, onToggle, locked }: ConserveSectionProps): ReactElement {
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const lots = expanded ? view.cellar : view.cellar.slice(0, SHOWN_LOTS)
  const more = view.cellar.length > SHOWN_LOTS
  return (
    <FormRow
      icon={Snowflake}
      label="Conserve"
      info={
        <InfoTip label="Conserve">
          <span>
            Conserving a lot adds {config.stock.conservation_extra_fresh_days} nights to its fresh period, at{' '}
            {formatMoney(config.stock.conservation_cost_per_unit)}/unit paid today.
          </span>
          <span>A lot already losing quality goes back toward the quality it arrived at, never above it. Each lot is conserved once.</span>
        </InfoTip>
      }
    >
      {view.cellar.length === 0 ? (
        <p className="pt-2.5 text-base text-ink-muted">Nothing in the cellar to conserve.</p>
      ) : (
        <div id={listId} className="flex flex-col gap-1">
          {lots.map((lot) => (
            <Checkbox
              key={lot.id}
              checked={!lot.conserved && selected.includes(lot.id)}
              onChange={(checked) => onToggle(lot.id, checked)}
              disabled={lot.conserved || locked}
              label={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="tabular-nums">
                    {lotLabel(lot.id)} · {formatUnits(lot.qty)} · {formatQuality(lot.quality)}
                  </span>
                  <RiskIndicator risk={riskFromQuality(lot.quality)} variant="compact" />
                  {lot.conserved ? (
                    <Badge tone="neutral" icon={Snowflake}>
                      Conserved
                    </Badge>
                  ) : null}
                </span>
              }
              trailing={formatMoney(roundCents(lot.qty * config.stock.conservation_cost_per_unit))}
            />
          ))}
          {more ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded(!expanded)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start px-3 text-sm font-semibold text-accent transition-colors duration-150 hover:text-accent-hover"
            >
              <ChevronDown size={16} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
              {expanded ? 'Hide' : `Show all ${view.cellar.length} lots`}
            </button>
          ) : null}
        </div>
      )}
    </FormRow>
  )
}
