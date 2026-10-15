import type { ChartData, ChartOptions } from 'chart.js'
import { Flame } from 'lucide-react'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import { hazard, marketLambda, shares, spotRange, weekdayMultipliers } from '../../game/configMath'
import type { GameConfig, Weekday } from '../../types/game'
import { formatMoney, formatPercent, weekdayLong, weekdayShort } from '../../utils/format'
import { CHART_COLORS, MEASURE_STYLES, registerCharts } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable from '../shared/DataTable'
import { Table } from './docs/primitives'

interface PreviewProps {
  config: GameConfig
}

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** A draft value that is mid-edit (empty) counts as 0 so a preview never shows NaN. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function oneDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The WeekdayStrip look (design.md §7.8): the multiplier of each weekday, Mon..Sun, 0 to 1. */
export function WeekdayPreview({ config }: PreviewProps): ReactElement {
  const { from, to } = config.demand.weekday_peak
  const multipliers = weekdayMultipliers(from, to)
  const first = WEEKDAYS.indexOf(from)
  const last = WEEKDAYS.indexOf(to)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Weekday multiplier</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, i) => {
          const peak = i >= first && i <= last
          return (
            <div
              key={day}
              className={['rounded-sm px-1 py-1.5 text-center', peak ? 'bg-peak' : 'bg-inset'].join(' ')}
            >
              <div className="flex items-center justify-center gap-0.5 text-xs font-semibold">
                {peak ? <Flame size={12} aria-hidden="true" /> : null}
                <span title={weekdayLong(day)}>{weekdayShort(day)}</span>
              </div>
              <div className="mx-auto mt-1 flex h-6 w-3 items-end rounded-xs bg-muted">
                <div className="w-full bg-ochre" style={{ height: `${multipliers[day] * 100}%` }} />
              </div>
              <div className="mt-1 text-xs tabular-nums">{multipliers[day].toFixed(2)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Expected market demand per weekday (bars) against expected capacity (line). */
export function DemandCapacityPreview({ config }: PreviewProps): ReactElement {
  registerCharts()
  const seats = finite(config.max_players)
  const multipliers = weekdayMultipliers(config.demand.weekday_peak.from, config.demand.weekday_peak.to)
  const demand = WEEKDAYS.map((d) => marketLambda(finite(config.demand.per_player_peak), seats, multipliers[d]))
  const capacity = finite(config.supplier.capacity_mean_per_player) * seats
  const labels = WEEKDAYS.map(weekdayShort)
  const line = MEASURE_STYLES.delivered
  const data = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Expected market demand',
        data: demand,
        backgroundColor: MEASURE_STYLES.demand.color,
        borderColor: CHART_COLORS['card'],
      },
      {
        type: 'line',
        label: 'Expected capacity',
        data: WEEKDAYS.map(() => capacity),
        borderColor: line.color,
        backgroundColor: line.color,
        borderDash: line.dash,
        borderWidth: line.width,
        pointRadius: 0,
      },
    ],
  } as unknown as ChartData<'bar'>
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: 'Weekday' } },
      y: { beginAtZero: true, title: { display: true, text: 'Units per day' } },
    },
  }
  return (
    <ChartBox
      title="Expected market demand and capacity"
      ariaLabel="Expected market demand and expected capacity for each weekday"
      height={200}
      table={
        <Table
          caption="Expected market demand and capacity"
          head={['Weekday', 'Expected market demand', 'Expected capacity']}
          rows={WEEKDAYS.map((d, i) => [weekdayShort(d), oneDecimal(demand[i]), oneDecimal(capacity)])}
        />
      }
    >
      <Bar data={data} options={options} />
    </ChartBox>
  )
}

const SAMPLE_REPUTATIONS = [0.3, 0.5, 0.8]

/** Demand shares of three pulquerías with sample reputations, on a peak day. */
export function DemandSplitPreview({ config }: PreviewProps): ReactElement {
  const split = shares({ a: SAMPLE_REPUTATIONS[0], b: SAMPLE_REPUTATIONS[1], c: SAMPLE_REPUTATIONS[2] })
  const market = marketLambda(finite(config.demand.per_player_peak), 3, 1)
  const keys = ['a', 'b', 'c']
  return (
    <Table
      caption="Demand split on a peak day"
      head={['Reputation', 'Share', 'Expected units']}
      rows={keys.map((k, i) => [
        SAMPLE_REPUTATIONS[i].toFixed(1),
        formatPercent(split[k], 0),
        String(Math.floor(market * split[k] + 0.5)),
      ])}
    />
  )
}

export function SpotRangePreview({ config }: PreviewProps): ReactElement {
  const [low, high] = spotRange(finite(config.supplier.base_price), finite(config.supplier.spot_spread))
  return <p className="text-base">{`Spot price ranges from ${formatMoney(low)} to ${formatMoney(high)}`}</p>
}

interface RiskRow {
  night: number
  cells: string[]
}

/** One column of hazards as percentages: the first night at 100% stays, later nights read as a dash. */
function riskColumn(nights: number, fresh: number, max: number, q0: number): string[] {
  const out: string[] = []
  let gone = false
  for (let night = 1; night <= nights; night += 1) {
    if (gone) {
      out.push('—')
      continue
    }
    const risk = hazard(night, fresh, max, q0)
    if (risk >= 1 - 1e-9) gone = true
    out.push(`${Math.round(risk * 100)}%`)
  }
  return out
}

/** Spoil risk night by night: plain vs conserved lots arriving at the lowest and highest initial quality. */
export function SpoilRiskPreview({ config }: PreviewProps): ReactElement | null {
  const { fresh_days: fresh, max_days: max, conservation_extra_fresh_days: extra } = config.stock
  const { quality_min: qMin, quality_max: qMax } = config.supplier
  if (![fresh, max, extra, qMin, qMax].every(Number.isFinite) || max <= fresh) return null
  const nights = max + extra
  const same = qMin === qMax
  const specs = same
    ? [
        { header: `Plain lot at ${qMin}%`, fresh, max, q0: qMin },
        { header: `Conserved lot at ${qMin}%`, fresh: fresh + extra, max: max + extra, q0: qMin },
      ]
    : [
        { header: `Plain lot at ${qMin}%`, fresh, max, q0: qMin },
        { header: `Plain lot at ${qMax}%`, fresh, max, q0: qMax },
        { header: `Conserved lot at ${qMin}%`, fresh: fresh + extra, max: max + extra, q0: qMin },
        { header: `Conserved lot at ${qMax}%`, fresh: fresh + extra, max: max + extra, q0: qMax },
      ]
  const columns = specs.map((s) => riskColumn(nights, s.fresh, s.max, s.q0))
  const rows: RiskRow[] = Array.from({ length: nights }, (_, i) => ({
    night: i + 1,
    cells: columns.map((c) => c[i]),
  }))
  return (
    <DataTable
      caption="Spoil risk by night"
      density="compact"
      columns={[
        { key: 'night', header: 'Night', render: (row: RiskRow) => row.night },
        ...specs.map((s, c) => ({
          key: `c${c}`,
          header: s.header,
          align: 'right' as const,
          render: (row: RiskRow) => row.cells[c],
        })),
      ]}
      rows={rows}
      rowKey={(row) => String(row.night)}
    />
  )
}
