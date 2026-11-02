/**
 * Section 22 — `src/components/charts/chartSetup.ts` (design.md §3, §4.4, §9).
 * Acceptance criteria 4, 5, 6; failure mode 7 (hardcoded hex drift).
 * jsdom has no canvas, so nothing is drawn: tests read Chart.js's registry and
 * defaults, and call the plugin with a fake chart.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defaults as chartjsDefaults } from 'chart.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ChartSetup = typeof import('../components/charts/chartSetup')
type ChartJs = typeof import('chart.js')

/** The keys of Chart.js's own `defaults.animation`, read before any test runs registerCharts. */
const CHARTJS_ANIMATION_KEYS = Object.keys(chartjsDefaults.animation)

/**
 * A fresh chartSetup, whose load runs registerCharts again. Chart.js itself is not reloaded (resetModules skips
 * node_modules), so its registry and defaults carry over from the tests before: registerCharts must reset them.
 */
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

/** Runs `fn` with matchMedia answering prefers-reduced-motion: reduce, then puts setup.ts's polyfill back. */
async function withReducedMotion(fn: () => unknown): Promise<void> {
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
    await fn()
  } finally {
    window.matchMedia = original
  }
}

/**
 * Gives the bar of a real chart a new colour, which starts a colour animation, then destroys the chart mid-way, as
 * an unmount does. jsdom has no canvas: a context that ignores every call, and BasicPlatform minus its animation: false.
 */
function destroyDuringColourAnimation({ BasicPlatform, Chart, animator }: ChartJs): void {
  class AnimatedPlatform extends BasicPlatform {
    updateConfig(): void {}
  }
  const canvas = { width: 300, height: 150, style: {} } as Record<string, unknown>
  const ctx = new Proxy({ canvas } as Record<string | symbol, unknown>, {
    get: (target, prop) => (prop in target ? target[prop] : () => ({ width: 0 })),
    set: () => true,
  })
  canvas.getContext = () => ctx
  const chart = new Chart(canvas as unknown as HTMLCanvasElement, {
    type: 'bar',
    platform: AnimatedPlatform,
    data: { labels: ['1'], datasets: [{ data: [1], backgroundColor: '#000000' }] },
  })
  try {
    chart.data.datasets[0].backgroundColor = '#ffffff'
    chart.update()
    chart.destroy()
  } finally {
    animator.remove(chart as never)
  }
}

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

  it('keeps every animation key Chart.js reads, so colour animations have an interpolator', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const { Animation, Chart } = chartjs
    expect(CHARTJS_ANIMATION_KEYS).toEqual(expect.arrayContaining(['type', 'fn', 'from', 'to']))
    for (const key of CHARTJS_ANIMATION_KEYS) expect(Object.keys(Chart.defaults.animation)).toContain(key)

    // What Animations.configure keeps for a colour property: only the keys of Chart.defaults.animation.
    const colors: Record<string, unknown> = { ...(Chart.defaults.animations.colors as object), duration: 250 }
    const kept = Object.fromEntries(Object.keys(Chart.defaults.animation).map((k) => [k, colors[k]]))
    const animation = new Animation(kept, { backgroundColor: '#000000' }, 'backgroundColor', '#ffffff')
    // cancel() ticks once, the same path as Animator.stop in the crash.
    expect(() => animation.cancel()).not.toThrow()
  })

  it('lets a real chart be destroyed while a colour animation runs (the unmount that sent 3D back to 2D)', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    expect(() => destroyDuringColourAnimation(chartjs)).not.toThrow()
  })

  it('rebuilds every animation key when reduced motion is turned off between two calls', async () => {
    const { setup, chartjs } = await fresh()
    await withReducedMotion(() => setup.registerCharts())
    expect(chartjs.Chart.defaults.animation).toBe(false)
    // Charts call registerCharts on every render, so a later call finds the `false` an earlier one left.
    setup.registerCharts()
    expect(() => destroyDuringColourAnimation(chartjs)).not.toThrow()
    for (const key of CHARTJS_ANIMATION_KEYS) expect(Object.keys(chartjs.Chart.defaults.animation)).toContain(key)
    expect(chartjs.Chart.defaults.animation).toMatchObject({ duration: 250, easing: 'easeOutCubic' })
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
    await withReducedMotion(async () => {
      const { setup, chartjs } = await fresh()
      setup.registerCharts()
      expect(chartjs.Chart.defaults.animation).toBe(false)
    })
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

/* ───────────────────────── Section 33: chart kit hardening ───────────────────────── */

interface KitCall {
  fn: string
  args: unknown[]
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: unknown
}

/** A canvas context that records every call with the style in force at that moment. */
function recordingCtx() {
  const calls: KitCall[] = []
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '', lineWidth: 1 }
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop in state) return state[prop]
        return (...args: unknown[]) => {
          calls.push({ fn: prop, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth })
        }
      },
      set(_t, prop: string, value: unknown) {
        state[prop] = value
        return true
      },
    },
  )
  return { ctx, calls }
}

