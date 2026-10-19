# Pulky Frontend

React + Vite + TypeScript client for Pulky, the pulque supply game.

The game, its architecture, its plumbing rules and its build order are specified in
`../docs/spec/` (start at its `README.md`); the build plan is `../docs/plan/`.

```bash
nvm use            # Node 20.19.0 (.nvmrc)
npm ci
npm run dev        # http://localhost:5173, proxies /api and /socket.io to localhost:8080
npx tsc -b && npx eslint . && npx vitest run --coverage && npm run build   # the gates ci.yml runs
```

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
