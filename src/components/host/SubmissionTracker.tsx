import { CircleCheck, CircleDashed } from 'lucide-react'
import type { ReactElement } from 'react'
import type { HostView } from '../../types/game'
import Badge from '../shared/Badge'
import SectionCard from '../shared/SectionCard'

interface SubmissionTrackerProps {
  hostView: HostView
}

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

/** Names and a state word only: decision contents never reach the host before the day resolves (spec §11.4). */
export default function SubmissionTracker({ hostView }: SubmissionTrackerProps): ReactElement {
  const aliases = Object.keys(hostView.players).sort((a, b) => aliasNumber(a) - aliasNumber(b))
  return (
    <SectionCard title="Submissions" density="dense">
      <ul className="flex flex-wrap gap-2">
        {aliases.map((alias) => {
          const player = hostView.players[alias]
          const done = player.has_submitted && !hostView.awaiting.includes(alias)
          return (
            <li key={alias}>
              <Badge tone={done ? 'success' : 'neutral'} icon={done ? CircleCheck : CircleDashed}>
                {`${player.display_name} ${done ? 'submitted' : 'deciding'}`}
              </Badge>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
