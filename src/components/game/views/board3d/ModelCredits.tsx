import type { ReactElement } from 'react'
import { FONT_CREDIT, MODEL_CREDITS, MODEL_LICENSE } from './assetCredits'

function Link({ href, children }: { href: string; children: string }): ReactElement {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
      {children}
    </a>
  )
}

/** CC BY 4.0 asks for the author, the licence, the source and the changes: shown here, in the file and in the README. */
export default function ModelCredits(): ReactElement {
  return (
    <details className="pointer-events-auto relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-ink shadow-card">
        3D model credits
      </summary>
      <ul className="absolute bottom-full left-0 mb-2 flex w-80 flex-col gap-2 rounded-md border border-border bg-card p-3 text-sm text-ink shadow-raised">
        {MODEL_CREDITS.map((credit) => (
          <li key={credit.file}>
            <Link href={credit.sourceUrl}>{credit.title}</Link> by <Link href={credit.authorUrl}>{credit.author}</Link>,{' '}
            <Link href={MODEL_LICENSE.url}>{MODEL_LICENSE.name}</Link>. Changes: {credit.changes}.
          </li>
        ))}
        <li>
          Font: <Link href={FONT_CREDIT.sourceUrl}>{FONT_CREDIT.name}</Link> by {FONT_CREDIT.author},{' '}
          <Link href={FONT_CREDIT.licenseUrl}>{FONT_CREDIT.license}</Link>.
        </li>
      </ul>
    </details>
  )
}