interface KitChartOptions {
  count?: number
  plugins?: Record<string, unknown>
  datasets?: Array<{ data: Array<number | null | undefined> }>
  hidden?: number[]
}

/** A fake chart on a 7-day axis: plot left 100, right 590 (column 70), top 20, bottom 220. */
function kitChart({ count = 7, plugins = {}, datasets, hidden = [] }: KitChartOptions = {}) {
  const { ctx, calls } = recordingCtx()
  const left = 100
  const width = 70 * count
  const x = {
    min: 0,
    max: count - 1,
    getPixelForValue: (v: number) => left + (v + 0.5) * (width / count),
    getValueForPixel: (px: number) => (px - left) / (width / count) - 0.5,
  }
  const ds = datasets ?? [{ data: Array.from({ length: count }, (_, i) => i) }, { data: Array.from({ length: count }, (_, i) => i * 2) }]
  const chart = {
    ctx,
    chartArea: { left, right: left + width, top: 20, bottom: 220, width, height: 200 },
    scales: { x },
    data: { labels: Array.from({ length: count }, (_, i) => String(i + 1)), datasets: ds },
    options: { plugins },
    isDatasetVisible: vi.fn((i: number) => !hidden.includes(i)),
    setActiveElements: vi.fn(),
    tooltip: { setActiveElements: vi.fn() },
    update: vi.fn(),
  }
  return { chart, calls, x }
}

type Hook = (chart: unknown, args: unknown, options: unknown) => unknown
const hookOf = (plugin: object, name: string): Hook => (plugin as Record<string, Hook>)[name].bind(plugin)

