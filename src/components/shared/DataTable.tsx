import type { ReactElement, ReactNode } from 'react'

export interface Column<R> {
  key: string
  header: string
  align?: 'left' | 'right'
  render(row: R): ReactNode
}

interface DataTableProps<R> {
  caption: string
  captionVisible?: boolean
  columns: Column<R>[]
  rows: R[]
  rowKey(row: R): string
  highlightRow?(row: R): boolean
  density?: 'standard' | 'compact'
  stickyFirstColumn?: boolean
  groups?: Array<{ label: string; span: number }>
}

export default function DataTable<R>({
  caption,
  captionVisible = false,
  columns,
  rows,
  rowKey,
  highlightRow,
  density = 'standard',
  stickyFirstColumn = false,
  groups,
}: DataTableProps<R>): ReactElement {
  const compact = density === 'compact'
  const cellPad = compact ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-base'
  const align = (c: Column<R>): string => (c.align === 'right' ? 'text-right tabular-nums' : 'text-left')
  const sticky = (index: number, bg: string): string =>
    stickyFirstColumn && index === 0 ? `sticky left-0 border-r border-border ${bg}` : ''

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <caption className={captionVisible ? 'caption-top px-3 py-2 text-left text-sm text-ink-muted' : 'sr-only'}>{caption}</caption>
        <thead className="bg-inset text-xs font-semibold text-ink-muted">
          {groups ? (
            <tr>
              {groups.map((g, i) => (
                <th key={g.label} colSpan={g.span} className={['px-3 py-2 text-left', i > 0 ? 'border-l border-border' : ''].join(' ')}>
                  {g.label}
                </th>
              ))}
            </tr>
          ) : null}
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} className={['px-3 py-2', align(c), sticky(i, 'bg-inset')].join(' ')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const highlighted = highlightRow?.(row) ?? false
            return (
              <tr
                key={rowKey(row)}
                className={['border-t border-border', highlighted ? 'bg-accent-subtle' : 'hover:bg-inset'].join(' ')}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={[
                      cellPad,
                      align(c),
                      highlighted && i === 0 ? 'font-semibold' : '',
                      sticky(i, highlighted ? 'bg-accent-subtle' : 'bg-card'),
                    ].join(' ')}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
