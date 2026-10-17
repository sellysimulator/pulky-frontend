import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** The build-time variables a deployed bundle cannot work without. */
const REQUIRED_BACKEND_VARS = ['VITE_API_BASE_URL', 'VITE_SOCKET_URL'] as const

/** Hosting origins: correct for the app, never correct for the backend. */
const HOSTING_ORIGIN = /web\.app|firebaseapp\.com/

/**
 * Fails the build when the backend URLs are missing or point at the Hosting
 * origin — but only when `REQUIRE_BACKEND_ENV=1`, which the deploy workflows
 * set on their build step.
 *
 * `.env` is gitignored, so CI has these values only if the repository
 * variables are set. When they are not, Vite substitutes empty strings and
 * the build still succeeds: the bundle then asks the Hosting origin for
 * everything. REST survives that by accident — the `**` rewrite answers 200
 * with `index.html` — while the socket cannot, because Firebase Hosting does
 * not proxy WebSocket upgrades. Every real-time feature then fails with
 * "Could not reach the game server" on a deploy whose own CI run was green.
 * This turns that into a red build (docs/spec/13-deploy.md §13.13).
 *
 * It is opt-in rather than always-on because `npm run build` also runs with
 * no environment at all — in the test suite's toolchain gate, and for anyone
 * building locally against the dev proxy, where empty is correct.
 */
function requireBackendEnv(env: Record<string, string>): Plugin {
  return {
    name: 'pulky:require-backend-env',
    apply: 'build',
    buildStart() {
      if (process.env.REQUIRE_BACKEND_ENV !== '1') return

      const problems = REQUIRED_BACKEND_VARS.flatMap((key) => {
        const value = (env[key] ?? '').trim()
        if (!value) return [`${key} is empty — set the repository variable vars.${key}.`]
        if (HOSTING_ORIGIN.test(value))
          return [`${key} is ${value}, a Hosting origin. It must be the backend host.`]
        return []
      })

      if (problems.length > 0) {
        this.error(
          'Refusing to build a deploy bundle with no backend configured:\n' +
            problems.map((p) => `  - ${p}`).join('\n') +
            '\nSee docs/spec/13-deploy.md §13.13.',
        )
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Reads the .env files AND the prefixed variables already in process.env,
  // which is how the workflows pass them in.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), tailwindcss(), requireBackendEnv(env)],
    build: {
      rollupOptions: {
        output: {
          /**
           * Splits the dependencies into chunks that change at different rates.
           *
           * One chunk meant the browser parsed every library before the first
           * paint and re-downloaded all of them whenever a single line of app
           * code changed. Split, they are fetched in parallel, parsed as
           * separate units, and a deploy that touches only `src/` leaves every
           * vendor chunk in the HTTP cache.
           *
           * The groupings follow what a screen needs together, not what npm
           * happens to name: `engine.io-client` is socket.io's transport and
           * `@firebase/*` is what `firebase` re-exports, so neither may fall
           * through to the generic bucket and be split away from its own entry
           * point.
           *
           * The v2 3D board adds a lazy `three` bucket here, kept out of the
           * entry graph (docs/spec/13-screens-game.md §13.11).
           */
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
            if (/[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/.test(id)) return 'charts'
            if (/[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|engine\.io-parser|socket\.io-parser)[\\/]/.test(id))
              return 'socket'
            if (/[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/.test(id)) return 'forms'
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
              return 'react'
            return 'vendor'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:8080',
        '/socket.io': { target: 'http://localhost:8080', ws: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.ts'],
      globals: true,
      // ConfigPanel tests take up to 2 s locally and 2–3x that on a GitHub runner; the 5 s default timed them out there.
      testTimeout: 15_000,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/__tests__/**', 'src/main.tsx', 'src/vite-env.d.ts'],
        reporter: ['text-summary', 'text'],
        // Measured coverage floored to an integer, minus 2 points so small changes cannot flake it (docs/spec/13-testing.md §13.12).
        thresholds: { lines: 92, statements: 91, functions: 93, branches: 83 },
      },
    },
  }
})
