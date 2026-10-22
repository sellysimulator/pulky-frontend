import { Lightbulb } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import DataTable from '../shared/DataTable'

/** Bullets. */
export function Bullets({ items }: { items: ReactNode[] }): ReactElement {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Numbered steps; `start` continues a list from the previous page. */
export function Steps({ items, start = 1 }: { items: ReactNode[]; start?: number }): ReactElement {
  return (
    <ol start={start} className="flex list-decimal flex-col gap-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  )
}

/** A pulled-out rule or tip: the part a reader skims back to. */
export function Tip({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <aside className="flex gap-3 rounded-md border border-accent-line bg-accent-subtle px-4 py-3">
      <Lightbulb size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <div className="text-ink-muted">{children}</div>
      </div>
    </aside>
  )
}

interface TableRow {
  index: number
  cells: ReactNode[]
}

/** A small table; the first column is the row label. */
export function Table({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }): ReactElement {
  return (
    <DataTable
      caption={caption}
      density="compact"
      columns={head.map((header, c) => ({
        key: `c${c}`,
        header,
        align: c === 0 ? 'left' : 'right',
        render: (row: TableRow) => row.cells[c],
      }))}
      rows={rows.map((cells, index) => ({ index, cells }))}
      rowKey={(row) => String(row.index)}
    />
  )
}
