/**
 * Section 35 - the profit race: buildRaceConfig, buildProfitRaceConfig and ProfitRaceChart
 * (plan 35 section 3.1; acceptance criteria 1, 3, 8, 9; failure mode 1).
 * The Reveal placement (criterion 2, failure mode 3) is in ResultsSummary.test.tsx.
 */
import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  type Props = { type?: string; data?: unknown; options?: unknown }
  const make = (fixed?: string) =>
    function MockChart(props: Props) {
      const type = fixed ?? props.type ?? 'chart'
      return createElement('div', {
        'data-testid': `chart-${type}`,
        'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
      })
    }
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut'), Chart: make() }
})
vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import ProfitRaceChart from '../components/results/ProfitRaceChart'
import { buildProfitRaceConfig, buildRaceConfig, type RaceInput } from '../components/results/resultsChartsConfig'
import { resultsViewFromLive, resultsViewFromResponse } from '../components/results/resultsView'
import { emphasisOf, pulqueriaLine } from '../components/charts/chartSetup'
import type { GameFinishedPayload, ResultsResponse } from '../types/game'
import { formatMoney } from '../utils/format'
import { DAYS, ROOM, makeFinished, makeResponse, makeView } from './fixtures/results'
import { EXAMPLE_PROFILES, makeSmallView } from './fixtures/resultsFlow'
import { allCharts, chartWithDataset } from './fixtures/resultsHelpers'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const dataOf = (cfg: Dict, label: string): number[] => cfg.data.datasets.find((d: Dict) => d.label === label).data
const dataset = (cfg: Dict, label: string): Dict => cfg.data.datasets.find((d: Dict) => d.label === label)

describe('buildRaceConfig', () => {
  const input = (over: Partial<RaceInput> = {}): RaceInput => ({
    weekdays: ['mon', 'tue', 'wed'],
    peak: [false, true, true],
    lines: EXAMPLE_PROFILES.map((p) => ({ alias: p.alias, name: p.name, cumulative: p.cumulative })),
    ...over,
  })

  it('is a line chart; without totals it has no End label and no End point (section 4)', () => {
    const cfg = buildRaceConfig(input(), null) as Dict
    expect(cfg.type).toBe('line')
    expect(cfg.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed']])
    expect(dataOf(cfg, 'La Chula')).toEqual([100.1, 150.3, 180.6])
    expect(dataOf(cfg, 'Don Agave')).toEqual([80, 59.5, 119.5])
  })

  it('adds End (label and point) only when every line has a total', () => {
    const lines = EXAMPLE_PROFILES.map((p) => ({ alias: p.alias, name: p.name, cumulative: p.cumulative, total: p.total }))
    const all = buildRaceConfig(input({ lines }), null) as Dict
    expect(all.data.labels.at(-1)).toEqual(['End'])
    expect(dataOf(all, 'La Chula')).toEqual([100.1, 150.3, 180.6, 200.6])

    const partial = buildRaceConfig(input({ lines: lines.map((l, i) => (i === 2 ? { ...l, total: undefined } : l)) }), null) as Dict
    expect(partial.data.labels).toHaveLength(3)
    for (const d of partial.data.datasets) expect(d.data).toHaveLength(3)
  })

  it('failure mode 1: plots the server running totals as sent and sums nothing itself', () => {
    // The server rounds the running total once (spec 8.6); re-summing on the client would drift from it.
    const cfg = buildRaceConfig(input({ lines: [{ alias: 'P1', name: 'A', cumulative: [0.01, 0.01, 0.02] }] }), null) as Dict
    expect(dataOf(cfg, 'A')).toEqual([0.01, 0.01, 0.02])
  })

  it('stops a line shorter than the weekdays early', () => {
    const cfg = buildRaceConfig(input({ lines: [{ alias: 'P1', name: 'A', cumulative: [5, 10] }] }), null) as Dict
    expect(dataOf(cfg, 'A')).toEqual([5, 10])
  })

  it('keeps the lines in input order and spreads pulqueriaLine(alias, emphasis) onto each dataset', () => {
    for (const focus of [null, 'P1', 'P3']) {
      const cfg = buildRaceConfig(input(), focus) as Dict
      expect(cfg.data.datasets.map((d: Dict) => d.label)).toEqual(['La Chula', 'Don Agave', 'El Tinacal'])
      for (const [i, p] of EXAMPLE_PROFILES.entries()) {
        expect(cfg.data.datasets[i]).toMatchObject(pulqueriaLine(p.alias, emphasisOf(p.alias, focus)))
      }
    }
  })

  it('section 4 emphasis: focus P1 gives P1 width 3 and order 0, the others the context colour; no focus gives 2.5 everywhere', () => {
    const f = buildRaceConfig(input(), 'P1') as Dict
    expect(dataset(f, 'Don Agave')).toMatchObject({ borderWidth: 3, order: 0 })
    expect(dataset(f, 'La Chula').borderColor).toBe('#C9BEA6')
    expect(dataset(f, 'El Tinacal').borderColor).toBe('#C9BEA6')
    const n = buildRaceConfig(input(), null) as Dict
    for (const d of n.data.datasets) expect(d.borderWidth).toBe(2.5)
  })

  it('titles the axes Day and $ and marks the peak days as peak bands', () => {
    const cfg = buildRaceConfig(input(), null) as Dict
    expect(cfg.options.scales.x.title.text).toBe('Day')
    expect(cfg.options.scales.y.title.text).toBe('$')
    expect(cfg.options.plugins.eventBands.bands).toEqual([
      { index: 1, tone: 'peak' },
      { index: 2, tone: 'peak' },
    ])
  })

  it('labels line ends and pads the plot for 6 lines or fewer, and neither for 7', () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ alias: `P${i + 1}`, name: `N${i + 1}`, cumulative: [1, 3, 6] }))
    const six = buildRaceConfig(input({ lines: lines(6) }), null) as Dict
    expect(six.options.plugins.lineEndLabels.display).toBe(true)
    expect(six.options.layout.padding.right).toBe(112)
    const seven = buildRaceConfig(input({ lines: lines(7) }), null) as Dict
    expect(seven.options.plugins.lineEndLabels.display).toBeFalsy()
    expect(seven.options.layout.padding.right).toBe(0)
  })
})

