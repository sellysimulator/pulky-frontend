/**
 * Section 36 - the day ledger (spec 8.1, 13.7). Acceptance criteria 1, 5 (ledger first); failure mode 1.
 * Charts are mocked (no canvas in jsdom); assertions are on the configuration and on the table view.
 */
import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

import DayLedgerChart from '../components/game/DayLedgerChart'
import { buildDayLedgerConfig, dayLedgerSteps } from '../components/game/dayLedgerConfig'
import { CHART_COLORS } from '../components/charts/chartSetup'
import type { DayRecord } from '../types/game'
import { formatMoney, formatSignedMoney } from '../utils/format'

function rec(over: Partial<DayRecord> = {}): DayRecord {
  return {
    day: 3,
    revenue_sales: 0,
    revenue_salvage: 0,
    revenue_peer: 0,
    refund_insurance: 0,
    refund_futures: 0,
    cost_spot: 0,
    cost_futures: 0,
    cost_peer: 0,
    cost_transport: 0,
    cost_insurance: 0,
    cost_conservation: 0,
    cost_holding: 0,
    cost_backlog: 0,
    profit: 0,
    ...over,
  } as unknown as DayRecord
}

const DAY3 = rec({
  revenue_sales: 600,
  revenue_salvage: 5,
  revenue_peer: 30,
  refund_insurance: 12,
  refund_futures: 0,
  cost_spot: 200,
  cost_futures: 60,
  cost_peer: 20,
  cost_transport: 7,
  cost_insurance: 2,
  cost_conservation: 0,
  cost_holding: 5,
  cost_backlog: 0,
  profit: 353,
})

const PAIRS = [
  [0, 600], [600, 605], [605, 635], [635, 647], [647, 647],
  [647, 447], [447, 387], [387, 367], [367, 360], [360, 358], [358, 358], [358, 353], [353, 353],
  [0, 353],
]

const LABELS = [
  'Sales revenue', 'Salvage', 'Peer sales', 'Insurance refunds', 'Futures refunds',
  'Spot', 'Futures', 'Peer purchases', 'Transport', 'Insurance fees', 'Conservation', 'Holding cost', 'Backlog penalty',
  'Profit',
]

describe('dayLedgerSteps', () => {
  it('gives the worked example pairs, every step present even at zero', () => {
    expect(dayLedgerSteps(DAY3).map((s) => [s.from, s.to])).toEqual(PAIRS)
  })

  it('has the specified keys, labels and kinds in order', () => {
    const steps = dayLedgerSteps(DAY3)
    expect(steps.map((s) => s.key)).toEqual([
      'revenue_sales', 'revenue_salvage', 'revenue_peer', 'refund_insurance', 'refund_futures',
      'cost_spot', 'cost_futures', 'cost_peer', 'cost_transport', 'cost_insurance', 'cost_conservation', 'cost_holding', 'cost_backlog',
      'profit',
    ])
    expect(steps.map((s) => s.label)).toEqual(LABELS)
    expect(steps.map((s) => s.kind)).toEqual([...Array(5).fill('in'), ...Array(8).fill('out'), 'profit'])
    expect(steps.map((s) => s.amount)).toEqual([600, 5, 30, 12, 0, 200, 60, 20, 7, 2, 0, 5, 0, 353])
  })

  it('lists all 14 steps for an all-zero record', () => {
    const steps = dayLedgerSteps(rec())
    expect(steps).toHaveLength(14)
    expect(steps.every((s) => s.from === 0 && s.to === 0)).toBe(true)
  })

  it('ends the last out step at the profit to the cent for a balanced record', () => {
    const steps = dayLedgerSteps(DAY3)
    expect(steps[12].to).toBe(DAY3.profit)
    expect(steps[13].to).toBe(DAY3.profit)
  })

  it('rounds each running total to the cent (no float drift)', () => {
    const steps = dayLedgerSteps(rec({ revenue_sales: 0.1, revenue_salvage: 0.2, revenue_peer: 0.3, profit: 0.6 }))
    expect(steps[1].to).toBe(0.3)
    expect(steps[2].to).toBe(0.6)
  })

  it('draws the profit bar from zero to the record profit even when the lines are a cent off (failure mode 1)', () => {
    const steps = dayLedgerSteps({ ...DAY3, profit: 353.01 })
    const profit = steps[13]
    expect([profit.from, profit.to]).toEqual([0, 353.01])
    expect(steps[12].to).toBe(353)
  })

  it('includes salvage and the refunds in the running total (failure mode 1)', () => {
    const steps = dayLedgerSteps(rec({ revenue_salvage: 5, refund_insurance: 12, refund_futures: 8, profit: 25 }))
    expect(steps[4].to).toBe(25)
  })
})