describe('hatchPattern and hatched (section 33, design.md §3.1, §9.1)', () => {
  interface Tile {
    width: number
    height: number
    calls: KitCall[]
    pattern: object
  }

  /** Stubs getContext so each canvas tile gets its own recording context and createPattern returns a fresh object. */
  function stubCanvas(mode: 'context' | 'none' | 'nopattern' = 'context') {
    const tiles: Tile[] = []
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      if (mode === 'none') return null
      const { ctx, calls } = recordingCtx()
      const pattern = {}
      const tile: Tile = { width: this.width, height: this.height, calls, pattern }
      tiles.push(tile)
      const wrapped = new Proxy(ctx as Record<string, unknown>, {
        get(t, prop: string) {
          if (prop === 'createPattern') {
            return (src: HTMLCanvasElement, rep: string) => {
              calls.push({ fn: 'createPattern', args: [src, rep], fillStyle: '', strokeStyle: '', lineWidth: 0 })
              tile.width = src.width
              tile.height = src.height
              return mode === 'nopattern' ? null : pattern
            }
          }
          return t[prop]
        },
        set(t, prop: string, value: unknown) {
          t[prop] = value
          return true
        },
      })
      return wrapped as unknown as CanvasRenderingContext2D
    } as never)
    return { tiles, spy }
  }

  afterEach(() => vi.restoreAllMocks())

  it('returns one cached pattern per exact colour string, each tile filled with its own colour', async () => {
    const { setup } = await fresh()
    const { tiles } = stubCanvas()
    const a1 = setup.hatchPattern('#2a78d6')
    const b1 = setup.hatchPattern('#d9622b')
    const a2 = setup.hatchPattern('#2a78d6')
    expect(a1).not.toBe('#2a78d6')
    expect(b1).not.toBe(a1)
    expect(a2).toBe(a1)
    expect(tiles).toHaveLength(2)
    const fills = tiles.map((t) => t.calls.find((c) => c.fn === 'fillRect')?.fillStyle)
    expect(fills).toEqual(['#2a78d6', '#d9622b'])
    // The cache key is the exact string: another spelling of the same colour is its own entry.
    const upper = setup.hatchPattern('#2A78D6')
    expect(upper).not.toBe(a1)
    expect(tiles).toHaveLength(3)
  })

  it('draws a 6 x 6 tile: colour fill, then three 1.5px card-coloured 45 degree strokes, repeated', async () => {
    const { setup } = await fresh()
    const { tiles } = stubCanvas()
    const pattern = setup.hatchPattern('#4a8a1f')
    const [tile] = tiles
    expect(tile.width).toBe(6)
    expect(tile.height).toBe(6)
    expect(tile.calls.find((c) => c.fn === 'fillRect')?.args).toEqual([0, 0, 6, 6])
    const moves = tile.calls.filter((c) => c.fn === 'moveTo').map((c) => c.args)
    const lines = tile.calls.filter((c) => c.fn === 'lineTo').map((c) => c.args)
    expect(moves).toEqual([[-6, 6], [0, 6], [6, 6]])
    expect(lines).toEqual([[0, 0], [6, 0], [12, 0]])
    const stroke = tile.calls.filter((c) => c.fn === 'stroke')
    expect(stroke.length).toBeGreaterThanOrEqual(1)
    for (const s of stroke) {
      expect(norm(String(s.strokeStyle))).toBe('#fffdf8')
      expect(s.lineWidth).toBe(1.5)
    }
    expect(tile.calls.find((c) => c.fn === 'createPattern')?.args[1]).toBe('repeat')
    expect(pattern).toBe(tile.pattern)
  })

  it('returns the colour itself and caches nothing when there is no 2D context; a later context still makes the pattern', async () => {
    const { setup } = await fresh()
    stubCanvas('none')
    expect(setup.hatchPattern('#2a78d6')).toBe('#2a78d6')
    expect(setup.hatchPattern('#2a78d6')).toBe('#2a78d6')
    vi.restoreAllMocks()
    stubCanvas('context')
    const later = setup.hatchPattern('#2a78d6')
    expect(later).not.toBe('#2a78d6')
    expect(typeof later).toBe('object')
  })

  it('returns the colour and caches nothing when createPattern returns null', async () => {
    const { setup } = await fresh()
    stubCanvas('nopattern')
    expect(setup.hatchPattern('#d9622b')).toBe('#d9622b')
    vi.restoreAllMocks()
    stubCanvas('context')
    expect(typeof setup.hatchPattern('#d9622b')).toBe('object')
  })

  it('falls back to the colour under jsdom, which has no canvas', async () => {
    const { setup } = await fresh()
    expect(setup.hatchPattern('#a88400')).toBe('#a88400')
  })

  it('hatched(c) is a function and touches no canvas until it is called', async () => {
    const { setup } = await fresh()
    const { spy } = stubCanvas()
    const createSpy = vi.spyOn(document, 'createElement')
    const fn = setup.hatched('#2a78d6')
    expect(typeof fn).toBe('function')
    expect(createSpy).not.toHaveBeenCalledWith('canvas')
    expect(spy).not.toHaveBeenCalled()
    const first = fn()
    expect(spy).toHaveBeenCalled()
    expect(fn()).toBe(first)
    expect(first).toBe(setup.hatchPattern('#2a78d6'))
  })
})

