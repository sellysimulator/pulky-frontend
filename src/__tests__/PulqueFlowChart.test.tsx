/**
 * Section 35 - the flow: buildPulqueFlowConfig, FLOW_NODE_NAMES and PulqueFlowChart
 * (plan 35 section 3.3; acceptance criteria 5, 9; failure mode 2).
 * The View control, Compare all and percent are in ResultsSummary.test.tsx / demandSupplyConfig.test.ts.
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

import PulqueFlowChart from '../components/results/PulqueFlowChart'
import { FLOW_NODE_NAMES, buildPulqueFlowConfig } from '../components/results/resultsChartsConfig'
import { CHART_COLORS, hatchPattern } from '../components/charts/chartSetup'
import { formatPercent, formatQty } from '../utils/format'
import {
  BAND_TABLE, FLOW_DISTINCT, FLOW_EXAMPLE, FLOW_KEYS, FLOW_UNBALANCED, NODE_COLUMNS, NODE_NAMES, NODE_ORDER,
  expectedBands, makeFlowView, makeSmallView,
} from './fixtures/resultsFlow'
import { NAMES } from './fixtures/results'
import { allCharts } from './fixtures/resultsHelpers'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const view = (flows: Record<string, typeof FLOW_EXAMPLE>) => makeSmallView(undefined, undefined, flows)
const build = (f: typeof FLOW_EXAMPLE, alias = 'P1'): { cfg: Dict; ds: Dict } => {
  const cfg = buildPulqueFlowConfig(view({ [alias]: f }), alias) as unknown as Dict
  return { cfg, ds: cfg.data.datasets[0] }
}
const ctx = (from: string, to: string) => ({ raw: { from, to, flow: 1 } })

describe('FLOW_NODE_NAMES', () => {
  it('names the fourteen nodes', () => {
    expect(FLOW_NODE_NAMES).toEqual(NODE_NAMES)
  })
})

describe('buildPulqueFlowConfig bands (criterion 5)', () => {
  it('is a sankey chart with one dataset', () => {
    const { cfg } = build(FLOW_EXAMPLE)
    expect(cfg.type).toBe('sankey')
    expect(cfg.data.datasets).toHaveLength(1)
  })

  it('section 4: the eleven bands of the example, no futures and no in-transit band', () => {
    const { ds } = build(FLOW_EXAMPLE)
    expect(ds.data).toEqual([
      { from: 'spot', to: 'shipped', flow: 30 },
      { from: 'pipeline', to: 'shipped', flow: 10 },
      { from: 'shipped', to: 'lost', flow: 5 },
      { from: 'shipped', to: 'delivered', flow: 35 },
      { from: 'delivered', to: 'cellar', flow: 35 },
      { from: 'initial', to: 'cellar', flow: 20 },
      { from: 'bought', to: 'cellar', flow: 2 },
      { from: 'cellar', to: 'sold', flow: 50 },
      { from: 'cellar', to: 'peer_sold', flow: 1 },
      { from: 'cellar', to: 'spoiled', flow: 3 },
      { from: 'cellar', to: 'left', flow: 3 },
    ])
  })

  it('reads the named field for every band, in order (twelve different values)', () => {
    const { ds } = build(FLOW_DISTINCT)
    expect(ds.data).toEqual(expectedBands(FLOW_DISTINCT))
    expect(ds.data).toHaveLength(13)
  })

  it('leaves out each band whose field is 0, and only that band', () => {
    for (const key of FLOW_KEYS) {
      const f = { ...FLOW_DISTINCT, [key]: 0 }
      const { ds } = build(f)
      expect(ds.data, `${key} = 0`).toEqual(expectedBands(f))
      expect(ds.data.length, `${key} = 0`).toBeLessThan(13)
    }
  })

  it('failure mode 2: a flow that does not balance still gives every band its own field, never a remainder', () => {
    const { ds } = build(FLOW_UNBALANCED)
    const band = (from: string, to: string) => ds.data.find((b: Dict) => b.from === from && b.to === to)
    expect(band('shipped', 'delivered').flow).toBe(35) // a remainder would be 30 - 5 = 25
    expect(band('delivered', 'cellar').flow).toBe(35)
    expect(band('shipped', 'lost').flow).toBe(5)
    expect(band('spot', 'shipped').flow).toBe(30)
    expect(band('cellar', 'left').flow).toBe(3)
    expect(ds.data).toEqual(expectedBands(FLOW_UNBALANCED))
  })

  it('uses the flow of the pulquería asked for, not another one', () => {
    const v = view({ P1: FLOW_EXAMPLE, P2: FLOW_DISTINCT })
    const cfg = buildPulqueFlowConfig(v, 'P2') as unknown as Dict
    expect(cfg.data.datasets[0].data).toEqual(expectedBands(FLOW_DISTINCT))
  })

  it('gives empty data for a pulquería with no flow', () => {
    const cfg = buildPulqueFlowConfig(view({ P1: FLOW_EXAMPLE }), 'P3') as unknown as Dict
    expect(cfg.data.datasets).toHaveLength(1)
    expect(cfg.data.datasets[0].data).toEqual([])
  })

  it('exposes the band table as the oracle says (guard on the fixture)', () => {
    expect(BAND_TABLE).toHaveLength(13)
  })
})

describe('buildPulqueFlowConfig nodes and labels', () => {
  it('sets column and priority for the nodes that appear', () => {
    const { ds } = build(FLOW_DISTINCT)
    for (const [i, node] of NODE_ORDER.entries()) {
      expect(ds.column[node], `column of ${node}`).toBe(NODE_COLUMNS[node])
      expect(ds.priority[node], `priority of ${node}`).toBe(i)
    }
  })

  it('section 4 labels: Shipped 40, Lost in transit 5 · 13%, Cellar 57, Sold to customers 50 · 88%', () => {
    const { ds } = build(FLOW_EXAMPLE)
    expect(ds.labels.shipped).toBe('Shipped\n40')
    expect(ds.labels.lost).toBe('Lost in transit\n5 · 13%')
    expect(ds.labels.cellar).toBe('Cellar\n57')
    expect(ds.labels.sold).toBe('Sold to customers\n50 · 88%')
  })

  it('labels only the nodes that appear in a band', () => {
    const { ds } = build(FLOW_EXAMPLE)
    expect(Object.keys(ds.labels)).not.toContain('futures')
    expect(Object.keys(ds.labels)).not.toContain('in_transit')
    expect(Object.keys(ds.labels).sort()).toEqual(
      ['spot', 'pipeline', 'shipped', 'lost', 'delivered', 'initial', 'bought', 'cellar', 'sold', 'peer_sold', 'spoiled', 'left'].sort(),
    )
  })

  it('shares: of the shipped units for the nodes up to delivered, of the cellar units for the nodes into and out of the cellar', () => {
    const f = FLOW_DISTINCT
    const shipped = f.initial_pipeline + f.shipped_spot + f.shipped_futures
    const cellar = f.initial_stock + f.delivered + f.peer_bought
    const { ds } = build(f)
    const line = (name: string, units: number, total: number) => `${name}\n${formatQty(units)} · ${formatPercent(units / total)}`
    expect(ds.labels.shipped).toBe(`Shipped\n${formatQty(shipped)}`)
    expect(ds.labels.cellar).toBe(`Cellar\n${formatQty(cellar)}`)
    expect(ds.labels.spot).toBe(line('Spot shipments', f.shipped_spot, shipped))
    expect(ds.labels.futures).toBe(line('Futures shipments', f.shipped_futures, shipped))
    expect(ds.labels.pipeline).toBe(line('On the way at the start', f.initial_pipeline, shipped))
    expect(ds.labels.lost).toBe(line('Lost in transit', f.lost_transport, shipped))
    expect(ds.labels.in_transit).toBe(line('Still in transit at the end', f.in_transit_end, shipped))
    expect(ds.labels.delivered).toBe(line('Delivered', f.delivered, shipped))
    expect(ds.labels.initial).toBe(line('Initial stock', f.initial_stock, cellar))
    expect(ds.labels.bought).toBe(line('Bought from pulquerías', f.peer_bought, cellar))
    expect(ds.labels.sold).toBe(line('Sold to customers', f.sold, cellar))
    expect(ds.labels.peer_sold).toBe(line('Sold to pulquerías', f.peer_sold, cellar))
    expect(ds.labels.spoiled).toBe(line('Spoiled', f.spoiled, cellar))
    expect(ds.labels.left).toBe(line('Left at the end', f.closing_stock, cellar))
  })
})

describe('buildPulqueFlowConfig colours', () => {
  const { ds } = build(FLOW_DISTINCT)
  const C = CHART_COLORS
  const byTo: Array<[string, string]> = [
    ['lost', C['series-lost']],
    ['in_transit', C['series-liquidated']],
    ['left', C['series-liquidated']],
    ['sold', C['series-sold']],
    ['spoiled', C['series-spoiled']],
    ['shipped', '#6B635466'],
    ['delivered', '#6B635466'],
    ['cellar', '#6B635466'],
  ]

  it('colours a band by where it ends, flowColor and hoverFlowColor alike', () => {
    for (const [to, colour] of byTo) {
      expect(ds.flowColor(ctx('x', to)), `flowColor ${to}`).toBe(colour)
      expect(ds.hoverFlowColor(ctx('x', to)), `hoverFlowColor ${to}`).toBe(colour)
    }
    expect(ds.flowColor(ctx('cellar', 'peer_sold'))).toBe(hatchPattern(C['series-sold']))
    expect(ds.hoverFlowColor(ctx('cellar', 'peer_sold'))).toBe(hatchPattern(C['series-sold']))
  })

  it('colours the nodes: an outcome node takes its band colour, every other node is ink-subtle', () => {
    for (const [node, colour] of byTo.filter(([n]) => !['shipped', 'delivered', 'cellar'].includes(n))) {
      expect(ds.colorTo(ctx('cellar', node)), `colorTo ${node}`).toBe(colour)
      expect(ds.colorFrom(ctx(node, 'x')), `colorFrom ${node}`).toBe(colour)
    }
    expect(ds.colorTo(ctx('cellar', 'peer_sold'))).toBe(hatchPattern(C['series-sold']))
    for (const node of ['spot', 'futures', 'pipeline', 'shipped', 'delivered', 'initial', 'bought', 'cellar']) {
      expect(ds.colorFrom(ctx(node, 'x')), `colorFrom ${node}`).toBe(C['ink-subtle'])
      expect(ds.colorTo(ctx('x', node)), `colorTo ${node}`).toBe(C['ink-subtle'])
    }
  })

  it('uses colorMode "to", never "gradient", and no gradient anywhere in the configuration', () => {
    expect(ds.colorMode).toBe('to')
    expect(JSON.stringify(build(FLOW_DISTINCT).cfg)).not.toContain('gradient')
  })

  it('sets the node width, the size and the node label colour', () => {
    expect(ds.nodeWidth).toBe(10)
    expect(ds.size).toBe('max')
    const found: unknown[] = []
    const walk = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(walk)
      else if (n && typeof n === 'object') {
        for (const [k, v] of Object.entries(n)) {
          if (k === 'nodeLabels') found.push(v)
          walk(v)
        }
      }
    }
    walk(build(FLOW_DISTINCT).cfg)
    expect(found.length).toBeGreaterThan(0)
    expect((found[0] as Dict).color).toBe(C.ink)
  })

  it('touches no canvas: building with no 2D context does not throw', () => {
    expect(() => buildPulqueFlowConfig(makeFlowView(), 'P1')).not.toThrow()
  })
})

describe('PulqueFlowChart', () => {
  const flowView = makeFlowView()
  const chips = () => within(screen.getByRole('group', { name: 'Pulquería' })).getAllByRole('button')
  const chipAlias = (b: HTMLElement) => Object.entries(NAMES).find(([, n]) => b.textContent?.includes(n))![0]
  const sankey = (): Dict => {
    const charts = allCharts()
    expect(charts).toHaveLength(1)
    expect(charts[0].type).toBe('sankey')
    return charts[0]
  }

  it('has a chip per pulquería by alias number, the first pressed', () => {
    render(<PulqueFlowChart view={flowView} myAlias={null} />)
    expect(chips().map(chipAlias)).toEqual(['P1', 'P2', 'P3'])
    expect(chips().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    for (const b of chips()) expect(b).toHaveAttribute('type', 'button')
  })

  it('puts myAlias first, marked You, then the others by alias number', () => {
    render(<PulqueFlowChart view={flowView} myAlias="P3" />)
    expect(chips().map(chipAlias)).toEqual(['P3', 'P1', 'P2'])
    expect(chips()[0]).toHaveTextContent('You')
    expect(chips()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(chips()[1]).not.toHaveTextContent('You')
    expect(screen.getByText("El Tinacal: from shipments to sold, spoiled and left at the end")).toBeInTheDocument()
  })

  it('titles the box and names the plot for the chosen pulquería', () => {
    render(<PulqueFlowChart view={flowView} myAlias={null} />)
    expect(screen.getByText("Don Agave: from shipments to sold, spoiled and left at the end")).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: "Flow chart of Don Agave's pulque from the supplier through the cellar to where it ended",
      }),
    ).toBeInTheDocument()
  })

  it('plots the builder\'s sankey for the chosen pulquería and follows the chips', () => {
    render(<PulqueFlowChart view={flowView} myAlias={null} />)
    expect(sankey().data.datasets[0].data).toEqual(expectedBands(FLOW_EXAMPLE))
    fireEvent.click(chips()[1])
    expect(chips()[1]).toHaveAttribute('aria-pressed', 'true')
    expect(chips()[0]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText("La Chula: from shipments to sold, spoiled and left at the end")).toBeInTheDocument()
    expect(sankey().data.datasets[0].data).toEqual(expectedBands(FLOW_DISTINCT))
    fireEvent.click(chips()[2])
    expect(sankey().data.datasets[0].data).toEqual(expectedBands(FLOW_UNBALANCED))
  })

  it('criterion 9: the table lists From, To and Units for each band in the builder\'s order, with node names', async () => {
    render(<PulqueFlowChart view={flowView} myAlias={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Show table/ }))
    const table = screen.getByRole('table', { name: "Don Agave: from shipments to sold, spoiled and left at the end" })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['From', 'To', 'Units'])
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    const bands = expectedBands(FLOW_EXAMPLE)
    expect(rows).toHaveLength(bands.length)
    bands.forEach((b, i) => {
      expect(rows[i][0]).toBe(NODE_NAMES[b.from])
      expect(rows[i][1]).toBe(NODE_NAMES[b.to])
      expect(rows[i][2]).toContain(formatQty(b.flow))
    })
  })
})
