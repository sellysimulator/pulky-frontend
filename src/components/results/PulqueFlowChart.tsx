import { useState, type ReactElement } from 'react'
import { Chart } from 'react-chartjs-2'
import { formatQty } from '../../utils/format'
import { PulqueriaChip } from '../shared/Badge'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import { FLOW_NODE_NAMES, buildPulqueFlowConfig, type FlowNode } from './resultsChartsConfig'
import type { ResultsView } from './resultsView'

interface BandRow {
  key: string
  from: string
  to: string
  flow: number
}

const aliasNumber = (alias: string): number => Number(/^P(\d+)$/.exec(alias)?.[1] ?? 0)

/** Block 3 of spec §13.8, Flow view: one pulquería's pulque as a Sankey, chosen with chips. */
export default function PulqueFlowChart({ view, myAlias }: { view: ResultsView; myAlias: string | null }): ReactElement {
  const ordered = [...view.players].sort((a, b) => {
    if (a.alias === myAlias) return -1
    if (b.alias === myAlias) return 1
    return aliasNumber(a.alias) - aliasNumber(b.alias)
  })
  const [chosen, setChosen] = useState<string | null>(null)
  const current = ordered.find((p) => p.alias === chosen) ?? ordered[0]
  const config = buildPulqueFlowConfig(view, current.alias)
  const bands = (config.data.datasets[0]?.data ?? []) as { from: string; to: string; flow: number }[]
  const rows: BandRow[] = bands.map((b) => ({
    key: `${b.from}-${b.to}`,
    from: FLOW_NODE_NAMES[b.from as FlowNode],
    to: FLOW_NODE_NAMES[b.to as FlowNode],
    flow: b.flow,
  }))
  const columns: Column<BandRow>[] = [
    { key: 'from', header: 'From', render: (r) => r.from },
    { key: 'to', header: 'To', render: (r) => r.to },
    { key: 'flow', header: 'Units', align: 'right', render: (r) => formatQty(r.flow) },
  ]
  const name = current.display_name

  const chips = (
    <div role="group" aria-label="Pulquería" className="flex flex-wrap gap-2">
      {ordered.map((p) => (
        <button
          key={p.alias}
          type="button"
          aria-pressed={p.alias === current.alias}
          onClick={() => setChosen(p.alias)}
          className={[
            'cursor-pointer rounded-sm border px-3 py-1.5 text-sm',
            p.alias === current.alias ? 'border-accent bg-accent-subtle' : 'border-border-control bg-card',
          ].join(' ')}
        >
          <PulqueriaChip alias={p.alias} displayName={p.display_name} you={p.alias === myAlias} />
        </button>
      ))}
    </div>
  )

  return (
    <ChartBox
      title={`${name}: from shipments to sold, spoiled and left at the end`}
      ariaLabel={`Flow chart of ${name}'s pulque from the supplier through the cellar to where it ended`}
      height={360}
      controls={chips}
      table={<DataTable caption={`${name}: from shipments to sold, spoiled and left at the end`} columns={columns} rows={rows} rowKey={(r) => r.key} density="compact" />}
    >
      <Chart type="sankey" data={config.data} options={config.options} />
    </ChartBox>
  )
}
