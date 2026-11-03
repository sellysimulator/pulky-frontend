import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { ComponentProps } from 'react'
import { ConfigPreviewContext, type ConfigPreviewState } from '../components/config/configPreview'
import { DOCS } from '../components/config/docs/entries'
import HelpDialog from '../components/config/docs/HelpDialog'
import { Note, P, Formula, Table } from '../components/config/docs/primitives'
import { PLAYER_CONFIG_KEYS, SECRET_CONFIG_KEYS } from '../types/game'
import type { ConfigDefaultsResponse } from '../types/game'
import { CONFIG_PREVIEWS, previewState } from './fixtures/serverConfig'

// jsdom has no canvas: the chart wrapper is replaced by a plain canvas. The table fallback is real.
vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
  Line: () => <canvas data-testid="chart-canvas" />,
}))

const defaults = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8'),
) as ConfigDefaultsResponse


const TOPICS = ['topic.allocation', 'topic.what_players_see']

/** key -> [label, effect]: spec 24 section 3.2, verbatim. */
const COPY: Record<string, [string, string]> = {
  max_players: ['Seats', 'More seats make the market bigger: demand scales with the pulquerías seated.'],
  duration_days: ['Days', 'Longer games cover more weekly cycles and give futures time to pay off.'],
  starting_cash: [
    'Starting cash',
    'Less cash forces smaller orders and makes futures, which are paid up front, harder to afford.',
  ],
  'demand.per_player_peak': [
    'Demand per player on a peak day (λ)',
    "Raises or lowers every day's demand in proportion; the weekday shape stays the same.",
  ],
  'demand.weekday_peak.from': [
    'Peak starts',
    'Moves the start of the busy days; demand steps down equally on each side of the window.',
  ],
  'demand.weekday_peak.to': [
    'Peak ends',
    'Moves the end of the busy days; a full-week window removes the weekday effect.',
  ],
  'demand.retail_price': [
    'Retail price',
    'A higher price widens the margin on every unit and makes backlog and spoilage costlier by comparison.',
  ],
  'demand.backlog_penalty': [
    'Backlog penalty',
    'A higher penalty punishes running out of stock every day the customer waits.',
  ],
  'reputation.starting': [
    'Starting reputation',
    "Sets everyone's opening share of demand; equal for all pulquerías.",
  ],
  'reputation.smoothing': ['Smoothing (ρ)', 'A higher value makes reputation react faster to a good or bad day.'],
  'reputation.waste_weight': [
    'Waste weight (w)',
    "The share of the day's score that spoiled pulque decides; the rest is decided by serving what is owed. Above 0.5, spoilage hurts reputation more than backlog; below 0.5, backlog hurts it more.",
  ],
  'supplier.base_price': [
    'Base price',
    'The futures price and the middle of the spot range; it sets the cost of every unit.',
  ],
  'supplier.spot_spread': [
    'Spot spread',
    'A wider spread makes spot prices swing more, which makes locking a price with futures more valuable.',
  ],
  'supplier.capacity_mean_per_player': [
    'Capacity per player (mean)',
    'Less capacity makes short days common, and futures holders are served first on them.',
  ],
  'supplier.capacity_sd_per_player': [
    'Capacity per player (sd)',
    'A larger spread makes some days far shorter than others.',
  ],
  'supplier.disruption_probability': [
    'Disruption chance per day',
    "Raises the chance that a day's capacity is cut.",
  ],
  'supplier.disruption_factor': [
    'Capacity on a disrupted day',
    'The share of capacity left on a disrupted day; lower values hurt more.',
  ],
  'supplier.lead_time_days': [
    'Lead time (days)',
    'At 0 an order arrives the day it is placed and spot orders never close. Longer lead times force players to order further ahead of demand, and close spot orders for the last days of the game.',
  ],
  'supplier.initial_pipeline_qty': [
    'Initial pipeline (units per slot)',
    'Free units already on their way at the start, so the first days are not empty. No effect with a lead time of 0.',
  ],
  'supplier.quality_min': [
    'Lowest initial quality',
    'A lower minimum lets some deliveries arrive closer to spoiling, so even a fresh lot can lose units on its first night.',
  ],
  'supplier.quality_max': [
    'Highest initial quality',
    'The quality of the best deliveries, and of the initial stock and pipeline; at 100% a lot is safe through its fresh period.',
  ],
  'futures.horizon_days': [
    'Futures horizon (days)',
    'How far ahead futures deliver; futures are served before spot on a short day.',
  ],
  'stock.fresh_days': [
    'Fresh days',
    'Nights a lot keeps its initial quality before its spoil risk starts to climb.',
  ],
  'stock.max_days': [
    'Max days',
    'The night a 100% lot is certain to be gone; after the fresh period its quality falls by an equal step each night.',
  ],
  'stock.holding_cost': [
    'Holding cost',
    'Charges every unit left in the cellar at night, so overstock costs money even before it spoils.',
  ],
  'stock.initial_stock': ['Initial stock', 'Free units in the cellar on day 1.'],
  'stock.salvage_value': [
    'Salvage price',
    'What a spoiled or leftover unit returns; 0 means it returns nothing.',
  ],
  'stock.conservation_extra_fresh_days': [
    'Conservation: extra fresh days',
    'How many more nights a conserved lot keeps its initial quality.',
  ],
  'stock.conservation_cost_per_unit': [
    'Conservation cost per unit',
    'The price of keeping a lot fresh longer, charged on the whole lot.',
  ],
  'peer_market.enabled': [
    'Peer market',
    'When on, a pulquería the supplier leaves short can buy the missing units from rivals within its price, quality and cash, and any pulquería can offer spare stock at its own price.',
  ],
  'transport.unit_cost': ['Transport cost per unit', 'Charged on every unit shipped, lost units included.'],
  'transport.shared': [
    'Shared transport',
    "When on, a refrigeration failure's loss is split across everyone who shipped that day.",
  ],
  'transport.failure_probability': [
    'Refrigeration failure chance per day',
    "Raises the chance that a day's shipments lose units.",
  ],
  'transport.loss_fraction': [
    'Share of a shipment lost in a failure',
    'How much of a shipment a failure destroys.',
  ],
  'insurance.tiers.cip.enabled': ['Paid-price insurance: offered', 'Refunds lost units at what the player paid.'],
  'insurance.tiers.cip.fee': ['Paid-price insurance: fee per unit', 'Refunds lost units at what the player paid.'],
  'insurance.tiers.dap.enabled': [
    'Market-price insurance: offered',
    'Refunds lost units at the spot price on the arrival day.',
  ],
  'insurance.tiers.dap.fee': [
    'Market-price insurance: fee per unit',
    'Refunds lost units at the spot price on the arrival day.',
  ],
  'insurance.tiers.ddp.enabled': ['Retail-price insurance: offered', 'Refunds lost units at the retail price.'],
  'insurance.tiers.ddp.fee': ['Retail-price insurance: fee per unit', 'Refunds lost units at the retail price.'],
  'insurance.target_margin': [
    'Target margin',
    'The margin **Set fees from margin** adds over the break-even fee.',
  ],
  'insurance.reference_shipment': [
    'Reference shipment (units)',
    'The typical shipment the calculator uses; small shipments can lose 0 units to rounding.',
  ],
  'topic.allocation': [
    'Allocation',
    'When supply is short, spot capacity goes to the largest order first, unless every pulquería votes to cooperate.',
  ],
  'topic.what_players_see': [
    'What players see',
    'Players see five settings: the retail price, the transport cost per unit, the conservation cost and its extra nights, and whether the peer market is on. They learn the rest by playing, from the brief, their cellar and their ledger, and never see the seed or the risk odds.',
  ],
}

