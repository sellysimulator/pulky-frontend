/** Section 28 — EndEarlyControl (plan 28 §3.8). Acceptance 9; failure mode 5. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import EndEarlyControl from '../components/host/EndEarlyControl'

const TITLE = 'End the game for everyone?'
const BODY = 'The game ends now for every pulquería and their stock is settled. This cannot be undone.'

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'End game early' })

describe('EndEarlyControl', () => {
  it('renders the End game early button and no dialog content until it is pressed', () => {
    render(<EndEarlyControl onConfirm={() => {}} />)
    expect(trigger()).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'End game' })).toBeNull()
  })

  it('failure mode 5: pressing End game early alone does not call onConfirm', () => {
    const onConfirm = vi.fn()
    render(<EndEarlyControl onConfirm={onConfirm} />)
    fireEvent.click(trigger())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('opens a confirm dialog with the specified title, body and buttons', () => {
    render(<EndEarlyControl onConfirm={() => {}} />)
    fireEvent.click(trigger())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(TITLE)).toBeInTheDocument()
    expect(within(dialog).getByText(BODY)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'End game' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('confirming calls onConfirm exactly once', () => {
    const onConfirm = vi.fn()
    render(<EndEarlyControl onConfirm={onConfirm} />)
    fireEvent.click(trigger())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End game' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancelling calls nothing and closes the dialog', () => {
    const onConfirm = vi.fn()
    render(<EndEarlyControl onConfirm={onConfirm} />)
    fireEvent.click(trigger())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a cancelled dialog can be reopened and confirmed once', () => {
    const onConfirm = vi.fn()
    render(<EndEarlyControl onConfirm={onConfirm} />)
    fireEvent.click(trigger())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(trigger())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End game' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disabled disables the trigger so no dialog can open', () => {
    const onConfirm = vi.fn()
    render(<EndEarlyControl onConfirm={onConfirm} disabled />)
    expect(trigger()).toBeDisabled()
    fireEvent.click(trigger())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
