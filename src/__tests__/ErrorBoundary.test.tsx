/** Section 32 - ErrorBoundary (plan 32 section 2). */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from '../components/shared/ErrorBoundary'

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('boom')
  return <p>fine</p>
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Bomb explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).toBeNull()
  })

  it('renders the fallback at once and reports the error once', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary fallback={<p>fallback</p>} onError={onError}>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('fallback')).toBeInTheDocument()
    expect(screen.queryByText('fine')).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)
    expect((onError.mock.calls[0][0] as Error).message).toBe('boom')
  })

  it('works without onError', () => {
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })

  it('keeps the fallback once failed, and a new key mounts a fresh boundary', () => {
    function Host() {
      const [key, setKey] = useState('a')
      const [explode, setExplode] = useState(true)
      return (
        <>
          <button
            onClick={() => {
              setExplode(false)
              setKey('b')
            }}
          >
            swap
          </button>
          <ErrorBoundary key={key} fallback={<p>fallback</p>}>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      )
    }
    const { rerender } = render(<Host />)
    expect(screen.getByText('fallback')).toBeInTheDocument()
    rerender(<Host />)
    expect(screen.getByText('fallback')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'swap' }))
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
