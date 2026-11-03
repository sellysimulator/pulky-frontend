import { useEffect, useState } from 'react'
import { previewDecision } from '../api/games'
import type { DecisionDraft, DecisionPreview } from '../types/game'

/** How long the form waits after the last keystroke before it asks the server. */
export const PREVIEW_DEBOUNCE_MS = 250

export interface DecisionPreviewState {
  /** The server's figures for the draft on screen; null while they load, or when the server sent none. */
  preview: DecisionPreview | null
  /** True from an edit until the server has answered for that draft. */
  pending: boolean
}

interface Answer {
  key: string
  preview: DecisionPreview | null
}

/**
 * Spec §12.4: the decision form's figures come from the server (`preview_decision`), never from the client.
 * Each edit waits `PREVIEW_DEBOUNCE_MS`, then asks once; an answer for an older draft is dropped.
 */
export function useDecisionPreview(roomCode: string | null, draft: DecisionDraft): DecisionPreviewState {
  const key = JSON.stringify(draft)
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (roomCode === null) return
    let cancelled = false
    const timer = setTimeout(() => {
      previewDecision(roomCode, JSON.parse(key) as DecisionDraft)
        .then((reply) => {
          if (!cancelled) setAnswer({ key, preview: 'preview' in reply ? reply.preview : null })
        })
        .catch(() => {
          if (!cancelled) setAnswer({ key, preview: null })
        })
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [roomCode, key])

  const current = answer !== null && answer.key === key
  return { preview: current ? answer.preview : null, pending: roomCode !== null && !current }
}
