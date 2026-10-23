import type { ChartData, ChartOptions } from 'chart.js'
import { useState, type ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { CellarLot, PlayerView, StockByAge } from '../../types/game'
import { formatPercent, formatQty } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import SegmentedControl from '../shared/SegmentedControl'

type CellarChartView = 'age' | 'quality' | 'risk' | 'days'

const VIEWS: ReadonlyArray<{ value: CellarChartView; label: string }> = [
  { value: 'age', label: 'Age' },
  { value: 'quality', label: 'Quality' },
  { value: 'risk', label: 'Risk tonight' },
  { value: 'days', label: 'Days left' },
]

/** One bar of the chart: plain and conserved units, under an x tick of one or more lines. */
interface UnitBar {
  key: string
  tick: string[]
  plain: number
  conserved: number
}

interface Shape {
  title: string
  ariaLabel: string
  axis: string
  bars: UnitBar[]
  table: ReactElement
}

const LEGEND = (
  <Legend
    items={[
      { key: 'plain', label: 'Plain', swatch: { kind: 'fill', color: CHART_COLORS['p4'] } },
      { key: 'conserved', label: 'Conserved', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } },
    ]}
  />
)

/** The x tick: the age, then one line per stack present at that age with its average risk tonight (design.md §3.3). */
function ageTick(row: StockByAge): string[] {
  const lines = [String(row.age)]
  if (row.plain_qty > 0) lines.push(`plain ${formatPercent(row.plain_risk_tonight)}`)
  if (row.conserved_qty > 0) lines.push(`conserved ${formatPercent(row.conserved_risk_tonight)}`)
  return lines
}

const AGE_COLUMNS: Column<StockByAge>[] = [
  { key: 'age', header: 'Age', render: (r) => r.age },
  { key: 'plain', header: 'Plain', align: 'right', render: (r) => formatQty(r.plain_qty) },
  { key: 'conserved', header: 'Conserved', align: 'right', render: (r) => formatQty(r.conserved_qty) },
  { key: 'plain-risk', header: 'Avg risk tonight (plain)', align: 'right', render: (r) => formatPercent(r.plain_risk_tonight ?? null) },
  {
    key: 'conserved-risk',
    header: 'Avg risk tonight (conserved)',
    align: 'right',
    render: (r) => formatPercent(r.conserved_risk_tonight ?? null),
  },
]

/** A table of the plotted bars: the bar's name, then its plain and conserved units. */
function BarTable({ caption, header, bars, name }: { caption: string; header: string; bars: UnitBar[]; name(bar: UnitBar): string }): ReactElement {
  const columns: Column<UnitBar>[] = [
    { key: 'name', header, render: name },
    { key: 'plain', header: 'Plain', align: 'right', render: (b) => formatQty(b.plain) },
    { key: 'conserved', header: 'Conserved', align: 'right', render: (b) => formatQty(b.conserved) },
  ]
  return <DataTable caption={caption} columns={columns} rows={bars} rowKey={(b) => b.key} density="compact" />
}

/** Ten bands of ten points, 0–9% to 90–100%; `percent` places a lot in one (spec §3.5: risk tonight is 100 − quality). */
function percentBars(lots: CellarLot[], percent: (lot: CellarLot) => number): UnitBar[] {
  const bars = Array.from({ length: 10 }, (_, i): UnitBar => {
    const label = `${i * 10}–${i === 9 ? 100 : i * 10 + 9}%`
    return { key: label, tick: [label], plain: 0, conserved: 0 }
  })
  for (const lot of lots) {
    const bar = bars[Math.min(9, Math.floor(percent(lot) / 10))]
    if (lot.conserved) bar.conserved += lot.qty
    else bar.plain += lot.qty
  }
  return bars
}