describe('buildProfitRaceConfig (section 4, criterion 1, failure mode 1)', () => {
  const view = makeSmallView()

  it('adds the End column and the End points: 200.6, 139.5 and 30', () => {
    const cfg = buildProfitRaceConfig(view, null) as Dict
    expect(cfg.type).toBe('line')
    expect(cfg.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['End']])
    expect(dataOf(cfg, 'La Chula')).toEqual([100.1, 150.3, 180.6, 200.6])
    expect(dataOf(cfg, 'Don Agave')).toEqual([80, 59.5, 119.5, 139.5])
    expect(dataOf(cfg, 'El Tinacal')).toEqual([10, 20, 30, 30])
  })

  it('has one dataset per pulquería in rank order, with the peak bands of the multiplier-1 days only', () => {
    const cfg = buildProfitRaceConfig(view, null) as Dict
    expect(cfg.data.datasets.map((d: Dict) => d.label)).toEqual(['La Chula', 'Don Agave', 'El Tinacal'])
    expect(cfg.options.plugins.eventBands.bands).toEqual([
      { index: 1, tone: 'peak' },
      { index: 2, tone: 'peak' },
    ])
    expect(cfg.options.plugins.lineEndLabels.display).toBe(true)
    expect(cfg.options.layout.padding.right).toBe(112)
  })

  it('is exactly buildRaceConfig of the view (the same configuration for the same lines)', () => {
    const direct = buildRaceConfig(
      {
        weekdays: ['mon', 'tue', 'wed'],
        peak: [false, true, true],
        lines: EXAMPLE_PROFILES.map((p) => ({ alias: p.alias, name: p.name, cumulative: p.cumulative, total: p.total })),
      },
      'P3',
    )
    expect(JSON.stringify(buildProfitRaceConfig(view, 'P3'))).toBe(JSON.stringify(direct))
  })

  it('takes only the first days_played days of the market arrays', () => {
    const long = makeSmallView()
    ;(long.market as Dict).weekday = ['mon', 'tue', 'wed', 'thu', 'fri']
    ;(long.market as Dict).weekday_multiplier = [0.5, 1, 1, 1, 1]
    const cfg = buildProfitRaceConfig(long, null) as Dict
    expect(cfg.data.labels).toHaveLength(4)
    expect(cfg.options.plugins.eventBands.bands).toEqual([
      { index: 1, tone: 'peak' },
      { index: 2, tone: 'peak' },
    ])
  })

  it("criterion 1 and 8: End is total_profit and the days are the server's cumulative_profit, live and by URL, for every pulquería", () => {
    const live = resultsViewFromLive(makeFinished() as unknown as GameFinishedPayload, { roomCode: ROOM, durationDays: DAYS })
    const stored = resultsViewFromResponse(makeResponse() as unknown as ResultsResponse)
    const a = buildProfitRaceConfig(live, null) as Dict
    const b = buildProfitRaceConfig(stored, null) as Dict
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    for (const p of live.players) {
      const data = dataOf(a, p.display_name)
      expect(data).toHaveLength(DAYS + 1)
      expect(data.at(-1)).toBe(p.total_profit)
      expect(data.slice(0, -1)).toEqual(p.series.cumulative_profit)
    }
  })
})

