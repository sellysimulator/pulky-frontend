import { History } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import type { DayRecord, Participant, PlayerView, PublicConfig, PublicDayResults } from '../../types/game'
import Collapsible from '../shared/Collapsible'
import SectionCard from '../shared/SectionCard'
import DayRecap from './DayRecap'
import YesterdayKpis from './YesterdayKpis'

interface YesterdayRecapProps {
  view: PlayerView
  config: PublicConfig
  lastRecord: DayRecord | null
  publicHistory: PublicDayResults[]
  participants: Participant[]
}

export default function YesterdayRecap({ view, config, lastRecord, publicHistory, participants }: YesterdayRecapProps): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <SectionCard title="Yesterday" icon={History}>
      {view.yesterday === null ? (
        <p className="text-base text-ink-muted">Your first day. Yesterday's results appear here from day 2.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <YesterdayKpis yesterday={view.yesterday} peerMarket={config.peer_market.enabled} />
          {lastRecord ? (
            <Collapsible variant="inline" summary="Recap" open={open} onOpenChange={setOpen}>
              <DayRecap record={lastRecord} view={view} publicHistory={publicHistory} participants={participants} />
            </Collapsible>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
