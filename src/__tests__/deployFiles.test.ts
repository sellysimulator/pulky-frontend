/**
 * Deployment files and the build guard (spec §13.13).
 *
 * Every rule is a checker over text or a directory; the real files must pass
 * it, and a copy broken in a known way must fail it.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const WORKFLOWS = join(ROOT, '.github', 'workflows')
const MERGE = join(WORKFLOWS, 'firebase-hosting-merge.yml')
const PULL_REQUEST = join(WORKFLOWS, 'firebase-hosting-pull-request.yml')
const BACKEND = 'https://pulky-backend.onrender.com'
const HOSTING = 'https://pulkysim.web.app'

const read = (path: string): string => readFileSync(path, 'utf8')

// --------------------------------------------------------------- workflows

/** True only for a pull request from this repository: not for a fork, nor for a push. */
const SAME_REPOSITORY = 'github.event.pull_request.head.repo.full_name == github.repository'
const BUILD_GUARD = {
  merge: "REQUIRE_BACKEND_ENV: '1'",
  pull_request: `REQUIRE_BACKEND_ENV: \${{ ${SAME_REPOSITORY} && '1' || '' }}`,
} as const

/** Both workflows gate every run, coverage included; only a run of this repository builds with the guard and deploys. */
function checkWorkflow(source: string, kind: 'merge' | 'pull_request'): string[] {
  const problems: string[] = []
  const text = source
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n')
  const ordered = [
    'actions/checkout@v4',
    'actions/setup-node@v4',
    "node-version-file: '.nvmrc'",
    '- run: npm ci',
    '- run: npx tsc -b',
    '- run: npx eslint .',
    '- run: npm test -- --coverage',
    '- run: npm run build',
    BUILD_GUARD[kind],
    'FirebaseExtended/action-hosting-deploy@v0',
    'projectId: pulky-da26c',
  ]
  let cursor = 0
  for (const needle of ordered) {
    const at = text.indexOf(needle, cursor)
    if (at < 0) problems.push(`missing or out of order: ${needle}`)
    else cursor = at
  }

  const build = text.indexOf('- run: npm run build')
  const deploy = text.indexOf('FirebaseExtended/action-hosting-deploy@v0')
  const buildBlock = build >= 0 && deploy > build ? text.slice(build, deploy) : ''
  for (const needle of [
    BUILD_GUARD[kind],
    'VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}',
    'VITE_SOCKET_URL: ${{ vars.VITE_SOCKET_URL }}',
  ]) {
    if (!buildBlock.includes(needle)) problems.push(`build step lacks ${needle}`)
  }

  if (!text.includes('firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_PULKY_DA26C }}'))
    problems.push('deploy lacks the Pulky service-account secret')

  const triggers = /^on:(.*(?:\n[ \t]+.*)*)/m.exec(text)?.[1].replace(/\s+/g, ' ').trim() ?? ''
  const conditions = [...text.matchAll(/^\s*-?\s*if:\s*(.*)$/gm)].map((m) => m[1].trim())
  if (kind === 'merge') {
    if (!/^\s*channelId:\s*live\s*$/m.test(text)) problems.push('merge must deploy to the live channel')
    if (triggers !== 'push: branches: - main') problems.push('merge must run on pushes to main, and only those')
    if (conditions.length > 0) problems.push('no job or step may be skipped')
  } else {
    if (/channelId:\s*live/.test(text)) problems.push('pull request must use a preview channel')
    if (triggers !== 'pull_request: push: branches-ignore: - main')
      problems.push('must run on every pull request and on every push but to main')
    const guard = `- uses: FirebaseExtended/action-hosting-deploy@v0\n        if: \${{ ${SAME_REPOSITORY} }}\n`
    if (conditions.length !== 1 || !text.includes(guard))
      problems.push('only the deploy step is conditional, on a pull request from this repository')
  }

  for (const line of text.split('\n')) {
    if (/^\s*-?\s*run:.*(echo|printenv|set -x)/.test(line)) problems.push(`prints environment: ${line.trim()}`)
    if (/run:.*secrets\./.test(line)) problems.push(`secret used in a command: ${line.trim()}`)
  }
  return problems
}

