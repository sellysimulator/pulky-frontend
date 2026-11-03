import { ClipboardList, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useDecisionPreview } from '../../game/useDecisionPreview'
import { useGameStore } from '../../store/gameStore'
import type { Decision, DecidingView, DecisionDraft, FieldIssue, IncotermTier, PlayerView, PublicConfig } from '../../types/game'
import Badge from '../shared/Badge'
import SectionCard from '../shared/SectionCard'
import ConserveSection from './ConserveSection'
import CooperateToggle from './CooperateToggle'
import OrderSection from './OrderSection'
import OutlayBar from './OutlayBar'
import PeerBuySection from './PeerBuySection'
import PeerSellSection from './PeerSellSection'
import ShipSection from './ShipSection'

interface DecisionFormProps {
  view: PlayerView
  config: PublicConfig
  /** The server's prefill; null once the game is over. */
  initialDecision: Decision | null
  locked: boolean
  onSubmit(decision: Decision): void
  lockedFooter?: ReactNode
}

interface FormState {
  spot: number | null
  futures: number | null
  incoterm_tier: IncotermTier
  conserve: string[]
  cooperate: boolean
  buyOn: boolean
  buyPrice: number | null
  buyQuality: number | null
  sellOn: boolean
  sellPrice: number | null
  sellQuality: number | null
  sellUnits: number | null
}

/** The fields whose messages wait for the player: a field is touched once its input has lost focus. */
type FieldKey = 'spot' | 'futures' | 'buyPrice' | 'buyQuality' | 'sellPrice' | 'sellQuality' | 'sellUnits'

/** The server's field path (spec §4.3) for each form field. */
const SERVER_FIELD: Record<FieldKey, string> = {
  spot: 'order_spot',
  futures: 'order_futures',
  buyPrice: 'peer_buy.max_price',
  buyQuality: 'peer_buy.min_quality',
  sellPrice: 'peer_sell.price',
  sellQuality: 'peer_sell.max_quality',
  sellUnits: 'peer_sell.max_units',
}

/** Spec §13.7: the form's own rule; the server accepts any whole number from 0 to 100 (§4.3). */
const STEP_ERROR = 'Quality steps by 5: choose 0, 5, 10, … 100.'

function serverErrors(errors: FieldIssue[] | undefined): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {}
  for (const key of Object.keys(SERVER_FIELD) as FieldKey[]) {
    const issue = errors?.find((e) => e.field === SERVER_FIELD[key])
    if (issue) out[key] = issue.message
  }
  return out
}

/** A quality limit the server accepts but the guide has no row for (spec §13.7). */
function stepError(value: number | null, serverError: string | undefined): string | undefined {
  if (serverError !== undefined || value === null) return serverError
  return value % 5 === 0 ? undefined : STEP_ERROR
}

function initialState(initial: Decision, view: PlayerView, config: PublicConfig): FormState {
  const peers = config.peer_market.enabled
  const buy = peers ? initial.peer_buy : null
  const sell = peers ? initial.peer_sell : null
  const enabled = view.tier_plans.some((p) => p.enabled && p.tier === initial.incoterm_tier)
  return {
    spot: initial.order_spot,
    futures: initial.order_futures,
    incoterm_tier: enabled ? initial.incoterm_tier : 'exw',
    conserve: initial.conserve_lots,
    cooperate: initial.cooperate,
    buyOn: buy !== null,
    buyPrice: buy?.max_price ?? null,
    buyQuality: buy?.min_quality ?? null,
    sellOn: sell !== null,
    sellPrice: sell?.price ?? null,
    sellQuality: sell?.max_quality ?? null,
    sellUnits: sell?.max_units ?? null,
  }
}

type DecisionFormBodyProps = Omit<DecisionFormProps, 'view' | 'initialDecision'> & { view: DecidingView; initialDecision: Decision }

