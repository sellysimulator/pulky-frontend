/** Section 27 - WaitingPanel (spec 13.7, design.md 11.6). Worked example of section 27 4. */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WaitingPanel from '../components/game/WaitingPanel'
import type { Participant } from '../types/game'

const PEOPLE: Participant[] = [
  { alias: 'P1', display_name: 'Don Agave', connected: true },
  { alias: 'P2', display_name: 'La Chula', connected: true },
  { alias: 'P3', display_name: 'El Tinacal', connected: false },
]

describe('WaitingPanel', () => {
  it('names who is awaited, by display name, inside a status region', () => {
    render(<WaitingPanel awaiting={['P2', 'P3']} participants={PEOPLE} />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Day submitted. Waiting for La Chula, El Tinacal.')
  })

  it('says the day is closing when nobody is left', () => {
    render(<WaitingPanel awaiting={[]} participants={PEOPLE} />)
    expect(screen.getByRole('status')).toHaveTextContent('Everyone is in. Closing the day…')
    expect(screen.queryByText(/Waiting for/)).toBeNull()
  })

  it('shows an unknown alias as the alias', () => {
    render(<WaitingPanel awaiting={['P9']} participants={PEOPLE} />)
    expect(screen.getByRole('status')).toHaveTextContent('Day submitted. Waiting for P9.')
  })

  it('updates the same region when the awaited list shrinks', () => {
    const { rerender } = render(<WaitingPanel awaiting={['P1', 'P2']} participants={PEOPLE} />)
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Don Agave, La Chula.')
    rerender(<WaitingPanel awaiting={['P2']} participants={PEOPLE} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Day submitted. Waiting for La Chula.')
  })
})
