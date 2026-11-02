import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { Flow, SankeyController } from 'chartjs-chart-sankey'
import type { IncotermTier } from '../../types/game'
import { hasSecondChannel, slotIndex } from '../../styles/slots'

/**
 * Canvases cannot read CSS variables, so every chart colour is a literal named
 * after its token (design.md §9.1). A test compares each entry to `src/index.css`.
 */
export const CHART_COLORS: Record<string, string> = {
  white: '#FFFFFF',
  black: '#000000',
  canvas: '#F5F0E3',
  card: '#FFFDF8',
  inset: '#FAF6EC',
  muted: '#EFE8D7',
  ink: '#26221B',
  'ink-muted': '#575044',
  'ink-subtle': '#6B6354',
  'on-ink': '#FFFDF8',
  'on-accent': '#FFFFFF',
  'on-danger': '#FFFFFF',
  border: '#E4DCC8',
  'border-strong': '#C9BEA6',
  'border-control': '#8C8069',
  ring: '#2D6A55',
  accent: '#2D6A55',
  'accent-hover': '#22543F',
  'accent-subtle': '#E2EEE7',
  'accent-line': '#B5D0C3',
  ochre: '#A06A12',
  peak: '#F7EDD3',
  success: '#2D6A55',
  'success-ink': '#22543F',
  'success-subtle': '#E2EEE7',
  'success-line': '#B5D0C3',
  warning: '#A06A12',
  'warning-ink': '#7A500E',
  'warning-subtle': '#F7EACB',
  'warning-line': '#E3C98F',
  danger: '#B23A1E',
  'danger-ink': '#8F2E16',
  'danger-subtle': '#F9E1D8',
  'danger-line': '#EDB8A6',
  'danger-hover': '#932F17',
  info: '#1F6F9C',
  'info-ink': '#185A80',
  'info-subtle': '#DEEBF3',
  'info-line': '#B3CFE2',
  p1: '#2A78D6',
  p2: '#D9622B',
  p3: '#6250D6',
  p4: '#A88400',
  p5: '#C9518A',
  p6: '#4A8A1F',
  'series-demand': '#26221B',
  'series-delivered': '#2A78D6',
  'series-sold': '#4A8A1F',
  'series-spoiled': '#6250D6',
  'series-backlog': '#D9622B',
  'series-lost': '#C9518A',
  'series-liquidated': '#A88400',
}

/** design.md §3.3: the shipping insurance tiers as solid steps of one hue, light to dark. They have no CSS token. */
export const INSURANCE_TIER_COLORS: Record<IncotermTier, string> = {
  exw: '#86B6EF',
  cip: '#5598E7',
  dap: '#2A78D6',
  ddp: '#1C5CAB',
}

const FONT_FAMILY = '"Figtree", ui-sans-serif, system-ui, sans-serif'

export interface PulqueriaStyle {
  color: string
  pointStyle: string
  dashed: boolean
  hatched: boolean
}

const SLOT_COLORS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const
const SLOT_POINTS = ['circle', 'rect', 'triangle', 'rectRot', 'star', 'crossRot'] as const

/** Colour follows the alias: Pn wears slot n; P7-P12 reuse slot n-6 with a second channel (design.md §3.1). */
export function pulqueriaStyle(alias: string): PulqueriaStyle {
  const slot = slotIndex(alias)
  const second = hasSecondChannel(alias)
  return {
    color: CHART_COLORS[SLOT_COLORS[slot]],
    pointStyle: SLOT_POINTS[slot],
    dashed: second,
    hatched: second,
  }
}

type Measure = 'demand' | 'delivered' | 'sold' | 'spoiled' | 'backlog' | 'lost' | 'liquidated'

/** Fixed series of design.md §3.3. Lost and liquidated are bars, so they carry no dash and no line width. */
export const MEASURE_STYLES: Record<Measure, { color: string; dash: number[]; width: number; pointStyle?: string }> = {
  demand: { color: CHART_COLORS['series-demand'], dash: [], width: 4, pointStyle: 'circle' },
  delivered: { color: CHART_COLORS['series-delivered'], dash: [12, 4], width: 2.5, pointStyle: 'rect' },
  sold: { color: CHART_COLORS['series-sold'], dash: [6, 4], width: 2.5, pointStyle: 'triangle' },
  spoiled: { color: CHART_COLORS['series-spoiled'], dash: [2, 4], width: 2.5, pointStyle: 'rectRot' },
  backlog: { color: CHART_COLORS['series-backlog'], dash: [12, 4, 2, 4], width: 2.5, pointStyle: 'star' },
  lost: { color: CHART_COLORS['series-lost'], dash: [], width: 0 },
  liquidated: { color: CHART_COLORS['series-liquidated'], dash: [], width: 0 },
}

