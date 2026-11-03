/**
 * Section 36 - share bars (spec 7.7, 13.7). Acceptance criteria 3, 4, 9 (SharePie gone); failure modes 2, 3.
 * Charts are mocked (no canvas in jsdom); assertions are on the configuration and on the table view.
 */
import { createElement } from 'react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => new Map<string, { data: any; options: any }>()) // eslint-disable-line @typescript-eslint/no-explicit-any

vi.mock('react-chartjs-2', async () => {
  const { createElement: h, useId } = await import('react')
  const make = (type: string) => (props: { data: unknown; options: unknown }) => {
    const id = useId()
    seen.set(id, props as never)
    return h('div', { 'data-testid': `chart-${type}`, 'data-chart-id': id })
  }
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut'), Chart: make('chart') }
})

import ShareBars from '../components/game/ShareBars'
import { buildShareBarsConfig } from '../components/game/shareBarsConfig'
import { CHART_COLORS, hatched, pulqueriaStyle } from '../components/charts/chartSetup'
import type { PublicDayResults } from '../types/game'
import { formatPercent } from '../utils/format'

type Shares = Record<string, number>

function day(n: number, shares: Shares): PublicDayResults {
  const players = Object.fromEntries(
    Object.entries(shares).map(([alias, share]) => [
      alias,
      { display_name: `Name ${alias}`, units_sold: Math.round(share * 100), market_share: share, reputation: 0.5 },
    ]),
  )
  return { day: n, players } as unknown as PublicDayResults
}

