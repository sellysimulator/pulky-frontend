/** Section 27 - GameOverPanel (spec 13.8 first paragraph). Acceptance criterion 9; failure mode 2 (panel side). */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import GameOverPanel from '../components/game/GameOverPanel'

function panel(gamePublicId: string | null) {
  return render(
    <MemoryRouter>
      <GameOverPanel gamePublicId={gamePublicId} />
    </MemoryRouter>,
  )
}

describe('GameOverPanel', () => {
  it('shows the title, the body and a See the results link', () => {
    panel('9f2c1a')
    expect(screen.getByText('The game is over')).toBeInTheDocument()
    expect(screen.getByText('Your host will take everyone through the results.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See the results' })).toBeInTheDocument()
  })

  it('links to the game by the id game_finished carries, never by room code', () => {
    panel('9f2c1a')
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/9f2c1a')
  })

  it('shows no link while the game id is unknown', () => {
    panel(null)
    expect(screen.getByText('The game is over')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'See the results' })).not.toBeInTheDocument()
  })

  it('follows the game id when it arrives later', () => {
    const { rerender } = panel(null)
    rerender(
      <MemoryRouter>
        <GameOverPanel gamePublicId="abc123" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'See the results' })).toHaveAttribute('href', '/results/abc123')
  })
})
