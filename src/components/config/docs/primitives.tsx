import type { ChartData, ChartOptions } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import type { ReactElement, ReactNode } from 'react'
import { CHART_COLORS, MEASURE_STYLES, registerCharts } from '../../charts/chartSetup'
import ChartBox from '../../shared/ChartBox'
import DataTable from '../../shared/DataTable'
import { InlineAlert } from '../../shared/AlertContainer'

/** A paragraph. */
export function P({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-base text-ink">{children}</p>
}

/** A monospace formula block. */
export function Formula({ children }: { children: ReactNode }): ReactElement {
  return <pre className="overflow-x-auto rounded-md border border-border bg-inset px-3 py-2 font-mono text-sm whitespace-pre-wrap">{children}</pre>
}

export function List({ items }: { items: ReactNode[] }): ReactElement {
  return (
    <ul className="list-disc space-y-1 pl-5 text-base text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** A titled box holding the live example. */
export function Example({ title, children }: { title?: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-inset px-4 py-3">
      {title ? <p className="text-sm font-semibold text-ink-muted">{title}</p> : null}
      {children}
    </div>
  )
}

interface TableProps {
  head: string[]
  rows: ReactNode[][]
  caption?: string
}

interface TableRow {
  index: number
  cells: ReactNode[]
}

export function Table({ head, rows, caption = 'Example values' }: TableProps): ReactElement {
  const indexed = rows.map((cells, index) => ({ index, cells }))
  return (
    <DataTable
      caption={caption}
      density="compact"
      columns={head.map((header, c) => ({
        key: `c${c}`,
        header,
        align: c === 0 ? 'left' : 'right',
        render: (row: TableRow) => row.cells[c],
      }))}
      rows={indexed}
      rowKey={(row) => String(row.index)}
    />
  )
}

export function Note({ children }: { children: ReactNode }): ReactElement {
  return <InlineAlert tone="info">{children}</InlineAlert>
}

export interface ChartSeries {
  label: string
  data: number[]
  /** Fixed measure style (design.md §3.3); the first series defaults to demand. */
  measure?: keyof typeof MEASURE_STYLES
}

interface ChartProps {
  title: string
  labels: string[]
  series: ChartSeries[]
  xLabel: string
  yLabel: string
  /** Formats a value for the table fallback. */
  format?: (value: number) => string
}

const PLOT_HEIGHT = 200
const FALLBACK_MEASURES: Array<keyof typeof MEASURE_STYLES> = ['demand', 'delivered', 'sold', 'spoiled']

function seriesTable(p: ChartProps): ReactElement {
  const fmt = p.format ?? ((v: number) => String(v))
  return (
    <Table
      caption={p.title}
      head={[p.xLabel, ...p.series.map((s) => s.label)]}
      rows={p.labels.map((label, i) => [label, ...p.series.map((s) => fmt(s.data[i]))])}
    />
  )
}

function axes(p: ChartProps): ChartOptions<'bar' | 'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: p.xLabel } },
      y: { beginAtZero: true, title: { display: true, text: p.yLabel } },
    },
  }
}

export function LineChart(p: ChartProps): ReactElement {
  registerCharts()
  const data: ChartData<'line'> = {
    labels: p.labels,
    datasets: p.series.map((s, i) => {
      const style = MEASURE_STYLES[s.measure ?? FALLBACK_MEASURES[i % FALLBACK_MEASURES.length]]
      return {
        label: s.label,
        data: s.data,
        borderColor: style.color,
        backgroundColor: style.color,
        borderDash: style.dash,
        borderWidth: style.width,
        pointRadius: 0,
      }
    }),
  }
  return (
    <ChartBox title={p.title} ariaLabel={p.title} height={PLOT_HEIGHT} table={seriesTable(p)}>
      <Line data={data} options={axes(p) as ChartOptions<'line'>} />
    </ChartBox>
  )
}

export function BarChart(p: ChartProps): ReactElement {
  registerCharts()
  const data: ChartData<'bar'> = {
    labels: p.labels,
    datasets: p.series.map((s, i) => {
      const style = MEASURE_STYLES[s.measure ?? FALLBACK_MEASURES[i % FALLBACK_MEASURES.length]]
      return {
        label: s.label,
        data: s.data,
        backgroundColor: style.color,
        borderColor: CHART_COLORS['card'],
      }
    }),
  }
  return (
    <ChartBox title={p.title} ariaLabel={p.title} height={PLOT_HEIGHT} table={seriesTable(p)}>
      <Bar data={data} options={axes(p) as ChartOptions<'bar'>} />
    </ChartBox>
  )
}
