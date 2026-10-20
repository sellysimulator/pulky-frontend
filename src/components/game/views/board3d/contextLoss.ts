export const CONTEXT_LOST_EVENT = 'webglcontextlost'

/**
 * The event does not bubble, so the listener is a capture-phase one on the host, which reaches the canvas inside it.
 * Cancelling it tells the browser the context may be restored; the caller turns the loss into a render failure.
 */
export function observeContextLoss(host: HTMLElement, onLost: () => void): () => void {
  const listener = (event: Event): void => {
    event.preventDefault()
    onLost()
  }
  host.addEventListener(CONTEXT_LOST_EVENT, listener, true)
  return () => host.removeEventListener(CONTEXT_LOST_EVENT, listener, true)
}
