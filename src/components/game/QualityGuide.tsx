import { Gauge } from 'lucide-react'
import type { ReactElement } from 'react'
import type { PlayerView } from '../../types/game'
import { formatQualityGuide } from '../../utils/format'

interface QualityGuideProps {
  view: PlayerView
  minQuality: number | null
}

/** The server's guide row for the chosen minimum quality (spec §3.5); the note is in the row's info tip. */
export default function QualityGuide({ view, minQuality }: QualityGuideProps): ReactElement | null {
  if (minQuality === null) return null
  const row = view.quality_guide.find((r) => r.quality === minQuality)
  if (!row) return null
  return (
    <p className="flex items-start gap-2 text-sm text-ink-muted tabular-nums">
      <Gauge size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{formatQualityGuide(row, view.day)}</span>
    </p>
  )
}
