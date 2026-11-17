import { useSyncExternalStore } from 'react'

/** Any touch screen, even beside a mouse: the movement pad and the tap-to-open button show for it. */
export const COARSE_POINTER = '(any-pointer: coarse)'

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(COARSE_POINTER)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return window.matchMedia(COARSE_POINTER).matches
}

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
