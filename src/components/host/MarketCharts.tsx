import type { ChartData, ChartDataset, ChartOptions } from 'chart.js'
import { ChartLine } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { GameConfig, HostView, MarketDay } from '../../types/game'
import { formatMoney, formatPercent, formatQty, weekdayShort } from '../../utils/format'
import { CHART_COLORS, MEASURE_STYLES, pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'
import Legend from '../shared/Legend'
import type { HostHistories } from './presentationData'

interface MarketChartsProps {
  hostView: HostView
  histories: HostHistories
  config: GameConfig | null
}

type LegendItems = Parameters<typeof Legend>[0]['items']

interface Series {
  key: string
  label: string
  values: Array<number | null>
  format(value: number): string
}

const CHART_HEIGHT = 280
const BAND_ALPHA = '1F'

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

/** Design.md §3.1: a hatched fill is the slot colour crossed by card-coloured stripes, drawn lazily on a canvas pattern. */
function hatch(color: string): () => CanvasPattern | string {
  return () => {
    const tile = document.createElement('canvas')
    tile.width = 6
    tile.height = 6
    const ctx = tile.getContext('2d')
    if (!ctx) return color
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 6, 6)
    ctx.strokeStyle = CHART_COLORS['card']
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-1, 7)
    ctx.lineTo(7, -1)
    ctx.stroke()
    return ctx.createPattern(tile, 'repeat') ?? color
  }
}

function axes(yTitle: string, stacked = false, yMax?: number): { scales: { x: object; y: object } } {
  return {
    scales: {
      x: { stacked, title: { display: true, text: 'Day' } },
      y: { stacked, max: yMax, title: { display: true, text: yTitle } },
    },
  }
}

function SeriesTable({ caption, days, series }: { caption: string; days: number[]; series: Series[] }): ReactElement {
  const rows = days.map((day, i) => ({ day, i }))
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    ...series.map(
      (s): Column<(typeof rows)[number]> => ({
        key: s.key,
        header: s.label,
        align: 'right',
        render: (r) => {
          const v = s.values[r.i]
          return v === null || v === undefined ? '—' : s.format(v)
        },
      }),
    ),
  ]
  return <DataTable caption={caption} columns={columns} rows={rows} rowKey={(r) => String(r.day)} density="compact" />
}

function Box({
  title,
  ariaLabel,
  legend,
  table,
  children,
}: {
  title: string
  ariaLabel: string
  legend: LegendItems
  table: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <ChartBox title={title} ariaLabel={ariaLabel} height={CHART_HEIGHT} legend={<Legend items={legend} />} table={table}>
      {children}
    </ChartBox>
  )
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0)

interface Shared {
  hostView: HostView
  histories: HostHistories
  market: MarketDay[]
  days: number[]
  labels: string[][]
  aliases: string[]
}

function pulqueriaLegend(hostView: HostView, aliases: string[], kind: 'line' | 'fill'): LegendItems {
  return aliases.map((alias) => {
    const style = pulqueriaStyle(alias)
    return {
      key: alias,
      label: hostView.players[alias]?.display_name ?? alias,
      swatch:
        kind === 'line'
          ? { kind: 'line', color: style.color, dash: style.dashed ? [6, 4] : undefined, pointStyle: style.pointStyle }
          : { kind: 'fill', color: style.color, hatched: style.hatched },
    }
  })
}

/** One value per market day for a pulquería, read from the public history by day. */
function publicSeries(
  { histories, days }: Shared,
  alias: string,
  pick: (row: { market_share: number; reputation: number }) => number,
): number[] {
  const byDay = new Map(histories.publicHistory.map((p) => [p.day, p]))
  return days.map((d) => {
    const row = byDay.get(d)?.players[alias]
    return row === undefined ? 0 : pick(row)
  })
}

