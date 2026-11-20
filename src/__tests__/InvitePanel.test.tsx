/** InvitePanel (design.md §8.3). */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import InvitePanel from '../components/lobby/InvitePanel'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'

function setClipboard(writeText: ((t: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  })
}

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})

describe('InvitePanel', () => {
  it('shows the labels, the code in a monospace face and the invite link', () => {
    render(<InvitePanel roomCode="K7M2QX" />)
    expect(screen.getByText('Room code')).toBeInTheDocument()
    expect(screen.getByText('Invite link')).toBeInTheDocument()
    expect(screen.getByText('K7M2QX')).toHaveClass('font-mono')
    expect(screen.getByText(`${window.location.origin}/join/K7M2QX`)).toBeInTheDocument()
  })

  it('Copy code writes the code and adds an info alert Copied.', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    render(<InvitePanel roomCode="K7M2QX" />)
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenCalledWith('K7M2QX')
    await vi.waitFor(() =>
      expect(useGameStore.getState().alerts.map((a) => [a.kind, a.message])).toEqual([['info', 'Copied.']]),
    )
  })

  it('Copy link writes the /join/<CODE> URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    render(<InvitePanel roomCode="K7M2QX" />)
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/K7M2QX`)
    await vi.waitFor(() => expect(useGameStore.getState().alerts).toHaveLength(1))
  })

  it('adds the error alert when the clipboard API rejects', async () => {
    const user = userEvent.setup()
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    render(<InvitePanel roomCode="K7M2QX" />)
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    await vi.waitFor(() =>
      expect(useGameStore.getState().alerts.map((a) => [a.kind, a.message])).toEqual([
        ['error', 'Copy failed. Select the text and copy it.'],
      ]),
    )
  })

  it('adds the error alert when the clipboard API is missing', async () => {
    const user = userEvent.setup()
    setClipboard(undefined)
    render(<InvitePanel roomCode="K7M2QX" />)
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    await vi.waitFor(() =>
      expect(useGameStore.getState().alerts.map((a) => [a.kind, a.message])).toEqual([
        ['error', 'Copy failed. Select the text and copy it.'],
      ]),
    )
  })
})

describe('InvitePanel join QR code', () => {
  it('Show QR opens the invite link as a QR code; Close, Escape and the backdrop dismiss it', () => {
    render(<InvitePanel roomCode="K7M2QX" />)
    const toggle = screen.getByRole('button', { name: 'Show QR' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)

    const dialog = screen.getByRole('dialog', { name: 'QR code to join room K7M2QX' })
    expect(within(dialog).getByTitle('Join link for room K7M2QX')).toBeInTheDocument()
    expect(dialog).toHaveTextContent(`${window.location.origin}/join/K7M2QX`)
    expect(screen.getByRole('button', { name: 'Hide QR' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show QR' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show QR' }))
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
