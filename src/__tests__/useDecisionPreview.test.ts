import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecisionDraft, DecisionPreview, DecisionPreviewAnswer } from '../types/game'

const h = vi.hoisted(() => ({ answers: [] as unknown[] }))

vi.mock('../api/games', () => ({
  previewDecision: vi.fn(async () => h.answers.shift()),
}))

import { PREVIEW_DEBOUNCE_MS, useDecisionPreview } from '../game/useDecisionPreview'

const draft = (order_spot: number): DecisionDraft => ({
  day: 1,
  order_spot,
  order_futures: 0,
  incoterm_tier: 'basic' as DecisionDraft['incoterm_tier'],
  conserve_lots: [],
  cooperate: false,
  peer_buy: null,
  peer_sell: null,
})

const preview = { day: 1, affordable: true, errors: [] } as unknown as DecisionPreview

async function answer(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS)
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  h.answers.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDecisionPreview without an answer (spec 0.6: over an abuse limit)', () => {
  it('a null acknowledgement keeps the last figures, settled and silent', async () => {
    h.answers.push({ preview } satisfies DecisionPreviewAnswer, null)
    const { result, rerender } = renderHook(({ d }) => useDecisionPreview('ABC234', d), {
      initialProps: { d: draft(10) },
    })
    await answer()
    expect(result.current).toEqual({ preview, pending: false })

    rerender({ d: draft(11) })
    expect(result.current.pending).toBe(true)
    await answer()
    expect(result.current).toEqual({ preview, pending: false })
  })

  it('an answer that names an error still leaves the figures blank', async () => {
    h.answers.push({ preview }, { code: 'NOT_IN_ROOM', message: 'You are not in this room.' })
    const { result, rerender } = renderHook(({ d }) => useDecisionPreview('ABC234', d), {
      initialProps: { d: draft(10) },
    })
    await answer()
    rerender({ d: draft(11) })
    await answer()
    expect(result.current).toEqual({ preview: null, pending: false })
  })
})
