import { Snowflake } from 'lucide-react'
import type { ReactElement } from 'react'
import type { PlayerView, PublicConfig } from '../../types/game'
import { formatMoney, formatQty, formatQuality, riskFromQuality } from '../../utils/format'
import { roundCents } from '../../utils/money'
import Badge from '../shared/Badge'
import Checkbox from '../shared/Checkbox'
import RiskIndicator from '../shared/RiskIndicator'
import { FormRow } from './OrderSection'

interface ConserveSectionProps {
  view: PlayerView
  config: PublicConfig
  selected: string[]
  onToggle(lotId: string, checked: boolean): void
  locked: boolean
}

export default function ConserveSection({ view, config, selected, onToggle, locked }: ConserveSectionProps): ReactElement {
  return (
    <FormRow icon={Snowflake} label="Conserve">
      {view.cellar.length === 0 ? (
        <p className="pt-2.5 text-base text-ink-muted">Nothing in the cellar to conserve.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {view.cellar.map((lot) => (
            <Checkbox
              key={lot.id}
              checked={!lot.conserved && selected.includes(lot.id)}
              onChange={(checked) => onToggle(lot.id, checked)}
              disabled={lot.conserved || locked}
              label={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="tabular-nums">
                    {lot.id} · {formatQty(lot.qty)} u · {formatQuality(lot.quality)}
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
        </div>
      )}
      <p className="pt-1 text-sm text-ink-muted">
        Conserving adds {config.stock.conservation_extra_fresh_days} nights to a lot&apos;s fresh period.
      </p>
    </FormRow>
  )
}
