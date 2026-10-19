/** Section 25 — InsuranceCalculator (plan 25 §3.5, §4). Acceptance 8, 9, 12; failure modes 1, 2, 6. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import InsuranceCalculator from '../components/config/InsuranceCalculator'
import { DOCS } from '../components/config/docs/entries'
import type { ConfigDefaultsResponse, GameConfig } from '../types/game'

const defaults = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8'),
) as ConfigDefaultsResponse

function cfg(mut: (c: GameConfig) => void = () => {}): GameConfig {
  const c = structuredClone(defaults.config)
  mut(c)
  return c
}

type Issues = Record<string, { kind: 'error' | 'warning'; message: string }>

function mount(config: GameConfig, readOnly = false, issues?: Issues) {
  const onChange = vi.fn()
  const view = render(<InsuranceCalculator config={config} onChange={onChange} readOnly={readOnly} issues={issues} />)
  return { onChange, ...view }
}

type Tier = 'CIP' | 'DAP' | 'DDP'

/** The block of one tier (a group named after it). */
function blockFor(tier: Tier): HTMLElement {
  return screen.getByRole('group', { name: tier })
}

/** The cell texts of a tier's two table rows, Not shared first: Transport, Break-even, Verdict, Worst single failure. */
function caseRows(tier: Tier): string[][] {
  return within(blockFor(tier))
    .getAllByRole('row')
    .filter((r) => within(r).queryAllByRole('columnheader').length === 0)
    .map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent?.trim() ?? ''))
}

/** The verdict texts of a tier's two rows, Not shared first. */
function verdicts(tier: Tier): string[] {
  return caseRows(tier).map((r) => r[2])
}

const WORTH = 'Worth it'
const BREAK = 'Break-even'
const NOT_WORTH = 'Not worth it on average'
const NO_RISK = 'No risk configured'

/** Text of the smallest ancestor of `label` that shows more than the label, and not the other tile's label. */
function tileText(label: string, other: string): string {
  let el: HTMLElement | null = screen.getByText(label)
  while (el) {
    const t = el.textContent ?? ''
    if (t.includes(other)) break
    if (t.replace(label, '').trim() !== '') return t
    el = el.parentElement
  }
  throw new Error(`no tile found for ${label}`)
}

describe('layout and strings (acceptance 8, 12)', () => {
  it('shows the inputs and the three tier blocks', () => {
    mount(cfg())
    expect(screen.getByLabelText('Reference shipment (units)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target margin')).toBeInTheDocument()
    for (const t of ['CIP', 'DAP', 'DDP'] as const) expect(blockFor(t)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set fees from margin' })).toBeInTheDocument()
  })

  it('has the fee and refund labels, and the two cases named with max_players', () => {
    mount(cfg())
    expect(screen.getAllByText('Fee per unit')).toHaveLength(3)
    expect(screen.getAllByText('Refund per lost unit')).toHaveLength(3)
    expect(screen.getAllByText('Not shared')).toHaveLength(3)
    expect(screen.getAllByText('Shared with 4')).toHaveLength(3)
  })
})

describe('long rather than wide (acceptance 14, failure mode 12)', () => {
  it('has three blocks in the order CIP, DAP, DDP', () => {
    mount(cfg())
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['CIP', 'DAP', 'DDP'])
  })

  it('gives each block a table with exactly four headers and no group header row', () => {
    mount(cfg())
    for (const t of ['CIP', 'DAP', 'DDP'] as const) {
      const table = within(blockFor(t)).getByRole('table', { name: `${t} break-even` })
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual([
        'Transport',
        'Break-even',
        'Verdict',
        'Worst single failure',
      ])
      expect(table.querySelectorAll('thead tr')).toHaveLength(1)
    }
  })

  it('has no table with more than four columns', () => {
    mount(cfg())
    const tables = screen.getAllByRole('table')
    expect(tables).toHaveLength(3)
    for (const table of tables) expect(within(table).getAllByRole('columnheader').length).toBeLessThanOrEqual(4)
  })

  it('has the rows Not shared then Shared with 4, with the break-evens and verdicts never swapped', () => {
    mount(cfg())
    for (const t of ['CIP', 'DAP', 'DDP'] as const) {
      expect(caseRows(t).map((r) => r[0])).toEqual(['Not shared', 'Shared with 4'])
    }
    const cip = caseRows('CIP')
    expect([cip[0][1], cip[1][1]]).toEqual(['$0.50', '$0.08'])
    const ddp = caseRows('DDP')
    expect([ddp[0][1], ddp[1][1]]).toEqual(['$1.26', '$0.21'])
    expect(verdicts('CIP')).toEqual([NOT_WORTH, NOT_WORTH])
  })

  it('judges each row against its own break-even: a fee of 0.084 is Worth it solo and Break-even shared', () => {
    mount(cfg((c) => (c.insurance.tiers.cip.fee = 0.084)))
    expect(verdicts('CIP')).toEqual([WORTH, BREAK])
  })
})