/** The effect sentence as it is read on screen (the doc marks the button name in bold). */
function readable(effect: string): string {
  return effect.replaceAll('**', '')
}

const expectedKeys = [...Object.keys(defaults.fields).filter((k) => k !== 'random_seed'), ...TOPICS]

/**
 * Renders a help dialog with the server's answer for a named config (`config_preview.json`): `typed` is the
 * defaults with the risk odds typed in, so every live example has its numbers.
 */
function renderDialog(key: string, variant = 'typed', state: ConfigPreviewState = previewState(variant)): HTMLElement {
  render(
    <ConfigPreviewContext.Provider value={state}>
      <HelpDialog entryKey={key} config={CONFIG_PREVIEWS[variant].config} open onClose={() => {}} />
    </ConfigPreviewContext.Provider>,
  )
  return screen.getByRole('dialog')
}

/** Opens every "Show table" toggle so the plotted numbers are in the DOM. */
function showTables(): void {
  for (const b of screen.queryAllByRole('button', { name: /show table/i })) fireEvent.click(b)
}

/** The text of an element with a space between text nodes, so neighbouring cells do not run together. */
function spaced(el: Element): string {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '')
  return parts.join(' ')
}

function textOf(key: string, variant = 'typed'): string {
  const dialog = renderDialog(key, variant)
  showTables()
  return spaced(dialog)
}

