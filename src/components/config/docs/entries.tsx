import type { ReactNode } from 'react'
import {
  INSURED_TIERS,
  PLAYER_CONFIG_KEYS,
  SECRET_CONFIG_KEYS,
  type CalculatorCase,
  type ConfigPreview,
  type GameConfig,
  type InsuredTier,
  type PreviewLot,
  type RatioBadge,
} from '../../../types/game'
import {
  INCOTERM_TIER_NAMES,
  QUALITY_GUIDE_NOTE,
  formatMoney,
  formatPercent,
  formatQty,
  formatQualityGuide,
  weekdayLong,
  weekdayShort,
} from '../../../utils/format'
import { previewGap, type ConfigPreviewState } from '../configPreview'
import { HIDDEN_EXAMPLE } from '../hiddenDefaults'
import { BarChart, Example, Formula, LineChart, List, Note, P, Table } from './primitives'

/**
 * A help entry (spec §13.10). Its formula is the rule in words; its example shows the server's figures for the
 * config being edited (`POST /config/preview`), so no entry computes a game figure itself.
 */
export interface HelpEntry {
  label: string
  formula(cfg: GameConfig, preview: ConfigPreview | null): ReactNode
  effect: ReactNode
  example(cfg: GameConfig, state: ConfigPreviewState): ReactNode
}

type Render = (p: ConfigPreview, cfg: GameConfig) => ReactNode

/** An example from the server's figures, or the loading / unavailable line while there are none. */
function live(render: Render): HelpEntry['example'] {
  return (cfg, state) =>
    state.preview === null ? (
      <Example>
        <P>{previewGap(state)}</P>
      </Example>
    ) : (
      render(state.preview, cfg)
    )
}

/** A quantity with one decimal only when it is not whole. */
function num(value: number): string {
  return Number.isInteger(value) ? formatQty(value) : value.toFixed(1)
}

/** Spec §9.3: an example that needs a hidden default the host has not typed. */
function hiddenExample(): ReactNode {
  return (
    <Example>
      <P>{HIDDEN_EXAMPLE}</P>
    </Example>
  )
}

function pct(fraction: number | null): string {
  return fraction === null ? '—' : formatPercent(fraction, 0)
}

const ROLE_NAMES: Record<PreviewLot['role'], string> = {
  lowest: 'Lowest',
  middle: 'Middle',
  highest: 'Highest',
  plain: 'Plain',
  conserved: 'Conserved',
}

/** Two rows per lot (quality, spoil risk), one column per night; a dash once the lot is certainly gone. */
function lotTable(lots: { name: string; lot: PreviewLot }[]): ReactNode {
  const nights = Math.max(...lots.map((l) => l.lot.nights.length))
  const range = Array.from({ length: nights }, (_, i) => i + 1)
  const cell = (lot: PreviewLot, n: number, pick: 'quality' | 'risk'): string => {
    const night = lot.nights[n - 1] as PreviewLot['nights'][number] | undefined
    if (night === undefined) return '—'
    if (pick === 'risk') return pct(night.risk)
    return night.quality === null ? '—' : `${night.quality}%`
  }
  return (
    <Table
      caption="Quality and spoil risk night by night"
      head={['Lot', ...range.map((n) => `Night ${n}`)]}
      rows={lots.flatMap(({ name, lot }) => [
        [`${name}: quality`, ...range.map((n) => cell(lot, n, 'quality'))],
        [`${name}: spoil risk`, ...range.map((n) => cell(lot, n, 'risk'))],
      ])}
    />
  )
}

function qualityRangeExample(p: ConfigPreview): ReactNode {
  return (
    <Example title="A lot arriving at the lowest, middle and highest quality of the range">
      {lotTable(p.stock.quality_range.map((lot) => ({ name: `${ROLE_NAMES[lot.role]} (${lot.initial_quality}%)`, lot })))}
    </Example>
  )
}

function qualityRangeFormula(): ReactNode {
  return (
    <Formula>
      {'spoil risk at night n = min(1, (1 − q₀) + k ÷ (M − F))\nk = max(0, n − F) nights past the fresh period; q₀ = initial quality'}
    </Formula>
  )
}

