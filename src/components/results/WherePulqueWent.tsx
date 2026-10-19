import type { Plugin } from 'chart.js'
import { useMemo, useState, type ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import { formatQty } from '../../utils/format'
import { MEASURE_STYLES } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import SectionCard from '../shared/SectionCard'
import { buildWherePulqueWentConfig } from './demandSupplyConfig'
import type { PulqueriaResultView, ResultsView } from './resultsView'

// One row per pulquería, tall enough for its beside notes: 2 lines, or 3 with the peer market's "Bought from" line.
const ROW_PX = { 2: 48, 3: 64 } as const
// Room for the x-axis (ticks and the "Units" title) under the bars.
const AXIS_PX = 48

interface PlotInset {
  top: number
  bottom: number
}

/** Block 3 of spec §13.8: the newsvendor bet, one stacked bar per pulquería. */
export default function WherePulqueWent({ view }: { view: ResultsView }): ReactElement {
  const config = buildWherePulqueWentConfig(view)
  const datasets = config.data.datasets
  const hasPeer = datasets.some((d) => d.label === 'Sold to pulquerías')
  const hasBought = view.players.every((p) => typeof p.peer_units_bought === 'number')
  const rowPx = ROW_PX[hasBought ? 3 : 2]

  // The notes column takes the chart's own plot area, so each note row is exactly as tall as its bar's row.
  const [inset, setInset] = useState<PlotInset>({ top: 0, bottom: AXIS_PX })
  const plugins = useMemo<Plugin<'bar'>[]>(
    () => [
      {
        id: 'whereNotesInset',
        afterLayout(chart) {
          const next = { top: chart.chartArea.top, bottom: chart.height - chart.chartArea.bottom }
          setInset((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next))
        },
      },
    ],
    [],
  )

  const valueOf = (label: string, p: PulqueriaResultView): number => {
    const index = view.players.indexOf(p)
    const data = datasets.find((d) => d.label === label)?.data ?? []
    return data[index] as number
  }

  const columns: Column<PulqueriaResultView>[] = [
    { key: 'name', header: 'Pulquería', render: (p) => p.display_name },
    ...datasets.map(
      (d): Column<PulqueriaResultView> => ({
        key: d.label ?? '',
        header: d.label ?? '',
        align: 'right',
        render: (p) => formatQty(valueOf(d.label ?? '', p)),
      }),
    ),
    ...(hasBought
      ? [
          {
            key: 'bought',
            header: 'Bought from pulquerías',
            align: 'right' as const,
            render: (p: PulqueriaResultView) => formatQty(p.peer_units_bought as number),
          },
        ]
      : []),
    { key: 'peak', header: 'Peak backlog', align: 'right', render: (p) => formatQty(p.peak_backlog) },
    { key: 'days', header: 'Days with backlog', align: 'right', render: (p) => formatQty(p.days_with_backlog) },
  ]

  const legendItems = [
    { key: 'sold', label: 'Sold', swatch: { kind: 'fill' as const, color: MEASURE_STYLES.sold.color } },
    ...(hasPeer
      ? [{ key: 'peer', label: 'Sold to pulquerías', swatch: { kind: 'fill' as const, color: MEASURE_STYLES.sold.color, hatched: true } }]
      : []),
    { key: 'spoiled', label: 'Spoiled', swatch: { kind: 'fill' as const, color: MEASURE_STYLES.spoiled.color } },
    { key: 'lost', label: 'Lost in transit', swatch: { kind: 'fill' as const, color: MEASURE_STYLES.lost.color } },
    { key: 'liquidated', label: 'Liquidated at the end', swatch: { kind: 'fill' as const, color: MEASURE_STYLES.liquidated.color } },
  ]

  return (
    <SectionCard title="3. Where the pulque went">
      <ChartBox
        title="Where the pulque went"
        ariaLabel="Stacked horizontal bars of units sold, sold to pulquerías, spoiled, lost in transit and liquidated at the end, for each pulquería"
        height={rowPx * view.players.length + AXIS_PX}
        legend={<Legend items={legendItems} />}
        table={
          <DataTable caption="Where the pulque went" columns={columns} rows={view.players} rowKey={(p) => p.alias} density="compact" />
        }
      >
        <div className="flex h-full gap-4">
          <div className="min-w-0 flex-1">
            <Bar data={config.data} options={config.options} plugins={plugins} />
          </div>
          <ul className="flex shrink-0 flex-col text-sm text-ink-muted" style={{ paddingTop: inset.top, paddingBottom: inset.bottom }}>
            {view.players.map((p) => (
              <li key={p.alias} className="flex min-h-0 flex-1 flex-col justify-center leading-tight tabular-nums">
                {hasBought ? <span>Bought from pulquerías {formatQty(p.peer_units_bought as number)}</span> : null}
                <span>Peak backlog {formatQty(p.peak_backlog)}</span>
                <span>Days with backlog {formatQty(p.days_with_backlog)}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartBox>
    </SectionCard>
  )
}
