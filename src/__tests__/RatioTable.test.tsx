/**
 * Section 29 - block 4, the Ratios table (spec 13.8 block 4, 8.6 null rules; design.md 8.8).
 * Rendered through ResultsSummary (RatioTable's props are not part of the Public surface).
 * Acceptance criteria 3, 9, 12, 13; failure modes 2, 9, 11.
 */
import { createElement, type ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
    })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: 'authenticated',
    user: null,
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ResultsSummary from '../components/results/ResultsSummary'
import type { ResultsView } from '../components/results/resultsView'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { NAMES, RANK_ORDER, makeView, withoutPeer } from './fixtures/results'

const COLUMNS = [
  'Pulquería',
  'Fill rate',
  'Waste rate',
  'Avg reputation',
  'Market share',
  'Futures share',
  'Futures vs spot',
  'Insurance net',
  'Peer net',
]

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})

function renderTable(view: ResultsView = makeView()) {
  render(
    <MemoryRouter>
      <ResultsSummary view={view} viewer={{ isHost: false, myAlias: null }} showActions={false} hostSecret={null} />
    </MemoryRouter>,
  )
  return screen.getByRole('table', { name: 'Ratios' })
}

const headerNames = (table: HTMLElement) => within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim() ?? '')

/** The cells of the row that names this pulquería, keyed by column header. */
function rowOf(table: HTMLElement, alias: string): Record<string, HTMLElement> {
  const names = headerNames(table)
  const row = within(table)
    .getAllByRole('row')
    .find((r) => (r.textContent ?? '').includes(NAMES[alias]))
  if (!row) throw new Error(`no row for ${alias}`)
  const cells = Array.from(row.querySelectorAll<HTMLElement>('th, td'))
  return Object.fromEntries(names.map((n, i) => [n, cells[i]]))
}

describe('layout (criterion 12)', () => {
  it('is a table captioned Ratios with the nine columns, in order', () => {
    expect(headerNames(renderTable())).toEqual(COLUMNS)
  })

  it('has one row per pulquería, by rank', () => {
    const table = renderTable()
    const body = within(table).getAllByRole('row').slice(1)
    expect(body).toHaveLength(3)
    RANK_ORDER.forEach((alias, i) => expect(body[i].textContent).toContain(NAMES[alias]))
  })
})

describe('server figures are shown as sent', () => {
  it('shows a ratio as a percentage and money as dollars', () => {
    const p1 = rowOf(renderTable(), 'P1')
    expect(p1['Fill rate'].textContent).toContain('90')
    expect(p1['Waste rate'].textContent).toContain('12')
    expect(p1['Market share'].textContent).toContain('31')
    expect(p1['Futures share'].textContent).toContain('25')
    expect(p1['Futures vs spot'].textContent).toContain('18.50')
    expect(p1['Insurance net'].textContent).toContain('30.00')
    expect(p1['Peer net'].textContent).toContain('170.00')
  })

  it('failure mode 9: peer net is the sent peer_net, not revenue_peer - cost_peer', () => {
    const view = makeView()
    const p2 = view.players.find((p) => p.alias === 'P2')!
    expect((p2.revenue_peer ?? 0) - (p2.cost_peer ?? 0)).toBe(25)
    const row = rowOf(renderTable(view), 'P2')
    expect(row['Peer net'].textContent).toContain('$12.34')
    expect(row['Peer net'].textContent).not.toContain('25.00')
  })

  it('shows a peer net of zero for a pulquería that did not trade (the field is present)', () => {
    expect(rowOf(renderTable(), 'P3')['Peer net'].textContent).toContain('$0.00')
  })
})

describe('null ratios (criterion 9, failure mode 2)', () => {
  it('renders — for each null ratio, although units_sold is positive', () => {
    const view = makeView()
    expect(view.players.find((p) => p.alias === 'P3')!.units_sold).toBe(300)
    const row = rowOf(renderTable(view), 'P3')
    expect(row['Fill rate'].textContent?.trim()).toBe('—')
    expect(row['Waste rate'].textContent?.trim()).toBe('—')
    expect(row['Futures share'].textContent?.trim()).toBe('—')
  })

  it('never renders 0, 0%, NaN or Infinity for a null ratio', () => {
    const row = rowOf(renderTable(), 'P3')
    for (const col of ['Fill rate', 'Waste rate', 'Futures share']) {
      expect(row[col].textContent).not.toMatch(/NaN|Infinity|0%|^\s*0\s*$/)
    }
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('a real ratio is not turned into —', () => {
    const row = rowOf(renderTable(), 'P2')
    for (const col of ['Fill rate', 'Waste rate', 'Futures share']) expect(row[col].textContent?.trim()).not.toBe('—')
  })

  it.each([
    ['Fill rate', 'No demand was owed.'],
    ['Waste rate', 'Nothing was sold or spoiled.'],
    ['Futures share', 'Nothing was shipped.'],
  ])('%s: — carries the tooltip "%s"', (column, tip) => {
    const row = rowOf(renderTable(), 'P3')
    const dash = within(row[column]).getByText('—')
    act(() => {
      fireEvent.focus(dash)
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent(tip)
  })

  it('shows the tooltip of the column being asked about, not another one', () => {
    const row = rowOf(renderTable(), 'P3')
    act(() => {
      fireEvent.focus(within(row['Waste rate']).getByText('—'))
    })
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('No demand was owed.')
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Nothing was shipped.')
  })
})

describe('a stored payload without peer fields (criterion 13, failure mode 11)', () => {
  it('has no Peer net column and no NaN anywhere', () => {
    const table = renderTable(makeView(withoutPeer))
    expect(headerNames(table)).toEqual(COLUMNS.filter((c) => c !== 'Peer net'))
    expect(screen.queryByText('Peer net')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('still shows the other eight columns with their figures', () => {
    const row = rowOf(renderTable(makeView(withoutPeer)), 'P1')
    expect(row['Fill rate'].textContent).toContain('90')
    expect(row['Insurance net'].textContent).toContain('30.00')
  })
})