function stockCurve(p: ConfigPreview, cfg: GameConfig): ReactNode {
  const fresh = cfg.stock.fresh_days
  const lot = p.stock.highest_lot
  const nights = lot.nights.filter((n) => n.quality !== null)
  return (
    <Example>
      <P>
        {`A lot arriving at ${lot.initial_quality}% keeps that quality for ${fresh} ${fresh === 1 ? 'night' : 'nights'}, then loses ${num(Math.round(p.stock.quality_step_per_night * 10) / 10)} quality points a night.`}
      </P>
      <Table
        caption="Spoil risk and quality for a lot at the highest initial quality"
        head={['Night', 'Spoil risk', 'Quality']}
        rows={nights.map((n) => [String(n.night), pct(n.risk), `${n.quality}%`])}
      />
      <LineChart
        title="Spoil risk and quality by night"
        labels={nights.map((n) => `Night ${n.night}`)}
        series={[
          { label: 'Spoil risk (%)', data: nights.map((n) => Math.round((n.risk ?? 0) * 100)), measure: 'spoiled' },
          { label: 'Quality (%)', data: nights.map((n) => n.quality ?? 0), measure: 'sold' },
        ]}
        xLabel="Night"
        yLabel="Percent"
        format={(v) => `${v}%`}
      />
    </Example>
  )
}

function stockFormula(): ReactNode {
  return (
    <Formula>
      {'spoil risk = min(1, (1 − q₀) + max(0, age − F) ÷ (M − F))\nquality points lost per night after the fresh period = 100 ÷ (M − F)'}
    </Formula>
  )
}

function spotExample(p: ConfigPreview, cfg: GameConfig): ReactNode {
  return (
    <Example title="The spot range">
      <List
        items={[
          `Spot prices run from ${formatMoney(p.prices.spot_low)} to ${formatMoney(p.prices.spot_high)} around the base price of ${formatMoney(cfg.supplier.base_price)}.`,
          'The spot price is above the base price on 50% of days and below it on the other 50%.',
        ]}
      />
    </Example>
  )
}

function spotFormula(): ReactNode {
  return <Formula>{'spot price = base_price × (1 + U(−spread, +spread))'}</Formula>
}

const WEEKDAY_CHART_TITLE = 'Demand multiplier by weekday'

function weekdayBars(p: ConfigPreview): ReactNode {
  const days = p.weekdays.days
  return (
    <Example>
      <BarChart
        title={WEEKDAY_CHART_TITLE}
        labels={days.map((d) => weekdayShort(d.weekday))}
        series={[{ label: 'Multiplier', data: days.map((d) => d.multiplier), measure: 'demand' }]}
        xLabel="Weekday"
        yLabel="Multiplier (0 to 1)"
        format={(v) => v.toFixed(2)}
      />
    </Example>
  )
}

function weekdayFormula(_cfg: GameConfig, p: ConfigPreview | null): ReactNode {
  const reach = p === null ? '…' : String(p.weekdays.reach)
  return (
    <Formula>
      {`multiplier = 1 − dist ÷ reach\ndist = 0 inside the window, else the days to its nearest edge (no wrap-around)\nreach = max(from − 1, 7 − to) + 1 = ${reach}, so each day away from the window loses 1 ÷ ${reach}`}
    </Formula>
  )
}

const BADGES: Record<RatioBadge, string> = {
  worth_it: 'Worth it',
  break_even: 'Break-even',
  not_worth_it: 'Not worth it on average',
  no_risk: 'No risk configured',
}

function tierRows(p: ConfigPreview, cfg: GameConfig, tier: InsuredTier): ReactNode {
  const row = p.calculator.tiers.find((t) => t.tier === tier)
  if (row === undefined || row.solo === null || row.shared === null) return <P>{HIDDEN_EXAMPLE}</P>
  const columns: CalculatorCase[] = [row.solo, row.shared]
  return (
    <Table
      caption={`Calculator row for ${INCOTERM_TIER_NAMES[tier]}`}
      head={['', 'Not shared', `Shared (N = ${p.calculator.shared_seats})`]}
      rows={[
        ['Break-even fee', ...columns.map((c) => formatMoney(c.break_even))],
        ['Fee per unit', ...columns.map(() => formatMoney(cfg.insurance.tiers[tier].fee))],
        ['Ratio', ...columns.map((c) => (c.ratio === null ? '—' : c.ratio.toFixed(2)))],
        ['Verdict', ...columns.map((c) => BADGES[c.badge])],
        ['Refund per lost unit', ...columns.map(() => formatMoney(row.refund_value))],
        ['Worst single-failure loss', ...columns.map((c) => formatMoney(c.worst_single_failure))],
      ]}
    />
  )
}

