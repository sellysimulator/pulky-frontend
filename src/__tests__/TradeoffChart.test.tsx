/**
 * Section 35 - fill vs waste: buildTradeoffConfig and TradeoffChart (plan 35 section 3.2;
 * acceptance criteria 4, 9; failure mode 4). The RatioTable placement is in ResultsSummary.test.tsx.
 */
import { createElement } from 'react'
import { render, screen, within } from '@testing-library/react'
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

import TradeoffChart from '../components/results/TradeoffChart'
import { buildTradeoffConfig } from '../components/results/resultsChartsConfig'
import { CHART_COLORS, pulqueriaStyle } from '../components/charts/chartSetup'
import { formatMoney, formatPercent } from '../utils/format'
import { EXAMPLE_PROFILES, makeSmallView } from './fixtures/resultsFlow'
import { allCharts } from './fixtures/resultsHelpers'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const profile = (alias: string, name: string, total: number, fill: number | null, waste: number | null) => ({
  alias, name, profit: [0], total, fill, waste,
})
const viewOf = (...p: ReturnType<typeof profile>[]) => makeSmallView(p)
const ds = (cfg: Dict, label: string): Dict => cfg.data.datasets.find((d: Dict) => d.label === label)
const points = (cfg: Dict): Dict[] => cfg.data.datasets.filter((d: Dict) => d.order === 1)

