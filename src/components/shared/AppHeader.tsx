import { CircleUser, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import BrandMark from './BrandMark'

function Avatar({ photoURL, initial, guest }: { photoURL: string | null; initial: string; guest: boolean }): ReactElement {
  const [failed, setFailed] = useState(false)
  if (guest) {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-muted text-ink-muted">
        <UserRound size={18} aria-hidden="true" />
      </span>
    )
  }
  if (photoURL && !failed) {
    return (
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-8 rounded-full object-cover"
      />
    )
  }
  return (
    <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-accent-subtle font-display font-bold text-accent-hover">
      {initial}
    </span>
  )
}

export default function AppHeader({ context }: { context?: ReactNode }): ReactElement {
  const { mode, user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onPointer = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [menuOpen])

  const guest = mode === 'guest'
  const source = user?.displayName?.trim() || user?.email?.trim() || ''
  const initial = source ? Array.from(source)[0].toUpperCase() : '?'

  return (
    <header className="h-14 border-b border-border bg-card">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex h-full max-w-console items-center gap-4 px-4 md:px-6">
        <Link to="/home" className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="font-display text-xl font-bold">Pulky</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {context}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Account"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 text-sm font-medium text-ink-muted transition-colors hover:bg-muted"
            >
              <Avatar photoURL={user?.photoURL ?? null} initial={initial} guest={guest} />
              {guest ? <span>Guest</span> : null}
            </button>
            {menuOpen ? (
              <div role="menu" className="absolute top-full right-0 z-40 mt-1 flex min-w-44 flex-col rounded-md border border-border bg-card p-1 shadow-raised">
                {mode === 'authenticated' ? (
                  <Link
                    role="menuitem"
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded-sm px-3 text-base hover:bg-inset"
                  >
                    <CircleUser size={18} aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void signOut()
                  }}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-left text-base hover:bg-inset"
                >
                  <LogOut size={18} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