// ── Hatching (design.md §3.1, §9.1) ──

const HATCH_TILE = 6
const hatchCache = new Map<string, CanvasPattern>()

/** The colour crossed by 1.5px card-coloured stripes at 45 degrees, created once per colour string. */
export function hatchPattern(color: string): CanvasPattern | string {
  const cached = hatchCache.get(color)
  if (cached) return cached
  const tile = document.createElement('canvas')
  tile.width = HATCH_TILE
  tile.height = HATCH_TILE
  const ctx = tile.getContext('2d')
  if (!ctx) return color
  ctx.fillStyle = color
  ctx.fillRect(0, 0, HATCH_TILE, HATCH_TILE)
  ctx.strokeStyle = CHART_COLORS['card']
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (const shift of [-HATCH_TILE, 0, HATCH_TILE]) {
    ctx.moveTo(shift, HATCH_TILE)
    ctx.lineTo(shift + HATCH_TILE, 0)
  }
  ctx.stroke()
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return color
  hatchCache.set(color, pattern)
  return pattern
}

/** The scriptable form a dataset takes; resolved when the chart draws, so building a configuration touches no canvas. */
export function hatched(color: string): () => CanvasPattern | string {
  return () => hatchPattern(color)
}

// ── Event bands (design.md §9.3) ──

export type BandTone = 'peak' | 'warning' | 'danger'
export interface EventBand {
  index: number
  tone: BandTone
}

const BAND_RULE_PX = 3
const BAND_TONES: Record<BandTone, { fill: string; rule: string }> = {
  peak: { fill: CHART_COLORS['peak'], rule: CHART_COLORS['ochre'] },
  warning: { fill: CHART_COLORS['warning-subtle'], rule: CHART_COLORS['warning'] },
  danger: { fill: CHART_COLORS['danger-subtle'], rule: CHART_COLORS['danger'] },
}

/** Fills each band's column the full plot height, then a 3px rule along the top, in list order. */
function drawBands(chart: Chart, bands: readonly EventBand[]): void {
  const x = chart.scales.x
  if (bands.length === 0 || !x) return

  const { ctx, chartArea: area } = chart
  const count = Math.max(1, x.max - x.min + 1)
  const column = (area.right - area.left) / count

  ctx.save()
  for (const band of bands) {
    if (band.index < x.min || band.index > x.max) continue
    const centre = x.getPixelForValue(band.index)
    const left = Math.max(area.left, centre - column / 2)
    const right = Math.min(area.right, centre + column / 2)
    if (right <= left) continue
    const tone = BAND_TONES[band.tone]
    ctx.fillStyle = tone.fill
    ctx.fillRect(left, area.top, right - left, area.bottom - area.top)
    ctx.fillStyle = tone.rule
    ctx.fillRect(left, area.top, right - left, BAND_RULE_PX)
  }
  ctx.restore()
}

type ChartPlugins = Record<string, unknown> | undefined
const chartPlugins = (chart: Chart): ChartPlugins => (chart.options as { plugins?: ChartPlugins }).plugins

/** design.md §9.3: marks whole days behind the data. Reads `plugins.eventBands.bands` (0-based x indices). */
export const eventBandsPlugin: Plugin = {
  id: 'eventBands',
  beforeDatasetsDraw(chart, _args, pluginOptions) {
    const fromChart = (chartPlugins(chart)?.['eventBands'] as { bands?: EventBand[] } | undefined)?.bands
    drawBands(chart, (pluginOptions as { bands?: EventBand[] } | undefined)?.bands ?? fromChart ?? [])
  },
}

/**
 * design.md §9.3: the `peak` band on every peak-window day, under its own id and option
 * (`plugins.peakShading.days`, 0-based x indices).
 */
export const peakShadingPlugin: Plugin = {
  id: 'peakShading',
  beforeDatasetsDraw(chart, _args, pluginOptions) {
    const fromChart = (chartPlugins(chart)?.['peakShading'] as { days?: number[] } | undefined)?.days
    const days = (pluginOptions as { days?: number[] } | undefined)?.days ?? fromChart ?? []
    drawBands(chart, days.map((index): EventBand => ({ index, tone: 'peak' })))
  },
}

