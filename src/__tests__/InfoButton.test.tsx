import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import InfoButton from '../components/config/docs/InfoButton'
import type { ConfigDefaultsResponse } from '../types/game'

vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas />,
  Line: () => <canvas />,
}))

const config = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8'),
  ) as ConfigDefaultsResponse
).config

describe('InfoButton (AC 6)', () => {
  it('is a button named About {label} that announces a dialog', () => {
    render(<InfoButton entryKey="max_players" config={config} />)
    const button = screen.getByRole('button', { name: 'About Seats' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes its name from the entry of its key', () => {
    render(<InfoButton entryKey="stock.holding_cost" config={config} />)
    expect(screen.getByRole('button', { name: 'About Holding cost' })).toBeInTheDocument()
  })

  it('opens the dialog with the entry for its key', async () => {
    const user = userEvent.setup()
    render(<InfoButton entryKey="stock.salvage_value" config={config} />)
    await user.click(screen.getByRole('button', { name: 'About Salvage price' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Salvage price' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('What a spoiled or leftover unit returns; 0 means it returns nothing.')
  })

  it('Escape closes the dialog and returns focus to the button', async () => {
    const user = userEvent.setup()
    render(<InfoButton entryKey="max_players" config={config} />)
    const button = screen.getByRole('button', { name: 'About Seats' })
    await user.click(button)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('can be opened again after closing', async () => {
    const user = userEvent.setup()
    render(<InfoButton entryKey="max_players" config={config} />)
    const button = screen.getByRole('button', { name: 'About Seats' })
    await user.click(button)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await user.click(button)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('the dialog follows the config prop', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<InfoButton entryKey="stock.holding_cost" config={config} />)
    await user.click(screen.getByRole('button', { name: 'About Holding cost' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('$10.00')
    const next = structuredClone(config)
    next.stock.holding_cost = 0.5
    rerender(<InfoButton entryKey="stock.holding_cost" config={next} />)
    expect(screen.getByRole('dialog')).toHaveTextContent('$25.00')
  })
})
