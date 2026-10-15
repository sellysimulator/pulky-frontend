/**
 * Section 22 — `src/components/charts/chartSetup.ts` (design.md §3, §4.4, §9).
 * Acceptance criteria 4, 5, 6; failure mode 7 (hardcoded hex drift).
 * jsdom has no canvas, so nothing is drawn: tests read Chart.js's registry and
 * defaults, and call the plugin with a fake chart.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ChartSetup = typeof import('../components/charts/chartSetup')
type ChartJs = typeof import('chart.js')

/** Fresh copies of both modules, so registry and defaults start untouched. */
async function fresh(): Promise<{ setup: ChartSetup; chartjs: ChartJs }> {
  vi.resetModules()
  const chartjs = await import('chart.js')
  const setup = await import('../components/charts/chartSetup')
  return { setup, chartjs }
}

const fontSize = (font: unknown): number => (font as { size: number }).size
const norm = (hex: string): string => hex.trim().toLowerCase()

/** `--color-x: #hex` pairs of src/index.css's @theme block, keyed without the `--color-` prefix. */
function cssColors(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = norm(m[2])
  return out
}

/** Keys whose CHART_COLORS value differs from (or is missing in) the stylesheet. */
function mismatches(colors: Record<string, string>, css: Record<string, string>): string[] {
  return Object.keys(colors).filter((k) => css[k] === undefined || norm(colors[k]) !== css[k])
}

describe('CHART_COLORS parity with src/index.css (criterion 4, failure mode 7)', () => {
  it('holds every chart colour design.md §2-§3 gives a token', async () => {
    const { setup } = await fresh()
    const required = [
      'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
      'series-demand', 'series-delivered', 'series-sold', 'series-spoiled',
      'series-backlog', 'series-lost', 'series-liquidated',
      'ink', 'ink-muted', 'ink-subtle', 'on-ink', 'card', 'border', 'border-strong',
      'ochre', 'peak', 'danger', 'warning',
    ]
    for (const key of required) expect(setup.CHART_COLORS[key], key).toBeTruthy()
  })

  it('every entry equals its --color-* value, asserted per key', async () => {
    const { setup } = await fresh()
    const css = cssColors()
    const keys = Object.keys(setup.CHART_COLORS)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(css[key], `--color-${key} exists in index.css`).toBeDefined()
      expect(norm(setup.CHART_COLORS[key]), `CHART_COLORS['${key}']`).toBe(css[key])
    }
  })

  it('the parity check names a single drifted key (a count would not)', async () => {
    const { setup } = await fresh()
    const css = cssColors()
    const drifted = { ...setup.CHART_COLORS, p3: '#6250d7' }
    expect(mismatches(setup.CHART_COLORS, css)).toEqual([])
    expect(mismatches(drifted, css)).toEqual(['p3'])
    expect(mismatches({ ...setup.CHART_COLORS, 'not-a-token': '#000000' }, css)).toEqual(['not-a-token'])
  })
})

describe('pulqueriaStyle (criterion 5, design.md §3.1)', () => {
  const SLOTS: Array<[string, string, string]> = [
    ['P1', '#2a78d6', 'circle'],
    ['P2', '#d9622b', 'rect'],
    ['P3', '#6250d6', 'triangle'],
    ['P4', '#a88400', 'rectRot'],
    ['P5', '#c9518a', 'star'],
    ['P6', '#4a8a1f', 'crossRot'],
  ]

  it.each(SLOTS)('%s wears its own slot, solid and undashed', async (alias, color, pointStyle) => {
    const { setup } = await fresh()
    const s = setup.pulqueriaStyle(alias)
    expect(norm(s.color)).toBe(color)
    expect(s.pointStyle).toBe(pointStyle)
    expect(s.dashed).toBe(false)
    expect(s.hatched).toBe(false)
  })

  it.each(SLOTS.map(([alias, color, pointStyle], i) => [`P${i + 7}`, alias, color, pointStyle]))(
    '%s reuses the hue and point style of %s, dashed and hatched',
    async (alias, _base, color, pointStyle) => {
      const { setup } = await fresh()
      const s = setup.pulqueriaStyle(alias)
      expect(norm(s.color)).toBe(color)
      expect(s.pointStyle).toBe(pointStyle)
      expect(s.dashed).toBe(true)
      expect(s.hatched).toBe(true)
    },
  )

  it('matches the worked examples of the section document', async () => {
    const { setup } = await fresh()
    expect(setup.pulqueriaStyle('P8')).toMatchObject({ pointStyle: 'rect', dashed: true, hatched: true })
    expect(norm(setup.pulqueriaStyle('P8').color)).toBe('#d9622b')
    expect(norm(setup.pulqueriaStyle('P12').color)).toBe('#4a8a1f')
  })

  it('colour follows the alias: P1..P6 colours are all different', async () => {
    const { setup } = await fresh()
    const colors = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((a) => norm(setup.pulqueriaStyle(a).color))
    expect(new Set(colors).size).toBe(6)
  })
})

