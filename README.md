# Pulky Frontend

React + Vite + TypeScript client for Pulky, the pulque supply game.

The game, its architecture and its plumbing rules are specified in `../docs/spec/` (start at
its `README.md`); the visual system is `../docs/design.md`.

```bash
nvm use            # Node 24.22.1 (.nvmrc)
npm ci
npm run dev        # http://localhost:5173, proxies /api and /socket.io to localhost:8080
npx tsc -b && npx eslint . && npx vitest run --coverage && npm run build   # the gates ci.yml runs
```

## Contracts with the backend

- **No copied limits.** `MAX_ORDER`, `MAX_PEER_PRICE`, `MAX_DISPLAY_NAME` and every other hard limit come from `GET /config/defaults`:
  `RequireBackend` runs `loadLimits()` once the backend is awake, and components read `useLimits()` (`src/api/config.ts`), which
  never requests anything; they set the inputs' bounds, while the field messages come from the server's preview. Config controls take their bounds from the same
  response's `fields`. Tests seed them from `src/__tests__/fixtures/config_defaults.json`, which is that response, regenerated from
  the backend's `config_schema()` whenever it changes.
- **Several games at once** (spec §11.3, §13.4): `createRoomBatch` (`POST /rooms/batch-create`) and `getRoomsSummary`
  (`POST /rooms/summary`, a POST so the secrets stay out of URLs) in `src/api/rooms.ts`. The batch's room codes live in
  session storage as `pulky.host_batch`, each secret under its usual host-secret key; the batch bounds are the served
  `MIN_BATCH_ROOMS` / `MAX_BATCH_ROOMS`. "Start all ready games" sends the ordinary `start_game` for each room the server
  says `can_start`. Its refusals come back as `join_error {message, room_code}`: one for a game of the batch shows on
  that card ("Game N (CODE): …", `claimJoinErrors` in `src/api/joinErrorRouting.ts`) until the game shows started, and a status
  line reads "Started X of Y games." from the next summary.
- **Games you hosted** (spec §13.4, §13.5): the profile loads `getMyHostedGames` (`GET /users/me/hosted-games`, `src/api/users.ts`)
  in its own request, with its own loading and error ("Could not load the games you hosted."), so a failure there leaves the
  rest of the profile on screen. It is its own table (`HostedGamesTable`), each entry opening `/results/:publicId`. It is
  the host record's only use: the played table and the stats stay played-only, and nothing else (export, claim, results,
  host screens) reads it. The results payload carries no host name.
- **Results by public id only**: every way to a finished game's results (the end screens' **See the results**, the profile's
  games at `/profile/games/:publicId`, the hosted list) uses the stored game's public id (`resultsPath`); never a room code
  or a row id, and the link never expires. `ResultsPage` needs nothing else: session storage only decides the host's UI.
- **Hidden defaults** (spec §9.3): a host config holds null for each risk whose field has `hidden_default`; the form shows
  **Default (hidden)**, and the calculator and help examples say **Hidden until the game ends** where they would need it. The
  results' `config` reveals the values; **Play again** copies the host's config from the store, never that one.
