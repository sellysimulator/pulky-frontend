# Deploying the Pulky frontend

Spec: `docs/spec/13-deploy.md` section 13.13 (the checklist lives there; this file gives the commands).

## Rules

- Deploy outside class hours: a backend restart ends every running game.
- Wire changes: the backend ships first, then the frontend, in the same window.
- Never commit a secret. Every file imported from `src/` must be committed (`firebase.ts` included), or CI cannot build.

## One-time setup

1. Firebase project `pulky-da26c`, Hosting site `pulkysim` (`https://pulkysim.web.app`). Apply auth settings with `firebase deploy --only auth`. A new Hosting domain must be added to Auth's authorized domains.
2. GitHub repository variables `VITE_API_BASE_URL` and `VITE_SOCKET_URL`: both `https://pulky-backend.onrender.com`. The build fails if either is empty or a Hosting origin.
3. GitHub repository secret `FIREBASE_SERVICE_ACCOUNT_PULKY_DA26C`, created by `firebase init hosting:github`.
4. Merging to `main` runs `firebase-hosting-merge.yml` (live channel); pull requests run `firebase-hosting-pull-request.yml` (preview channel). Both run `npx tsc -b`, `npx eslint .`, `npx vitest run` and `npm run build` with `REQUIRE_BACKEND_ENV=1` first.
5. Every push and every pull request, forks included, also runs `ci.yml`: `npx tsc -b`, `npx eslint .`, `npx vitest run --coverage` (it fails below the thresholds in `vite.config.ts`) and a plain `npm run build`. It needs no secret or variable and deploys nothing.

## Checklist (spec 13.13)

- The workflow runs `actions/setup-node` and `npm ci`, and no gitignored file is imported from `src/`.
- The deployed bundle carries the backend host: the `index-*.js` asset named in `https://pulkysim.web.app/index.html` contains `pulky-backend.onrender.com`.
- Smoke test on the deployed stack, signed in and as a guest: create, join from a second browser, play a full day, finish a game.
