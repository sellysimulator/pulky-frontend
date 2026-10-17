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
  type Plugin,
} from 'chart.js'
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

const PEAK_RULE_PX = 3

/**
 * design.md §9.3: fills each peak-window day's column behind the data and
 * draws a 3px ochre rule along its top edge. Reads `plugins.peakShading.days`
 * (0-based x indices).
 */
export const peakShadingPlugin: Plugin = {
  id: 'peakShading',
  beforeDatasetsDraw(chart, _args, pluginOptions) {
    const fromChart = (chart.options as { plugins?: { peakShading?: { days?: number[] } } }).plugins?.peakShading?.days
    const days = (pluginOptions as { days?: number[] } | undefined)?.days ?? fromChart ?? []
    const x = chart.scales.x
    if (days.length === 0 || !x) return

    const { ctx, chartArea: area } = chart
    const count = Math.max(1, x.max - x.min + 1)
    const column = (area.right - area.left) / count

    ctx.save()
    for (const day of days) {
      const centre = x.getPixelForValue(day)
      const left = Math.max(area.left, centre - column / 2)
      const right = Math.min(area.right, centre + column / 2)
      if (right <= left) continue
      ctx.fillStyle = CHART_COLORS['peak']
      ctx.fillRect(left, area.top, right - left, area.bottom - area.top)
      ctx.fillStyle = CHART_COLORS['ochre']
      ctx.fillRect(left, area.top, right - left, PEAK_RULE_PX)
    }
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
  )

  const d = Chart.defaults
  d.font.family = FONT_FAMILY
  d.font.weight = 400
  d.borderColor = CHART_COLORS['border']
  d.maintainAspectRatio = false
  d.animation = prefersReducedMotion() ? false : { duration: 250, easing: 'easeOutCubic' }

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
