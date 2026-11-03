import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Select from '../components/shared/Select'

const OPTIONS = [
  { value: 'a', label: 'Agave' },
  { value: 'b', label: 'Barrel' },
  { value: 'c', label: 'Cellar', disabled: true, detail: 'Closed' },
  { value: 'd', label: 'Dock' },
]

function mount(onChange = vi.fn()) {
  render(<Select aria-label="Place" value="a" options={OPTIONS} onChange={onChange} />)
  return { onChange, box: screen.getByRole('combobox', { name: 'Place' }) }
}

describe('Select', () => {
  it('opens and picks an option with the mouse', () => {
    const { onChange, box } = mount()
    expect(box).toHaveTextContent('Agave')
    fireEvent.click(box)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'Barrel' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('picks with the keyboard, skipping the disabled option', () => {
    const { onChange, box } = mount()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('d')
  })

  it('cannot choose a disabled option', () => {
    const { onChange, box } = mount()
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('option', { name: /Cellar/ }))
    expect(onChange).not.toHaveBeenCalled()
    expect(box).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })
})
