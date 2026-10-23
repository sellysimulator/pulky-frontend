import { Hourglass } from 'lucide-react'
import type { ReactElement } from 'react'
import ManualBook, { type ManualPageSpec } from '../components/manual/ManualBook'
import ManualLayout from '../components/manual/ManualLayout'
import { HOST_MANUAL_PATH, PLAYER_MANUAL_PATH } from '../components/manual/ManualLink'
import { CONTINUED, contentsPage } from '../components/manual/contents'
import { Bullets, Steps, Table, Tip } from '../components/manual/primitives'
import BrandMark from '../components/shared/BrandMark'
import type { PageRoute } from '../routes/registry'
import { INCOTERM_TIERS } from '../types/game'
import { INCOTERM_TIER_MEANINGS, RISK_LABELS } from '../utils/format'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: PLAYER_MANUAL_PATH, guard: 'public' }

/**
 * The player manual (spec §13.15). It explains every rule and hazard in words
 * and gives no figure for a setting players are not shown (spec §9.3): the
 * numbers in its examples are made up and say so.
 */
const BODY: ManualPageSpec[] = [
  {
    id: 'your-pulqueria',
    heading: 'Your pulquería',
    content: (
      <>
        <p>
          You run a <strong>pulquería</strong>: a business selling pulque, a traditional Mexican fermented drink that spoils
          within days. Every other player runs one in the same town, and you all buy from the same supplier.
        </p>
        <p>
          The game is played in <strong>days</strong>, and day 1 is always a Monday. Each day you buy pulque, it arrives in
          your cellar, and customers buy it at the retail price the host set: the same price for every unit, whatever its
          quality. What is left ages overnight, and some of it spoils.
        </p>
        <p>
          <strong>Your score is your profit.</strong> After the last day, the pulquería with the highest total profit wins.
        </p>
        <Tip title="There is no debt">Everything you buy today must fit in the cash you have. Nobody lends you money.</Tip>
      </>
    ),
  },
  {
    id: 'joining',
    heading: 'Joining a game',
    content: (
      <>
        <Steps
          items={[
            <>
              Open the invite link the host sent you, or choose <strong>Join a room</strong> on the home screen and type the
              6-character room code.
            </>,
            'Sign in with Google to keep your results across games, or play as a guest.',
            'Name your pulquería. Everyone sees this name, and it stays for the whole game.',
            <>
              Wait. The host may still be setting up; you see who has joined. The game starts when the host presses{' '}
              <strong>Start game</strong>, and until then you can leave the room.
            </>,
          ]}
        />
        <p>
          The host runs the room and does not play. If you lose your connection during the game, open the same link again
          to get your seat back. The day waits for you, and so does everyone else.
        </p>
      </>
    ),
  },
  {
    id: 'the-day',
    heading: 'How a day works',
    content: (
      <>
        <Steps
          items={[
            <>
              <strong>Morning brief.</strong> The day opens with the weekday and its demand multiplier, the demand you can
              expect, today's spot price, the futures offer and, on a bad day, a supplier disruption warning.
            </>,
            <>
              <strong>Decide.</strong> Fill in <strong>Today's decision</strong> and press <strong>Submit day</strong>. You
              submit once a day, and a submitted decision cannot be changed. Nobody sees what you ordered or offered.
            </>,
            <>
              <strong>Wait.</strong> The day closes only when every player has submitted. There is no timer.
            </>,
            <>
              <strong>Results.</strong> You see your own recap and ledger. Everyone sees the public results: units sold,
              market share and reputation for each pulquería, the spot price, and whether the refrigeration failed.
            </>,
          ]}
        />
        <p>Then the next morning brief arrives.</p>
      </>
    ),
  },
  {
    id: 'when-the-day-closes',
    heading: 'When the day closes',
    content: (
      <>
        <p>Once everyone has submitted, the day plays out in this order:</p>
        <Steps
          items={[
            'The lots you chose to conserve are conserved.',
            "Today's new futures are paid at the base price.",
            'The supplier ships the futures due today first, then splits what is left between the spot orders.',
            "You pay for the spot units you were given, plus transport and your insurance fee.",
            'The refrigeration may fail and destroy part of every shipment.',
            'Shipments arriving today become new lots in your cellar; insurance refunds are paid.',
            "Peer market: pulquerías the supplier left short buy from the others' sell offers.",
            "Customers come. Backlog is served first, then today's demand, oldest stock first.",
            'Overnight every lot ages, and some units spoil.',
            'Holding cost and the backlog penalty are charged.',
            'Reputation is updated.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'demand',
    heading: 'Demand, backlog and reputation',
    content: (
      <>
        <p>There are no individual customers: each day the town wants a random amount of pulque, around an expected figure.</p>
        <Bullets
          items={[
            <>
              <strong>The weekday.</strong> Demand is highest on the host's peak days and falls by equal steps on the days
              around them. The weekday strip in <strong>Day stats</strong> shows the whole week.
            </>,
            <>
              <strong>Your share.</strong> The town's demand is split by reputation: the higher yours, the bigger your share.{' '}
              <strong>Your demand</strong> in Day stats is today's expected share.
            </>,
            <>
              <strong>Backlog.</strong> Demand you cannot serve is owed. It is served first tomorrow, at full price, but it
              costs a penalty every night it waits, and it never expires.
            </>,
            <>
              <strong>Reputation</strong> (0 to 1) drops when customers wait and when pulque spoils in your cellar, and
              recovers on clean days. Rivals gain the share you lose.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'quality',
    heading: 'Quality and spoilage',
    content: (
      <>
        <p>
          Each delivery becomes a <strong>lot</strong> in your cellar, named after its arrival day: Lot #6 arrived on day 6. A
          lot arrives at its own <strong>quality</strong>, drawn at random within the host's range.
        </p>
        <p>
          <strong>Quality is the chance that a unit survives tonight.</strong> A unit at 80% has a 20% spoil risk tonight. A lot
          keeps its arrival quality through its fresh period, then loses the same number of points every night until it
          reaches 0% and surely spoils.
        </p>
        <Table
          caption="Spoil risk words"
          head={['Spoil risk tonight', 'Shown as']}
          rows={[
            ['0%', RISK_LABELS.safe],
            ['Below 50%', RISK_LABELS.at_risk],
            ['50% or more', RISK_LABELS.likely],
          ]}
        />
        <p>
          Your cellar shows each lot's quality, risk tonight and <strong>last day</strong>: the last day it can still be sold
          before the night that surely spoils it.
        </p>
      </>
    ),
  },
  {
    id: 'quality-2',
    heading: `Quality and spoilage${CONTINUED}`,
    content: (
      <>
        <Bullets
          items={[
            <>
              <strong>Oldest first.</strong> Customers are always served from your oldest lot. You do not choose.
            </>,
            <>
              <strong>Spoiled units</strong> leave the cellar overnight and return the salvage price, which may be nothing.
              They also count as waste, which lowers your reputation.
            </>,
            <>
              <strong>Holding cost.</strong> Every unit still in the cellar at night costs a little, even if it survives.
            </>,
            <>
              <strong>Conserve.</strong> Tick a lot under Conserve to pay, for every unit in it, to keep its arrival quality for
              extra nights. A lot can be conserved once. Conserving a lot that has started to lose quality takes it back toward
              its arrival quality, never above it.
            </>,
          ]}
        />
        <Tip title="Pulque does not age on the road">
          Its quality is drawn on the day it arrives, and the first night in your cellar already counts.
        </Tip>
      </>
    ),
  },
  {
    id: 'hazards',
    heading: 'What can go wrong',
    content: (
      <>
        <p>
          Five things can hurt a day. Nobody tells you how likely they are: you learn that from what happens, so watch the
          brief, your recap and the public results.
        </p>
        <Table
          caption="Hazards"
          head={['Hazard', 'You find out from', 'What softens it']}
          rows={[
            ['Spoilage', 'Your cellar', 'Smaller orders, Conserve, selling'],
            ['Supplier disruption', 'The morning brief', 'Futures, stock on hand'],
            ['Short supply', 'Your recap', 'Futures, Equal Supply, Buy from Players'],
            ['Refrigeration failure', 'Yesterday and your recap', 'Shipping insurance, shared transport'],
            ['Price swings', "Today's spot price", 'Futures'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'hazard-disruption',
    heading: 'Supplier disruption',
    content: (
      <>
        <p>
          Some days the supplier can ship far less than usual. The morning brief warns you before you decide, naming the day,
          for example <em>"Day 5 (Friday): supplier capacity cut to 50%"</em>. The warning shows in Day stats, and in the 3D
          pulquería the supplier board reads <strong>Disrupted today</strong>.
        </p>
        <p>
          <strong>What it does.</strong> With less to go round, the futures due that day are filled first and the spot orders
          share whatever is left, so your spot order is likely to come up short. Even futures can come up short: the units the
          supplier cannot ship are cancelled and refunded at the base price.
        </p>
        <p>
          <strong>What softens it.</strong> Futures bought on earlier days, stock already in your cellar, an Equal Supply vote,
          and Buy from Players for the shortfall.
        </p>
      </>
    ),
  },
  {
    id: 'hazard-short',
    heading: 'Short supply',
    content: (
      <>
        <p>
          Even on a normal day the supplier can ship only so much, and you never see how much. On a busy day everyone's orders
          together can be more than it has.
        </p>
        <Bullets
          items={[
            <>
              <strong>Futures come first.</strong> The contracts due that day take their share before any spot order.
            </>,
            <>
              <strong>Then spot orders.</strong> The largest order is filled first, then the next, until nothing is left. If{' '}
              <strong>every</strong> player voted for Equal Supply, including those who ordered nothing, everyone gets the same
              share of their order instead.
            </>,
            <>
              <strong>You pay only for what you get.</strong> Your recap says how much was missing:{' '}
              <em>"The supplier was short: 12 of your 40 spot units were not allocated."</em>
            </>,
            <>
              <strong>Cover it the same day</strong> with Buy from Players, when the host has turned the peer market on.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'hazard-refrigeration',
    heading: 'Refrigeration failure',
    content: (
      <>
        <p>
          Some days the refrigerated transport fails. A failure hits <strong>every</strong> shipment sent that day, and each
          loses the same share of its units. Losses round down, so a small shipment can lose nothing.
        </p>
        <Bullets
          items={[
            <>
              <strong>Shared transport.</strong> When the host turns it on, Day stats shows <strong>Shared transport</strong>,
              and everyone who shipped that day splits the damage: with 4 shippers, each loses a quarter of what it would have
              lost shipping alone.
            </>,
            <>
              <strong>You still pay transport</strong> on the lost units. Only shipping insurance gives anything back.
            </>,
            <>
              <strong>Where you see it.</strong> <strong>Refrigeration</strong> in Yesterday says whether it failed, and your
              recap gives your loss: <em>"Refrigeration failed: you lost 6 units (shipping alone)."</em> In transit lists the
              units lost per shipment, and in 3D a second sign over the truck shows them.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'hazard-money',
    heading: 'Price swings and cash',
    content: (
      <>
        <p>
          <strong>Price swings.</strong> The spot price is drawn afresh every day around the base price: above it on some days,
          below it on others, with equal chance. You see today's price before you order, and its history in Market. Futures
          lock the base price instead.
        </p>
        <p>
          <strong>Cash.</strong> There is no credit. Everything you choose today must fit in your cash, and{' '}
          <strong>Submit day</strong> is disabled above it. Holding cost and the backlog penalty are charged after sales, so
          they can take your cash below zero. Then you can only submit a decision that costs nothing until cash recovers, while
          your backlog grows.
        </p>
      </>
    ),
  },
  {
    id: 'insurance',
    heading: 'Shipping insurance',
    content: (
      <>
        <p>
          A refrigeration failure can destroy part of a shipment. <strong>Shipping insurance</strong> is the protection you can
          buy against it: the supplier refunds the units lost on the way.
        </p>
        <p>
          Under <strong>Shipping insurance</strong> you choose one insurance for <strong>today's shipment</strong>: the spot
          units the supplier gives you today and any futures due to ship today.
        </p>
        <Table
          caption="What each insurance refunds for a unit lost in transit"
          head={['Insurance', 'A lost unit is refunded at']}
          rows={[
            ['No insurance — you carry the risk', 'Nothing'],
            ['Paid-price insurance — refund what you paid', 'What you paid'],
            ['Market-price insurance — refund at the arrival-day spot price', 'The spot price on the arrival day'],
            ['Retail-price insurance — refund at the retail price', 'The retail price'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'insurance-2',
    heading: `Shipping insurance${CONTINUED}`,
    content: (
      <>
        <p className="font-semibold">What each one means</p>
        <Bullets items={INCOTERM_TIERS.map((tier) => INCOTERM_TIER_MEANINGS[tier])} />
        <p>
          <strong>Blockchain tracking</strong> is why the supplier pays: an insured shipment's condition is on a shared record,
          so it cannot dispute a loss. With No insurance there is no proof, and you absorb the loss.
        </p>
      </>
    ),
  },
  {
    id: 'insurance-3',
    heading: `Shipping insurance${CONTINUED}`,
    content: (
      <Bullets
        items={[
          <>
            <strong>The fee</strong> is per unit shipped and shown on each insurance card. You pay it on the shipping day
            whether or not anything fails. No insurance is free.
          </>,
          <>
            <strong>The refund</strong> covers every lost unit at the insurance's value, and is paid on the day the shipment
            arrives.
          </>,
          <>
            <strong>Paid-price insurance</strong> refunds what you paid: today's spot price for spot units, the base price for
            futures units. <strong>Market-price insurance</strong> refunds the spot price on the arrival day, so it swings with
            the market. <strong>Retail-price insurance</strong> refunds the retail price, which also covers the sale you lost.
          </>,
          'The host can switch off Paid-price, Market-price or Retail-price insurance. No insurance is always there.',
          "The info button on each card shows today's refund value and the fee for today's shipment. A shipment in transit keeps its insurance's details.",
        ]}
      />
    ),
  },
  {
    id: 'insurance-example',
    heading: `Shipping insurance${CONTINUED}`,
    content: (
      <>
        <p>
          An example with made-up numbers. You ship 40 units bought at $13.00; the refrigeration fails and 8 are lost. On the
          arrival day the spot price is $14.00, and the retail price is $30.00.
        </p>
        <Table
          caption="Fee and refund for each insurance in the example"
          head={['Insurance (fee per unit)', 'Fee paid', 'Refund']}
          rows={[
            ['No insurance (free)', '$0.00', '$0.00'],
            ['Paid-price ($0.50)', '$20.00', '$104.00'],
            ['Market-price ($0.50)', '$20.00', '$112.00'],
            ['Retail-price ($1.40)', '$56.00', '$240.00'],
          ]}
        />
        <p>
          Had nothing failed, you would have paid the same fee and got nothing back: that is the price of the protection. With
          shared transport your losses are smaller, so insurance pays back less for the same fee.
        </p>
      </>
    ),
  },
  {
    id: 'futures',
    heading: 'Futures',
    content: (
      <>
        <p>
          A <strong>futures contract</strong> buys units today, at the <strong>base price</strong>, for delivery on a set day.
          The Futures row shows the price, the delivery day and how many days are left to buy.
        </p>
        <Bullets
          items={[
            <>
              <strong>Paid today, in full.</strong> You never owe the supplier later, but cash spent on futures is cash you
              cannot spend at spot today.
            </>,
            <>
              <strong>A fair bet on price.</strong> The base price is the middle of the spot range, so on the day your futures
              ship, spot is as likely to be dearer as cheaper. Your recap says which:{' '}
              <em>"Futures shipped 25 units at $12.00 — spot was $13.40, you saved $35."</em>
            </>,
            <>
              <strong>A real edge on supply.</strong> On a short day, futures are filled before any spot order.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'futures-2',
    heading: `Futures${CONTINUED}`,
    content: (
      <Bullets
        items={[
          <>
            <strong>Unfilled futures are refunded.</strong> If the supplier cannot ship all the futures due, the missing units
            are cancelled and refunded at the base price that day:{' '}
            <em>"The supplier was short: your futures filled 80%; 5 units cancelled and refunded ($60)."</em>
          </>,
          <>
            <strong>They travel like any order.</strong> Futures leave the supplier one lead time before their delivery day,
            under the shipping insurance you choose that day, and pay transport and that insurance's fee then.
          </>,
          <>
            <strong>The window closes.</strong> The countdown runs down to <em>"Last day to buy futures"</em>, then reads{' '}
            <em>"Futures closed: deliveries would arrive after the game ends"</em>. Spot orders close the same way near the end.
          </>,
          <>
            <strong>Futures book.</strong> Your cellar lists every open contract with the days it was bought, ships and is
            delivered.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'peer-market',
    heading: 'Trading with other pulquerías',
    content: (
      <>
        <p>When the host turns the peer market on, pulquerías can sell each other cellar stock on the days the supplier falls short.</p>
        <Bullets
          items={[
            <>
              <strong>Buy from Players</strong> buys your spot shortfall, never more, from the others' sell offers: up to your
              price per unit, at least your minimum quality, and with the cash you have when the market opens.
            </>,
            "Buyers who will pay more go first. Each buyer takes the best quality first, then the cheapest, always at the seller's price.",
            <>
              <strong>Sell to Players</strong> offers your units at one price, from the lots at or below a quality, up to a number
              of units. Units you sell leave before your own customers are served, so offer only what you will not need.
            </>,
            'Traded units move at once, with no transport, refrigeration check or fee, and keep their age and quality. A bought lot is named like Lot #B5-1.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'screen',
    heading: 'Your game screen',
    content: (
      <>
        <p>The 2D board is one column. From top to bottom:</p>
        <Bullets
          items={[
            <>
              <strong>Day stats</strong>: the day and weekday, the weekday strip, your demand, the spot price, your reputation,
              your cash and who is still deciding, plus the disruption warning and the Shared transport chip when they apply.
            </>,
            <>
              <strong>Yesterday</strong>: your demand, sales, backlog, spoilage, profit, the refrigeration and the peer market,
              with a <strong>Recap</strong> of every event and ledger line.
            </>,
            <>
              <strong>Today's decision</strong>: the form you submit.
            </>,
            <>
              <strong>Your cellar</strong>: your lots, units by age, what is in transit and your futures book.
            </>,
            <>
              <strong>Market</strong>: how every pulquería did yesterday, and the price and profit charts.
            </>,
            <>
              <strong>Details</strong>: more charts, closed until you open it.
            </>,
          ]}
        />
        <Tip title="Ask the screen">
          The info button beside a row explains it, and every chart has <strong>Show table</strong> for the exact numbers.
        </Tip>
      </>
    ),
  },
  {
    id: 'decision',
    heading: "Today's decision",
    content: (
      <Bullets
        items={[
          <>
            <strong>Buy from Supplier</strong>: units at today's spot price, with the day they arrive. You pay only for the units
            the supplier actually ships.
          </>,
          <>
            <strong>Buy from Players</strong>: tick it to buy any shortfall from other pulquerías, up to a price per unit and at
            least a quality. The line under it says how long units of that quality last. Quality limits step by 5, from 0 to 100.
          </>,
          <>
            <strong>Futures</strong>: units at the base price, delivered on the day shown.
          </>,
          <>
            <strong>Shipping insurance</strong>: one insurance for today's shipment, each card with its fee per unit.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'decision-2',
    heading: `Today's decision${CONTINUED}`,
    content: (
      <>
        <Bullets
          items={[
            <>
              <strong>Conserve</strong>: tick lots to keep their quality longer; each shows its units, quality, risk and cost.
              Three lots show at first, and <strong>Show all</strong> lists the rest.
            </>,
            <>
              <strong>Sell to Players</strong>: tick it to offer units at a price, from lots at or below a quality, up to a number
              of units. The line below shows what in your cellar qualifies now.
            </>,
            <>
              <strong>Equal Supply</strong>: <strong>Vote for equal supply</strong> on short days.
            </>,
            <>
              <strong>Today: $… of $…</strong>: the most today's choices can cost, as if the whole spot order were filled, against
              your cash. Buying from players is not in it: it comes out of what is left when the market opens.
            </>,
            <>
              <strong>Submit day</strong>, the last control. If a field is wrong, its message appears and nothing is sent.
            </>,
          ]}
        />
        <p>The form starts from your last decision (all zeros on day 1), with the Conserve ticks cleared.</p>
      </>
    ),
  },
  {
    id: 'cellar-market',
    heading: 'Your cellar and Market',
    content: (
      <Bullets
        items={[
          <>
            <strong>The lot table</strong>: each lot with its units, age, quality, risk tonight (number, bar and word) and last
            day.
          </>,
          <>
            <strong>The cellar chart</strong>: your stock with conserved units stacked apart, grouped by age, quality, risk tonight
            or days left to sell; the buttons above it switch between them.
          </>,
          <>
            <strong>In transit</strong>: each shipment on its way, with the days it shipped and arrives, its units, the units lost
            and its insurance.
          </>,
          <>
            <strong>Futures book</strong>: your open contracts.
          </>,
          <>
            <strong>Market</strong>: yesterday's units sold, market share and reputation for every pulquería, the peer market's
            totals, a market-share pie, the spot price over the game against the base price, and your profit per day.
          </>,
        ]}
      />
    ),
  },
  {
    id: 'details',
    heading: 'Details, waiting and the recap',
    content: (
      <Bullets
        items={[
          <>
            <strong>Details</strong> holds the longer view: inventory vs backlog, equal supply votes, costs per day, sold vs
            spoiled, your reputation against the market's, insurance fees vs refunds, and the last day's full ledger. Your browser
            remembers whether it is open.
          </>,
          <>
            <strong>After you submit</strong>, the form locks and shows who has submitted and who you are waiting for.
          </>,
          <>
            <strong>After the day closes</strong>, open the Recap in Yesterday. It tells the day's story, for example{' '}
            <em>"6 units spoiled overnight → salvaged for $12."</em> or{' '}
            <em>"3 units of demand went into backlog (−$4.50 penalty; reputation ▼)."</em>
          </>,
        ]}
      />
    ),
  },
  {
    id: 'board-views',
    heading: '2D or 3D board',
    content: (
      <>
        <p>
          The same game can be drawn two ways. While the game is running, the <strong>Board view</strong> switch (
          <strong>2D</strong> | <strong>3D</strong>) sits in the header beside the room code. 2D is the default.
        </p>
        <Bullets
          items={[
            <>
              <strong>Your choice stays with this browser</strong>, for every game, and changes nothing for anyone else.
            </>,
            <>
              <strong>3D needs</strong> a browser that draws 3D graphics, a keyboard with a mouse or trackpad, and a window at
              least 1,024 pixels wide. Otherwise 3D is greyed out with the reason beside it, and a window that gets too narrow
              shows the 2D board until it is wide again.
            </>,
            <>
              <strong>Switch before you decide.</strong> Switching redraws the board, so anything typed in Today's decision and
              not yet submitted goes back to its starting values.
            </>,
            'If 3D stops working, the board switches to 2D and stays there. When the game is over, everyone sees the 2D board.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'board-3d',
    heading: 'Inside the 3D pulquería',
    content: (
      <>
        <p>
          A walk through your own pulquería. You start at the counter, looking down the hall: pulque comes in through the gate
          at the far end, waits on trucks in the yard, sits in vats in the tinacal and is sold over the counter.
        </p>
        <Table
          caption="Controls"
          head={['Control', 'What it does']}
          rows={[
            ['W A S D or arrow keys', 'Walk'],
            ['Drag', 'Look around'],
            ['E', 'Open the station you stand at'],
            ['Esc', 'Close the panel'],
          ]}
        />
        <Table
          caption="Stations"
          head={['Station', 'Opens']}
          rows={[
            ['The counter', "Today's decision"],
            ['The chalkboard', 'Day stats'],
            ['The market board', 'Market'],
            ['The vats (tinacal)', 'Your cellar'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'board-3d-2',
    heading: `Inside the 3D pulquería${CONTINUED}`,
    content: (
      <>
        <p>
          The buttons at the top right open any of the six panels without walking. One panel opens at a time, on the right,
          and the scene holds still while it is open. You still decide and submit in the Today's decision panel.
        </p>
        <Bullets
          items={[
            'One vat per lot, oldest on the left: the level stands for the units, the hoops take the risk colour, and a cover means conserved.',
            'One truck per shipment in transit, the soonest arrival on the left.',
            "Money on the counter, with your cash and backlog painted on its front; the salvage bin with last night's spoiled units.",
            'On the far wall, the supplier board (prices, arrival day, disruption, shared transport) and the futures board.',
          ]}
        />
        <Tip title="Trust the signs">A vat that looks full may hold more than it shows. Every sign carries the real number.</Tip>
      </>
    ),
  },
  {
    id: 'at-the-end',
    heading: 'At the end',
    content: (
      <Bullets
        items={[
          'After the last day, the stock left in your cellar is sold at the salvage price. Backlog still owed earns nothing.',
          'If the host ends the game early, the open day is dropped. Your cellar and the units in transit are sold at the salvage price, insurance refunds owed are paid, and futures not yet shipped are refunded.',
          <>
            Your board shows <strong>The game is over</strong> with a link to <strong>See the results</strong>: the leaderboard,
            the chart of demand against supply, where your pulque went, and your ratios.
          </>,
          'Played as a guest? The results page lets you sign in with Google and save the game to your profile.',
        ]}
      />
    ),
  },
  {
    id: 'advice',
    heading: 'Advice',
    content: (
      <>
        <Bullets
          items={[
            <>
              <strong>Order for the day it arrives.</strong> A spot order lands after the lead time and a futures contract days
              later: look that day up on the weekday strip, not today.
            </>,
            <>
              <strong>Pulque does not wait.</strong> Overstock spoils, pays holding cost every night and lowers your reputation.
              Running out costs a penalty and reputation too.
            </>,
            <>
              <strong>Get ahead of the peak.</strong> Futures bought before the busy days are served first when supply runs short.
            </>,
            <>
              <strong>Mind your cash.</strong> Futures are paid today: leave room for the spot orders and fees you will need.
            </>,
          ]}
        />
        <Tip title="Nobody tells you the odds">
          Disruptions, failures and short days are learned by playing. Every refrigeration failure is in the public results.
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
        <p className="font-display text-3xl font-bold">Player manual</p>
        <p className="text-ink-muted">Buy, ship and sell pulque before it spoils.</p>
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
        <Hourglass size={32} aria-hidden="true" className="text-accent" />
        <p className="font-display text-2xl font-bold">Every spoiled unit is paid for twice.</p>
        <p className="text-ink-muted">Once in its price, and again in the reputation it cost.</p>
      </>
    ),
  },
]

export default function PlayerManualPage(): ReactElement {
  return (
    <ManualLayout
      title="Player manual"
      audience="For the players, each running a pulquería. You do not need the host manual."
      otherManual={{ to: HOST_MANUAL_PATH, label: 'Host manual' }}
    >
      <ManualBook title="Player manual" pages={PAGES} />
    </ManualLayout>
  )
}
