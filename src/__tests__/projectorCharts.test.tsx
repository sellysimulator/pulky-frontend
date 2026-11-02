/**
 * Section 37 — the projector charts: buildShareByDayConfig, buildDemandSoldConfig, PresentationCharts
 * (plan 37 §2, §3.1, §3.2, §4). Acceptance 1, 4; failure mode 1.
 */
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))
vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify(
        { type, data: props.data, options: props.options },
        (_k, v) => (typeof v === 'function' ? '__fn__' : v),
      ),
    })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

import { hatched, MEASURE_STYLES, pulqueriaStyle } from '../components/charts/chartSetup'
import PresentationCharts from '../components/host/PresentationCharts'
import PresentationMode from '../components/host/PresentationMode'
import { buildDemandSoldConfig, buildShareByDayConfig } from '../components/host/projectorChartsConfig'
import { selectPresentationData, type PresentationDay } from '../components/host/presentationData'
import { buildProfitRaceConfig, buildRaceConfig } from '../components/results/resultsChartsConfig'
import type { ResultsView } from '../components/results/resultsView'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { Brief, HostView, PublicDayResults, Weekday } from '../types/game'
import { formatPercent } from '../utils/format'

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** plan 37 §4: P1 Don Agave, P2 La Chula, three closed days Mon-Wed. */
const DAYS: PresentationDay[] = [
  {
    day: 1,
    weekday: 'mon',
    demand_total: 50,
    units_sold_total: 44,
    shares: { P1: { display_name: 'Don Agave', market_share: 0.5 }, P2: { display_name: 'La Chula', market_share: 0.5 } },
  },
  {
    day: 2,
    weekday: 'tue',
    demand_total: 70,
    units_sold_total: 60,
    shares: { P1: { display_name: 'Don Agave', market_share: 0.4 }, P2: { display_name: 'La Chula', market_share: 0.6 } },
  },
  {
    day: 3,
    weekday: 'wed',
    demand_total: 90,
    units_sold_total: 81,
    shares: { P1: { display_name: 'Don Agave', market_share: 0.55 }, P2: { display_name: 'La Chula', market_share: 0.45 } },
  },
]

const day = (n: number, shares: PresentationDay['shares'], weekday: Weekday = 'mon'): PresentationDay => ({
  day: n,
  weekday,
  demand_total: 10 * n,
  units_sold_total: 9 * n,
  shares,
})

const sh = (name: string, share: number) => ({ display_name: name, market_share: share })

/** Row cells of a table, by column header. */
function column(table: HTMLElement, header: string): string[] {
  const heads = within(table).getAllByRole('columnheader').map((h) => (h.textContent ?? '').trim())
  const idx = heads.indexOf(header)
  if (idx < 0) throw new Error(`no column ${header} in ${heads.join('|')}`)
  const rows = within(table).getAllByRole('row').slice(1)
  return rows.map((r) => (r.querySelectorAll('th, td')[idx]?.textContent ?? '').trim())
}

function headers(table: HTMLElement): string[] {
  return within(table).getAllByRole('columnheader').map((h) => (h.textContent ?? '').trim())
}

function figureOf(title: string): HTMLElement {
  const f = screen.getAllByRole('figure').find((el) => (el.querySelector('figcaption')?.textContent ?? '').includes(title))
  if (!f) throw new Error(`no chart ${title}`)
  return f
}

function chartOf(title: string): { type: string; data: Obj; options: Obj } {
  return JSON.parse(figureOf(title).querySelector('[data-testid^="chart-"]')!.getAttribute('data-chart')!)
}

function tableOf(title: string, caption: string): HTMLElement {
  const f = figureOf(title)
  fireEvent.click(within(f).getByRole('button', { name: 'Show table' }))
  return within(f).getByRole('table', { name: caption })
}

