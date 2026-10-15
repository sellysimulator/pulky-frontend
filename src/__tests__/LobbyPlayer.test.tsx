/** Section 23 — LobbyPlayer (spec 23 §3.6). Acceptance criteria 5, 6, 7, 8; failure modes 4, 5. */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import { socket } from '../api/socket'
import LobbyPlayer from '../components/lobby/LobbyPlayer'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { getDisplayName, setSessionToken } from '../utils/storage'

let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  useGameStore.getState().setRoom('K7M2QX', false)
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
})
afterEach(() => emit.mockRestore())

function renderPlayer() {
  const router = createMemoryRouter(
    [
      { path: '/game/:code', element: <LobbyPlayer roomCode="K7M2QX" /> },
      { path: '/home', element: <p>home page</p> },
    ],
    { initialEntries: ['/game/K7M2QX'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const lobbyUpdate = () =>
  useGameStore.getState().applyLobbyUpdate({
    seq: 1,
    state: 'lobby',
    participants: [
      { alias: 'P2', display_name: 'La Chula', connected: false },
      { alias: 'P1', display_name: 'Don Agave', connected: true },
    ],
    seats_total: 4,
    config_locked: false,
    can_start: false,
    start_blocked_reason: 'Waiting',
  })

const seat = () => {
  lobbyUpdate()
  useGameStore.getState().applyJoined({ alias: 'P1', session_token: 'tok', display_name: 'Don Agave' })
}

const nameInput = () => screen.getByLabelText("Your pulquería's name")

describe('LobbyPlayer without a seat', () => {
  it('shows the Name your pulquería card holding the name form', () => {
    renderPlayer()
    const card = screen.getByRole('region', { name: 'Name your pulquería' })
    expect(within(card).getByLabelText("Your pulquería's name")).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Waiting for the host to start' })).toBeNull()
  })

  it('emits join with the trimmed name and the stored session token; stores the name', () => {
    setSessionToken('K7M2QX', 'tok-123')
    renderPlayer()
    fireEvent.change(nameInput(), { target: { value: '  Don Agave  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    expect(emit).toHaveBeenCalledWith('join', {
      room_id: 'K7M2QX',
      display_name: 'Don Agave',
      session_token: 'tok-123',
    })
    expect(getDisplayName()).toBe('Don Agave')
  })

  it('omits the session token when none is stored', () => {
    renderPlayer()
    fireEvent.change(nameInput(), { target: { value: 'Don Agave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    const payload = emit.mock.calls[0][1] as Record<string, unknown>
    expect(emit.mock.calls[0][0]).toBe('join')
    expect(payload).toEqual({ room_id: 'K7M2QX', display_name: 'Don Agave' })
    expect('session_token' in payload).toBe(false)
  })

  it('a blank name emits join without a display_name key and stores nothing', () => {
    renderPlayer()
    fireEvent.change(nameInput(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    const payload = emit.mock.calls[0][1] as Record<string, unknown>
    expect(emit.mock.calls[0][0]).toBe('join')
    expect('display_name' in payload).toBe(false)
    expect(getDisplayName()).toBeNull()
  })

  it('stores the sanitised name, not the raw one (failure mode 5)', () => {
    renderPlayer()
    fireEvent.change(nameInput(), { target: { value: 'Don\tAgave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    expect(getDisplayName()).toBe('Don Agave')
  })

  it('is pending until joined', () => {
    renderPlayer()
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    expect(screen.getByRole('button', { name: 'Take a seat' })).toHaveAttribute('aria-busy', 'true')
  })

  it('is pending until join_error, which shows as a danger alert inside the card', () => {
    renderPlayer()
    fireEvent.click(screen.getByRole('button', { name: 'Take a seat' }))
    act(() => useGameStore.getState().applyJoinError({ message: 'The room is full.' }))
    const card = screen.getByRole('region', { name: 'Name your pulquería' })
    expect(within(card).getByRole('alert')).toHaveTextContent('The room is full.')
    expect(screen.getByRole('button', { name: 'Take a seat' })).not.toHaveAttribute('aria-busy')
  })

  it('drops the danger alert once joined arrives (failure mode 4)', () => {
    renderPlayer()
    act(() => useGameStore.getState().applyJoinError({ message: 'The room is full.' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => seat())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('The room is full.')).toBeNull()
  })

  it('does not show a join error that the store no longer holds', () => {
    renderPlayer()
    act(() => useGameStore.getState().applyJoinError({ message: 'The room is full.' }))
    act(() => useGameStore.getState().clearJoinError())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('LobbyPlayer with a seat', () => {
  it('shows the waiting card, the list with You on the own row and the spinner line', () => {
    seat()
    renderPlayer()
    const card = screen.getByRole('region', { name: 'Waiting for the host to start' })
    expect(within(card).getByText('2 of 4 seats taken')).toBeInTheDocument()
    expect(within(card).getAllByText('You')).toHaveLength(1)
    const row = within(card).getByText('Don Agave').closest('li') as HTMLElement
    expect(within(row).getByText('You')).toBeInTheDocument()
    expect(within(card).getByText('disconnected')).toBeInTheDocument()
    expect(within(card).getByRole('status')).toHaveTextContent('The game starts when the host presses Start.')
    expect(screen.queryByLabelText("Your pulquería's name")).toBeNull()
  })

  it('Leave room emits leave and navigates to /home', async () => {
    const user = userEvent.setup()
    seat()
    const router = renderPlayer()
    await user.click(screen.getByRole('button', { name: 'Leave room' }))
    expect(emit).toHaveBeenCalledWith('leave', { room_id: 'K7M2QX' })
    expect(router.state.location.pathname).toBe('/home')
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('Leave room is a secondary button', () => {
    seat()
    renderPlayer()
    expect(screen.getByRole('button', { name: 'Leave room' })).not.toHaveClass('bg-accent')
  })
})