describe('MEASURE_STYLES (design.md §3.3)', () => {
  it('has the seven measures with their series colours', async () => {
    const { setup } = await fresh()
    const expected: Record<string, string> = {
      demand: 'series-demand',
      delivered: 'series-delivered',
      sold: 'series-sold',
      spoiled: 'series-spoiled',
      backlog: 'series-backlog',
      lost: 'series-lost',
      liquidated: 'series-liquidated',
    }
    expect(Object.keys(setup.MEASURE_STYLES).sort()).toEqual(Object.keys(expected).sort())
    for (const [measure, token] of Object.entries(expected)) {
      const style = setup.MEASURE_STYLES[measure as keyof typeof setup.MEASURE_STYLES]
      expect(norm(style.color), measure).toBe(norm(setup.CHART_COLORS[token]))
    }
  })

  it('market demand is the only undashed, 4px line; the others are 2.5px with their dash', async () => {
    const { setup } = await fresh()
    const m = setup.MEASURE_STYLES
    expect(m.demand.dash).toEqual([])
    expect(m.demand.width).toBe(4)
    expect(m.demand.pointStyle).toBe('circle')
    expect(m.delivered).toMatchObject({ dash: [12, 4], width: 2.5, pointStyle: 'rect' })
    expect(m.sold).toMatchObject({ dash: [6, 4], width: 2.5, pointStyle: 'triangle' })
    expect(m.spoiled).toMatchObject({ dash: [2, 4], width: 2.5, pointStyle: 'rectRot' })
    expect(m.backlog).toMatchObject({ dash: [12, 4, 2, 4], width: 2.5, pointStyle: 'star' })
  })
})