describe('buildDayLedgerConfig', () => {
  it('is a horizontal bar chart of the 14 labels with one floating Ledger dataset', () => {
    const cfg = buildDayLedgerConfig(DAY3)
    expect(cfg.type).toBe('bar')
    expect(cfg.options?.indexAxis).toBe('y')
    expect(cfg.data.labels).toEqual(LABELS)
    expect(cfg.data.datasets).toHaveLength(1)
    const ds = cfg.data.datasets[0]
    expect(ds.label).toBe('Ledger')
    expect(ds.data).toEqual(PAIRS)
    expect(ds.borderSkipped).toBe(false)
  })

  it('colours in p1, out p2, profit ink', () => {
    const colours = buildDayLedgerConfig(DAY3).data.datasets[0].backgroundColor as string[]
    expect(colours).toEqual([
      ...Array(5).fill(CHART_COLORS['p1']),
      ...Array(8).fill(CHART_COLORS['p2']),
      CHART_COLORS['ink'],
    ])
  })

  it('titles the x axis $ and has no legend in the canvas', () => {
    const opts = buildDayLedgerConfig(DAY3).options as any // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(opts.scales.x.title.text).toBe('$')
    expect(opts.plugins?.legend?.display).toBe(false)
  })
})

describe('DayLedgerChart', () => {
  it('is a ChartBox titled for the day, labelled, 384px tall, with the static legend', () => {
    render(createElement(DayLedgerChart, { record: DAY3 }))
    expect(screen.getByText('Day 3: where the profit came from')).toBeInTheDocument()
    const img = screen.getByRole('img', { name: "Waterfall of day 3's money in and out, ending at its profit" })
    expect(img.style.height).toBe('24rem')
    const box = img.closest('figure') as HTMLElement
    expect(within(box).getByText('Money in')).toBeInTheDocument()
    expect(within(box).getByText('Money out')).toBeInTheDocument()
    expect(within(box).getByText('Profit')).toBeInTheDocument()
  })

  it('hands the chart the builder configuration', () => {
    render(createElement(DayLedgerChart, { record: DAY3 }))
    const id = document.querySelector('[data-chart-id]')?.getAttribute('data-chart-id') as string
    const props = seen.get(id)
    expect(props?.data.datasets[0].data).toEqual(PAIRS)
    expect(props?.options.indexAxis).toBe('y')
  })

  it("has a table with the day's ledger: signed amounts and running totals", () => {
    render(createElement(DayLedgerChart, { record: DAY3 }))
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = screen.getByRole('table', { name: "Day 3's ledger" })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Line', 'Amount', 'Running total'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(14)
    const cells = (i: number): string[] => within(rows[i]).getAllByRole('cell').map((c) => c.textContent ?? '')
    expect(cells(0)).toEqual(['Sales revenue', formatSignedMoney(600), formatMoney(600)])
    expect(cells(5)).toEqual(['Spot', formatSignedMoney(-200), formatMoney(447)])
    expect(cells(10)).toEqual(['Conservation', formatSignedMoney(-0), formatMoney(358)])
    expect(cells(13)).toEqual(['Profit', formatSignedMoney(353), formatMoney(353)])
  })

  it('shows a negative profit as it is', () => {
    render(createElement(DayLedgerChart, { record: rec({ day: 2, cost_spot: 40, profit: -40 }) }))
    fireEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = screen.getByRole('table', { name: "Day 2's ledger" })
    const last = within(table).getAllByRole('row').slice(-1)[0]
    expect(Array.from(last.querySelectorAll('td')).map((c) => c.textContent)).toEqual(['Profit', formatSignedMoney(-40), formatMoney(-40)])
  })
})