// ── Emphasis (design.md §9.6) ──

export type Emphasis = 'none' | 'focus' | 'context'

export function emphasisOf(alias: string, focus: string | null): Emphasis {
  if (focus === null) return 'none'
  return alias === focus ? 'focus' : 'context'
}

export interface PulqueriaLineStyle {
  borderColor: string
  backgroundColor: string
  borderWidth: number
  borderDash: number[]
  pointStyle: string
  pointRadius: number
  pointHoverRadius: number
  pointBackgroundColor: string
  pointBorderColor: string
  pointBorderWidth: number
  order: number
}

export function pulqueriaLine(alias: string, emphasis: Emphasis): PulqueriaLineStyle {
  const s = pulqueriaStyle(alias)
  const borderDash = s.dashed ? [6, 4] : []
  if (emphasis === 'context') {
    const strong = CHART_COLORS['border-strong']
    return {
      borderColor: strong,
      backgroundColor: strong,
      borderWidth: 1.5,
      borderDash,
      pointStyle: s.pointStyle,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: strong,
      pointBorderColor: strong,
      pointBorderWidth: 1,
      order: 2,
    }
  }
  return {
    borderColor: s.color,
    backgroundColor: s.color,
    borderWidth: emphasis === 'focus' ? 3 : 2.5,
    borderDash,
    pointStyle: s.pointStyle,
    pointRadius: 4,
    pointHoverRadius: 5,
    pointBackgroundColor: s.dashed ? CHART_COLORS['card'] : s.color,
    pointBorderColor: s.color,
    pointBorderWidth: s.dashed ? 2 : 1,
    order: emphasis === 'focus' ? 0 : 1,
  }
}

// ── Line end labels and quadrant labels ──

const LABEL_GAP_PX = 14
const LABEL_OFFSET_PX = 8
const LABEL_FONT_PX = 12

/** Names each line at its last point, spread so the labels never overlap or leave the plot. */
export const lineEndLabelsPlugin: Plugin = {
  id: 'lineEndLabels',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const fromChart = (chartPlugins(chart)?.['lineEndLabels'] as { display?: boolean } | undefined)?.display
    const display = (pluginOptions as { display?: boolean } | undefined)?.display ?? fromChart
    if (display !== true) return
    const { ctx, chartArea: area } = chart
    const ends: { label: string; x: number; y: number }[] = []
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!chart.isDatasetVisible(datasetIndex)) return
      const data = dataset.data as unknown[]
      let last = data.length - 1
      while (last >= 0 && (data[last] === null || data[last] === undefined)) last -= 1
      if (last < 0) return
      const point = chart.getDatasetMeta(datasetIndex).data[last]
      if (!point) return
      ends.push({ label: dataset.label ?? '', x: point.x, y: point.y })
    })
    ends.sort((a, b) => a.y - b.y)
    for (let i = 1; i < ends.length; i += 1) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + LABEL_GAP_PX)
    const overflow = ends.length > 0 ? ends[ends.length - 1].y - area.bottom : 0
    if (overflow > 0) {
      ends[ends.length - 1].y = area.bottom
      for (let i = ends.length - 2; i >= 0; i -= 1) ends[i].y = Math.min(ends[i].y, ends[i + 1].y - LABEL_GAP_PX)
    }
    ctx.save()
    ctx.font = `${LABEL_FONT_PX}px ${FONT_FAMILY}`
    ctx.fillStyle = CHART_COLORS['ink-muted']
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const end of ends) ctx.fillText(end.label, end.x + LABEL_OFFSET_PX, end.y)
    ctx.restore()
  },
}

interface QuadrantLabels {
  topLeft?: string
  topRight?: string
  bottomLeft?: string
  bottomRight?: string
}

