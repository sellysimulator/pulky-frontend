import { ClipboardList, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { canAfford, isWholeCents, outlayEstimate, type DecisionDraft } from '../../game/estimates'
import { LIMITS, type Decision, type IncotermTier, type PlayerView, type PublicConfig } from '../../types/game'
import { formatMoney, formatQty } from '../../utils/format'
import Badge from '../shared/Badge'
import SectionCard from '../shared/SectionCard'
import ConserveSection from './ConserveSection'
import CooperateToggle from './CooperateToggle'
import OrderSection, { ORDER_ERROR } from './OrderSection'
import OutlayBar from './OutlayBar'
import PeerBuySection from './PeerBuySection'
import PeerSellSection from './PeerSellSection'
import ShipSection from './ShipSection'

interface DecisionFormProps {
  view: PlayerView
  config: PublicConfig
  initialDecision: Decision
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

const PRICE_ERROR = `Peer prices must be from $0.01 to ${formatMoney(LIMITS.MAX_PEER_PRICE)}, in whole cents.`
const QUALITY_ERROR = 'Quality limits must be whole numbers from 0 to 100.'
const STEP_ERROR = 'Quality steps by 5: choose 0, 5, 10, … 100.'
const UNITS_ERROR = `You can offer from 1 to ${formatQty(LIMITS.MAX_ORDER)} units.`

function isValidQuantity(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= LIMITS.MAX_ORDER
}

function priceError(value: number | null): string | undefined {
  const ok = value !== null && Number.isFinite(value) && isWholeCents(value) && value >= 0.01 && value <= LIMITS.MAX_PEER_PRICE
  return ok ? undefined : PRICE_ERROR
}

function qualityError(value: number | null): string | undefined {
  if (value === null || !Number.isInteger(value) || value < 0 || value > 100) return QUALITY_ERROR
  return value % 5 === 0 ? undefined : STEP_ERROR
}

function unitsError(value: number | null): string | undefined {
  const ok = value !== null && Number.isInteger(value) && value >= 1 && value <= LIMITS.MAX_ORDER
  return ok ? undefined : UNITS_ERROR
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

function DecisionFormBody({ view, config, initialDecision, locked, onSubmit, lockedFooter }: DecisionFormProps): ReactElement {
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
  const buyValidated = buyActive && spotOpen
  const buyPriceError = buyValidated ? priceError(state.buyPrice) : undefined
  const buyQualityError = buyValidated ? qualityError(state.buyQuality) : undefined
  const sellPriceError = sellActive ? priceError(state.sellPrice) : undefined
  const sellQualityError = sellActive ? qualityError(state.sellQuality) : undefined
  const sellUnitsError = sellActive ? unitsError(state.sellUnits) : undefined

  const spotError = spotOpen && !isValidQuantity(state.spot) ? ORDER_ERROR : undefined
  const futuresError = futuresOpen && !isValidQuantity(state.futures) ? ORDER_ERROR : undefined
  const formValid = !spotError && !futuresError && !buyPriceError && !buyQualityError && !sellPriceError && !sellQualityError && !sellUnitsError

  const draft: DecisionDraft = {
    order_spot: spotOpen ? (state.spot ?? 0) : 0,
    order_futures: futuresOpen ? (state.futures ?? 0) : 0,
    incoterm_tier,
    conserve_lots: conserveLots,
    cooperate: state.cooperate,
    peer_buy:
      buyActive && state.buyPrice !== null && state.buyQuality !== null
        ? { max_price: state.buyPrice, min_quality: state.buyQuality }
        : null,
    peer_sell:
      sellActive && state.sellPrice !== null && state.sellQuality !== null && state.sellUnits !== null
        ? { price: state.sellPrice, max_quality: state.sellQuality, max_units: state.sellUnits }
        : null,
  }
  const outlay = outlayEstimate(draft, view, config)
  const over = !canAfford(outlay.total, view.cash)
  const canSubmit = !locked && !over

  const handleSubmit = (): void => {
    if (!canSubmit) return
    if (!formValid) {
      setPressed(true)
      setFocusRequest((n) => n + 1)
      return
    }
    onSubmit({ day: view.day, ...draft })
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
        <ShipSection view={view} incoterm_tier={incoterm_tier} onChange={(next) => patch({ incoterm_tier: next })} shipmentMax={outlay.shipmentMax} locked={locked} />
        <ConserveSection view={view} config={config} selected={conserveLots} onToggle={toggleLot} locked={locked} />
        {peers ? (
          <PeerSellSection
            view={view}
            config={config}
            conserveLots={conserveLots}
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
          <OutlayBar total={outlay.total} cash={view.cash} over={over} canSubmit={canSubmit} onSubmit={handleSubmit} />
        )}
      </div>
    </SectionCard>
  )
}

/** Today's decision. The draft starts from the server's prefill and restarts when the prefill's day changes. */
export default function DecisionForm(props: DecisionFormProps): ReactElement {
  return <DecisionFormBody key={props.initialDecision.day} {...props} />
}