describe('buildShareByDayConfig (plan 37 §3.2, §4)', () => {
  it('is a stacked bar chart with one dataset per pulquería in alias order and the share per day', () => {
    const cfg = buildShareByDayConfig(DAYS) as Obj
    expect(cfg.type).toBe('bar')
    expect(cfg.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed']])
    expect(cfg.data.datasets.map((d: Obj) => d.label)).toEqual(['Don Agave', 'La Chula'])
    expect(cfg.data.datasets[0].data).toEqual([0.5, 0.4, 0.55])
    expect(cfg.data.datasets[1].data).toEqual([0.5, 0.6, 0.45])
  })

  it('colours P1-P6 with the pulquería colour and P7-P12 with the hatched form of it', () => {
    const shares: PresentationDay['shares'] = {}
    for (let n = 1; n <= 12; n++) shares[`P${n}`] = sh(`Name ${n}`, 1 / 12)
    const cfg = buildShareByDayConfig([day(1, shares)]) as Obj
    expect(cfg.data.datasets).toHaveLength(12)
    cfg.data.datasets.forEach((d: Obj, i: number) => {
      const alias = `P${i + 1}`
      const colour = pulqueriaStyle(alias).color
      if (i < 6) expect(d.backgroundColor).toBe(colour)
      else {
        expect(typeof d.backgroundColor).toBe('function')
        // the scriptable form of hatched(colour): same result as hatched's own for that colour
        expect(d.backgroundColor()).toEqual(hatched(colour)())
      }
    })
  })

  it('orders datasets by alias number, not as text', () => {
    const cfg = buildShareByDayConfig([day(1, { P10: sh('Diez', 0.2), P2: sh('Dos', 0.3), P1: sh('Uno', 0.5) })]) as Obj
    expect(cfg.data.datasets.map((d: Obj) => d.label)).toEqual(['Uno', 'Dos', 'Diez'])
  })

  it('uses null for a day that lacks the alias and the name of the last entry that has it', () => {
    const cfg = buildShareByDayConfig([
      day(1, { P1: sh('Old Name', 0.5), P2: sh('La Chula', 0.5) }),
      day(2, { P1: sh('New Name', 1) }),
      day(3, { P1: sh('Newest', 0.7), P3: sh('Late', 0.3) }),
    ]) as Obj
    const byLabel = Object.fromEntries(cfg.data.datasets.map((d: Obj) => [d.label, d.data]))
    expect(cfg.data.datasets.map((d: Obj) => d.label)).toEqual(['Newest', 'La Chula', 'Late'])
    expect(byLabel['Newest']).toEqual([0.5, 1, 0.7])
    expect(byLabel['La Chula']).toEqual([0.5, null, null])
    expect(byLabel['Late']).toEqual([null, null, 0.3])
  })

  it('names a pulquería by its name in the last entry that has it', () => {
    const cfg = buildShareByDayConfig([day(1, { P1: sh('First', 1) }), day(2, { P1: sh('Second', 1) }), day(3, { P2: sh('Other', 1) })]) as Obj
    expect(cfg.data.datasets[0].label).toBe('Second')
  })

  it('stacks both axes, fixes y to 0..1 and titles the axes', () => {
    const cfg = buildShareByDayConfig(DAYS) as Obj
    const { x, y } = cfg.options.scales
    expect(x.stacked).toBe(true)
    expect(y.stacked).toBe(true)
    expect(y.min).toBe(0)
    expect(y.max).toBe(1)
    expect(y.title.text).toBe('Share of units sold')
    expect(x.title.text).toBe('Day')
    expect(y.ticks.callback.call({}, 0.5, 0, [])).toBe(formatPercent(0.5))
  })

  it('with no day closed it has no labels and no datasets', () => {
    const cfg = buildShareByDayConfig([]) as Obj
    expect(cfg.data.labels).toEqual([])
    expect(cfg.data.datasets).toEqual([])
  })
})

describe('buildDemandSoldConfig (plan 37 §3.2, §4)', () => {
  it('is a line chart: Units sold first, Market demand last so it is drawn on top', () => {
    const cfg = buildDemandSoldConfig(DAYS) as Obj
    expect(cfg.type).toBe('line')
    expect(cfg.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed']])
    expect(cfg.data.datasets.map((d: Obj) => d.label)).toEqual(['Units sold', 'Market demand'])
    expect(cfg.data.datasets[0].data).toEqual([44, 60, 81])
    expect(cfg.data.datasets[1].data).toEqual([50, 70, 90])
  })

  it('styles each line from MEASURE_STYLES and hides the points', () => {
    const cfg = buildDemandSoldConfig(DAYS) as Obj
    const [sold, demand] = cfg.data.datasets
    expect(sold.borderColor).toBe(MEASURE_STYLES.sold.color)
    expect(sold.borderDash).toEqual(MEASURE_STYLES.sold.dash)
    expect(sold.borderWidth).toBe(MEASURE_STYLES.sold.width)
    expect(demand.borderColor).toBe(MEASURE_STYLES.demand.color)
    expect(demand.borderDash).toEqual(MEASURE_STYLES.demand.dash)
    expect(demand.borderWidth).toBe(MEASURE_STYLES.demand.width)
    expect(sold.pointRadius).toBe(0)
    expect(demand.pointRadius).toBe(0)
  })

  it('titles the axes Units and Day', () => {
    const cfg = buildDemandSoldConfig(DAYS) as Obj
    expect(cfg.options.scales.y.title.text).toBe('Units')
    expect(cfg.options.scales.x.title.text).toBe('Day')
  })
})

describe('PresentationCharts (plan 37 §3.2)', () => {
  it('with an empty history shows the empty state and no chart', () => {
    render(<PresentationCharts history={[]} />)
    expect(screen.getByText('No days closed yet')).toBeInTheDocument()
    expect(screen.getByText('Charts fill in as days close.')).toBeInTheDocument()
    expect(screen.queryAllByRole('figure')).toHaveLength(0)
  })

  it('with closed days shows two charts side by side from xl, and no empty state', () => {
    render(<PresentationCharts history={DAYS} />)
    expect(screen.queryByText('No days closed yet')).toBeNull()
    const figures = screen.getAllByRole('figure')
    expect(figures).toHaveLength(2)
    expect(figures[0].textContent).toContain('Market share by day')
    expect(figures[1].textContent).toContain('Market demand vs units sold')
    const grid = figures[0].closest('.grid')
    expect(grid).not.toBeNull()
    expect(grid!.className).toContain('gap-8')
    expect(grid!.className).toContain('xl:grid-cols-2')
    expect(grid!.contains(figures[1])).toBe(true)
  })

  it('gives each chart its accessible description', () => {
    render(<PresentationCharts history={DAYS} />)
    expect(
      within(figureOf('Market share by day')).getByRole('img', {
        name: "Stacked bars of each pulquería's share of the units sold on each day",
      }),
    ).toBeInTheDocument()
    expect(
      within(figureOf('Market demand vs units sold')).getByRole('img', {
        name: "Lines of the market's demand and the units sold on each day",
      }),
    ).toBeInTheDocument()
  })

  it('draws the charts from the history: a stacked share bar and the two lines', () => {
    render(<PresentationCharts history={DAYS} />)
    const share = chartOf('Market share by day')
    expect(share.type).toBe('bar')
    expect(share.data.datasets.map((d: Obj) => d.data)).toEqual([[0.5, 0.4, 0.55], [0.5, 0.6, 0.45]])
    const lines = chartOf('Market demand vs units sold')
    expect(lines.type).toBe('line')
    expect(lines.data.datasets.map((d: Obj) => d.label)).toEqual(['Units sold', 'Market demand'])
  })

  it('share legend: one fill item per pulquería, hatched from P7', () => {
    const shares: PresentationDay['shares'] = {}
    for (let n = 1; n <= 7; n++) shares[`P${n}`] = sh(`Name ${n}`, 1 / 7)
    render(<PresentationCharts history={[day(1, shares)]} />)
    const fig = figureOf('Market share by day')
    const items = Array.from(fig.querySelectorAll('li'))
    expect(items.map((li) => (li.textContent ?? '').trim())).toEqual(Array.from({ length: 7 }, (_, i) => `Name ${i + 1}`))
    items.forEach((li, i) => expect(li.querySelector('pattern') !== null, `P${i + 1}`).toBe(i >= 6))
  })

  it('demand legend: line items Units sold and Market demand with their dash and width', () => {
    render(<PresentationCharts history={DAYS} />)
    const items = Array.from(figureOf('Market demand vs units sold').querySelectorAll('li'))
    expect(items.map((li) => (li.textContent ?? '').trim())).toEqual(['Units sold', 'Market demand'])
    const sold = items[0].querySelector('line')!
    const demand = items[1].querySelector('line')!
    expect(sold.getAttribute('stroke-width')).toBe(String(MEASURE_STYLES.sold.width))
    expect(demand.getAttribute('stroke-width')).toBe(String(MEASURE_STYLES.demand.width))
    expect(sold.getAttribute('stroke-dasharray')).toBe(MEASURE_STYLES.sold.dash.length ? MEASURE_STYLES.sold.dash.join(' ') : null)
    expect(demand.getAttribute('stroke-dasharray')).toBe(MEASURE_STYLES.demand.dash.length ? MEASURE_STYLES.demand.dash.join(' ') : null)
  })

  it('share table: Day then one column per pulquería in percents, a dash for a missing share', () => {
    render(
      <PresentationCharts
        history={[day(1, { P1: sh('Don Agave', 0.5), P2: sh('La Chula', 0.5) }), day(2, { P1: sh('Don Agave', 1) })]}
      />,
    )
    const table = tableOf('Market share by day', 'Market share by day')
    expect(headers(table)).toEqual(['Day', 'Don Agave', 'La Chula'])
    expect(column(table, 'Don Agave')).toEqual(['50%', '100%'])
    expect(column(table, 'La Chula')).toEqual(['50%', '—'])
  })

  it('demand table: Day, Market demand, Units sold with whole-number formatting', () => {
    const big: PresentationDay = { ...DAYS[0], demand_total: 1234, units_sold_total: 1100 }
    render(<PresentationCharts history={[big, DAYS[1]]} />)
    const table = tableOf('Market demand vs units sold', 'Market demand vs units sold')
    expect(headers(table)).toEqual(['Day', 'Market demand', 'Units sold'])
    expect(column(table, 'Market demand')).toEqual(['1,234', '70'])
    expect(column(table, 'Units sold')).toEqual(['1,100', '60'])
  })
})

describe('the projector charts take public data only (acceptance 1, failure mode 1)', () => {
  const read = (file: string): string => readFileSync(resolve(process.cwd(), 'src/components/host', file), 'utf8')
  const FORBIDDEN = ['DayRecord', 'MarketDay', 'HostView', 'HostHistories', 'hostHistories', 'marketHistory', 'useGameStore']

  it.each(['projectorChartsConfig.ts', 'PresentationCharts.tsx'])('%s mentions none of the private-data names', (file) => {
    const text = read(file)
    for (const name of FORBIDDEN) expect(new RegExp(`\\b${name}\\b`).test(text), `${file} mentions ${name}`).toBe(false)
    expect(/from\s+['"][^'"]*store[^'"]*['"]/.test(text), `${file} imports the store`).toBe(false)
  })

  const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula' }

  function brief(): Brief {
    return {
      day: 4,
      duration_days: 14,
      weekday: 'thu',
      weekday_multiplier: 1,
      expected_demand: 100,
      supplier: { disrupted: false, disruption_message: null, spot_price: 13.4, base_price: 12, lead_time_days: 1 },
      futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
      transport: { shared: false },
      reputation: { P1: 0.6, P2: 0.6 },
    } as unknown as Brief
  }

  /** Public entries that carry private keys and distinctive values, at the entry and at the player level. */
  function poisoned(d: number): PublicDayResults {
    const players: Obj = {}
    for (const [a, name] of Object.entries(NAMES)) {
      players[a] = {
        display_name: name,
        units_sold: 4242,
        market_share: 0.5,
        reputation: 0.6,
        cash: 777001.5,
        cellar: [{ qty: 31337 }],
        order_spot: 5151,
        order_futures: 4141,
        capacity: 88123,
      }
    }
    return {
      day: d,
      weekday: (['mon', 'tue', 'wed'] as const)[d - 1],
      demand_total: 100 + d,
      units_sold_total: 90 + d,
      spot_price: 13.4,
      disrupted: false,
      cooperation: false,
      cooperators: 1,
      refrigeration_failure: false,
      peer_units: 16,
      peer_avg_price: 14.25,
      cash: 777002.5,
      cellar: [{ qty: 31338 }],
      order_spot: 5152,
      order_futures: 4142,
      capacity: 88124,
      players,
    } as unknown as PublicDayResults
  }

  const PRIVATE_VALUES = ['777001', '777002', '31337', '31338', '5151', '5152', '4141', '4142', '88123', '88124', '4242', '9191', '9292', '6363']

  function seedPoisoned(): void {
    const hostPlayers: Obj = {}
    for (const [a, name] of Object.entries(NAMES)) {
      hostPlayers[a] = { display_name: name, has_submitted: false, cash: 777001.5, cumulative_profit: 9191, stock_units: 6363 }
    }
    useGameStore.setState({
      ...INITIAL_STATE,
      roomCode: 'ABC234',
      isHost: true,
      hostClaimed: true,
      roomState: 'running',
      durationDays: 14,
      brief: brief(),
      hostView: {
        full: true,
        state: 'running',
        day: 4,
        duration_days: 14,
        weekday: 'thu',
        phase: 'deciding',
        brief: brief(),
        seed: 987654321,
        config: { peer_market: { enabled: true }, supplier: { spot_spread: 0.337 }, transport: { failure_probability: 0.1234 } },
        awaiting: [],
        players: hostPlayers,
        leaderboard: [],
      } as unknown as HostView,
      publicHistory: [poisoned(1), poisoned(2), poisoned(3)],
      marketHistory: [
        { day: 1, weekday: 'mon', weekday_multiplier: 1, demand_total: 9292, units_sold_total: 9191, capacity: 88123 },
      ] as never,
      hostHistories: {
        P1: [{ day: 1, profit: 9191, spoiled: 9292, order_spot: 6363, cash_end: 777001.5 }] as never,
      },
    })
  }

  beforeEach(() => useGameStore.setState({ ...INITIAL_STATE }))

  const allKeys = (value: unknown, out = new Set<string>()): Set<string> => {
    if (Array.isArray(value)) value.forEach((v) => allKeys(v, out))
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        out.add(k)
        allKeys(v, out)
      }
    }
    return out
  }

  it('failure mode 1: no private key or value of a public entry or of the host data reaches the history', () => {
    seedPoisoned()
    const data = selectPresentationData(useGameStore.getState())!
    const text = JSON.stringify(data.history)
    for (const v of PRIVATE_VALUES) expect(text, v).not.toContain(v)
    const keys = allKeys(data.history)
    for (const k of ['cash', 'cellar', 'order_spot', 'order_futures', 'capacity', 'units_sold', 'reputation', 'profit', 'cash_end']) {
      expect(keys.has(k), k).toBe(false)
    }
  })

  it('failure mode 1: no private key or value reaches the configurations of the two projector charts', () => {
    seedPoisoned()
    const { history } = selectPresentationData(useGameStore.getState())!
    for (const cfg of [buildShareByDayConfig(history), buildDemandSoldConfig(history)]) {
      const text = JSON.stringify(cfg, (_k, v) => (typeof v === 'function' ? '__fn__' : v))
      for (const v of PRIVATE_VALUES) expect(text, v).not.toContain(v)
      const keys = allKeys(JSON.parse(text))
      for (const k of ['cash', 'cellar', 'order_spot', 'order_futures', 'capacity']) expect(keys.has(k), k).toBe(false)
    }
  })

  it('failure mode 1: nothing private is rendered in the presentation charts or their tables', () => {
    seedPoisoned()
    const data = selectPresentationData(useGameStore.getState())!
    render(<PresentationMode data={data} onExit={() => {}} />)
    for (const f of screen.getAllByRole('figure')) fireEvent.click(within(f).getByRole('button', { name: 'Show table' }))
    const figures = screen.getAllByRole('figure')
    expect(figures).toHaveLength(2)
    for (const f of figures) {
      const dom = f.innerHTML
      for (const v of PRIVATE_VALUES) expect(dom, v).not.toContain(v)
    }
    // and the rendered public figures are there: the demand table carries the public totals
    const table = within(figureOf('Market demand vs units sold')).getByRole('table')
    expect(column(table, 'Market demand')).toEqual(['101', '102', '103'])
    expect(column(table, 'Units sold')).toEqual(['91', '92', '93'])
  })
})

describe('the live race matches the results race (acceptance 3, builders)', () => {
  it('buildRaceConfig without totals has the day points of buildProfitRaceConfig and no End label', () => {
    const profits: Record<string, number[]> = { P1: [100, -10, 40.25], P2: [80, 30, 20] }
    const names: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula' }
    const weekdays: Weekday[] = ['mon', 'tue', 'wed']
    const view = {
      days_played: 3,
      market: { weekday: weekdays, weekday_multiplier: [0.5, 1, 1] },
      players: ['P1', 'P2'].map((a) => ({
        alias: a,
        display_name: names[a],
        series: { profit: profits[a] },
        total_profit: profits[a].reduce((s, v) => s + v, 0),
      })),
    } as unknown as ResultsView
    const live = buildRaceConfig(
      {
        weekdays,
        peak: [false, true, true],
        lines: ['P1', 'P2'].map((a) => ({ alias: a, name: names[a], profit: profits[a] })),
      },
      null,
    ) as Obj
    const results = buildProfitRaceConfig(view, null) as Obj
    expect(live.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed']])
    expect(results.data.labels).toHaveLength(4)
    expect(live.data.datasets[0].data).toEqual([100, 90, 130.25])
    expect(live.data.datasets[1].data).toEqual([80, 110, 130])
    live.data.datasets.forEach((d: Obj, i: number) => expect(d.data).toEqual(results.data.datasets[i].data.slice(0, 3)))
  })
})