describe('worked examples with the defaults (acceptance 8)', () => {
  it('not shared break-evens are $0.50 / $0.50 / $1.26 and shared with 4 are $0.08 / $0.08 / $0.21', () => {
    mount(cfg())
    const cip = blockFor('CIP').textContent ?? ''
    const dap = blockFor('DAP').textContent ?? ''
    const ddp = blockFor('DDP').textContent ?? ''
    expect(cip).toContain('$0.50')
    expect(cip).toContain('$0.08')
    expect(dap).toContain('$0.50')
    expect(dap).toContain('$0.08')
    expect(ddp).toContain('$1.26')
    expect(ddp).toContain('$0.21')
  })

  it('shows Not worth it on average in all six verdict cells (two per block)', () => {
    mount(cfg())
    for (const t of ['CIP', 'DAP', 'DDP'] as const) {
      expect(verdicts(t)).toEqual([NOT_WORTH, NOT_WORTH])
    }
  })

  it('shows refund values (base price for CIP and DAP, retail for DDP) and the worst single failure', () => {
    mount(cfg())
    // not shared: floor(20 x 0.3) = 6 units; shared with 4: floor(20 x 0.075) = 1 unit
    const cip = blockFor('CIP').textContent ?? ''
    const ddp = blockFor('DDP').textContent ?? ''
    expect(cip).toContain('$12.00')
    expect(cip).toContain('$72.00')
    expect(ddp).toContain('$30.00')
    expect(ddp).toContain('$180.00')
  })

  it('shows the chance of at least one failure and the expected failures', () => {
    mount(cfg())
    // 1 - 0.86^14 = 87.9 %; 0.14 x 14 = 1.96
    expect(tileText('Chance of at least one failure', 'Expected failures')).toContain('88%')
    expect(tileText('Expected failures', 'Chance of at least one failure')).toContain('2.0')
  })

  it('has no out-of-sync note when the fees equal feeFromMargin', () => {
    mount(cfg())
    expect(screen.queryByText(/ratio .* — target/)).toBeNull()
  })

  it('uses max_players as the sharing reference: with 12 seats the shared loss rounds to 0 units', () => {
    mount(cfg((c) => (c.max_players = 12)))
    expect(screen.getAllByText('Shared with 12')).toHaveLength(3)
    // floor(20 x 0.3 / 12) = floor(0.5) = 0: shared break-even is $0.00 -> No risk configured
    for (const t of ['CIP', 'DAP', 'DDP'] as const) {
      expect(verdicts(t)).toEqual([NOT_WORTH, NO_RISK])
    }
  })
})

describe('verdict thresholds (failure mode 1)', () => {
  // CIP break-even is 0.504 not shared. The shared column always reads Not worth it on average at these fees.
  const cases: Array<[number, string]> = [
    [0.4738, WORTH],
    [0.504, BREAK],
    [0.5342, NOT_WORTH],
  ]
  for (const [fee, badge] of cases) {
    it(`CIP fee ${fee} gives ${badge}`, () => {
      mount(cfg((c) => (c.insurance.tiers.cip.fee = fee)))
      expect(verdicts('CIP')).toEqual([badge, NOT_WORTH])
    })
  }
})

describe('no risk configured (failure mode 2)', () => {
  it('p = 0 shows No risk configured everywhere and never Infinity or NaN', () => {
    const { container } = mount(cfg((c) => (c.transport.failure_probability = 0)))
    for (const t of ['CIP', 'DAP', 'DDP'] as const) {
      expect(verdicts(t)).toEqual([NO_RISK, NO_RISK])
    }
    expect(container.textContent).not.toMatch(/Infinity|NaN/)
    expect(tileText('Chance of at least one failure', 'Expected failures')).toContain('0%')
    expect(tileText('Expected failures', 'Chance of at least one failure')).toContain('0.0')
    expect(screen.queryByText(/ratio .* — target/)).toBeNull()
  })

  it('L = 0 behaves the same', () => {
    const { container } = mount(cfg((c) => (c.transport.loss_fraction = 0)))
    expect(screen.getAllByText(NO_RISK)).toHaveLength(6)
    expect(container.textContent).not.toMatch(/Infinity|NaN/)
  })

  it('a zero break-even gives no out-of-sync note even though the fee differs from the margin fee', () => {
    mount(cfg((c) => (c.transport.failure_probability = 0)))
    expect(screen.queryByText(/ratio/)).toBeNull()
  })
})

