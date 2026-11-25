import { useMediaQuery } from './mediaQuery'

/**
 * A phone held either way: too narrow upright, too short on its side. Touch must be the main pointer in both, so no
 * desktop window matches at any size and a laptop with a touch screen keeps the desktop layout.
 */
export const PHONE_VIEWPORT =
  '(pointer: coarse) and (max-width: 47.99rem), (pointer: coarse) and (max-height: 30rem)'

export function usePhoneViewport(): boolean {
  return useMediaQuery(PHONE_VIEWPORT)
}
