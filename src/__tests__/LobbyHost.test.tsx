/** Section 23 — LobbyHost (spec 23 §3.5). Acceptance criteria 4, 8; failure modes 1, 6. */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import { socket } from '../api/socket'
import LobbyHost from '../components/lobby/LobbyHost'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { LobbyUpdatePayload } from '../types/game'

let emit: ReturnType<typeof vi.spyOn>

const lobby = (over: Partial<LobbyUpdatePayload> = {}): LobbyUpdatePayload => ({
  seq: 1,
  state: 'configuring',
  participants: [
    { alias: 'P1', display_name: 'Don Agave', connected: true },
    { alias: 'P2', display_name: 'La Chula', connected: true },
  ],
  seats_total: 4,
  config_locked: false,
  can_start: true,
  start_blocked_reason: null,
  ...over,
})

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
})
afterEach(() => emit.mockRestore())

const seed = (over: Partial<LobbyUpdatePayload> = {}) => {
  useGameStore.getState().setRoom('K7M2QX', true)
  useGameStore.getState().applyLobbyUpdate(lobby(over))
}

describe('LobbyHost', () => {
  it('renders the invite, the participants and the start control, top to bottom', () => {
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    const code = screen.getByText('K7M2QX')
    const count = screen.getByText('2 of 4 seats taken')
    const start = screen.getByRole('button', { name: 'Start game' })
    expect(code.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(count.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('start emits start_game with the stored host secret', async () => {
    const user = userEvent.setup()
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    await user.click(screen.getByRole('button', { name: 'Start game' }))
    expect(emit).toHaveBeenCalledWith('start_game', { room_id: 'K7M2QX', host_secret: 's3cret' })
  })

  it('does not start without a secret, keeps the button disabled and says why (failure mode 6)', async () => {
    const user = userEvent.setup()
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret={null} />)
    const button = screen.getByRole('button', { name: 'Start game' })
    expect(button).toBeDisabled()
    expect(screen.getByText('This browser does not hold the host key for this room.')).toBeInTheDocument()
    await user.click(button)
    expect(emit).not.toHaveBeenCalled()
  })

  it('stays disabled with two connected players when the server says canStart false (failure mode 1)', () => {
    seed({ can_start: false, start_blocked_reason: 'Waiting for at least 2 players.' })
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled()
    expect(screen.getByText('Waiting for at least 2 players.')).toBeInTheDocument()
  })

  it('is pending from the click until the next lobby_update', async () => {
    const user = userEvent.setup()
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    const button = screen.getByRole('button', { name: 'Start game' })
    expect(button).not.toHaveAttribute('aria-busy')
    await user.click(button)
    expect(button).toHaveAttribute('aria-busy', 'true')
    act(() => useGameStore.getState().applyLobbyUpdate(lobby({ seq: 2 })))
    expect(button).not.toHaveAttribute('aria-busy')
  })

  it('is pending until game_started', async () => {
    const user = userEvent.setup()
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    await user.click(screen.getByRole('button', { name: 'Start game' }))
    expect(screen.getByRole('button', { name: 'Start game' })).toHaveAttribute('aria-busy', 'true')
    act(() =>
      useGameStore.getState().applyGameStarted({
        seq: 2,
        duration_days: 14,
        participants: [],
        config: { demand: { retail_price: 1 } },
      } as never),
    )
    expect(screen.getByRole('button', { name: 'Start game' })).not.toHaveAttribute('aria-busy')
  })

  it('is pending until join_error, which shows as a danger alert above the rail', async () => {
    const user = userEvent.setup()
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    await user.click(screen.getByRole('button', { name: 'Start game' }))
    act(() => useGameStore.getState().applyJoinError({ message: 'Waiting for at least 2 players.' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Waiting for at least 2 players.')
    expect(screen.getByRole('button', { name: 'Start game' })).not.toHaveAttribute('aria-busy')
    const code = screen.getByText('K7M2QX')
    expect(alert.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no danger alert without a join error', () => {
    seed()
    render(<LobbyHost roomCode="K7M2QX" hostSecret="s3cret" />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
