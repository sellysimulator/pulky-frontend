/** BoardViewToggle (spec §13.11.2; design.md §14.4). */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BoardViewToggle from '../components/game/views/BoardViewToggle'
import { PHONE_VIEWPORT } from '../components/game/views/board3d/phoneViewport'

const REASON = 'Your browser cannot draw 3D graphics.'

describe('BoardViewToggle', () => {
  it('is a Board view group with two buttons, pressed by value', () => {
    render(<BoardViewToggle value="2D" support={{ ok: true }} onChange={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Board view' })
    const buttons = group.querySelectorAll('button')
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(['2D', '3D'])
    expect(screen.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks 3D pressed when the value is 3D', () => {
    render(<BoardViewToggle value="3D" support={{ ok: true }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the other view when the unpressed button is clicked', () => {
    const onChange = vi.fn()
    render(<BoardViewToggle value="2D" support={{ ok: true }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('3D')
  })

  it('does not call onChange for the pressed button', () => {
    const onChange = vi.fn()
    render(<BoardViewToggle value="2D" support={{ ok: true }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '2D' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows no InfoTip when 3D is supported', () => {
    render(<BoardViewToggle value="2D" support={{ ok: true }} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'About 3D view' })).toBeNull()
  })

  it('unsupported disables 3D and says why in an InfoTip, never hiding it', () => {
    const onChange = vi.fn()
    render(<BoardViewToggle value="2D" support={{ ok: false, reason: REASON }} onChange={onChange} />)
    const three = screen.getByRole('button', { name: '3D' })
    expect(three).toBeDisabled()
    fireEvent.click(three)
    expect(onChange).not.toHaveBeenCalled()
    const tip = screen.getByRole('button', { name: 'About 3D view' })
    fireEvent.focus(tip)
    expect(screen.getByRole('tooltip')).toHaveTextContent(REASON)
  })

  it('keeps 2D usable when 3D is unsupported', () => {
    render(<BoardViewToggle value="3D" support={{ ok: false, reason: REASON }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '2D' })).toBeEnabled()
  })
})

describe('on a phone', () => {
  const media = (...matching: string[]): void => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
  }
  const group = () => screen.queryByRole('group', { name: 'Board view' })

  afterEach(() => vi.unstubAllGlobals())

  it('is one round 2D button in 3D, named for the 2D board, that goes back to it', () => {
    media('(any-pointer: coarse)', PHONE_VIEWPORT)
    const onChange = vi.fn()
    render(<BoardViewToggle value="3D" support={{ ok: true }} onChange={onChange} />)
    expect(group()).toBeNull()
    const button = screen.getByRole('button')
    expect(button.textContent).toBe('2D')
    expect(button).toHaveAccessibleName('Switch to the 2D board')
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2D')
  })

  it('the 2D button is fixed over the scene, inside the safe area, and steps aside for a panel on its side', () => {
    media('(any-pointer: coarse)', PHONE_VIEWPORT)
    render(<BoardViewToggle value="3D" support={{ ok: true }} onChange={vi.fn()} />)
    const { className } = screen.getByRole('button')
    expect(className).toMatch(/\bfixed\b/)
    expect(className).toMatch(/\bz-50\b/)
    expect(className).toContain('env(safe-area-inset-top)')
    expect(className).toContain('env(safe-area-inset-right)')
    expect(className).toContain('landscape:[body:has([data-phone-panel])_&]:hidden')
  })

  it('is the segmented control on the 2D board, and where 3D is stored but unavailable', () => {
    media('(any-pointer: coarse)', PHONE_VIEWPORT)
    const { rerender } = render(<BoardViewToggle value="2D" support={{ ok: true }} onChange={vi.fn()} />)
    expect(group()).not.toBeNull()
    rerender(<BoardViewToggle value="3D" support={{ ok: false, reason: REASON }} onChange={vi.fn()} />)
    expect(group()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'About 3D view' })).toBeInTheDocument()
  })

  it('a laptop with a touch screen, and a tablet, keep the segmented control in 3D', () => {
    media('(any-pointer: coarse)')
    render(<BoardViewToggle value="3D" support={{ ok: true }} onChange={vi.fn()} />)
    expect(group()).not.toBeNull()
  })
})
