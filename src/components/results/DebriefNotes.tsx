import { useState, type ReactElement } from 'react'
import Collapsible from '../shared/Collapsible'

/** Spec §13.8: the talking points, in order. */
const TALKING_POINTS = [
  'Who made the most profit, and who wasted the most? Were they the same players?',
  'Look at the chart: did deliveries rise before Thursday or after? Lead time and futures exist so you can be early.',
  'Every spoiled unit was paid for twice: its price, and the reputation it cost.',
  "Backlog lost reputation, and reputation is tomorrow's share of demand. Rivals gained what you lost.",
  'Futures never beat spot on price on average; they win on availability on short days.',
  'Insurance: did refunds outweigh fees? Was sharing on, and what did that do to its value?',
  'Cooperation: on how many days did everyone agree, and who got served on short days?',
  'Peer market: who sold to whom on short days, and at what price? Did selling old units beat letting them spoil, and did any seller create its own backlog?',
  'Nobody was careless: lead time, perishability and scarce supply produced these outcomes.',
]

/** Block 6, host only: collapsed by default. */
export default function DebriefNotes(): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible variant="inline" summary="Debrief notes" open={open} onOpenChange={setOpen}>
      <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg">
        {TALKING_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
    </Collapsible>
  )
}
