import type { ChartData, ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { INCOTERM_TIERS, type IncotermTier } from '../../types/game'
import { INCOTERM_TIER_NAMES, formatMoney, formatQty, weekdayShort } from '../../utils/format'
import { CHART_COLORS, MEASURE_STYLES } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import SectionCard from '../shared/SectionCard'
import { buildPeerUnitsConfig } from './demandSupplyConfig'
import type { PulqueriaResultView, ResultsView } from './resultsView'

const ROW_PX = 40
const EXTRA_PX = 32
const PEER_PX = 240
const SPOT_PX = 280

/** One-hue ordinal ramp for the tiers, light to dark (design.md §3.3), from the blue token at rising alpha. */
const TIER_ALPHA = { exw: '55', cip: '88', dap: 'BB', ddp: 'FF' } as const satisfies Record<IncotermTier, string>

const horizontal = (xTitle: string): ChartOptions<'bar'> =>
  ({
    indexAxis: 'y',
    scales: {
      x: { stacked: true, title: { display: true, text: xTitle } },
      y: { stacked: true },
    },
  }) as ChartOptions<'bar'>

function rankRows(view: ResultsView): PulqueriaResultView[] {
  return view.players
}

function CooperationVotes({ view }: { view: ResultsView }): ReactElement {
  const players = rankRows(view)
  const agreed = view.market.cooperation_reached.filter(Boolean).length
  const data: ChartData<'bar'> = {
    labels: players.map((p) => p.display_name),
    datasets: [
      {
        label: 'Cooperated',
        data: players.map((p) => p.days_cooperated),
        backgroundColor: CHART_COLORS['series-sold'],
      },
      {
        label: 'Did not cooperate',
        data: players.map((p) => view.days_played - p.days_cooperated),
        backgroundColor: CHART_COLORS['border-strong'],
      },
    ],
  }
  const columns: Column<PulqueriaResultView>[] = [
    { key: 'name', header: 'Pulquería', render: (p) => p.display_name },
    { key: 'yes', header: 'Cooperated', align: 'right', render: (p) => formatQty(p.days_cooperated) },
    { key: 'no', header: 'Did not cooperate', align: 'right', render: (p) => formatQty(view.days_played - p.days_cooperated) },
  ]
  return (
    <ChartBox
      title="Cooperation votes"
      caption={`Everyone agreed on ${agreed} days.`}
      ariaLabel="Stacked horizontal bars of the days each pulquería cooperated and did not cooperate"
      height={ROW_PX * players.length + EXTRA_PX}
      legend={
        <Legend
          items={[
            { key: 'yes', label: 'Cooperated', swatch: { kind: 'fill', color: CHART_COLORS['series-sold'] } },
            { key: 'no', label: 'Did not cooperate', swatch: { kind: 'fill', color: CHART_COLORS['border-strong'] } },
          ]}
        />
      }
      table={<DataTable caption="Cooperation votes" columns={columns} rows={players} rowKey={(p) => p.alias} density="compact" />}
    >
      <Bar data={data} options={horizontal('Days')} />
    </ChartBox>
  )
}

function TiersUsed({ view }: { view: ResultsView }): ReactElement {
  const players = rankRows(view)
  const colorOf = (tier: IncotermTier): string => `${CHART_COLORS['p1']}${TIER_ALPHA[tier]}`
  const data: ChartData<'bar'> = {
    labels: players.map((p) => p.display_name),
    datasets: INCOTERM_TIERS.map((tier) => ({
      label: INCOTERM_TIER_NAMES[tier],
      data: players.map((p) => p.incoterm_tier_days[tier]),
      backgroundColor: colorOf(tier),
    })),
  }
  const columns: Column<PulqueriaResultView>[] = [
    { key: 'name', header: 'Pulquería', render: (p) => p.display_name },
    ...INCOTERM_TIERS.map(
      (tier): Column<PulqueriaResultView> => ({
        key: tier,
        header: INCOTERM_TIER_NAMES[tier],
        align: 'right',
        render: (p) => formatQty(p.incoterm_tier_days[tier]),
      }),
    ),
  ]
  return (
    <ChartBox
      title="Incoterm tiers used"
      ariaLabel="Stacked horizontal bars of the days each pulquería shipped under each incoterm tier"
      height={ROW_PX * players.length + EXTRA_PX}
      legend={
        <Legend
          items={INCOTERM_TIERS.map((tier) => ({
            key: tier,
            label: INCOTERM_TIER_NAMES[tier],
            swatch: { kind: 'fill' as const, color: colorOf(tier) },
          }))}
        />
      }
      table={<DataTable caption="Incoterm tiers used" columns={columns} rows={players} rowKey={(p) => p.alias} density="compact" />}
    >
      <Bar data={data} options={horizontal('Days')} />
    </ChartBox>
  )
}

function LotsConserved({ view }: { view: ResultsView }): ReactElement {
  const players = rankRows(view)
  const data: ChartData<'bar'> = {
    labels: players.map((p) => p.display_name),
    datasets: [{ label: 'Lots conserved', data: players.map((p) => p.lots_conserved), backgroundColor: CHART_COLORS['p1'] }],
  }
  const columns: Column<PulqueriaResultView>[] = [
    { key: 'name', header: 'Pulquería', render: (p) => p.display_name },
    { key: 'lots', header: 'Lots conserved', align: 'right', render: (p) => formatQty(p.lots_conserved) },
  ]
  const options = {
    indexAxis: 'y',
    scales: { x: { title: { display: true, text: 'Lots' } } },
  } as ChartOptions<'bar'>
  return (
    <ChartBox
      title="Lots conserved"
      ariaLabel="Horizontal bars of the lots each pulquería paid to conserve"
      height={ROW_PX * players.length + EXTRA_PX}
      table={<DataTable caption="Lots conserved" columns={columns} rows={players} rowKey={(p) => p.alias} density="compact" />}
    >
      <Bar data={data} options={options} />
    </ChartBox>
  )
}

interface PeerRow {
  day: number
  bought: number
  sold: number
}

function PeerChart({ view, player }: { view: ResultsView; player: PulqueriaResultView }): ReactElement {
  const config = buildPeerUnitsConfig(view, player.alias)
  const bought = player.series.peer_bought ?? []
  const sold = player.series.peer_sold ?? []
  const rows: PeerRow[] = Array.from({ length: view.days_played }, (_, i) => ({
    day: i + 1,
    bought: bought[i] ?? 0,
    sold: sold[i] ?? 0,
  }))
  const columns: Column<PeerRow>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'bought', header: 'Bought', align: 'right', render: (r) => formatQty(r.bought) },
    { key: 'sold', header: 'Sold', align: 'right', render: (r) => formatQty(r.sold) },
  ]
  return (
    <ChartBox
      title={`Peer units per day: ${player.display_name}`}
      ariaLabel={`Bars of the units ${player.display_name} bought from other pulquerías above zero and sold to them below zero, for each day`}
      height={PEER_PX}
      legend={
        <Legend
          items={[
            { key: 'bought', label: 'Bought', swatch: { kind: 'fill', color: MEASURE_STYLES.delivered.color, hatched: true } },
            { key: 'sold', label: 'Sold', swatch: { kind: 'fill', color: MEASURE_STYLES.sold.color, hatched: true } },
          ]}
        />
      }
      table={
        <DataTable
          caption={`Peer units per day: ${player.display_name}`}
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.day)}
          density="compact"
        />
      }
    >
      <Bar data={config.data} options={config.options} />
    </ChartBox>
  )
}