describe('eventBandsPlugin and peakShadingPlugin (section 33, design.md §9.3)', () => {
  const fills = (calls: KitCall[]) => calls.filter((c) => c.fn === 'fillRect')

  async function bands(list: unknown, plugins: Record<string, unknown> = {}, passOptions = true) {
    const { setup } = await fresh()
    const { chart, calls } = kitChart({ plugins })
    const opts = passOptions ? { bands: list } : undefined
    hookOf(setup.eventBandsPlugin, 'beforeDatasetsDraw')(chart, { cancelable: true }, opts)
    return { calls, chart, setup }
  }

  it('is a plugin named eventBands with no hook that runs after the datasets', async () => {
    const { setup } = await fresh()
    expect(setup.eventBandsPlugin.id).toBe('eventBands')
    expect(setup.eventBandsPlugin.beforeDatasetsDraw).toBeTypeOf('function')
    expect(setup.eventBandsPlugin.afterDatasetsDraw).toBeUndefined()
    expect(setup.eventBandsPlugin.afterDraw).toBeUndefined()
    expect(setup.eventBandsPlugin.afterDatasetsUpdate).toBeUndefined()
  })

  it('draws one column and one 3px rule for a danger band, at the §4 pixels', async () => {
    const { calls } = await bands([{ index: 3, tone: 'danger' }])
    const f = fills(calls)
    expect(f).toHaveLength(2)
    expect(f[0].args).toEqual([310, 20, 70, 200])
    expect(norm(String(f[0].fillStyle))).toBe('#f9e1d8')
    expect(f[1].args).toEqual([310, 20, 70, 3])
    expect(norm(String(f[1].fillStyle))).toBe('#b23a1e')
  })

  it.each([
    ['peak', '#f7edd3', '#a06a12'],
    ['warning', '#f7eacb', '#a06a12'],
    ['danger', '#f9e1d8', '#b23a1e'],
  ] as const)('tone %s uses its fill and rule colours', async (tone, fill, rule) => {
    const { calls } = await bands([{ index: 1, tone }])
    const f = fills(calls)
    expect(norm(String(f[0].fillStyle))).toBe(fill)
    expect(norm(String(f[1].fillStyle))).toBe(rule)
  })

  it('draws bands in list order, each column then its rule', async () => {
    const { calls } = await bands([
      { index: 5, tone: 'warning' },
      { index: 1, tone: 'danger' },
      { index: 3, tone: 'peak' },
    ])
    const f = fills(calls)
    expect(f.map((c) => c.args[0])).toEqual([450, 450, 170, 170, 310, 310])
    expect(f.map((c) => c.args[3])).toEqual([200, 3, 200, 3, 200, 3])
  })

  it('draws nothing for an index outside the axis, or for an empty list', async () => {
    expect(fills((await bands([{ index: 7, tone: 'peak' }, { index: -1, tone: 'danger' }])).calls)).toHaveLength(0)
    expect(fills((await bands([])).calls)).toHaveLength(0)
    expect(fills((await bands(undefined)).calls)).toHaveLength(0)
  })

  it('clamps a column to the plot area and draws nothing when the clamped span is empty', async () => {
    const { setup } = await fresh()
    const { chart, calls, x } = kitChart()
    x.getPixelForValue = (v: number) => (v === 0 ? 100 : v === 1 ? 700 : 590)
    hookOf(setup.eventBandsPlugin, 'beforeDatasetsDraw')(chart, {}, { bands: [{ index: 0, tone: 'peak' }, { index: 6, tone: 'peak' }, { index: 1, tone: 'peak' }] })
    const f = fills(calls)
    expect(f[0].args).toEqual([100, 20, 35, 200])
    expect(f[2].args).toEqual([555, 20, 35, 200])
    // index 1 sits at 700: its column [665, 735] lies wholly right of the plot, so it draws nothing.
    expect(f).toHaveLength(4)
  })

  it('saves and restores the context around its drawing', async () => {
    const { calls } = await bands([{ index: 2, tone: 'peak' }])
    const names = calls.map((c) => c.fn)
    expect(names[0]).toBe('save')
    expect(names[names.length - 1]).toBe('restore')
  })

  it('falls back to the chart option, and draws nothing without an x scale', async () => {
    const { setup } = await fresh()
    const a = kitChart({ plugins: { eventBands: { bands: [{ index: 2, tone: 'peak' }] } } })
    hookOf(setup.eventBandsPlugin, 'beforeDatasetsDraw')(a.chart, {}, undefined)
    expect(fills(a.calls)).toHaveLength(2)
    const b = kitChart()
    ;(b.chart as { scales: object }).scales = {}
    hookOf(setup.eventBandsPlugin, 'beforeDatasetsDraw')(b.chart, {}, { bands: [{ index: 2, tone: 'peak' }] })
    expect(fills(b.calls)).toHaveLength(0)
  })

  it('peakShading { days: [3] } draws the same pixels as the peak band, in the peak colours (§4)', async () => {
    const { setup } = await fresh()
    const { chart, calls } = kitChart({ plugins: { peakShading: { days: [3] } } })
    hookOf(setup.peakShadingPlugin, 'beforeDatasetsDraw')(chart, {}, { days: [3] })
    const f = fills(calls)
    expect(f.map((c) => c.args)).toEqual([[310, 20, 70, 200], [310, 20, 70, 3]])
    expect(norm(String(f[0].fillStyle))).toBe('#f7edd3')
    expect(norm(String(f[1].fillStyle))).toBe('#a06a12')
    expect(setup.peakShadingPlugin.id).toBe('peakShading')
  })

  // Failure mode 1: peakShading reads eventBands.bands, or nothing, instead of peakShading.days.
  it('peakShading reads plugins.peakShading.days from the chart options when no plugin options arrive, with no eventBands option', async () => {
    const { setup } = await fresh()
    const { chart, calls } = kitChart({ plugins: { peakShading: { days: [2, 4] } } })
    hookOf(setup.peakShadingPlugin, 'beforeDatasetsDraw')(chart, {}, undefined)
    const columns = fills(calls).filter((c) => norm(String(c.fillStyle)) === '#f7edd3')
    expect(columns.map((c) => c.args[0])).toEqual([240, 380])
    const rules = fills(calls).filter((c) => norm(String(c.fillStyle)) === '#a06a12')
    expect(rules).toHaveLength(2)
  })

  it('peakShading reads the days of its own plugin options', async () => {
    const { setup } = await fresh()
    const { chart, calls } = kitChart({ plugins: {} })
    hookOf(setup.peakShadingPlugin, 'beforeDatasetsDraw')(chart, {}, { days: [2, 4] })
    expect(fills(calls).filter((c) => norm(String(c.fillStyle)) === '#f7edd3')).toHaveLength(2)
  })

  it('peakShading never shades eventBands.bands, and eventBands never shades peakShading.days', async () => {
    const { setup } = await fresh()
    const plugins = { peakShading: { days: [2, 4] }, eventBands: { bands: [{ index: 5, tone: 'danger' }] } }

    const p = kitChart({ plugins })
    hookOf(setup.peakShadingPlugin, 'beforeDatasetsDraw')(p.chart, {}, undefined)
    expect(fills(p.calls).map((c) => c.args[0])).toEqual([240, 240, 380, 380])

    const e = kitChart({ plugins })
    hookOf(setup.eventBandsPlugin, 'beforeDatasetsDraw')(e.chart, {}, undefined)
    expect(fills(e.calls).map((c) => c.args[0])).toEqual([450, 450])
    expect(fills(e.calls).every((c) => norm(String(c.fillStyle)) !== '#f7edd3')).toBe(true)
  })
})