describe('buildTradeoffConfig (section 4)', () => {
  const cfg = buildTradeoffConfig(makeSmallView(), 'P1') as Dict

  it('is a line chart drawn as points: no bubble or scatter type', () => {
    expect(cfg.type).toBe('line')
    for (const d of points(cfg)) expect(d.showLine).toBe(false)
  })

  it('plots exactly the pulquerías with both ratios, never a null as 0 (criterion 4, failure mode 4)', () => {
    expect(points(cfg).map((d) => d.label)).toEqual(['La Chula', 'Don Agave'])
    expect(JSON.stringify(cfg.data)).not.toContain('El Tinacal')
    // El Tinacal has waste_rate 0.2 and a null fill rate: its 0.2 must not show up as an x value at y 0 or null.
    for (const d of cfg.data.datasets) for (const p of d.data) expect(p.y).not.toBeNull()
  })

  it('places each point at x waste rate, y fill rate, with the radius from total profit', () => {
    expect(ds(cfg, 'La Chula').data).toEqual([{ x: 0.1, y: 0.9 }])
    expect(ds(cfg, 'Don Agave').data).toEqual([{ x: 0.3, y: 0.8 }])
    expect(ds(cfg, 'La Chula')).toMatchObject({ pointRadius: 20, pointHoverRadius: 22, order: 1 })
    expect(ds(cfg, 'Don Agave')).toMatchObject({ pointRadius: 6, pointHoverRadius: 8 })
  })

  it('styles the points: colour at CC alpha, point style, ink border and width 2 for myAlias, card border and width 1 otherwise', () => {
    const mine = ds(cfg, 'Don Agave')
    expect(mine.pointBackgroundColor).toBe(pulqueriaStyle('P1').color + 'CC')
    expect(mine.pointStyle).toBe(pulqueriaStyle('P1').pointStyle)
    expect(mine.pointBorderColor).toBe('#26221B')
    expect(mine.pointBorderWidth).toBe(2)
    const other = ds(cfg, 'La Chula')
    expect(other.pointBackgroundColor).toBe(pulqueriaStyle('P2').color + 'CC')
    expect(other.pointBorderColor).toBe(CHART_COLORS.card)
    expect(other.pointBorderWidth).toBe(1)
  })

  it('has no ink border on anyone without myAlias', () => {
    const none = buildTradeoffConfig(makeSmallView(), null) as Dict
    for (const d of points(none)) {
      expect(d.pointBorderColor).toBe(CHART_COLORS.card)
      expect(d.pointBorderWidth).toBe(1)
    }
  })

  it('bounds the axes: x 0..0.4, y 0.7..1, linear', () => {
    expect(cfg.options.scales.x).toMatchObject({ type: 'linear', min: 0, max: 0.4 })
    expect(cfg.options.scales.y).toMatchObject({ type: 'linear', min: 0.7, max: 1 })
    expect(cfg.options.scales.x.title.text).toBe('Waste rate')
    expect(cfg.options.scales.y.title.text).toBe('Fill rate')
  })

  it('shows percent ticks', () => {
    const label = String(cfg.options.scales.x.ticks.callback(0.3, 0, []))
    expect(label).toContain('30')
    expect(label).toContain('%')
    expect(String(cfg.options.scales.y.ticks.callback(0.85, 0, []))).toContain('%')
  })

  it('draws the two average rules beneath the points', () => {
    const w = ds(cfg, 'Average waste rate')
    const f = ds(cfg, 'Average fill rate')
    expect(w.data).toEqual([{ x: 0.2, y: 0.7 }, { x: 0.2, y: 1 }].map((p) => ({ x: expect.closeTo(p.x, 9), y: p.y })))
    expect(f.data).toEqual([{ x: 0, y: expect.closeTo(0.85, 9) }, { x: 0.4, y: expect.closeTo(0.85, 9) }])
    for (const d of [w, f]) {
      expect(d).toMatchObject({
        order: 2, showLine: true, borderColor: CHART_COLORS['ink-muted'], borderWidth: 1.5,
        borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0,
      })
    }
  })

  it('sets the nearest, intersecting interaction and the four quadrant names', () => {
    expect(cfg.options.interaction).toEqual({ mode: 'nearest', intersect: true })
    expect(cfg.options.plugins.quadrantLabels).toEqual({
      topLeft: 'Served and fresh',
      topRight: 'Served by overstocking',
      bottomLeft: 'Lean but short',
      bottomRight: 'Short and wasting',
    })
  })

  it('failure mode 4: a null waste rate is left out as well, and with none plotted there are no datasets', () => {
    const one = buildTradeoffConfig(viewOf(profile('P1', 'A', 5, 0.5, null), profile('P2', 'B', 6, 0.6, 0.1)), null) as Dict
    expect(points(one).map((d) => d.label)).toEqual(['B'])
    const none = buildTradeoffConfig(viewOf(profile('P1', 'A', 5, null, null), profile('P2', 'B', 6, 0.6, null)), null) as Dict
    expect(none.data.datasets).toEqual([])
  })

  it('uses radius 13 when every plotted total profit is equal', () => {
    const eq = buildTradeoffConfig(viewOf(profile('P1', 'A', 5, 0.5, 0.1), profile('P2', 'B', 5, 0.6, 0.2)), null) as Dict
    expect(points(eq).map((d) => d.pointRadius)).toEqual([13, 13])
    const single = buildTradeoffConfig(viewOf(profile('P1', 'A', 5, 0.5, 0.1)), null) as Dict
    expect(points(single)[0].pointRadius).toBe(13)
  })

  it('scales the radius between 6 and 20 by total profit among the plotted only (a negative total, a middle one)', () => {
    const v = viewOf(
      profile('P1', 'A', -100, 0.5, 0.1),
      profile('P2', 'B', 0, 0.6, 0.2),
      profile('P3', 'C', 100, 0.7, 0.3),
      profile('P4', 'D', 99999, null, 0.3), // not plotted: must not stretch the scale
    )
    const c = buildTradeoffConfig(v, null) as Dict
    expect(points(c).map((d) => d.pointRadius)).toEqual([6, 13, 20])
  })

  it('hatches the fill of P7 to P12 and keeps the plain CC alpha for P1 to P6', () => {
    const c = buildTradeoffConfig(viewOf(profile('P1', 'A', 1, 0.5, 0.1), profile('P7', 'B', 2, 0.6, 0.2)), null) as Dict
    expect(ds(c, 'A').pointBackgroundColor).toBe(pulqueriaStyle('P1').color + 'CC')
    const hatchedFill = ds(c, 'B').pointBackgroundColor
    expect(hatchedFill).toBeTypeOf('function')
    expect(ds(c, 'B').pointStyle).toBe(pulqueriaStyle('P7').pointStyle)
    // jsdom has no canvas, so the pattern degrades to the plain colour of the slot
    expect(String(hatchedFill())).toBe(pulqueriaStyle('P7').color)
  })

  it('x max is the ceiling to a tenth of the highest waste rate + 0.05, rounded to 6 decimals first', () => {
    // (0.25 + 0.05) x 10 = 3.0000000000000004 in floating point: without the rounding the ceiling is 4 (0.4)
    const c = buildTradeoffConfig(viewOf(profile('P1', 'A', 1, 0.9, 0.25), profile('P2', 'B', 2, 0.8, 0.1)), null) as Dict
    expect(c.options.scales.x.max).toBeCloseTo(0.3, 9)
    const capped = buildTradeoffConfig(viewOf(profile('P1', 'A', 1, 0.9, 0.97)), null) as Dict
    expect(capped.options.scales.x.max).toBe(1)
  })

  it('y min is the floor to a tenth of the lowest fill rate - 0.05, rounded to 6 decimals first, and never below 0', () => {
    // (0.85 - 0.05) x 10 = 7.999999999999999: without the rounding the floor is 7 (0.7)
    const c = buildTradeoffConfig(viewOf(profile('P1', 'A', 1, 0.85, 0.1), profile('P2', 'B', 2, 0.95, 0.2)), null) as Dict
    expect(c.options.scales.y.min).toBeCloseTo(0.8, 9)
    const low = buildTradeoffConfig(viewOf(profile('P1', 'A', 1, 0.02, 0.1)), null) as Dict
    expect(low.options.scales.y.min).toBe(0)
  })
})

