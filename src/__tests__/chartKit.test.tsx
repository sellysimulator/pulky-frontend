/**
 * Section 33 - chart kit hardening: Legend as a control, CrosshairGroup, ChartBox in a group and its error
 * fallback, DemandSupplyChart on Legend, and the one-hatch-helper rule (design.md §7.18, §9.2, §9.4, §9.5).
 * The pure chartSetup pieces (hatching, bands, emphasis, crosshair store and plugin) are in chartSetup.test.ts.
 */
import { createElement, useEffect, type ReactElement } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Line: (props: { data?: unknown }) => createElement('div', { 'data-testid': 'chart-line', 'data-chart': JSON.stringify(props.data) }),
  Bar: () => createElement('div', { 'data-testid': 'chart-bar' }),
  Pie: () => createElement('div', { 'data-testid': 'chart-pie' }),
  Doughnut: () => createElement('div', { 'data-testid': 'chart-doughnut' }),
}))

import { getCrosshair, setCrosshair } from '../components/charts/chartSetup'
import CrosshairGroup, { useCrosshairGroup } from '../components/charts/CrosshairGroup'
import DemandSupplyChart from '../components/results/DemandSupplyChart'
import {
  DEMAND_SUPPLY_LABELS,
  DEMAND_SUPPLY_LEGEND_ORDER,
} from '../components/results/demandSupplyConfig'
import ChartBox from '../components/shared/ChartBox'
import Legend from '../components/shared/Legend'
import { makeView } from './fixtures/results'

const ITEMS = [
  { key: 'a', label: 'Alpha', swatch: { kind: 'line' as const, color: '#2a78d6', dash: [12, 4], pointStyle: 'rect', width: 4 } },
  { key: 'b', label: 'Beta', swatch: { kind: 'line' as const, color: '#d9622b' } },
  { key: 'c', label: 'Gamma', swatch: { kind: 'fill' as const, color: '#4a8a1f', hatched: true } },
]

afterEach(() => vi.restoreAllMocks())

