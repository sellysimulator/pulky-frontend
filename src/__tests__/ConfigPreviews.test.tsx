/** Section 25 — ConfigPreviews (plan 25 §3.4, §4). Acceptance 11, 12; failure mode 9. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))
// jsdom has no canvas: the chart wrapper is replaced by a plain canvas. The table fallback is real.
vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
  Line: () => <canvas data-testid="chart-canvas" />,
}))

import type { ReactElement } from 'react'
import { ConfigPreviewContext, type ConfigPreviewState } from '../components/config/configPreview'
import {
  DemandCapacityPreview,
  DemandSplitPreview,
  SpoilRiskPreview,
  SpotRangePreview,
  WeekdayPreview,
} from '../components/config/ConfigPreviews'
import { previewState } from './fixtures/serverConfig'

/** Renders a preview with the server's answer for a named config (`config_preview.json`); `hidden` is the defaults. */
function show(node: ReactElement, variant = 'hidden', state: ConfigPreviewState = previewState(variant)) {
  return render(<ConfigPreviewContext.Provider value={state}>{node}</ConfigPreviewContext.Provider>)
}


/** Opens every chart's table fallback (the ChartBox toggle) so its numbers are in the DOM. */
function openTables(): void {
  for (const b of screen.queryAllByRole('button', { name: /table/i })) {
    if (b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b)
  }
}

/** Every number shown in the leaf elements of a container, thousands separators removed. */
function numbersIn(root: HTMLElement): number[] {
  const out: number[] = []
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.children.length > 0) continue
    const m = (el.textContent ?? '').match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []
    for (const n of m) out.push(Number(n.replace(/,/g, '')))
  }
  return out
}

const near = (root: HTMLElement, expected: number, tol = 0.6): boolean =>
  numbersIn(root).some((n) => Math.abs(n - expected) <= tol)

/** Headers and body rows (cell texts) of the table that has a Night column. */
function riskTable(): { headers: string[]; rows: string[][] } {
  const table = screen.getAllByRole('table').find((t) => within(t).queryByText('Night'))
  if (!table) throw new Error('no spoil risk table')
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((h) => h.textContent?.trim() ?? '')
  const rows = within(table)
    .getAllByRole('row')
    .filter((r) => within(r).queryAllByRole('columnheader').length === 0)
    .map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent?.trim() ?? ''))
  return { headers, rows }
}

