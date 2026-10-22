import type { ReactElement, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BrandMark from '../shared/BrandMark'

interface ManualLayoutProps {
  title: string
  /** One sentence: who this manual is for. */
  audience: string
  otherManual: { to: string; label: string }
  children: ReactNode
}

/**
 * The frame both manuals share. A manual is public and backend-independent
 * (spec §13.15): it is read before sign-in, often on a phone, so nothing here
 * touches auth, the store, the socket or the API.
 */
export default function ManualLayout({ title, audience, otherManual, children }: ManualLayoutProps): ReactElement {
  return (
    <main id="main" className="mx-auto flex w-full max-w-summary flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <nav aria-label="Manuals" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link to="/" className="flex items-center gap-2 font-semibold text-ink hover:text-accent-hover">
            <BrandMark className="size-6" />
            <span className="font-display text-base font-bold">Pulky</span>
          </Link>
          <Link to={otherManual.to} className="font-semibold text-accent underline-offset-2 hover:text-accent-hover hover:underline">
            {otherManual.label}
          </Link>
        </nav>
        <h1 className="text-3xl">{title}</h1>
        <p className="text-ink-muted">{audience}</p>
      </header>
      {children}
    </main>
  )
}