function rowTexts(dialog: HTMLElement): string[] {
  return within(dialog)
    .queryAllByRole('row')
    .map((r) => spaced(r))
}

/** True when some row, or some column, of some table holds these numbers in order. */
function hasLine(dialog: HTMLElement, numbers: number[]): boolean {
  const nums = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number)
  const contains = (line: number[]): boolean => {
    let at = 0
    for (const n of line) if (n === numbers[at]) at += 1
    return at === numbers.length
  }
  return within(dialog)
    .queryAllByRole('table')
    .some((table) => {
      const grid = Array.from(table.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('th,td')).map((c) => nums(c.textContent ?? '')),
      )
      const rows = grid.map((r) => r.flat())
      const width = Math.max(0, ...grid.map((r) => r.length))
      const columns = Array.from({ length: width }, (_, i) => grid.flatMap((r) => r[i] ?? []))
      return [...rows, ...columns].some(contains)
    })
}

afterEach(() => cleanup())

describe('DOCS coverage (AC 1, failure mode 6)', () => {
  it('has the fixture with every leaf', () => {
    expect(Object.keys(defaults.fields)).toContain('insurance.tiers.ddp.fee')
    expect(Object.keys(defaults.fields)).toContain('supplier.quality_min')
    expect(Object.keys(defaults.fields)).toContain('peer_market.enabled')
  })

  it('has an entry for every config leaf except random_seed, and both topics', () => {
    const missing = expectedKeys.filter((k) => !(k in DOCS))
    expect(missing, `DOCS is missing: ${missing.join(', ')}`).toEqual([])
    expect(DOCS['topic.allocation']).toBeDefined()
    expect(DOCS['topic.what_players_see']).toBeDefined()
  })

  it('has no entry for random_seed or for a key that is not a leaf', () => {
    expect('random_seed' in DOCS).toBe(false)
    const stray = Object.keys(DOCS).filter((k) => !expectedKeys.includes(k))
    expect(stray, `DOCS has stray keys: ${stray.join(', ')}`).toEqual([])
  })

  it('every entry has the HelpEntry shape and the spec label', () => {
    for (const key of expectedKeys) {
      const entry = DOCS[key]
      expect(entry, key).toBeDefined()
      expect(entry.label, key).toBe(COPY[key][0])
      expect(typeof entry.formula, key).toBe('function')
      expect(typeof entry.example, key).toBe('function')
      const { config, preview } = CONFIG_PREVIEWS.typed
      expect(entry.formula(config, preview), key).toBeTruthy()
      expect(entry.example(config, previewState('typed')), key).toBeTruthy()
    }
  })
})

