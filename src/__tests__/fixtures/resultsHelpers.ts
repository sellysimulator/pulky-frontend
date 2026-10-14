/**
 * Section 29 DOM helpers. `react-chartjs-2` is mocked in each test file so that a chart renders as
 * `<div data-testid="chart-<type>" data-chart="{type,data,options}">`; these helpers read it back.
 */
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { screen } from '@testing-library/react'
import http from '../../api/http'

export interface ParsedChart {
  element: Element
  type: string
  data: { labels?: unknown[]; datasets: Array<Record<string, any>> } // eslint-disable-line @typescript-eslint/no-explicit-any
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function parseChart(element: Element): ParsedChart {
  const raw = JSON.parse(element.getAttribute('data-chart') ?? '{}')
  return { element, type: raw.type, data: raw.data ?? { datasets: [] }, options: raw.options ?? {} }
}

export function allCharts(root: ParentNode = document): ParsedChart[] {
  return Array.from(root.querySelectorAll('[data-testid^="chart-"]')).map(parseChart)
}

/** The chart that has a dataset with this label. */
export function chartWithDataset(label: string, root: ParentNode = document): ParsedChart | undefined {
  return allCharts(root).find((c) => c.data.datasets.some((d) => d.label === label))
}

/** The ChartBox `figure` whose caption holds this exact title. */
export function figureTitled(title: string): HTMLElement {
  const figure = screen.getByText(title).closest('figure')
  if (!figure) throw new Error(`no figure for "${title}"`)
  return figure as HTMLElement
}

export function chartInFigure(title: string): ParsedChart {
  const charts = allCharts(figureTitled(title))
  if (charts.length !== 1) throw new Error(`expected one chart in "${title}", found ${charts.length}`)
  return charts[0]
}

/** True when the element or one of its ancestors carries this exact class token (`print:hidden`). */
export function hasClassAncestor(el: Element | null, token: string): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.className && typeof node.className === 'string' && node.className.split(/\s+/).includes(token)) return true
  }
  return false
}

function ownText(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent ?? '')
    .join('')
    .trim()
}

/**
 * Elements whose own text is exactly `text`, ignoring the print-only compact list of block 1
 * (spec 13.8 / design.md 8.8 print it whether or not the figures are revealed).
 */
export function onScreen(text: string): Element[] {
  return Array.from(document.body.querySelectorAll('*')).filter(
    (el) => ownText(el) === text && !hasClassAncestor(el, 'print:block'),
  )
}

/** All text nodes of the page, joined by spaces so that neighbouring elements never run together. */
function spacedText(): string {
  const parts: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? '').trim()
    if (t) parts.push(t)
  }
  return parts.join(' ')
}

/** The first number after each occurrence of `label`, in document order. */
export function numbersAfter(label: string): string[] {
  const re = new RegExp(`${label}\\s*:?\\s*(-?\\d[\\d,]*(?:\\.\\d+)?)(?![\\d,])`, 'g')
  return Array.from(spacedText().matchAll(re), (m) => m[1])
}

/**
 * Which of the given names the smallest ancestor of `el` that mentions any of them mentions:
 * the pulquería(s) whose card or row the element sits in.
 */
export function ownersOf(el: Element, names: string[]): string[] {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const found = names.filter((n) => (node!.textContent ?? '').includes(n))
    if (found.length > 0) return found
  }
  return []
}

export interface Reply {
  status: number
  data?: unknown
}

export interface HttpSpy {
  seen: InternalAxiosRequestConfig[]
  restore(): void
}

/** Replaces the axios adapter of the shared instance (section 21, 3.3a); nothing else is mocked. */
export function mockHttp(handler: (cfg: InternalAxiosRequestConfig, nth: number) => Reply): HttpSpy {
  const original = http.defaults.adapter
  const seen: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    const { status, data } = handler(config, seen.length)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, String(status), config, null, response)
    return response
  }
  http.defaults.adapter = adapter
  return {
    seen,
    restore() {
      http.defaults.adapter = original
    },
  }
}

export const urlPath = (cfg: InternalAxiosRequestConfig) => (cfg.url ?? '').replace(/^\/+/, '').split('?')[0]
export const verb = (cfg: InternalAxiosRequestConfig) => (cfg.method ?? '').toUpperCase()
export const header = (cfg: InternalAxiosRequestConfig, name: string) => AxiosHeaders.from(cfg.headers).get(name)
export function jsonBody(cfg: InternalAxiosRequestConfig): Record<string, unknown> {
  if (cfg.data === undefined || cfg.data === null || cfg.data === '') return {}
  return (typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data) as Record<string, unknown>
}
