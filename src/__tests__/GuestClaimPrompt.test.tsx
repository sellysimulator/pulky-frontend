/**
 * Section 29 - GuestClaimPrompt (spec 13.8 block 6 "Claim your results").
 * The three-condition gate is exercised through ResultsSummary (ResultsSummary.test.tsx); here the
 * prompt is shown with every condition met and its sign-in then claim flow is followed.
 * Acceptance criterion 8.
 */
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

const auth = vi.hoisted(() => ({
  mode: 'guest' as 'authenticated' | 'guest' | null,
  signIn: vi.fn(async () => undefined),
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: auth.mode,
    user: null,
    signInWithGoogle: auth.signIn,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import GuestClaimPrompt from '../components/results/GuestClaimPrompt'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { getOrCreateGuestId, setSessionToken } from '../utils/storage'
import { ROOM } from './fixtures/results'
import { jsonBody, mockHttp, urlPath, verb, type HttpSpy } from './fixtures/resultsHelpers'

const PROMPT = 'Sign in to keep these results in your profile.'
let spy: HttpSpy | null = null
let guestId: string
let order: string[]

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  auth.mode = 'guest'
  order = []
  auth.signIn.mockImplementation(async () => {
    order.push('sign-in')
  })
  guestId = getOrCreateGuestId()
  setSessionToken(ROOM, 'tok')
})

afterEach(() => {
  spy?.restore()
  spy = null
})

function claimsReply(claimed: number) {
  spy = mockHttp((cfg) => {
    if (urlPath(cfg) === 'games/claim') order.push('claim')
    return { status: 200, data: { claimed } }
  })
}

describe('the prompt', () => {
  it('is an info alert with a Sign in with Google button', () => {
    render(<GuestClaimPrompt roomCode={ROOM} />)
    expect(screen.getByText(PROMPT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('does nothing until the button is pressed', () => {
    claimsReply(1)
    render(<GuestClaimPrompt roomCode={ROOM} />)
    expect(auth.signIn).not.toHaveBeenCalled()
    expect(spy!.seen).toHaveLength(0)
  })
})

describe('signing in and claiming', () => {
  it('signs in first, then POSTs the guest id to /games/claim', async () => {
    claimsReply(1)
    render(<GuestClaimPrompt roomCode={ROOM} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(spy!.seen).toHaveLength(1))
    expect(order).toEqual(['sign-in', 'claim'])
    expect(verb(spy!.seen[0])).toBe('POST')
    expect(urlPath(spy!.seen[0])).toBe('games/claim')
    expect(jsonBody(spy!.seen[0])).toEqual({ guest_identity: guestId })
  })

  it('says Saved 1 game to your profile. and the prompt goes away', async () => {
    claimsReply(1)
    render(<GuestClaimPrompt roomCode={ROOM} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(screen.getByText('Saved 1 game to your profile.')).toBeInTheDocument())
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument()
  })

  it('says Saved 3 games to your profile. for several', async () => {
    claimsReply(3)
    render(<GuestClaimPrompt roomCode={ROOM} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(screen.getByText('Saved 3 games to your profile.')).toBeInTheDocument())
    expect(screen.queryByText('Saved 3 game to your profile.')).not.toBeInTheDocument()
  })

  it('a failed claim shows the server message, or the fallback when there is none', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    render(<GuestClaimPrompt roomCode={ROOM} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(screen.getByText('Could not save your results. Try again.')).toBeInTheDocument())
    expect(screen.queryByText(/^Saved \d+ games? to your profile\.$/)).not.toBeInTheDocument()
  })

  it('a failed claim with a server detail shows that detail', async () => {
    spy = mockHttp(() => ({ status: 400, data: { detail: 'That is not a guest id.' } }))
    render(<GuestClaimPrompt roomCode={ROOM} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    await waitFor(() => expect(screen.getByText('That is not a guest id.')).toBeInTheDocument())
  })
})
