/** Section 32 - ModelCredits (plan 32 section 3.10; acceptance 11). */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ModelCredits from '../components/game/views/board3d/ModelCredits'
import { FONT_CREDIT, MODEL_CREDITS, MODEL_LICENSE } from '../components/game/views/board3d/assetCredits'

describe('ModelCredits', () => {
  it('is a details element whose summary reads 3D model credits', () => {
    render(<ModelCredits />)
    const summary = screen.getByText('3D model credits')
    expect(summary.tagName).toBe('SUMMARY')
    expect(summary.closest('details')).not.toBeNull()
  })

  it('lists the three models in order, then the font', () => {
    render(<ModelCredits />)
    const items = within(screen.getByRole('list', { hidden: true })).getAllByRole('listitem', { hidden: true })
    expect(items).toHaveLength(4)
    MODEL_CREDITS.forEach((credit, i) => {
      const item = items[i]
      const links = within(item).getAllByRole('link', { hidden: true })
      expect(links.map((a) => a.getAttribute('href'))).toEqual([credit.sourceUrl, credit.authorUrl, MODEL_LICENSE.url])
      expect(links.map((a) => a.textContent)).toEqual([credit.title, credit.author, 'CC BY 4.0'])
      expect(item.textContent).toBe(`${credit.title} by ${credit.author}, CC BY 4.0. Changes: ${credit.changes}.`)
    })
    const font = items[3]
    expect(font.textContent).toBe('Font: Figtree by Erik Kennedy, SIL Open Font License 1.1.')
    expect(within(font).getAllByRole('link', { hidden: true }).map((a) => a.getAttribute('href'))).toEqual([
      FONT_CREDIT.sourceUrl,
      FONT_CREDIT.licenseUrl,
    ])
  })

  it('opens every link in a new tab without leaking the opener', () => {
    render(<ModelCredits />)
    const links = screen.getAllByRole('link', { hidden: true })
    expect(links).toHaveLength(MODEL_CREDITS.length * 3 + 2)
    for (const a of links) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })
})
