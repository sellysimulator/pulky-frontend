import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfigPreviewContext } from '../components/config/configPreview'
import InfoButton from '../components/config/docs/InfoButton'
import type { ConfigDefaultsResponse } from '../types/game'
import { CONFIG_PREVIEWS, previewState } from './fixtures/serverConfig'

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

  it("the dialog follows the server's figures for the config being edited", async () => {
    const user = userEvent.setup()
    const at = (name: string) => (
      <ConfigPreviewContext.Provider value={previewState(name)}>
        <InfoButton entryKey="stock.holding_cost" config={CONFIG_PREVIEWS[name].config} />
      </ConfigPreviewContext.Provider>
    )
    const { rerender } = render(at('typed'))
    await user.click(screen.getByRole('button', { name: 'About Holding cost' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('$10.00')
    rerender(at('holding05'))
    expect(screen.getByRole('dialog')).toHaveTextContent('$25.00')
  })
})
