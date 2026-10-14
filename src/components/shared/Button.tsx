import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, MouseEvent, ReactElement } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-solid'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  loading?: boolean
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'bg-card text-ink border border-border-control hover:bg-inset active:bg-muted',
  ghost: 'text-ink-muted hover:bg-muted hover:text-ink active:bg-muted',
  destructive: 'bg-card text-danger-ink border border-danger-line hover:bg-danger-subtle active:bg-danger-subtle',
  'destructive-solid': 'bg-danger text-on-danger hover:bg-danger-hover active:bg-danger-hover',
}

// Disabled is a fill and a cursor, never opacity (design.md §7.1).
const DISABLED = 'bg-muted text-ink-subtle border border-border cursor-not-allowed'

const SIZES: Record<NonNullable<ButtonProps['size']>, { box: string; icon: number }> = {
  sm: { box: 'h-9 px-3 text-sm', icon: 16 },
  md: { box: 'h-11 px-4 text-base', icon: 18 },
  lg: { box: 'h-[3.25rem] px-6 text-lg', icon: 20 },
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  className,
  onClick,
  type = 'button',
  children,
  ...rest
}: ButtonProps): ReactElement {
  const { box, icon: iconSize } = SIZES[size]
  const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
    if (loading) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-busy={loading ? true : undefined}
      onClick={handleClick}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-colors',
        box,
        disabled ? DISABLED : `${VARIANTS[variant]} cursor-pointer`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <LoaderCircle size={iconSize} aria-hidden="true" className="animate-spin" />
      ) : Icon ? (
        <Icon size={iconSize} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}
