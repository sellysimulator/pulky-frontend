/** Section 23 — StartControl (spec 23 §3.4). Acceptance criteria 3, 8; failure mode 1. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import StartControl from '../components/lobby/StartControl'

describe('StartControl', () => {
  it('is disabled when canStart is false, shows the reason verbatim and does nothing on click', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<StartControl canStart={false} startBlockedReason="Waiting for at least 2 players." onStart={onStart} />)
    const button = screen.getByRole('button', { name: 'Start game' })
    expect(button).toBeDisabled()
    expect(screen.getByText('Waiting for at least 2 players.')).toBeVisible()
    await user.click(button)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('shows the reason directly above the button', () => {
    render(<StartControl canStart={false} startBlockedReason="Reason X" onStart={vi.fn()} />)
    const reason = screen.getByText('Reason X')
    const button = screen.getByRole('button', { name: 'Start game' })
    expect(reason.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is enabled when canStart is true, full width and primary, and calls onStart', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<StartControl canStart startBlockedReason={null} onStart={onStart} />)
    const button = screen.getByRole('button', { name: 'Start game' })
    expect(button).toBeEnabled()
    expect(button).toHaveClass('w-full')
    expect(button).toHaveClass('bg-accent')
    await user.click(button)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('shows no alert when canStart is false and the reason is null', () => {
    render(<StartControl canStart={false} startBlockedReason={null} onStart={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not show a stale reason once canStart is true', () => {
    render(<StartControl canStart startBlockedReason="Old reason" onStart={vi.fn()} />)
    expect(screen.queryByText('Old reason')).toBeNull()
  })

  it('does not decide eligibility itself: canStart false stays disabled whatever else holds (failure mode 1)', () => {
    render(<StartControl canStart={false} startBlockedReason={null} onStart={vi.fn()} pending={false} />)
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled()
  })

  it('shows the loading state while pending', () => {
    render(<StartControl canStart startBlockedReason={null} onStart={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: 'Start game' })).toHaveAttribute('aria-busy', 'true')
  })
})
