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

## Tests

- jsdom and Testing Library only: no browser, screenshot or headless checks (visual
  checks are the human's).
- The decision form tests answer `preview_decision` with
  `src/__tests__/fixtures/fakeDecisionServer.ts`; the config screen tests render the
  backend's recorded answers, `src/__tests__/fixtures/config_preview.json`. Regenerate
  that file (and `config_defaults.json`) from the backend whenever a figure or a default
  changes; never edit it by hand.
