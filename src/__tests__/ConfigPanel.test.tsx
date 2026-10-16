/**
 * Section 25 — ConfigPanel and ShownToPlayersBadge (plan 25 §3.1–§3.4).
 * Acceptance 1–7, 9–12; failure modes 3, 4, 5, 7, 8, 10 (and 1, 2, 6 reach the panel through the calculator).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))
vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
  Line: () => <canvas data-testid="chart-canvas" />,
}))
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(),
}))
vi.mock('../api/rooms', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/rooms')>()),
  getRoomConfig: vi.fn(),
}))

import { getConfigDefaults, validateConfig } from '../api/config'
import { errorMessage } from '../api/http'
import { getRoomConfig } from '../api/rooms'
import { socket } from '../api/socket'
import ConfigPanel from '../components/config/ConfigPanel'
import ShownToPlayersBadge from '../components/config/ShownToPlayersBadge'
import { DOCS } from '../components/config/docs/entries'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { ConfigDefaultsResponse, GameConfig, ServerError } from '../types/game'

const defaults = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8'),
) as ConfigDefaultsResponse

const ROOM = 'K7M2QX'
const SECRET = 's3cret'
const SECTIONS = [
  'Game',
  'Demand',
  'Reputation',
  'Supplier & futures',
  'Stock',
  'Peer market',
  'Transport & insurance',
] as const
type Section = (typeof SECTIONS)[number]

const SHOWN_KEYS = [
  'demand.retail_price',
  'stock.conservation_extra_fresh_days',
  'stock.conservation_cost_per_unit',
  'peer_market.enabled',
  'transport.unit_cost',
]

function sectionOfKey(key: string): Section | null {
  if (key === 'random_seed') return null
  if (['max_players', 'duration_days', 'starting_cash'].includes(key)) return 'Game'
  const head = key.split('.')[0]
  switch (head) {
    case 'demand':
      return 'Demand'
    case 'reputation':
      return 'Reputation'
    case 'supplier':
    case 'futures':
      return 'Supplier & futures'
    case 'stock':
      return 'Stock'
    case 'peer_market':
      return 'Peer market'
    default:
      return 'Transport & insurance'
  }
}

const KEYS = Object.keys(defaults.fields)
const NON_INSURANCE_KEYS = KEYS.filter((k) => k !== 'random_seed' && !k.startsWith('insurance.'))

function cfg(mut: (c: GameConfig) => void = () => {}): GameConfig {
  const c = structuredClone(defaults.config)
  mut(c)
  return c
}

let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  useGameStore.setState({ ...INITIAL_STATE })
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
  vi.mocked(getConfigDefaults).mockResolvedValue(structuredClone(defaults))
  vi.mocked(validateConfig).mockResolvedValue({ ok: true, errors: [], warnings: [] })
  vi.mocked(getRoomConfig).mockResolvedValue(cfg())
})

afterEach(() => {
  emit.mockRestore()
  vi.useRealTimers()
})

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

interface MountOptions {
  config?: GameConfig | null
  hostSecret?: string | null
  locked?: boolean
  fields?: ConfigDefaultsResponse['fields']
}

async function mount(opts: MountOptions = {}) {
  const { config = cfg(), hostSecret = SECRET, locked = false, fields } = opts
  if (fields) {
    vi.mocked(getConfigDefaults).mockResolvedValue({ ...structuredClone(defaults), fields })
  }
  useGameStore.getState().setRoom(ROOM, true)
  if (config) useGameStore.getState().applyConfigUpdated({ seq: 1, config })
  const view = render(<ConfigPanel roomCode={ROOM} hostSecret={hostSecret} locked={locked} />)
  await advance(0)
  return view
}

const isBool = (key: string): boolean => defaults.fields[key]?.type === 'bool'

/** The control of a field: a switch is found by its name, every other control by its label. */
const control = (key: string): HTMLElement =>
  isBool(key) ? screen.getByRole('switch', { name: DOCS[key].label }) : screen.getByLabelText(DOCS[key].label)

