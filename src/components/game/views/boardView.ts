import type { BoardView } from '../../../utils/storage'

export type { BoardView } from '../../../utils/storage'

export type BoardViewSupport = { ok: true } | { ok: false; reason: string }

/**
 * WebGL is the one requirement. The pointer and the window width are not checked: a touch screen walks with the
 * on-screen movement pad, and the HUD stacks into one column below 64rem (spec §13.11.7; design.md §14.4).
 */
export interface BoardViewEnvironment {
  webgl: boolean
}

export const UNSUPPORTED_REASONS = {
  webgl: 'Your browser cannot draw 3D graphics.',
} as const

/** '3D' only for exactly '3D'; anything else, including a missing value, is the default board. */
export function resolveBoardView(stored: string | null): BoardView {
  return stored === '3D' ? '3D' : '2D'
}

export function boardViewSupport(env: BoardViewEnvironment): BoardViewSupport {
  if (!env.webgl) return { ok: false, reason: UNSUPPORTED_REASONS.webgl }
  return { ok: true }
}

let webglAnswer: boolean | null = null

/** Whether a canvas can give a WebGL context; computed once for the life of the page. */
export function hasWebGL(): boolean {
  if (webglAnswer !== null) return webglAnswer
  if (typeof window.WebGLRenderingContext === 'undefined') {
    webglAnswer = false
    return webglAnswer
  }
  try {
    const canvas = document.createElement('canvas')
    webglAnswer = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) !== null
  } catch {
    webglAnswer = false
  }
  return webglAnswer
}

/** Whether this page can show the 3D board. `hasWebGL` is computed once, so this never changes for the page's life. */
export function useBoardViewSupport(): BoardViewSupport {
  return boardViewSupport({ webgl: hasWebGL() })
}
