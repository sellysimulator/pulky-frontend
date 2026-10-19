/** Section 32 - SceneHud (plan 32 section 3.6; acceptance 7). */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SceneHud from '../components/game/views/board3d/SceneHud'
import { PANEL_ORDER, PANEL_TITLES, type PanelId } from '../components/game/views/board3d/sceneLayout'
import { formatMoney, weekdayLong } from '../utils/format'
import type { PlayerView } from '../types/game'
import { baseProps } from './fixtures/sceneProps'

const DISRUPTION = 'Day 5 (Friday): supplier capacity cut to 40%'

function setup(over: Partial<Parameters<typeof SceneHud>[0]> = {}, mutate?: (view: PlayerView) => void) {
  const p = baseProps()
  mutate?.(p.view)
  const onPanelButton = vi.fn()
  const utils = render(
    <SceneHud
      view={p.view}
      participants={p.participants}
      awaiting={[]}
      openPanel={null}
      onPanelButton={onPanelButton}
      prompt={null}
      drawer={<p>drawer content</p>}
      {...over}
    />,
  )
  return { p, onPanelButton, ...utils }
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
