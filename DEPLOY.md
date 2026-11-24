# Deploying the Pulky frontend

Spec: `docs/spec/13-deploy.md` section 13.13 (the checklist lives there; this file gives the commands).

## Rules

- Deploy outside class hours: a backend restart ends every running game.
- Wire changes: the backend ships first, then the frontend, in the same window.
- The handoff-hardening release (`fix/handoff-hardening`) follows that order: backend before frontend. The new backend still accepts the old frontend's signed-in and guest handshakes; the new frontend, signed in with a token it cannot read, sends a handshake with no identity, which only the new backend refuses (an old one would seat it as a fresh guest).
- Never commit a secret. Every file imported from `src/` must be committed (`firebase.ts` included), or CI cannot build.
- The workflows, `vite.config.ts`'s coverage thresholds and this file are pinned by `src/__tests__/deployFiles.test.ts`. Change the test together with the file it pins.

## One-time setup

1. Firebase project `pulky-da26c`, Hosting site `pulkysim` (`https://pulkysim.web.app`). Apply auth settings with `firebase deploy --only auth`. A new Hosting domain must be added to Auth's authorized domains.
2. GitHub repository variables `VITE_API_BASE_URL` and `VITE_SOCKET_URL`: both `https://pulky-backend.onrender.com`. The build fails if either is empty or a Hosting origin.
3. GitHub repository secret `FIREBASE_SERVICE_ACCOUNT_PULKY_DA26C`, created by `firebase init hosting:github`.
4. Merging to `main` runs `firebase-hosting-merge.yml` (live channel); pull requests run `firebase-hosting-pull-request.yml` (preview channel). Both run `npx tsc -b`, `npx eslint .`, `npm test -- --coverage` (it fails below the thresholds in `vite.config.ts`) and `npm run build` with `REQUIRE_BACKEND_ENV=1` first.
5. `firebase-hosting-pull-request.yml` also runs on a fork's pull request and on every push to a branch other than `main`: the same gates with a plain `npm run build`, and no deploy. Those runs need no secret or variable. Its check is `build_and_preview`.

## Checklist (spec 13.13)

- The workflow runs `actions/setup-node` and `npm ci`, and no gitignored file is imported from `src/`.
- The deployed bundle carries the backend host: the `index-*.js` asset named in `https://pulkysim.web.app/index.html` contains `pulky-backend.onrender.com`.
- Smoke test on the deployed stack, signed in and as a guest: create, join from a second browser, play a full day, finish a game.
