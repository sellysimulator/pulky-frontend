import type { ChartData, ChartOptions } from 'chart.js'
import { Flame } from 'lucide-react'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ConfigPreview, PreviewLot } from '../../types/game'
import { formatMoney, formatPercent, weekdayLong, weekdayShort } from '../../utils/format'
import { CHART_COLORS, MEASURE_STYLES, registerCharts } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable from '../shared/DataTable'
import { previewGap, useConfigPreview } from './configPreview'
import { Table } from './docs/primitives'

function oneDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** The server's figures (spec §13.9), or the loading / unavailable line while there are none (spec §13.10). */
function WithPreview({ children }: { children(preview: ConfigPreview): ReactElement | null }): ReactElement | null {
  const state = useConfigPreview()
  if (state.preview === null) return <p className="text-sm text-ink-muted">{previewGap(state)}</p>
  return children(state.preview)
}

/** The WeekdayStrip look (design.md §7.8): the multiplier of each weekday, Mon..Sun, 0 to 1. */
export function WeekdayPreview(): ReactElement | null {
  return (
    <WithPreview>
      {(p) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Weekday multiplier</p>
          <div className="grid grid-cols-7 gap-1">
            {p.weekdays.days.map(({ weekday, multiplier, in_peak }) => (
              <div key={weekday} className={['rounded-sm px-1 py-1.5 text-center', in_peak ? 'bg-peak' : 'bg-inset'].join(' ')}>
                <div className="flex items-center justify-center gap-0.5 text-xs font-semibold">
                  {in_peak ? <Flame size={12} aria-hidden="true" /> : null}
                  <span title={weekdayLong(weekday)}>{weekdayShort(weekday)}</span>
                </div>
                <div className="mx-auto mt-1 flex h-6 w-3 items-end rounded-xs bg-muted">
                  <div className="w-full bg-ochre" style={{ height: `${multiplier * 100}%` }} />
                </div>
                <div className="mt-1 text-xs tabular-nums">{multiplier.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WithPreview>
  )
}

/** Expected market demand per weekday (bars) against expected capacity (line). */
export function DemandCapacityPreview(): ReactElement | null {
  registerCharts()
  return (
    <WithPreview>
      {(p) => {
        const days = p.weekdays.days
        const capacity = p.supplier.expected_capacity
        const line = MEASURE_STYLES.delivered
        const data = {
          labels: days.map((d) => weekdayShort(d.weekday)),
          datasets: [
            {
              type: 'bar',
              label: 'Expected market demand',
              data: days.map((d) => d.market_demand),
              backgroundColor: MEASURE_STYLES.demand.color,
              borderColor: CHART_COLORS['card'],
            },
            {
              type: 'line',
              label: 'Expected capacity',
              data: days.map(() => capacity),
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
                rows={days.map((d) => [weekdayShort(d.weekday), oneDecimal(d.market_demand), oneDecimal(capacity)])}
              />
            }
          >
            <Bar data={data} options={options} />
          </ChartBox>
        )
      }}
    </WithPreview>
  )
}

/** Demand shares of three pulquerías with sample reputations, on a peak day. */
export function DemandSplitPreview(): ReactElement | null {
  return (
    <WithPreview>
      {(p) => (
        <Table
          caption="Demand split on a peak day"
          head={['Reputation', 'Share', 'Expected units']}
          rows={p.reputation.split.map((s) => [s.reputation.toFixed(1), formatPercent(s.share, 0), String(s.units)])}
        />
      )}
    </WithPreview>
  )
}

export function SpotRangePreview(): ReactElement | null {
  return (
    <WithPreview>
      {(p) => <p className="text-base">{`Spot price ranges from ${formatMoney(p.prices.spot_low)} to ${formatMoney(p.prices.spot_high)}`}</p>}
    </WithPreview>
  )
}

interface RiskRow {
  night: number
  cells: string[]
}

function lotHeader(lot: PreviewLot): string {
  return `${lot.conserved ? 'Conserved' : 'Plain'} lot at ${lot.initial_quality}%`
}

/** Spoil risk night by night: plain vs conserved lots arriving at the lowest and highest initial quality. */
export function SpoilRiskPreview(): ReactElement | null {
  return (
    <WithPreview>
      {(p) => {
        const lots = p.stock.spoil_risk
        const nights = lots[0]?.nights.length ?? 0
        const rows: RiskRow[] = Array.from({ length: nights }, (_, i) => ({
          night: i + 1,
          cells: lots.map((lot) => {
            const risk = lot.nights[i]?.risk ?? null
            return risk === null ? '—' : formatPercent(risk, 0)
          }),
        }))
        return (
          <DataTable
            caption="Spoil risk by night"
            density="compact"
            columns={[
              { key: 'night', header: 'Night', render: (row: RiskRow) => row.night },
              ...lots.map((lot, c) => ({
                key: `c${c}`,
                header: lotHeader(lot),
                align: 'right' as const,
                render: (row: RiskRow) => row.cells[c],
              })),
            ]}
            rows={rows}
            rowKey={(row) => String(row.night)}
          />
        )
      }}
    </WithPreview>
  )
}
