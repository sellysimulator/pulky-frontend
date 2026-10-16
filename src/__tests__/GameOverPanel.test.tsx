/** Section 27 - GameOverPanel (spec 13.8 first paragraph). Acceptance criterion 9; failure mode 2 (panel side). */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import GameOverPanel from '../components/game/GameOverPanel'

function panel(gamePublicId: string | null) {
  return render(
    <MemoryRouter>
      <GameOverPanel roomCode="k7m2qx" gamePublicId={gamePublicId} />
    </MemoryRouter>,
  )
}

describe('GameOverPanel', () => {
  it('shows the title, the body and a See the results link', () => {
    panel(null)
    expect(screen.getByText('The game is over')).toBeInTheDocument()
    expect(screen.getByText('Your host will take everyone through the results.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See the results' })).toBeInTheDocument()
  })

  it('links to the room-code results before game_persisted, upper-cased', () => {
    panel(null)
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/K7M2QX')
  })

  it('links to the persisted game once its public id is known', () => {
    panel('9f2c1a')
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g/9f2c1a')
  })

  it('follows the public id when it arrives later', () => {
    const { rerender } = panel(null)
    rerender(
      <MemoryRouter>
        <GameOverPanel roomCode="k7m2qx" gamePublicId="abc123" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/g/abc123')
  })
})