/** One bar per day left to sell, 1 (today is the last day) up to the longest-lasting lot, from each lot's last day. */
function dayBars(lots: CellarLot[], today: number): UnitBar[] {
  const left = (lot: CellarLot): number => lot.last_day - today + 1
  const most = lots.reduce((max, lot) => Math.max(max, left(lot)), 0)
  const bars = Array.from({ length: most }, (_, i): UnitBar => {
    const n = i + 1
    return { key: String(n), tick: [String(n), `day ${today + i}`], plain: 0, conserved: 0 }
  })
  for (const lot of lots) {
    const bar = bars[left(lot) - 1]
    if (lot.conserved) bar.conserved += lot.qty
    else bar.plain += lot.qty
  }
  return bars
}

function shapeOf(choice: CellarChartView, view: PlayerView): Shape {
  if (choice === 'age') {
    const rows = view.stock_by_age
    return {
      title: 'Units by age',
      ariaLabel:
        "Stacked bars of plain and conserved units in the cellar by age in days, with tonight's average spoil risk under each age",
      axis: 'Age (days)',
      bars: rows.map((r) => ({ key: String(r.age), tick: ageTick(r), plain: r.plain_qty, conserved: r.conserved_qty })),
      table: <DataTable caption="Units by age" columns={AGE_COLUMNS} rows={rows} rowKey={(r) => String(r.age)} density="compact" />,
    }
  }
  if (choice === 'quality') {
    const bars = percentBars(view.cellar, (lot) => lot.quality)
    return {
      title: 'Units by quality',
      ariaLabel: 'Stacked bars of plain and conserved units in the cellar by quality, in bands of ten points',
      axis: 'Quality',
      bars,
      table: <BarTable caption="Units by quality" header="Quality" bars={bars} name={(b) => b.tick[0]} />,
    }
  }
  if (choice === 'risk') {
    const bars = percentBars(view.cellar, (lot) => 100 - lot.quality)
    return {
      title: 'Units by risk tonight',
      ariaLabel: "Stacked bars of plain and conserved units in the cellar by tonight's spoil risk, in bands of ten points",
      axis: 'Spoil risk tonight',
      bars,
      table: <BarTable caption="Units by risk tonight" header="Risk tonight" bars={bars} name={(b) => b.tick[0]} />,
    }
  }
  const bars = dayBars(view.cellar, view.day)
  return {
    title: 'Units by days left',
    ariaLabel: 'Stacked bars of plain and conserved units in the cellar by the days left to sell them, with the last day under each',
    axis: 'Days left to sell',
    bars,
    table: <BarTable caption="Units by days left" header="Days left" bars={bars} name={(b) => `${b.tick[0]} (through ${b.tick[1]})`} />,
  }
}

/** The cellar's units on hand, by age, quality, risk tonight or days left: one chart, one view at a time. */
export default function CellarChart({ view }: { view: PlayerView }): ReactElement {
  const [choice, setChoice] = useState<CellarChartView>('age')
  const shape = shapeOf(choice, view)
  const data: ChartData<'bar'> = {
    labels: shape.bars.map((b) => b.tick),
    datasets: [
      {
        label: 'Plain',
        data: shape.bars.map((b) => b.plain),
        backgroundColor: CHART_COLORS['p4'],
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
      },
      {
        label: 'Conserved',
        data: shape.bars.map((b) => b.conserved),
        backgroundColor: CHART_COLORS['p1'],
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
      },
    ],
  }
  const options: ChartOptions<'bar'> = {
    scales: {
      x: { stacked: true, title: { display: true, text: shape.axis } },
      y: { stacked: true, title: { display: true, text: 'Units' } },
    },
  }
  return (
    <ChartBox
      title={shape.title}
      ariaLabel={shape.ariaLabel}
      height={240}
      controls={<SegmentedControl label="Group units by" options={VIEWS} value={choice} onChange={setChoice} />}
      legend={LEGEND}
      table={shape.table}
    >
      <Bar data={data} options={options} />
    </ChartBox>
  )
}
