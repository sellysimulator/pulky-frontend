import { Check } from 'lucide-react'
import { useId, type ReactElement } from 'react'

interface LegendItem {
  key: string
  label: string
  swatch: { kind: 'line' | 'fill'; color: string; dash?: number[]; pointStyle?: string; hatched?: boolean; width?: number }
}

function Marker({ style, color }: { style: string; color: string }): ReactElement {
  const c = 12
  const y = 6
  switch (style) {
    case 'rect':
      return <rect x={c - 3.5} y={y - 3.5} width="7" height="7" fill={color} />
    case 'rectRot':
      return <rect x={c - 3.5} y={y - 3.5} width="7" height="7" fill={color} transform={`rotate(45 ${c} ${y})`} />
    case 'triangle':
      return <polygon points={`${c},${y - 4} ${c + 4},${y + 3} ${c - 4},${y + 3}`} fill={color} />
    case 'star':
      return (
        <polygon
          points={`${c},${y - 4.5} ${c + 1.2},${y - 1.4} ${c + 4.5},${y - 1.2} ${c + 1.9},${y + 0.9} ${c + 2.8},${y + 4} ${c},${y + 2.2} ${c - 2.8},${y + 4} ${c - 1.9},${y + 0.9} ${c - 4.5},${y - 1.2} ${c - 1.2},${y - 1.4}`}
          fill={color}
        />
      )
    case 'crossRot':
      return (
        <path
          d={`M${c - 3.5} ${y - 3.5}L${c + 3.5} ${y + 3.5}M${c + 3.5} ${y - 3.5}L${c - 3.5} ${y + 3.5}`}
          stroke={color}
          strokeWidth="2"
          fill="none"
        />
      )
    default:
      return <circle cx={c} cy={y} r="3.5" fill={color} />
  }
}

function Swatch({ swatch }: { swatch: LegendItem['swatch'] }): ReactElement {
  const patternId = `legend-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (swatch.kind === 'line') {
    return (
      <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          y1="6"
          x2="24"
          y2="6"
          stroke={swatch.color}
          strokeWidth={swatch.width ?? 2.5}
          strokeLinecap="round"
          strokeDasharray={swatch.dash && swatch.dash.length > 0 ? swatch.dash.join(' ') : undefined}
        />
        {swatch.pointStyle ? <Marker style={swatch.pointStyle} color={swatch.color} /> : null}
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 rounded-xs">
      {swatch.hatched ? (
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={swatch.color} />
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1.5" className="stroke-card" />
          </pattern>
        </defs>
      ) : null}
      <rect width="12" height="12" fill={swatch.hatched ? `url(#${patternId})` : swatch.color} />
    </svg>
  )
}

interface LegendProps {
  items: LegendItem[]
  hidden?: ReadonlySet<string>
  onToggle?(key: string): void
  onFocusItem?(key: string | null): void
}

/** Static list, switches or emphasis, by the props given (design.md §7.18, §9.2). The chart owns the state. */
export default function Legend({ items, hidden, onToggle, onFocusItem }: LegendProps): ReactElement {
  const switches = hidden !== undefined && onToggle !== undefined
  const focusProps = (key: string) =>
    onFocusItem
      ? {
          onPointerEnter: () => onFocusItem(key),
          onPointerLeave: () => onFocusItem(null),
          onFocus: () => onFocusItem(key),
          onBlur: () => onFocusItem(null),
        }
      : {}

  if (switches) {
    return (
      <ul className="flex flex-wrap gap-x-4 gap-y-2 print:hidden">
        {items.map((item) => {
          const on = !hidden.has(item.key)
          return (
            <li key={item.key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onToggle(item.key)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border-control px-3 text-sm"
                {...focusProps(item.key)}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'grid size-4 shrink-0 place-items-center rounded-xs border border-border-control',
                    on ? 'bg-accent text-on-accent' : 'bg-card',
                  ].join(' ')}
                >
                  {on ? <Check size={12} /> : null}
                </span>
                <span className={on ? '' : 'opacity-30'}>
                  <Swatch swatch={item.swatch} />
                </span>
                <span className={on ? 'text-ink' : 'text-ink-subtle'}>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => (
        <li
          key={item.key}
          className={[
            'flex items-center gap-2 text-sm text-ink-muted',
            onFocusItem ? 'rounded-xs focus-visible:ring-2 focus-visible:ring-ring' : '',
          ].join(' ')}
          {...(onFocusItem ? { tabIndex: 0, ...focusProps(item.key) } : {})}
        >
          <Swatch swatch={item.swatch} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