function tierFormula(): ReactNode {
  return (
    <Formula>
      {'break-even fee = p × floor(u_ref × L_eff) ÷ u_ref × value(tier)\nL_eff = L (solo) or L ÷ N (shared); value = base price (Paid-price, Market-price insurance) or retail price (Retail-price insurance)\nratio = fee ÷ break-even fee'}
    </Formula>
  )
}

function tierExample(tier: InsuredTier): HelpEntry['example'] {
  return live((p, cfg) => <Example title={`The calculator row for ${INCOTERM_TIER_NAMES[tier]}`}>{tierRows(p, cfg, tier)}</Example>)
}

const INSURED_TIER_EFFECTS: Record<InsuredTier, string> = {
  cip: 'Refunds lost units at what the player paid.',
  dap: 'Refunds lost units at the spot price on the arrival day.',
  ddp: 'Refunds lost units at the retail price.',
}

function tierEntries(): Record<string, HelpEntry> {
  const out: Record<string, HelpEntry> = {}
  for (const tier of INSURED_TIERS) {
    const name = INCOTERM_TIER_NAMES[tier]
    out[`insurance.tiers.${tier}.enabled`] = {
      label: `${name}: offered`,
      formula: tierFormula,
      effect: INSURED_TIER_EFFECTS[tier],
      example: tierExample(tier),
    }
    out[`insurance.tiers.${tier}.fee`] = {
      label: `${name}: fee per unit`,
      formula: tierFormula,
      effect: INSURED_TIER_EFFECTS[tier],
      example: tierExample(tier),
    }
  }
  return out
}

function lossTable(p: ConfigPreview): ReactNode {
  const t = p.transport.loss_table
  if (t === null) return <P>{HIDDEN_EXAMPLE}</P>
  return (
    <Table
      caption="Units lost in a failure, solo and shared"
      head={['', ...t.rows.map((r) => `${r.alias} (${r.shipped})`), 'Total lost']}
      rows={[
        ['Not shared', ...t.rows.map((r) => String(r.alone)), String(t.total_alone)],
        [
          `Shared (N = ${t.shared_by}, ${formatPercent(t.shared_fraction)} each)`,
          ...t.rows.map((r) => String(r.shared)),
          String(t.total_shared),
        ],
      ]}
    />
  )
}

function keyListItem(path: string): ReactNode {
  const label = (DOCS as Record<string, HelpEntry | undefined>)[path]?.label
  return (
    <>
      <code className="font-mono text-sm">{path}</code>
      {label ? ` (${label})` : ''}
    </>
  )
}

