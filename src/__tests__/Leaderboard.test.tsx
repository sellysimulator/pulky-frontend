/**
 * Section 29 - Leaderboard (block 1, spec 13.8 "Leaderboard and Reveal"; design.md 3.2, 8.8).
 * Acceptance criteria 3, 4; failure modes 3 and 4 (component side).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import Leaderboard from '../components/results/Leaderboard'
import { formatMoney } from '../utils/format'
import { NAMES, RANK_ORDER, makeView } from './fixtures/results'
import { hasClassAncestor, onScreen } from './fixtures/resultsHelpers'

const PROFITS = { P2: formatMoney(5123.45), P3: formatMoney(3000.5), P1: formatMoney(-250.75) }

function show(revealedByDefault: boolean, myAlias: string | null = null) {
  return render(<Leaderboard view={makeView()} revealedByDefault={revealedByDefault} myAlias={myAlias} />)
}

/** The smallest ancestor of `el` that mentions `text`: the card the element sits in. */
function climbTo(el: Element, text: string): Element {
  let node: Element | null = el
  while (node && !(node.textContent ?? '').includes(text)) node = node.parentElement
  if (!node) throw new Error(`nothing above the element mentions ${text}`)
  return node
}

const shownProfits = () => Object.values(PROFITS).filter((text) => onScreen(text).length > 0)

describe('cards', () => {
  it('has one card per pulquería, in rank order, each with its rank and name', () => {
    show(false) // hidden: the only digits in a card are its rank
    const names = RANK_ORDER.map((alias) => screen.getAllByText(NAMES[alias])[0])
    for (let i = 1; i < names.length; i++) {
      expect(names[i - 1].compareDocumentPosition(names[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const alias of RANK_ORDER) expect(screen.getAllByText(NAMES[alias]).length).toBeGreaterThan(0)
    RANK_ORDER.forEach((alias, i) => {
      let card: Element | null = onScreen(NAMES[alias])[0]
      while (card && !(card.textContent ?? '').includes(String(i + 1))) card = card.parentElement
      expect(card, `${alias} has rank ${i + 1}`).not.toBeNull()
      for (const other of RANK_ORDER.filter((a) => a !== alias)) expect(card!.textContent).not.toContain(NAMES[other])
    })
  })

  it('puts the Trophy on rank 1 only', () => {
    const { container } = show(true)
    const trophies = Array.from(container.querySelectorAll('svg.lucide-trophy')).filter(
      (t) => !hasClassAncestor(t, 'print:block'),
    )
    expect(trophies).toHaveLength(1)
    const card = climbTo(trophies[0], NAMES.P2)
    expect(card.textContent).not.toContain(NAMES.P3)
    expect(card.textContent).not.toContain(NAMES.P1)
  })

  it('marks only myAlias with You', () => {
    show(true, 'P1')
    const chips = onScreen('You')
    expect(chips).toHaveLength(1)
    const card = climbTo(chips[0], NAMES.P1)
    expect(card.textContent).not.toContain(NAMES.P2)
    expect(card.textContent).not.toContain(NAMES.P3)
  })

  it('shows no You chip to the host, who has no pulquería', () => {
    show(true, null)
    expect(onScreen('You')).toHaveLength(0)
  })
})

describe('revealed by default (a player)', () => {
  it('shows every total profit at once, with no Reveal control (failure mode 3)', () => {
    show(true)
    expect(shownProfits()).toHaveLength(3)
    expect(onScreen('hidden until revealed')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })
})

describe('hidden by default (the host)', () => {
  it('shows names and ranks but not one profit, and offers Reveal (failure mode 4)', () => {
    show(false)
    expect(shownProfits()).toEqual([])
    for (const alias of RANK_ORDER) expect(screen.getAllByText(NAMES[alias]).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
  })

  it('stands in for each profit with a block that reads "hidden until revealed"', () => {
    show(false)
    expect(onScreen('hidden until revealed')).toHaveLength(3)
  })

  it('Reveal shows all figures, drops the placeholders and the control', () => {
    show(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(shownProfits()).toHaveLength(3)
    expect(onScreen('hidden until revealed')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('shows each figure beside its own pulquería', () => {
    show(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    for (const alias of RANK_ORDER) {
      const [figure] = onScreen(PROFITS[alias as keyof typeof PROFITS])
      const card = climbTo(figure, NAMES[alias])
      for (const other of RANK_ORDER.filter((a) => a !== alias)) expect(card.textContent).not.toContain(NAMES[other])
    }
  })
})
