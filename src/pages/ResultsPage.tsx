import { useEffect, useLayoutEffect, useMemo, useState, type ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import { errorMessage } from '../api/http'
import { getResultsByCode, getResultsById } from '../api/results'
import { applyChartScale } from '../components/charts/chartSetup'
import { resultsViewFromLive, resultsViewFromResponse, type ResultsView } from '../components/results/resultsView'
import ResultsSummary from '../components/results/ResultsSummary'
import AppHeader from '../components/shared/AppHeader'
import { InlineAlert } from '../components/shared/AlertContainer'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import type { PageRoute } from '../routes/registry'
import { useGameStore } from '../store/gameStore'
import { getHostSecret } from '../utils/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute[] = [
  { path: '/results/:roomCode', guard: 'public' },
  { path: '/results/g/:gameId', guard: 'public' },
]

/** A 404 means persistence is still running: retry after 1 s, then after 2 s (spec §13.8). */
const RETRY_DELAYS_MS = [1000, 2000]
const ROOT_PX_FALLBACK = 16

type Outcome =
  | { key: string; kind: 'ok'; view: ResultsView }
  | { key: string; kind: 'missing' }
  | { key: string; kind: 'error'; message: string }

function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } } | null)?.response?.status === 404
}

export default function ResultsPage(): ReactElement {
  const { roomCode: rawCode, gameId } = useParams()
  const code = rawCode?.toUpperCase() ?? null

  const finished = useGameStore((s) => s.finished)
  const storeRoom = useGameStore((s) => s.roomCode)
  const gamePublicId = useGameStore((s) => s.gamePublicId)
  const durationDays = useGameStore((s) => s.durationDays)
  const myAliasInStore = useGameStore((s) => s.myAlias)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.scale = 'debrief'
    const px = parseFloat(getComputedStyle(root).fontSize)
    applyChartScale(Number.isFinite(px) && px > 0 ? px : ROOT_PX_FALLBACK)
    return () => {
      delete root.dataset.scale
      applyChartScale(ROOT_PX_FALLBACK)
    }
  }, [])

  const liveUsable =
    finished !== null && (code !== null ? storeRoom === code : gameId !== undefined && gamePublicId === gameId)
  const liveView = useMemo(
    () =>
      liveUsable && finished !== null
        ? resultsViewFromLive(finished, {
            roomCode: code ?? storeRoom ?? '',
            durationDays: durationDays ?? finished.days_played,
          })
        : null,
    [liveUsable, finished, code, storeRoom, durationDays],
  )

  const key = code !== null ? `code:${code}` : `id:${gameId ?? ''}`
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (liveView !== null) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = code !== null ? () => getResultsByCode(code) : () => getResultsById(gameId ?? '')

    const attempt = async (n: number): Promise<void> => {
      try {
        const response = await load()
        if (!cancelled) setOutcome({ key, kind: 'ok', view: resultsViewFromResponse(response) })
      } catch (err) {
        if (cancelled) return
        if (isNotFound(err)) {
          if (n < RETRY_DELAYS_MS.length) {
            timer = setTimeout(() => void attempt(n + 1), RETRY_DELAYS_MS[n])
            return
          }
          setOutcome({ key, kind: 'missing' })
          return
        }
        setOutcome({ key, kind: 'error', message: errorMessage(err, 'Could not load the results.') })
      }
    }
    void attempt(0)

    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [liveView, code, gameId, key])

  const current = outcome !== null && outcome.key === key ? outcome : null
  const view = liveView ?? (current?.kind === 'ok' ? current.view : null)

  let body: ReactElement
  if (view !== null) {
    const hostSecret = getHostSecret(view.room_code)
    body = (
      <ResultsSummary
        view={view}
        viewer={{ isHost: hostSecret !== null, myAlias: storeRoom === view.room_code ? myAliasInStore : null }}
        showActions
        hostSecret={hostSecret}
      />
    )
  } else if (current?.kind === 'missing') {
    body = <InlineAlert tone="warning">Results aren't available yet.</InlineAlert>
  } else if (current?.kind === 'error') {
    body = <InlineAlert tone="danger">{current.message}</InlineAlert>
  } else {
    body = <LoadingSpinner label="Loading the results" />
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="print:hidden">
        <AppHeader />
      </div>
      <main className="mx-auto flex max-w-summary flex-col gap-6 px-4 py-8">{body}</main>
    </div>
  )
}
