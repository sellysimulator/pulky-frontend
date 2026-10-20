import type { ManualPageSpec } from './ManualBook'

export const CONTINUED = ', continued'

/**
 * The contents page, built from the body pages so a page that moves cannot
 * leave a wrong number behind. `offset` is the pages before the body: the
 * cover and this page. A continuation is listed under the page it continues.
 */
export function contentsPage(body: ManualPageSpec[], offset = 2): ManualPageSpec {
  return {
    id: 'contents',
    heading: 'Contents',
    content: (
      <ul className="flex flex-col gap-1.5">
        {body.map((page, index) =>
          page.heading && !page.heading.endsWith(CONTINUED) ? (
            <li key={page.id} className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 text-right text-xs text-ink-subtle tabular-nums">{index + offset + 1}</span>
              <span>{page.heading}</span>
              <span aria-hidden="true" className="flex-1 border-b border-dotted border-border-strong" />
            </li>
          ) : null,
        )}
      </ul>
    ),
  }
}