function MarketShareChart(shared: Shared): ReactElement {
  const { hostView, days, labels, aliases } = shared
  const series = aliases.map((alias) => ({
    alias,
    values: publicSeries(shared, alias, (r) => r.market_share * 100),
  }))
  const data: ChartData<'bar'> = {
    labels,
    datasets: series.map(({ alias, values }) => {
      const style = pulqueriaStyle(alias)
      return {
        label: hostView.players[alias]?.display_name ?? alias,
        data: values,
        backgroundColor: style.hatched ? hatch(style.color) : style.color,
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
      }
    }),
  }
  const options: ChartOptions<'bar'> = axes('%', true, 100)
  return (
    <Box
      title="Market share"
      ariaLabel="Stacked bars of each pulquería's market share on each day played"
      legend={pulqueriaLegend(hostView, aliases, 'fill')}
      table={
        <SeriesTable
          caption="Market share"
          days={days}
          series={series.map(({ alias, values }) => ({
            key: alias,
            label: hostView.players[alias]?.display_name ?? alias,
            values: values.map((v) => v / 100),
            format: (v: number) => formatPercent(v),
          }))}
        />
      }
    >
      <Bar data={data} options={options} />
    </Box>
  )
}

function ReputationChart(shared: Shared): ReactElement {
  const { hostView, days, labels, aliases } = shared
  const series = aliases.map((alias) => ({ alias, values: publicSeries(shared, alias, (r) => r.reputation) }))
  const data: ChartData<'line'> = {
    labels,
    datasets: series.map(({ alias, values }) => {
      const style = pulqueriaStyle(alias)
      return {
        label: hostView.players[alias]?.display_name ?? alias,
        data: values,
        borderColor: style.color,
        backgroundColor: style.color,
        pointStyle: style.pointStyle as 'circle',
        pointBackgroundColor: style.dashed ? CHART_COLORS['card'] : style.color,
        pointBorderWidth: style.dashed ? 2 : 1,
        borderDash: style.dashed ? [6, 4] : [],
        borderWidth: 2.5,
        pointRadius: 4,
      }
    }),
  }
  const options: ChartOptions<'line'> = axes('Reputation', false, 1)
  return (
    <Box
      title="Reputation"
      ariaLabel="Lines of each pulquería's reputation on each day played"
      legend={pulqueriaLegend(hostView, aliases, 'line')}
      table={
        <SeriesTable
          caption="Reputation"
          days={days}
          series={series.map(({ alias, values }) => ({
            key: alias,
            label: hostView.players[alias]?.display_name ?? alias,
            values,
            format: (v: number) => v.toFixed(2),
          }))}
        />
      }
    >
      <Line data={data} options={options} />
    </Box>
  )
}

function DemandChart({ market, days, labels }: Shared): ReactElement {
  const demand = market.map((m) => m.demand_total)
  const sold = market.map((m) => m.units_sold_total)
  const peakDays = market.flatMap((m, i) => (m.weekday_multiplier === 1 ? [i] : []))
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Units sold',
        data: sold,
        borderColor: MEASURE_STYLES.sold.color,
        backgroundColor: MEASURE_STYLES.sold.color,
        borderDash: MEASURE_STYLES.sold.dash,
        borderWidth: MEASURE_STYLES.sold.width,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
      {
        label: 'Market demand',
        data: demand,
        borderColor: MEASURE_STYLES.demand.color,
        backgroundColor: MEASURE_STYLES.demand.color,
        borderWidth: MEASURE_STYLES.demand.width,
        pointRadius: 0,
        pointHoverRadius: 5,
      },
    ],
  }
  const options = { ...axes('Units'), plugins: { peakShading: { days: peakDays } } } as ChartOptions<'line'>
  const format = (v: number): string => formatQty(v)
  return (
    <Box
      title="Demand vs units sold"
      ariaLabel="Lines of market demand and units sold on each day played, with peak days shaded"
      legend={[
        { key: 'demand', label: 'Market demand', swatch: { kind: 'line', color: MEASURE_STYLES.demand.color } },
        { key: 'sold', label: 'Units sold', swatch: { kind: 'line', color: MEASURE_STYLES.sold.color, dash: MEASURE_STYLES.sold.dash } },
      ]}
      table={
        <SeriesTable
          caption="Demand vs units sold"
          days={days}
          series={[
            { key: 'demand', label: 'Market demand', values: demand, format },
            { key: 'sold', label: 'Units sold', values: sold, format },
          ]}
        />
      }
    >
      <Line data={data} options={options} />
    </Box>
  )
}

