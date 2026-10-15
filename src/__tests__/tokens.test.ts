/**
 * Section 22, acceptance criterion 2: `src/index.css` is design.md §12.1 and
 * `index.html` loads the fonts of design.md §12.2.
 *
 * The expected declarations are design.md §12.1's `@theme` block, one entry per
 * custom property, so a drifted value names the token that drifted.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8')

const EXPECTED_THEME: Array<[string, string]> = [
  ['--color-white', '#ffffff'],
  ['--color-black', '#000000'],
  ['--color-canvas', '#f5f0e3'],
  ['--color-card', '#fffdf8'],
  ['--color-inset', '#faf6ec'],
  ['--color-muted', '#efe8d7'],
  ['--color-overlay', 'rgb(38 34 27 / 0.5)'],
  ['--color-ink', '#26221b'],
  ['--color-ink-muted', '#575044'],
  ['--color-ink-subtle', '#6b6354'],
  ['--color-on-ink', '#fffdf8'],
  ['--color-on-accent', '#ffffff'],
  ['--color-on-danger', '#ffffff'],
  ['--color-border', '#e4dcc8'],
  ['--color-border-strong', '#c9bea6'],
  ['--color-border-control', '#8c8069'],
  ['--color-ring', '#2d6a55'],
  ['--color-accent', '#2d6a55'],
  ['--color-accent-hover', '#22543f'],
  ['--color-accent-subtle', '#e2eee7'],
  ['--color-accent-line', '#b5d0c3'],
  ['--color-ochre', '#a06a12'],
  ['--color-peak', '#f7edd3'],
  ['--color-success', '#2d6a55'],
  ['--color-success-ink', '#22543f'],
  ['--color-success-subtle', '#e2eee7'],
  ['--color-success-line', '#b5d0c3'],
  ['--color-warning', '#a06a12'],
  ['--color-warning-ink', '#7a500e'],
  ['--color-warning-subtle', '#f7eacb'],
  ['--color-warning-line', '#e3c98f'],
  ['--color-danger', '#b23a1e'],
  ['--color-danger-ink', '#8f2e16'],
  ['--color-danger-subtle', '#f9e1d8'],
  ['--color-danger-line', '#edb8a6'],
  ['--color-danger-hover', '#932f17'],
  ['--color-info', '#1f6f9c'],
  ['--color-info-ink', '#185a80'],
  ['--color-info-subtle', '#deebf3'],
  ['--color-info-line', '#b3cfe2'],
  ['--color-p1', '#2a78d6'],
  ['--color-p2', '#d9622b'],
  ['--color-p3', '#6250d6'],
  ['--color-p4', '#a88400'],
  ['--color-p5', '#c9518a'],
  ['--color-p6', '#4a8a1f'],
  ['--color-series-demand', '#26221b'],
  ['--color-series-delivered', '#2a78d6'],
  ['--color-series-sold', '#4a8a1f'],
  ['--color-series-spoiled', '#6250d6'],
  ['--color-series-backlog', '#d9622b'],
  ['--color-series-lost', '#c9518a'],
  ['--color-series-liquidated', '#a88400'],
  ['--font-sans', '"Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'],
  ['--font-display', '"Quicksand", "Figtree", ui-sans-serif, system-ui, sans-serif'],
  ['--font-mono', 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'],
  ['--text-xs', '0.8125rem'],
  ['--text-xs--line-height', '1.125rem'],
  ['--text-stat', '1.75rem'],
  ['--text-stat--line-height', '2rem'],
  ['--text-stat--font-weight', '700'],
  ['--text-figure', '3rem'],
  ['--text-figure--line-height', '1.05'],
  ['--text-figure--font-weight', '700'],
  ['--radius-xs', '0.25rem'],
  ['--radius-sm', '0.5rem'],
  ['--radius-md', '0.75rem'],
  ['--radius-lg', '1rem'],
  ['--shadow-card', '0 1px 2px rgb(38 34 27 / 0.05), 0 4px 12px -6px rgb(38 34 27 / 0.1)'],
  ['--shadow-raised', '0 2px 4px rgb(38 34 27 / 0.06), 0 16px 32px -12px rgb(38 34 27 / 0.22)'],
  ['--container-form', '40rem'],
  ['--container-player', '56rem'],
  ['--container-summary', '72rem'],
  ['--container-config', '80rem'],
  ['--container-console', '96rem'],
  ['--ease-standard', 'cubic-bezier(0.2, 0, 0, 1)'],
  ['--ease-exit', 'cubic-bezier(0.4, 0, 1, 1)'],
  ['--default-transition-duration', '150ms'],
  ['--default-transition-timing-function', 'cubic-bezier(0.2, 0, 0, 1)'],
]

const norm = (v: string): string => v.replace(/\s+/g, ' ').trim().toLowerCase()

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** The body of the first `@theme { ... }` block (no nested braces inside it). */
function themeBlock(css: string): string {
  const m = /@theme\s*\{([\s\S]*?)\n\}/.exec(stripComments(css))
  if (!m) throw new Error('no @theme block')
  return m[1]
}

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of block.matchAll(/(--[a-z0-9*-]+)\s*:\s*([^;]+);/gi)) out.set(m[1], norm(m[2]))
  return out
}

