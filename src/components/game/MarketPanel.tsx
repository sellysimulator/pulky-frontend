import type { ChartData, ChartOptions } from 'chart.js'
import { ArrowLeftRight, ChartPie } from 'lucide-react'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import { useGameStore } from '../../store/gameStore'
import type { DayRecord, PlayerView, PublicConfig, PublicDayResults } from '../../types/game'
import { formatMoney } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'
import SectionCard from '../shared/SectionCard'
import Legend from '../shared/Legend'
import ResultsTable from './ResultsTable'
import ShareBars from './ShareBars'
import SpotPriceChart from './SpotPriceChart'

interface MarketPanelProps {
  view: PlayerView
  ownHistory: DayRecord[]
  publicHistory: PublicDayResults[]
  config: PublicConfig
}


function peerLine(day: PublicDayResults): string {
  if (day.peer_units > 0 && day.peer_avg_price !== null) {
    return `Peer market: ${day.peer_units} units at ${formatMoney(day.peer_avg_price)} on average`
  }
  if (day.peer_units > 0) return `Peer market: ${day.peer_units} units`
  return 'Peer market: no trades'
}

function ProfitPerDay({ ownHistory }: { ownHistory: DayRecord[] }): ReactElement {
  const selectedDay = useGameStore((s) => s.selectedDay)
  const selectDay = useGameStore((s) => s.selectDay)
  const found = ownHistory.findIndex((r) => r.day === selectedDay)
  const chosen = found >= 0 ? found : ownHistory.length - 1
  const options: ChartOptions<'bar'> = {
    scales: {
      x: { title: { display: true, text: 'Day' } },
      y: { title: { display: true, text: '$' } },
    },
    onClick: (_event, elements) => {
      if (elements.length > 0) selectDay(ownHistory[elements[0].index].day)
    },
  }
  const data: ChartData<'bar'> = {
    labels: ownHistory.map((r) => String(r.day)),
    datasets: [
      {
        label: 'Profit',
        data: ownHistory.map((r) => r.profit),
        backgroundColor: ownHistory.map((r) => (r.profit < 0 ? CHART_COLORS['danger'] : CHART_COLORS['p1'])),
        borderColor: ownHistory.map(() => CHART_COLORS['ink']),
        borderWidth: ownHistory.map((_, i) => (i === chosen ? 2 : 0)),
      },
    ],
  }
  const columns: Column<DayRecord>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'profit', header: 'Profit', align: 'right', render: (r) => formatMoney(r.profit) },
  ]
  const chosenDay = ownHistory[chosen]?.day
  return (
    <ChartBox
      title="Your profit per day"
      ariaLabel="Bar chart of your profit on each day played"
      height={240}
      controls={
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="Day to break down"
            min={1}
            max={ownHistory.length}
            step={1}
            value={chosen + 1}
            onChange={(e) => {
              const record = ownHistory[Number(e.target.value) - 1]
              if (record) selectDay(record.day)
            }}
            className="min-w-0 flex-1 accent-accent"
          />
          <span className="text-sm tabular-nums text-ink-muted">Day {chosenDay}</span>
        </div>
      }
      legend={
        <Legend
          items={[
            { key: 'profit', label: 'Profit', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } },
            { key: 'loss', label: 'Loss', swatch: { kind: 'fill', color: CHART_COLORS['danger'] } },
          ]}
        />
      }
      table={<DataTable caption="Your profit per day" columns={columns} rows={ownHistory} rowKey={(r) => String(r.day)} density="compact" />}
    >
      <Bar data={data} options={options} />
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
          <div className="grid gap-4 md:grid-cols-2">
            <ShareBars day={last} ownAlias={view.alias} publicHistory={publicHistory} />
            <SpotPriceChart publicHistory={publicHistory} basePrice={view.brief?.supplier.base_price ?? null} />
          </div>
          <ProfitPerDay ownHistory={ownHistory} />
        </div>
      )}
    </SectionCard>
  )
}