describe('hosting workflows', () => {
  it.each([
    ['merge', MERGE],
    ['pull_request', PULL_REQUEST],
  ] as const)('%s workflow has the required shape', (kind, path) => {
    expect(existsSync(path)).toBe(true)
    expect(checkWorkflow(read(path), kind)).toEqual([])
  })

  it('names the project id that .firebaserc names', () => {
    const rc = JSON.parse(read(join(ROOT, '.firebaserc'))) as { projects: Record<string, string> }
    expect(Object.values(rc.projects)).toContain('pulky-da26c')
  })

  it('writes no secret value into either workflow', () => {
    for (const path of [MERGE, PULL_REQUEST]) {
      const text = read(path)
      expect(text).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY/)
      expect(text).not.toMatch(/"private_key"\s*:/)
    }
  })

  it('the checker rejects a build without the guard flag or without a gate', () => {
    const text = read(MERGE)
    expect(checkWorkflow(text.replace("REQUIRE_BACKEND_ENV: '1'", ''), 'merge')).not.toEqual([])
    expect(checkWorkflow(text.replace('- run: npx eslint .', ''), 'merge')).not.toEqual([])
    expect(checkWorkflow(text.replace('npm test -- --coverage', 'npm test'), 'merge')).not.toEqual([])
    expect(checkWorkflow(text.replace("node-version-file: '.nvmrc'", ''), 'merge')).not.toEqual([])
    expect(checkWorkflow(text.replace('projectId: pulky-da26c', 'projectId: other'), 'merge')).not.toEqual([])
    expect(checkWorkflow(text.replace('- main', "- '**'"), 'merge')).not.toEqual([])
  })

  it('the checker rejects a pull-request workflow that misses a gate or an event, or deploys what it must not', () => {
    const text = read(PULL_REQUEST)
    expect(checkWorkflow(text.replace('npm test -- --coverage', 'npm test'), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace('- run: npx eslint .\n', ''), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace('- run: npm run build', '- run: npx vite'), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace(/^ {2}pull_request:\n/m, ''), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace('pull_request:', 'pull_request_target:'), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace('branches-ignore', 'branches'), 'pull_request')).not.toEqual([])
    const deployGuard = `        if: \${{ ${SAME_REPOSITORY} }}\n`
    expect(checkWorkflow(text.replace(deployGuard, ''), 'pull_request')).not.toEqual([])
    // A condition on the whole job would skip the gates of a fork's pull request.
    const job = '  build_and_preview:\n'
    expect(checkWorkflow(text.replace(job, job + deployGuard.replace('        ', '    ')), 'pull_request')).not.toEqual([])
    expect(checkWorkflow(text.replace(BUILD_GUARD.pull_request, BUILD_GUARD.merge), 'pull_request')).not.toEqual([])
  })
})

// -------------------------------------------------------------- coverage

const VITE_CONFIG = join(ROOT, 'vite.config.ts')
const COVERAGE_METRICS = ['lines', 'statements', 'functions', 'branches'] as const

/** The numeric `coverage.thresholds` entries of `vite.config.ts`. */
function coverageThresholds(text: string): Record<string, number> {
  const coverage = /coverage:\s*\{[\s\S]*?thresholds:\s*\{([^}]*)\}/.exec(text)?.[1] ?? ''
  return Object.fromEntries([...coverage.matchAll(/(\w+):\s*(\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]))
}

describe('coverage gate', () => {
  it('vite.config.ts gates coverage with the v8 provider on all four metrics', () => {
    const text = read(VITE_CONFIG)
    expect(text).toContain("provider: 'v8'")
    const thresholds = coverageThresholds(text)
    for (const metric of COVERAGE_METRICS) {
      expect(thresholds[metric], metric).toBeGreaterThan(0)
      expect(thresholds[metric], metric).toBeLessThanOrEqual(100)
    }
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.devDependencies).toHaveProperty('@vitest/coverage-v8')
    expect(pkg.scripts.test).toBe('vitest run') // what `npm test -- --coverage` in the workflows runs
  })

  it('the threshold reader misses a metric that is not declared', () => {
    const text = read(VITE_CONFIG).replace(/\bbranches:\s*\d+(?:\.\d+)?,?\s*/, '')
    expect(coverageThresholds(text).branches).toBeUndefined()
  })
})

// ------------------------------------------------------- build-guard

const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

function buildEnv(vars: Record<string, string>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process['env'])) {
    if (key.startsWith('VITE_') || key.startsWith('VITEST') || key === 'REQUIRE_BACKEND_ENV') continue
    if (key === 'NODE_ENV') continue
    base[key] = value
  }
  // The variables are set explicitly, even to empty, so a value kept in a
  // local file cannot leak into the run (a process variable wins over a file).
  return { ...base, NODE_ENV: 'production', ...vars }
}

function runBuild(vars: Record<string, string>): Promise<{ code: number | null; output: string }> {
  const outDir = mkdtempSync(join(tmpdir(), 'pulky-build-'))
  return new Promise((done) => {
    const child = spawn(process.execPath, [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir'], {
      cwd: ROOT,
      env: buildEnv(vars),
    })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.on('close', (code) => {
      rmSync(outDir, { recursive: true, force: true })
      done({ code, output })
    })
  })
}