describe('every entry renders in the dialog (AC 2)', () => {
  it.each(expectedKeys)('%s: label, the three sub-headings in order, the effect verbatim', (key) => {
    const [label, effect] = COPY[key]
    const dialog = renderDialog(key)
    const names = within(dialog)
      .getAllByRole('heading')
      .map((h) => h.textContent?.trim() ?? '')
    expect(names[0]).toBe(label)
    const at = ['Formula', 'How it changes the game', 'Example'].map((n) => names.indexOf(n))
    expect(at.every((i) => i > 0), `sub-headings in ${JSON.stringify(names)}`).toBe(true)
    expect(at[0]).toBeLessThan(at[1])
    expect(at[1]).toBeLessThan(at[2])
    expect(dialog).toHaveTextContent(readable(effect))
  })

  it('shows nothing for an unknown key, without logging', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <HelpDialog entryKey="not.a.key" config={CONFIG_PREVIEWS.typed.config} open onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('is not visible while closed', () => {
    render(<HelpDialog entryKey="max_players" config={CONFIG_PREVIEWS.typed.config} open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape asks to close', () => {
    const onClose = vi.fn()
    render(<HelpDialog entryKey="max_players" config={CONFIG_PREVIEWS.typed.config} open onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("examples show the server's figures for the config (AC 3, failure mode 7)", () => {
  function thursdayRow(): string {
    const dialog = screen.getByRole('dialog')
    showTables()
    const row = rowTexts(dialog).find((t) => /Thu/.test(t))
    expect(row, 'a Thursday row in the market demand table').toBeDefined()
    return row as string
  }

  it('lambda 25 -> 30 moves Thursday market demand for 4 seats from 100 to 120', () => {
    renderDialog('demand.per_player_peak')
    const before = thursdayRow()
    expect(before).toMatch(/\b100\b/)
    expect(before).not.toMatch(/\b120\b/)
    cleanup()
    renderDialog('demand.per_player_peak', 'lambda30')
    const after = thursdayRow()
    expect(after).toMatch(/\b120\b/)
    expect(after).not.toMatch(/\b100\b/)
  })

  it('quality_min 80 -> 60 moves the lowest lot first-night risk from 53% to 73%', () => {
    const at80 = textOf('supplier.quality_min')
    expect(at80).toMatch(/\b53%/)
    expect(at80).not.toMatch(/\b73%/)
    cleanup()
    expect(textOf('supplier.quality_min', 'qmin60')).toMatch(/\b73%/)
  })

  it('the quality_max entry shows the same table, so it follows quality_min too', () => {
    const base = textOf('supplier.quality_max')
    cleanup()
    expect(textOf('supplier.quality_max', 'qmin60')).toMatch(/\b73%/)
    expect(base).not.toMatch(/\b73%/)
  })

  it('duration_days: weeks covered and the weekday of the last day (day 1 is a Monday)', () => {
    expect(textOf('duration_days')).toMatch(/Sun/)
    cleanup()
    const t10 = textOf('duration_days', 'days10')
    expect(t10).toMatch(/Wed/)
    expect(t10).not.toMatch(/Sunday/)
  })

  it('max_players: market demand on a peak day for 2, 4 and max_players seats', () => {
    const t = textOf('max_players', 'seats8')
    expect(t).toMatch(/\b50\b/)
    expect(t).toMatch(/\b100\b/)
    expect(t).toMatch(/\b200\b/)
  })

  it.each([
    ['stock.holding_cost', 'holding05', '$10.00', '$25.00'],
    ['transport.unit_cost', 'transport15', '$40.00', '$60.00'],
    ['stock.conservation_cost_per_unit', 'conserve2', '$30.00', '$60.00'],
  ])('%s: the sample cost follows the setting', (key, variant, before, after) => {
    expect(textOf(key)).toContain(before)
    cleanup()
    expect(textOf(key, variant)).toContain(after)
  })

  it('salvage_value: 10 spoiled units', () => {
    expect(textOf('stock.salvage_value')).toContain('$20.00')
    cleanup()
    expect(textOf('stock.salvage_value', 'salvage0')).not.toContain('$20.00')
  })

  it('backlog_penalty: one unit waiting 1, 3 and 7 days', () => {
    const t = textOf('demand.backlog_penalty')
    expect(t).toContain('$1.50')
    expect(t).toContain('$4.50')
    expect(t).toContain('$10.50')
  })

  it('base_price and spot_spread: the spot range', () => {
    const t = textOf('supplier.base_price')
    expect(t).toContain('$9.00')
    expect(t).toContain('$15.00')
    cleanup()
    const t2 = textOf('supplier.spot_spread', 'spot20')
    expect(t2).toContain('$10.00')
    expect(t2).toContain('$30.00')
  })

  it('reputation.starting: day-1 shares with 4 equal pulquerías', () => {
    expect(textOf('reputation.starting')).toMatch(/\b25%/)
  })

  it('failure chance and expected failures over the game', () => {
    const t = textOf('transport.failure_probability')
    expect(t).toMatch(/88(\.\d)?%/)
    expect(t).toMatch(/\b2\.0\b/)
    cleanup()
    expect(textOf('transport.failure_probability', 'failure0')).not.toMatch(/88(\.\d)?%/)
  })

  it('disruption chance over the game', () => {
    expect(textOf('supplier.disruption_probability')).toMatch(/51(\.\d)?%/)
  })

  it('lead time: the arrival weekday of a Monday order', () => {
    // the default lead time is 0: the same day, and spot never closes
    const sameDay = textOf('supplier.lead_time_days')
    expect(sameDay).toMatch(/arrives the same day/)
    expect(sameDay).toMatch(/spot orders stay open to the last day/)
    cleanup()
    expect(textOf('supplier.lead_time_days', 'lead1')).toMatch(/Tue/)
    cleanup()
    expect(textOf('supplier.lead_time_days', 'lead3')).toMatch(/Thu/)
  })

  it('insurance rows: break-even fee per tier, solo and shared', () => {
    expect(textOf('insurance.tiers.cip.fee')).toContain('$0.50')
    cleanup()
    expect(textOf('insurance.tiers.ddp.fee')).toContain('$1.26')
    cleanup()
    expect(textOf('insurance.tiers.ddp.enabled', 'shared')).toContain('$0.21')
  })

  it('target_margin: fees from margin for the three tiers', () => {
    const t = textOf('insurance.target_margin')
    expect(t).toContain('$0.55')
    expect(t).toContain('$1.39')
    cleanup()
    const t2 = textOf('insurance.target_margin', 'margin05')
    expect(t2).toContain('$0.76')
    expect(t2).toContain('$1.89')
  })

  it('quality guide for the peer market follows stock.fresh_days / max_days', () => {
    const base = textOf('peer_market.enabled')
    expect(base).toContain('90%: 10% risk tonight · half spoiled by day 3 · lasts at most 4 days (through day 4)')
    expect(base).toContain('50%: 50% risk tonight · half spoiled tonight · lasts at most 3 days (through day 3)')
    cleanup()
    const longer = textOf('peer_market.enabled', 'maxdays6')
    expect(longer).toContain('lasts at most 6 days (through day 6)')
    expect(longer).not.toContain('90%: 10% risk tonight · half spoiled by day 3 · lasts at most 4 days')
  })

  it("the weekday formula names the server's reach", () => {
    expect(textOf('demand.weekday_peak.from')).toContain(`= ${CONFIG_PREVIEWS.typed.preview.weekdays.reach}`)
  })
})

describe('while the server works (spec §13.10)', () => {
  it('an example reads the loading line until the figures arrive, and computes none meanwhile', () => {
    const dialog = renderDialog('stock.holding_cost', 'typed', { preview: null, latest: null, pending: true })
    expect(dialog).toHaveTextContent('Working out the figures…')
    expect(dialog).not.toHaveTextContent('$10.00')
  })

  it('a draft the server refuses reads the fix-the-settings line', () => {
    const dialog = renderDialog('stock.holding_cost', 'typed', { preview: null, latest: null, pending: false })
    expect(dialog).toHaveTextContent('Fix the settings marked in red to see the figures.')
  })

  it('an example with no figures still shows its label, formula and effect', () => {
    const dialog = renderDialog('stock.holding_cost', 'typed', { preview: null, latest: null, pending: true })
    expect(dialog).toHaveTextContent('Holding cost')
    expect(dialog).toHaveTextContent(readable(COPY['stock.holding_cost'][1]))
  })
})

describe('worked-example entries', () => {
  it('peer market: the spec 5.7 trades as a table', () => {
    const dialog = renderDialog('peer_market.enabled')
    showTables()
    const rows = rowTexts(dialog)
    const has = (...parts: string[]): boolean => rows.some((r) => parts.every((p) => r.includes(p)))
    expect(has('P1', 'P3', '10', '$15.00')).toBe(true)
    expect(has('P1', 'P4', '6', '$13.00')).toBe(true)
    expect(has('P2', 'P4', '2', '$13.00')).toBe(true)
  })

  it('allocation: spec 5.4 example, both modes', () => {
    const dialog = renderDialog('topic.allocation')
    expect(hasLine(dialog, [60, 40, 0]), 'largest-first: 60 / 40 / 0').toBe(true)
    expect(hasLine(dialog, [43, 36, 21]), 'cooperative: 43 / 36 / 21').toBe(true)
    expect(hasLine(dialog, [60, 50, 30]), 'requests: 60 / 50 / 30').toBe(true)
  })

  it('shared transport: the spec 6.2 table, solo vs shared', () => {
    const dialog = renderDialog('transport.shared')
    expect(hasLine(dialog, [18, 9, 3]), 'not shared: 18 / 9 / 3').toBe(true)
    expect(hasLine(dialog, [6, 3, 1]), 'shared: 6 / 3 / 1').toBe(true)
  })

  it('what players see: the shown keys and the secret keys as two lists', () => {
    const dialog = renderDialog('topic.what_players_see')
    const items = within(dialog).getAllByRole('listitem')
    const listOf = (path: string): Element | null => {
      const item = items.find((i) => i.textContent?.includes(path))
      return item?.closest('ul,ol') ?? null
    }
    const shownLists = new Set(PLAYER_CONFIG_KEYS.map((k) => listOf(k)))
    const secretLists = new Set(SECRET_CONFIG_KEYS.map((k) => listOf(k)))
    expect(shownLists.has(null), 'every shown key is listed').toBe(false)
    expect(secretLists.has(null), 'every secret key is listed').toBe(false)
    expect(shownLists.size).toBe(1)
    expect(secretLists.size).toBe(1)
    expect([...shownLists][0]).not.toBe([...secretLists][0])
  })
})

describe('charts have a table fallback', () => {
  it('a chart entry offers Show table and the table holds the plotted numbers', () => {
    renderDialog('demand.per_player_peak')
    const toggle = screen.getByRole('button', { name: /show table/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /show chart/i })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getAllByRole('row').length).toBeGreaterThanOrEqual(8)
  })

  it('the weekday multiplier entries show Mon..Sun', () => {
    for (const key of ['demand.weekday_peak.from', 'demand.weekday_peak.to']) {
      const t = textOf(key)
      for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) expect(t, key).toContain(d)
      cleanup()
    }
  })
})

describe('primitives (spec 13.10)', () => {
  it('render their content', () => {
    const props: ComponentProps<typeof Table> = { head: ['Night', 'Risk'], rows: [['1', '20%']] }
    const children: ReactNode = (
      <>
        <P>A paragraph</P>
        <Formula>risk = 1 - q0</Formula>
        <Note>An aside</Note>
        <Table {...props} />
      </>
    )
    render(<>{children}</>)
    expect(screen.getByText('A paragraph')).toBeInTheDocument()
    expect(screen.getByText('risk = 1 - q0')).toBeInTheDocument()
    expect(screen.getByText('An aside')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Night' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '20%' })).toBeInTheDocument()
  })
})

describe('hidden defaults (spec §9.3, §13.10)', () => {
  const HIDDEN = 'Hidden until the game ends. Type a value to see this example.'

  it.each([
    'supplier.capacity_sd_per_player',
    'supplier.disruption_probability',
    'transport.failure_probability',
    'transport.loss_fraction',
    'transport.shared',
    'insurance.tiers.cip.fee',
    'insurance.target_margin',
    'insurance.reference_shipment',
  ])('%s: with the risks at their hidden defaults, the example says so and shows no figure that needs them', (key) => {
    // the server sends null for every figure that needs a blank risk
    const text = textOf(key, 'hidden')
    expect(text).toContain(HIDDEN)
    expect(text).not.toMatch(/NaN|Infinity/)
  })

  it('the lead time example names the closing spot window with a lead time of 2', () => {
    expect(textOf('supplier.lead_time_days', 'lead2')).toMatch(/Spot orders close after day 12/)
  })
})