- **Export is open** (spec §13.8 block 6, §13.4): every viewer of the results page gets **Export CSV** / **Export JSON**
  (`ExportControls`); `exportGame` sends no host secret, since the server serves the export by game id like the results. The files name every pulquería `P<N>` only (the screens keep the names). Each
  game and format downloads once per browser session (`hasExported` / `markExported`, `pulky.exported.<id>.<format>` in session
  storage, cleared by sign-out's `pulky.*` sweep); after a download the button is disabled and says so. That is UX only: the
  server's per-IP limit (100 an hour, spec §0.6) is the real guard, and its 429 reads in minutes. Reveal, **Play again** and
  **Debrief notes** stay keyed to this game's host secret (`viewer.isHost`).
- **Server figures only** (spec §0.5 invariant 7, D54): the client holds no copy of any game formula. Every figure comes from a
  payload, or from a preview request that runs the engine's own functions for what the user is typing:
  - the decision form asks `preview_decision` (a socket acknowledgement, `src/api/games.ts`, hook `src/game/useDecisionPreview.ts`)
    250 ms after the last edit, and shows its outlay, affordability, tier cards (the Paid-price card follows the spot order),
    "now in your cellar" line and field messages, with **…** until the answer for the draft on screen arrives (a `null`
    acknowledgement, the server's fallback when the event failed or was rate limited, keeps the last figures);
  - the host config panel asks `POST /config/preview` (`src/api/config.ts`, `src/components/config/configPreview.ts`) 300 ms after
    the last edit and shares the answer with the previews, the insurance calculator and every help entry; **Set fees from margin**
    sends the server's `fee_from_margin`;
  - charts plot server series (the profit races use `series.cumulative_profit` and the host's `cumulative_profit_by_day`; the
    console's spot band is `host_view.spot_range`).
  A new figure is a new server field, never a client formula. Tests drive the form with a double of the server's answer
  (`src/__tests__/fixtures/fakeDecisionServer.ts`) and the config screen with the backend's recorded answers
  (`src/__tests__/fixtures/config_preview.json`, regenerated from the backend's `config_preview()` whenever a figure changes).
- **Hand-mirrored wire constants.** `WEEKDAYS`, `INCOTERM_TIERS`, `INSURED_TIERS`, `PLAYER_CONFIG_KEYS` and `SECRET_CONFIG_KEYS`
  (`src/types/game.ts`) and the room-code alphabet `CODE_ALPHABET` (`src/pages/HomePage.tsx`, the backend's
  `ROOM_CODE_ALPHABET`, spec §11.3) are copied from the backend by hand: change them in both repos together. They are wire
  contract, not game formulas, so D54 allows them.

## Charts

Every chart is a Chart.js chart inside a `ChartBox` (title, caption, a **Show table** toggle and an error fallback), built by a pure
`build…Config` function that the tests assert on (they mock `react-chartjs-2`, since jsdom has no canvas). The shared kit is
`src/components/charts/chartSetup.ts`:

- canvas colours mirrored from the CSS tokens (a test compares them with `src/index.css`), `pulqueriaStyle(alias)` and `MEASURE_STYLES`;
- one cached hatch helper, `hatched(color)`, for P7–P12 and the hatched measures;
- `pulqueriaLine(alias, emphasis)` for line emphasis (the focused line on top, the rest in the context grey);
- local plugins: `eventBands` (whole-day bands; `peakShading` is its peak tone), `crosshairSync` with `CrosshairGroup.tsx`
  (one day crosshair across several charts, mouse and keyboard), `lineEndLabels` and `quadrantLabels`.

`Legend` (in `src/components/shared/`) is static, a set of `role="switch"` toggles, or an emphasis legend. The summary's flow
chart uses `chartjs-chart-sankey`, pinned at exactly `0.19.1` (spec §13.1): read its diff before moving the pin, keep it in the
`charts` chunk of `manualChunks`, and never use its default gradient colour mode.

The rules are in `../docs/design.md` §3, §7.18 and §9 and spec §13.1 and §13.7–§13.8.

## Third-party 3D assets

The 3D pulquería draws three models licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Their credits
are shown in the game (**3D model credits**) and in `public/3dmodels/ATTRIBUTION.txt`.

| File | Model | Author | Changes |
|---|---|---|---|
| `public/3dmodels/truck.glb` | [Low Poly Truck](https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216) | [Arifido._](https://sketchfab.com/Arifido._) | resized; materials merged into vertex colours when drawn |
| `public/3dmodels/money.glb` | [Low Poly Stack of Money](https://sketchfab.com/3d-models/low-poly-stack-of-money-632cf7dbc59a496283d1a6092dc6f9b0) | [Courvois](https://sketchfab.com/CourvoisZ) | resized |
| `public/3dmodels/tree.glb` | [Arvore - Lowpoly Tree Cartoon](https://sketchfab.com/3d-models/arvore-lowpoly-tree-cartoon-87b3e575b98743d295fb8800cc81030a) | [DioMartins](https://sketchfab.com/diodesign) | resized; materials merged into vertex colours when drawn |

The sign font is [Figtree](https://github.com/erikdkennedy/figtree) by Erik Kennedy (SIL Open Font License 1.1),
installed from `@fontsource/figtree`.

Models are served with a one-year immutable cache (`firebase.json`): never replace one in place; give a changed model
a new file name.