const THREE = day(4, { P1: 0.25, P2: 0.45, P3: 0.3 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (d: PublicDayResults, own = 'P1'): any => buildShareBarsConfig(d, own)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bg = (c: any, i: number): unknown => c.data.datasets[0].backgroundColor({ dataIndex: i })

afterEach(() => vi.restoreAllMocks())

describe('buildShareBarsConfig', () => {
  it('is a horizontal bar chart, largest share first, labelled with display names', () => {
    const c = cfg(THREE)
    expect(c.type).toBe('bar')
    expect(c.options.indexAxis).toBe('y')
    expect(c.data.labels).toEqual(['Name P2', 'Name P3', 'Name P1'])
    expect(c.data.datasets[0].label).toBe('Market share')
    expect(c.data.datasets[0].data).toEqual([0.45, 0.3, 0.25])
    expect(c.data.datasets[0].order).toBe(1)
  })

  it('breaks a tie by alias number, P1 first', () => {
    const c = cfg(day(2, { P3: 0.3, P1: 0.3, P2: 0.4 }))
    expect(c.data.labels).toEqual(['Name P2', 'Name P1', 'Name P3'])
  })

  it('orders aliases numerically, not alphabetically, on a tie (P2 before P10)', () => {
    const c = cfg(day(2, { P10: 0.2, P2: 0.2, P1: 0.6 }))
    expect(c.data.labels).toEqual(['Name P1', 'Name P2', 'Name P10'])
  })

  it('colours a bar by its alias, never by its rank (failure mode 2)', () => {
    const c = cfg(THREE)
    expect(typeof c.data.datasets[0].backgroundColor).toBe('function')
    expect(bg(c, 0)).toBe('#D9622B')
    expect(bg(c, 0)).toBe(pulqueriaStyle('P2').color)
    expect(bg(c, 1)).toBe(pulqueriaStyle('P3').color)
    expect(bg(c, 2)).toBe('#2A78D6')
  })

  it('keeps the colour when the same pulquería changes rank', () => {
    const swapped = cfg(day(5, { P1: 0.5, P2: 0.2, P3: 0.3 }))
    expect(bg(swapped, 0)).toBe('#2A78D6')
    expect(bg(swapped, 2)).toBe('#D9622B')
  })

  it('hatches a P7-P12 bar', () => {
    const sentinel = { sentinel: true }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect: () => undefined, beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined,
      createPattern: () => sentinel,
    } as unknown as CanvasRenderingContext2D)
    const c = cfg(day(6, { P1: 0.2, P7: 0.5, P2: 0.3 }))
    expect(c.data.labels).toEqual(['Name P7', 'Name P2', 'Name P1'])
    expect(bg(c, 0)).toBe(sentinel)
    expect(bg(c, 1)).toBe(pulqueriaStyle('P2').color)
    expect(bg(c, 2)).toBe(pulqueriaStyle('P1').color)
    expect(hatched(pulqueriaStyle('P7').color)()).toBe(sentinel)
  })

  it('borders only the own bar, 2px ink, in bar order', () => {
    const c = cfg(THREE)
    expect(c.data.datasets[0].borderWidth).toEqual([0, 0, 2])
    expect(c.data.datasets[0].borderColor).toEqual([CHART_COLORS['card'], CHART_COLORS['card'], CHART_COLORS['ink']])
    expect(cfg(THREE, 'P2').data.datasets[0].borderWidth).toEqual([2, 0, 0])
  })

  it('adds the fair-share rule at 1 / n on top of the bars (failure mode 3)', () => {
    const rule = cfg(THREE).data.datasets[1]
    expect(rule.type).toBe('line')
    expect(rule.label).toBe('Fair share (1 ÷ 3)')
    expect(rule.data).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(rule.indexAxis).toBe('y')
    expect(rule.borderColor).toBe(CHART_COLORS['ink-muted'])
    expect(rule.borderWidth).toBe(1.5)
    expect(rule.borderDash).toEqual([6, 4])
    expect(rule.pointRadius).toBe(0)
    expect(rule.pointHoverRadius).toBe(0)
    expect(rule.order).toBe(0)
  })

  it('takes n from the day, not from the seats or a fixed four (failure mode 3)', () => {
    const two = cfg(day(1, { P1: 0.5, P2: 0.5 })).data.datasets[1]
    expect(two.data).toEqual([0.5, 0.5])
    expect(two.label).toBe('Fair share (1 ÷ 2)')
    const six = cfg(day(1, { P1: 0.2, P2: 0.2, P3: 0.2, P4: 0.1, P5: 0.1, P6: 0.2 })).data.datasets[1]
    expect(six.data).toEqual(Array(6).fill(1 / 6))
    expect(six.label).toBe('Fair share (1 ÷ 6)')
  })

  it('scales x from 0 to the largest share plus a margin, in tenths, capped at 1', () => {
    expect(cfg(THREE).options.scales.x.min).toBe(0)
    expect(cfg(THREE).options.scales.x.max).toBe(0.5)
    expect(cfg(day(1, { P1: 0.25, P2: 0.25, P3: 0.25, P4: 0.25 })).options.scales.x.max).toBe(0.3)
    expect(cfg(day(1, { P1: 0.97, P2: 0.03 })).options.scales.x.max).toBe(1)
    expect(cfg(day(1, { P1: 1 })).options.scales.x.max).toBe(1)
  })

  it('titles the x axis and formats its ticks as percents', () => {
    const x = cfg(THREE).options.scales.x
    expect(x.title.text).toBe('Share of units sold')
    expect(x.ticks.callback(0.3, 0, [])).toBe(formatPercent(0.3))
  })
})

