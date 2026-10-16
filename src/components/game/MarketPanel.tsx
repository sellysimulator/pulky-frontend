import type { ChartData, ChartOptions } from 'chart.js'
import { ArrowLeftRight, ChartPie } from 'lucide-react'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DayRecord, PlayerView, PublicConfig, PublicDayResults } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'
import SectionCard from '../shared/SectionCard'
import Legend from '../shared/Legend'
import ResultsTable from './ResultsTable'
import SharePie from './SharePie'
import SpotPriceChart from './SpotPriceChart'

interface MarketPanelProps {
  view: PlayerView
  ownHistory: DayRecord[]
  publicHistory: PublicDayResults[]
  config: PublicConfig
}

const PROFIT_OPTIONS: ChartOptions<'bar'> = {
  scales: {
    x: { title: { display: true, text: 'Day' } },
    y: { title: { display: true, text: '$' } },
  },
}

function peerLine(day: PublicDayResults): string {
  if (day.peer_units > 0 && day.peer_avg_price !== null) {
    return `Peer market: ${day.peer_units} units at ${formatMoney(day.peer_avg_price)} on average`
  }
  if (day.peer_units > 0) return `Peer market: ${day.peer_units} units`
  return 'Peer market: no trades'
}

function ProfitPerDay({ ownHistory }: { ownHistory: DayRecord[] }): ReactElement {
  const data: ChartData<'bar'> = {
    labels: ownHistory.map((r) => String(r.day)),
    datasets: [
      {
        label: 'Profit',
        data: ownHistory.map((r) => r.profit),
        backgroundColor: ownHistory.map((r) => (r.profit < 0 ? CHART_COLORS['danger'] : CHART_COLORS['p1'])),
      },
    ],
  }
  const columns: Column<DayRecord>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'profit', header: 'Profit', align: 'right', render: (r) => formatMoney(r.profit) },
  ]
  return (
    <ChartBox
      title="Your profit per day"
      ariaLabel="Bar chart of your profit on each day played"
      height={240}
      legend={<Legend items={[{ key: 'profit', label: 'Profit', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } }]} />}
      table={<DataTable caption="Your profit per day" columns={columns} rows={ownHistory} rowKey={(r) => String(r.day)} density="compact" />}
    >
      <Bar data={data} options={PROFIT_OPTIONS} />
    </ChartBox>
  )
}

export default function MarketPanel({ view, ownHistory, publicHistory, config }: MarketPanelProps): ReactElement {
  const last = publicHistory.length > 0 ? publicHistory[publicHistory.length - 1] : null
  return (
    <SectionCard title="Market" icon={ChartPie}>
      {last === null ? (
        <EmptyState icon={ChartPie} title="No results yet" body="They appear after the first day closes." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <ResultsTable day={last} ownAlias={view.alias} />
            {config.peer_market.enabled ? (
              <p className="flex items-center gap-2 text-base text-ink-muted">
                <ArrowLeftRight size={18} aria-hidden="true" className="shrink-0" />
                <span>{peerLine(last)}</span>
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
            <SharePie day={last} ownAlias={view.alias} />
            <SpotPriceChart publicHistory={publicHistory} basePrice={view.brief?.supplier.base_price ?? null} />
          </div>
          <ProfitPerDay ownHistory={ownHistory} />
        </div>
      )}
    </SectionCard>
  )
}
