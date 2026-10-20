import { ChartLine, EyeOff } from 'lucide-react'
import type { ReactElement } from 'react'
import ShownToPlayersBadge from '../components/config/ShownToPlayersBadge'
import { SECTION_PATHS } from '../components/config/configDraft'
import { DOCS } from '../components/config/docs/entries'
import ManualBook, { type ManualPageSpec } from '../components/manual/ManualBook'
import ManualLayout from '../components/manual/ManualLayout'
import { HOST_MANUAL_PATH, PLAYER_MANUAL_PATH } from '../components/manual/ManualLink'
import { CONTINUED, contentsPage } from '../components/manual/contents'
import { Bullets, Steps, Tip } from '../components/manual/primitives'
import Badge from '../components/shared/Badge'
import BrandMark from '../components/shared/BrandMark'
import type { PageRoute } from '../routes/registry'
import { PLAYER_CONFIG_KEYS, SECRET_CONFIG_KEYS } from '../types/game'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: HOST_MANUAL_PATH, guard: 'public' }

/** `random_seed` has no control and so no help entry. */
function labelOf(path: string): string {
  return path === 'random_seed' ? 'Random seed' : DOCS[path].label
}

/**
 * One line per setting: its label and "how it changes the game" from the
 * setting's own help entry (spec §13.10), so the manual and the config panel
 * never disagree.
 */
