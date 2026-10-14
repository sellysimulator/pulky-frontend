import { ChartLine, Table } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import Button from './Button'

interface ChartBoxProps {
  title: string
  caption?: string
  ariaLabel: string
  height: number
  legend?: ReactNode
  table: ReactNode
  children: ReactNode
}

/** Every chart lives in a ChartBox with a table view of the same values (design.md §7.18, §9.4). */
export default function ChartBox({ title, caption, ariaLabel, height, legend, table, children }: ChartBoxProps): ReactElement {
  const [showTable, setShowTable] = useState(false)
  const plotHeight = `${height / 16}rem`
  return (
    <figure className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <figcaption className="flex items-center gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-semibold">{title}</span>
          {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          icon={showTable ? ChartLine : Table}
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </Button>
      </figcaption>
      {legend ? <div>{legend}</div> : null}
      {showTable ? (
        <div className="overflow-auto" style={{ maxHeight: plotHeight }}>
          {table}
        </div>
      ) : (
        <div role="img" aria-label={ariaLabel} className="relative" style={{ height: plotHeight }}>
          {children}
        </div>
      )}
    </figure>
  )
}
