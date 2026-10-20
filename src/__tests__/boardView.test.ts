/**
 * Section 32 - choosing the view (plan 32 sections 2, 3.3, 4). Failure modes 4 and the support rows;
 * acceptance 3 and 4 at the unit level.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  UNSUPPORTED_REASONS,
  boardViewSupport,
  hasWebGL,
  resolveBoardView,
  useBoardViewSupport,
} from '../components/game/views/boardView'
import { getBoardView, setBoardView } from '../utils/storage'

describe('resolveBoardView (failure mode 4)', () => {
  it.each([
    ['3D', '3D'],
    ['2D', '2D'],
    ['3d', '2D'],
    ['true', '2D'],
    ['', '2D'],
    [' 3D', '2D'],
    [null, '2D'],
  ])('%j resolves to %s', (stored, expected) => {
    expect(resolveBoardView(stored)).toBe(expected)
  })
})

describe('boardViewSupport', () => {
  it('quotes the three reasons exactly', () => {
    expect(UNSUPPORTED_REASONS.webgl).toBe('Your browser cannot draw 3D graphics.')
    expect(UNSUPPORTED_REASONS.pointer).toBe('The 3D pulquería needs a keyboard and a mouse.')
    expect(UNSUPPORTED_REASONS.width).toBe('The 3D pulquería needs a window at least 1,024 pixels wide.')
  })

  it('checks webgl first, then the pointer, then the width', () => {
    expect(boardViewSupport({ webgl: false, finePointer: false, wide: false })).toEqual({
      ok: false,
      reason: 'Your browser cannot draw 3D graphics.',
    })
    expect(boardViewSupport({ webgl: true, finePointer: false, wide: true })).toEqual({
      ok: false,
      reason: 'The 3D pulquería needs a keyboard and a mouse.',
    })
    expect(boardViewSupport({ webgl: true, finePointer: false, wide: false })).toEqual({
      ok: false,
      reason: UNSUPPORTED_REASONS.pointer,
    })
    expect(boardViewSupport({ webgl: true, finePointer: true, wide: false })).toEqual({
      ok: false,
      reason: 'The 3D pulquería needs a window at least 1,024 pixels wide.',
    })
    expect(boardViewSupport({ webgl: true, finePointer: true, wide: true })).toEqual({ ok: true })
  })
})

describe('storage accessors', () => {
  it('keeps the raw value under pulky.board_view and null when nothing is stored', () => {
    expect(getBoardView()).toBeNull()
    setBoardView('3D')
    expect(localStorage.getItem('pulky.board_view')).toBe('3D')
    expect(getBoardView()).toBe('3D')
    setBoardView('2D')
    expect(getBoardView()).toBe('2D')
  })

  it('returns whatever is stored, unvalidated (resolveBoardView validates)', () => {
    localStorage.setItem('pulky.board_view', 'sideways')
    expect(getBoardView()).toBe('sideways')
  })

  it('survives a throwing storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getBoardView()).toBeNull()
    expect(() => setBoardView('3D')).not.toThrow()
    get.mockRestore()
    set.mockRestore()
  })
})

describe('hasWebGL', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    delete (window as unknown as Record<string, unknown>).WebGLRenderingContext
  })

  async function fresh() {
    vi.resetModules()
    return (await import('../components/game/views/boardView')).hasWebGL
  }

  it('is false in jsdom without printing a not-implemented error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(hasWebGL()).toBe(false)
    expect(error).not.toHaveBeenCalled()
  })

  it('is true when a canvas gives a webgl2 context, and is computed once', async () => {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl2' ? {} : null) as never)
    const probe = await fresh()
    expect(probe()).toBe(true)
    expect(probe()).toBe(true)
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('falls back to webgl, and is false when neither context exists', async () => {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl' ? {} : null) as never)
    expect((await fresh())()).toBe(true)
    vi.restoreAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never)
    expect((await fresh())()).toBe(false)
  })

  it('is false when getContext throws', async () => {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      throw new Error('no gpu')
    }) as never)
    expect((await fresh())()).toBe(false)
  })
})

describe('useBoardViewSupport', () => {
  type Listener = () => void
  let fine = true
  let wide = true
  const listeners = new Map<string, Set<Listener>>()
  const original = window.matchMedia

  beforeEach(() => {
    fine = true
    wide = true
    listeners.clear()
    window.matchMedia = ((query: string) => {
      const set = listeners.get(query) ?? new Set<Listener>()
      listeners.set(query, set)
      return {
        get matches() {
          return query.includes('pointer') ? fine : wide
        },
        media: query,
        addEventListener: (_: string, fn: Listener) => set.add(fn),
        removeEventListener: (_: string, fn: Listener) => set.delete(fn),
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }
    }) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    window.matchMedia = original
  })

  it('queries (pointer: fine) and (min-width: 64rem), and reports no WebGL under jsdom', () => {
    const { result } = renderHook(() => useBoardViewSupport())
    expect([...listeners.keys()].sort()).toEqual(['(min-width: 64rem)', '(pointer: fine)'])
    expect(result.current).toEqual({ ok: false, reason: UNSUPPORTED_REASONS.webgl })
  })

  it('follows a media-query change event', async () => {
    vi.resetModules()
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({})) as never)
    const mod = await import('../components/game/views/boardView')
    const { result, unmount } = renderHook(() => mod.useBoardViewSupport())
    expect(result.current).toEqual({ ok: true })
    wide = false
    act(() => listeners.get('(min-width: 64rem)')?.forEach((fn) => fn()))
    expect(result.current).toEqual({ ok: false, reason: UNSUPPORTED_REASONS.width })
    fine = false
    act(() => listeners.get('(pointer: fine)')?.forEach((fn) => fn()))
    expect(result.current).toEqual({ ok: false, reason: UNSUPPORTED_REASONS.pointer })
    unmount()
    expect(listeners.get('(pointer: fine)')?.size).toBe(0)
    vi.restoreAllMocks()
    delete (window as unknown as Record<string, unknown>).WebGLRenderingContext
  })
})
