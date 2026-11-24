# Pulky_Frontend

## What this app is

The browser client of Pulky, a multiplayer pulque-business simulation: React 19 + Vite +
TypeScript, Tailwind v4, Zustand, Socket.IO client, Chart.js, and a lazy three.js board.
It renders what the backend (`../Pulky_Backend`) sends; the backend owns the game.

## Read these instead of re-deriving

- The spec: `../docs/spec/` (start at `README.md` and `glossary.md`; frontend layout is
  `13-frontend.md`, the screens `13-screens-*.md`, the wire `12-wire.md`).
- Visual rules: `../docs/design.md`. The 3D board: spec `13-board-3d.md` (§13.11; most of its
  rules are [HARD-WON]).
- `../docs/` is not in this repository: it is versioned in the Novus docs repository, so a
  change that edits the spec or `design.md` is committed there, separately.
- `README.md` here: the contracts with the backend and the chart kit.

## Commands

```bash
npm ci
npm run dev        # proxies /api and /socket.io to localhost:8080
npx tsc -b && npx eslint . && npm test -- --coverage && npm run build   # npm run test:watch watches
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
  the host's config (spec §9.3), and the store's game state is written only by socket
  handlers (`src/api/socketHandlers.ts`) and the REST loaders. Components write only two UI
  slices, `alerts` (`addAlert`/`dismissAlert`) and `selectedDay` (`selectDay`); `reset()` is
  called by sign-out and the multi-game dashboard only (spec §13.6 "Store and handlers").
- **The socket never gives up and never turns a signed-in user into a guest** (spec §13.6,
  §11.3): `src/api/socket.ts` has no `reconnectionAttempts` and `reconnectionDelayMax: 10_000`;
  a failed `getIdToken()` sends `{ idToken: null, guestId: null }` (the server refuses it), and
  `socketHandlers.ts` shows "Could not reach the game server. Retrying…" and retries
  `socket.connect()` every 5 s while still signed in. With no Firebase user and no guest id
  (first visit, after sign-out) `AuthContext` only calls `socket.disconnect()`; never connect
  then. A drop sets
  the store's `reconnecting`: the play and host screens show `ReconnectingNotice`. **Submit
  day** is disabled whenever the store's `connected` is false (a buffered `submit_day` would be
  replayed before the rejoin and refused), our own `disconnect().connect()` included, which is
  not `reconnecting`; never gate it on `reconnecting`.
- `src/main.tsx` reloads the tab once on `vite:preloadError` (a chunk gone after a deploy;
  `claimPreloadReload` in `utils/storage.ts`). `firebase.json` caches `/assets/**` immutably and
  revalidates `index.html` and every route (spec §13.13); never add X-Frame-Options or a CSP there.
- The game's display name is **Pulque Game** (title, header, welcome screen, manuals, Google
  sign-in brand); code identifiers, keys, repos and the Firebase site keep "Pulky".
- **Copy**: copy that states a rule (messages, window copy, reasons, recap and debrief lines)
  comes from the spec word for word; never invent copy that states a rule. Incidental UI
  copy (labels, headings, helper text, empty states) lives in the code and needs no spec
  entry.
- Two modules in one folder never have names that differ only in case (`modelCredits.ts`
  beside `ModelCredits.tsx`): macOS resolves the import to the wrong file and `tsc -b` fails
  (TS1149/TS1192) while Linux CI passes. That is why the data modules are `assetCredits.ts`
  and `projectorChartsConfig.ts` (spec §13.6).
- **Presentation mode is projected to the class** (spec §11.1, §11.4): `PresentationMode`,
  `PresentationCharts` and `projectorChartsConfig` render only `PresentationData`, which
  `selectPresentationData` (`components/host/presentationData.ts`) builds by copying public
  fields one by one. Those three files never import the store, `HostView`, `DayRecord`,
  `MarketDay` or the host histories; a new projected figure is an explicit copy of a public
  field, never a spread of a view. Tests check the key lists and the files' imports.
- **3D board** (spec §13.11): layout numbers live only in `board3d/sceneLayout.ts`; a visual
  fix changes them there and keeps the `sceneModel.test.ts` sweep green. `Board3D.tsx` and
  `board3d/render/**` cannot run in jsdom and are excluded from coverage.
- The `pulky:forbid-three-in-entry-graph` plugin (`vite.config.ts`) fails the build when the
  entry chunk statically reaches `three`. To check it, add a used import to
  `src/pages/GameRoom.tsx` (`import { Vector3 } from 'three'; export const ORIGIN = new
  Vector3()`): `npm run build` must fail; then restore the file. A bare `import 'three'` is
  tree-shaken (three declares `sideEffects`) and proves nothing.
- No `TODO`, no commented-out code and no `console.log` in committed code; the eslint
  config has no `no-console` rule to catch them.
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

- Tests are `src/__tests__/<subject>.test.ts(x)`, with shared setup in
  `src/__tests__/setup.ts` and data in `src/__tests__/fixtures/`. REST goes only through
  the axios instance in `src/api/http.ts` (never import axios anywhere else), and tests swap
  `http.defaults.adapter`. Charts are tested by mocking `react-chartjs-2` and asserting on the
  built config.
- `src/__tests__/fixtures/rounding_cases.json` is the money-rounding contract (spec §8.1)
  and has a byte-identical twin in `Pulky_Backend/tests/fixtures/`; change both together,
  since no test compares them. `public/3dmodels/` is the only copy of the 3D models; never
  edit their bytes (give a changed model a new file name).
- Test through rendered output and public functions. Never assert on a private name, on log
  text, or on copy the spec does not quote: for an unquoted message assert the error code
  (and field) and that the message is a non-empty string.
- A regression test must fail against the bug it names: break the code once, see it go
  red, then restore the code. Never edit a test just to make it pass.
- An expected value sits next to the input that produces it, or comes from a named shared
  input (a fixture); never copy numbers from another file, and assert chart data by dataset
  label, never by a comment next to a hand-transposed array.
- jsdom and Testing Library only: no browser, screenshot or headless checks (visual
  checks are the human's).
- The decision form tests answer `preview_decision` with
  `src/__tests__/fixtures/fakeDecisionServer.ts`; the config screen tests render the
  backend's recorded answers, `src/__tests__/fixtures/config_preview.json`. Regenerate
  that file (and `config_defaults.json`) from the backend whenever a figure or a default
  changes; never edit it by hand.
