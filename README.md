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