describe('registerCharts (criterion 6, design.md §9.1)', () => {
  it('is called once at module load: importing the module registers Chart.js with no explicit call', async () => {
    const { chartjs } = await fresh()
    const { registry } = chartjs.Chart
    expect(() => registry.getController('line')).not.toThrow()
    expect(() => registry.getController('bar')).not.toThrow()
    expect(() => registry.getPlugin('peakShading')).not.toThrow()
    expect(chartjs.Chart.defaults.maintainAspectRatio).toBe(false)
  })

  it('can be called twice without error', async () => {
    const { setup } = await fresh()
    expect(() => {
      setup.registerCharts()
      setup.registerCharts()
    }).not.toThrow()
  })

  it('registers line, bar, pie and doughnut, the two scales and the plugins Pulky uses', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const { registry } = chartjs.Chart
    for (const id of ['line', 'bar', 'pie', 'doughnut']) expect(() => registry.getController(id), id).not.toThrow()
    for (const id of ['category', 'linear']) expect(() => registry.getScale(id), id).not.toThrow()
    for (const id of ['tooltip', 'filler', 'peakShading']) expect(() => registry.getPlugin(id), id).not.toThrow()
    for (const id of ['line', 'point', 'bar', 'arc']) expect(() => registry.getElement(id), id).not.toThrow()
  })

  it('registers nothing else (piecemeal, not `registerables`)', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const { registry } = chartjs.Chart
    for (const id of ['radar', 'polarArea', 'scatter', 'bubble']) expect(() => registry.getController(id), id).toThrow()
    for (const id of ['time', 'logarithmic', 'radialLinear']) expect(() => registry.getScale(id), id).toThrow()
    for (const id of ['legend', 'title', 'subtitle']) expect(() => registry.getPlugin(id), id).toThrow()
  })

  it('sets the design.md §9.1 defaults', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const d = chartjs.Chart.defaults
    expect(String(d.font.family)).toContain('Figtree')
    expect(d.font.size).toBe(13)
    expect(norm(String(d.color))).toBe('#6b6354')
    expect(d.maintainAspectRatio).toBe(false)
    expect(d.plugins.legend.display).toBe(false)
    expect(norm(String(d.plugins.tooltip.backgroundColor))).toBe('#26221b')
    expect(d.plugins.tooltip.padding).toBe(10)
    expect(d.plugins.tooltip.cornerRadius).toBe(8)
    expect(d.plugins.tooltip.usePointStyle).toBe(true)
    expect(d.animation).toMatchObject({ duration: 250, easing: 'easeOutCubic' })
  })

  it('sets the axis, line, bar and pie defaults of design.md §9.1', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const d = chartjs.Chart.defaults as unknown as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(norm(String(d.scale.grid.color))).toBe('#e4dcc8')
    expect(d.scale.border.display).toBe(false)
    expect(d.scale.ticks).toMatchObject({ padding: 6, autoSkip: true, maxRotation: 0 })
    expect(d.scales.category.grid.display).toBe(false)
    expect(d.scales.linear.beginAtZero).toBe(true)
    expect(d.elements.line).toMatchObject({ borderWidth: 2.5, tension: 0, borderCapStyle: 'round', borderJoinStyle: 'round' })
    expect(d.elements.point).toMatchObject({ radius: 4, hoverRadius: 5, hitRadius: 8 })
    expect(d.elements.bar).toMatchObject({ borderRadius: 4, borderSkipped: 'start' })
    expect(d.datasets.bar.maxBarThickness).toBe(32)
    expect(d.elements.arc).toMatchObject({ borderWidth: 2 })
    expect(norm(String(d.elements.arc.borderColor))).toBe('#fffdf8')
    expect(chartjs.Chart.overrides.line.interaction).toMatchObject({ mode: 'index', intersect: false })
    expect(chartjs.Chart.overrides.bar.interaction).toMatchObject({ mode: 'nearest', intersect: true })
  })

  it('turns animation off under prefers-reduced-motion', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    try {
      const { setup, chartjs } = await fresh()
      setup.registerCharts()
      expect(chartjs.Chart.defaults.animation).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })
})

describe('applyChartScale (design.md §4.4)', () => {
  it('scales canvas text from the root size', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const d = chartjs.Chart.defaults

    setup.applyChartScale(16)
    expect(d.font.size).toBeCloseTo(13)
    expect(fontSize(d.plugins.tooltip.titleFont)).toBeCloseTo(14)
    expect(fontSize(d.plugins.tooltip.bodyFont)).toBeCloseTo(14)

    setup.applyChartScale(20)
    expect(d.font.size).toBeCloseTo(16.25)
    expect(fontSize(d.plugins.tooltip.titleFont)).toBeCloseTo(17.5)
    expect(fontSize(d.plugins.tooltip.bodyFont)).toBeCloseTo(17.5)
  })

  it('switches the default text colour to ink-muted above 16px', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    setup.applyChartScale(18)
    expect(norm(String(chartjs.Chart.defaults.color))).toBe(norm(setup.CHART_COLORS['ink-muted']))
  })
})

