import { EyeOff } from 'lucide-react'
import type { ReactElement } from 'react'
import { DOCS } from '../config/docs/entries'
import type { GameConfig } from '../../types/game'
import { formatPercent, formatUnits } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'

interface Risk {
  path: string
  value: string
}

/** The four hidden defaults (spec §9.3), as percentages or units, labelled as in the help entries. */
function risksOf(config: GameConfig): Risk[] {
  const { supplier, transport } = config
  // Whole percents read "14%"; a host's own 13.7% keeps its decimal.
  const percent = (v: number | null): string =>
    formatPercent(v, v !== null && Math.abs(v * 100 - Math.round(v * 100)) > 1e-9 ? 1 : 0)
  return [
    { path: 'transport.failure_probability', value: percent(transport.failure_probability) },
    { path: 'transport.loss_fraction', value: percent(transport.loss_fraction) },
    { path: 'supplier.disruption_probability', value: percent(supplier.disruption_probability) },
    {
      path: 'supplier.capacity_sd_per_player',
      value: supplier.capacity_sd_per_player === null ? '—' : formatUnits(supplier.capacity_sd_per_player),
    },
  ]
}

const COLUMNS: Column<Risk>[] = [
  { key: 'risk', header: 'Risk', render: (r) => DOCS[r.path].label },
  { key: 'value', header: 'This game', align: 'right', render: (r) => r.value },
]

/**
 * Block 5 of spec §13.8, for everyone: the risk odds the game ran with. Their defaults stay hidden from hosts and
 * players until the game ends (spec §9.3); the results carry the full config, so the summary can name them now.
 */
export default function RisksRevealed({ config }: { config: GameConfig | undefined }): ReactElement | null {
  if (config === undefined) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <EyeOff size={18} aria-hidden="true" className="text-ink-muted" />
        The risks, revealed
      </h3>
      <DataTable caption="The risks, revealed" columns={COLUMNS} rows={risksOf(config)} rowKey={(r) => r.path} density="compact" />
    </div>
  )
}
