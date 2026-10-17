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
import { INSURED_TIERS, type GameConfig, type InsuredTier } from '../../types/game'
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

interface InsuranceCalculatorProps {
  config: GameConfig
  onChange(patch: object): void
  readOnly: boolean
  issues?: Record<string, { kind: 'error' | 'warning'; message: string }>
}

const VERDICTS: Record<RatioBadge, { tone: 'success' | 'info' | 'warning' | 'neutral'; icon: LucideIcon; text: string }> = {
  worth_it: { tone: 'success', icon: CircleCheck, text: 'Worth it' },
  break_even: { tone: 'info', icon: Scale, text: 'Break-even' },
  not_worth_it: { tone: 'warning', icon: TriangleAlert, text: 'Not worth it on average' },
  no_risk: { tone: 'neutral', icon: CircleSlash, text: 'No risk configured' },
}

interface TierRow {
  tier: InsuredTier
  name: string
  enabled: boolean
  fee: number
  solo: number
  shared: number
  refund: number
  worstSolo: number
  worstShared: number
}

/** A draft value that is mid-edit (empty) counts as 0 so nothing here ever shows NaN or Infinity. */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function inputFor(config: GameConfig, shared: boolean): BreakEvenInput {
  return {
    failureProbability: finite(config.transport.failure_probability),
    lossFraction: finite(config.transport.loss_fraction),
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

export default function InsuranceCalculator({ config, onChange, readOnly, issues = {} }: InsuranceCalculatorProps): ReactElement {
  const seats = config.max_players
  const solo = inputFor(config, false)
  const shared = inputFor(config, true)
  const current = config.transport.shared ? shared : solo
  const margin = finite(config.insurance.target_margin)
  const p = finite(config.transport.failure_probability)
  const days = finite(config.duration_days)

  const rows: TierRow[] = INSURED_TIERS.map((tier) => {
    const t = config.insurance.tiers[tier]
    return {
      tier,
      name: INCOTERM_TIER_NAMES[tier],
      enabled: t.enabled,
      fee: finite(t.fee),
      solo: breakEvenFee(tier, solo),
      shared: breakEvenFee(tier, shared),
      refund: tier === 'ddp' ? solo.retailPrice : solo.basePrice,
      worstSolo: worstSingleFailureLoss(tier, solo),
      worstShared: worstSingleFailureLoss(tier, shared),
    }
  })

  const outOfSync = rows.flatMap((row) => {
    if (!row.enabled) return []
    const be = breakEvenFee(row.tier, current)
    if (be <= 0) return []
    if (Math.abs(row.fee - feeFromMargin(be, margin)) < 1e-9) return []
    return [`${row.name} ratio ${(row.fee / be).toFixed(2)} — target ${(1 + margin).toFixed(2)}`]
  })

  const setFees = (): void => {
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
            min={1}
            max={9999}
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
            min={-0.5}
            max={2}
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
        <StatTile label="Chance of at least one failure" value={formatPercent(chanceOfAtLeastOneFailure(p, days))} />
        <StatTile label="Expected failures" value={expectedFailures(p, days).toFixed(1)} />
      </div>
      <DataTable
        caption="Insurance tiers"
        density="compact"
        groups={[
          { label: ' ', span: 2 },
          { label: 'Not shared', span: 2 },
          { label: sharedLabel, span: 2 },
          { label: '​', span: 1 },
          { label: 'Worst single failure', span: 2 },
        ]}
        columns={[
          {
            key: 'tier',
            header: 'Tier',
            render: (row: TierRow) => (
              <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                <Switch
                  checked={row.enabled}
                  disabled={readOnly}
                  label={docLabel(`insurance.tiers.${row.tier}.enabled`)}
                  onChange={(v) => onChange({ insurance: { tiers: { [row.tier]: { enabled: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${row.tier}.enabled`} config={config} />
                {row.enabled ? null : <Badge tone="neutral">Not offered</Badge>}
              </span>
              {messageFor(`insurance.tiers.${row.tier}.enabled`)}
              </span>
            ),
          },
          {
            key: 'fee',
            header: 'Fee per unit',
            align: 'right',
            render: (row: TierRow) => (
              <span className="flex items-start justify-end gap-1">
                <NumberField
                  label={docLabel(`insurance.tiers.${row.tier}.fee`)}
                  error={errorAt(`insurance.tiers.${row.tier}.fee`)}
                  warning={warningAt(`insurance.tiers.${row.tier}.fee`)}
                  hideLabel
                  kind="money"
                  min={0}
                  max={10000}
                  value={config.insurance.tiers[row.tier].fee}
                  readOnly={readOnly}
                  onChange={(v) => onChange({ insurance: { tiers: { [row.tier]: { fee: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${row.tier}.fee`} config={config} />
              </span>
            ),
          },
          {
            key: 'be-solo',
            header: 'Break-even',
            align: 'right',
            render: (row) => <span className={dim(row)}>{formatMoney(row.solo)}</span>,
          },
          {
            key: 'verdict-solo',
            header: 'Verdict',
            render: (row) => (
              <span className={dim(row)}>
                <Verdict fee={row.fee} breakEven={row.solo} />
              </span>
            ),
          },
          {
            key: 'be-shared',
            header: 'Break-even',
            align: 'right',
            render: (row) => <span className={dim(row)}>{formatMoney(row.shared)}</span>,
          },
          {
            key: 'verdict-shared',
            header: 'Verdict',
            render: (row) => (
              <span className={dim(row)}>
                <Verdict fee={row.fee} breakEven={row.shared} />
              </span>
            ),
          },
          {
            key: 'refund',
            header: 'Refund per lost unit',
            align: 'right',
            render: (row) => <span className={dim(row)}>{formatMoney(row.refund)}</span>,
          },
          {
            key: 'worst-solo',
            header: 'Not shared',
            align: 'right',
            render: (row) => <span className={dim(row)}>{formatMoney(row.worstSolo)}</span>,
          },
          {
            key: 'worst-shared',
            header: sharedLabel,
            align: 'right',
            render: (row) => <span className={dim(row)}>{formatMoney(row.worstShared)}</span>,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.tier}
      />
      <div className="flex flex-col gap-3">
        {outOfSync.map((text) => (
          <InlineAlert key={text} tone="warning">
            {text}
          </InlineAlert>
        ))}
        {readOnly ? null : (
          <div>
            <Button variant="secondary" onClick={setFees}>
              Set fees from margin
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
