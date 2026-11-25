/** SceneHud (spec §13.11.7; design.md §14.4). */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { act, useState, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SceneHud from '../components/game/views/board3d/SceneHud'
import { PHONE_VIEWPORT } from '../components/game/views/board3d/phoneViewport'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from '../components/game/views/board3d/sceneLayout'
import { formatMoney, weekdayLong, weekdayShort } from '../utils/format'
import type { PlayerView } from '../types/game'
import { baseProps } from './fixtures/sceneProps'

const DISRUPTION = 'Day 5 (Friday): supplier capacity cut to 40%'

function setup(over: Partial<Parameters<typeof SceneHud>[0]> = {}, mutate?: (view: PlayerView) => void) {
  const p = baseProps()
  mutate?.(p.view)
  const onPanelButton = vi.fn()
  const onInteract = vi.fn()
  const onMove = vi.fn()
  const utils = render(
    <SceneHud
      view={p.view}
      participants={p.participants}
      awaiting={[]}
      openPanel={null}
      onPanelButton={onPanelButton}
      prompt={null}
      onInteract={onInteract}
      onMove={onMove}
      drawer={<p>drawer content</p>}
      {...over}
    />,
  )
  return { p, onPanelButton, onInteract, onMove, ...utils }
}

const text = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')

describe('day strip', () => {
  it('shows the day, the weekday and the cash', () => {
    const { p } = setup()
    expect(text()).toContain(`Day ${p.view.day}/${p.view.duration_days} · ${weekdayLong(p.view.weekday)}`)
    expect(text()).toContain(`Cash ${formatMoney(p.view.cash)}`)
  })

  it('names who is awaited, or says everyone has submitted', () => {
    setup({ awaiting: ['P2'] })
    expect(screen.getByText('Waiting for: Zacatecas Rival')).toBeInTheDocument()
    expect(screen.queryByText('Everyone has submitted.')).toBeNull()
  })

  it('says everyone has submitted when nobody is awaited', () => {
    setup()
    expect(screen.getByText('Everyone has submitted.')).toBeInTheDocument()
  })
})

describe('notices', () => {
  it('shows the disruption message verbatim and the Shared transport badge', () => {
    setup({}, (view) => {
      const brief = view.brief as unknown as { supplier: { disruption_message: string | null }; transport: { shared: boolean } }
      brief.supplier.disruption_message = DISRUPTION
      brief.transport.shared = true
    })
    expect(screen.getByText(DISRUPTION)).toBeInTheDocument()
    expect(screen.getByText('Shared transport')).toBeInTheDocument()
  })

  it('shows neither when there is nothing to say', () => {
    setup()
    expect(screen.queryByText(DISRUPTION)).toBeNull()
    expect(screen.queryByText('Shared transport')).toBeNull()
  })

  it('survives a view without a brief', () => {
    setup({}, (view) => {
      ;(view as unknown as { brief: null }).brief = null
    })
    expect(screen.queryByText('Shared transport')).toBeNull()
  })
})

describe('panel bar', () => {
  it('has one button per panel, in PANEL_ORDER, labelled by title', () => {
    setup()
    const bar = screen.getByRole('group', { name: 'Panels' })
    const buttons = within(bar).getAllByRole('button')
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(PANEL_ORDER.map((id) => PANEL_TITLES[id]))
    expect(PANEL_ORDER.map((id) => PANEL_TITLES[id])).toEqual([
      'Day stats',
      'Yesterday',
      "Today's decision",
      'Your cellar',
      'Market',
      'Details',
    ])
  })

  it('marks the open panel pressed and controls the drawer wrapper', () => {
    setup({ openPanel: 'market' })
    for (const id of PANEL_ORDER) {
      const button = screen.getByRole('button', { name: PANEL_TITLES[id] })
      expect(button).toHaveAttribute('aria-pressed', String(id === 'market'))
      expect(button).toHaveAttribute('aria-controls', `scene-panel-${id}`)
    }
  })

  it('presses nothing when no panel is open', () => {
    setup()
    for (const b of within(screen.getByRole('group', { name: 'Panels' })).getAllByRole('button')) {
      expect(b).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it.each(PANEL_ORDER as readonly PanelId[])('clicking %s reports the id and the button element', (id) => {
    const { onPanelButton } = setup()
    const button = screen.getByRole('button', { name: PANEL_TITLES[id] })
    fireEvent.click(button)
    expect(onPanelButton).toHaveBeenCalledExactlyOnceWith(id, button)
  })
})

describe('drawer, legend, credits', () => {
  it('renders the drawer prop', () => {
    setup()
    expect(screen.getByText('drawer content')).toBeInTheDocument()
  })

  it('prints the three legend lines with the key names in kbd', () => {
    setup()
    expect(text()).toContain('W A S D or arrow keys: walk')
    expect(text()).toContain('Drag: look around')
    expect(text()).toContain('E: open · Esc: close')
    const keys = Array.from(document.querySelectorAll('kbd')).map((k) => k.textContent)
    expect(keys).toEqual(expect.arrayContaining(['E']))
    expect(keys.length).toBeGreaterThanOrEqual(3)
  })

  it('shows the model credits disclosure', () => {
    setup()
    expect(screen.getByText('3D model credits').closest('details')).not.toBeNull()
  })
})

describe('prompt', () => {
  const region = () => document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement | null

  it('is a polite status region that is in the DOM even when empty', () => {
    setup()
    expect(region()).not.toBeNull()
    expect(region()?.textContent?.trim()).toBe('')
  })

  it('reads Press E and the panel title while a station is near', () => {
    setup({ prompt: 'Your cellar' })
    expect(region()?.textContent).toBe('Press E · Your cellar')
  })

  it('shows nothing while a panel is open', () => {
    setup({ prompt: 'Your cellar', openPanel: 'cellar' })
    expect(text()).not.toContain('Press E')
  })
})

describe('crosshair', () => {
  const dot = () => document.querySelector('span[aria-hidden="true"].rounded-full') as HTMLElement | null
  const layer = () => dot()?.parentElement?.parentElement as HTMLElement

  it('is a semi-transparent black dot with no ring', () => {
    setup()
    expect(dot()).not.toBeNull()
    expect(dot()?.classList.contains('bg-black/50')).toBe(true)
    expect(Array.from(dot()?.classList ?? []).some((c) => c.startsWith('ring-'))).toBe(false)
  })

  it('sits in a layer spanning the whole grid so it is centred on the board area', () => {
    setup()
    for (const c of ['col-span-full', 'row-span-full', 'place-items-center']) {
      expect(layer().classList.contains(c)).toBe(true)
    }
    expect(layer().classList.contains('col-start-2')).toBe(false)
  })

  it('keeps the status region inside that layer', () => {
    setup()
    expect(layer().contains(document.querySelector('[role="status"][aria-live="polite"]'))).toBe(true)
  })

  it('is absent while a panel is open', () => {
    setup({ openPanel: 'cellar' })
    expect(dot()).toBeNull()
  })
})

/** A matchMedia whose `(any-pointer: coarse)` answer the test sets and can change. */
function coarse(initial: boolean) {
  const original = window.matchMedia
  const listeners = new Set<() => void>()
  const state = { matches: initial }
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === '(any-pointer: coarse)' ? state.matches : false
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia
  return {
    set(next: boolean) {
      state.matches = next
      act(() => listeners.forEach((fn) => fn()))
    },
    listeners,
    restore: () => {
      window.matchMedia = original
    },
  }
}

describe('touch screens (any-pointer: coarse)', () => {
  let media: ReturnType<typeof coarse> | null = null
  afterEach(() => {
    media?.restore()
    media = null
  })

  it('without a coarse pointer: no movement pad, the Press E prompt and the keyboard legend', () => {
    media = coarse(false)
    setup({ prompt: 'Your cellar' })
    expect(screen.queryByRole('group', { name: 'Movement controls' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open Your cellar' })).toBeNull()
    expect(text()).toContain('Press E · Your cellar')
    expect(text()).toContain('W A S D or arrow keys: walk')
  })

  it('shows the six-button movement pad, in pad order', () => {
    media = coarse(true)
    setup()
    const pad = screen.getByRole('group', { name: 'Movement controls' })
    expect(within(pad).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Turn left',
      'Move forward',
      'Turn right',
      'Move left',
      'Move backward',
      'Move right',
    ])
  })

  it('reports pad presses and releases through onMove', () => {
    media = coarse(true)
    const { onMove } = setup()
    const forward = screen.getByRole('button', { name: 'Move forward' })
    forward.setPointerCapture = vi.fn()
    fireEvent.pointerDown(forward, { pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith('forward', true)
    fireEvent.pointerUp(forward, { pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith('forward', false)
  })

  it('replaces Press E with a button that opens the station in reach', () => {
    media = coarse(true)
    const { onInteract } = setup({ prompt: 'Your cellar' })
    expect(text()).not.toContain('Press E')
    const button = screen.getByRole('button', { name: 'Open Your cellar' })
    expect(document.querySelector('[role="status"][aria-live="polite"]')?.contains(button)).toBe(true)
    fireEvent.click(button)
    expect(onInteract).toHaveBeenCalledOnce()
  })

  it('has no interact button while nothing is in reach or a panel is open', () => {
    media = coarse(true)
    const { rerender, p } = setup()
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
    rerender(
      <SceneHud
        view={p.view}
        participants={p.participants}
        awaiting={[]}
        openPanel="cellar"
        onPanelButton={vi.fn()}
        prompt="Your cellar"
        onInteract={vi.fn()}
        onMove={vi.fn()}
        drawer={null}
      />,
    )
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
  })

  it('hides the pad while a panel is open', () => {
    media = coarse(true)
    const { onMove } = setup({ openPanel: 'market' })
    expect(screen.queryByRole('group', { name: 'Movement controls' })).toBeNull()
    expect(onMove).not.toHaveBeenCalledWith(expect.anything(), true)
  })

  it('speaks of taps in the legend instead of keys', () => {
    media = coarse(true)
    setup()
    expect(text()).toContain('Arrow buttons: walk and turn')
    expect(text()).toContain('Drag: look around')
    expect(text()).toContain('Open: the station you stand at')
    expect(text()).not.toContain('W A S D')
    expect(document.querySelectorAll('kbd')).toHaveLength(0)
  })

  it('follows a change of the media query, and releases the pad when it goes', () => {
    media = coarse(false)
    const { onMove } = setup()
    expect(screen.queryByRole('group', { name: 'Movement controls' })).toBeNull()
    media.set(true)
    expect(screen.getByRole('group', { name: 'Movement controls' })).toBeInTheDocument()
    media.set(false)
    expect(screen.queryByRole('group', { name: 'Movement controls' })).toBeNull()
    expect(onMove).toHaveBeenCalledWith('forward', false)
    expect(onMove).toHaveBeenCalledWith('turnLeft', false)
  })

  it('keeps 44-pixel panel buttons on touch and icon-only labels below sm', () => {
    media = coarse(true)
    setup()
    for (const b of within(screen.getByRole('group', { name: 'Panels' })).getAllByRole('button')) {
      expect(b.className).toContain('any-pointer-coarse:h-11')
      expect(b.querySelector('span')?.className).toContain('max-sm:sr-only')
    }
  })
})

describe('small screens', () => {
  it('stacks into one column below lg and keeps three columns from lg', () => {
    setup()
    const root = screen.getByRole('group', { name: 'Panels' }).parentElement as HTMLElement
    expect(root.classList.contains('grid-cols-1')).toBe(true)
    expect(root.className).toContain('lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_minmax(0,40rem)]')
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      expect(root.className).toContain(`max(0.75rem,env(safe-area-inset-${edge}))`)
    }
  })

  it('gives the drawer the bottom row below lg while a panel is open', () => {
    setup({ openPanel: 'market' })
    const legend = screen.getByText('Drag: look around').closest('.row-start-4') as HTMLElement
    expect(legend.classList.contains('max-lg:hidden')).toBe(true)
  })

  it('keeps the bottom row while no panel is open', () => {
    setup()
    const legend = screen.getByText('Drag: look around').closest('.row-start-4') as HTMLElement
    expect(legend.classList.contains('max-lg:hidden')).toBe(false)
  })
})

/** A matchMedia that matches the given queries, which a test can swap. */
function media(...matching: string[]) {
  const listeners = new Set<() => void>()
  let current = matching
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return current.includes(query)
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }))
  return {
    set(...next: string[]) {
      current = next
      act(() => listeners.forEach((fn) => fn()))
    },
  }
}

const TOUCH = '(any-pointer: coarse)'
const DOCK: readonly PanelId[] = ['decision', 'day-stats', 'yesterday', 'cellar', 'market', 'details']
const HELP = [
  '3D mode may not be very well optimized for phones.',
  'Joystick: walk',
  'Drag: look around',
  'Icons: open everything',
  'Tap to hide',
]

describe('a phone (§13.11.7)', () => {
  afterEach(() => vi.unstubAllGlobals())

  const phone = (...args: Parameters<typeof setup>) => {
    media(TOUCH, PHONE_VIEWPORT)
    return setup(...args)
  }
  const dock = () => screen.getByRole('navigation', { name: 'Panels' })
  const joystick = () => screen.queryByRole('group', { name: 'Movement joystick' })
  const help = () => screen.queryByRole('button', { name: /Tap to hide/ })
  const helpToggle = () => screen.getByRole('button', { name: /the 3D controls$/ })
  const dot = () => document.querySelector('span[aria-hidden="true"].bg-black\\/50')
  const live = () => document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement

  it('asks for touch as the main pointer in both orientations, so no desktop window is a phone', () => {
    const branches = PHONE_VIEWPORT.split(',')
    expect(branches).toHaveLength(2)
    for (const branch of branches) expect(branch).toContain('(pointer: coarse)')
    expect(branches[0]).toContain('max-width')
    expect(branches[1]).toContain('max-height')
  })

  it('is told the day, the short weekday and the cash in one pill, and nothing about who is awaited', () => {
    const { p } = phone({ awaiting: ['P2'] })
    expect(text()).toContain(
      `Day ${p.view.day}/${p.view.duration_days} · ${weekdayShort(p.view.weekday)} · ${formatMoney(p.view.cash)}`,
    )
    expect(text()).not.toContain(weekdayLong(p.view.weekday))
    expect(text()).not.toContain('Waiting for')
  })

  it('does not say everyone has submitted either', () => {
    phone()
    expect(text()).not.toContain('Everyone has submitted.')
  })

  it('keeps the disruption message and the Shared transport badge', () => {
    phone({}, (view) => {
      const brief = view.brief as unknown as { supplier: { disruption_message: string | null }; transport: { shared: boolean } }
      brief.supplier.disruption_message = DISRUPTION
      brief.transport.shared = true
    })
    expect(screen.getByText(DISRUPTION)).toBeInTheDocument()
    expect(screen.getByText('Shared transport')).toBeInTheDocument()
  })

  it('docks every panel as an icon with no visible text, the decision first', () => {
    phone()
    const buttons = within(dock()).getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(DOCK.map((id) => PANEL_TITLES[id]))
    for (const b of buttons) {
      expect(b.textContent).toBe('')
      expect(b.querySelector('svg')).not.toBeNull()
      expect(b).toHaveAttribute('title', b.getAttribute('aria-label'))
    }
    expect(screen.queryByRole('group', { name: 'Panels' })).toBeNull()
  })

  it('fills only the decision with the accent', () => {
    phone()
    const filled = within(dock()).getAllByRole('button').filter((b) => b.classList.contains('bg-accent'))
    expect(filled.map((b) => b.getAttribute('aria-label'))).toEqual([PANEL_TITLES.decision])
  })

  it.each(DOCK)('the dock opens %s', (id) => {
    const { onPanelButton } = phone()
    const button = within(dock()).getByRole('button', { name: PANEL_TITLES[id] })
    fireEvent.click(button)
    expect(onPanelButton).toHaveBeenCalledExactlyOnceWith(id, button)
  })

  it('marks the open panel pressed in the dock and controls its wrapper', () => {
    phone({ openPanel: 'market' })
    for (const id of DOCK) {
      const button = within(dock()).getByRole('button', { name: PANEL_TITLES[id] })
      expect(button).toHaveAttribute('aria-pressed', String(id === 'market'))
      expect(button).toHaveAttribute('aria-controls', `scene-panel-${id}`)
    }
  })

  it('opens with the help card: the warning, the three lines, the manual in a new tab and the credits', () => {
    phone()
    const card = help()?.parentElement as HTMLElement
    for (const line of HELP) expect(card).toHaveTextContent(line)
    const manual = within(card).getByRole('link', { name: 'Player manual' })
    expect(manual).toHaveAttribute('href', '/player-manual')
    expect(manual).toHaveAttribute('target', '_blank')
    expect(manual).toHaveAttribute('rel', 'noopener')
    expect(within(card).getByText('3D model credits').tagName).toBe('SUMMARY')
  })

  it('has no credits button, manual link or legend outside the help card', () => {
    phone()
    fireEvent.click(help() as HTMLElement)
    expect(help()).toBeNull()
    expect(screen.queryByText('3D model credits')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Player manual' })).toBeNull()
    for (const line of HELP) expect(text()).not.toContain(line)
  })

  it('the "?" button folds the card and opens it again', () => {
    phone()
    expect(helpToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(helpToggle()).toHaveAccessibleName('Hide the 3D controls')
    fireEvent.click(helpToggle())
    expect(help()).toBeNull()
    expect(helpToggle()).toHaveAttribute('aria-expanded', 'false')
    expect(helpToggle()).toHaveAccessibleName('Show the 3D controls')
    fireEvent.click(helpToggle())
    expect(help()).not.toBeNull()
  })

  it('stays folded when the board mounts again in this tab', () => {
    const { unmount } = phone()
    fireEvent.click(help() as HTMLElement)
    unmount()
    const second = setup()
    expect(help()).toBeNull()
    fireEvent.click(helpToggle())
    second.unmount()
    setup()
    expect(help()).not.toBeNull()
  })

  it('walks with a joystick, not the pad, through onMove', () => {
    const { onMove } = phone()
    expect(screen.queryByRole('group', { name: 'Movement controls' })).toBeNull()
    const stick = joystick() as HTMLElement
    stick.getBoundingClientRect = () => new DOMRect(0, 0, 112, 112)
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 56, clientY: 10 })
    expect(onMove).toHaveBeenLastCalledWith('forward', true)
    fireEvent.pointerUp(stick, { pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith('forward', false)
  })

  it('offers a round Open button, named for the panel, while a station is in reach', () => {
    const { onInteract } = phone({ prompt: 'Your cellar' })
    const button = screen.getByRole('button', { name: 'Open Your cellar' })
    expect(button.textContent).toBe('Open')
    expect(live().contains(button)).toBe(true)
    expect(text()).not.toContain('Press E')
    fireEvent.click(button)
    expect(onInteract).toHaveBeenCalledOnce()
  })

  it('keeps the polite region in the DOM with nothing in reach', () => {
    phone()
    expect(live().textContent).toBe('')
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
  })

  it('an open panel takes the "?", the card, the dot, the joystick and Open away, and lets go of the joystick', () => {
    const { onMove, rerender, p } = phone({ prompt: 'Your cellar' })
    expect(dot()).not.toBeNull()
    const stick = joystick() as HTMLElement
    stick.getBoundingClientRect = () => new DOMRect(0, 0, 112, 112)
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 56, clientY: 100 })
    expect(onMove).toHaveBeenLastCalledWith('back', true)
    rerender(
      <SceneHud
        view={p.view}
        participants={p.participants}
        awaiting={[]}
        openPanel="cellar"
        onPanelButton={vi.fn()}
        prompt="Your cellar"
        onInteract={vi.fn()}
        onMove={onMove}
        drawer={null}
      />,
    )
    expect(onMove).toHaveBeenLastCalledWith('back', false)
    expect(screen.queryByRole('button', { name: /the 3D controls$/ })).toBeNull()
    expect(help()).toBeNull()
    expect(dot()).toBeNull()
    expect(joystick()).toBeNull()
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
    expect(within(dock()).getAllByRole('button')).toHaveLength(DOCK.length)
  })

  it('a phone on its side also hides the pill while a panel fills its height', () => {
    const pill = (p: { view: PlayerView }) => screen.getByText(new RegExp(`^Day ${p.view.day}/`))
    const closed = phone()
    expect(pill(closed.p)).not.toHaveClass('landscape:hidden')
    closed.unmount()
    expect(pill(phone({ openPanel: 'market' }).p)).toHaveClass('landscape:hidden')
  })

  it('keeps the drawer mounted when a small tablet turns from a phone into none and back', () => {
    const screenMedia = media(TOUCH, PHONE_VIEWPORT)
    function Draft(): ReactElement {
      const [value, setValue] = useState('')
      return <input aria-label="draft" value={value} onChange={(e) => setValue(e.target.value)} />
    }
    setup({ drawer: <Draft /> })
    const field = screen.getByLabelText('draft')
    fireEvent.change(field, { target: { value: '40' } })
    screenMedia.set(TOUCH)
    expect(screen.getByRole('group', { name: 'Panels' })).toBeInTheDocument()
    expect(screen.getByLabelText('draft')).toBe(field)
    screenMedia.set(TOUCH, PHONE_VIEWPORT)
    expect(screen.getByLabelText('draft')).toBe(field)
    expect(field).toHaveValue('40')
  })

  it.each([
    ['a desktop', [] as string[]],
    ['a laptop with a touch screen, or a tablet', [TOUCH]],
  ])('%s keeps the panel bar, the legend, the waiting line and the credits', (_, queries) => {
    media(...queries)
    setup({ awaiting: ['P2'] })
    expect(within(screen.getByRole('group', { name: 'Panels' })).getAllByRole('button')).toHaveLength(PANEL_ORDER.length)
    expect(screen.queryByRole('navigation', { name: 'Panels' })).toBeNull()
    expect(screen.getByText('Drag: look around').closest('button')).toBeNull()
    expect(screen.getByText('Waiting for: Zacatecas Rival')).toBeInTheDocument()
    expect(screen.getByText('3D model credits')).toBeInTheDocument()
    expect(joystick()).toBeNull()
    expect(text()).not.toContain('optimized for phones')
    expect(screen.queryByRole('group', { name: 'Movement controls' }) === null).toBe(queries.length === 0)
  })
})
