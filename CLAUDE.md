# Pulky_Frontend

## What this app is

The browser client of Pulky, a multiplayer pulque-business simulation: React 19 + Vite +
TypeScript, Tailwind v4, Zustand, Socket.IO client, Chart.js, and a lazy three.js board.
It renders what the backend (`../Pulky_Backend`) sends; the backend owns the game.

## Read these instead of re-deriving

- The spec: `../docs/spec/` (start at `README.md` and `glossary.md`; frontend layout is
  `13-frontend.md`, the screens `13-screens-*.md`, the wire `12-wire.md`).
- The build plan: `../docs/plan/` (`00-conventions.md` first); visual rules: `../docs/design.md`.
- `README.md` here: the contracts with the backend and the chart kit.

## Commands

```bash
npm ci
npm run dev        # proxies /api and /socket.io to localhost:8080
npx tsc -b && npx eslint . && npx vitest run --coverage && npm run build
```

## Rules not to break

- **No game formula in the client** (spec §0.5 invariant 7, D54). Every figure a screen
  shows comes from the server: a payload field, or a preview request that runs the
  engine's own functions for what the user is typing:
  - the decision form: `preview_decision` (`src/api/games.ts` `previewDecision`, hook
    `src/game/useDecisionPreview.ts`), debounced, `…` until the answer for the draft on
    screen arrives;
  - the host config screen: `POST /config/preview` (`src/api/config.ts` `previewConfig`,
    `src/components/config/configPreview.ts`), debounced, shared by the previews, the
    insurance calculator and the help entries (`docs/entries.tsx`).
  A new figure is a new server field. Allowed here: formatting, layout, chart scales and
  axes, sorting and filtering. `src/game/configMath.ts` and `src/game/estimates.ts` are
  gone on purpose; do not bring them back.
- Limits come from `GET /config/defaults` (`useLimits()`), hidden defaults stay null in
  the host's config (spec §9.3), and the store is written only by socket handlers and the
  REST loaders (`../docs/plan/00-conventions.md` §4).
- No raw hex outside the canvas modules, no gradient, lucide icons only, no emoji.
- **Safe area**: `viewport-fit=cover` is on, so a `fixed` element on a viewport edge (or an
  `absolute` one on an edge of a full-viewport overlay) offsets by
  `max(<gutter>, env(safe-area-inset-<edge>))`, and flow content never uses `100vw` / `w-screen`.
  The rule is `../../game_stack.md` ("Every frontend draws edge to edge…"); classes in `../docs/design.md` §5.
- **Several games at once** (spec §11.3): `/multihost/new` (`pages/MultiHostSetup.tsx`, the config
  form is `components/config/ConfigSections.tsx` over a local draft) and `/multihost`
  (`pages/MultiHostDashboard.tsx`). The dashboard joins no room: it polls `POST /rooms/summary`
  (`useRoomsSummary`), and on mount resets the store and reconnects the socket if this tab was in a
  room. **Open host screen** is a button calling `window.open(url, '_blank')` WITHOUT `noopener`, so
  the new tab inherits the host secrets in session storage; never turn it into a link. The join QR
  (`components/shared/JoinQrOverlay.tsx`, qrcode.react, drawn locally) encodes the invite link only.
  A refused `start_game` carries `room_code` (spec §12.2): the dashboard claims those of its batch
  (`api/joinErrorRouting.ts` `claimJoinErrors`, called by the one `join_error` listener in
  `socketHandlers.ts`) and shows "Game N (CODE): <message>" on that card until a summary shows it
  started; anything else stays a global alert. After **Start all**, "Started X of Y games." (plus
  "Z couldn't start, see their cards.") is counted from `refresh()`'s answer.
- **Export is open to every results viewer** (spec §13.8 block 6): `ExportControls` shows for host,
  player and stranger alike and sends no host secret. Its once-per-session lock
  (`pulky.exported.<id>.<format>`, sessionStorage) is UX only; the server's per-IP export limit is
  the real guard. Never gate the export on the host again.

## Tests

- jsdom and Testing Library only: no browser, screenshot or headless checks (visual
  checks are the human's).
- The decision form tests answer `preview_decision` with
  `src/__tests__/fixtures/fakeDecisionServer.ts`; the config screen tests render the
  backend's recorded answers, `src/__tests__/fixtures/config_preview.json`. Regenerate
  that file (and `config_defaults.json`) from the backend whenever a figure or a default
  changes; never edit it by hand.