const controlIn = (root: HTMLElement, key: string): HTMLElement | null =>
  isBool(key)
    ? within(root).queryByRole('switch', { name: DOCS[key].label })
    : within(root).queryByLabelText(DOCS[key].label)

function edit(key: string, value: string | number): void {
  fireEvent.change(control(key), { target: { value: String(value) } })
}

function configUpdateCalls(): unknown[][] {
  return emit.mock.calls.filter((c: unknown[]) => c[0] === 'config_update')
}

/** The visible title element of a section (not the jump-row button). */
function titleEl(title: string): HTMLElement {
  const el = screen.getAllByText(title, { exact: true }).find((e) => !e.closest('button'))
  if (!el) throw new Error(`no section title ${title}`)
  return el
}

/** Smallest-containing block of a section: climbs from its title until another section's title is inside. */
function sectionOf(title: Section): HTMLElement {
  const others = SECTIONS.filter((s) => s !== title).map(titleEl)
  let el = titleEl(title)
  let parent = el.parentElement
  while (parent && !others.some((o) => parent!.contains(o))) {
    el = parent
    parent = el.parentElement
  }
  return el
}

/** Which field keys carry a badge: the badge belongs to the nearest field label before it. */
function badgedKeys(keys: string[]): string[] {
  const labelEls = keys.map((k) => ({
    k,
    el: isBool(k) ? control(k) : screen.getAllByText(DOCS[k].label, { exact: true })[0],
  }))
  const out: string[] = []
  for (const badge of screen.queryAllByText('Shown to players')) {
    let best: { k: string; el: HTMLElement } | null = null
    for (const l of labelEls) {
      const before = l.el.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING
      if (!before) continue
      if (!best || (best.el.compareDocumentPosition(l.el) & Node.DOCUMENT_POSITION_FOLLOWING)) best = l
    }
    if (best) out.push(best.k)
  }
  return out
}

describe('ShownToPlayersBadge', () => {
  it('renders the text Shown to players', () => {
    render(<ShownToPlayersBadge />)
    expect(screen.getByText('Shown to players')).toBeInTheDocument()
  })
})