function DecisionFormBody({ view, config, initialDecision, locked, onSubmit, lockedFooter }: DecisionFormBodyProps): ReactElement {
  const roomCode = useGameStore((s) => s.roomCode)
  const [state, setState] = useState<FormState>(() => initialState(initialDecision, view, config))
  const patch = (changes: Partial<FormState>): void => setState((s) => ({ ...s, ...changes }))
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(() => new Set())
  const [pressed, setPressed] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const touch = (key: FieldKey): void => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)))
  // A message shows only for an invalid field that was left, or once Submit day was pressed.
  const shown = (key: FieldKey, error: string | undefined): string | undefined => (pressed || touched.has(key) ? error : undefined)

  // After a press with an invalid field, the messages are on screen: move focus to the first one in DOM order.
  useEffect(() => {
    if (focusRequest > 0) bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  const peers = config.peer_market.enabled
  const spotOpen = view.order_windows.spot_open
  const futuresOpen = view.order_windows.futures_open
  const incoterm_tier: IncotermTier = view.tier_plans.some((p) => p.enabled && p.tier === state.incoterm_tier) ? state.incoterm_tier : 'exw'
  const conserveLots = view.cellar.filter((lot) => !lot.conserved && state.conserve.includes(lot.id)).map((lot) => lot.id)

  const buyActive = peers && state.buyOn
  const sellActive = peers && state.sellOn

  // The draft as typed: the server checks it and computes every figure the form shows (spec §12.4).
  const draft: DecisionDraft = {
    day: view.day,
    order_spot: spotOpen ? state.spot : 0,
    order_futures: futuresOpen ? state.futures : 0,
    incoterm_tier,
    conserve_lots: conserveLots,
    cooperate: state.cooperate,
    peer_buy: buyActive ? { max_price: state.buyPrice, min_quality: state.buyQuality } : null,
    peer_sell: sellActive ? { price: state.sellPrice, max_quality: state.sellQuality, max_units: state.sellUnits } : null,
  }
  const { preview, pending } = useDecisionPreview(roomCode, draft)
  const server = serverErrors(preview?.errors)

  // A spot-closed day cannot leave a shortfall, so the buy limits are not checked then (spec §13.7).
  const spotError = spotOpen ? server.spot : undefined
  const futuresError = futuresOpen ? server.futures : undefined
  const buyPriceError = buyActive && spotOpen ? server.buyPrice : undefined
  const buyQualityError = buyActive && spotOpen ? stepError(state.buyQuality, server.buyQuality) : undefined
  const sellPriceError = sellActive ? server.sellPrice : undefined
  const sellQualityError = sellActive ? stepError(state.sellQuality, server.sellQuality) : undefined
  const sellUnitsError = sellActive ? server.sellUnits : undefined
  const formValid = !spotError && !futuresError && !buyPriceError && !buyQualityError && !sellPriceError && !sellQualityError && !sellUnitsError

  const over = preview?.affordable === false
  const canSubmit = !locked && !over

  const handleSubmit = (): void => {
    if (!canSubmit) return
    if (!formValid) {
      setPressed(true)
      setFocusRequest((n) => n + 1)
      return
    }
    const buy = draft.peer_buy
    const sell = draft.peer_sell
    onSubmit({
      day: view.day,
      order_spot: draft.order_spot ?? 0,
      order_futures: draft.order_futures ?? 0,
      incoterm_tier,
      conserve_lots: conserveLots,
      cooperate: state.cooperate,
      peer_buy: buy && buy.max_price !== null && buy.min_quality !== null ? { max_price: buy.max_price, min_quality: buy.min_quality } : null,
      peer_sell:
        sell && sell.price !== null && sell.max_quality !== null && sell.max_units !== null
          ? { price: sell.price, max_quality: sell.max_quality, max_units: sell.max_units }
          : null,
    })
  }

  const toggleLot = (lotId: string, checked: boolean): void =>
    patch({ conserve: checked ? [...state.conserve.filter((id) => id !== lotId), lotId] : state.conserve.filter((id) => id !== lotId) })

  return (
    <SectionCard
      title="Today's decision"
      icon={ClipboardList}
      tone="decision"
      meta={
        locked ? (
          <Badge tone="neutral" icon={Lock}>
            Submitted
          </Badge>
        ) : undefined
      }
    >
      <div ref={bodyRef}>
        <OrderSection
          kind="spot"
          view={view}
          value={state.spot}
          onChange={(spot) => patch({ spot })}
          error={shown('spot', spotError)}
          onFieldBlur={() => touch('spot')}
          locked={locked}
        />
        {peers ? (
          <PeerBuySection
            view={view}
            ticked={state.buyOn}
            onTick={(buyOn) => patch({ buyOn })}
            maxPrice={state.buyPrice}
            onMaxPrice={(buyPrice) => patch({ buyPrice })}
            minQuality={state.buyQuality}
            onMinQuality={(buyQuality) => patch({ buyQuality })}
            priceError={shown('buyPrice', buyPriceError)}
            qualityError={shown('buyQuality', buyQualityError)}
            onFieldBlur={touch}
            closed={!spotOpen}
            locked={locked}
          />
        ) : null}
        <OrderSection
          kind="futures"
          view={view}
          value={state.futures}
          onChange={(futures) => patch({ futures })}
          error={shown('futures', futuresError)}
          onFieldBlur={() => touch('futures')}
          locked={locked}
        />
        <ShipSection
          view={view}
          plans={preview?.tier_plans ?? null}
          pending={pending}
          incoterm_tier={incoterm_tier}
          onChange={(next) => patch({ incoterm_tier: next })}
          locked={locked}
        />
        <ConserveSection view={view} config={config} selected={conserveLots} onToggle={toggleLot} locked={locked} />
        {peers ? (
          <PeerSellSection
            view={view}
            config={config}
            offer={preview?.offer ?? null}
            pending={pending}
            ticked={state.sellOn}
            onTick={(sellOn) => patch({ sellOn })}
            price={state.sellPrice}
            onPrice={(sellPrice) => patch({ sellPrice })}
            maxQuality={state.sellQuality}
            onMaxQuality={(sellQuality) => patch({ sellQuality })}
            maxUnits={state.sellUnits}
            onMaxUnits={(sellUnits) => patch({ sellUnits })}
            priceError={shown('sellPrice', sellPriceError)}
            qualityError={shown('sellQuality', sellQualityError)}
            unitsError={shown('sellUnits', sellUnitsError)}
            onFieldBlur={touch}
            locked={locked}
          />
        ) : null}
        <CooperateToggle checked={state.cooperate} onChange={(cooperate) => patch({ cooperate })} locked={locked} />
        {locked ? (
          lockedFooter
        ) : (
          <OutlayBar
            total={preview?.outlay?.total ?? null}
            pending={pending}
            cash={view.cash}
            unaffordable={preview?.unaffordable_message ?? null}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </SectionCard>
  )
}

const isDeciding = (view: PlayerView): view is DecidingView => view.order_windows !== null

/**
 * Today's decision. The draft starts from the server's prefill and restarts when the prefill's day changes. A finished
 * game's view has no prefill and no order windows, and the form renders nothing.
 */
export default function DecisionForm({ view, initialDecision, ...rest }: DecisionFormProps): ReactElement | null {
  if (initialDecision === null || !isDeciding(view)) return null
  return <DecisionFormBody key={initialDecision.day} view={view} initialDecision={initialDecision} {...rest} />
}
