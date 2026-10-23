import type { ReactNode } from 'react'
import {
  breakEvenFee,
  chanceOfAtLeastOneFailure,
  expectedFailures,
  feeFromMargin,
  marketLambda,
  quality,
  qualityGuide,
  qualityStepPerNight,
  ratioBadge,
  reputationStep,
  shares,
  spotRange,
  weekdayMultipliers,
  worstSingleFailureLoss,
  type BreakEvenInput,
  type RatioBadge,
} from '../../../game/configMath'
import {
  INSURED_TIERS,
  PLAYER_CONFIG_KEYS,
  SECRET_CONFIG_KEYS,
  WEEKDAYS,
  type GameConfig,
  type InsuredTier,
  type Weekday,
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
import { BarChart, Example, Formula, LineChart, List, Note, P, Table } from './primitives'

export interface HelpEntry {
  label: string
  formula(cfg: GameConfig): ReactNode
  effect: ReactNode
  example(cfg: GameConfig): ReactNode
}

const WEEKDAY_LABELS = WEEKDAYS.map(weekdayShort)

/** A quantity with one decimal only when it is not whole. */
function num(value: number): string {
  return Number.isInteger(value) ? formatQty(value) : value.toFixed(1)
}

function peak(cfg: GameConfig): Record<Weekday, number> {
  return weekdayMultipliers(cfg.demand.weekday_peak.from, cfg.demand.weekday_peak.to)
}

function marketDemandByDay(cfg: GameConfig, seats: number): number[] {
  const m = peak(cfg)
  return WEEKDAYS.map((d) => marketLambda(cfg.demand.per_player_peak, seats, m[d]))
}

function averageMultiplier(cfg: GameConfig): number {
  const m = peak(cfg)
  return WEEKDAYS.reduce((sum, d) => sum + m[d], 0) / 7
}

function breakEvenInput(cfg: GameConfig, shared: boolean): BreakEvenInput {
  return {
    failureProbability: cfg.transport.failure_probability,
    lossFraction: cfg.transport.loss_fraction,
    shared,
    nRef: cfg.max_players,
    referenceShipment: cfg.insurance.reference_shipment,
    basePrice: cfg.supplier.base_price,
    retailPrice: cfg.demand.retail_price,
  }
}

/** Quality and spoil risk at the check of night `n` (1 = the first night after delivery). */
function qualityAtNight(n: number, q0: number, fresh: number, max: number): number {
  return quality(n - 1, fresh, max, q0)
}

function riskAtNight(n: number, q0: number, fresh: number, max: number): number {
  return 100 - qualityAtNight(n, q0, fresh, max)
}

function pct(whole: number): string {
  return `${whole}%`
}

interface LotSpec {
  name: string
  q0: number
  fresh: number
  max: number
}

/** Two rows per lot (quality, spoil risk), one column per night. */
function lotTable(lots: LotSpec[]): ReactNode {
  const nights = Math.max(...lots.map((l) => l.max))
  const range = Array.from({ length: nights }, (_, i) => i + 1)
  const cell = (n: number, l: LotSpec, f: (n: number, q0: number, fr: number, mx: number) => number): string =>
    n <= l.max ? pct(f(n, l.q0, l.fresh, l.max)) : '—'
  return (
    <Table
      caption="Quality and spoil risk night by night"
      head={['Lot', ...range.map((n) => `Night ${n}`)]}
      rows={lots.flatMap((l) => [
        [`${l.name}: quality`, ...range.map((n) => cell(n, l, qualityAtNight))],
        [`${l.name}: spoil risk`, ...range.map((n) => cell(n, l, riskAtNight))],
      ])}
    />
  )
}

function middleQuality(cfg: GameConfig): number {
  return Math.floor((cfg.supplier.quality_min + cfg.supplier.quality_max) / 2 + 0.5)
}

function qualityRangeExample(cfg: GameConfig): ReactNode {
  const { fresh_days: fresh, max_days: max } = cfg.stock
  const lots: LotSpec[] = [
    { name: `Lowest (${cfg.supplier.quality_min}%)`, q0: cfg.supplier.quality_min, fresh, max },
    { name: `Middle (${middleQuality(cfg)}%)`, q0: middleQuality(cfg), fresh, max },
    { name: `Highest (${cfg.supplier.quality_max}%)`, q0: cfg.supplier.quality_max, fresh, max },
  ]
  return (
    <Example title="A lot arriving at the lowest, middle and highest quality of the range">{lotTable(lots)}</Example>
  )
}

function qualityRangeFormula(): ReactNode {
  return (
    <Formula>
      {'spoil risk at night n = min(1, (1 − q₀) + k ÷ (M − F))\nk = max(0, n − F) nights past the fresh period; q₀ = initial quality'}
    </Formula>
  )
}

function stockCurve(cfg: GameConfig): ReactNode {
  const { fresh_days: fresh, max_days: max } = cfg.stock
  const q0 = cfg.supplier.quality_max
  const nights = Array.from({ length: max }, (_, i) => i + 1)
  const step = qualityStepPerNight(fresh, max)
  return (
    <>
      <P>
        {`A lot arriving at ${q0}% keeps that quality for ${fresh} ${fresh === 1 ? 'night' : 'nights'}, then loses ${num(Math.round(step * 10) / 10)} quality points a night.`}
      </P>
      <Table
        caption="Spoil risk and quality for a lot at the highest initial quality"
        head={['Night', 'Spoil risk', 'Quality']}
        rows={nights.map((n) => [
          String(n),
          pct(riskAtNight(n, q0, fresh, max)),
          pct(qualityAtNight(n, q0, fresh, max)),
        ])}
      />
      <LineChart
        title="Spoil risk and quality by night"
        labels={nights.map((n) => `Night ${n}`)}
        series={[
          { label: 'Spoil risk (%)', data: nights.map((n) => riskAtNight(n, q0, fresh, max)), measure: 'spoiled' },
          { label: 'Quality (%)', data: nights.map((n) => qualityAtNight(n, q0, fresh, max)), measure: 'sold' },
        ]}
        xLabel="Night"
        yLabel="Percent"
        format={(v) => pct(v)}
      />
    </>
  )
}

function stockFormula(): ReactNode {
  return (
    <Formula>
      {'spoil risk = min(1, (1 − q₀) + max(0, age − F) ÷ (M − F))\nquality points lost per night after the fresh period = 100 ÷ (M − F)'}
    </Formula>
  )
}

function spotExample(cfg: GameConfig): ReactNode {
  const [low, high] = spotRange(cfg.supplier.base_price, cfg.supplier.spot_spread)
  return (
    <Example title="The spot range">
      <List
        items={[
          `Spot prices run from ${formatMoney(low)} to ${formatMoney(high)} around the base price of ${formatMoney(cfg.supplier.base_price)}.`,
          'The spot price is above the base price on 50% of days and below it on the other 50%.',
        ]}
      />
    </Example>
  )
}

function spotFormula(): ReactNode {
  return <Formula>{'spot price = base_price × (1 + U(−spread, +spread))'}</Formula>
}

function weekdayBars(cfg: GameConfig): ReactNode {
  const m = peak(cfg)
  return (
    <Example>
      <BarChart
        title="Demand multiplier by weekday"
        labels={WEEKDAY_LABELS}
        series={[{ label: 'Multiplier', data: WEEKDAYS.map((d) => m[d]), measure: 'demand' }]}
        xLabel="Weekday"
        yLabel="Multiplier (0 to 1)"
        format={(v) => v.toFixed(2)}
      />
    </Example>
  )
}

function weekdayFormula(cfg: GameConfig): ReactNode {
  const f = WEEKDAYS.indexOf(cfg.demand.weekday_peak.from) + 1
  const t = WEEKDAYS.indexOf(cfg.demand.weekday_peak.to) + 1
  const reach = Math.max(f - 1, 7 - t) + 1
  return (
    <Formula>
      {`multiplier = 1 − dist ÷ reach\ndist = 0 inside the window, else the days to its nearest edge (no wrap-around)\nreach = max(from − 1, 7 − to) + 1 = ${reach}, so each day away from the window loses 1 ÷ ${reach}`}
    </Formula>
  )
}

function tierRows(cfg: GameConfig, tier: InsuredTier): ReactNode {
  const fee = cfg.insurance.tiers[tier].fee
  const columns = [false, true].map((shared) => {
    const input = breakEvenInput(cfg, shared)
    const be = breakEvenFee(tier, input)
    const badge: RatioBadge = ratioBadge(fee, be)
    return { input, be, badge }
  })
  const BADGES: Record<RatioBadge, string> = {
    worth_it: 'Worth it',
    break_even: 'Break-even',
    not_worth_it: 'Not worth it on average',
    no_risk: 'No risk configured',
  }
  return (
    <Table
      caption={`Calculator row for ${INCOTERM_TIER_NAMES[tier]}`}
      head={['', 'Not shared', `Shared (N = ${cfg.max_players})`]}
      rows={[
        ['Break-even fee', ...columns.map((c) => formatMoney(c.be))],
        ['Fee per unit', ...columns.map(() => formatMoney(fee))],
        [
          'Ratio',
          ...columns.map((c) => (c.be > 0 ? (fee / c.be).toFixed(2) : '—')),
        ],
        ['Verdict', ...columns.map((c) => BADGES[c.badge])],
        [
          'Refund per lost unit',
          ...columns.map((c) => formatMoney(tier === 'ddp' ? c.input.retailPrice : c.input.basePrice)),
        ],
        ['Worst single-failure loss', ...columns.map((c) => formatMoney(worstSingleFailureLoss(tier, c.input)))],
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

function tierExample(tier: InsuredTier): (cfg: GameConfig) => ReactNode {
  return (cfg) => <Example title={`The calculator row for ${INCOTERM_TIER_NAMES[tier]}`}>{tierRows(cfg, tier)}</Example>
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

function lostUnitsFor(shipment: number, fraction: number): number {
  return Math.floor(shipment * fraction + 1e-9)
}

function lossTable(cfg: GameConfig): ReactNode {
  const ships = [60, 30, 10]
  const n = ships.length
  const solo = ships.map((s) => lostUnitsFor(s, cfg.transport.loss_fraction))
  const shared = ships.map((s) => lostUnitsFor(s, cfg.transport.loss_fraction / n))
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0)
  return (
    <Table
      caption="Units lost in a failure, solo and shared"
      head={['', ...ships.map((s, i) => `P${i + 1} (${s})`), 'Total lost']}
      rows={[
        ['Not shared', ...solo.map(String), String(sum(solo))],
        [
          `Shared (N = ${n}, ${formatPercent(cfg.transport.loss_fraction / n)} each)`,
          ...shared.map(String),
          String(sum(shared)),
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
      example: (cfg) => {
        const seats = [...new Set([2, 4, cfg.max_players])].sort((a, b) => a - b)
        return (
          <Example title="Market demand on a peak day">
            <Table
              caption="Market demand on a peak day by seats"
              head={['Seats', 'Units']}
              rows={seats.map((n) => [String(n), num(marketLambda(cfg.demand.per_player_peak, n, 1))])}
            />
          </Example>
        )
      },
    },
    duration_days: {
      label: 'Days',
      formula: () => <Formula>{'weekday of day d = (d − 1) mod 7, counting from Monday\nday 1 is always a Monday'}</Formula>,
      effect: 'Longer games cover more weekly cycles and give futures time to pay off.',
      example: (cfg) => {
        const last = WEEKDAYS[(cfg.duration_days - 1) % 7]
        return (
          <Example>
            <List
              items={[
                `${cfg.duration_days} days cover ${(cfg.duration_days / 7).toFixed(1)} weekly cycles.`,
                `Day 1 is a Monday; day ${cfg.duration_days}, the last, is a ${weekdayLong(last)}.`,
              ]}
            />
          </Example>
        )
      },
    },
    starting_cash: {
      label: 'Starting cash',
      formula: () => <Formula>{'days covered = starting_cash ÷ (expected own demand per day × base_price)'}</Formula>,
      effect: 'Less cash forces smaller orders and makes futures, which are paid up front, harder to afford.',
      example: (cfg) => {
        const demand = cfg.demand.per_player_peak * averageMultiplier(cfg)
        const perDay = demand * cfg.supplier.base_price
        const days = perDay > 0 ? cfg.starting_cash / perDay : 0
        return (
          <Example>
            <List
              items={[
                `Expected own demand averages ${demand.toFixed(1)} units a day over a week.`,
                `Buying that on the spot at the base price costs ${formatMoney(perDay)} a day.`,
                `${formatMoney(cfg.starting_cash)} covers ${days.toFixed(1)} days.`,
              ]}
            />
          </Example>
        )
      },
    },
    'demand.per_player_peak': {
      label: 'Demand per player on a peak day (λ)',
      formula: (cfg) => (
        <Formula>{`λ_d = ${cfg.demand.per_player_peak} × N × weekday_multiplier_d\neach pulquería gets its reputation share of λ_d`}</Formula>
      ),
      effect: "Raises or lowers every day's demand in proportion; the weekday shape stays the same.",
      example: (cfg) => (
        <Example>
          <BarChart
            title={`Market demand per weekday for ${cfg.max_players} seats`}
            labels={WEEKDAY_LABELS}
            series={[{ label: 'Market demand', data: marketDemandByDay(cfg, cfg.max_players), measure: 'demand' }]}
            xLabel="Weekday"
            yLabel="Units"
            format={num}
          />
        </Example>
      ),
    },
    'demand.weekday_peak.from': {
      label: 'Peak starts',
      formula: weekdayFormula,
      effect: 'Moves the start of the busy days; demand steps down equally on each side of the window.',
      example: weekdayBars,
    },
    'demand.weekday_peak.to': {
      label: 'Peak ends',
      formula: weekdayFormula,
      effect: 'Moves the end of the busy days; a full-week window removes the weekday effect.',
      example: weekdayBars,
    },
    'demand.retail_price': {
      label: 'Retail price',
      formula: () => <Formula>{'margin per unit = retail_price − price paid for the unit'}</Formula>,
      effect: 'A higher price widens the margin on every unit and makes backlog and spoilage costlier by comparison.',
      example: (cfg) => {
        const [low, high] = spotRange(cfg.supplier.base_price, cfg.supplier.spot_spread)
        return (
          <Example>
            <Table
              caption="Margin per unit across the spot range"
              head={['Spot price', 'Margin per unit']}
              rows={[
                [`${formatMoney(low)} (cheapest)`, formatMoney(cfg.demand.retail_price - low)],
                [`${formatMoney(high)} (dearest)`, formatMoney(cfg.demand.retail_price - high)],
              ]}
            />
          </Example>
        )
      },
    },
    'demand.backlog_penalty': {
      label: 'Backlog penalty',
      formula: () => <Formula>{'cost_backlog = backlog_penalty × units still owed at the end of the day'}</Formula>,
      effect: 'A higher penalty punishes running out of stock every day the customer waits.',
      example: (cfg) => (
        <Example title="One unit waiting">
          <Table
            caption="Cost of one unit waiting"
            head={['Days waiting', 'Cost']}
            rows={[1, 3, 7].map((n) => [String(n), formatMoney(cfg.demand.backlog_penalty * n)])}
          />
        </Example>
      ),
    },
    'reputation.starting': {
      label: 'Starting reputation',
      formula: () => <Formula>{'weight = 0.5 + reputation\nshare = weight ÷ Σ weights'}</Formula>,
      effect: "Sets everyone's opening share of demand; equal for all pulquerías.",
      example: (cfg) => {
        const aliases = ['P1', 'P2', 'P3', 'P4']
        const s = shares(Object.fromEntries(aliases.map((a) => [a, cfg.reputation.starting])))
        return (
          <Example title="Day-1 shares with 4 equal pulquerías">
            <Table
              caption="Day-1 demand shares"
              head={['Pulquería', 'Share']}
              rows={aliases.map((a) => [a, formatPercent(s[a])])}
            />
          </Example>
        )
      },
    },
    'reputation.smoothing': {
      label: 'Smoothing (ρ)',
      formula: () => <Formula>{'reputation ← (1 − ρ) × reputation + ρ × day score'}</Formula>,
      effect: 'A higher value makes reputation react faster to a good or bad day.',
      example: (cfg) => {
        const values = [cfg.reputation.starting]
        for (let d = 1; d <= 7; d++) {
          values.push(reputationStep(values[d - 1], 1, 0, cfg.reputation.smoothing, cfg.reputation.waste_weight))
        }
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
      },
    },
    'reputation.waste_weight': {
      label: 'Waste weight (w)',
      formula: () => <Formula>{'day score = (1 − w) × fill + w × (1 − waste)'}</Formula>,
      effect: 'A higher weight makes spoiled pulque hurt reputation more than backlog does.',
      example: (cfg) => {
        const w = cfg.reputation.waste_weight
        const wastes = [0, 0.2, 0.5]
        return (
          <Example title="Day score by fill and waste">
            <Table
              caption="Day score for sample fill and waste"
              head={['Fill', ...wastes.map((x) => `Waste ${formatPercent(x)}`)]}
              rows={[1, 0.8, 0.5].map((fill) => [
                fill.toFixed(1),
                ...wastes.map((waste) => ((1 - w) * fill + w * (1 - waste)).toFixed(2)),
              ])}
            />
          </Example>
        )
      },
    },
    'supplier.base_price': {
      label: 'Base price',
      formula: spotFormula,
      effect: 'The futures price and the middle of the spot range; it sets the cost of every unit.',
      example: spotExample,
    },
    'supplier.spot_spread': {
      label: 'Spot spread',
      formula: spotFormula,
      effect: 'A wider spread makes spot prices swing more, which makes locking a price with futures more valuable.',
      example: spotExample,
    },
    'supplier.capacity_mean_per_player': {
      label: 'Capacity per player (mean)',
      formula: () => <Formula>{'capacity ~ Normal(mean × N, sd × N), rounded half up, never below 0'}</Formula>,
      effect: 'Less capacity makes short days common, and futures holders are served first on them.',
      example: (cfg) => {
        const capacity = cfg.supplier.capacity_mean_per_player * cfg.max_players
        const demand = marketDemandByDay(cfg, cfg.max_players)
        return (
          <Example>
            <BarChart
              title="Expected capacity and market demand per weekday"
              labels={WEEKDAY_LABELS}
              series={[
                { label: 'Expected capacity', data: WEEKDAYS.map(() => capacity), measure: 'delivered' },
                { label: 'Market demand', data: demand, measure: 'demand' },
              ]}
              xLabel="Weekday"
              yLabel="Units"
              format={num}
            />
          </Example>
        )
      },
    },
    'supplier.capacity_sd_per_player': {
      label: 'Capacity per player (sd)',
      formula: () => <Formula>{'about 95% of days fall within mean × N ± 1.96 × sd × N'}</Formula>,
      effect: 'A larger spread makes some days far shorter than others.',
      example: (cfg) => {
        const mean = cfg.supplier.capacity_mean_per_player * cfg.max_players
        const spread = 1.96 * cfg.supplier.capacity_sd_per_player * cfg.max_players
        return (
          <Example>
            <P>{`About 95% of days the supplier can ship between ${num(Math.max(0, Math.round(mean - spread)))} and ${num(Math.round(mean + spread))} units.`}</P>
          </Example>
        )
      },
    },
    'supplier.disruption_probability': {
      label: 'Disruption chance per day',
      formula: () => <Formula>{'chance of at least one disruption = 1 − (1 − p)^days'}</Formula>,
      effect: "Raises the chance that a day's capacity is cut.",
      example: (cfg) => (
        <Example>
          <List
            items={[
              `Chance of at least one disruption in ${cfg.duration_days} days: ${formatPercent(chanceOfAtLeastOneFailure(cfg.supplier.disruption_probability, cfg.duration_days))}.`,
              `Expected disruptions: ${expectedFailures(cfg.supplier.disruption_probability, cfg.duration_days).toFixed(1)}.`,
            ]}
          />
        </Example>
      ),
    },
    'supplier.disruption_factor': {
      label: 'Capacity on a disrupted day',
      formula: () => <Formula>{'disrupted capacity = round(capacity × disruption_factor)'}</Formula>,
      effect: 'The share of capacity left on a disrupted day; lower values hurt more.',
      example: (cfg) => {
        const normal = cfg.supplier.capacity_mean_per_player * cfg.max_players
        return (
          <Example>
            <Table
              caption="Expected capacity"
              head={['Day', 'Expected capacity']}
              rows={[
                ['Normal day', num(normal)],
                ['Disrupted day', num(normal * cfg.supplier.disruption_factor)],
              ]}
            />
          </Example>
        )
      },
    },
    'supplier.lead_time_days': {
      label: 'Lead time (days)',
      formula: () => <Formula>{'arrival day = order day + lead time'}</Formula>,
      effect: 'Longer lead times force players to order further ahead of demand.',
      example: (cfg) => {
        const arrival = WEEKDAYS[cfg.supplier.lead_time_days % 7]
        return (
          <Example>
            <P>{`An order placed on Monday (day 1) arrives on ${weekdayLong(arrival)} (day ${1 + cfg.supplier.lead_time_days}).`}</P>
          </Example>
        )
      },
    },
    'supplier.initial_pipeline_qty': {
      label: 'Initial pipeline (units per slot)',
      formula: () => <Formula>{'one free shipment arrives on each of days 1 … lead time'}</Formula>,
      effect: 'Free units already on their way at the start, so day 1 is not empty.',
      example: (cfg) => {
        const l = cfg.supplier.lead_time_days
        if (l === 0) {
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
              rows={Array.from({ length: l }, (_, i) => [String(i + 1), formatQty(cfg.supplier.initial_pipeline_qty)])}
            />
          </Example>
        )
      },
    },
    'supplier.quality_min': {
      label: 'Lowest initial quality',
      formula: qualityRangeFormula,
      effect:
        'A lower minimum lets some deliveries arrive closer to spoiling, so even a fresh lot can lose units on its first night.',
      example: qualityRangeExample,
    },
    'supplier.quality_max': {
      label: 'Highest initial quality',
      formula: qualityRangeFormula,
      effect:
        'The quality of the best deliveries, and of the initial stock and pipeline; at 100% a lot is safe through its fresh period.',
      example: qualityRangeExample,
    },
    'futures.horizon_days': {
      label: 'Futures horizon (days)',
      formula: () => <Formula>{'delivery day = contract day + H\nships on delivery day − lead time'}</Formula>,
      effect: 'How far ahead futures deliver; futures are served before spot on a short day.',
      example: (cfg) => (
        <Example>
          <List
            items={[
              `A contract bought on day 1 is delivered on day ${1 + cfg.futures.horizon_days}.`,
              `The last day to buy a contract that still delivers in the game is day ${cfg.duration_days - cfg.futures.horizon_days}.`,
            ]}
          />
        </Example>
      ),
    },
    'stock.fresh_days': {
      label: 'Fresh days',
      formula: stockFormula,
      effect: 'Nights a lot keeps its initial quality before its spoil risk starts to climb.',
      example: (cfg) => <Example>{stockCurve(cfg)}</Example>,
    },
    'stock.max_days': {
      label: 'Max days',
      formula: stockFormula,
      effect:
        'The night a 100% lot is certain to be gone; after the fresh period its quality falls by an equal step each night.',
      example: (cfg) => <Example>{stockCurve(cfg)}</Example>,
    },
    'stock.holding_cost': {
      label: 'Holding cost',
      formula: () => <Formula>{'cost_holding = holding_cost × units in the cellar at night'}</Formula>,
      effect: 'Charges every unit left in the cellar at night, so overstock costs money even before it spoils.',
      example: (cfg) => (
        <Example>
          <P>{`Holding 50 units for one night costs ${formatMoney(50 * cfg.stock.holding_cost)}.`}</P>
        </Example>
      ),
    },
    'stock.initial_stock': {
      label: 'Initial stock',
      formula: () => <Formula>{'lot L0: initial stock units, age 0, at the highest initial quality'}</Formula>,
      effect: 'Free units in the cellar on day 1.',
      example: (cfg) => (
        <Example title={`The ${formatQty(cfg.stock.initial_stock)} initial units`}>
          {lotTable([
            {
              name: `Initial lot (${cfg.supplier.quality_max}%)`,
              q0: cfg.supplier.quality_max,
              fresh: cfg.stock.fresh_days,
              max: cfg.stock.max_days,
            },
          ])}
        </Example>
      ),
    },
    'stock.salvage_value': {
      label: 'Salvage price',
      formula: () => <Formula>{'revenue_salvage = salvage_value × spoiled units'}</Formula>,
      effect: 'What a spoiled or leftover unit returns; 0 means it returns nothing.',
      example: (cfg) => (
        <Example>
          <P>{`10 spoiled units return ${formatMoney(10 * cfg.stock.salvage_value)}.`}</P>
        </Example>
      ),
    },
    'stock.conservation_extra_fresh_days': {
      label: 'Conservation: extra fresh days',
      formula: () => <Formula>{'conserved lot: F + X and M + X nights, X = extra fresh days'}</Formula>,
      effect: 'How many more nights a conserved lot keeps its initial quality.',
      example: (cfg) => {
        const x = cfg.stock.conservation_extra_fresh_days
        const q0 = cfg.supplier.quality_max
        return (
          <Example title="Plain and conserved lot at the highest initial quality">
            {lotTable([
              { name: 'Plain', q0, fresh: cfg.stock.fresh_days, max: cfg.stock.max_days },
              { name: 'Conserved', q0, fresh: cfg.stock.fresh_days + x, max: cfg.stock.max_days + x },
            ])}
          </Example>
        )
      },
    },
    'stock.conservation_cost_per_unit': {
      label: 'Conservation cost per unit',
      formula: () => <Formula>{'cost_conservation = conservation_cost_per_unit × lot units'}</Formula>,
      effect: 'The price of keeping a lot fresh longer, charged on the whole lot.',
      example: (cfg) => {
        const tonight = riskAtNight(cfg.stock.fresh_days + 1, cfg.supplier.quality_max, cfg.stock.fresh_days, cfg.stock.max_days)
        return (
          <Example>
            <List
              items={[
                `Conserving a 30-unit lot costs ${formatMoney(30 * cfg.stock.conservation_cost_per_unit)}.`,
                `On the night its fresh period ends the spoil risk is ${pct(tonight)}, so conserving saves about ${num((30 * tonight) / 100)} units that night.`,
              ]}
            />
          </Example>
        )
      },
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
      example: (cfg) => {
        const guide = qualityGuide(1, cfg.stock.fresh_days, cfg.stock.max_days)
        return (
          <Example title="Trades on day 5 of the spec example">
            <Table
              caption="Peer trades"
              head={['Buyer', 'Seller', 'Seller lot', 'Units', 'Price', 'Total']}
              rows={[
                ['P1', 'P3', 'L4', '10', formatMoney(15), formatMoney(150)],
                ['P1', 'P4', 'L4', '6', formatMoney(13), formatMoney(78)],
                ['P2', 'P4', 'L4', '2', formatMoney(13), formatMoney(26)],
              ]}
            />
            <P>P1 buys first because it caps higher, and takes the higher quality before the cheaper price.</P>
            <P>The quality guide for a purchase on day 1, with the current fresh and max days:</P>
            <List items={guide.map((row) => formatQualityGuide(row, 1))} />
            <Note>{QUALITY_GUIDE_NOTE}</Note>
          </Example>
        )
      },
    },
    'transport.unit_cost': {
      label: 'Transport cost per unit',
      formula: () => <Formula>{'cost_transport = unit_cost × units shipped'}</Formula>,
      effect: 'Charged on every unit shipped, lost units included.',
      example: (cfg) => (
        <Example>
          <P>{`Shipping 40 units costs ${formatMoney(40 * cfg.transport.unit_cost)}.`}</P>
        </Example>
      ),
    },
    'transport.shared': {
      label: 'Shared transport',
      formula: () => <Formula>{'lost = floor(shipped × L) alone\nlost = floor(shipped × L ÷ N) shared'}</Formula>,
      effect: "When on, a refrigeration failure's loss is split across everyone who shipped that day.",
      example: (cfg) => <Example title="Shipments of 60, 30 and 10 units">{lossTable(cfg)}</Example>,
    },
    'transport.failure_probability': {
      label: 'Refrigeration failure chance per day',
      formula: () => <Formula>{'chance of at least one failure = 1 − (1 − p)^days\nexpected failures = p × days'}</Formula>,
      effect: "Raises the chance that a day's shipments lose units.",
      example: (cfg) => (
        <Example>
          <List
            items={[
              `Chance of at least one failure in ${cfg.duration_days} days: ${formatPercent(chanceOfAtLeastOneFailure(cfg.transport.failure_probability, cfg.duration_days))}.`,
              `Expected failures: ${expectedFailures(cfg.transport.failure_probability, cfg.duration_days).toFixed(1)}.`,
            ]}
          />
        </Example>
      ),
    },
    'transport.loss_fraction': {
      label: 'Share of a shipment lost in a failure',
      formula: () => <Formula>{'lost = floor(shipped × L)  (floor(x + 1e-9))'}</Formula>,
      effect: 'How much of a shipment a failure destroys.',
      example: (cfg) => (
        <Example title="A 20-unit shipment">
          <Table
            caption="Units lost from a 20-unit shipment"
            head={['', 'Units lost']}
            rows={[
              ['Alone', String(lostUnitsFor(20, cfg.transport.loss_fraction))],
              [`Shared (N = ${cfg.max_players})`, String(lostUnitsFor(20, cfg.transport.loss_fraction / cfg.max_players))],
            ]}
          />
        </Example>
      ),
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
      example: (cfg) => {
        const input = breakEvenInput(cfg, cfg.transport.shared)
        return (
          <Example title="Fees from margin">
            <Table
              caption="Fees from margin"
              head={['Insurance', 'Break-even fee', 'Fee from margin']}
              rows={INSURED_TIERS.map((tier) => {
                const be = breakEvenFee(tier, input)
                return [INCOTERM_TIER_NAMES[tier], formatMoney(be), formatMoney(feeFromMargin(be, cfg.insurance.target_margin))]
              })}
            />
          </Example>
        )
      },
    },
    'insurance.reference_shipment': {
      label: 'Reference shipment (units)',
      formula: () => <Formula>{'lost units = floor(reference shipment × L_eff)'}</Formula>,
      effect: 'The typical shipment the calculator uses; small shipments can lose 0 units to rounding.',
      example: (cfg) => {
        const u = cfg.insurance.reference_shipment
        return (
          <Example>
            <Table
              caption={`Units lost from a ${u}-unit shipment`}
              head={['', 'Units lost']}
              rows={[
                ['Not shared', String(lostUnitsFor(u, cfg.transport.loss_fraction))],
                [`Shared (N = ${cfg.max_players})`, String(lostUnitsFor(u, cfg.transport.loss_fraction / cfg.max_players))],
              ]}
            />
          </Example>
        )
      },
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
      example: () => (
        <Example title="Capacity 100 left for spot orders of 60, 50 and 30">
          <Table
            caption="Spot allocation, both modes"
            head={['', 'P1', 'P2', 'P3']}
            rows={[
              ['Orders', '60', '50', '30'],
              ['Largest order first', '60', '40', '0'],
              ['Cooperative (equal fill rate)', '43', '36', '21'],
            ]}
          />
        </Example>
      ),
    },
    'topic.what_players_see': {
      label: 'What players see',
      formula: () => (
        <Formula>{'config_public = the five shown keys only\nsecret keys appear in no player payload'}</Formula>
      ),
      effect:
        'Players see five settings: the retail price, the transport cost per unit, the conservation cost and its extra nights, and whether the peer market is on. They learn the rest by playing, from the brief, their cellar and their ledger, and never see the seed or the risk odds.',
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