function SpotPriceChart({ market, days, labels, config }: Shared & { config: GameConfig | null }): ReactElement {
  const spot = market.map((m) => m.spot_price)
  const base = config === null ? null : config.supplier.base_price
  const spread = config === null ? null : config.supplier.spot_spread
  const low = base === null || spread === null ? null : market.map(() => base * (1 - spread))
  const high = base === null || spread === null ? null : market.map(() => base * (1 + spread))
  const band = CHART_COLORS['p1'] + BAND_ALPHA

  const datasets: ChartData<'line'>['datasets'] = []
  if (low !== null && high !== null) {
    datasets.push(
      { label: 'Spot range low', data: low, borderWidth: 0, pointRadius: 0, pointHitRadius: 0, fill: false },
      { label: 'Spot range', data: high, borderWidth: 0, pointRadius: 0, pointHitRadius: 0, fill: '-1', backgroundColor: band },
    )
  }
  datasets.push({
    label: 'Spot',
    data: spot,
    borderColor: CHART_COLORS['p1'],
    backgroundColor: CHART_COLORS['p1'],
    borderWidth: 2.5,
    pointRadius: 4,
  })
  if (base !== null) {
    datasets.push({
      label: 'Base',
      data: market.map(() => base),
      borderColor: CHART_COLORS['ink-muted'],
      backgroundColor: CHART_COLORS['ink-muted'],
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    })
  }
  const legend: LegendItems = [
    { key: 'spot', label: 'Spot', swatch: { kind: 'line', color: CHART_COLORS['p1'], pointStyle: 'circle' } },
  ]
  if (base !== null) legend.push({ key: 'base', label: 'Base', swatch: { kind: 'line', color: CHART_COLORS['ink-muted'], dash: [6, 4] } })
  if (low !== null) legend.push({ key: 'range', label: 'Spot range', swatch: { kind: 'fill', color: band } })

  const format = (v: number): string => formatMoney(v)
  const tableSeries: Series[] = [{ key: 'spot', label: 'Spot', values: spot, format }]
  if (base !== null) tableSeries.push({ key: 'base', label: 'Base', values: market.map(() => base), format })
  if (low !== null && high !== null) {
    tableSeries.push({ key: 'low', label: 'Range low', values: low, format }, { key: 'high', label: 'Range high', values: high, format })
  }
  return (
    <Box
      title="Spot price"
      ariaLabel="Line chart of the spot price on each day played, with the base price as a dashed line and the spot range as a band"
      legend={legend}
      table={<SeriesTable caption="Spot price" days={days} series={tableSeries} />}
    >
      <Line data={{ labels, datasets }} options={axes('$') as ChartOptions<'line'>} />
    </Box>
  )
}