describe('emphasisOf and pulqueriaLine (section 33, design.md §9.6)', () => {
  const ALIASES = Array.from({ length: 12 }, (_, i) => `P${i + 1}`)

  it('emphasisOf: null focus is none, the focused alias is focus, every other is context', async () => {
    const { setup } = await fresh()
    expect(setup.emphasisOf('P2', null)).toBe('none')
    expect(setup.emphasisOf('P2', 'P2')).toBe('focus')
    expect(setup.emphasisOf('P3', 'P2')).toBe('context')
  })

  it('matches the §4 worked examples exactly', async () => {
    const { setup } = await fresh()
    const lower = (o: Record<string, unknown>) => JSON.parse(JSON.stringify(o).toLowerCase())
    expect(lower(setup.pulqueriaLine('P2', 'none') as never)).toEqual(
      lower({ borderColor: '#D9622B', backgroundColor: '#D9622B', borderWidth: 2.5, borderDash: [], pointStyle: 'rect', pointRadius: 4, pointHoverRadius: 5, pointBackgroundColor: '#D9622B', pointBorderColor: '#D9622B', pointBorderWidth: 1, order: 1 }),
    )
    expect(lower(setup.pulqueriaLine('P8', 'focus') as never)).toEqual(
      lower({ borderColor: '#D9622B', backgroundColor: '#D9622B', borderWidth: 3, borderDash: [6, 4], pointStyle: 'rect', pointRadius: 4, pointHoverRadius: 5, pointBackgroundColor: '#FFFDF8', pointBorderColor: '#D9622B', pointBorderWidth: 2, order: 0 }),
    )
    expect(lower(setup.pulqueriaLine('P9', 'context') as never)).toEqual(
      lower({ borderColor: '#C9BEA6', backgroundColor: '#C9BEA6', borderWidth: 1.5, borderDash: [6, 4], pointStyle: 'triangle', pointRadius: 0, pointHoverRadius: 3, pointBackgroundColor: '#C9BEA6', pointBorderColor: '#C9BEA6', pointBorderWidth: 1, order: 2 }),
    )
  })

  // Failure mode 7: a context line still in its colour.
  it.each(ALIASES)('%s: a context line is border-strong in every colour field', async (alias) => {
    const { setup } = await fresh()
    const line = setup.pulqueriaLine(alias, 'context')
    expect(norm(line.borderColor)).toBe('#c9bea6')
    expect(norm(line.backgroundColor)).toBe('#c9bea6')
    expect(norm(line.pointBackgroundColor)).toBe('#c9bea6')
    expect(norm(line.pointBorderColor)).toBe('#c9bea6')
  })

  it.each(ALIASES)('%s follows the §3.5 table in all three states', async (alias) => {
    const { setup } = await fresh()
    const s = setup.pulqueriaStyle(alias)
    const dash = s.dashed ? [6, 4] : []
    const own = (e: 'none' | 'focus') => ({
      borderColor: s.color,
      backgroundColor: s.color,
      borderWidth: e === 'focus' ? 3 : 2.5,
      borderDash: dash,
      pointStyle: s.pointStyle,
      pointRadius: 4,
      pointHoverRadius: 5,
      pointBackgroundColor: s.dashed ? setup.CHART_COLORS['card'] : s.color,
      pointBorderColor: s.color,
      pointBorderWidth: s.dashed ? 2 : 1,
      order: e === 'focus' ? 0 : 1,
    })
    expect(setup.pulqueriaLine(alias, 'none')).toEqual(own('none'))
    expect(setup.pulqueriaLine(alias, 'focus')).toEqual(own('focus'))
    const strong = setup.CHART_COLORS['border-strong']
    expect(setup.pulqueriaLine(alias, 'context')).toEqual({
      borderColor: strong,
      backgroundColor: strong,
      borderWidth: 1.5,
      borderDash: dash,
      pointStyle: s.pointStyle,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: strong,
      pointBorderColor: strong,
      pointBorderWidth: 1,
      order: 2,
    })
  })

  it('orders the focused line last-drawn: focus < none < context', async () => {
    const { setup } = await fresh()
    expect(setup.pulqueriaLine('P1', 'focus').order).toBeLessThan(setup.pulqueriaLine('P1', 'none').order)
    expect(setup.pulqueriaLine('P1', 'none').order).toBeLessThan(setup.pulqueriaLine('P1', 'context').order)
  })
})

