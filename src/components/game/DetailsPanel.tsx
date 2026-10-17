import type { ChartData, ChartOptions } from 'chart.js'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { DayRecord, PlayerView, PublicDayResults } from '../../types/game'
import { formatMoney, formatQty } from '../../utils/format'
import { getUiFlag, setUiFlag } from '../../utils/storage'
import { CHART_COLORS, MEASURE_STYLES, pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import Collapsible from '../shared/Collapsible'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { LedgerTable } from './DayRecap'

interface DetailsPanelProps {
  view: PlayerView
  ownHistory: DayRecord[]
  publicHistory: PublicDayResults[]
  lastRecord: DayRecord | null
}

type LegendItems = Parameters<typeof Legend>[0]['items']

const CHART_HEIGHT = 240

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

function axes(yTitle: string, stacked = false): { scales: { x: object; y: object } } {
  return {
    scales: {
      x: { stacked, title: { display: true, text: 'Day' } },
      y: { stacked, title: { display: true, text: yTitle } },
    },
  }
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0)

function runningTotal(values: number[]): number[] {
  let total = 0
  return values.map((v) => (total += v))
}

interface Series {
  key: string
  label: string
  values: Array<number | null>
  format(value: number): string
}

/** The table view of a chart: a Day column and one column per series, exactly the plotted numbers. */
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

const days = (records: Array<{ day: number }>): number[] => records.map((r) => r.day)
const dayLabels = (records: Array<{ day: number }>): string[] => records.map((r) => String(r.day))

function InventoryChart({ own }: { own: DayRecord[] }): ReactElement {
  const stock = own.map((r) => r.closing_stock)
  const backlog = own.map((r) => -r.backlog_end)
  const data: ChartData<'bar'> = {
    labels: dayLabels(own),
    datasets: [
      { label: 'Closing stock', data: stock, backgroundColor: CHART_COLORS['series-delivered'] },
      { label: 'Backlog', data: backlog, backgroundColor: CHART_COLORS['series-backlog'] },
    ],
  }
  const options: ChartOptions<'bar'> = axes('Units', true)
  const format = (v: number): string => formatQty(v)
  return (
    <Box
      title="Inventory vs backlog"
      ariaLabel="Bars of closing stock above zero and backlog below zero for each day played"
      legend={[
        { key: 'stock', label: 'Closing stock', swatch: { kind: 'fill', color: CHART_COLORS['series-delivered'] } },
        { key: 'backlog', label: 'Backlog', swatch: { kind: 'fill', color: CHART_COLORS['series-backlog'] } },
      ]}
      table={
        <SeriesTable
          caption="Inventory vs backlog"
          days={days(own)}
          series={[
            { key: 'stock', label: 'Closing stock', values: stock, format },
            { key: 'backlog', label: 'Backlog', values: own.map((r) => r.backlog_end), format },
          ]}
        />
      }
    >
      <Bar data={data} options={options} />
    </Box>
  )
}

function CollaborationChart({ own, pub }: { own: DayRecord[]; pub: PublicDayResults[] }): ReactElement {
  const cooperators = pub.map((p) => p.cooperators)
  const players = pub.reduce((max, p) => Math.max(max, Object.keys(p.players).length), 0)
  const myVote = pub.map((p) => own.find((r) => r.day === p.day)?.cooperate ?? null)
  const data = {
    labels: dayLabels(pub),
    datasets: [
      {
        type: 'bar',
        label: 'Pulquerías that voted for equal supply',
        data: cooperators,
        backgroundColor: pub.map((p) => (p.cooperation ? CHART_COLORS['series-sold'] : CHART_COLORS['border-strong'])),
      },
      {
        type: 'line',
        label: 'Your vote',
        data: pub.map((p, i) => (myVote[i] === true ? p.cooperators : null)),
        showLine: false,
        borderColor: CHART_COLORS['ink'],
        backgroundColor: CHART_COLORS['ink'],
        pointStyle: 'rectRot',
        pointRadius: 6,
      },
    ],
  } as unknown as ChartData<'bar'>
  const options: ChartOptions<'bar'> = {
    scales: {
      x: { title: { display: true, text: 'Day' } },
      y: { title: { display: true, text: `Pulquerías (of ${players})` }, suggestedMax: players },
    },
  }
  const yesNo = (v: number): string => (v > 0 ? 'Yes' : 'No')
  return (
    <Box
      title="Equal supply votes"
      ariaLabel="Bars of how many pulquerías voted for equal supply each day, with your own vote marked"
      legend={[
        { key: 'agreed', label: 'Everyone agreed', swatch: { kind: 'fill', color: CHART_COLORS['series-sold'] } },
        { key: 'not', label: 'Not everyone agreed', swatch: { kind: 'fill', color: CHART_COLORS['border-strong'] } },
        { key: 'vote', label: 'Your vote', swatch: { kind: 'line', color: CHART_COLORS['ink'], pointStyle: 'rectRot' } },
      ]}
      table={
        <SeriesTable
          caption="Equal supply votes"
          days={days(pub)}
          series={[
            { key: 'cooperators', label: 'Voted for equal supply', values: cooperators, format: (v) => `${v} of ${players}` },
            { key: 'agreed', label: 'Everyone agreed', values: pub.map((p) => (p.cooperation ? 1 : 0)), format: yesNo },
            { key: 'vote', label: 'Your vote', values: myVote.map((v) => (v === null ? null : v ? 1 : 0)), format: yesNo },
          ]}
        />
      }
    >
      <Bar data={data} options={options} />
    </Box>
  )
}

interface CostSeries {
  key: string
  label: string
  color: string
  hatched?: boolean
  values: number[]
}

function CostsChart({ own }: { own: DayRecord[] }): ReactElement {
  const stack: CostSeries[] = [
    { key: 'spot', label: 'Spot', color: CHART_COLORS['p1'], values: own.map((r) => r.cost_spot) },
    { key: 'peer', label: 'Peer purchases', color: CHART_COLORS['p1'], hatched: true, values: own.map((r) => r.cost_peer) },
    { key: 'futures', label: 'Futures', color: CHART_COLORS['p4'], values: own.map((r) => r.cost_futures) },
    { key: 'transport', label: 'Transport', color: CHART_COLORS['p5'], values: own.map((r) => r.cost_transport) },
    { key: 'insurance', label: 'Insurance fees', color: CHART_COLORS['p3'], values: own.map((r) => r.cost_insurance) },
    { key: 'conservation', label: 'Conservation', color: CHART_COLORS['p6'], values: own.map((r) => r.cost_conservation) },
    {
      key: 'holding',
      label: 'Holding cost',
      color: CHART_COLORS['border-strong'],
      hatched: true,
      values: own.map((r) => r.cost_holding),
    },
    { key: 'backlog', label: 'Backlog penalty', color: CHART_COLORS['series-backlog'], values: own.map((r) => r.cost_backlog) },
  ]
  const salesValues = own.map((r) => r.revenue_sales)
  const peerSalesValues = own.map((r) => r.revenue_peer)
  const data = {
    labels: dayLabels(own),
    datasets: [
      ...stack.map((s) => ({
        type: 'bar',
        label: s.label,
        data: s.values,
        backgroundColor: s.hatched ? hatch(s.color) : s.color,
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
        stack: 'costs',
      })),
      {
        type: 'line',
        label: 'Sales revenue',
        data: salesValues,
        borderColor: CHART_COLORS['ink'],
        backgroundColor: CHART_COLORS['ink'],
        borderWidth: 2.5,
      },
      {
        type: 'line',
        label: 'Peer sales revenue',
        data: peerSalesValues,
        borderColor: CHART_COLORS['ink-muted'],
        backgroundColor: CHART_COLORS['ink-muted'],
        borderWidth: 2,
        borderDash: [6, 4],
      },
    ],
  } as unknown as ChartData<'bar'>
  const options: ChartOptions<'bar'> = axes('$', true)
  const series: Series[] = [
    ...stack.map((s) => ({ key: s.key, label: s.label, values: s.values, format: formatMoney })),
    { key: 'sales', label: 'Sales revenue', values: salesValues, format: formatMoney },
    { key: 'peer-sales', label: 'Peer sales revenue', values: peerSalesValues, format: formatMoney },
  ]
  return (
    <Box
      title="Costs per day"
      ariaLabel="Stacked bars of each day's costs, with sales revenue and peer sales revenue as lines"
      legend={[
        ...stack.map((s) => ({
          key: s.key,
          label: s.label,
          swatch: { kind: 'fill' as const, color: s.color, hatched: s.hatched },
        })),
        { key: 'sales', label: 'Sales revenue', swatch: { kind: 'line', color: CHART_COLORS['ink'] } },
        { key: 'peer-sales', label: 'Peer sales revenue', swatch: { kind: 'line', color: CHART_COLORS['ink-muted'], dash: [6, 4] } },
      ]}
      table={<SeriesTable caption="Costs per day" days={days(own)} series={series} />}
    >
      <Bar data={data} options={options} />
    </Box>
  )
}

function SoldSpoiledChart({ own }: { own: DayRecord[] }): ReactElement {
  const sold = own.map((r) => r.sold)
  const spoiled = own.map((r) => r.spoiled)
  const data: ChartData<'line'> = {
    labels: dayLabels(own),
    datasets: [
      {
        label: 'Sold',
        data: sold,
        borderColor: MEASURE_STYLES.sold.color,
        backgroundColor: MEASURE_STYLES.sold.color,
        borderDash: MEASURE_STYLES.sold.dash,
        borderWidth: MEASURE_STYLES.sold.width,
        pointStyle: MEASURE_STYLES.sold.pointStyle,
        pointRadius: 0,
      },
      {
        label: 'Spoiled',
        data: spoiled,
        borderColor: MEASURE_STYLES.spoiled.color,
        backgroundColor: MEASURE_STYLES.spoiled.color,
        borderDash: MEASURE_STYLES.spoiled.dash,
        borderWidth: MEASURE_STYLES.spoiled.width,
        pointStyle: MEASURE_STYLES.spoiled.pointStyle,
        pointRadius: 0,
      },
    ],
  }
  return (
    <Box
      title="Sold vs spoiled"
      ariaLabel="Lines of units sold and units spoiled for each day played"
      legend={[
        { key: 'sold', label: 'Sold', swatch: { kind: 'line', color: MEASURE_STYLES.sold.color, dash: MEASURE_STYLES.sold.dash, pointStyle: 'triangle' } },
        { key: 'spoiled', label: 'Spoiled', swatch: { kind: 'line', color: MEASURE_STYLES.spoiled.color, dash: MEASURE_STYLES.spoiled.dash, pointStyle: 'rectRot' } },
      ]}
      table={
        <SeriesTable
          caption="Sold vs spoiled"
          days={days(own)}
          series={[
            { key: 'sold', label: 'Sold', values: sold, format: formatQty },
            { key: 'spoiled', label: 'Spoiled', values: spoiled, format: formatQty },
          ]}
        />
      }
    >
      <Line data={data} options={axes('Units')} />
    </Box>
  )
}

function ReputationChart({ own, pub, alias }: { own: DayRecord[]; pub: PublicDayResults[]; alias: string }): ReactElement {
  const mine = pub.map((p) => own.find((r) => r.day === p.day)?.reputation_end ?? null)
  const market = pub.map((p) => {
    const values = Object.values(p.players).map((x) => x.reputation)
    return values.length > 0 ? sum(values) / values.length : null
  })
  const style = pulqueriaStyle(alias)
  const data: ChartData<'line'> = {
    labels: dayLabels(pub),
    datasets: [
      {
        label: 'You',
        data: mine,
        borderColor: style.color,
        backgroundColor: style.color,
        borderWidth: 3,
        pointStyle: style.pointStyle,
        pointRadius: 4,
      },
      {
        label: 'Market average',
        data: market,
        borderColor: CHART_COLORS['ink-muted'],
        backgroundColor: CHART_COLORS['ink-muted'],
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
      },
    ],
  }
  const format = (v: number): string => v.toFixed(2)
  return (
    <Box
      title="Reputation"
      ariaLabel="Lines of your reputation and the market average reputation for each day played"
      legend={[
        { key: 'you', label: 'You', swatch: { kind: 'line', color: style.color, pointStyle: style.pointStyle } },
        { key: 'market', label: 'Market average', swatch: { kind: 'line', color: CHART_COLORS['ink-muted'], dash: [6, 4] } },
      ]}
      table={
        <SeriesTable
          caption="Reputation"
          days={days(pub)}
          series={[
            { key: 'you', label: 'You', values: mine, format },
            { key: 'market', label: 'Market average', values: market, format },
          ]}
        />
      }
    >
      <Line data={data} options={axes('Reputation')} />
    </Box>
  )
}

function InsuranceChart({ own }: { own: DayRecord[] }): ReactElement {
  const fees = runningTotal(own.map((r) => r.cost_insurance))
  const refunds = runningTotal(own.map((r) => r.refund_insurance))
  const data: ChartData<'line'> = {
    labels: dayLabels(own),
    datasets: [
      {
        label: 'Fees paid',
        data: fees,
        borderColor: CHART_COLORS['p3'],
        backgroundColor: CHART_COLORS['p3'],
        borderWidth: 2.5,
        pointRadius: 0,
      },
      {
        label: 'Refunds received',
        data: refunds,
        borderColor: CHART_COLORS['p6'],
        backgroundColor: CHART_COLORS['p6'],
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointRadius: 0,
      },
    ],
  }
  return (
    <Box
      title="Insurance: fees vs refunds"
      ariaLabel="Lines of the insurance fees you paid and the refunds you received, as running totals by day"
      legend={[
        { key: 'fees', label: 'Fees paid', swatch: { kind: 'line', color: CHART_COLORS['p3'] } },
        { key: 'refunds', label: 'Refunds received', swatch: { kind: 'line', color: CHART_COLORS['p6'], dash: [6, 4] } },
      ]}
      table={
        <SeriesTable
          caption="Insurance: fees vs refunds"
          days={days(own)}
          series={[
            { key: 'fees', label: 'Fees paid', values: fees, format: formatMoney },
            { key: 'refunds', label: 'Refunds received', values: refunds, format: formatMoney },
          ]}
        />
      }
    >
      <Line data={data} options={axes('$')} />
    </Box>
  )
}

export default function DetailsPanel({ view, ownHistory, publicHistory, lastRecord }: DetailsPanelProps): ReactElement {
  const [open, setOpen] = useState<boolean>(() => getUiFlag('details_open'))
  const change = (next: boolean): void => {
    setOpen(next)
    setUiFlag('details_open', next)
  }
  return (
    <Collapsible variant="card" summary="Details" open={open} onOpenChange={change}>
      <div className="flex flex-col gap-4">
        <InventoryChart own={ownHistory} />
        <CollaborationChart own={ownHistory} pub={publicHistory} />
        <CostsChart own={ownHistory} />
        <SoldSpoiledChart own={ownHistory} />
        <ReputationChart own={ownHistory} pub={publicHistory} alias={view.alias} />
        <InsuranceChart own={ownHistory} />
        {lastRecord ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">Last day's ledger</h3>
            <LedgerTable record={lastRecord} />
          </div>
        ) : null}
      </div>
    </Collapsible>
  )
}
