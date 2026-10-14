/** Section 23 — NameForm (spec 23 §3.3). Acceptance criterion 8. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import NameForm from '../components/lobby/NameForm'
import { LIMITS } from '../types/game'
import { setDisplayName } from '../utils/storage'

describe('NameForm', () => {
  it('has the labelled input with the limit and placeholder, and the primary button', () => {
    render(<NameForm onSubmit={vi.fn()} />)
    const input = screen.getByLabelText("Your pulquería's name")
    expect(input).toHaveAttribute('maxlength', String(LIMITS.MAX_DISPLAY_NAME))
    expect(input).toHaveAttribute('placeholder', 'Pulquería P1')
    expect(screen.getByRole('button', { name: 'Take a seat' })).toHaveClass('bg-accent')
  })

  it('is prefilled with the stored display name', () => {
    setDisplayName('Don Agave')
    render(<NameForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText("Your pulquería's name")).toHaveValue('Don Agave')
  })

  it('is empty when nothing is stored', () => {
    render(<NameForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText("Your pulquería's name")).toHaveValue('')
  })

  it('submits the typed name', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<NameForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText("Your pulquería's name"), 'La Chula')
    await user.click(screen.getByRole('button', { name: 'Take a seat' }))
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('La Chula')
  })

  it('submits on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<NameForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText("Your pulquería's name"), 'La Chula{Enter}')
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('La Chula')
  })

  it('allows an empty name and calls onSubmit with an empty string', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<NameForm onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Take a seat' }))
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('')
  })

  it('shows the loading state while pending and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<NameForm onSubmit={onSubmit} pending />)
    const button = screen.getByRole('button', { name: 'Take a seat' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
