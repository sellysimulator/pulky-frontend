# Pulky Frontend

React + Vite + TypeScript client for Pulky, the pulque supply game.

The game, its architecture, its plumbing rules and its build order are specified in
`../docs/spec/` (start at its `README.md`); the build plan is `../docs/plan/`.

```bash
nvm use            # Node 20.19.0 (.nvmrc)
npm ci
npm run dev        # http://localhost:5173, proxies /api and /socket.io to localhost:8080
npx tsc -b && npx eslint . && npx vitest run && npm run build
```
