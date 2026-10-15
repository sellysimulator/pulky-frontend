import { LoaderCircle } from 'lucide-react'
import type { ReactElement } from 'react'

interface LoadingSpinnerProps {
  label: string
  size?: 16 | 24 | 40
}

/** The label is always visible: under reduced motion the text carries the state. */
export default function LoadingSpinner({ label, size = 24 }: LoadingSpinnerProps): ReactElement {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-muted">
      <LoaderCircle size={size} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      <span>{label}</span>
    </span>
  )
}
