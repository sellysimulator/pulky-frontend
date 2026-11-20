/**
 * Choosing the view (spec §13.11.2) and the support rows, at the unit level.
 */
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UNSUPPORTED_REASONS,
  boardViewSupport,
  hasWebGL,
  resolveBoardView,
  useBoardViewSupport,
} from '../components/game/views/boardView'
import { getBoardView, setBoardView } from '../utils/storage'

describe('resolveBoardView', () => {
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
  it('quotes the one reason exactly', () => {
    expect(UNSUPPORTED_REASONS).toEqual({ webgl: 'Your browser cannot draw 3D graphics.' })
  })

  it('needs WebGL and nothing else', () => {
    expect(boardViewSupport({ webgl: false })).toEqual({ ok: false, reason: 'Your browser cannot draw 3D graphics.' })
    expect(boardViewSupport({ webgl: true })).toEqual({ ok: true })
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
  const original = window.matchMedia
  afterEach(() => {
    window.matchMedia = original
    vi.restoreAllMocks()
    vi.resetModules()
    delete (window as unknown as Record<string, unknown>).WebGLRenderingContext
  })

  it('reports no WebGL under jsdom', () => {
    const { result } = renderHook(() => useBoardViewSupport())
    expect(result.current).toEqual({ ok: false, reason: UNSUPPORTED_REASONS.webgl })
  })

  it('offers 3D on a touch-only phone-width screen when WebGL works, without asking any media query', async () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes('coarse') || query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    window.matchMedia = matchMedia as unknown as typeof window.matchMedia
    vi.resetModules()
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({})) as never)
    const mod = await import('../components/game/views/boardView')
    const { result } = renderHook(() => mod.useBoardViewSupport())
    expect(result.current).toEqual({ ok: true })
    expect(matchMedia).not.toHaveBeenCalled()
  })
})