function PeerGroup({ view }: { view: ResultsView }): ReactElement {
  const traders = view.players.filter(
    (p) => typeof p.peer_units_bought === 'number' && typeof p.peer_units_sold === 'number' && p.peer_units_bought + p.peer_units_sold > 0,
  )
  const anyPeerData = view.players.some((p) => typeof p.peer_units_bought === 'number' && typeof p.peer_units_sold === 'number')
  if (!anyPeerData) return <></>
  return (
    <div className="flex flex-col gap-3 lg:col-span-2">
      <h3 className="text-base font-semibold">Peer market</h3>
      {traders.length === 0 ? (
        <p className="text-ink-muted">No pulquería traded on the peer market.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {traders.map((p) => (
            <PeerChart key={p.alias} view={view} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SpotRow {
  day: number
  weekday: string
  spot: number
  failure: boolean
  disrupted: boolean
}

function SpotPrice({ view }: { view: ResultsView }): ReactElement {
  const m = view.market
  const rows: SpotRow[] = Array.from({ length: view.days_played }, (_, i) => ({
    day: i + 1,
    weekday: weekdayShort(m.weekday[i]),
    spot: m.spot_price[i],
    failure: m.refrigeration_failure[i],
    disrupted: m.disrupted[i],
  }))
  const marked = (flag: (r: SpotRow) => boolean): Array<number | null> => rows.map((r) => (flag(r) ? r.spot : null))
  const data: ChartData<'line'> = {
    labels: rows.map((r) => [String(r.day), r.weekday]),
    datasets: [
      {
        label: 'Spot price',
        data: rows.map((r) => r.spot),
        borderColor: CHART_COLORS['p1'],
        backgroundColor: CHART_COLORS['p1'],
        borderWidth: 2.5,
        pointRadius: 4,
      },
      {
        label: 'Refrigeration failure',
        data: marked((r) => r.failure),
        showLine: false,
        borderColor: CHART_COLORS['danger'],
        backgroundColor: CHART_COLORS['danger'],
        pointStyle: 'triangle',
        pointRadius: 8,
      },
      {
        label: 'Supplier disruption',
        data: marked((r) => r.disrupted),
        showLine: false,
        borderColor: CHART_COLORS['warning'],
        backgroundColor: CHART_COLORS['warning'],
        pointStyle: 'rectRot',
        pointRadius: 8,
      },
    ],
  }
  const options = {
    scales: {
      x: { title: { display: true, text: 'Day' } },
      y: { beginAtZero: true, title: { display: true, text: '$' } },
    },
  } as ChartOptions<'line'>
  const columns: Column<SpotRow>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'weekday', header: 'Weekday', render: (r) => r.weekday },
    { key: 'spot', header: 'Spot price', align: 'right', render: (r) => formatMoney(r.spot) },
    { key: 'failure', header: 'Refrigeration failure', render: (r) => (r.failure ? 'Yes' : 'No') },
    { key: 'disrupted', header: 'Supplier disruption', render: (r) => (r.disrupted ? 'Yes' : 'No') },
  ]
  return (
    <div className="lg:col-span-2">
      <ChartBox
        title="Spot price over the game"
        ariaLabel="Line chart of the spot price on each day played, with refrigeration failure days and supplier disruption days marked"
        height={SPOT_PX}
        legend={
          <Legend
            items={[
              { key: 'spot', label: 'Spot price', swatch: { kind: 'line', color: CHART_COLORS['p1'], pointStyle: 'circle' } },
              { key: 'failure', label: 'Refrigeration failure', swatch: { kind: 'line', color: CHART_COLORS['danger'], pointStyle: 'triangle' } },
              { key: 'disruption', label: 'Supplier disruption', swatch: { kind: 'line', color: CHART_COLORS['warning'], pointStyle: 'rectRot' } },
            ]}
          />
        }
        table={<DataTable caption="Spot price over the game" columns={columns} rows={rows} rowKey={(r) => String(r.day)} density="compact" />}
      >
        <Line data={data} options={options} />
      </ChartBox>
    </div>
  )
}

/** Block 5 of spec §13.8: votes, tiers, conserved lots, the peer market, and the spot price with its bad days. */
export default function DecisionsCharts({ view }: { view: ResultsView }): ReactElement {
  return (
    <SectionCard title="5. Decisions">
      <div className="grid gap-4 lg:grid-cols-2">
        <CooperationVotes view={view} />
        <TiersUsed view={view} />
        <LotsConserved view={view} />
        <PeerGroup view={view} />
        <SpotPrice view={view} />
      </div>
    </SectionCard>
  )
}
