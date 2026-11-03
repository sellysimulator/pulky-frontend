import { useState, type ReactElement } from 'react'
import Collapsible from '../shared/Collapsible'

/**
 * Spec §13.8: the talking points, in order. Two depend on the game's lead time: with 0 a delivery arrives the day
 * it ships, so the lead time caused nothing. Without a config (an older payload) they name neither case.
 */
function talkingPoints(leadTimeDays: number | null): string[] {
  const chart =
    leadTimeDays === null
      ? 'Look at the chart: did deliveries rise before Thursday or after? Futures exist so you can be early.'
      : leadTimeDays > 0
        ? 'Look at the chart: did deliveries rise before Thursday or after? Lead time and futures exist so you can be early.'
        : 'Look at the chart: did deliveries rise before Thursday or after? Deliveries arrived the day they shipped, but futures had to be bought days ahead.'
  const careless =
    leadTimeDays !== null && leadTimeDays > 0
      ? 'Nobody was careless: lead time, perishability and scarce supply produced these outcomes.'
      : 'Nobody was careless: perishability, uncertain demand and scarce supply produced these outcomes.'
  return [
    'Who made the most profit, and who wasted the most? Were they the same players?',
    chart,
    'Every spoiled unit was paid for twice: its price, and the reputation it cost.',
    "Backlog lowered the day's score, so reputation ended below where a clean day would have left it, and reputation is tomorrow's share of demand. Rivals gained what you gave up.",
    'Futures never beat spot on price on average; they win on availability on short days.',
    'Insurance: did refunds outweigh fees? Was sharing on, and what did that do to its value?',
    'Cooperation: on how many days did everyone agree, and who got served on short days?',
    'Peer market: who sold to whom on short days, and at what price? Did selling old units beat letting them spoil, and did any seller create its own backlog?',
    careless,
  ]
}

/** Block 6, host only: collapsed by default. */
export default function DebriefNotes({ leadTimeDays = null }: { leadTimeDays?: number | null }): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible variant="inline" summary="Debrief notes" open={open} onOpenChange={setOpen}>
      <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg">
        {talkingPoints(leadTimeDays).map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
    </Collapsible>
  )
}