describe('src/index.css (design.md §12.1)', () => {
  const css = read('src/index.css')
  const theme = (() => {
    try {
      return declarations(themeBlock(css))
    } catch {
      return new Map<string, string>()
    }
  })()

  it('imports tailwind and removes the default palette', () => {
    expect(css).toMatch(/@import\s+["']tailwindcss["']/)
    expect(theme.get('--color-*')).toBe('initial')
  })

  it.each(EXPECTED_THEME)('@theme declares %s as %s', (name, value) => {
    expect(theme.get(name)).toBe(norm(value))
  })

  it('redefines nothing the design does not declare (no stray colours)', () => {
    const expected = new Set(EXPECTED_THEME.map(([n]) => n))
    expected.add('--color-*')
    for (const name of theme.keys()) expect(expected.has(name), `${name} is not in design.md §12.1`).toBe(true)
  })

  it('carries the base layer: projection scales, focus ring, reduced motion, print', () => {
    const body = stripComments(css)
    expect(body).toContain('@layer base')
    expect(body).toMatch(/html\[data-scale="debrief"\]\s*\{\s*font-size:\s*112\.5%/)
    expect(body).toMatch(/html\[data-scale="presentation"\]\s*\{\s*font-size:\s*125%/)
    expect(body).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--color-ring\);\s*outline-offset:\s*2px/)
    expect(body).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(body).toMatch(/transition-duration:\s*0\.01ms !important/)
    expect(body).toMatch(/@media print/)
    expect(body).toMatch(/@page\s*\{\s*margin:\s*12mm/)
  })
})

describe('index.html (design.md §12.2)', () => {
  const doc = new DOMParser().parseFromString(read('index.html'), 'text/html')

  it('loads Figtree 400-700 and Quicksand 600-700 with display=swap', () => {
    const sheet = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).find((l) =>
      (l.getAttribute('href') ?? '').startsWith('https://fonts.googleapis.com/css2'),
    )
    expect(sheet, 'a Google Fonts stylesheet link').toBeTruthy()
    const href = sheet!.getAttribute('href')!
    expect(href).toContain('family=Figtree:wght@400;500;600;700')
    expect(href).toContain('family=Quicksand:wght@600;700')
    expect(href).toContain('display=swap')
  })

  it('preconnects to both Google font hosts, the static one with crossorigin', () => {
    const pre = Array.from(doc.head.querySelectorAll('link[rel="preconnect"]'))
    const api = pre.find((l) => l.getAttribute('href') === 'https://fonts.googleapis.com')
    const stat = pre.find((l) => l.getAttribute('href') === 'https://fonts.gstatic.com')
    expect(api).toBeTruthy()
    expect(stat).toBeTruthy()
    expect(stat!.hasAttribute('crossorigin')).toBe(true)
  })

  it('sets the theme colour after the viewport meta', () => {
    const viewport = doc.head.querySelector('meta[name="viewport"]')!
    const theme = doc.head.querySelector('meta[name="theme-color"]')!
    expect(theme.getAttribute('content')!.toLowerCase()).toBe('#f5f0e3')
    expect(viewport.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the existing preconnects, description and title', () => {
    const hrefs = Array.from(doc.head.querySelectorAll('link[rel="preconnect"]')).map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('https://securetoken.googleapis.com')
    expect(hrefs).toContain('https://identitytoolkit.googleapis.com')
    expect(doc.head.querySelector('meta[name="description"]')).toBeTruthy()
    expect(doc.title).toBe('Pulky — The Pulque Game')
  })
})