describe('TradeoffChart', () => {
  const view = makeSmallView()
  const config = (): Dict => {
    const charts = allCharts()
    expect(charts).toHaveLength(1)
    return { type: charts[0].type, data: charts[0].data, options: charts[0].options }
  }

  it('titles the chart, names the plot, and plots the builder\'s datasets', () => {
    render(<TradeoffChart view={view} myAlias="P1" />)
    expect(screen.getByText('Fill rate vs waste rate')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: "Chart of each pulquería's fill rate against its waste rate, sized by total profit" }),
    ).toBeInTheDocument()
    expect(config().data.datasets.map((d: Dict) => d.label)).toEqual([
      'La Chula', 'Don Agave', 'Average waste rate', 'Average fill rate',
    ])
    expect(ds(config(), 'Don Agave').pointBorderWidth).toBe(2)
  })

  it('names the pulquería that is not plotted, with its reason, in the caption (criterion 4)', () => {
    render(<TradeoffChart view={view} myAlias={null} />)
    expect(screen.getByText('Size is total profit. Not plotted: El Tinacal (no demand was owed).')).toBeInTheDocument()
  })

  it('has only "Size is total profit." when everything is plotted', () => {
    render(<TradeoffChart view={makeSmallView(EXAMPLE_PROFILES.slice(0, 2))} myAlias={null} />)
    expect(screen.getByText('Size is total profit.')).toBeInTheDocument()
  })

  it('gives each reason, joining several in rank order', () => {
    const v = viewOf(
      profile('P1', 'Uno', 1, 0.5, 0.1),
      profile('P2', 'Dos', 2, null, 0.1),
      profile('P3', 'Tres', 3, 0.5, null),
      profile('P4', 'Cuatro', 4, null, null),
    )
    render(<TradeoffChart view={v} myAlias={null} />)
    expect(
      screen.getByText(
        'Size is total profit. Not plotted: Dos (no demand was owed); Tres (nothing was sold or spoiled); Cuatro (no demand was owed, and nothing was sold or spoiled).',
      ),
    ).toBeInTheDocument()
  })

  it('has a static legend: one item per plotted pulquería, then the two average rules', () => {
    render(<TradeoffChart view={view} myAlias={null} />)
    const names = ['La Chula', 'Don Agave', 'Average waste rate', 'Average fill rate']
    const els = names.map((n) => screen.getAllByText(n)[0])
    for (let i = 1; i < els.length; i++) {
      expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(screen.queryByText('El Tinacal')).not.toBeInTheDocument()
  })

  it('criterion 9: the table view lists each plotted pulquería and the Average row', async () => {
    render(<TradeoffChart view={view} myAlias={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Show table/ }))
    const table = screen.getByRole('table', { name: 'Fill rate vs waste rate' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Pulquería', 'Waste rate', 'Fill rate', 'Total profit',
    ])
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    expect(rows).toEqual([
      ['La Chula', formatPercent(0.1), formatPercent(0.9), formatMoney(200.6)],
      ['Don Agave', formatPercent(0.3), formatPercent(0.8), formatMoney(139.5)],
      ['Average', formatPercent(0.2), formatPercent(0.85), '—'],
    ])
  })

  it('renders the no-plot line instead of the chart when no pulquería has both ratios', () => {
    const v = viewOf(profile('P1', 'A', 1, null, 0.1), profile('P2', 'B', 2, 0.5, null))
    const { container } = render(<TradeoffChart view={v} myAlias={null} />)
    const line = screen.getByText('No pulquería has both a fill rate and a waste rate to plot.')
    expect(line.tagName).toBe('P')
    expect(line).toHaveClass('text-sm', 'text-ink-muted')
    expect(container.querySelector('[data-testid^="chart-"]')).toBeNull()
    expect(screen.queryByText('Fill rate vs waste rate')).not.toBeInTheDocument()
  })
})
