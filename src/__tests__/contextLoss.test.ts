/** Section 32 - context loss (plan 32 section 3.5). Failure mode 10. */
import { describe, expect, it, vi } from 'vitest'
import { CONTEXT_LOST_EVENT, observeContextLoss } from '../components/game/views/board3d/contextLoss'

function lose(target: Element): Event {
  const event = new Event('webglcontextlost', { bubbles: false, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('observeContextLoss (failure mode 10)', () => {
  it('names the event', () => expect(CONTEXT_LOST_EVENT).toBe('webglcontextlost'))

  it('hears a non-bubbling event fired at a canvas inside the host, once, and cancels it', () => {
    const host = document.createElement('div')
    const canvas = document.createElement('canvas')
    host.appendChild(canvas)
    document.body.appendChild(host)
    const onLost = vi.fn()
    observeContextLoss(host, onLost)
    const event = lose(canvas)
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('calls nothing after the unsubscribe', () => {
    const host = document.createElement('div')
    const canvas = document.createElement('canvas')
    host.appendChild(canvas)
    const onLost = vi.fn()
    const off = observeContextLoss(host, onLost)
    off()
    const event = lose(canvas)
    expect(onLost).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not hear other events', () => {
    const host = document.createElement('div')
    const onLost = vi.fn()
    observeContextLoss(host, onLost)
    host.dispatchEvent(new Event('webglcontextrestored'))
    expect(onLost).not.toHaveBeenCalled()
  })
})