describe('backend-URL build guard', () => {
  const guarded = { REQUIRE_BACKEND_ENV: '1' }

  it('fails with both variables empty', async () => {
    const { code, output } = await runBuild({ ...guarded, VITE_API_BASE_URL: '', VITE_SOCKET_URL: '' })
    expect(code).not.toBe(0)
    expect(output).toContain('VITE_API_BASE_URL')
    expect(output).toContain('VITE_SOCKET_URL')
  }, 120_000)

  it('fails when the socket URL is the Hosting origin', async () => {
    const { code, output } = await runBuild({
      ...guarded,
      VITE_API_BASE_URL: BACKEND,
      VITE_SOCKET_URL: HOSTING,
    })
    expect(code).not.toBe(0)
    expect(output).toContain('VITE_SOCKET_URL')
  }, 120_000)

  it('fails when the API URL is the Hosting origin', async () => {
    const { code, output } = await runBuild({
      ...guarded,
      VITE_API_BASE_URL: 'https://pulky-da26c.firebaseapp.com',
      VITE_SOCKET_URL: BACKEND,
    })
    expect(code).not.toBe(0)
    expect(output).toContain('VITE_API_BASE_URL')
  }, 120_000)

  it('passes with both set to the backend host', async () => {
    const { code, output } = await runBuild({
      ...guarded,
      VITE_API_BASE_URL: BACKEND,
      VITE_SOCKET_URL: BACKEND,
    })
    expect(output).not.toContain('Refusing to build')
    expect(code).toBe(0)
  }, 300_000)
})

// ------------------------------------------- imports versus .gitignore

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.svg']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function resolveImport(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec.split('?')[0])
  const candidates = [
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.slice(1).map((ext) => join(base, 'index' + ext)),
  ]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

/** Relative files imported from `<repo>/src` that git ignores. */
function ignoredImports(repo: string): string[] {
  const specs = /(?:from\s+|import\s+|import\(\s*|require\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g
  const found = new Set<string>()
  for (const file of walk(join(repo, 'src'))) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
    for (const match of read(file).matchAll(specs)) {
      const target = resolveImport(file, match[1])
      if (target) found.add(target)
    }
  }
  const ignored: string[] = []
  for (const target of found) {
    const result = spawnSync('git', ['check-ignore', '-q', relative(repo, target)], { cwd: repo })
    if (result.status === 0) ignored.push(relative(repo, target))
  }
  return ignored.sort()
}

describe('every imported file is committable', () => {
  it('lists src imports and finds none that git ignores', () => {
    expect(ignoredImports(ROOT)).toEqual([])
  })

  it('actually sees the firebase.ts import that src makes', () => {
    const files = walk(join(ROOT, 'src'))
    const importing = files.filter((f) => /from '(\.\.\/)+firebase'/.test(read(f)))
    expect(importing.length).toBeGreaterThan(0)
    expect(resolveImport(importing[0], '../../firebase')).toBe(join(ROOT, 'firebase.ts'))
  })

  it('fails when firebase.ts is added to .gitignore while src imports it', () => {
    const repo = mkdtempSync(join(tmpdir(), 'pulky-ignore-'))
    try {
      mkdirSync(join(repo, 'src', 'auth'), { recursive: true })
      writeFileSync(join(repo, 'firebase.ts'), 'export const auth = {}\n')
      writeFileSync(join(repo, 'src', 'auth', 'a.ts'), "import { auth } from '../../firebase'\nexport default auth\n")
      expect(spawnSync('git', ['init', '-q'], { cwd: repo }).status).toBe(0)
      expect(ignoredImports(repo)).toEqual([])
      writeFileSync(join(repo, '.gitignore'), 'firebase.ts\n')
      expect(ignoredImports(repo)).toEqual(['firebase.ts'])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

// ------------------------------------------------------------- DEPLOY.md

describe('DEPLOY.md', () => {
  const path = join(ROOT, 'DEPLOY.md')

  it('exists and references spec 13.13 and the one-time setup', () => {
    expect(existsSync(path)).toBe(true)
    const text = read(path)
    expect(text).toContain('13.13')
    expect(text).toContain('pulkysim')
    expect(text).toContain('VITE_API_BASE_URL')
    expect(text).toContain('VITE_SOCKET_URL')
    expect(text).toContain('FIREBASE_SERVICE_ACCOUNT_PULKY_DA26C')
  })

  it('states the class-hours and ship-order rules', () => {
    const text = read(path).toLowerCase()
    expect(text).toContain('class hours')
    expect(text).toMatch(/backend[^.\n]*(first|before)/)
  })

  it('contains no secret value', () => {
    const text = read(path)
    expect(text).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY/)
    expect(text).not.toMatch(/"private_key"\s*:/)
    expect(text).not.toMatch(/"type"\s*:\s*"service_account"/)
    expect(text).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/)
  })
})