function Settings({ paths }: { paths: readonly string[] }): ReactElement {
  return (
    <dl className="flex flex-col gap-3">
      {paths.map((path) => (
        <div key={path} className="flex flex-col gap-1">
          <dt className="flex flex-wrap items-center gap-2 font-semibold">
            {labelOf(path)}
            {PLAYER_CONFIG_KEYS.includes(path) ? <ShownToPlayersBadge /> : null}
            {SECRET_CONFIG_KEYS.includes(path) ? (
              <Badge tone="neutral" icon={EyeOff}>
                Secret
              </Badge>
            ) : null}
          </dt>
          <dd className="text-ink-muted">{DOCS[path].effect}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The host manual (spec §13.15). Players can open it too, so it says what
 * each setting changes and never what a game's or the default risks are
 * (spec §9.3).
 */
const BODY: ManualPageSpec[] = [
  {
    id: 'what-the-host-does',
    heading: 'What the host does',
    content: (
      <>
        <p>
          You create the room, choose the rules and run the session. <strong>You do not play</strong>: you hold no pulquería,
          no cash and no seat.
        </p>
        <p>
          You see what players cannot: every pulquería's cellar, orders and ledger, the supplier's daily capacity, and the
          risks you set. Players see only their own business and the public results.
        </p>
        <p>
          Plan for the game's days plus a debrief. There is no timer: a day lasts as long as the slowest player takes to
          submit.
        </p>
        <Tip title="Players can read this manual too">
          It never gives the odds of a game. Players learn the risks by playing, so keep them to yourself when you introduce
          the session.
        </Tip>
      </>
    ),
  },
  {
    id: 'step-1',
    heading: 'Step 1 — Create the room',
    content: (
      <>
        <Steps
          items={[
            'Sign in with Google or play as a guest: either can host.',
            <>
              On the home screen, under <strong>Create a room</strong>, type your name if you like and press{' '}
              <strong>Create room</strong>.
            </>,
            <>
              Your host page opens with the <strong>room code</strong> and the <strong>invite link</strong>, each with a copy
              button. Send the link however you like, or show the code: players type it under <strong>Join a room</strong>.
            </>,
          ]}
        />
        <Tip title="Keep this tab">
          This browser holds the room's host key. If you lose the tab, open /host/ followed by the room code from the same
          account (or, as a guest, the same browser) to take the room back.
        </Tip>
      </>
    ),
  },
  {
    id: 'step-2',
    heading: 'Step 2 — Let players in',
    content: (
      <Bullets
        items={[
          'Players open the link, sign in or play as guests, name their pulquería and appear in your participant list.',
          'The room takes as many players as the seats you set. A full room, or one already started, turns newcomers away.',
          'While you configure, players see only who has joined. They never see your settings.',
          'Players can leave before the start. During the game, a player who drops out keeps the seat and gets it back by opening the link again.',
        ]}
      />
    ),
  },
  {
    id: 'step-3',
    heading: 'Step 3 — Configure the game',
    content: (
      <>
        <Bullets
          items={[
            <>
              The settings sit beside the lobby in seven sections: <strong>Game</strong>, <strong>Demand</strong>,{' '}
              <strong>Reputation</strong>, <strong>Supplier & futures</strong>, <strong>Stock</strong>,{' '}
              <strong>Peer market</strong> and <strong>Transport & insurance</strong>. The buttons above them jump to each.
            </>,
            'Changes are checked and saved as you go. A value that breaks a rule shows its message at the field and is not saved; a warning never blocks.',
            <>
              Every setting has an <strong>info button</strong>: its formula, how it changes the game, and a live example from
              your current settings.
            </>,
            <>
              Each section ends with a closed <strong>Preview</strong>: charts and tables of what your settings produce.
            </>,
            <>
              <strong>Reset to defaults</strong> puts every setting back. The settings lock when the game starts.
            </>,
          ]}
        />
        <p>
          The next pages say what each setting changes. <ShownToPlayersBadge /> marks the five settings players see. In this
          manual,{' '}
          <Badge tone="neutral" icon={EyeOff}>
            Secret
          </Badge>{' '}
          marks the ones no player ever sees.
        </p>
      </>
    ),
  },
  {
    id: 'game',
    heading: 'Game',
    content: (
      <>
        <p>How many pulquerías, for how long, with how much money.</p>
        <Settings paths={SECTION_PATHS.game} />
        <p>A game starts with at least 2 players seated, and has at most 12 seats.</p>
      </>
    ),
  },
  {
    id: 'demand',
    heading: 'Demand',
    content: (
      <>
        <p>How much the town wants, on which days, and what a unit sells for.</p>
        <Settings paths={SECTION_PATHS.demand} />
        <p>Preview: the multiplier of every weekday, and market demand per weekday against the supplier's expected capacity.</p>
      </>
    ),
  },
  {
    id: 'reputation',
    heading: 'Reputation',
    content: (
      <>
        <p>
          Reputation splits the town's demand between the pulquerías. Backlog and spoiled pulque lower it; clean days bring it
          back.
        </p>
        <Settings paths={SECTION_PATHS.reputation} />
        <p>Preview: how demand splits for sample reputations.</p>
      </>
    ),
  },
  {
    id: 'supplier',
    heading: 'Supplier & futures',
    content: (
      <>
        <p>What pulque costs, how much the supplier can ship, and how often it is cut short.</p>
        <Settings paths={SECTION_PATHS.supplier.slice(0, 6)} />
      </>
    ),
  },
  {
    id: 'supplier-2',
    heading: `Supplier & futures${CONTINUED}`,
    content: (
      <>
        <p>When orders arrive, and in what state.</p>
        <Settings paths={SECTION_PATHS.supplier.slice(6)} />
        <p>
          The lead time must be shorter than the futures horizon, and the horizon shorter than the game. Preview: the spot
          price range.
        </p>
      </>
    ),
  },
  {
    id: 'stock',
    heading: 'Stock',
    content: (
      <>
        <p>How fast pulque spoils, and what keeping it costs.</p>
        <Settings paths={SECTION_PATHS.stock} />
        <p>Preview: the spoil risk night by night, plain and conserved, for lots at your lowest and highest quality.</p>
      </>
    ),
  },
  {
    id: 'peer-market',
    heading: 'Peer market',
    content: (
      <>
        <Settings paths={SECTION_PATHS.peer} />
        <Bullets
          items={[
            "Buyers with the higher price cap go first, and each takes the best quality first, then the cheapest, at the seller's price.",
            'Units move at once, cellar to cellar: no transport, no refrigeration check, no fee.',
            "Off: the Buy from Players and Sell to Players rows leave the players' form.",
          ]}
        />
        <p>
          What it teaches: on a short day a rival's spare stock is supply, and a seller weighs a sale today against the
          customers it may not be able to serve.
        </p>
      </>
    ),
  },
  {
    id: 'transport',
    heading: 'Transport & insurance',
    content: (
      <>
        <p>What shipping costs, how often it fails, and the protection players can buy.</p>
        <Settings paths={SECTION_PATHS.transport} />
        <p>
          Each insured tier (CIP, DAP and DDP) can be offered or not, and has a fee per unit shipped. EXW is always offered
          and free. Fees reach players on their tier cards.
        </p>
      </>
    ),
  },
  {
    id: 'calculator',
    heading: 'The insurance calculator',
    content: (
      <Bullets
        items={[
          <>
            For each tier: your fee, its <strong>break-even fee</strong> (the fee at which the expected refund equals it), the
            refund value and the worst single-failure loss on a typical shipment, not shared and shared side by side.
          </>,
          <>
            A badge from your fee against break-even: <strong>Worth it</strong> (players get back more than they pay, on
            average), <strong>Break-even</strong> (a fair bet), <strong>Not worth it on average</strong> (an insurer's margin)
            or <strong>No risk configured</strong>.
          </>,
          'The chance of at least one failure during the game, and the expected number of failures.',
        ]}
      />
    ),
  },
  {
    id: 'calculator-2',
    heading: `The insurance calculator${CONTINUED}`,
    content: (
      <>
        <Settings paths={['insurance.reference_shipment', 'insurance.target_margin']} />
        <p>
          <strong>Set fees from margin</strong> sets every offered tier to its break-even fee plus your margin. Fees are
          stored: they do not follow later changes, and an amber note shows when they have drifted. Press the button again to
          bring them back.
        </p>
        <Tip title="Sharing changes insurance">
          Shared transport divides every loss, so the break-even fee falls and the same fees stop paying on average. That
          trade-off is part of the lesson.
        </Tip>
      </>
    ),
  },
  {
    id: 'what-players-see',
    heading: 'What players see',
    content: (
      <Bullets
        items={[
          <>
            <strong>Shown</strong>: {PLAYER_CONFIG_KEYS.map(labelOf).join(', ')}.
          </>,
          <>
            <strong>Felt, not shown</strong>: the rest reaches players through play. The morning brief carries the day count,
            demand, the week's multipliers, the base price, the lead time, the futures terms and shared transport; the cellar
            each lot's quality, risk and last day; the ledger the holding cost, backlog penalty and salvage; the tier cards the
            fees.
          </>,
          <>
            <strong>Never shown</strong>: the supplier's capacity (until the game ends), the spot price range, and the secret
            settings: {SECRET_CONFIG_KEYS.map(labelOf).join(', ')}.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'choosing',
    heading: 'Choosing settings',
    content: (
      <Bullets
        items={[
          "Start from the defaults for a first session: they are tuned so that every decision on the players' form matters.",
          'Change one thing at a time between sessions, so the debrief can point at it. Shared transport off and then on moves the value of insurance; the peer market off and then on shows what trading does on short days; a longer lead time makes forecasting harder.',
          'Two weeks or more lets players meet the weekday wave a second time, and act on what they learned from the first.',
        ]}
      />
    ),
  },
  {
    id: 'step-4',
    heading: 'Step 4 — Start',
    content: (
      <Bullets
        items={[
          <>
            <strong>Start game</strong> works once at least 2 players are seated. While it cannot, the reason shows above it.
          </>,
          'The settings lock. To play with different ones, create a new room.',
          "Day 1's morning brief reaches every player at once.",
        ]}
      />
    ),
  },
  {
    id: 'step-5',
    heading: 'Step 5 — Run the session',
    content: (
      <>
        <p>Your console shows, live:</p>
        <Bullets
          items={[
            <>
              <strong>Submissions</strong>: who is still deciding, by name only. What they chose stays secret until the day
              closes.
            </>,
            <>
              <strong>A row per pulquería</strong>: connection, submitted, stock, expected spoilage tonight, units in transit,
              open futures, backlog, reputation, market share, peer trades, profit, cash, waste and fill rates, and the last
              tier used.
            </>,
            <>
              <strong>Market charts</strong>: market share, reputation, demand vs units sold, the spot price with its range,
              capacity vs orders, spoilage and peer units traded.
            </>,
            <>
              <strong>Events</strong>: disruptions, refrigeration failures, cooperation and peer trades.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'step-5-2',
    heading: `Step 5 — Run the session${CONTINUED}`,
    content: (
      <>
        <Bullets
          items={[
            <>
              <strong>No timer, no pause.</strong> A day closes when every seated player has submitted. A player who
              disconnects holds up the day until they open their link again; if they cannot come back, your only remedy is to
              end the game early.
            </>,
            <>
              <strong>Presentation mode</strong> fills the screen with public data only: the brief, units sold, shares,
              reputation, failures, peer trades and who has submitted. <strong>Exit</strong> or Escape returns to the console.
            </>,
            <>
              <strong>End game early</strong> ends the game for everyone and cannot be undone. The open day is dropped, stock
              and units in transit are sold at the salvage price, refunds owed are paid, and you get full results for the days
              played.
            </>,
          ]}
        />
        <Tip title="Project Presentation mode, never the console">
          The console shows every pulquería's private numbers and the supplier's capacity.
        </Tip>
      </>
    ),
  },
  {
    id: 'step-6',
    heading: 'Step 6 — Debrief',
    content: (
      <>
        <p>
          When the game ends, <strong>See the results</strong> replaces your controls, and players get the same link on their
          board. Nobody is moved: you decide when the class follows. The summary is the debrief, top to bottom:
        </p>
        <Steps
          items={[
            <>
              <strong>Leaderboard</strong>, the profits hidden until you press <strong>Reveal</strong>, so the class can guess
              first.
            </>,
            <>
              <strong>The chart</strong>: market demand against pulque delivered, sold and spoiled, and backlog. Turn the series
              on one at a time, demand first.
            </>,
            <>
              <strong>Where the pulque went</strong>, per pulquería.
            </>,
            <>
              <strong>Ratios</strong>: fill and waste rates, reputation, market share, futures, insurance and peer trading.
            </>,
            <>
              <strong>Decisions</strong>: votes, tiers, conserved lots, peer trades, and the spot price with failure and
              disruption days marked.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'step-6-2',
    heading: `Step 6 — Debrief${CONTINUED}`,
    content: (
      <>
        <Bullets
          items={[
            <>
              <strong>Export CSV</strong> or <strong>Export JSON</strong> during the debrief: the room expires 24 hours after
              its last activity.
            </>,
            <>
              <strong>Play again</strong>, in the tab that ran the game, opens a new room with the same settings and a new random seed.
            </>,
            <>
              <strong>Debrief notes</strong> holds the talking points, in order.
            </>,
            'Printed, the page makes a one-page handout: the leaderboard, the chart and the ratios.',
          ]}
        />
        <Tip title="The point to land">
          Nobody was careless: lead time, perishability and scarce supply produced these outcomes.
        </Tip>
      </>
    ),
  },
]

const PAGES: ManualPageSpec[] = [
  {
    id: 'cover',
    variant: 'cover',
    content: (
      <>
        <BrandMark className="size-20" />
        <p className="font-display text-3xl font-bold">Host manual</p>
        <p className="text-ink-muted">Set up the town, run the days, lead the debrief.</p>
      </>
    ),
  },
  contentsPage(BODY),
  ...BODY,
  {
    id: 'back-cover',
    variant: 'back',
    content: (
      <>
        <ChartLine size={32} aria-hidden="true" className="text-accent" />
        <p className="font-display text-2xl font-bold">The chart is the debrief.</p>
        <p className="text-ink-muted">Did deliveries rise before the peak, or after it?</p>
      </>
    ),
  },
]

export default function HostManualPage(): ReactElement {
  return (
    <ManualLayout
      title="Host manual"
      audience="For the person who sets up and runs the session. You do not play."
      otherManual={{ to: PLAYER_MANUAL_PATH, label: 'Player manual' }}
    >
      <ManualBook title="Host manual" pages={PAGES} />
    </ManualLayout>
  )
}
