import { useMediaQuery } from './mediaQuery'

/** Any touch screen, even beside a mouse: the movement pad and the tap-to-open button show for it. */
export const COARSE_POINTER = '(any-pointer: coarse)'

export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER)
}