/** Names the four corners of the plot (design.md §9). Reads `plugins.quadrantLabels`. */
export const quadrantLabelsPlugin: Plugin = {
  id: 'quadrantLabels',
  afterDraw(chart, _args, pluginOptions) {
    const fromChart = chartPlugins(chart)?.['quadrantLabels'] as QuadrantLabels | undefined
    const labels = (pluginOptions as QuadrantLabels | undefined) ?? fromChart
    if (!labels || typeof labels !== 'object') return
    const { ctx, chartArea: a } = chart
    const corners: { text: string | undefined; x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline }[] = [
      { text: labels.topLeft, x: a.left + LABEL_OFFSET_PX, y: a.top + LABEL_OFFSET_PX, align: 'left', baseline: 'top' },
      { text: labels.topRight, x: a.right - LABEL_OFFSET_PX, y: a.top + LABEL_OFFSET_PX, align: 'right', baseline: 'top' },
      { text: labels.bottomLeft, x: a.left + LABEL_OFFSET_PX, y: a.bottom - LABEL_OFFSET_PX, align: 'left', baseline: 'bottom' },
      { text: labels.bottomRight, x: a.right - LABEL_OFFSET_PX, y: a.bottom - LABEL_OFFSET_PX, align: 'right', baseline: 'bottom' },
    ]
    ctx.save()
    ctx.font = `${LABEL_FONT_PX}px ${FONT_FAMILY}`
    ctx.fillStyle = CHART_COLORS['ink-subtle']
    for (const c of corners) {
      if (!c.text) continue
      ctx.textAlign = c.align
      ctx.textBaseline = c.baseline
      ctx.fillText(c.text, c.x, c.y)
    }
    ctx.restore()
  },
}

// ── Crosshair (design.md §9.5) ──

interface CrosshairState {
  index: number | null
  listeners: Set<(index: number | null) => void>
}
const crosshairs = new Map<string, CrosshairState>()

function crosshairState(group: string): CrosshairState {
  let state = crosshairs.get(group)
  if (!state) {
    state = { index: null, listeners: new Set() }
    crosshairs.set(group, state)
  }
  return state
}

export function setCrosshair(group: string, index: number | null): void {
  const state = crosshairState(group)
  if (state.index === index) return
  state.index = index
  for (const listener of [...state.listeners]) listener(index)
}

export function getCrosshair(group: string): number | null {
  return crosshairs.get(group)?.index ?? null
}

export function subscribeCrosshair(group: string, listener: (index: number | null) => void): () => void {
  const state = crosshairState(group)
  state.listeners.add(listener)
  return () => {
    state.listeners.delete(listener)
  }
}

export function withCrosshair<T extends ChartOptions>(options: T, group: string | null): T {
  if (group === null) return options
  return { ...options, plugins: { ...options.plugins, crosshairSync: { group } } } as T
}

function groupOf(chart: Chart, pluginOptions?: unknown): string | null {
  const own = (pluginOptions as { group?: unknown } | undefined)?.group
  const group = own ?? (chartPlugins(chart)?.['crosshairSync'] as { group?: unknown } | undefined)?.group
  return typeof group === 'string' && group !== '' ? group : null
}

const crosshairSubscriptions = new WeakMap<Chart, () => void>()

function showCrosshair(chart: Chart, index: number | null): void {
  const active =
    index === null
      ? []
      : chart.data.datasets.flatMap((dataset, datasetIndex) => {
          const value = (dataset.data as unknown[])[index]
          return chart.isDatasetVisible(datasetIndex) && value !== null && value !== undefined ? [{ datasetIndex, index }] : []
        })
  const x = chart.scales.x
  chart.setActiveElements(active)
  chart.tooltip?.setActiveElements(active, {
    x: index === null || !x ? 0 : x.getPixelForValue(index),
    y: chart.chartArea.top,
  })
  chart.update()
}

