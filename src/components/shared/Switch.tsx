import { Check } from 'lucide-react'
import type { ReactElement } from 'react'

interface SwitchProps {
  checked: boolean
  onChange(checked: boolean): void
  label: string
  disabled?: boolean
}

export default function Switch({ checked, onChange, label, disabled = false }: SwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex min-h-11 items-center gap-3 text-base',
        disabled ? 'cursor-not-allowed text-ink-subtle' : 'cursor-pointer text-ink',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'border border-border-control bg-muted',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 grid size-5 place-items-center rounded-full bg-card transition-transform',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5 border border-border-control',
          ].join(' ')}
        >
          {checked ? <Check size={12} strokeWidth={3} className="text-accent" /> : null}
        </span>
      </span>
      <span>{label}</span>
    </button>
  )
}