describe('ProfitRaceChart', () => {
  const view = makeSmallView()
  const renderRace = (myAlias: string | null) => render(<ProfitRaceChart view={view} myAlias={myAlias} />)
  const config = (): Dict => {
    const charts = allCharts()
    expect(charts).toHaveLength(1)
    return { type: charts[0].type, data: charts[0].data, options: charts[0].options }
  }
  const legendItem = (name: string): HTMLElement => {
    const el = screen
      .getAllByText(name)
      .map((e) => e.closest<HTMLElement>('[tabindex="0"]'))
      .find(Boolean)
    if (!el) throw new Error(`no focusable legend item for ${name}`)
    return el
  }

  it('shows the title, the caption and an accessible name for the plot', () => {
    renderRace(null)
    expect(screen.getByText('Profit race')).toBeInTheDocument()
    expect(screen.getByText("Running total of each pulquería's daily profit. End adds the final settlement.")).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: "Line chart of each pulquería's running profit on each day played, ending at its total profit" }),
    ).toBeInTheDocument()
  })

  it('plots buildProfitRaceConfig, with the viewer emphasised (criterion 3)', () => {
    renderRace('P1')
    const cfg = config()
    expect(cfg.type).toBe('line')
    expect(cfg.data.datasets.map((d: Dict) => d.label)).toEqual(['La Chula', 'Don Agave', 'El Tinacal'])
    expect(dataset(cfg, 'Don Agave')).toMatchObject({ borderWidth: 3, order: 0 })
    expect(dataset(cfg, 'La Chula').borderColor).toBe('#C9BEA6')
    expect(dataOf(cfg, 'La Chula')).toEqual([100.1, 150.3, 180.6, 200.6])
  })

  it('has no emphasis without myAlias (criterion 3)', () => {
    renderRace(null)
    for (const d of config().data.datasets) expect(d.borderWidth).toBe(2.5)
  })

  it('lists one legend item per pulquería in rank order', () => {
    renderRace(null)
    const items = ['La Chula', 'Don Agave', 'El Tinacal'].map(legendItem)
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].compareDocumentPosition(items[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('focusing a legend item emphasises that line over myAlias, and leaving it restores myAlias (criterion 3)', () => {
    renderRace('P1')
    fireEvent.focus(legendItem('El Tinacal'))
    expect(dataset(config(), 'El Tinacal')).toMatchObject({ borderWidth: 3, order: 0 })
    expect(dataset(config(), 'Don Agave').borderColor).toBe('#C9BEA6')
    fireEvent.blur(legendItem('El Tinacal'))
    expect(dataset(config(), 'Don Agave')).toMatchObject({ borderWidth: 3 })
    expect(dataset(config(), 'El Tinacal').borderColor).toBe('#C9BEA6')
  })

  it('with no myAlias every line is plain until a legend item is hovered, which emphasises it (criterion 3)', async () => {
    renderRace(null)
    await userEvent.hover(legendItem('La Chula'))
    expect(dataset(config(), 'La Chula')).toMatchObject({ borderWidth: 3 })
    expect(dataset(config(), 'Don Agave').borderColor).toBe('#C9BEA6')
    await userEvent.unhover(legendItem('La Chula'))
    for (const d of config().data.datasets) expect(d.borderWidth).toBe(2.5)
  })

  it('criterion 9: the table view holds the plotted values, Day first and End last', async () => {
    renderRace(null)
    await userEvent.click(screen.getByRole('button', { name: /Show table/ }))
    const table = screen.getByRole('table', { name: 'Profit race' })
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['Day', 'La Chula', 'Don Agave', 'El Tinacal'])
    const rows = within(table).getAllByRole('row').slice(1)
    const cells = rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    expect(cells).toEqual([
      ['1', formatMoney(100.1), formatMoney(80), formatMoney(10)],
      ['2', formatMoney(150.3), formatMoney(59.5), formatMoney(20)],
      ['3', formatMoney(180.6), formatMoney(119.5), formatMoney(30)],
      ['End', formatMoney(200.6), formatMoney(139.5), formatMoney(30)],
    ])
  })

  it('works on the 14-day fixture: the End row shows every total_profit', async () => {
    const full = makeView()
    render(<ProfitRaceChart view={full} myAlias={null} />)
    expect(chartWithDataset('La Chula')!.data.datasets.map((d) => d.data.at(-1))).toEqual([5123.45, 3000.5, -250.75])
  })
})
