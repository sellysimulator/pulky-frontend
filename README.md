# Pulky Frontend

React + Vite + TypeScript client for Pulky, the pulque supply game.

The game, its architecture, its plumbing rules and its build order are specified in
`../docs/spec/` (start at its `README.md`); the build plan is `../docs/plan/`.

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
- **Hidden defaults** (spec §9.3): a host config holds null for each risk whose field has `hidden_default`; the form shows
  **Default (hidden)**, and the calculator and help examples say **Hidden until the game ends** where they would need it. The
  results' `config` reveals the values; **Play again** copies the host's config from the store, never that one.
- **Who may export** (spec §13.8 block 6): the results page offers **Export** with this game's host secret, or to a signed-in viewer
  for whom `GET /users/me/hosted-games/{id}` answers 204 (`useHostedGame`, `isMyHostedGame` in `src/api/users.ts`), the server's own
  host rule. Only the export follows that answer (`viewer.canExport`); Reveal, **Play again** and **Debrief notes** stay keyed to the
  secret (`viewer.isHost`).
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

The rules are in `../docs/design.md` §3 and §9 and spec §13.7–§13.8; the build contracts are `../docs/plan/33`–`37`.

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
