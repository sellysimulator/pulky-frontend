import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/http'
import { getMyGame } from '../../api/users'
import type { MyGameResponse } from '../../types/game'
import { InlineAlert } from '../shared/AlertContainer'
import LoadingSpinner from '../shared/LoadingSpinner'
import ResultsSummary from '../results/ResultsSummary'
import { resultsViewFromResponse } from '../results/resultsView'

type Outcome =
  | { publicId: string; kind: 'ok'; response: MyGameResponse }
  | { publicId: string; kind: 'missing' }
  | { publicId: string; kind: 'error'; message: string }

/** One played game, rendered by the game summary (ResultsView, spec §13.8) from the same response. */
export default function GameDetail({ publicId }: { publicId: string }): ReactElement {
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyGame(publicId).then(
      (response) => {
        if (!cancelled) setOutcome({ publicId, kind: 'ok', response })
      },
      (err: unknown) => {
        if (cancelled) return
        const status = (err as { response?: { status?: number } } | null)?.response?.status
        setOutcome(
          status === 404
            ? { publicId, kind: 'missing' }
            : { publicId, kind: 'error', message: errorMessage(err, 'Could not load your profile.') },
        )
      },
    )
    return () => {
      cancelled = true
    }
  }, [publicId])

  const current = outcome !== null && outcome.publicId === publicId ? outcome : null
  const response = current?.kind === 'ok' ? current.response : null
  const view = useMemo(() => (response ? resultsViewFromResponse(response) : null), [response])

  let body: ReactElement
  if (view !== null && response !== null) {
    body = (
      <ResultsSummary
        view={view}
        viewer={{ isHost: false, myAlias: response.my_alias }}
        showActions={false}
      />
    )
  } else if (current?.kind === 'missing') {
    body = <InlineAlert tone="warning">That game is not in your profile.</InlineAlert>
  } else if (current?.kind === 'error') {
    body = <InlineAlert tone="danger">{current.message}</InlineAlert>
  } else {
    body = <LoadingSpinner label="Loading your profile" />
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to profile
      </Link>
      {body}
    </div>
  )
}