/** design.md §9.5: one day read across every chart of a group. Inert on a chart without `plugins.crosshairSync.group`. */
export const crosshairSyncPlugin: Plugin = {
  id: 'crosshairSync',
  afterInit(chart, _args, pluginOptions) {
    const group = groupOf(chart, pluginOptions)
    if (group === null) return
    crosshairSubscriptions.get(chart)?.()
    crosshairSubscriptions.set(chart, subscribeCrosshair(group, (index) => showCrosshair(chart, index)))
  },
  afterDestroy(chart) {
    crosshairSubscriptions.get(chart)?.()
    crosshairSubscriptions.delete(chart)
  },
  afterEvent(chart, args, pluginOptions) {
    const group = groupOf(chart, pluginOptions)
    const x = chart.scales.x
    if (group === null || !x) return
    const { event, inChartArea } = args as { event: { type: string; x: number | null }; inChartArea: boolean }
    if (event.type === 'mousemove' && inChartArea && event.x !== null) {
      const last = Math.max(0, (chart.data.labels?.length ?? 1) - 1)
      const raw = Math.round(x.getValueForPixel(event.x) ?? 0)
      setCrosshair(group, Math.min(last, Math.max(0, raw)))
    } else if (event.type === 'mouseout' || event.type === 'mousemove') {
      setCrosshair(group, null)
    }
  },
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const group = groupOf(chart, pluginOptions)
    const x = chart.scales.x
    if (group === null || !x) return
    const index = getCrosshair(group)
    if (index === null || index < x.min || index > x.max) return
    const { ctx, chartArea: area } = chart
    const px = x.getPixelForValue(index)
    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = CHART_COLORS['ink-subtle']
    ctx.beginPath()
    ctx.moveTo(px, area.top)
    ctx.lineTo(px, area.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

/** design.md §4.4: canvas text does not follow rem, so the page hands the root size over. */
export function applyChartScale(rootPx: number): void {
  Chart.defaults.font.size = 0.8125 * rootPx
  // Assigned, not merged: the tooltip fonts are routed accessors, and a merge writes to a copy.
  Chart.defaults.plugins.tooltip.titleFont = { weight: 600, size: 0.875 * rootPx }
  Chart.defaults.plugins.tooltip.bodyFont = { size: 0.875 * rootPx }
  Chart.defaults.color = rootPx > 16 ? CHART_COLORS['ink-muted'] : CHART_COLORS['ink-subtle']
}

/**
 * Chart.js 4's own `defaults.animation` (applyAnimationsDefaults). Animations.configure copies only the keys of
 * this object into each animated property, so every one must stay: without `type`, colours get no interpolator.
 */
const CHARTJS_ANIMATION = {
  delay: undefined,
  duration: 1000,
  easing: 'easeOutQuart',
  fn: undefined,
  from: undefined,
  loop: undefined,
  to: undefined,
  type: undefined,
} as const

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/** Piecemeal registration plus the design.md §9.1 defaults. Safe to call more than once. */
export function registerCharts(): void {
  Chart.register(
    LineController,
    BarController,
    PieController,
    DoughnutController,
    LineElement,
    PointElement,
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Filler,
    peakShadingPlugin,
    eventBandsPlugin,
    crosshairSyncPlugin,
    SankeyController,
    Flow,
    lineEndLabelsPlugin,
    quadrantLabelsPlugin,
  )

  const d = Chart.defaults
  d.font.family = FONT_FAMILY
  d.font.weight = 400
  d.borderColor = CHART_COLORS['border']
  d.maintainAspectRatio = false
  // Rebuilt whole, neither merged nor trimmed: one without `type` leaves colour animations with no interpolator
  // (`this._fn is not a function`), and a merge after an earlier call's `false` starts from an empty object.
  d.animation = prefersReducedMotion() ? false : { ...CHARTJS_ANIMATION, duration: 250, easing: 'easeOutCubic' }

  // The legend is DOM (design.md §7.18), so Chart.js never draws one.
  d.set('plugins.legend', { display: false })
  d.set('plugins.tooltip', {
    backgroundColor: CHART_COLORS['ink'],
    titleColor: CHART_COLORS['on-ink'],
    bodyColor: CHART_COLORS['on-ink'],
    padding: 10,
    cornerRadius: 8,
    boxPadding: 6,
    usePointStyle: true,
    caretSize: 6,
    borderWidth: 0,
  })

  d.set('scale', {
    border: { display: false },
    grid: { color: CHART_COLORS['border'], lineWidth: 1 },
    title: { color: CHART_COLORS['ink-muted'], font: { weight: 500 } },
    ticks: { padding: 6, autoSkip: true, maxRotation: 0 },
  })
  d.set('scales.category', { grid: { display: false } })
  d.set('scales.linear', { beginAtZero: true })

  d.set('elements.line', {
    borderWidth: 2.5,
    tension: 0,
    borderCapStyle: 'round',
    borderJoinStyle: 'round',
  })
  d.set('elements.point', { radius: 4, hoverRadius: 5, hitRadius: 8 })
  d.set('elements.bar', { borderRadius: 4, borderSkipped: 'start' })
  d.set('elements.arc', { borderColor: CHART_COLORS['card'], borderWidth: 2 })
  d.set('datasets.bar', { maxBarThickness: 32 })

  Chart.overrides.line.interaction = { mode: 'index', intersect: false, axis: 'x', includeInvisible: false }
  for (const type of ['bar', 'pie', 'doughnut'] as const) {
    Chart.overrides[type].interaction = { mode: 'nearest', intersect: true, axis: 'xy', includeInvisible: false }
  }

  applyChartScale(16)
}

// Registered once at load, so importing this module is all a chart component needs (no call from main.tsx).
registerCharts()