describe('out-of-sync note (acceptance 8)', () => {
  it('names the tier, the ratio and the target to two decimals', () => {
    mount(cfg((c) => (c.insurance.tiers.cip.fee = 0.4738)))
    expect(screen.getByText('CIP ratio 0.94 — target 1.10')).toBeInTheDocument()
    expect(screen.queryByText(/DAP ratio/)).toBeNull()
    expect(screen.queryByText(/DDP ratio/)).toBeNull()
  })

  it('sits above the Set fees from margin button', () => {
    mount(cfg((c) => (c.insurance.tiers.cip.fee = 0.4738)))
    const note = screen.getByText('CIP ratio 0.94 — target 1.10')
    const button = screen.getByRole('button', { name: 'Set fees from margin' })
    expect(note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('measures against the break-even of the current sharing mode', () => {
    // shared with 4: break-even CIP $0.084, fee 0.55 -> ratio 6.55; target 1 + 0.10
    mount(cfg((c) => (c.transport.shared = true)))
    expect(screen.getByText('CIP ratio 6.55 — target 1.10')).toBeInTheDocument()
    expect(screen.getByText('DAP ratio 6.55 — target 1.10')).toBeInTheDocument()
    expect(screen.getByText('DDP ratio 6.62 — target 1.10')).toBeInTheDocument()
  })

  it('has no note for a disabled tier', () => {
    mount(
      cfg((c) => {
        c.insurance.tiers.dap.enabled = false
        c.insurance.tiers.dap.fee = 0.1
      }),
    )
    expect(screen.queryByText(/DAP ratio/)).toBeNull()
  })
})

describe('disabled tiers', () => {
  it('are marked Not offered and the others are not', () => {
    mount(cfg((c) => (c.insurance.tiers.dap.enabled = false)))
    expect(within(blockFor('DAP')).getByText('Not offered')).toBeInTheDocument()
    expect(within(blockFor('CIP')).queryByText('Not offered')).toBeNull()
    expect(within(blockFor('DDP')).queryByText('Not offered')).toBeNull()
  })
})

describe('Set fees from margin (acceptance 9, failure mode 6)', () => {
  it('sets every enabled tier in one onChange with the worked-example patch', () => {
    const { onChange } = mount(
      cfg((c) => {
        c.insurance.tiers.cip.fee = 0.2
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set fees from margin' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      insurance: { tiers: { cip: { fee: 0.55 }, dap: { fee: 0.55 }, ddp: { fee: 1.39 } } },
    })
  })

  it('leaves a disabled tier out of the patch', () => {
    const { onChange } = mount(
      cfg((c) => {
        c.insurance.tiers.dap.enabled = false
        c.insurance.tiers.dap.fee = 0.05
        c.insurance.tiers.cip.fee = 0.2
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set fees from margin' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const patch = onChange.mock.calls[0][0] as { insurance: { tiers: Record<string, unknown> } }
    expect(patch.insurance.tiers).toEqual({ cip: { fee: 0.55 }, ddp: { fee: 1.39 } })
    expect(Object.keys(patch.insurance.tiers)).not.toContain('dap')
  })

  it('uses the break-even of the current sharing mode and the target margin', () => {
    // shared with 4, margin 100 %: 0.084 x 2, 0.084 x 2, 0.21 x 2
    const { onChange } = mount(
      cfg((c) => {
        c.transport.shared = true
        c.insurance.target_margin = 1
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set fees from margin' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      insurance: { tiers: { cip: { fee: 0.17 }, dap: { fee: 0.17 }, ddp: { fee: 0.42 } } },
    })
  })

  it('does not call onChange on render', () => {
    const { onChange } = mount(cfg())
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('inputs', () => {
  it('an edit of the reference shipment goes out as a nested patch', () => {
    const { onChange } = mount(cfg())
    fireEvent.change(screen.getByLabelText('Reference shipment (units)'), { target: { value: '40' } })
    expect(onChange).toHaveBeenLastCalledWith({ insurance: { reference_shipment: 40 } })
  })

  it('every input is read-only or disabled when readOnly', () => {
    const { container } = mount(cfg(), true)
    const controls = container.querySelectorAll<HTMLInputElement>('input,select,textarea,[role="switch"]')
    expect(controls.length).toBeGreaterThan(0)
    for (const el of Array.from(controls)) {
      const locked =
        el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true'
      expect(locked).toBe(true)
    }
  })
})

describe('tier controls (plan 25 §3.5)', () => {
  const tiers = ['cip', 'dap', 'ddp'] as const

  it('are found by the DOCS labels, a switch and a fee per tier', () => {
    mount(cfg())
    expect(DOCS['insurance.tiers.cip.fee'].label).toBe('CIP + blockchain: fee per unit')
    for (const t of tiers) {
      expect(screen.getByRole('switch', { name: DOCS[`insurance.tiers.${t}.enabled`].label })).toBeInTheDocument()
      expect(screen.getByLabelText(DOCS[`insurance.tiers.${t}.fee`].label)).toBeInTheDocument()
    }
  })

  it('show the configured fees and switch states', () => {
    mount(cfg((c) => (c.insurance.tiers.dap.enabled = false)))
    expect((screen.getByLabelText(DOCS['insurance.tiers.ddp.fee'].label) as HTMLInputElement).value).toMatch(/1\.39/)
    expect(screen.getByRole('switch', { name: DOCS['insurance.tiers.cip.enabled'].label })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: DOCS['insurance.tiers.dap.enabled'].label })).toHaveAttribute('aria-checked', 'false')
  })

  it('a fee edit goes out as a nested leaf patch', () => {
    const { onChange } = mount(cfg())
    fireEvent.change(screen.getByLabelText(DOCS['insurance.tiers.cip.fee'].label), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenLastCalledWith({ insurance: { tiers: { cip: { fee: 0.5 } } } })
  })

  it('a switch click goes out as a nested leaf patch', () => {
    const { onChange } = mount(cfg())
    fireEvent.click(screen.getByRole('switch', { name: DOCS['insurance.tiers.dap.enabled'].label }))
    expect(onChange).toHaveBeenLastCalledWith({ insurance: { tiers: { dap: { enabled: false } } } })
  })
})

describe('issues prop (plan 25 §2, §3.5)', () => {
  it('renders an error at the fee control with aria-invalid and a description', () => {
    mount(cfg(), false, { 'insurance.tiers.cip.fee': { kind: 'error', message: 'Fee problem.' } })
    const input = screen.getByLabelText(DOCS['insurance.tiers.cip.fee'].label)
    expect(screen.getByText('Fee problem.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Fee problem.'))
    expect(screen.getByLabelText(DOCS['insurance.tiers.dap.fee'].label)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('renders a warning at the fee control without marking it invalid', () => {
    mount(cfg(), false, { 'insurance.tiers.ddp.fee': { kind: 'warning', message: 'Far from break-even (ratio 6.60).' } })
    const input = screen.getByLabelText(DOCS['insurance.tiers.ddp.fee'].label)
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Far from break-even (ratio 6.60).'))
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('renders issues at the margin and reference shipment controls', () => {
    mount(cfg(), false, {
      'insurance.target_margin': { kind: 'error', message: 'Margin problem.' },
      'insurance.reference_shipment': { kind: 'warning', message: 'Shipment note.' },
    })
    expect(screen.getByLabelText('Target margin')).toHaveAccessibleDescription(expect.stringContaining('Margin problem.'))
    expect(screen.getByLabelText('Target margin')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Reference shipment (units)')).toHaveAccessibleDescription(
      expect.stringContaining('Shipment note.'),
    )
  })

  it('renders an issue on an enabled switch', () => {
    mount(cfg(), false, { 'insurance.tiers.dap.enabled': { kind: 'error', message: 'Switch problem.' } })
    expect(screen.getByText('Switch problem.')).toBeInTheDocument()
  })

  it('shows nothing extra without issues', () => {
    const { container } = mount(cfg())
    expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0)
  })
})

describe('heading (plan 25 §3.4a)', () => {
  it('the calculator card is headed Insurance calculator', () => {
    mount(cfg())
    expect(screen.getByText('Insurance calculator')).toBeInTheDocument()
  })
})
