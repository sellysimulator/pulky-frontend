import { UsersRound, Wifi, WifiOff } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Participant } from '../../types/game'
import EmptyState from '../shared/EmptyState'
import { PulqueriaChip } from '../shared/Badge'

interface ParticipantListProps {
  participants: Participant[]
  seatsTotal: number | null
  myAlias?: string | null
}

const aliasNumber = (alias: string): number => Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)

export default function ParticipantList({ participants, seatsTotal, myAlias = null }: ParticipantListProps): ReactElement {
  const n = participants.length
  const sorted = [...participants].sort((a, b) => aliasNumber(a.alias) - aliasNumber(b.alias))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-medium tabular-nums">
        {seatsTotal === null ? `${n} seated` : `${n} of ${seatsTotal} seats taken`}
      </p>
      {n === 0 ? (
        <EmptyState icon={UsersRound} title="No one has joined yet" body="Share the room code or the invite link." />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((p) => {
            const Icon = p.connected ? Wifi : WifiOff
            return (
              <li key={p.alias} className="flex items-center justify-between gap-3">
                <PulqueriaChip alias={p.alias} displayName={p.display_name} you={p.alias === myAlias} />
                <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                  <Icon size={16} aria-hidden="true" />
                  <span>{p.connected ? 'connected' : 'disconnected'}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