function CapacityChart({ histories, market, days, labels }: Shared): ReactElement {
  const capacity = market.map((m) => m.capacity)
  const orders = days.map((d) =>
    sum(
      Object.values(histories.players).flatMap((records) =>
        records.filter((r) => r.day === d).map((r) => r.order_spot + r.futures_due),
      ),
    ),
  )
  const line = {
    type: 'line',
    label: 'Capacity',
    data: capacity,
    borderColor: CHART_COLORS['ink'],
    backgroundColor: CHART_COLORS['ink'],
    borderWidth: 2.5,
    pointRadius: 0,
    pointHoverRadius: 5,
    order: 0,
  } as unknown as ChartDataset<'bar'>
  const data: ChartData<'bar'> = {
    labels,
    datasets: [line, { label: 'Orders', data: orders, backgroundColor: CHART_COLORS['p1'], order: 1 }],
  }
  const format = (v: number): string => formatQty(v)
  return (
    <Box
      title="Capacity vs orders"
      ariaLabel="Supplier capacity as a line and the units ordered, spot plus futures due, as bars for each day played"
      legend={[
        { key: 'capacity', label: 'Capacity', swatch: { kind: 'line', color: CHART_COLORS['ink'] } },
        { key: 'orders', label: 'Orders', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } },
      ]}
      table={
        <SeriesTable
          caption="Capacity vs orders"
          days={days}
          series={[
            { key: 'capacity', label: 'Capacity', values: capacity, format },
            { key: 'orders', label: 'Orders', values: orders, format },
          ]}
        />
      }
    >
      <Bar data={data} options={axes('Units') as ChartOptions<'bar'>} />
    </Box>
  )
}

function SpoilageChart({ histories, days, labels }: Shared): ReactElement {
  const spoiled = days.map((d) =>
    sum(Object.values(histories.players).flatMap((records) => records.filter((r) => r.day === d).map((r) => r.spoiled))),
  )
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ label: 'Spoiled', data: spoiled, backgroundColor: CHART_COLORS['p1'] }],
  }
  return (
    <Box
      title="Spoilage per day"
      ariaLabel="Bars of the units that spoiled across all pulquerías on each day played"
      legend={[{ key: 'spoiled', label: 'Spoiled', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } }]}
      table={
        <SeriesTable
          caption="Spoilage per day"
          days={days}
          series={[{ key: 'spoiled', label: 'Spoiled', values: spoiled, format: (v: number) => formatQty(v) }]}
        />
      }
    >
      <Bar data={data} options={axes('Units') as ChartOptions<'bar'>} />
    </Box>
  )
}

function PeerUnitsChart({ market, days, labels }: Shared): ReactElement {
  const units = market.map((m) => m.peer_units)
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ label: 'Units', data: units, backgroundColor: CHART_COLORS['p1'] }],
  }
  return (
    <Box
      title="Peer units traded"
      ariaLabel="Bars of the units traded between pulquerías on each day played"
      legend={[{ key: 'units', label: 'Units', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } }]}
      table={
        <SeriesTable
          caption="Peer units traded"
          days={days}
          series={[
            { key: 'units', label: 'Units', values: units, format: (v: number) => formatQty(v) },
            {
              key: 'avg',
              label: 'Avg price',
              values: market.map((m) => m.peer_avg_price),
              format: (v: number) => formatMoney(v),
            },
          ]}
        />
      }
    >
      <Bar data={data} options={axes('Units') as ChartOptions<'bar'>} />
    </Box>
  )
}

/** Spec §11.4 charts, built only from `host_view` and the store's histories (spec §12.6). */
export default function MarketCharts({ hostView, histories, config }: MarketChartsProps): ReactElement {
  const market = histories.marketHistory
  if (market.length === 0) {
    return <EmptyState icon={ChartLine} title="No days closed yet" body="Charts fill in as days close." />
  }
  const shared: Shared = {
    hostView,
    histories,
    market,
    days: market.map((m) => m.day),
    labels: market.map((m) => [String(m.day), weekdayShort(m.weekday)]),
    aliases: Object.keys(hostView.players).sort((a, b) => aliasNumber(a) - aliasNumber(b)),
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <MarketShareChart {...shared} />
      <ReputationChart {...shared} />
      <DemandChart {...shared} />
      <SpotPriceChart {...shared} config={config} />
      <CapacityChart {...shared} />
      <SpoilageChart {...shared} />
      {hostView.config.peer_market.enabled ? <PeerUnitsChart {...shared} /> : null}
    </div>
  )
}