describe('crosshair store (section 33, design.md §9.5)', () => {
  it('getCrosshair is null for a group never set; setCrosshair stores and notifies only that group', async () => {
    const { setup } = await fresh()
    const a = vi.fn()
    const b = vi.fn()
    setup.subscribeCrosshair('A', a)
    setup.subscribeCrosshair('B', b)
    expect(setup.getCrosshair('A')).toBeNull()
    setup.setCrosshair('A', 3)
    expect(setup.getCrosshair('A')).toBe(3)
    expect(a).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith(3)
    // Failure mode 5: a crosshair leaking across groups.
    expect(b).not.toHaveBeenCalled()
    expect(setup.getCrosshair('B')).toBeNull()
  })

  it('does nothing when the index is unchanged, and notifies on null', async () => {
    const { setup } = await fresh()
    const l = vi.fn()
    setup.subscribeCrosshair('A', l)
    setup.setCrosshair('A', 2)
    setup.setCrosshair('A', 2)
    expect(l).toHaveBeenCalledTimes(1)
    setup.setCrosshair('A', null)
    expect(l).toHaveBeenLastCalledWith(null)
    expect(l).toHaveBeenCalledTimes(2)
    setup.setCrosshair('A', null)
    expect(l).toHaveBeenCalledTimes(2)
  })

  it('unsubscribe removes only that listener', async () => {
    const { setup } = await fresh()
    const one = vi.fn()
    const two = vi.fn()
    const off = setup.subscribeCrosshair('A', one)
    setup.subscribeCrosshair('A', two)
    off()
    setup.setCrosshair('A', 1)
    expect(one).not.toHaveBeenCalled()
    expect(two).toHaveBeenCalledWith(1)
  })

  it('withCrosshair returns the options itself for a null group, else a new object with the group, other plugins kept', async () => {
    const { setup } = await fresh()
    const opts = { plugins: { peakShading: { days: [3] } } } as unknown as import('chart.js').ChartOptions
    expect(setup.withCrosshair(opts, null)).toBe(opts)
    const frozen = JSON.stringify(opts)
    const out = setup.withCrosshair(opts, 'g1')
    expect(out).toEqual({ plugins: { peakShading: { days: [3] }, crosshairSync: { group: 'g1' } } })
    expect(out).not.toBe(opts)
    expect(JSON.stringify(opts)).toBe(frozen)
    expect(setup.withCrosshair({}, 'g2')).toEqual({ plugins: { crosshairSync: { group: 'g2' } } })
  })
})

