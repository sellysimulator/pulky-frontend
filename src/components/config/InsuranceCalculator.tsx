import { Calculator, CircleAlert, CircleCheck, CircleSlash, Scale, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import {
  breakEvenFee,
  chanceOfAtLeastOneFailure,
  expectedFailures,
  feeFromMargin,
  ratioBadge,
  worstSingleFailureLoss,
  type BreakEvenInput,
  type RatioBadge,
} from '../../game/configMath'
import { INSURED_TIERS, type ConfigFieldMeta, type GameConfig, type InsuredTier } from '../../types/game'
import { INCOTERM_TIER_NAMES, formatMoney, formatPercent } from '../../utils/format'
import { InlineAlert } from '../shared/AlertContainer'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import DataTable from '../shared/DataTable'
import NumberField from '../shared/NumberField'
import StatTile from '../shared/StatTile'
import Switch from '../shared/Switch'
import { DOCS } from './docs/entries'
import InfoButton from './docs/InfoButton'
import { CALCULATOR_HIDDEN_NOTE, HIDDEN_FIGURE } from './hiddenDefaults'

interface InsuranceCalculatorProps {
  config: GameConfig
  onChange(patch: object): void
  readOnly: boolean
  issues?: Record<string, { kind: 'error' | 'warning'; message: string }>
  /** `GET /config/defaults` field entries: the inputs' bounds come from the server (spec §13.9). */
  fields?: Record<string, ConfigFieldMeta>
}

const VERDICTS: Record<RatioBadge, { tone: 'success' | 'info' | 'warning' | 'neutral'; icon: LucideIcon; text: string }> = {
  worth_it: { tone: 'success', icon: CircleCheck, text: 'Worth it' },
  break_even: { tone: 'info', icon: Scale, text: 'Break-even' },
  not_worth_it: { tone: 'warning', icon: TriangleAlert, text: 'Not worth it on average' },
  no_risk: { tone: 'neutral', icon: CircleSlash, text: 'No risk configured' },
}

/** A break-even figure, or null while it would need a hidden default (spec §6.4). */
interface TierRow {
  tier: InsuredTier
  name: string
  enabled: boolean
  fee: number
  solo: number | null
  shared: number | null
  refund: number
  worstSolo: number | null
  worstShared: number | null
}

interface CaseRow {
  key: string
  transport: string
  breakEven: number | null
  worst: number | null
}

/** A draft value that is mid-edit (empty) counts as 0 so nothing here ever shows NaN or Infinity. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/** Null while the failure chance or the loss share is a hidden default: the break-even fee would reveal it. */
function inputFor(config: GameConfig, shared: boolean): BreakEvenInput | null {
  const { failure_probability: p, loss_fraction: l } = config.transport
  if (p === null || l === null) return null
  return {
    failureProbability: finite(p),
    lossFraction: finite(l),
    shared,
    nRef: Math.max(1, finite(config.max_players)),
    referenceShipment: Math.max(1, finite(config.insurance.reference_shipment)),
    basePrice: finite(config.supplier.base_price),
    retailPrice: finite(config.demand.retail_price),
  }
}

function Verdict({ fee, breakEven }: { fee: number; breakEven: number }): ReactElement {
  const v = VERDICTS[ratioBadge(fee, breakEven)]
  return (
    <Badge tone={v.tone} icon={v.icon}>
      {v.text}
    </Badge>
  )
}

function docLabel(path: string): string {
  return (DOCS[path] as (typeof DOCS)[string] | undefined)?.label ?? path
}

function Hidden(): ReactElement {
  return <span className="text-ink-muted">{HIDDEN_FIGURE}</span>
}

export default function InsuranceCalculator({ config, onChange, readOnly, issues = {}, fields = {} }: InsuranceCalculatorProps): ReactElement {
  const seats = config.max_players
  const solo = inputFor(config, false)
  const shared = inputFor(config, true)
  const current = config.transport.shared ? shared : solo
  const margin = finite(config.insurance.target_margin)
  const p = config.transport.failure_probability === null ? null : finite(config.transport.failure_probability)
  const days = finite(config.duration_days)
  const bounds = (path: string): { min?: number; max?: number } => {
    const meta = fields[path] as ConfigFieldMeta | undefined
    return { min: meta?.min ?? undefined, max: meta?.max ?? undefined }
  }

  const rows: TierRow[] = INSURED_TIERS.map((tier) => {
    const t = config.insurance.tiers[tier]
    return {
      tier,
      name: INCOTERM_TIER_NAMES[tier],
      enabled: t.enabled,
      fee: finite(t.fee),
      solo: solo === null ? null : breakEvenFee(tier, solo),
      shared: shared === null ? null : breakEvenFee(tier, shared),
      refund: tier === 'ddp' ? finite(config.demand.retail_price) : finite(config.supplier.base_price),
      worstSolo: solo === null ? null : worstSingleFailureLoss(tier, solo),
      worstShared: shared === null ? null : worstSingleFailureLoss(tier, shared),
    }
  })

  const outOfSync = rows.flatMap((row) => {
    if (!row.enabled || current === null) return []
    const be = breakEvenFee(row.tier, current)
    if (be <= 0) return []
    if (Math.abs(row.fee - feeFromMargin(be, margin)) < 1e-9) return []
    return [`${row.name} ratio ${(row.fee / be).toFixed(2)} — target ${(1 + margin).toFixed(2)}`]
  })

  const setFees = (): void => {
    if (current === null) return
    const tiers: Record<string, { fee: number }> = {}
    for (const row of rows) {
      if (row.enabled) tiers[row.tier] = { fee: feeFromMargin(breakEvenFee(row.tier, current), margin) }
    }
    if (Object.keys(tiers).length > 0) onChange({ insurance: { tiers } })
  }

  const errorAt = (path: string): string | undefined => (issues[path]?.kind === 'error' ? issues[path].message : undefined)
  const warningAt = (path: string): string | undefined => (issues[path]?.kind === 'warning' ? issues[path].message : undefined)
  const messageFor = (path: string): ReactElement | null => {
    const issue = issues[path] as { kind: 'error' | 'warning'; message: string } | undefined
    if (!issue) return null
    return (
      <p
        id={`${path}-issue`}
        className={['flex items-center gap-1.5 text-sm', issue.kind === 'error' ? 'text-danger-ink' : 'text-warning-ink'].join(' ')}
      >
        {issue.kind === 'error' ? (
          <CircleAlert size={16} aria-hidden="true" className="text-danger" />
        ) : (
          <TriangleAlert size={16} aria-hidden="true" className="text-warning" />
        )}
        {issue.message}
      </p>
    )
  }
  const sharedLabel = `Shared with ${seats}`
  const dim = (row: TierRow): string => (row.enabled ? '' : 'text-ink-subtle')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator size={20} aria-hidden="true" className="text-ink-muted" />
        <h3 className="text-base font-semibold">Insurance calculator</h3>
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex items-end gap-1">
          <NumberField
            label="Reference shipment (units)"
            kind="quantity"
            {...bounds('insurance.reference_shipment')}
            value={config.insurance.reference_shipment}
            readOnly={readOnly}
            error={errorAt('insurance.reference_shipment')}
            warning={warningAt('insurance.reference_shipment')}
            onChange={(v) => onChange({ insurance: { reference_shipment: v } })}
          />
          <InfoButton entryKey="insurance.reference_shipment" config={config} />
        </div>
        <div className="flex items-end gap-1">
          <NumberField
            label="Target margin"
            kind="decimal"
            {...bounds('insurance.target_margin')}
            value={config.insurance.target_margin}
            readOnly={readOnly}
            error={errorAt('insurance.target_margin')}
            warning={warningAt('insurance.target_margin')}
            onChange={(v) => onChange({ insurance: { target_margin: v } })}
          />
          <InfoButton entryKey="insurance.target_margin" config={config} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <StatTile
          label="Chance of at least one failure"
          value={p === null ? HIDDEN_FIGURE : formatPercent(chanceOfAtLeastOneFailure(p, days))}
        />
        <StatTile label="Expected failures" value={p === null ? HIDDEN_FIGURE : expectedFailures(p, days).toFixed(1)} />
      </div>
      {rows.map((row) => {
        const cases: CaseRow[] = [
          { key: 'solo', transport: 'Not shared', breakEven: row.solo, worst: row.worstSolo },
          { key: 'shared', transport: sharedLabel, breakEven: row.shared, worst: row.worstShared },
        ]
        return (
          <div key={row.tier} role="group" aria-label={row.name} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                <Switch
                  checked={row.enabled}
                  disabled={readOnly}
                  label={docLabel(`insurance.tiers.${row.tier}.enabled`)}
                  onChange={(v) => onChange({ insurance: { tiers: { [row.tier]: { enabled: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${row.tier}.enabled`} config={config} />
                {row.enabled ? null : <Badge tone="neutral">Not offered</Badge>}
              </div>
              {messageFor(`insurance.tiers.${row.tier}.enabled`)}
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="pt-3 text-sm text-ink-muted">
                  Fee per unit
                </span>
                <NumberField
                  label={docLabel(`insurance.tiers.${row.tier}.fee`)}
                  error={errorAt(`insurance.tiers.${row.tier}.fee`)}
                  warning={warningAt(`insurance.tiers.${row.tier}.fee`)}
                  hideLabel
                  kind="money"
                  {...bounds(`insurance.tiers.${row.tier}.fee`)}
                  value={config.insurance.tiers[row.tier].fee}
                  readOnly={readOnly}
                  onChange={(v) => onChange({ insurance: { tiers: { [row.tier]: { fee: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${row.tier}.fee`} config={config} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Refund per lost unit</span>
                <span className={['font-semibold tabular-nums', dim(row)].join(' ')}>{formatMoney(row.refund)}</span>
              </div>
            </div>
            <DataTable
              caption={`${row.name} break-even`}
              density="compact"
              columns={[
                { key: 'transport', header: 'Transport', render: (c: CaseRow) => <span className={dim(row)}>{c.transport}</span> },
                {
                  key: 'break-even',
                  header: 'Break-even',
                  align: 'right',
                  render: (c) => <span className={dim(row)}>{c.breakEven === null ? <Hidden /> : formatMoney(c.breakEven)}</span>,
                },
                {
                  key: 'verdict',
                  header: 'Verdict',
                  render: (c) => (
                    <span className={dim(row)}>
                      {c.breakEven === null ? <Hidden /> : <Verdict fee={row.fee} breakEven={c.breakEven} />}
                    </span>
                  ),
                },
                {
                  key: 'worst',
                  header: 'Worst single failure',
                  align: 'right',
                  render: (c) => <span className={dim(row)}>{c.worst === null ? <Hidden /> : formatMoney(c.worst)}</span>,
                },
              ]}
              rows={cases}
              rowKey={(c) => c.key}
            />
          </div>
        )
      })}
      <div className="flex flex-col gap-3">
        {outOfSync.map((text) => (
          <InlineAlert key={text} tone="warning">
            {text}
          </InlineAlert>
        ))}
        {readOnly ? null : (
          <div className="flex flex-col gap-2">
            <div>
              <Button variant="secondary" onClick={setFees} disabled={current === null}>
                Set fees from margin
              </Button>
            </div>
            {current === null ? <p className="text-sm text-ink-muted">{CALCULATOR_HIDDEN_NOTE}</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}