describe('ShareBars component', () => {
  const history = [day(1, { P1: 0.2, P2: 0.5, P3: 0.3 }), day(2, { P1: 0.4, P2: 0.4, P3: 0.2 }), THREE]

  function show(d = THREE, publicHistory = history) {
    return render(createElement(ShareBars, { day: d, ownAlias: 'P1', publicHistory }))
  }

  it('shows the Your market share tile with the own share', () => {
    show()
    const tile = screen.getByText('Your market share').parentElement?.parentElement as HTMLElement
    expect(tile.textContent).toContain('25%')
  })

  it('draws the sparkline of the own share over the days, aria-hidden', () => {
    show()
    const tile = screen.getByText('Your market share').parentElement?.parentElement as HTMLElement
    const svg = tile.querySelector('svg[aria-hidden="true"]') as SVGElement
    expect(svg.getAttribute('width')).toBe('96')
    expect(svg.getAttribute('height')).toBe('24')
    const line = svg.querySelector('polyline') as SVGPolylineElement
    expect(line.getAttribute('stroke')).toBe('currentColor')
    expect(line.getAttribute('class')).toContain('text-accent')
    expect(line.getAttribute('stroke-width')).toBe('1.5')
    expect(line.getAttribute('fill')).toBe('none')
    const pts = (line.getAttribute('points') ?? '').trim().split(/\s+/).map((p) => p.split(',').map(Number))
    expect(pts).toHaveLength(3)
    expect(pts[0][0]).toBeLessThan(pts[1][0])
    expect(pts[1][0]).toBeLessThan(pts[2][0])
    // shares 0.2, 0.4, 0.25: the largest is highest (smallest y)
    expect(pts[1][1]).toBeLessThan(pts[2][1])
    expect(pts[2][1]).toBeLessThan(pts[0][1])
  })

  it('scales y from zero at the bottom to the largest value at the top', () => {
    show(day(2, { P1: 0.4 }), [day(1, { P1: 0.2 }), day(2, { P1: 0.4 })])
    const line = document.querySelector('svg[aria-hidden="true"] polyline') as SVGPolylineElement
    const pts = (line.getAttribute('points') ?? '').trim().split(/\s+/).map((p) => p.split(',').map(Number))
    // half the maximum sits half way between the top point and the bottom
    expect(pts[0][1]).toBeGreaterThan(pts[1][1])
    expect(Math.abs(pts[0][1] - 12)).toBeLessThan(1)
  })

  it('draws a single 3px circle for one day', () => {
    show(day(1, { P1: 0.5, P2: 0.5 }), [day(1, { P1: 0.5, P2: 0.5 })])
    const svg = document.querySelector('svg[aria-hidden="true"]') as SVGElement
    expect(svg.querySelector('polyline')).toBeNull()
    expect(svg.querySelectorAll('circle')).toHaveLength(1)
    expect(svg.querySelector('circle')?.getAttribute('r')).toBe('3')
  })

  it('skips a day where the player is missing', () => {
    show(THREE, [day(1, { P2: 1 }), day(2, { P1: 0.4, P2: 0.6 }), THREE])
    const line = document.querySelector('svg[aria-hidden="true"] polyline') as SVGPolylineElement
    expect((line.getAttribute('points') ?? '').trim().split(/\s+/)).toHaveLength(2)
  })

  it('puts the bars in a ChartBox with the specified title, label, height and legend', () => {
    show()
    expect(screen.getByText('Market share yesterday')).toBeInTheDocument()
    const img = screen.getByRole('img', {
      name: "Horizontal bars of each pulquería's share of yesterday's market, largest first, with the fair share marked",
    })
    expect(img.style.height).toBe(`${(28 * 3 + 48) / 16}rem`)
    expect(within(img.closest('figure') as HTMLElement).getByText('Fair share (1 ÷ 3)')).toBeInTheDocument()
  })

  it('hands the chart the builder configuration', () => {
    show()
    const id = document.querySelector('[data-chart-id]')?.getAttribute('data-chart-id') as string
    expect(seen.get(id)?.data.datasets[0].data).toEqual([0.45, 0.3, 0.25])
    expect(seen.get(id)?.data.datasets[1].data).toEqual([1 / 3, 1 / 3, 1 / 3])
  })

  it('grows the plot with the number of pulquerías', () => {
    const four = day(4, { P1: 0.25, P2: 0.25, P3: 0.25, P4: 0.25 })
    show(four, [four])
    expect(screen.getByRole('img', { name: /Horizontal bars/ }).style.height).toBe(`${(28 * 4 + 48) / 16}rem`)
  })

  it('has a table in the bars order with the You chip on the own row', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = screen.getByRole('table', { name: 'Market share yesterday' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Pulquería', 'Share'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Name P2'),
      expect.stringContaining('Name P3'),
      expect.stringContaining('Name P1'),
    ])
    expect(rows[0].textContent).toContain('45%')
    expect(rows[2].textContent).toContain('You')
    expect(rows[0].textContent).not.toContain('You')
  })
})

describe('SharePie is gone (acceptance 9)', () => {
  it('has no file', () => {
    expect(existsSync(resolve(process.cwd(), 'src/components/game/SharePie.tsx'))).toBe(false)
  })
})
