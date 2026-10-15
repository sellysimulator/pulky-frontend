/**
 * Section 22 — JoinRedirect. Acceptance criterion 10.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import JoinRedirect, { route } from '../pages/JoinRedirect'

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>start page</p> },
      { path: '/join/:roomCode', element: <JoinRedirect /> },
      { path: '/game/:roomCode', element: <p>game page</p> },
    ],
    { initialEntries: ['/', url], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('JoinRedirect', () => {
  it('is public at /join/:roomCode', () => {
    expect(route).toEqual({ path: '/join/:roomCode', guard: 'public' })
  })

  it('upper-cases the code and goes to /game/:code', () => {
    const router = renderAt('/join/abc234')
    expect(router.state.location.pathname).toBe('/game/ABC234')
    expect(screen.getByText('game page')).toBeInTheDocument()
  })

  it('keeps a code that is already upper-case', () => {
    const router = renderAt('/join/KQ7M2P')
    expect(router.state.location.pathname).toBe('/game/KQ7M2P')
  })

  it('replaces the history entry, so Back does not bounce the visitor forward again', async () => {
    const router = renderAt('/join/abc234')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(router.state.location.pathname).toBe('/game/ABC234')
    await router.navigate(-1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})