describe('SpoilRiskPreview (acceptance 11, 12; failure mode 9)', () => {
  it('reproduces the plan 25 §4 table for the defaults (quality 80-100 %, F 0, M 3, X 2)', () => {
    show(<SpoilRiskPreview />)
    const { headers, rows } = riskTable()
    expect(headers).toEqual([
      'Night',
      'Plain lot at 80%',
      'Plain lot at 100%',
      'Conserved lot at 80%',
      'Conserved lot at 100%',
    ])
    expect(rows).toEqual([
      ['1', '53%', '33%', '20%', '0%'],
      ['2', '87%', '67%', '20%', '0%'],
      ['3', '100%', '100%', '53%', '33%'],
      ['4', '—', '—', '87%', '67%'],
      ['5', '—', '—', '100%', '100%'],
    ])
  })

  it('night 1 of the plain lot at the minimum quality is its base risk, not 0 (failure mode 9)', () => {
    show(<SpoilRiskPreview />)
    expect(riskTable().rows[0][1]).toBe('53%')
  })

  it('has one row per night up to max_days + conservation_extra_fresh_days', () => {
    show(<SpoilRiskPreview />, 'f2m6x3')
    const { rows } = riskTable()
    expect(rows).toHaveLength(9)
    expect(rows.map((r) => r[0])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('follows fresh_days: F 2, M 4 puts the 100% lot at 0, 0, 50, 100', () => {
    show(<SpoilRiskPreview />, 'f2m4')
    const { rows } = riskTable()
    expect(rows.slice(0, 4).map((r) => r[2])).toEqual(['0%', '0%', '50%', '100%'])
    expect(rows.slice(0, 4).map((r) => r[1])).toEqual(['20%', '20%', '70%', '100%'])
  })

  it('follows the quality range: headings and values change with quality_min', () => {
    show(<SpoilRiskPreview />, 'qmin70')
    const { headers, rows } = riskTable()
    expect(headers).toContain('Plain lot at 70%')
    expect(headers).toContain('Conserved lot at 70%')
    expect(headers).not.toContain('Plain lot at 80%')
    expect(rows[0][1]).toBe('63%')
  })

  it('has three columns when quality_min equals quality_max', () => {
    show(<SpoilRiskPreview />, 'q90')
    const { headers, rows } = riskTable()
    expect(headers).toEqual(['Night', 'Plain lot at 90%', 'Conserved lot at 90%'])
    expect(rows).toEqual([
      ['1', '43%', '10%'],
      ['2', '77%', '10%'],
      ['3', '100%', '43%'],
      ['4', '—', '77%'],
      ['5', '—', '100%'],
    ])
  })
})

describe('SpotRangePreview', () => {
  it('reads Spot price ranges from {min} to {max} (base 12, spread 0.25: 9 to 15)', () => {
    const { container } = show(<SpotRangePreview />)
    expect(container.textContent).toMatch(/Spot price ranges from \$?9(\.00)? to \$?15(\.00)?/)
  })

  it('follows the base price and the spread', () => {
    const { container } = show(<SpotRangePreview />, 'spot20')
    expect(container.textContent).toMatch(/Spot price ranges from \$?10(\.00)? to \$?30(\.00)?/)
  })
})

describe('WeekdayPreview', () => {
  it('lists Mon to Sun in order', () => {
    const { container } = show(<WeekdayPreview />)
    const text = container.textContent ?? ''
    const positions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => text.indexOf(d))
    for (const p of positions) expect(p).toBeGreaterThanOrEqual(0)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('changes when the peak window moves', () => {
    const a = show(<WeekdayPreview />)
    const before = a.container.innerHTML
    a.unmount()
    const b = show(<WeekdayPreview />, 'peakMonWed')
    expect(b.container.innerHTML).not.toBe(before)
  })
})

describe('DemandCapacityPreview (acceptance 11)', () => {
  it('shows market demand 100 on a peak day and expected capacity 88 for the defaults (lambda 25, 4 seats, 22 each)', () => {
    const { container } = show(<DemandCapacityPreview />)
    openTables()
    expect(near(container, 100, 0.01)).toBe(true)
    expect(near(container, 88, 0.01)).toBe(true)
    expect(near(container, 25, 0.01)).toBe(true)
  })

  it('changing lambda changes the demand values', () => {
    const a = show(<DemandCapacityPreview />)
    openTables()
    const before = a.container.textContent ?? ''
    const had200 = near(a.container, 200, 0.01)
    expect(near(a.container, 100, 0.01)).toBe(true)
    a.unmount()
    const b = show(<DemandCapacityPreview />, 'lambda50')
    openTables()
    const after = b.container.textContent ?? ''
    expect(after).not.toBe(before)
    expect(near(b.container, 200, 0.01)).toBe(true)
    expect(had200).toBe(false)
  })

  it('capacity is capacity_mean_per_player x max_players', () => {
    const { container } = show(<DemandCapacityPreview />, 'seats6')
    openTables()
    expect(near(container, 132, 0.01)).toBe(true)
  })
})

describe('DemandSplitPreview', () => {
  function splitTable(): { headers: string[]; rows: string[][] } {
    const table = screen.getByRole('table')
    return {
      headers: within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent?.trim() ?? ''),
      rows: within(table)
        .getAllByRole('row')
        .filter((r) => within(r).queryAllByRole('columnheader').length === 0)
        .map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent?.trim() ?? '')),
    }
  }

  it('has the columns Reputation, Share and Expected units', () => {
    show(<DemandSplitPreview />)
    expect(splitTable().headers).toEqual(['Reputation', 'Share', 'Expected units'])
  })

  it('shows the worked values for lambda 25: 0.3 -> 26%, 19; 0.5 -> 32%, 24; 0.8 -> 42%, 31', () => {
    show(<DemandSplitPreview />)
    expect(splitTable().rows).toEqual([
      ['0.3', '26%', '19'],
      ['0.5', '32%', '24'],
      ['0.8', '42%', '31'],
    ])
  })

  it('uses the market of the 3 sample pulquerias, not max_players', () => {
    show(<DemandSplitPreview />, 'seats12')
    expect(splitTable().rows.map((r) => r[2])).toEqual(['19', '24', '31'])
  })

  it('units follow lambda: lambda 50 gives 39, 48, 63', () => {
    show(<DemandSplitPreview />, 'lambda50')
    expect(splitTable().rows).toEqual([
      ['0.3', '26%', '39'],
      ['0.5', '32%', '48'],
      ['0.8', '42%', '63'],
    ])
  })
})

describe('chart titles (plan 25 §3.4a)', () => {
  it('WeekdayPreview is titled Weekday multiplier', () => {
    show(<WeekdayPreview />)
    expect(screen.getByText('Weekday multiplier')).toBeInTheDocument()
  })

  it('DemandCapacityPreview is titled Expected market demand and capacity', () => {
    show(<DemandCapacityPreview />)
    expect(screen.getAllByText('Expected market demand and capacity').length).toBeGreaterThan(0)
  })
})

describe("the server's answer (spec §13.4, §13.10)", () => {
  it.each([
    ['WeekdayPreview', () => <WeekdayPreview />],
    ['DemandCapacityPreview', () => <DemandCapacityPreview />],
    ['DemandSplitPreview', () => <DemandSplitPreview />],
    ['SpotRangePreview', () => <SpotRangePreview />],
    ['SpoilRiskPreview', () => <SpoilRiskPreview />],
  ])('%s reads the loading line while the figures are on their way, and the fix line for a refused draft', (_n, node) => {
    const loading = show(node(), 'hidden', { preview: null, latest: null, pending: true })
    expect(loading.container).toHaveTextContent('Working out the figures…')
    expect(loading.container.textContent).not.toMatch(/\d%|\$/)
    loading.unmount()
    const refused = show(node(), 'hidden', { preview: null, latest: null, pending: false })
    expect(refused.container).toHaveTextContent('Fix the settings marked in red to see the figures.')
  })
})
