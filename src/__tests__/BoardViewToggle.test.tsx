/** Section 32 - BoardViewToggle (plan 32 section 3.3; acceptance 3; failure mode 3). */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BoardViewToggle from '../components/game/views/BoardViewToggle'

const REASON = 'The 3D pulquería needs a window at least 1,024 pixels wide.'

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

  it('failure mode 3: unsupported disables 3D and says why in an InfoTip, never hiding it', () => {
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