describe('Legend: static mode (criterion 6)', () => {
  it('is a ul with one li per item, swatch then label, and no focusable item', () => {
    const { container } = render(<Legend items={ITEMS} />)
    const list = container.querySelector('ul') as HTMLElement
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    for (const li of screen.getAllByRole('listitem')) expect(li).not.toHaveAttribute('tabindex')
    expect(list.className).not.toContain('print:hidden')
  })

  it.each([
    ['only hidden', { hidden: new Set<string>() }],
    ['only onToggle', { onToggle: vi.fn() }],
  ])('renders static when %s is given', (_n, extra) => {
    render(<Legend items={ITEMS} {...extra} />)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('line swatches carry dash and width (default 2.5); a fill swatch with hatched uses a pattern', () => {
    const { container } = render(<Legend items={ITEMS} />)
    const lines = container.querySelectorAll('line[stroke]')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveAttribute('stroke-dasharray', '12 4')
    expect(lines[0]).toHaveAttribute('stroke-width', '4')
    expect(lines[1]).not.toHaveAttribute('stroke-dasharray')
    expect(lines[1]).toHaveAttribute('stroke-width', '2.5')
    expect(screen.getAllByRole('listitem')[2].querySelector('pattern')).not.toBeNull()
    expect(screen.getAllByRole('listitem')[0].querySelector('rect')).not.toBeNull() // the rect point marker
  })

  it('an empty dash draws no stroke-dasharray', () => {
    const { container } = render(<Legend items={[{ key: 'a', label: 'A', swatch: { kind: 'line', color: '#000000', dash: [] } }]} />)
    expect(container.querySelector('line')).not.toHaveAttribute('stroke-dasharray')
  })
})

describe('Legend: switch mode (criterion 6)', () => {
  it('one role=switch button per item, named by its label, in a print:hidden list', () => {
    const { container } = render(<Legend items={ITEMS} hidden={new Set()} onToggle={() => undefined} />)
    const switches = screen.getAllByRole('switch')
    expect(switches.map((s) => s.textContent)).toEqual(['Alpha', 'Beta', 'Gamma'])
    for (const s of switches) {
      expect(s.tagName).toBe('BUTTON')
      expect(s).toHaveAttribute('type', 'button')
      expect(s).toHaveAttribute('aria-checked', 'true')
    }
    expect(screen.getByRole('switch', { name: 'Beta' })).toBeInTheDocument()
    const ul = container.querySelector('ul') as HTMLElement
    expect(ul.className).toContain('print:hidden')
    expect(within(ul).getAllByRole('listitem')).toHaveLength(3)
  })

  // Failure mode 4: switch state inverted.
  it('aria-checked is false exactly for the keys in hidden', () => {
    render(<Legend items={ITEMS} hidden={new Set(['b'])} onToggle={() => undefined} />)
    expect(screen.getByRole('switch', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true')
  })

  it('off: the label is text-ink-subtle and the swatch wrapper opacity-30; on: the label is text-ink', () => {
    render(<Legend items={ITEMS} hidden={new Set(['b'])} onToggle={() => undefined} />)
    const off = screen.getByRole('switch', { name: 'Beta' })
    const on = screen.getByRole('switch', { name: 'Alpha' })
    expect(within(off).getByText('Beta').className).toContain('text-ink-subtle')
    expect(off.querySelector('.opacity-30')).not.toBeNull()
    expect(within(on).getByText('Alpha').className).toMatch(/(^|\s)text-ink(\s|$)/)
    expect(on.querySelector('.opacity-30')).toBeNull()
  })

  it('click, Space and Enter each call onToggle(key) once, and the legend keeps no state', async () => {
    const onToggle = vi.fn()
    render(<Legend items={ITEMS} hidden={new Set()} onToggle={onToggle} />)
    const user = userEvent.setup()
    const beta = screen.getByRole('switch', { name: 'Beta' })
    await user.click(beta)
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenLastCalledWith('b')
    beta.focus()
    await user.keyboard(' ')
    expect(onToggle).toHaveBeenCalledTimes(2)
    await user.keyboard('{Enter}')
    expect(onToggle).toHaveBeenCalledTimes(3)
    expect(onToggle).toHaveBeenLastCalledWith('b')
    expect(beta).toHaveAttribute('aria-checked', 'true')
  })

  it('uses the same swatches as the static legend', () => {
    const { container } = render(<Legend items={ITEMS} hidden={new Set()} onToggle={() => undefined} />)
    expect(container.querySelector('line[stroke-dasharray="12 4"]')).toHaveAttribute('stroke-width', '4')
    expect(container.querySelector('pattern')).not.toBeNull()
  })
})

describe('Legend: emphasis mode (criterion 6)', () => {
  it('static: items become focusable and report hover and focus, leaving and blur report null', () => {
    const onFocusItem = vi.fn()
    render(<Legend items={ITEMS} onFocusItem={onFocusItem} />)
    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveAttribute('tabindex', '0')
    expect(first.className).toContain('ring-ring')
    fireEvent.pointerEnter(first)
    expect(onFocusItem).toHaveBeenLastCalledWith('a')
    fireEvent.pointerLeave(first)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
    fireEvent.focus(second)
    expect(onFocusItem).toHaveBeenLastCalledWith('b')
    fireEvent.blur(second)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
  })

  it('switches: the events fire on the switch, and toggling still works', () => {
    const onFocusItem = vi.fn()
    const onToggle = vi.fn()
    render(<Legend items={ITEMS} hidden={new Set()} onToggle={onToggle} onFocusItem={onFocusItem} />)
    const gamma = screen.getByRole('switch', { name: 'Gamma' })
    fireEvent.pointerEnter(gamma)
    expect(onFocusItem).toHaveBeenLastCalledWith('c')
    fireEvent.pointerLeave(gamma)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
    fireEvent.focus(gamma)
    expect(onFocusItem).toHaveBeenLastCalledWith('c')
    fireEvent.blur(gamma)
    expect(onFocusItem).toHaveBeenLastCalledWith(null)
    fireEvent.click(gamma)
    expect(onToggle).toHaveBeenCalledWith('c')
    for (const li of screen.getAllByRole('listitem')) expect(li).not.toHaveAttribute('tabindex')
  })
})

/* ───────────── CrosshairGroup and ChartBox in a group ───────────── */

function Probe({ onId }: { onId?: (id: string | null) => void }): ReactElement {
  const id = useCrosshairGroup()
  useEffect(() => {
    onId?.(id)
  })
  return <span data-testid="probe">{id ?? 'none'}</span>
}

function box(title: string, children: ReactElement = <div>plot {title}</div>) {
  return (
    <ChartBox title={title} ariaLabel={`${title} chart`} height={240} table={<table><tbody><tr><td>{title} table</td></tr></tbody></table>}>
      {children}
    </ChartBox>
  )
}

const liveRegion = (container: HTMLElement): HTMLElement => container.querySelector('[aria-live="polite"]') as HTMLElement

describe('CrosshairGroup (criterion 10)', () => {
  it('provides a group id to useCrosshairGroup, null outside, and a different id per mount', () => {
    const ids: Array<string | null> = []
    render(<Probe onId={(i) => ids.push(i)} />)
    expect(screen.getByTestId('probe')).toHaveTextContent('none')
    const seen: Array<string | null> = []
    render(
      <>
        <CrosshairGroup days={3}><Probe onId={(i) => seen.push(i)} /></CrosshairGroup>
        <CrosshairGroup days={3}><Probe onId={(i) => seen.push(i)} /></CrosshairGroup>
      </>,
    )
    const [a, b] = [seen[0], seen[seen.length - 1]]
    expect(typeof a).toBe('string')
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('renders its children in a div beside an sr-only polite live region, empty while the index is null', () => {
    const { container } = render(<CrosshairGroup days={14}>{box('One')}</CrosshairGroup>)
    const live = liveRegion(container)
    expect(live).not.toBeNull()
    expect(live.className).toContain('sr-only')
    expect(live.textContent).toBe('')
    expect(screen.getByText('plot One')).toBeInTheDocument()
  })

  it('announces Day {i + 1} for the group index and empties when cleared', () => {
    const id = { current: '' }
    const { container } = render(<CrosshairGroup days={14}><Probe onId={(i) => (id.current = i ?? '')} /></CrosshairGroup>)
    act(() => setCrosshair(id.current, 4))
    expect(liveRegion(container).textContent).toBe('Day 5')
    act(() => setCrosshair(id.current, null))
    expect(liveRegion(container).textContent).toBe('')
  })

  it('sets the index to null on unmount', () => {
    let id: string | null = null
    const { unmount } = render(<CrosshairGroup days={14}><Probe onId={(i) => (id = i)} /></CrosshairGroup>)
    act(() => setCrosshair(id as unknown as string, 6))
    expect(getCrosshair(id as unknown as string)).toBe(6)
    unmount()
    expect(getCrosshair(id as unknown as string)).toBeNull()
  })
})

describe('ChartBox in a CrosshairGroup (criterion 10, §3.6, §4)', () => {
  const plots = () => screen.getAllByRole('img')

  it('outside a group the plot has no tabIndex and ignores keys', () => {
    render(box('Solo'))
    const plot = plots()[0]
    expect(plot).not.toHaveAttribute('tabindex')
    expect(plot.className).not.toContain('focus-visible:ring-2')
    expect(fireEvent.keyDown(plot, { key: 'ArrowLeft' })).toBe(true)
  })

  it('inside a group the plot is focusable with the focus ring', () => {
    render(<CrosshairGroup days={14}>{box('One')}{box('Two')}</CrosshairGroup>)
    for (const p of plots()) {
      expect(p).toHaveAttribute('tabindex', '0')
      expect(p.className).toContain('focus-visible:ring-2')
      expect(p.className).toContain('focus-visible:ring-ring')
    }
  })

  it('walks the §4 example: focus -> Day 14, ArrowLeft -> 13, Home -> 1, ArrowLeft -> 1, Escape -> empty', () => {
    const { container } = render(<CrosshairGroup days={14}>{box('One')}{box('Two')}</CrosshairGroup>)
    const live = liveRegion(container)
    const [plot] = plots()
    fireEvent.focus(plot)
    expect(live.textContent).toBe('Day 14')
    expect(fireEvent.keyDown(plot, { key: 'ArrowLeft' })).toBe(false)
    expect(live.textContent).toBe('Day 13')
    expect(fireEvent.keyDown(plot, { key: 'Home' })).toBe(false)
    expect(live.textContent).toBe('Day 1')
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(live.textContent).toBe('Day 1')
    expect(fireEvent.keyDown(plot, { key: 'Escape' })).toBe(false)
    expect(live.textContent).toBe('')
  })

  it('ArrowRight and End move forward, clamped to the last day; from null either arrow sets the last day', () => {
    const { container } = render(<CrosshairGroup days={5}>{box('One')}</CrosshairGroup>)
    const live = liveRegion(container)
    const [plot] = plots()
    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    expect(live.textContent).toBe('Day 5')
    fireEvent.keyDown(plot, { key: 'Escape' })
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(live.textContent).toBe('Day 5')
    fireEvent.keyDown(plot, { key: 'Home' })
    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    expect(live.textContent).toBe('Day 2')
    fireEvent.keyDown(plot, { key: 'End' })
    expect(live.textContent).toBe('Day 5')
    expect(fireEvent.keyDown(plot, { key: 'ArrowRight' })).toBe(false)
    expect(live.textContent).toBe('Day 5')
  })

  it('focus keeps an index already set', () => {
    let id: string | null = null
    const { container } = render(<CrosshairGroup days={14}><Probe onId={(i) => (id = i)} />{box('One')}</CrosshairGroup>)
    act(() => setCrosshair(id as unknown as string, 2))
    fireEvent.focus(plots()[0])
    expect(liveRegion(container).textContent).toBe('Day 3')
  })

  it('other keys are left alone', () => {
    render(<CrosshairGroup days={14}>{box('One')}</CrosshairGroup>)
    expect(fireEvent.keyDown(plots()[0], { key: 'a' })).toBe(true)
    expect(fireEvent.keyDown(plots()[0], { key: 'Tab' })).toBe(true)
  })

  it('blur to an element outside the group, or to nothing, clears; blur to another plot of the group keeps', () => {
    const { container } = render(
      <>
        <button type="button">outside</button>
        <CrosshairGroup days={14}>{box('One')}{box('Two')}</CrosshairGroup>
      </>,
    )
    const live = liveRegion(container)
    const [one, two] = plots()
    fireEvent.focus(one)
    expect(live.textContent).toBe('Day 14')
    fireEvent.blur(one, { relatedTarget: two })
    expect(live.textContent).toBe('Day 14')
    fireEvent.blur(two, { relatedTarget: screen.getByRole('button', { name: 'outside' }) })
    expect(live.textContent).toBe('')
    fireEvent.focus(one)
    expect(live.textContent).toBe('Day 14')
    fireEvent.blur(one, { relatedTarget: null })
    expect(live.textContent).toBe('')
  })
})

/* ───────────── ChartBox error fallback (criterion 11) ───────────── */

const FALLBACK = 'The chart could not be drawn here. The same figures are in the table.'

describe('ChartBox error fallback (criterion 11)', () => {
  const state = { throws: true }
  function Bomb(): ReactElement {
    if (state.throws) throw new Error('chart exploded')
    return <div>the live chart</div>
  }
  function setup() {
    state.throws = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    return render(
      <ChartBox
        title="Broken chart"
        caption="Some caption"
        ariaLabel="broken"
        height={240}
        controls={<button type="button">a control</button>}
        legend={<ul><li>legend item</li></ul>}
        table={<table><tbody><tr><td>table cell 42</td></tr></tbody></table>}
      >
        <Bomb />
      </ChartBox>,
    )
  }

  it('shows the note in place of the plot, at the plot height, and keeps title, caption, controls, legend and toggle', () => {
    setup()
    const note = screen.getByText(FALLBACK)
    expect(note.tagName).toBe('P')
    for (const c of ['text-sm', 'text-ink-muted', 'text-center']) expect(note.className).toContain(c)
    const wrapper = note.parentElement as HTMLElement
    expect(wrapper.className).toContain('grid')
    expect(wrapper.className).toContain('place-items-center')
    expect(wrapper.style.height).toBe('15rem')
    expect(screen.getByText('Broken chart')).toBeInTheDocument()
    expect(screen.getByText('Some caption')).toBeInTheDocument()
    expect(screen.getByText('a control')).toBeInTheDocument()
    expect(screen.getByText('legend item')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show table' })).toBeInTheDocument()
    expect(screen.queryByText('the live chart')).toBeNull()
  })

  // Failure mode 8: the fallback eating the table.
  it('Show table still renders the table prop after the chart threw', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    expect(screen.getByText('table cell 42')).toBeInTheDocument()
    expect(screen.queryByText(FALLBACK)).toBeNull()
    expect(screen.getByRole('button', { name: 'Show chart' })).toBeInTheDocument()
    expect(screen.getByText('legend item')).toBeInTheDocument()
  })

  it('Show chart mounts a fresh boundary: a chart that no longer throws is drawn, one that still throws shows the note again', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Show table' }))
    await user.click(screen.getByRole('button', { name: 'Show chart' }))
    expect(screen.getByText(FALLBACK)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show table' }))
    state.throws = false
    await user.click(screen.getByRole('button', { name: 'Show chart' }))
    expect(screen.getByText('the live chart')).toBeInTheDocument()
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })

  it('a chart that does not throw is unchanged: the plot is a role=img of the plot height', () => {
    render(box('Fine'))
    const plot = screen.getByRole('img', { name: 'Fine chart' })
    expect(plot.style.height).toBe('15rem')
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })
})

/* ───────────── DemandSupplyChart on Legend (criterion 7) ───────────── */

describe('DemandSupplyChart uses Legend in switch mode (criterion 7, §3.3)', () => {
  it('renders one switch per series in legend order with the section 29 labels, all on, in a print:hidden list', () => {
    render(<DemandSupplyChart view={makeView()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches.map((s) => s.textContent)).toEqual(DEMAND_SUPPLY_LEGEND_ORDER.map((k) => DEMAND_SUPPLY_LABELS[k]))
    for (const s of switches) expect(s).toHaveAttribute('aria-checked', 'true')
    expect((switches[0].closest('ul') as HTMLElement).className).toContain('print:hidden')
  })

  it('switch swatches are the series line style (dash, width) with no point marker', () => {
    render(<DemandSupplyChart view={makeView()} />)
    const [demand, delivered] = screen.getAllByRole('switch')
    const d = demand.querySelector('line') as Element
    expect(d).toHaveAttribute('stroke-width', '4')
    expect(d).not.toHaveAttribute('stroke-dasharray')
    expect(delivered.querySelector('line')).toHaveAttribute('stroke-dasharray', '12 4')
    expect(delivered.querySelector('line')).toHaveAttribute('stroke-width', '2.5')
    for (const s of screen.getAllByRole('switch')) {
      expect(s.querySelector('svg[width="24"] :is(rect, polygon, circle, path)')).toBeNull()
    }
  })

  it('switching a series off flips its switch and removes its dataset from the chart and its column from the table', async () => {
    render(<DemandSupplyChart view={makeView()} />)
    const user = userEvent.setup()
    const datasets = () => (JSON.parse(screen.getByTestId('chart-line').getAttribute('data-chart') as string).datasets as unknown[]).length
    expect(datasets()).toBe(5)
    await user.click(screen.getByRole('switch', { name: 'Units spoiled' }))
    expect(screen.getByRole('switch', { name: 'Units spoiled' })).toHaveAttribute('aria-checked', 'false')
    expect(datasets()).toBe(4)
    expect(screen.queryAllByRole('columnheader', { name: 'Units spoiled' })).toHaveLength(0)
    await user.click(screen.getByRole('switch', { name: 'Units spoiled' }))
    expect(datasets()).toBe(5)
  })
})

/* ───────────── one hatch helper (criterion 1) ───────────── */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('one hatch helper (criterion 1)', () => {
  const root = resolve(process.cwd(), 'src')
  const kit = resolve(root, 'components/charts/chartSetup.ts')
  const files = sourceFiles(root)

  it('only chartSetup.ts calls createPattern', () => {
    const offenders = files.filter((f) => f !== kit && /createPattern\s*\(/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('no other file defines a function named hatch, hatched or hatchPattern', () => {
    const def = /(function\s+(hatch|hatched|hatchPattern)\b|(const|let|var)\s+(hatch|hatched|hatchPattern)\s*(:[^=]*)?=\s*(async\s*)?(function\b|\([^)]*\)\s*(:[^=]*)?=>|\w+\s*=>))/
    const offenders = files.filter((f) => f !== kit && def.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it.each(['components/host/MarketCharts.tsx', 'components/game/DetailsPanel.tsx', 'components/results/demandSupplyConfig.ts'])(
    '%s imports hatched from chartSetup',
    (file) => {
      const src = readFileSync(resolve(root, file), 'utf8')
      expect(src).toMatch(/import\s*\{[^}]*\bhatched\b[^}]*\}\s*from\s*'[./]*(?:\.\.\/)?charts\/chartSetup'/)
    },
  )

  it('chartSetup.ts exports the kit surface', async () => {
    const kitModule = await import('../components/charts/chartSetup')
    for (const name of ['hatchPattern', 'hatched', 'eventBandsPlugin', 'emphasisOf', 'pulqueriaLine', 'crosshairSyncPlugin', 'setCrosshair', 'getCrosshair', 'subscribeCrosshair', 'withCrosshair']) {
      expect(kitModule, name).toHaveProperty(name)
    }
  })
})