function build(): Record<string, HelpEntry> {
  const entries: Record<string, HelpEntry> = {
    max_players: {
      label: 'Seats',
      formula: () => <Formula>{'market demand λ_d = per_player_peak × N × weekday_multiplier_d'}</Formula>,
      effect: 'More seats make the market bigger: demand scales with the pulquerías seated.',
      example: live((p) => (
        <Example title="Market demand on a peak day">
          <Table
            caption="Market demand on a peak day by seats"
            head={['Seats', 'Units']}
            rows={p.weekdays.peak_demand_by_seats.map((r) => [String(r.seats), num(r.units)])}
          />
        </Example>
      )),
    },
    duration_days: {
      label: 'Days',
      formula: () => <Formula>{'weekday of day d = (d − 1) mod 7, counting from Monday\nday 1 is always a Monday'}</Formula>,
      effect: 'Longer games cover more weekly cycles and give futures time to pay off.',
      example: live((p, cfg) => (
        <Example>
          <List
            items={[
              `${cfg.duration_days} days cover ${p.game.weekly_cycles.toFixed(1)} weekly cycles.`,
              `Day 1 is a Monday; day ${cfg.duration_days}, the last, is a ${weekdayLong(p.game.last_weekday)}.`,
            ]}
          />
        </Example>
      )),
    },
    starting_cash: {
      label: 'Starting cash',
      formula: () => <Formula>{'days covered = starting_cash ÷ (expected own demand per day × base_price)'}</Formula>,
      effect: 'Less cash forces smaller orders and makes futures, which are paid up front, harder to afford.',
      example: live((p, cfg) => (
        <Example>
          <List
            items={[
              `Expected own demand averages ${p.game.own_demand_per_day.toFixed(1)} units a day over a week.`,
              `Buying that on the spot at the base price costs ${formatMoney(p.game.cost_per_day)} a day.`,
              `${formatMoney(cfg.starting_cash)} covers ${p.game.days_covered.toFixed(1)} days.`,
            ]}
          />
        </Example>
      )),
    },
    'demand.per_player_peak': {
      label: 'Demand per player on a peak day (λ)',
      formula: (cfg) => (
        <Formula>{`λ_d = ${cfg.demand.per_player_peak} × N × weekday_multiplier_d\neach pulquería gets its reputation share of λ_d`}</Formula>
      ),
      effect: "Raises or lowers every day's demand in proportion; the weekday shape stays the same.",
      example: live((p, cfg) => (
        <Example>
          <BarChart
            title={`Market demand per weekday for ${cfg.max_players} seats`}
            labels={p.weekdays.days.map((d) => weekdayShort(d.weekday))}
            series={[{ label: 'Market demand', data: p.weekdays.days.map((d) => d.market_demand), measure: 'demand' }]}
            xLabel="Weekday"
            yLabel="Units"
            format={num}
          />
        </Example>
      )),
    },
    'demand.weekday_peak.from': {
      label: 'Peak starts',
      formula: weekdayFormula,
      effect: 'Moves the start of the busy days; demand steps down equally on each side of the window.',
      example: live(weekdayBars),
    },
    'demand.weekday_peak.to': {
      label: 'Peak ends',
      formula: weekdayFormula,
      effect: 'Moves the end of the busy days; a full-week window removes the weekday effect.',
      example: live(weekdayBars),
    },
    'demand.retail_price': {
      label: 'Retail price',
      formula: () => <Formula>{'margin per unit = retail_price − price paid for the unit'}</Formula>,
      effect: 'A higher price widens the margin on every unit and makes backlog and spoilage costlier by comparison.',
      example: live((p) => (
        <Example>
          <Table
            caption="Margin per unit across the spot range"
            head={['Spot price', 'Margin per unit']}
            rows={[
              [`${formatMoney(p.prices.spot_low)} (cheapest)`, formatMoney(p.prices.margin_at_low)],
              [`${formatMoney(p.prices.spot_high)} (dearest)`, formatMoney(p.prices.margin_at_high)],
            ]}
          />
        </Example>
      )),
    },
    'demand.backlog_penalty': {
      label: 'Backlog penalty',
      formula: () => <Formula>{'cost_backlog = backlog_penalty × units still owed at the end of the day'}</Formula>,
      effect: 'A higher penalty punishes running out of stock every day the customer waits.',
      example: live((p) => (
        <Example title="One unit waiting">
          <Table
            caption="Cost of one unit waiting"
            head={['Days waiting', 'Cost']}
            rows={p.prices.backlog_cost.map((r) => [String(r.days), formatMoney(r.cost)])}
          />
        </Example>
      )),
    },
    'reputation.starting': {
      label: 'Starting reputation',
      formula: () => <Formula>{'weight = 0.5 + reputation\nshare = weight ÷ Σ weights'}</Formula>,
      effect: "Sets everyone's opening share of demand; equal for all pulquerías.",
      example: live((p) => (
        <Example title="Day-1 shares with 4 equal pulquerías">
          <Table
            caption="Day-1 demand shares"
            head={['Pulquería', 'Share']}
            rows={p.reputation.starting_shares.map((r) => [r.alias, formatPercent(r.share)])}
          />
        </Example>
      )),
    },
    'reputation.smoothing': {
      label: 'Smoothing (ρ)',
      formula: () => <Formula>{'reputation ← (1 − ρ) × reputation + ρ × day score'}</Formula>,
      effect: 'A higher value makes reputation react faster to a good or bad day.',
      example: live((p) => {
        const values = p.reputation.clean_days
        return (
          <Example title="Seven clean days from the starting value">
            <LineChart
              title="Reputation over 7 clean days"
              labels={['Start', ...values.slice(1).map((_, i) => `Day ${i + 1}`)]}
              series={[{ label: 'Reputation', data: values, measure: 'sold' }]}
              xLabel="Day"
              yLabel="Reputation (0 to 1)"
              format={(v) => v.toFixed(2)}
            />
          </Example>
        )
      }),
    },
    'reputation.waste_weight': {
      label: 'Waste weight (w)',
      formula: () => <Formula>{'day score = (1 − w) × fill + w × (1 − waste)'}</Formula>,
      effect:
        "The share of the day's score that spoiled pulque decides; the rest is decided by serving what is owed. Above 0.5, spoilage hurts reputation more than backlog; below 0.5, backlog hurts it more.",
      example: live((p) => {
        const rows = p.reputation.day_scores
        const wastes = rows[0]?.scores.map((s) => s.waste) ?? []
        return (
          <Example title="Day score by fill and waste">
            <Table
              caption="Day score for sample fill and waste"
              head={['Fill', ...wastes.map((x) => `Waste ${formatPercent(x)}`)]}
              rows={rows.map((row) => [row.fill.toFixed(1), ...row.scores.map((s) => s.score.toFixed(2))])}
            />
          </Example>
        )
      }),
    },
    'supplier.base_price': {
      label: 'Base price',
      formula: spotFormula,
      effect: 'The futures price and the middle of the spot range; it sets the cost of every unit.',
      example: live(spotExample),
    },
    'supplier.spot_spread': {
      label: 'Spot spread',
      formula: spotFormula,
      effect: 'A wider spread makes spot prices swing more, which makes locking a price with futures more valuable.',
      example: live(spotExample),
    },
    'supplier.capacity_mean_per_player': {
      label: 'Capacity per player (mean)',
      formula: () => <Formula>{'capacity ~ Normal(mean × N, sd × N), rounded half up, never below 0'}</Formula>,
      effect: 'Less capacity makes short days common, and futures holders are served first on them.',
      example: live((p) => {
        const days = p.weekdays.days
        return (
          <Example>
            <BarChart
              title="Expected capacity and market demand per weekday"
              labels={days.map((d) => weekdayShort(d.weekday))}
              series={[
                { label: 'Expected capacity', data: days.map(() => p.supplier.expected_capacity), measure: 'delivered' },
                { label: 'Market demand', data: days.map((d) => d.market_demand), measure: 'demand' },
              ]}
              xLabel="Weekday"
              yLabel="Units"
              format={num}
            />
          </Example>
        )
      }),
    },
    'supplier.capacity_sd_per_player': {
      label: 'Capacity per player (sd)',
      formula: () => <Formula>{'about 95% of days fall within mean × N ± 1.96 × sd × N'}</Formula>,
      effect: 'A larger spread makes some days far shorter than others.',
      example: live((p) => {
        const band = p.supplier.capacity_band
        if (band === null) return hiddenExample()
        return (
          <Example>
            <P>{`About 95% of days the supplier can ship between ${num(band.low)} and ${num(band.high)} units.`}</P>
          </Example>
        )
      }),
    },
    'supplier.disruption_probability': {
      label: 'Disruption chance per day',
      formula: () => <Formula>{'chance of at least one disruption = 1 − (1 − p)^days'}</Formula>,
      effect: "Raises the chance that a day's capacity is cut.",
      example: live((p, cfg) => {
        const d = p.supplier.disruptions
        if (d === null) return hiddenExample()
        return (
          <Example>
            <List
              items={[
                `Chance of at least one disruption in ${cfg.duration_days} days: ${formatPercent(d.chance_any)}.`,
                `Expected disruptions: ${d.expected.toFixed(1)}.`,
              ]}
            />
          </Example>
        )
      }),
    },
    'supplier.disruption_factor': {
      label: 'Capacity on a disrupted day',
      formula: () => <Formula>{'disrupted capacity = round(capacity × disruption_factor)'}</Formula>,
      effect: 'The share of capacity left on a disrupted day; lower values hurt more.',
      example: live((p) => (
        <Example>
          <Table
            caption="Expected capacity"
            head={['Day', 'Expected capacity']}
            rows={[
              ['Normal day', num(p.supplier.expected_capacity)],
              ['Disrupted day', num(p.supplier.disrupted_capacity)],
            ]}
          />
        </Example>
      )),
    },
    'supplier.lead_time_days': {
      label: 'Lead time (days)',
      formula: () => <Formula>{'arrival day = order day + lead time\nspot orders close for the last (lead time) days of the game'}</Formula>,
      effect:
        'At 0 an order arrives the day it is placed and spot orders never close. Longer lead times force players to order further ahead of demand, and close spot orders for the last days of the game.',
      example: live((p) => {
        const lead = p.supplier.lead_time
        if (!p.supplier.initial_pipeline.used) {
          return (
            <Example>
              <P>An order placed on Monday (day 1) arrives the same day. Nothing is ever in transit, and spot orders stay open to the last day.</P>
            </Example>
          )
        }
        return (
          <Example>
            <List
              items={[
                `An order placed on Monday (day 1) arrives on ${weekdayLong(lead.arrival_weekday)} (day ${lead.arrival_day}).`,
                `Spot orders close after day ${lead.last_spot_day}: later ones would arrive after the game ends.`,
              ]}
            />
          </Example>
        )
      }),
    },
    'supplier.initial_pipeline_qty': {
      label: 'Initial pipeline (units per slot)',
      formula: () => <Formula>{'one free shipment arrives on each of days 1 … lead time'}</Formula>,
      effect: 'Free units already on their way at the start, so the first days are not empty. No effect with a lead time of 0.',
      example: live((p) => {
        const pipeline = p.supplier.initial_pipeline
        if (!pipeline.used) {
          return (
            <Example>
              <P>With a lead time of 0 there is no pipeline: orders arrive the day they are placed.</P>
            </Example>
          )
        }
        return (
          <Example>
            <Table
              caption="Initial pipeline arrivals"
              head={['Day', 'Units arriving']}
              rows={pipeline.arrivals.map((a) => [String(a.day), formatQty(a.units)])}
            />
          </Example>
        )
      }),
    },
    'supplier.quality_min': {
      label: 'Lowest initial quality',
      formula: qualityRangeFormula,
      effect:
        'A lower minimum lets some deliveries arrive closer to spoiling, so even a fresh lot can lose units on its first night.',
      example: live(qualityRangeExample),
    },
    'supplier.quality_max': {
      label: 'Highest initial quality',
      formula: qualityRangeFormula,
      effect:
        'The quality of the best deliveries, and of the initial stock and pipeline; at 100% a lot is safe through its fresh period.',
      example: live(qualityRangeExample),
    },
    'futures.horizon_days': {
      label: 'Futures horizon (days)',
      formula: () => <Formula>{'delivery day = contract day + H\nships on delivery day − lead time'}</Formula>,
      effect: 'How far ahead futures deliver; futures are served before spot on a short day.',
      example: live((p) => (
        <Example>
          <List
            items={[
              `A contract bought on day 1 is delivered on day ${p.supplier.futures.delivery_day}.`,
              `The last day to buy a contract that still delivers in the game is day ${p.supplier.futures.last_day_to_buy}.`,
            ]}
          />
        </Example>
      )),
    },
    'stock.fresh_days': {
      label: 'Fresh days',
      formula: stockFormula,
      effect: 'Nights a lot keeps its initial quality before its spoil risk starts to climb.',
      example: live(stockCurve),
    },
    'stock.max_days': {
      label: 'Max days',
      formula: stockFormula,
      effect:
        'The night a 100% lot is certain to be gone; after the fresh period its quality falls by an equal step each night.',
      example: live(stockCurve),
    },
    'stock.holding_cost': {
      label: 'Holding cost',
      formula: () => <Formula>{'cost_holding = holding_cost × units in the cellar at night'}</Formula>,
      effect: 'Charges every unit left in the cellar at night, so overstock costs money even before it spoils.',
      example: live((p) => (
        <Example>
          <P>{`Holding ${formatQty(p.stock.holding.units)} units for one night costs ${formatMoney(p.stock.holding.cost)}.`}</P>
        </Example>
      )),
    },
    'stock.initial_stock': {
      label: 'Initial stock',
      formula: () => <Formula>{'lot L0: initial stock units, age 0, at the highest initial quality'}</Formula>,
      effect: 'Free units in the cellar on day 1.',
      example: live((p, cfg) => (
        <Example title={`The ${formatQty(cfg.stock.initial_stock)} initial units`}>
          {lotTable([{ name: `Initial lot (${p.stock.highest_lot.initial_quality}%)`, lot: p.stock.highest_lot }])}
        </Example>
      )),
    },
    'stock.salvage_value': {
      label: 'Salvage price',
      formula: () => <Formula>{'revenue_salvage = salvage_value × spoiled units'}</Formula>,
      effect: 'What a spoiled or leftover unit returns; 0 means it returns nothing.',
      example: live((p) => (
        <Example>
          <P>{`${formatQty(p.stock.salvage.units)} spoiled units return ${formatMoney(p.stock.salvage.revenue)}.`}</P>
        </Example>
      )),
    },
    'stock.conservation_extra_fresh_days': {
      label: 'Conservation: extra fresh days',
      formula: () => <Formula>{'conserved lot: F + X and M + X nights, X = extra fresh days'}</Formula>,
      effect: 'How many more nights a conserved lot keeps its initial quality.',
      example: live((p) => (
        <Example title="Plain and conserved lot at the highest initial quality">
          {lotTable(p.stock.plain_vs_conserved.map((lot) => ({ name: ROLE_NAMES[lot.role], lot })))}
        </Example>
      )),
    },
    'stock.conservation_cost_per_unit': {
      label: 'Conservation cost per unit',
      formula: () => <Formula>{'cost_conservation = conservation_cost_per_unit × lot units'}</Formula>,
      effect: 'The price of keeping a lot fresh longer, charged on the whole lot.',
      example: live((p) => {
        const c = p.stock.conservation
        return (
          <Example>
            <List
              items={[
                `Conserving a ${formatQty(c.units)}-unit lot costs ${formatMoney(c.cost)}.`,
                `On the night its fresh period ends the spoil risk is ${pct(c.risk_after_fresh)}, so conserving saves about ${num(c.units_saved)} units that night.`,
              ]}
            />
          </Example>
        )
      }),
    },
    'peer_market.enabled': {
      label: 'Peer market',
      formula: () => (
        <Formula>
          {'buyers in order of highest max price, then larger shortfall\nfor each buyer: highest quality first, then cheapest, within max price, min quality and cash\nevery trade is at the seller\'s price'}
        </Formula>
      ),
      effect:
        'When on, a pulquería the supplier leaves short can buy the missing units from rivals within its price, quality and cash, and any pulquería can offer spare stock at its own price.',
      example: live((p) => (
        <Example title="Trades on day 5 of the spec example">
          <Table
            caption="Peer trades"
            head={['Buyer', 'Seller', 'Seller lot', 'Units', 'Price', 'Total']}
            rows={p.examples.peer_trades.map((t) => [
              t.buyer,
              t.seller,
              t.seller_lot,
              formatQty(t.units),
              formatMoney(t.price),
              formatMoney(t.total),
            ])}
          />
          <P>P1 buys first because it caps higher, and takes the higher quality before the cheaper price.</P>
          <P>The quality guide for a purchase on day 1, with the current fresh and max days:</P>
          <List items={p.stock.quality_guide.map((row) => formatQualityGuide(row, 1))} />
          <Note>{QUALITY_GUIDE_NOTE}</Note>
        </Example>
      )),
    },
    'transport.unit_cost': {
      label: 'Transport cost per unit',
      formula: () => <Formula>{'cost_transport = unit_cost × units shipped'}</Formula>,
      effect: 'Charged on every unit shipped, lost units included.',
      example: live((p) => (
        <Example>
          <P>{`Shipping ${formatQty(p.transport.shipping.units)} units costs ${formatMoney(p.transport.shipping.cost)}.`}</P>
        </Example>
      )),
    },
    'transport.shared': {
      label: 'Shared transport',
      formula: () => <Formula>{'lost = floor(shipped × L) alone\nlost = floor(shipped × L ÷ N) shared'}</Formula>,
      effect: "When on, a refrigeration failure's loss is split across everyone who shipped that day.",
      example: live((p) => <Example title="Shipments of 60, 30 and 10 units">{lossTable(p)}</Example>),
    },
    'transport.failure_probability': {
      label: 'Refrigeration failure chance per day',
      formula: () => <Formula>{'chance of at least one failure = 1 − (1 − p)^days\nexpected failures = p × days'}</Formula>,
      effect: "Raises the chance that a day's shipments lose units.",
      example: live((p, cfg) => {
        const f = p.transport.failures
        if (f === null) return hiddenExample()
        return (
          <Example>
            <List
              items={[
                `Chance of at least one failure in ${cfg.duration_days} days: ${formatPercent(f.chance_any)}.`,
                `Expected failures: ${f.expected.toFixed(1)}.`,
              ]}
            />
          </Example>
        )
      }),
    },
    'transport.loss_fraction': {
      label: 'Share of a shipment lost in a failure',
      formula: () => <Formula>{'lost = floor(shipped × L)  (floor(x + 1e-9))'}</Formula>,
      effect: 'How much of a shipment a failure destroys.',
      example: live((p, cfg) => {
        const loss = p.transport.loss_example
        if (loss === null) return hiddenExample()
        return (
          <Example title={`A ${formatQty(loss.units)}-unit shipment`}>
            <Table
              caption={`Units lost from a ${formatQty(loss.units)}-unit shipment`}
              head={['', 'Units lost']}
              rows={[
                ['Alone', String(loss.alone)],
                [`Shared (N = ${cfg.max_players})`, String(loss.shared)],
              ]}
            />
          </Example>
        )
      }),
    },
    ...tierEntries(),
    'insurance.target_margin': {
      label: 'Target margin',
      formula: () => <Formula>{'fee = round_cents(break-even fee × (1 + target margin))'}</Formula>,
      effect: (
        <>
          The margin <strong>Set fees from margin</strong> adds over the break-even fee.
        </>
      ),
      example: live((p) => {
        if (!p.calculator.known) return hiddenExample()
        return (
          <Example title="Fees from margin">
            <Table
              caption="Fees from margin"
              head={['Insurance', 'Break-even fee', 'Fee from margin']}
              rows={p.calculator.tiers.flatMap((t) =>
                t.current === null ? [] : [[INCOTERM_TIER_NAMES[t.tier], formatMoney(t.current.break_even), formatMoney(t.current.fee_from_margin)]],
              )}
            />
          </Example>
        )
      }),
    },
    'insurance.reference_shipment': {
      label: 'Reference shipment (units)',
      formula: () => <Formula>{'lost units = floor(reference shipment × L_eff)'}</Formula>,
      effect: 'The typical shipment the calculator uses; small shipments can lose 0 units to rounding.',
      example: live((p, cfg) => {
        const loss = p.transport.reference_losses
        if (loss === null) return hiddenExample()
        return (
          <Example>
            <Table
              caption={`Units lost from a ${loss.units}-unit shipment`}
              head={['', 'Units lost']}
              rows={[
                ['Not shared', String(loss.alone)],
                [`Shared (N = ${cfg.max_players})`, String(loss.shared)],
              ]}
            />
          </Example>
        )
      }),
    },
    'topic.allocation': {
      label: 'Allocation',
      formula: () => (
        <Formula>
          {'largest order first: orders filled from the largest down until capacity runs out\ncooperative: equal fill rate = capacity ÷ total orders, leftovers to the largest remainders'}
        </Formula>
      ),
      effect:
        'When supply is short, spot capacity goes to the largest order first, unless every pulquería votes to cooperate.',
      example: live((p) => {
        const a = p.examples.allocation
        const aliases = Object.keys(a.orders)
        const orders = aliases.map((x) => String(a.orders[x])).join(', ').replace(/, (\d+)$/, ' and $1')
        return (
          <Example title={`Capacity ${a.capacity} left for spot orders of ${orders}`}>
            <Table
              caption="Spot allocation, both modes"
              head={['', ...aliases]}
              rows={[
                ['Orders', ...aliases.map((x) => String(a.orders[x]))],
                ['Largest order first', ...aliases.map((x) => String(a.largest_first[x]))],
                ['Cooperative (equal fill rate)', ...aliases.map((x) => String(a.cooperative[x]))],
              ]}
            />
          </Example>
        )
      }),
    },
    'topic.what_players_see': {
      label: 'What players see',
      formula: () => (
        <Formula>{'config_public = the five shown keys only\nsecret keys appear in no player payload'}</Formula>
      ),
      effect:
        "Players see five settings: the retail price, the transport cost per unit, the conservation cost and its extra nights, and whether the peer market is on. They learn the rest by playing, from the brief, their cellar and their ledger, and never see the seed or the risk odds. The risk odds' defaults are hidden from hosts too: their fields read Default (hidden) until the game ends, and the results reveal them.",
      example: () => (
        <Example>
          <P>Shown to players:</P>
          <List items={PLAYER_CONFIG_KEYS.map(keyListItem)} />
          <P>Secret, never sent to players:</P>
          <List items={SECRET_CONFIG_KEYS.map(keyListItem)} />
        </Example>
      ),
    },
  }
  return entries
}

export const DOCS: Record<string, HelpEntry> = build()
