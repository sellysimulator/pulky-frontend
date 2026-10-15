/** Section 23 — ParticipantList (spec 23 §3.2). Acceptance criteria 2, 6, 8; failure modes 2, 3. */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import ParticipantList from '../components/lobby/ParticipantList'

const P = (alias: string, display_name: string, connected = true) => ({ alias, display_name, connected })

describe('ParticipantList', () => {
  it('shows the seat count line and orders the worked example', () => {
    const { container } = render(
      <ParticipantList participants={[P('P2', 'La Chula', false), P('P1', 'Don Agave')]} seatsTotal={4} myAlias="P1" />,
    )
    expect(screen.getByText('2 of 4 seats taken')).toBeInTheDocument()
    const a = screen.getByText('Don Agave')
    const b = screen.getByText('La Chula')
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll('svg.lucide-wifi').length).toBe(1)
    expect(container.querySelectorAll('svg.lucide-wifi-off').length).toBe(1)
  })

  it('marks only the own row with You', () => {
    render(<ParticipantList participants={[P('P2', 'La Chula'), P('P1', 'Don Agave')]} seatsTotal={4} myAlias="P1" />)
    const you = screen.getAllByText('You')
    expect(you).toHaveLength(1)
    const row = screen.getByText('Don Agave').closest('li') as HTMLElement
    expect(within(row).getByText('You')).toBeInTheDocument()
    expect(within(screen.getByText('La Chula').closest('li') as HTMLElement).queryByText('You')).toBeNull()
  })

  it('carries no You chip without myAlias', () => {
    render(<ParticipantList participants={[P('P1', 'Don Agave')]} seatsTotal={4} />)
    expect(screen.queryByText('You')).toBeNull()
  })

  it('uses the seated wording when seatsTotal is null', () => {
    render(<ParticipantList participants={[P('P1', 'A'), P('P2', 'B'), P('P3', 'C')]} seatsTotal={null} />)
    expect(screen.getByText('3 seated')).toBeInTheDocument()
  })

  it('shows the empty state with no participants', () => {
    render(<ParticipantList participants={[]} seatsTotal={4} />)
    expect(screen.getByText('No one has joined yet')).toBeInTheDocument()
    expect(screen.getByText('Share the room code or the invite link.')).toBeInTheDocument()
  })

  it('orders by alias number, not by text or by count: P2 before P10 (failure mode 2)', () => {
    render(<ParticipantList participants={[P('P10', 'Ten'), P('P2', 'Two'), P('P1', 'One')]} seatsTotal={12} />)
    const names = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    const idx = (n: string) => names.findIndex((t) => t.includes(n))
    expect(idx('One')).toBeLessThan(idx('Two'))
    expect(idx('Two')).toBeLessThan(idx('Ten'))
  })

  it('states connection in words on every row (failure mode 3)', () => {
    render(<ParticipantList participants={[P('P1', 'Don Agave', true), P('P2', 'La Chula', false)]} seatsTotal={4} />)
    const lost = screen.getByText('La Chula').closest('li') as HTMLElement
    expect(lost.textContent).toContain('disconnected')
    const ok = screen.getByText('Don Agave').closest('li') as HTMLElement
    expect(ok.textContent).toContain('connected')
    expect(ok.textContent).not.toContain('disconnected')
  })
})