describe('loading (plan 25 §3.1)', () => {
  it('shows Loading the settings while the config has not arrived', async () => {
    await mount({ config: null })
    expect(screen.getByText('Loading the settings')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull()
  })

  it('shows the panel once defaults and config are present', async () => {
    await mount()
    expect(screen.queryByText('Loading the settings')).toBeNull()
    expect(control('stock.max_days')).toBeInTheDocument()
  })

  it('fetches the room config 1 s after mount when the store still has none, and stores it', async () => {
    const remote = cfg((c) => (c.duration_days = 30))
    vi.mocked(getRoomConfig).mockResolvedValue(remote)
    await mount({ config: null })
    await advance(900)
    expect(getRoomConfig).not.toHaveBeenCalled()
    await advance(100)
    expect(getRoomConfig).toHaveBeenCalledTimes(1)
    expect(getRoomConfig).toHaveBeenCalledWith(ROOM, SECRET)
    await advance(0)
    expect(useGameStore.getState().config).toEqual(remote)
    expect(screen.queryByText('Loading the settings')).toBeNull()
    expect((control('duration_days') as HTMLInputElement).value).toMatch(/30/)
  })

  it('does not fetch when config_updated arrives within the second', async () => {
    await mount({ config: null })
    await advance(500)
    act(() => useGameStore.getState().applyConfigUpdated({ seq: 1, config: cfg() }))
    await advance(1500)
    expect(getRoomConfig).not.toHaveBeenCalled()
  })

  it('does not fetch without a host secret', async () => {
    await mount({ config: null, hostSecret: null })
    await advance(3000)
    expect(getRoomConfig).not.toHaveBeenCalled()
    expect(screen.getByText('Loading the settings')).toBeInTheDocument()
  })

  it('shows a danger alert with the error message when the defaults request fails', async () => {
    const err = new Error('boom')
    vi.mocked(getConfigDefaults).mockRejectedValue(err)
    await mount()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(errorMessage(err, 'Could not load the settings.'))
  })
})

describe('sections and fields (acceptance 1, failure mode 10)', () => {
  it('renders the seven sections in spec order', async () => {
    await mount()
    const titles = SECTIONS.map(titleEl)
    for (let i = 1; i < titles.length; i++) {
      expect(titles[i - 1].compareDocumentPosition(titles[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('has a jump row of seven ghost buttons with the same titles in the same order', async () => {
    await mount()
    const buttons = SECTIONS.map((s) => screen.getByRole('button', { name: s }))
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i - 1].compareDocumentPosition(buttons[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(buttons[i - 1].parentElement).toBe(buttons[i].parentElement)
    }
    expect(buttons[0].parentElement?.querySelectorAll('button')).toHaveLength(7)
  })

  it('renders a control for every non-seed, non-insurance key, each inside the right section', async () => {
    await mount()
    for (const key of NON_INSURANCE_KEYS) {
      const section = sectionOf(sectionOfKey(key) as Section)
      expect(controlIn(section, key), key).not.toBeNull()
    }
  })

  it('has no control for random_seed', async () => {
    await mount()
    expect(screen.queryByLabelText(/seed/i)).toBeNull()
  })

  it('keeps the spec §9.1 order of the fields inside each section', async () => {
    await mount()
    for (const s of SECTIONS) {
      const keys = NON_INSURANCE_KEYS.filter((k) => sectionOfKey(k) === s)
      const els = keys.map((k) => controlIn(sectionOf(s), k) as HTMLElement)
      for (let i = 1; i < els.length; i++) {
        expect(
          els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
          `${keys[i - 1]} before ${keys[i]}`,
        ).toBeTruthy()
      }
    }
  })

  it('puts the quality range in Supplier & futures, not Stock (failure mode 10)', async () => {
    await mount()
    const supplier = sectionOf('Supplier & futures')
    const stock = sectionOf('Stock')
    for (const k of ['supplier.quality_min', 'supplier.quality_max']) {
      expect(controlIn(supplier, k)).not.toBeNull()
      expect(controlIn(stock, k)).toBeNull()
    }
  })

  it('puts peer_market.enabled alone in Peer market (failure mode 10)', async () => {
    await mount()
    const key = 'peer_market.enabled'
    expect(controlIn(sectionOf('Peer market'), key)).not.toBeNull()
    for (const s of SECTIONS.filter((x) => x !== 'Peer market')) {
      expect(controlIn(sectionOf(s), key)).toBeNull()
    }
    expect(within(sectionOf('Peer market')).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(sectionOf('Peer market')).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('puts the insurance calculator inside Transport & insurance', async () => {
    await mount()
    const section = sectionOf('Transport & insurance')
    expect(within(section).getByLabelText('Reference shipment (units)')).toBeInTheDocument()
    expect(within(section).getByLabelText('Target margin')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Set fees from margin' })).toBeInTheDocument()
    for (const s of SECTIONS.filter((x) => x !== 'Transport & insurance')) {
      expect(within(sectionOf(s)).queryByLabelText('Target margin')).toBeNull()
    }
  })

  it('renders the peak window as native selects with Mon to Sun', async () => {
    await mount()
    for (const k of ['demand.weekday_peak.from', 'demand.weekday_peak.to']) {
      const select = control(k) as HTMLSelectElement
      expect(select.tagName).toBe('SELECT')
      const options = within(select).getAllByRole('option') as HTMLOptionElement[]
      expect(options.map((o) => o.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
      expect(options.map((o) => o.value)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    }
    expect((control('demand.weekday_peak.from') as HTMLSelectElement).value).toBe('thu')
    expect((control('demand.weekday_peak.to') as HTMLSelectElement).value).toBe('sat')
  })

  it('shows the helper line Between {min} and {max} for bounded numeric fields', async () => {
    await mount()
    expect(screen.getAllByText(/^Between .+ and .+$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Between 2 and 12').length).toBeGreaterThanOrEqual(1) // max_players
  })

  it('shows the quality range as whole percents with a % suffix', async () => {
    await mount()
    const section = sectionOf('Supplier & futures')
    expect((control('supplier.quality_min') as HTMLInputElement).value).toBe('80')
    expect(within(section).getAllByText('%').length).toBeGreaterThanOrEqual(2)
  })

  it('gives every knob an info button', async () => {
    await mount()
    for (const key of NON_INSURANCE_KEYS) {
      expect(screen.getAllByRole('button', { name: /^About / }).length).toBeGreaterThan(0)
      expect(DOCS[key]).toBeDefined()
    }
    expect(screen.getAllByRole('button', { name: /^About / }).length).toBeGreaterThanOrEqual(NON_INSURANCE_KEYS.length)
  })
})

describe('Shown to players badges (acceptance 2, failure mode 3)', () => {
  it('appear on exactly the five spec §9.3 shown keys with the real fixture', async () => {
    await mount()
    expect(screen.getAllByText('Shown to players')).toHaveLength(5)
    expect(badgedKeys(NON_INSURANCE_KEYS).sort()).toEqual([...SHOWN_KEYS].sort())
  })

  it('are read from the metadata: marking another key shown moves the badge', async () => {
    const fields = structuredClone(defaults.fields)
    fields['demand.retail_price'].players = 'not_shown'
    fields['stock.holding_cost'].players = 'shown'
    await mount({ fields })
    expect(screen.getAllByText('Shown to players')).toHaveLength(5)
    const got = badgedKeys(NON_INSURANCE_KEYS)
    expect(got).toContain('stock.holding_cost')
    expect(got).not.toContain('demand.retail_price')
  })

  it('are absent from secret fields', async () => {
    await mount()
    const got = badgedKeys(NON_INSURANCE_KEYS)
    for (const k of ['supplier.capacity_sd_per_player', 'supplier.disruption_probability', 'transport.failure_probability', 'transport.loss_fraction']) {
      expect(got).not.toContain(k)
    }
  })
})

describe('debounced validation (acceptance 3, failure mode 7)', () => {
  it('rapid edits within 400 ms produce one validateConfig call with the full draft', async () => {
    await mount()
    vi.mocked(validateConfig).mockClear()
    edit('stock.holding_cost', 0.3)
    await advance(200)
    edit('stock.holding_cost', 0.4)
    await advance(399)
    expect(validateConfig).not.toHaveBeenCalled()
    await advance(1)
    expect(validateConfig).toHaveBeenCalledTimes(1)
    const expected = cfg((c) => (c.stock.holding_cost = 0.4))
    expect(vi.mocked(validateConfig).mock.calls[0][0]).toEqual(expected)
  })

  it('five edits 100 ms apart validate exactly once, 400 ms after the last', async () => {
    await mount()
    vi.mocked(validateConfig).mockClear()
    for (const v of [0.1, 0.2, 0.3, 0.4, 0.5]) {
      edit('stock.holding_cost', v)
      await advance(100)
    }
    expect(validateConfig).not.toHaveBeenCalled()
    await advance(299)
    expect(validateConfig).not.toHaveBeenCalled()
    await advance(1)
    expect(validateConfig).toHaveBeenCalledTimes(1)
    expect(vi.mocked(validateConfig).mock.calls[0][0]).toEqual(cfg((c) => (c.stock.holding_cost = 0.5)))
    await advance(2000)
    expect(validateConfig).toHaveBeenCalledTimes(1)
  })
})

describe('sending (acceptance 5, failure modes 4 and 5)', () => {
  it('a clean validate emits config_update with only the changed leaf', async () => {
    await mount()
    edit('stock.max_days', 5)
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(1)
    expect(configUpdateCalls()[0][1]).toEqual({ room_id: ROOM, host_secret: SECRET, config: { stock: { max_days: 5 } } })
  })

  it('sends a boolean edit as a nested leaf', async () => {
    await mount()
    fireEvent.click(control('peer_market.enabled'))
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(1)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({ peer_market: { enabled: false } })
  })

  it('sends a weekday edit as a three-level leaf', async () => {
    await mount()
    fireEvent.change(control('demand.weekday_peak.to'), { target: { value: 'sun' } })
    await advance(400)
    await advance(0)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({ demand: { weekday_peak: { to: 'sun' } } })
  })

  it('sends nothing when the draft equals the stored config (empty patch skipped)', async () => {
    await mount()
    edit('stock.max_days', 5)
    await advance(100)
    edit('stock.max_days', 3)
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(0)
  })

  it('does not send while the validate response holds an error, and sends once it is fixed', async () => {
    await mount()
    vi.mocked(validateConfig).mockResolvedValueOnce({
      ok: false,
      errors: [{ field: 'supplier.quality_max', message: 'Must be at least the minimum quality (80%).' }],
      warnings: [],
    })
    edit('supplier.quality_max', 70)
    await advance(400)
    await advance(0)
    expect(validateConfig).toHaveBeenCalled()
    expect(configUpdateCalls()).toHaveLength(0)

    edit('supplier.quality_max', 90)
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(1)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({ supplier: { quality_max: 90 } })
  })
})

describe('errors and warnings at their field (acceptance 4)', () => {
  const QMAX = 'Must be at least the minimum quality (90%).'

  it('renders a validate error under the Highest initial quality control', async () => {
    vi.mocked(validateConfig).mockResolvedValue({
      ok: false,
      errors: [{ field: 'supplier.quality_max', message: QMAX }],
      warnings: [],
    })
    await mount()
    edit('supplier.quality_min', 90)
    await advance(400)
    await advance(0)
    const msg = screen.getByText(QMAX)
    expect(msg).toBeInTheDocument()
    const input = control('supplier.quality_max')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(expect.stringContaining(QMAX))
    expect(input.compareDocumentPosition(msg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(control('supplier.quality_min')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('an edit clears that field’s server error at once', async () => {
    vi.mocked(validateConfig).mockResolvedValueOnce({
      ok: false,
      errors: [{ field: 'supplier.quality_max', message: QMAX }],
      warnings: [],
    })
    await mount()
    edit('supplier.quality_max', 70)
    await advance(400)
    await advance(0)
    expect(screen.getByText(QMAX)).toBeInTheDocument()
    edit('supplier.quality_max', 95)
    expect(screen.queryByText(QMAX)).toBeNull()
  })

  it('shows a warning at its field and still sends the patch', async () => {
    const warning = 'On the dearest spot days a unit can lose money.'
    vi.mocked(validateConfig).mockResolvedValue({
      ok: true,
      errors: [],
      warnings: [{ field: 'demand.retail_price', message: warning }],
    })
    await mount()
    edit('demand.retail_price', 10)
    await advance(400)
    await advance(0)
    expect(screen.getByText(warning)).toBeInTheDocument()
    expect(control('demand.retail_price')).toHaveAccessibleDescription(expect.stringContaining(warning))
    expect(configUpdateCalls()).toHaveLength(1)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({ demand: { retail_price: 10 } })
  })

  it('shows an issue whose field has no control in an alert at the top of its section', async () => {
    vi.mocked(validateConfig).mockResolvedValue({
      ok: false,
      errors: [{ field: 'stock.mystery', message: 'Mystery stock problem.' }],
      warnings: [],
    })
    await mount()
    edit('stock.max_days', 5)
    await advance(400)
    await advance(0)
    const msg = within(sectionOf('Stock')).getByText('Mystery stock problem.')
    expect(msg.closest('[role="alert"]')).not.toBeNull()
    expect(configUpdateCalls()).toHaveLength(0)
  })

  it('shows an issue whose path matches no section in an alert on the panel', async () => {
    vi.mocked(validateConfig).mockResolvedValue({
      ok: false,
      errors: [{ field: 'nowhere.at_all', message: 'Panel level problem.' }],
      warnings: [],
    })
    await mount()
    edit('stock.max_days', 5)
    await advance(400)
    await advance(0)
    const msg = screen.getByText('Panel level problem.')
    expect(msg.closest('[role="alert"]')).not.toBeNull()
    for (const s of SECTIONS) expect(sectionOf(s).contains(msg)).toBe(false)
  })

  it('shows a warning with no control in a status alert, not blocking', async () => {
    vi.mocked(validateConfig).mockResolvedValue({
      ok: true,
      errors: [],
      warnings: [{ field: 'stock.mystery', message: 'Mystery stock warning.' }],
    })
    await mount()
    edit('stock.max_days', 5)
    await advance(400)
    await advance(0)
    const msg = within(sectionOf('Stock')).getByText('Mystery stock warning.')
    expect(msg.closest('[role="status"]')).not.toBeNull()
    expect(configUpdateCalls()).toHaveLength(1)
  })
})

describe('insurance issues and validate-request failure', () => {
  const FEE = 'insurance.tiers.cip.fee'

  it('renders a validate warning at the CIP fee control and still sends', async () => {
    const warning = 'Far from break-even (ratio 6.00).'
    vi.mocked(validateConfig).mockResolvedValue({ ok: true, errors: [], warnings: [{ field: FEE, message: warning }] })
    await mount()
    edit(FEE, 0.5)
    await advance(400)
    await advance(0)
    expect(screen.getByText(warning)).toBeInTheDocument()
    expect(control(FEE)).toHaveAccessibleDescription(expect.stringContaining(warning))
    expect(control(FEE)).not.toHaveAttribute('aria-invalid', 'true')
    expect(configUpdateCalls()).toHaveLength(1)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({
      insurance: { tiers: { cip: { fee: 0.5 } } },
    })
  })

  it('renders a validate error at the CIP fee control with aria-invalid and blocks sending', async () => {
    const message = 'Must be between 0 and 10,000.'
    vi.mocked(validateConfig).mockResolvedValue({ ok: false, errors: [{ field: FEE, message }], warnings: [] })
    await mount()
    edit(FEE, 0.5)
    await advance(400)
    await advance(0)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(control(FEE)).toHaveAttribute('aria-invalid', 'true')
    expect(control(FEE)).toHaveAccessibleDescription(expect.stringContaining(message))
    expect(configUpdateCalls()).toHaveLength(0)
  })

  it('an edit clears the insurance error at once', async () => {
    vi.mocked(validateConfig).mockResolvedValueOnce({
      ok: false,
      errors: [{ field: FEE, message: 'Fee problem.' }],
      warnings: [],
    })
    await mount()
    edit(FEE, 0.5)
    await advance(400)
    await advance(0)
    expect(screen.getByText('Fee problem.')).toBeInTheDocument()
    edit(FEE, 0.45)
    expect(screen.queryByText('Fee problem.')).toBeNull()
  })

  it('finds the tier controls by their DOCS labels inside Transport & insurance', async () => {
    await mount()
    const section = sectionOf('Transport & insurance')
    for (const t of ['cip', 'dap', 'ddp']) {
      expect(within(section).getByRole('switch', { name: DOCS[`insurance.tiers.${t}.enabled`].label })).toBeInTheDocument()
      expect(within(section).getByLabelText(DOCS[`insurance.tiers.${t}.fee`].label)).toBeInTheDocument()
    }
  })

  it('a failed validate request shows a danger alert and sends nothing', async () => {
    const err = new Error('network down')
    vi.mocked(validateConfig).mockRejectedValue(err)
    await mount()
    edit('stock.max_days', 5)
    await advance(400)
    await advance(0)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(errorMessage(err, 'Could not check the settings.'))
    expect(configUpdateCalls()).toHaveLength(0)
  })

  it('each section with a preview has a Preview heading', async () => {
    await mount()
    expect(screen.getAllByText('Preview').length).toBeGreaterThanOrEqual(4)
    expect(within(sectionOf('Peer market')).queryByText('Preview')).toBeNull()
    expect(screen.getByText('Insurance calculator')).toBeInTheDocument()
  })
})

describe('socket INVALID_CONFIG (acceptance 6)', () => {
  it('renders at its field and is cleared from the store', async () => {
    await mount()
    const err = {
      code: 'INVALID_CONFIG',
      field: 'stock.max_days',
      message: 'Must be more than the fresh days (1).',
    } as unknown as ServerError
    act(() => useGameStore.getState().applyError(err))
    await advance(0)
    expect(screen.getByText('Must be more than the fresh days (1).')).toBeInTheDocument()
    expect(control('stock.max_days')).toHaveAccessibleDescription(
      expect.stringContaining('Must be more than the fresh days (1).'),
    )
    expect(useGameStore.getState().lastError).toBeNull()
  })
})

describe('draft handling (failure mode 8)', () => {
  it('a config_updated arriving during an unsent edit does not overwrite the edit', async () => {
    await mount()
    edit('stock.holding_cost', 0.35)
    await advance(100)
    act(() =>
      useGameStore.getState().applyConfigUpdated({ seq: 2, config: cfg((c) => (c.duration_days = 20)) }),
    )
    await advance(0)
    expect((control('stock.holding_cost') as HTMLInputElement).value).toMatch(/0?\.35/)
  })

  it('a config_updated with no unsent edit resets the draft to it', async () => {
    await mount()
    act(() =>
      useGameStore.getState().applyConfigUpdated({ seq: 2, config: cfg((c) => (c.duration_days = 20)) }),
    )
    await advance(0)
    expect((control('duration_days') as HTMLInputElement).value).toBe('20')
  })
})

describe('Reset to defaults (acceptance 7)', () => {
  it('runs the defaults through validate and sends the difference from the stored config', async () => {
    await mount({
      config: cfg((c) => {
        c.duration_days = 20
        c.stock.max_days = 5
      }),
    })
    vi.mocked(validateConfig).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    await advance(400)
    await advance(0)
    expect(validateConfig).toHaveBeenCalledTimes(1)
    expect(vi.mocked(validateConfig).mock.calls[0][0]).toEqual(defaults.config)
    expect(configUpdateCalls()).toHaveLength(1)
    expect(configUpdateCalls()[0][1]).toEqual({
      room_id: ROOM,
      host_secret: SECRET,
      config: { duration_days: 14, stock: { max_days: 3 } },
    })
  })

  it('does not send when validate returns an error', async () => {
    vi.mocked(validateConfig).mockResolvedValue({
      ok: false,
      errors: [{ field: 'duration_days', message: 'Must be between 7 and 60.' }],
      warnings: [],
    })
    await mount({ config: cfg((c) => (c.duration_days = 20)) })
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(0)
  })
})

describe('calculator inside the panel (acceptance 9)', () => {
  it('Set fees from margin updates the draft and sends only the changed fee', async () => {
    await mount({ config: cfg((c) => (c.insurance.tiers.cip.fee = 0.2)) })
    fireEvent.click(screen.getByRole('button', { name: 'Set fees from margin' }))
    await advance(400)
    await advance(0)
    expect(configUpdateCalls()).toHaveLength(1)
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({
      insurance: { tiers: { cip: { fee: 0.55 } } },
    })
  })

  it('a reference shipment edit goes through the panel’s validate and send path', async () => {
    await mount()
    vi.mocked(validateConfig).mockClear()
    fireEvent.change(screen.getByLabelText('Reference shipment (units)'), { target: { value: '40' } })
    await advance(400)
    await advance(0)
    expect(vi.mocked(validateConfig).mock.calls[0][0]).toEqual(cfg((c) => (c.insurance.reference_shipment = 40)))
    expect((configUpdateCalls()[0][1] as { config: object }).config).toEqual({ insurance: { reference_shipment: 40 } })
  })
})

describe('locked (acceptance 10)', () => {
  function expectAllLocked(container: HTMLElement): void {
    const controls = container.querySelectorAll<HTMLInputElement>('input,select,textarea,[role="switch"]')
    expect(controls.length).toBeGreaterThan(10)
    for (const el of Array.from(controls)) {
      const locked =
        el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true'
      expect(locked, el.outerHTML.slice(0, 120)).toBe(true)
    }
  }

  it('makes every control read-only and hides both action buttons', async () => {
    const { container } = await mount({ locked: true })
    expectAllLocked(container)
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Set fees from margin' })).toBeNull()
  })

  it('a null host secret locks the panel the same way', async () => {
    const { container } = await mount({ hostSecret: null })
    expectAllLocked(container)
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Set fees from margin' })).toBeNull()
  })

  it('shows the action buttons when unlocked', async () => {
    await mount()
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set fees from margin' })).toBeInTheDocument()
  })

  it('still shows the info buttons and the jump row when locked', async () => {
    await mount({ locked: true })
    expect(screen.getAllByRole('button', { name: /^About / }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Stock' })).toBeInTheDocument()
  })
})

describe('previews follow the draft (acceptance 11)', () => {
  /** The spoil risk table's headers and rows. */
  function risk(): { headers: string[]; rows: string[][] } {
    const table = screen.getAllByRole('table').find((t) => within(t).queryByText('Night'))
    if (!table) throw new Error('no spoil risk table')
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

  it('shows the spoil risk table for the defaults inside Stock', async () => {
    await mount()
    expect(within(sectionOf('Stock')).getAllByRole('table').length).toBeGreaterThan(0)
    expect(risk().rows[0]).toEqual(['1', '53%', '33%', '20%', '0%'])
  })

  it('changing fresh_days changes the risk table', async () => {
    await mount()
    const before = risk().rows
    edit('stock.max_days', 4)
    edit('stock.fresh_days', 2)
    await advance(0)
    const after = risk().rows
    expect(after).not.toEqual(before)
    expect(after[2].slice(0, 3)).toEqual(['3', '70%', '50%'])
  })

  it('changing quality_min changes the headings and values', async () => {
    await mount()
    edit('supplier.quality_min', 70)
    await advance(0)
    const { headers, rows } = risk()
    expect(headers).toContain('Plain lot at 70%')
    expect(headers).toContain('Conserved lot at 70%')
    expect(rows[0][1]).toBe('63%')
  })

  it('changing lambda changes the demand values', async () => {
    const { container } = await mount()
    const openTables = (): void => {
      for (const b of screen.queryAllByRole('button', { name: /table/i })) {
        if (b.getAttribute('aria-pressed') !== 'true' && /table/i.test(b.textContent ?? '')) fireEvent.click(b)
      }
    }
    const has200 = (): boolean =>
      Array.from(sectionOf('Demand').querySelectorAll('td')).some((td) => td.textContent?.trim() === '200')
    openTables()
    expect(has200()).toBe(false)
    edit('demand.per_player_peak', 50)
    await advance(0)
    openTables()
    expect(has200()).toBe(true)
    expect(container.textContent).toBeTruthy()
  })

  it('shows the spot range preview in Supplier & futures', async () => {
    await mount()
    expect(sectionOf('Supplier & futures').textContent).toMatch(/Spot price ranges from \$?9(\.00)? to \$?15(\.00)?/)
    edit('supplier.base_price', 20)
    await advance(0)
    expect(sectionOf('Supplier & futures').textContent).toMatch(/Spot price ranges from \$?15(\.00)? to \$?25(\.00)?/)
  })
})
