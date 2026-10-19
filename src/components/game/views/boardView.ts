import { useSyncExternalStore } from 'react'
import type { BoardView } from '../../../utils/storage'

export type { BoardView } from '../../../utils/storage'

export type BoardViewSupport = { ok: true } | { ok: false; reason: string }

export interface BoardViewEnvironment {
  webgl: boolean
  finePointer: boolean
  wide: boolean
}

export const UNSUPPORTED_REASONS = {
  webgl: 'Your browser cannot draw 3D graphics.',
  pointer: 'The 3D pulquería needs a keyboard and a mouse.',
  width: 'The 3D pulquería needs a window at least 1,024 pixels wide.',
} as const

const FINE_POINTER = '(pointer: fine)'
const WIDE = '(min-width: 64rem)'

/** '3D' only for exactly '3D'; anything else, including a missing value, is the default board. */
export function resolveBoardView(stored: string | null): BoardView {
  return stored === '3D' ? '3D' : '2D'
}

export function boardViewSupport(env: BoardViewEnvironment): BoardViewSupport {
  if (!env.webgl) return { ok: false, reason: UNSUPPORTED_REASONS.webgl }
  if (!env.finePointer) return { ok: false, reason: UNSUPPORTED_REASONS.pointer }
  if (!env.wide) return { ok: false, reason: UNSUPPORTED_REASONS.width }
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

function subscribe(onChange: () => void): () => void {
  const lists = [window.matchMedia(FINE_POINTER), window.matchMedia(WIDE)]
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

// One number carries both queries, so the store snapshot is a primitive and never re-renders by identity.
function snapshot(): number {
  return (window.matchMedia(FINE_POINTER).matches ? 1 : 0) + (window.matchMedia(WIDE).matches ? 2 : 0)
}

export function useBoardViewSupport(): BoardViewSupport {
  const bits = useSyncExternalStore(subscribe, snapshot, () => 0)
  return boardViewSupport({ webgl: hasWebGL(), finePointer: (bits & 1) !== 0, wide: (bits & 2) !== 0 })
}