describe('crosshairSyncPlugin (section 33, design.md §9.5)', () => {
  let n = 0
  const group = () => `grp-${++n}`

  async function grouped(g: string | undefined, opts: KitChartOptions = {}) {
    const { setup } = await fresh()
    const k = kitChart({ ...opts, plugins: g === undefined ? {} : { crosshairSync: { group: g } } })
    const call = (name: string, args: unknown = {}) => hookOf(setup.crosshairSyncPlugin, name)(k.chart, args, g === undefined ? undefined : { group: g })
    return { setup, ...k, call }
  }

  it('is a plugin named crosshairSync', async () => {
    const { setup } = await fresh()
    expect(setup.crosshairSyncPlugin.id).toBe('crosshairSync')
  })

  it('sets the active elements of every visible dataset with a value at the new index, plus the tooltip, then redraws', async () => {
    const g = group()
    const { setup, chart, call } = await grouped(g, {
      datasets: [{ data: [1, 2, 3, 4, 5, 6, 7] }, { data: [1, 2, 3, null, 5, 6, 7] }, { data: [1, 2, 3, 4, 5, 6, 7] }, { data: [1, 2, 3, undefined, 5, 6, 7] }],
      hidden: [2],
    })
    call('afterInit')
    setup.setCrosshair(g, 3)
    const expected = [{ datasetIndex: 0, index: 3 }]
    expect(chart.setActiveElements).toHaveBeenLastCalledWith(expected)
    expect(chart.tooltip.setActiveElements).toHaveBeenLastCalledWith(expected, { x: 310 + 35, y: 20 })
    expect(chart.update).toHaveBeenCalled()
  })

  it('clears the active elements when the index becomes null or falls out of range', async () => {
    const g = group()
    const { setup, chart, call } = await grouped(g)
    call('afterInit')
    setup.setCrosshair(g, 2)
    setup.setCrosshair(g, null)
    expect(chart.setActiveElements).toHaveBeenLastCalledWith([])
    expect(chart.tooltip.setActiveElements).toHaveBeenLastCalledWith([], expect.anything())
    setup.setCrosshair(g, 99)
    expect(chart.setActiveElements).toHaveBeenLastCalledWith([])
  })

  it('afterEvent: a mousemove in the chart area sets the group index from the pixel, clamped to the labels', async () => {
    const g = group()
    const { setup, call } = await grouped(g)
    call('afterEvent', { event: { type: 'mousemove', x: 310 + 35 }, inChartArea: true })
    expect(setup.getCrosshair(g)).toBe(3)
    call('afterEvent', { event: { type: 'mousemove', x: 10000 }, inChartArea: true })
    expect(setup.getCrosshair(g)).toBe(6)
    call('afterEvent', { event: { type: 'mousemove', x: -500 }, inChartArea: true })
    expect(setup.getCrosshair(g)).toBe(0)
  })

  it('afterEvent: a mouseout, or a mousemove outside the chart area, clears the group index', async () => {
    const g = group()
    const { setup, call } = await grouped(g)
    call('afterEvent', { event: { type: 'mousemove', x: 345 }, inChartArea: true })
    expect(setup.getCrosshair(g)).toBe(3)
    call('afterEvent', { event: { type: 'mousemove', x: 345 }, inChartArea: false })
    expect(setup.getCrosshair(g)).toBeNull()
    call('afterEvent', { event: { type: 'mousemove', x: 345 }, inChartArea: true })
    call('afterEvent', { event: { type: 'mouseout', x: 345 }, inChartArea: false })
    expect(setup.getCrosshair(g)).toBeNull()
  })

  it('afterDestroy unsubscribes the chart', async () => {
    const g = group()
    const { setup, chart, call } = await grouped(g)
    call('afterInit')
    call('afterDestroy')
    setup.setCrosshair(g, 2)
    expect(chart.setActiveElements).not.toHaveBeenCalled()
    expect(chart.update).not.toHaveBeenCalled()
  })

  // Failure mode 5: a chart in group B must not get active elements from group A.
  it('a chart of another group, or of no group, is untouched by a group index and ignores events', async () => {
    const a = group()
    const b = group()
    const inB = await grouped(b)
    inB.call('afterInit')
    const none = await grouped(undefined)
    none.call('afterInit')
    inB.setup.setCrosshair(a, 3)
    expect(inB.chart.setActiveElements).not.toHaveBeenCalled()
    expect(inB.chart.tooltip.setActiveElements).not.toHaveBeenCalled()
    expect(none.chart.setActiveElements).not.toHaveBeenCalled()
    none.call('afterEvent', { event: { type: 'mousemove', x: 345 }, inChartArea: true })
    expect(inB.setup.getCrosshair(a)).toBe(3)
    expect(inB.setup.getCrosshair(b)).toBeNull()
    none.call('afterDatasetsDraw')
    expect(none.calls).toHaveLength(0)
  })

  it('treats an empty or missing group as no group', async () => {
    const { setup, chart, call } = await grouped('')
    call('afterInit')
    call('afterEvent', { event: { type: 'mousemove', x: 345 }, inChartArea: true })
    setup.setCrosshair('', 2)
    expect(chart.setActiveElements).not.toHaveBeenCalled()
  })

  it('afterDatasetsDraw strokes one 1px ink-subtle vertical rule through the index, inside save/restore', async () => {
    const g = group()
    const { setup, calls, call } = await grouped(g)
    call('afterDatasetsDraw')
    expect(calls.filter((c) => c.fn === 'stroke')).toHaveLength(0)
    setup.setCrosshair(g, 3)
    call('afterDatasetsDraw')
    const names = calls.map((c) => c.fn)
    expect(names[0]).toBe('save')
    expect(names[names.length - 1]).toBe('restore')
    const stroke = calls.filter((c) => c.fn === 'stroke')
    expect(stroke).toHaveLength(1)
    expect(stroke[0].lineWidth).toBe(1)
    expect(norm(String(stroke[0].strokeStyle))).toBe('#6b6354')
    expect(calls.find((c) => c.fn === 'moveTo')?.args).toEqual([345, 20])
    expect(calls.find((c) => c.fn === 'lineTo')?.args).toEqual([345, 220])
  })

  it('draws no rule for an index outside the x scale', async () => {
    const g = group()
    const { setup, calls, call } = await grouped(g)
    setup.setCrosshair(g, 40)
    call('afterDatasetsDraw')
    expect(calls.filter((c) => c.fn === 'stroke')).toHaveLength(0)
  })
})

describe('registerCharts registers the section 33 plugins (criterion 5)', () => {
  it('registers eventBands and crosshairSync and still no extra controller, scale or built-in plugin', async () => {
    const { setup, chartjs } = await fresh()
    setup.registerCharts()
    const { registry } = chartjs.Chart
    for (const id of ['eventBands', 'crosshairSync', 'peakShading']) expect(() => registry.getPlugin(id), id).not.toThrow()
    for (const id of ['radar', 'polarArea', 'scatter', 'bubble', 'sankey']) expect(() => registry.getController(id), id).toThrow()
    for (const id of ['time', 'logarithmic', 'radialLinear']) expect(() => registry.getScale(id), id).toThrow()
    for (const id of ['legend', 'title', 'subtitle']) expect(() => registry.getPlugin(id), id).toThrow()
  })
})
