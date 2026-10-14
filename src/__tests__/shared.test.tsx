/**
 * Section 22 — the shared primitives (`src/components/shared/*`).
 * Acceptance criteria 1 and 11; failure modes 1, 2 and 3.
 * Queries are by role, label or text; class names are asserted only where
 * design.md makes them the rule (a token utility is the visible contract).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  auth: {
    loading: false,
    mode: 'authenticated' as 'authenticated' | 'guest' | null,
    user: { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null as string | null } as {
      displayName: string | null
      email: string | null
      photoURL: string | null
    } | null,
    signOut: vi.fn(async () => undefined),
  },
  backend: { status: 'waking' as 'checking' | 'awake' | 'waking', elapsedSeconds: 0 },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: h.auth.loading,
    mode: h.auth.mode,
    user: h.auth.user,
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: h.auth.signOut,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../contexts/BackendStatusContext', () => ({
  useBackendStatus: () => h.backend,
  BackendStatusProvider: ({ children }: { children: ReactNode }) => children,
}))

import AppHeader from '../components/shared/AppHeader'
import AlertContainer, { InlineAlert } from '../components/shared/AlertContainer'
import BackendWakeUp from '../components/shared/BackendWakeUp'
import Badge, { PulqueriaChip } from '../components/shared/Badge'
import Button from '../components/shared/Button'
import ChartBox from '../components/shared/ChartBox'
import Checkbox from '../components/shared/Checkbox'
import Collapsible from '../components/shared/Collapsible'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import DataTable from '../components/shared/DataTable'
import EmptyState from '../components/shared/EmptyState'
import Legend from '../components/shared/Legend'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import NumberField from '../components/shared/NumberField'
import RadioCards from '../components/shared/RadioCards'
import RiskIndicator from '../components/shared/RiskIndicator'
import SectionCard from '../components/shared/SectionCard'
import StatTile from '../components/shared/StatTile'
import Switch from '../components/shared/Switch'
import Tooltip from '../components/shared/Tooltip'
import { useGameStore } from '../store/gameStore'

beforeEach(() => {
  useGameStore.getState().reset()
  h.auth.mode = 'authenticated'
  h.auth.user = { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null }
  h.backend.status = 'waking'
  h.backend.elapsedSeconds = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Button', () => {
  it('renders its label as a button, secondary and md by default, passing attributes through', () => {
    render(
      <Button type="submit" data-testid="b">
        Save
      </Button>,
    )
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).toHaveAttribute('type', 'submit')
    expect(b).toHaveAttribute('data-testid', 'b')
  })

  it.each(['primary', 'secondary', 'ghost', 'destructive', 'destructive-solid'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeEnabled()
  })

  it.each(['sm', 'md', 'lg'] as const)('renders size %s', (size) => {
    render(<Button size={size}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })

  it('primary uses the accent fill and destructive-solid the danger fill', () => {
    const { rerender } = render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-accent')
    rerender(<Button variant="destructive-solid">Go</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger')
  })

  it('shows an icon beside the label, hidden from assistive technology', () => {
    render(<Button icon={Plus}>Add</Button>)
    const b = screen.getByRole('button', { name: 'Add' })
    const svg = b.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('failure mode 1: a disabled button carries the disabled attribute and does not fade with opacity', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    const b = screen.getByRole('button', { name: 'Go' })
    expect(b).toHaveAttribute('disabled')
    expect(b.className).not.toMatch(/(^|\s)(disabled:)?opacity-/)
    await userEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading sets aria-busy, keeps the label and ignores clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button loading icon={Plus} onClick={onClick}>
        Save
      </Button>,
    )
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(b)
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is not busy when not loading, and clicks go through', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const b = screen.getByRole('button', { name: 'Save' })
    expect(b).not.toHaveAttribute('aria-busy', 'true')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('SectionCard', () => {
  it('is a region named by its h2 title and holds its children', () => {
    render(
      <SectionCard title="Today's decision" id="decision" meta={<span>Day 5</span>} actions={<button>Act</button>}>
        <p>body text</p>
      </SectionCard>,
    )
    const region = screen.getByRole('region', { name: "Today's decision" })
    expect(region.tagName).toBe('SECTION')
    expect(region).toHaveAttribute('id', 'decision')
    expect(within(region).getByRole('heading', { level: 2, name: "Today's decision" })).toBeInTheDocument()
    expect(within(region).getByText('Day 5')).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Act' })).toBeInTheDocument()
    expect(within(region).getByText('body text')).toBeInTheDocument()
  })

  it('the decision tone draws the accent-line border, the default tone does not', () => {
    const { rerender } = render(
      <SectionCard title="A" tone="decision">
        x
      </SectionCard>,
    )
    expect(screen.getByRole('region')).toHaveClass('border-accent-line')
    rerender(<SectionCard title="A">x</SectionCard>)
    expect(screen.getByRole('region')).not.toHaveClass('border-accent-line')
  })

  it.each(['standard', 'dense', 'presentation'] as const)('renders density %s', (density) => {
    render(
      <SectionCard title="A" density={density}>
        x
      </SectionCard>,
    )
    expect(screen.getByRole('region', { name: 'A' })).toBeInTheDocument()
  })
})

describe('Collapsible', () => {
  it.each(['card', 'inline'] as const)('%s variant is a native details/summary', (variant) => {
    const { container } = render(
      <Collapsible variant={variant} summary="Details" open={false} onOpenChange={() => {}}>
        <p>inside</p>
      </Collapsible>,
    )
    const details = container.querySelector('details')!
    expect(details).not.toBeNull()
    expect(details.querySelector('summary')).toHaveTextContent('Details')
    expect(details.open).toBe(false)
  })

  it('the open prop sets the open state', () => {
    const { container } = render(
      <Collapsible variant="card" summary="Details" open onOpenChange={() => {}}>
        <p>inside</p>
      </Collapsible>,
    )
    expect(container.querySelector('details')!.open).toBe(true)
  })

  it('failure mode 2: clicking the summary of a closed one asks to open and stays closed until the prop changes', async () => {
    const onOpenChange = vi.fn()
    const { container, rerender } = render(
      <Collapsible variant="inline" summary="Plan details" open={false} onOpenChange={onOpenChange}>
        <p>inside</p>
      </Collapsible>,
    )
    const details = container.querySelector('details')!
    await userEvent.click(screen.getByText('Plan details'))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(details.open).toBe(false)

    rerender(
      <Collapsible variant="inline" summary="Plan details" open onOpenChange={onOpenChange}>
        <p>inside</p>
      </Collapsible>,
    )
    expect(container.querySelector('details')!.open).toBe(true)
  })

  it('clicking the summary of an open one asks to close and stays open', async () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <Collapsible variant="card" summary="Details" open onOpenChange={onOpenChange}>
        <p>inside</p>
      </Collapsible>,
    )
    await userEvent.click(screen.getByText('Details'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(container.querySelector('details')!.open).toBe(true)
  })
})

describe('StatTile', () => {
  it('shows label, value and sub-line, the value tabular', () => {
    render(<StatTile label="Cash" value="$6,120.00" sub="after yesterday" icon={Plus} />)
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('after yesterday')).toBeInTheDocument()
    const value = screen.getByText('$6,120.00')
    expect(value).toHaveClass('tabular-nums')
    expect(value).toHaveClass('text-stat')
  })

  it('size lg sets the value in text-lg', () => {
    render(<StatTile label="Sold" value="24" size="lg" />)
    expect(screen.getByText('24')).toHaveClass('text-lg')
    expect(screen.getByText('24')).not.toHaveClass('text-stat')
  })

  it.each([
    ['good', 'text-success-ink'],
    ['bad', 'text-danger-ink'],
    ['neutral', 'text-ink-muted'],
  ] as const)('delta tone %s colours the text %s', (tone, cls) => {
    const { container } = render(<StatTile label="Profit" value="1" delta={{ text: '+$35.00', direction: 'up', tone }} />)
    let el: HTMLElement | null = screen.getByText('+$35.00')
    while (el && !el.classList.contains(cls) && el !== container) el = el.parentElement
    expect(el?.classList.contains(cls), `${cls} on or above the delta text`).toBe(true)
  })

  it('the arrow follows the direction, not the tone', () => {
    const { container, rerender } = render(<StatTile label="P" value="1" delta={{ text: '3', direction: 'up', tone: 'bad' }} />)
    expect(container.querySelector('svg.lucide-trending-up')).not.toBeNull()
    expect(container.querySelector('svg.lucide-trending-down')).toBeNull()
    rerender(<StatTile label="P" value="1" delta={{ text: '3', direction: 'down', tone: 'good' }} />)
    expect(container.querySelector('svg.lucide-trending-down')).not.toBeNull()
    expect(container.querySelector('svg.lucide-trending-up')).toBeNull()
  })

  it('renders no delta arrow without a delta', () => {
    const { container } = render(<StatTile label="P" value="1" />)
    expect(container.querySelector('svg.lucide-trending-up, svg.lucide-trending-down')).toBeNull()
  })
})

describe('DataTable', () => {
  interface Row {
    id: string
    name: string
    sold: number
  }
  const rows: Row[] = [
    { id: 'a', name: 'Don Agave', sold: 24 },
    { id: 'b', name: 'La Chula', sold: 18 },
  ]
  const columns = [
    { key: 'name', header: 'Pulquería', render: (r: Row) => r.name },
    { key: 'sold', header: 'Sold', align: 'right' as const, render: (r: Row) => String(r.sold) },
  ]

  it('is a table with a caption, column headers and one row per item rendered by the columns', () => {
    render(<DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const table = screen.getByRole('table', { name: 'Yesterday' })
    expect(within(table).getByRole('columnheader', { name: 'Pulquería' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Sold' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Don Agave' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: '18' })).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('the caption is a real <caption>, screen-reader only unless captionVisible', () => {
    const { container, rerender } = render(
      <DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.id} captionVisible={false} />,
    )
    const hidden = container.querySelector('caption')!
    expect(hidden).toHaveTextContent('Yesterday')
    expect(hidden).toHaveClass('sr-only')
    rerender(<DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.id} captionVisible />)
    expect(container.querySelector('caption')).not.toHaveClass('sr-only')
  })

  it('right-aligns the numeric column and its header', () => {
    render(<DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(screen.getByRole('columnheader', { name: 'Sold' })).toHaveClass('text-right')
    expect(screen.getByRole('cell', { name: '24' })).toHaveClass('text-right')
    expect(screen.getByRole('cell', { name: 'Don Agave' })).not.toHaveClass('text-right')
  })

  it('highlights the rows highlightRow selects (your pulquería: accent-subtle)', () => {
    render(
      <DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.id} highlightRow={(r) => r.id === 'b'} />,
    )
    const rowOf = (name: string) => screen.getByRole('cell', { name }).closest('tr')!
    expect(rowOf('La Chula')).toHaveClass('bg-accent-subtle')
    expect(rowOf('Don Agave')).not.toHaveClass('bg-accent-subtle')
  })

  it('renders group headers as a second header row spanning their columns', () => {
    render(
      <DataTable
        caption="Players"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        groups={[
          { label: 'Identity', span: 1 },
          { label: 'Demand', span: 1 },
        ]}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Identity' })).toHaveAttribute('colspan', '1')
    expect(screen.getByRole('columnheader', { name: 'Demand' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('a group spanning several columns carries its span', () => {
    render(<DataTable caption="Players" columns={columns} rows={rows} rowKey={(r) => r.id} groups={[{ label: 'All', span: 2 }]} />)
    expect(screen.getByRole('columnheader', { name: 'All' })).toHaveAttribute('colspan', '2')
  })

  it('stickyFirstColumn pins the first column only', () => {
    render(<DataTable caption="Players" columns={columns} rows={rows} rowKey={(r) => r.id} stickyFirstColumn />)
    expect(screen.getByRole('cell', { name: 'Don Agave' })).toHaveClass('sticky')
    expect(screen.getByRole('cell', { name: '24' })).not.toHaveClass('sticky')
  })

  it('renders both densities', () => {
    const { rerender } = render(<DataTable caption="T" columns={columns} rows={rows} rowKey={(r) => r.id} density="compact" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    rerender(<DataTable caption="T" columns={columns} rows={rows} rowKey={(r) => r.id} density="standard" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

describe('Badge and PulqueriaChip', () => {
  it.each([
    ['neutral', 'bg-muted'],
    ['accent', 'bg-accent-subtle'],
    ['success', 'bg-success-subtle'],
    ['warning', 'bg-warning-subtle'],
    ['danger', 'bg-danger-subtle'],
    ['info', 'bg-info-subtle'],
    ['shown', 'bg-muted'],
  ] as const)('tone %s uses %s', (tone, cls) => {
    render(<Badge tone={tone}>Label</Badge>)
    expect(screen.getByText('Label').closest('[class*="bg-"]')).toHaveClass(cls)
  })

  it('only the shown tone has the dashed edge', () => {
    const { rerender } = render(<Badge tone="shown">Shown to players</Badge>)
    expect(screen.getByText('Shown to players').closest('[class*="border-dashed"]')).not.toBeNull()
    rerender(<Badge tone="neutral">Shown to players</Badge>)
    expect(screen.getByText('Shown to players').closest('[class*="border-dashed"]')).toBeNull()
  })

  it('shows its icon aria-hidden beside the word', () => {
    const { container } = render(
      <Badge tone="success" icon={Plus}>
        Worth it
      </Badge>,
    )
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('PulqueriaChip shows the display name, and a You chip only for the viewer', () => {
    const { rerender } = render(<PulqueriaChip alias="P2" displayName="La Chula" />)
    expect(screen.getByText('La Chula')).toBeInTheDocument()
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    rerender(<PulqueriaChip alias="P2" displayName="La Chula" you />)
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('PulqueriaChip hatches the swatch of P7-P12 with an SVG pattern, never a CSS gradient', () => {
    const { container, rerender } = render(<PulqueriaChip alias="P1" displayName="One" />)
    expect(container.querySelector('pattern')).toBeNull()
    rerender(<PulqueriaChip alias="P8" displayName="Eight" />)
    expect(container.querySelector('pattern')).not.toBeNull()
  })
})

describe('RiskIndicator', () => {
  it('shows 67% and Likely to spoil, with the octagon icon', () => {
    const { container } = render(<RiskIndicator risk={0.67} />)
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('Likely to spoil')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-octagon-alert')).not.toBeNull()
  })

  it('shows 0% and Safe, with the circle-check icon', () => {
    const { container } = render(<RiskIndicator risk={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('Safe')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-circle-check')).not.toBeNull()
  })

  it('failure mode 3: 0.33 says "At risk" in words, with the triangle icon', () => {
    const { container } = render(<RiskIndicator risk={0.33} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('At risk')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-triangle-alert')).not.toBeNull()
  })

  it('has a bar that is hidden from assistive technology and filled to the risk', () => {
    const { container } = render(<RiskIndicator risk={0.67} />)
    const hiddenBars = Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter((e) => e.tagName.toLowerCase() !== 'svg')
    expect(hiddenBars.length).toBeGreaterThan(0)
    const filled = hiddenBars.some((bar) =>
      [bar, ...Array.from(bar.querySelectorAll<HTMLElement>('*'))].some((e) => (e as HTMLElement).style.width.startsWith('67')),
    )
    expect(filled).toBe(true)
  })

  it.each([
    [0.49, 'At risk'],
    [0.5, 'Likely to spoil'],
    [1, 'Likely to spoil'],
  ])('risk %s reads %s', (risk, label) => {
    render(<RiskIndicator risk={risk} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('the compact variant keeps the number and the label', () => {
    render(<RiskIndicator risk={0.43} variant="compact" />)
    expect(screen.getByText('43%')).toBeInTheDocument()
    expect(screen.getByText('At risk')).toBeInTheDocument()
  })
})

describe('NumberField', () => {
  /** A stateful harness, because the field is controlled. */
  function Harness(props: {
    initial?: number | null
    kind?: 'quantity' | 'money' | 'decimal'
    onValue?: (v: number | null) => void
    extra?: Partial<React.ComponentProps<typeof NumberField>>
  }) {
    const [value, setValue] = useState<number | null>(props.initial ?? null)
    return (
      <NumberField
        label="Spot order"
        kind={props.kind ?? 'quantity'}
        value={value}
        onChange={(v) => {
          props.onValue?.(v)
          setValue(v)
        }}
        {...props.extra}
      />
    )
  }
  const input = () => screen.getByLabelText('Spot order') as HTMLInputElement

  it('labels the input by its label', () => {
    render(<Harness initial={5} />)
    expect(screen.getByRole('textbox', { name: 'Spot order' })).toBe(input())
    expect(input().value).toBe('5')
  })

  it('hideLabel hides the label visually but keeps it accessible', () => {
    render(<Harness extra={{ hideLabel: true }} />)
    expect(input()).toBeInTheDocument()
    const label = document.querySelector('label[for]') ?? screen.getByText('Spot order')
    expect(label.className).toContain('sr-only')
  })

  it('an empty input reports null, and a number reports the number', () => {
    const seen: Array<number | null> = []
    render(<Harness initial={5} onValue={(v) => seen.push(v)} />)
    fireEvent.change(input(), { target: { value: '' } })
    expect(seen.at(-1)).toBeNull()
    fireEvent.change(input(), { target: { value: '12' } })
    expect(seen.at(-1)).toBe(12)
  })

  it('shows a null value as an empty input', () => {
    render(<Harness initial={null} />)
    expect(input().value).toBe('')
  })

  it('ignores non-numeric input', () => {
    const onValue = vi.fn()
    render(<Harness initial={5} onValue={onValue} />)
    fireEvent.change(input(), { target: { value: 'abc' } })
    fireEvent.change(input(), { target: { value: '5x' } })
    expect(onValue).not.toHaveBeenCalled()
    expect(input().value).toBe('5')
  })

  it('quantity accepts integers only', () => {
    const onValue = vi.fn()
    render(<Harness initial={5} kind="quantity" onValue={onValue} />)
    fireEvent.change(input(), { target: { value: '1.5' } })
    for (const [v] of onValue.mock.calls) expect(Number.isInteger(v)).toBe(true)
    expect(input().value).not.toBe('1.5')
  })

  it('money shows two decimals and the $ prefix', () => {
    render(<Harness initial={12.5} kind="money" />)
    expect(input().value).toBe('12.50')
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it('money reports a decimal number', () => {
    const onValue = vi.fn()
    render(<Harness initial={null} kind="money" onValue={onValue} />)
    fireEvent.change(input(), { target: { value: '13.4' } })
    expect(onValue).toHaveBeenLastCalledWith(13.4)
  })

  it('decimal is a plain number with no prefix', () => {
    render(<Harness initial={0.25} kind="decimal" />)
    expect(input().value).toBe('0.25')
    expect(screen.queryByText('$')).not.toBeInTheDocument()
  })

  it('shows a prefix, a suffix and the context line', () => {
    render(<Harness initial={90} kind="quantity" extra={{ suffix: '%', context: <span>quality guide</span> }} />)
    expect(screen.getByText('%')).toBeInTheDocument()
    expect(screen.getByText('quality guide')).toBeInTheDocument()
  })

  it('min and max only set attributes: an out-of-range number still reaches onChange unchanged', () => {
    const onValue = vi.fn()
    render(<Harness initial={5} kind="quantity" onValue={onValue} extra={{ min: 0, max: 100 }} />)
    expect(input()).toHaveAttribute('min', '0')
    expect(input()).toHaveAttribute('max', '100')
    fireEvent.change(input(), { target: { value: '250' } })
    expect(onValue).toHaveBeenLastCalledWith(250)
    expect(input().value).toBe('250')
  })

  it('error sets aria-invalid and points aria-describedby at the error line', () => {
    render(<Harness initial={5} extra={{ error: 'Must be at most 100.' }} />)
    expect(input()).toHaveAttribute('aria-invalid', 'true')
    const id = input().getAttribute('aria-describedby')!
    expect(id).toBeTruthy()
    const described = id.split(/\s+/).map((i) => document.getElementById(i)?.textContent ?? '').join(' ')
    expect(described).toContain('Must be at most 100.')
    expect(screen.getByText('Must be at most 100.')).toBeInTheDocument()
  })

  it('without an error the field is not invalid', () => {
    render(<Harness initial={5} />)
    expect(input()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('a warning shows its line without marking the field invalid', () => {
    render(<Harness initial={5} extra={{ warning: 'Above the supplier capacity.' }} />)
    expect(screen.getByText('Above the supplier capacity.')).toBeInTheDocument()
    expect(input()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('disabled disables the input', () => {
    render(<Harness initial={5} extra={{ disabled: true }} />)
    expect(input()).toBeDisabled()
  })

  it('readOnly keeps the value visible and not editable, and is not disabled', () => {
    render(<Harness initial={5} extra={{ readOnly: true }} />)
    expect(input()).toHaveAttribute('readonly')
    expect(input()).toBeEnabled()
    expect(input().value).toBe('5')
  })

  it('passes id and name to the input', () => {
    render(<Harness initial={5} extra={{ id: 'spot', name: 'order_spot' }} />)
    expect(input()).toHaveAttribute('id', 'spot')
    expect(input()).toHaveAttribute('name', 'order_spot')
  })
})

describe('Switch', () => {
  it('is a button with role switch, named by its label, reflecting checked', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} label="Cooperate" />)
    const sw = screen.getByRole('switch', { name: 'Cooperate' })
    expect(sw.tagName).toBe('BUTTON')
    expect(sw).toHaveAttribute('aria-checked', 'false')
    rerender(<Switch checked onChange={() => {}} label="Cooperate" />)
    expect(screen.getByRole('switch', { name: 'Cooperate' })).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking asks for the opposite value, and does not change itself', async () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Cooperate" />)
    await userEvent.click(screen.getByRole('switch', { name: 'Cooperate' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the visible label toggles too', async () => {
    const onChange = vi.fn()
    render(<Switch checked onChange={onChange} label="Cooperate" />)
    await userEvent.click(screen.getByText('Cooperate'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('disabled does nothing', async () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Cooperate" disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Checkbox', () => {
  it('is a checkbox named by its label, with the trailing content beside it', () => {
    render(<Checkbox checked onChange={() => {}} label="L3 · 12 u" trailing={<span>$12.00</span>} />)
    const box = screen.getByRole('checkbox', { name: /L3 · 12 u/ })
    expect(box).toBeChecked()
    expect(screen.getByText('$12.00')).toBeInTheDocument()
  })

  it('clicking asks for the opposite value', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Conserve" />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Conserve' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('clicking the label text toggles it (the whole row is the label)', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked onChange={onChange} label="Conserve" />)
    await userEvent.click(screen.getByText('Conserve'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('disabled cannot be toggled', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} label="Conserve" disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('RadioCards', () => {
  const options = [
    { value: 'exw', label: 'EXW', lines: ['fee $0.00/u'] },
    { value: 'cip', label: 'CIP', lines: ['fee $0.40/u', 'refund $13.40/u'] },
    { value: 'dap', label: 'DAP', disabled: true },
  ]

  it('is a fieldset with a legend and one radio per option', () => {
    const { container } = render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={() => {}} />)
    expect(container.querySelector('fieldset')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Incoterm' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /CIP/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /EXW/ })).not.toBeChecked()
  })

  it('shows each option\'s lines', () => {
    render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={() => {}} />)
    expect(screen.getByText('refund $13.40/u')).toBeInTheDocument()
    expect(screen.getByText('fee $0.00/u')).toBeInTheDocument()
  })

  it('every radio shares the name', () => {
    render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={() => {}} />)
    for (const r of screen.getAllByRole('radio')) expect(r).toHaveAttribute('name', 'tier')
  })

  it('choosing another option reports its value; the checked one stays controlled', async () => {
    const onChange = vi.fn()
    render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /EXW/ }))
    expect(onChange).toHaveBeenCalledWith('exw')
    expect(screen.getByRole('radio', { name: /CIP/ })).toBeChecked()
  })

  it('a disabled option cannot be chosen', async () => {
    const onChange = vi.fn()
    render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: /DAP/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /DAP/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('locked disables every radio but keeps the checked one checked', async () => {
    const onChange = vi.fn()
    render(<RadioCards legend="Incoterm" name="tier" value="cip" options={options} onChange={onChange} locked />)
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled()
    expect(screen.getByRole('radio', { name: /CIP/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /EXW/ }))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Legend', () => {
  it('is a list with one item per series, labelled', () => {
    render(
      <Legend
        items={[
          { key: 'a', label: 'Market demand', swatch: { kind: 'line', color: '#26221b' } },
          { key: 'b', label: 'Delivered', swatch: { kind: 'line', color: '#2a78d6', dash: [12, 4], pointStyle: 'rect' } },
          { key: 'c', label: 'Lost', swatch: { kind: 'fill', color: '#c9518a' } },
        ]}
      />,
    )
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Market demand')).toBeInTheDocument()
    expect(screen.getByText('Lost')).toBeInTheDocument()
  })

  it('a dashed line swatch carries its dash and colour; an undashed one has no dash', () => {
    const { container } = render(
      <Legend
        items={[
          { key: 'a', label: 'Demand', swatch: { kind: 'line', color: '#26221b' } },
          { key: 'b', label: 'Delivered', swatch: { kind: 'line', color: '#2a78d6', dash: [12, 4] } },
        ]}
      />,
    )
    const [demand, delivered] = screen.getAllByRole('listitem')
    expect(demand.querySelector('[stroke-dasharray]')).toBeNull()
    expect(demand.querySelector('[stroke="#26221b"]')).not.toBeNull()
    const dashed = delivered.querySelector('[stroke-dasharray]')
    expect(dashed?.getAttribute('stroke-dasharray')).toMatch(/12[\s,]+4/)
    expect(delivered.querySelector('[stroke="#2a78d6"]')).not.toBeNull()
    expect(container.querySelector('[class*="gradient"]')).toBeNull()
  })

  it('a hatched fill swatch uses an SVG pattern, a plain one does not', () => {
    render(
      <Legend
        items={[
          { key: 'a', label: 'Plain', swatch: { kind: 'fill', color: '#4a8a1f' } },
          { key: 'b', label: 'Hatched', swatch: { kind: 'fill', color: '#4a8a1f', hatched: true } },
        ]}
      />,
    )
    const [plain, hatched] = screen.getAllByRole('listitem')
    expect(plain.querySelector('pattern')).toBeNull()
    expect(hatched.querySelector('pattern')).not.toBeNull()
  })

  it('gives two hatched swatches distinct pattern ids (no clash in one document)', () => {
    const { container } = render(
      <Legend
        items={[
          { key: 'a', label: 'One', swatch: { kind: 'fill', color: '#4a8a1f', hatched: true } },
          { key: 'b', label: 'Two', swatch: { kind: 'fill', color: '#2a78d6', hatched: true } },
        ]}
      />,
    )
    const ids = Array.from(container.querySelectorAll('pattern')).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(Boolean)).toBe(true)
  })
})

describe('EmptyState', () => {
  it('shows icon, title, body and the optional action', () => {
    const { container } = render(<EmptyState icon={Plus} title="No data yet" body="Play a day first." action={<button>Go</button>} />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
    expect(screen.getByText('Play a day first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('works without an action', () => {
    render(<EmptyState icon={Plus} title="No data yet" body="Play a day first." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('LoadingSpinner', () => {
  it('always shows a visible text label', () => {
    render(<LoadingSpinner label="Checking your sign-in" />)
    expect(screen.getByText('Checking your sign-in')).toBeVisible()
  })

  it.each([16, 24, 40] as const)('draws the spinner icon at %s px and spins it', (size) => {
    const { container } = render(<LoadingSpinner label="Loading" size={size} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', String(size))
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })
})

describe('Tooltip', () => {
  function setup() {
    vi.useFakeTimers()
    render(
      <Tooltip content="Not enough data">
        <button>—</button>
      </Tooltip>,
    )
    return screen.getByRole('button', { name: '—' })
  }

  it('is closed at rest', () => {
    setup()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on hover only after 300 ms', () => {
    const trigger = setup()
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Not enough data')
  })

  it('leaving before 300 ms cancels the open', () => {
    const trigger = setup()
    fireEvent.mouseEnter(trigger)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    fireEvent.mouseLeave(trigger)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on focus immediately', () => {
    const trigger = setup()
    act(() => {
      fireEvent.focus(trigger)
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Not enough data')
  })

  it('closes on Escape', () => {
    const trigger = setup()
    act(() => {
      fireEvent.focus(trigger)
    })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('describes the trigger by the tooltip while it is open', () => {
    const trigger = setup()
    act(() => {
      fireEvent.focus(trigger)
    })
    const id = trigger.getAttribute('aria-describedby')!
    expect(id).toBeTruthy()
    expect(document.getElementById(id)).toBe(screen.getByRole('tooltip'))
  })
})

describe('AlertContainer and InlineAlert', () => {
  const add = (kind: 'info' | 'success' | 'error', message: string) =>
    act(() => {
      useGameStore.getState().addAlert({ kind, message })
    })

  it('renders nothing visible when there are no alerts', () => {
    render(<AlertContainer />)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })

  it('renders every alert of the store, each with a Dismiss button', () => {
    render(<AlertContainer />)
    add('error', 'Could not reach the game server.')
    add('info', 'Heads up.')
    expect(screen.getByText('Could not reach the game server.')).toBeInTheDocument()
    expect(screen.getByText('Heads up.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2)
  })

  it('Dismiss removes that alert from the store and from the screen', async () => {
    render(<AlertContainer />)
    add('error', 'First problem.')
    add('error', 'Second problem.')
    let toast: HTMLElement | null = screen.getByText('First problem.')
    while (toast && within(toast).queryAllByRole('button', { name: 'Dismiss' }).length !== 1) toast = toast.parentElement
    expect(toast, 'a container holding the message and exactly one Dismiss').not.toBeNull()
    await userEvent.click(within(toast!).getByRole('button', { name: 'Dismiss' }))
    expect(useGameStore.getState().alerts).toHaveLength(1)
    expect(useGameStore.getState().alerts[0].message).toBe('Second problem.')
    expect(screen.queryByText('First problem.')).not.toBeInTheDocument()
    expect(screen.getByText('Second problem.')).toBeInTheDocument()
  })

  it.each(['info', 'success'] as const)('a %s alert dismisses itself after 5 s', (kind) => {
    vi.useFakeTimers()
    render(<AlertContainer />)
    add(kind, 'Saved.')
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(screen.getByText('Saved.')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument()
    expect(useGameStore.getState().alerts).toHaveLength(0)
  })

  it('an error alert stays until dismissed', () => {
    vi.useFakeTimers()
    render(<AlertContainer />)
    add('error', 'Stays.')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Stays.')).toBeInTheDocument()
  })

  it('does not take focus when an alert arrives', () => {
    render(<AlertContainer />)
    const before = document.activeElement
    add('error', 'Quiet.')
    expect(document.activeElement).toBe(before)
  })

  it.each(['success', 'warning', 'danger', 'info'] as const)('InlineAlert %s shows its title and body', (tone) => {
    render(
      <InlineAlert tone={tone} title="Heads up">
        Body text
      </InlineAlert>,
    )
    expect(screen.getByText('Heads up')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('InlineAlert danger is an alert, the others are status', () => {
    const { rerender } = render(<InlineAlert tone="danger">Bad</InlineAlert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Bad')
    for (const tone of ['success', 'warning', 'info'] as const) {
      rerender(<InlineAlert tone={tone}>Fine</InlineAlert>)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Fine')
    }
  })

  it('InlineAlert works without a title', () => {
    render(<InlineAlert tone="info">Only body</InlineAlert>)
    expect(screen.getByText('Only body')).toBeInTheDocument()
  })
})

describe('BackendWakeUp (criterion 11)', () => {
  it('shows the title, the body and the elapsed seconds', () => {
    h.backend.elapsedSeconds = 42
    render(<BackendWakeUp />)
    expect(screen.getByRole('heading', { level: 1, name: 'Waking up the game server' })).toBeInTheDocument()
    expect(screen.getByText('The server sleeps when nobody is playing. Waking it takes up to a minute.')).toBeInTheDocument()
    expect(screen.getByText('42 s')).toBeInTheDocument()
  })

  it('follows the counter', () => {
    h.backend.elapsedSeconds = 0
    const { rerender } = render(<BackendWakeUp />)
    expect(screen.getByText('0 s')).toBeInTheDocument()
    h.backend.elapsedSeconds = 7
    rerender(<BackendWakeUp />)
    expect(screen.getByText('7 s')).toBeInTheDocument()
    expect(screen.queryByText('0 s')).not.toBeInTheDocument()
  })

  it('draws no progress bar (the wait is unknown)', () => {
    render(<BackendWakeUp />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  const props = {
    title: 'End the game early?',
    body: <p>Players will see the results now.</p>,
    confirmLabel: 'End game',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('is a native dialog, open with its title, body and both buttons', () => {
    const { container } = render(<ConfirmDialog {...props} open />)
    const dialog = container.querySelector('dialog')!
    expect(dialog).not.toBeNull()
    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).getByRole('heading', { level: 2, name: 'End the game early?' })).toBeInTheDocument()
    expect(within(dialog).getByText('Players will see the results now.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'End game' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('is not open when open is false', () => {
    const { container } = render(<ConfirmDialog {...props} open={false} />)
    const dialog = container.querySelector('dialog')
    if (dialog) expect(dialog).not.toHaveAttribute('open')
    expect(screen.queryByRole('button', { name: 'End game' })).not.toBeInTheDocument()
  })

  it('opens and closes with the prop', () => {
    const { container, rerender } = render(<ConfirmDialog {...props} open={false} />)
    rerender(<ConfirmDialog {...props} open />)
    expect(container.querySelector('dialog')).toHaveAttribute('open')
    rerender(<ConfirmDialog {...props} open={false} />)
    expect(container.querySelector('dialog')?.hasAttribute('open') ?? false).toBe(false)
  })

  it('uses a custom cancel label', () => {
    render(<ConfirmDialog {...props} open cancelLabel="Keep playing" />)
    expect(screen.getByRole('button', { name: 'Keep playing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('Cancel has the focus when it opens', () => {
    render(<ConfirmDialog {...props} open />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('Confirm calls onConfirm only, Cancel calls onCancel only', async () => {
    props.onConfirm.mockClear()
    props.onCancel.mockClear()
    render(<ConfirmDialog {...props} open />)
    await userEvent.click(screen.getByRole('button', { name: 'End game' }))
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onCancel).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledTimes(1)
    expect(props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Escape calls onCancel once', () => {
    props.onCancel.mockClear()
    const { container } = render(<ConfirmDialog {...props} open />)
    fireEvent.keyDown(container.querySelector('dialog')!, { key: 'Escape' })
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('the native cancel event counts as Cancel too', () => {
    props.onCancel.mockClear()
    const { container } = render(<ConfirmDialog {...props} open />)
    fireEvent(container.querySelector('dialog')!, new Event('cancel', { cancelable: true }))
    expect(props.onCancel).toHaveBeenCalled()
  })

  it('a click on the backdrop (the dialog itself) calls onCancel; a click inside does not', () => {
    props.onCancel.mockClear()
    const { container } = render(<ConfirmDialog {...props} open />)
    fireEvent.click(screen.getByText('Players will see the results now.'))
    fireEvent.click(screen.getByRole('heading', { name: 'End the game early?' }))
    expect(props.onCancel).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('dialog')!)
    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('the confirm button is the solid destructive one', () => {
    render(<ConfirmDialog {...props} open />)
    expect(screen.getByRole('button', { name: 'End game' })).toHaveClass('bg-danger')
  })
})

describe('ChartBox', () => {
  const box = (extra: Partial<React.ComponentProps<typeof ChartBox>> = {}) => (
    <ChartBox
      title="Spot price"
      caption="Days 1 to 5"
      ariaLabel="Line chart of the spot price per day"
      height={240}
      legend={<ul data-testid="legend"><li>Spot</li></ul>}
      table={<table data-testid="the-table"><tbody><tr><td>13.40</td></tr></tbody></table>}
      {...extra}
    >
      <canvas data-testid="the-canvas" />
    </ChartBox>
  )

  it('is a figure with a figcaption holding the title and the caption', () => {
    const { container } = render(box())
    const figure = screen.getByRole('figure')
    const cap = container.querySelector('figcaption')!
    expect(figure).toContainElement(cap)
    expect(cap).toHaveTextContent('Spot price')
    expect(cap).toHaveTextContent('Days 1 to 5')
  })

  it('the chart container is an image with the aria-label', () => {
    render(box())
    const img = screen.getByRole('img', { name: 'Line chart of the spot price per day' })
    expect(img).toContainElement(screen.getByTestId('the-canvas'))
  })

  it('starts on the chart: the toggle says Show table, aria-pressed false, and the table is absent', () => {
    render(box())
    const toggle = screen.getByRole('button', { name: 'Show table' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('the-table')).not.toBeInTheDocument()
    expect(screen.getByTestId('the-canvas')).toBeInTheDocument()
  })

  it('toggling swaps the plot for the table, says Show chart, aria-pressed true, keeps the legend', async () => {
    render(box())
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const toggle = screen.getByRole('button', { name: 'Show chart' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('the-table')).toBeInTheDocument()
    expect(screen.queryByTestId('the-canvas')).not.toBeInTheDocument()
    expect(screen.getByTestId('legend')).toBeInTheDocument()

    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show table' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('the-canvas')).toBeInTheDocument()
    expect(screen.queryByTestId('the-table')).not.toBeInTheDocument()
  })

  it('fixes the plot height so the page does not jump', () => {
    render(box({ height: 280 }))
    const img = screen.getByRole('img')
    const h0 = (img.closest('[style*="height"]') as HTMLElement | null)?.style.height ?? ''
    const px = h0.endsWith('rem') ? parseFloat(h0) * 16 : parseFloat(h0)
    expect(px).toBe(280)
  })

  it('works without a caption or a legend', () => {
    render(box({ caption: undefined, legend: undefined }))
    expect(screen.getByRole('figure')).toBeInTheDocument()
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
  })
})

describe('AppHeader', () => {
  const renderHeader = (context?: ReactNode) =>
    render(
      <MemoryRouter>
        <AppHeader context={context} />
      </MemoryRouter>,
    )

  it('shows the brand and the route context', () => {
    renderHeader(<span>Room KQ7M2P</span>)
    expect(screen.getByText('Pulky')).toBeInTheDocument()
    expect(screen.getByText('Room KQ7M2P')).toBeInTheDocument()
  })

  it('has an Account button that opens a menu with Profile and Sign out', async () => {
    renderHeader()
    const account = screen.getByRole('button', { name: 'Account' })
    expect(account).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument()
    await userEvent.click(account)
    expect(screen.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Profile').closest('a')).toHaveAttribute('href', '/profile')
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('Sign out calls signOut', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    await userEvent.click(screen.getByText('Sign out'))
    expect(h.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('a guest sees the label Guest and the guest icon, and no Profile link', async () => {
    h.auth.mode = 'guest'
    h.auth.user = null
    const { container } = renderHeader()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-user-round')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('a Google avatar sends no referrer and falls back to the initial when the image fails', () => {
    h.auth.user = { displayName: 'ana perez', email: 'ana@example.com', photoURL: 'https://lh3.googleusercontent.com/a/x' }
    const { container } = renderHeader()
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(img).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/x')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('a signed-in user with no photo shows the initial', () => {
    const { container } = renderHeader()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