describe('peakShadingPlugin (design.md §9.3)', () => {
  interface Call {
    fn: string
    args: unknown[]
    fillStyle: unknown
    strokeStyle: unknown
    lineWidth: unknown
  }

  /** A canvas context that records every call with the style in force at that moment. */
  function fakeChart(days: number[], count = 7) {
    const calls: Call[] = []
    const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 }
    const ctx = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop in state) return state[prop]
          return (...args: unknown[]) => {
            calls.push({
              fn: prop,
              args,
              fillStyle: state.fillStyle,
              strokeStyle: state.strokeStyle,
              lineWidth: state.lineWidth,
            })
          }
        },
        set(_t, prop: string, value: unknown) {
          state[prop] = value
          return true
        },
      },
    )
    const left = 100
    const width = 70 * count
    const x = {
      min: 0,
      max: count - 1,
      left,
      right: left + width,
      width,
      ticks: Array.from({ length: count }, (_, i) => ({ value: i, label: String(i) })),
      getPixelForValue: (v: number) => left + (v + 0.5) * (width / count),
      getPixelForTick: (i: number) => left + (i + 0.5) * (width / count),
    }
    const chart = {
      ctx,
      chartArea: { left, right: left + width, top: 20, bottom: 220, width, height: 200 },
      scales: { x },
      options: { plugins: { peakShading: { days } } },
      width: 600,
      height: 260,
    }
    return { chart, calls, options: { days } }
  }

  /** The hook that runs behind the data. */
  async function drawBehind(days: number[]) {
    const { setup } = await fresh()
    const plugin = setup.peakShadingPlugin
    const { chart, calls, options } = fakeChart(days)
    const hook = plugin.beforeDatasetsDraw ?? plugin.beforeDraw
    expect(hook, 'a hook that runs before the datasets are drawn').toBeTypeOf('function')
    ;(hook as (c: unknown, a: unknown, o: unknown) => void).call(plugin, chart, { cancelable: true }, options)
    return { plugin, calls, chart }
  }

  it('is a plugin named peakShading, drawn behind the data', async () => {
    const { setup } = await fresh()
    expect(setup.peakShadingPlugin.id).toBe('peakShading')
    expect(setup.peakShadingPlugin.afterDatasetsDraw).toBeUndefined()
    expect(setup.peakShadingPlugin.afterDraw).toBeUndefined()
  })

  it('fills one peak-coloured column per listed day, inside the plot area', async () => {
    const { calls, chart } = await drawBehind([2, 3, 4])
    const peak = calls.filter((c) => c.fn === 'fillRect' && norm(String(c.fillStyle)) === '#f7edd3')
    expect(peak).toHaveLength(3)
    const xs = peak.map((c) => c.args[0] as number)
    expect(new Set(xs).size).toBe(3)
    for (const c of peak) {
      const [x, y, w, h] = c.args as number[]
      expect(x).toBeGreaterThanOrEqual(chart.chartArea.left - 0.5)
      expect(x + w).toBeLessThanOrEqual(chart.chartArea.right + 0.5)
      expect(y).toBeCloseTo(chart.chartArea.top)
      expect(h).toBeCloseTo(chart.chartArea.bottom - chart.chartArea.top)
      expect(w).toBeGreaterThan(0)
    }
  })

  it('draws a 3px ochre rule along the top of each peak column', async () => {
    const { calls, chart } = await drawBehind([2, 3])
    const filled = calls.filter(
      (c) => c.fn === 'fillRect' && norm(String(c.fillStyle)) === '#a06a12' && (c.args[3] as number) === 3,
    )
    const stroked = calls.filter((c) => c.fn === 'stroke' && norm(String(c.strokeStyle)) === '#a06a12' && c.lineWidth === 3)
    expect(filled.length === 2 || stroked.length >= 1).toBe(true)
    for (const c of filled) expect(c.args[1] as number).toBeCloseTo(chart.chartArea.top, 0)
  })

  it('draws nothing for an empty day list, and never shades a day not listed', async () => {
    const none = await drawBehind([])
    expect(none.calls.filter((c) => c.fn === 'fillRect')).toHaveLength(0)

    const one = await drawBehind([5])
    const peak = one.calls.filter((c) => c.fn === 'fillRect' && norm(String(c.fillStyle)) === '#f7edd3')
    expect(peak).toHaveLength(1)
  })
})

beforeEach(() => {
  vi.resetModules()
})
