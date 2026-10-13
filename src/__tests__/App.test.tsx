import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders the game name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Pulky' })).toBeInTheDocument()
  })
})
