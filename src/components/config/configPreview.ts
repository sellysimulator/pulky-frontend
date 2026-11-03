/**
 * The host config screen's figures (spec §13.9, §13.10, §6.4) come from the server: `POST /config/preview`
 * computes them from the engine's own functions for the draft being edited. The panel asks once per edit,
 * after a pause, and shares the answer with every preview, help entry and the insurance calculator.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { previewConfig } from '../../api/config'
import type { ConfigPreview, GameConfig } from '../../types/game'

/** How long the panel waits after the last edit before it asks the server. */
export const CONFIG_PREVIEW_DEBOUNCE_MS = 300

export interface ConfigPreviewState {
  /** The figures for the draft on screen; null while they load or while the draft has an error. */
  preview: ConfigPreview | null
  /** The last figures received, for state that should not flicker while a newer answer loads. */
  latest: ConfigPreview | null
  /** True from an edit until the server has answered for that draft. */
  pending: boolean
}

const IDLE: ConfigPreviewState = { preview: null, latest: null, pending: false }

export const ConfigPreviewContext = createContext<ConfigPreviewState>(IDLE)

export function useConfigPreview(): ConfigPreviewState {
  return useContext(ConfigPreviewContext)
}

interface Answer {
  key: string
  preview: ConfigPreview | null
}

/** Asks the server for the draft's figures, `CONFIG_PREVIEW_DEBOUNCE_MS` after the last edit; an older answer is dropped. */
export function useConfigPreviewRequest(draft: GameConfig | null): ConfigPreviewState {
  const key = draft === null ? null : JSON.stringify(draft)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [latest, setLatest] = useState<ConfigPreview | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    const timer = setTimeout(() => {
      previewConfig(JSON.parse(key) as GameConfig)
        .then((res) => {
          if (cancelled) return
          setAnswer({ key, preview: res.preview })
          if (res.preview !== null) setLatest(res.preview)
        })
        .catch(() => {
          if (!cancelled) setAnswer({ key, preview: null })
        })
    }, CONFIG_PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key])

  const current = answer !== null && answer.key === key
  return { preview: current ? answer.preview : null, latest, pending: key !== null && !current }
}

/** Spec §13.10: shown in place of a figure while the server works it out. */
export const PREVIEW_LOADING = 'Working out the figures…'
/** Spec §13.10: shown in place of a figure while the draft has an error the server refuses. */
export const PREVIEW_UNAVAILABLE = 'Fix the settings marked in red to see the figures.'

/** The copy for a preview that has no figures yet: loading, or the draft has an error. */
export function previewGap(state: ConfigPreviewState): string {
  return state.pending ? PREVIEW_LOADING : PREVIEW_UNAVAILABLE
}
