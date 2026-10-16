import { Trophy } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { formatMoney } from '../../utils/format'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import SectionCard from '../shared/SectionCard'
import type { ResultsView } from './resultsView'

interface LeaderboardProps {
  view: ResultsView
  revealedByDefault: boolean
  myAlias: string | null
}

/** Block 1 of spec §13.8: one card per pulquería by rank; the profits wait for Reveal when the host projects. */
export default function Leaderboard({ view, revealedByDefault, myAlias }: LeaderboardProps): ReactElement {
  const [revealed, setRevealed] = useState(revealedByDefault)
  return (
    <SectionCard
      title="1. Leaderboard"
      actions={
        revealed ? undefined : (
          <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>
            Reveal
          </Button>
        )
      }
    >
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {view.players.map((p) => {
          const mine = p.alias === myAlias
          return (
            <li
              key={p.alias}
              className={[
                'flex flex-col gap-2 rounded-lg border border-border bg-card p-4',
                mine ? 'ring-2 ring-accent' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold text-ink-muted">{p.rank}</span>
                {p.rank === 1 ? <Trophy size={20} aria-label="First place" className="text-ochre" /> : null}
                <span className="min-w-0 truncate text-lg font-semibold">{p.display_name}</span>
                {mine ? <Badge tone="accent">You</Badge> : null}
              </div>
              {revealed ? (
                <span className="text-figure tabular-nums">{formatMoney(p.total_profit)}</span>
              ) : (
                <span className="block h-12 w-40 rounded-sm bg-muted">
                  <span className="sr-only">hidden until revealed</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <ul className="hidden columns-3 gap-x-4 print:block">
        {view.players.map((p) => (
          <li key={p.alias} className="flex gap-2 text-sm break-inside-avoid">
            <span>{p.rank}</span>
            <span className="min-w-0 flex-1 truncate">{p.display_name}</span>
            <span data-profit={formatMoney(p.total_profit)} className="tabular-nums after:content-[attr(data-profit)]" />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
