/**
 * Section 32 - the hard-won rules in the source (plan 32 failure mode 13; acceptance 10).
 * Comments are scanned too: a comment states a rule without writing the forbidden identifier.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const VIEWS = resolve(ROOT, 'src/components/game/views')

interface Source {
  path: string
  text: string
}

function walk(dir: string): Source[] {
  const out: Source[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push({ path: relative(ROOT, full), text: readFileSync(full, 'utf8') })
  }
  return out
}

const BANNED = [
  'pointLight',
  'spotLight',
  'directionalLight',
  'ambientLight',
  'rectAreaLight',
  'castShadow',
  'receiveShadow',
  '<Html',
  'PointerLockControls',
  'OrbitControls',
  'DRACOLoader',
  'MeshoptDecoder',
  'KTX2Loader',
  'useAnimations',
  'outlineWidth',
  'Math.random',
  "window.addEventListener('pointer",
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'axios',
  'socket.io-client',
] as const

/** Banned in the board modules, and the last few in the thin modules around the board too. */
const BANNED_EVERYWHERE_3D = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'axios', 'socket.io-client']

function scan(files: Source[], needles: readonly string[]): string[] {
  const hits: string[] = []
  for (const f of files) {
    for (const needle of needles) if (f.text.includes(needle)) hits.push(`${f.path}: ${needle}`)
    for (const m of f.text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
      if (m[1].includes('/api/') || m[1].includes('/store/')) hits.push(`${f.path}: import ${m[1]}`)
    }
  }
  return hits
}

describe('the scanner', () => {
  it('flags every banned token and import in an in-memory file', () => {
    for (const needle of BANNED) {
      expect(scan([{ path: 'x.tsx', text: `a ${needle} b` }], BANNED)).toEqual([`x.tsx: ${needle}`])
    }
    expect(scan([{ path: 'x.ts', text: "import { x } from '../../../api/games'" }], [])).toHaveLength(1)
    expect(scan([{ path: 'x.ts', text: "import y from '../../store/gameStore'" }], [])).toHaveLength(1)
    expect(scan([{ path: 'x.ts', text: "import z from '../utils/storage'" }], BANNED)).toEqual([])
  })
})

const boardFiles = [...walk(join(VIEWS, 'board3d')), { path: 'Board3D.tsx', text: readFileSync(join(VIEWS, 'Board3D.tsx'), 'utf8') }]
const thinFiles = ['BoardViewToggle.tsx', 'SceneLoading.tsx', 'boardView.ts'].map((name) => ({
  path: name,
  text: readFileSync(join(VIEWS, name), 'utf8'),
}))

describe('the 3D source', () => {
  it('scans the real tree, not nothing', () => {
    const names = boardFiles.map((f) => f.path)
    expect(boardFiles.length).toBeGreaterThanOrEqual(25)
    expect(names.some((n) => n.endsWith('PulqueriaScene.tsx'))).toBe(true)
    expect(names.some((n) => n.endsWith('SceneSign.tsx'))).toBe(true)
    expect(names.some((n) => n.endsWith('sceneModel.ts'))).toBe(true)
  })

  it('contains none of the forbidden identifiers, and no import from api or store', () => {
    expect(scan(boardFiles, BANNED)).toEqual([])
  })

  it('keeps the toggle, the loading card and boardView.ts free of requests, sockets, api and store', () => {
    expect(scan(thinFiles, BANNED_EVERYWHERE_3D)).toEqual([])
  })

  it('draws its signs from the shipped font, with wrapping off', () => {
    const sign = boardFiles.find((f) => f.path.endsWith('SceneSign.tsx'))
    expect(sign?.text).toContain('font={FIGTREE_600}')
    expect(sign?.text).toContain('whiteSpace="nowrap"')
    expect(sign?.text).toContain('figtree-latin-600-normal.woff')
  })

  it('has exactly one light, a hemisphere light, in PulqueriaScene', () => {
    const lights = boardFiles.filter((f) => /<\w*[lL]ight\b/.test(f.text)).map((f) => f.path)
    expect(lights).toHaveLength(1)
    expect(lights[0].endsWith('PulqueriaScene.tsx')).toBe(true)
    expect(boardFiles.find((f) => f.path.endsWith('PulqueriaScene.tsx'))?.text).toContain('<hemisphereLight')
  })
})

describe('the build configuration', () => {
  const config = readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8')

  it('names the guard plugin, the preload helper rule and both three buckets', () => {
    expect(config).toContain('pulky:forbid-three-in-entry-graph')
    expect(config).toContain("'vite/preload-helper'")
    expect(config).toContain('three-stdlib')
    expect(config).toContain('@react-three')
    expect(config).toContain('troika-three-text')
    expect(config).toContain('chunkSizeWarningLimit: 1200')
  })

  it('pins the preload helper before every other rule, and the three rules before forms', () => {
    const helper = config.indexOf("id.includes('vite/preload-helper')")
    const firebase = config.indexOf("return 'firebase'")
    const three = config.indexOf("return 'three'")
    const forms = config.indexOf("return 'forms'")
    const socket = config.indexOf("return 'socket'")
    expect(helper).toBeGreaterThan(0)
    expect(helper).toBeLessThan(firebase)
    expect(socket).toBeLessThan(three)
    expect(three).toBeLessThan(forms)
  })

  it('excludes the render modules from coverage', () => {
    expect(config).toContain("'src/components/game/views/Board3D.tsx'")
    expect(config).toContain("'src/components/game/views/board3d/render/**'")
  })

  it('keeps the coverage thresholds as they were', () => {
    expect(config).toContain('thresholds: { lines: 92, statements: 91, functions: 93, branches: 83 }')
  })
})

describe('firebase.json', () => {
  it('serves /3dmodels/** with a one-year immutable cache', () => {
    const hosting = JSON.parse(readFileSync(resolve(ROOT, 'firebase.json'), 'utf8')).hosting
    expect(hosting.headers).toEqual([
      { source: '/3dmodels/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ])
    expect(hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }])
  })
})

describe('package.json', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))

  it('pins the 3D dependencies and keeps React on the tilde', () => {
    expect(pkg.dependencies.three).toBe('^0.184.0')
    expect(pkg.dependencies['@react-three/fiber']).toBe('^9.7.0')
    expect(pkg.dependencies['@react-three/drei']).toBe('^10.7.7')
    expect(pkg.dependencies['@fontsource/figtree']).toBe('^5.3.0')
    expect(pkg.devDependencies['@types/three']).toBe('^0.184.0')
    expect(pkg.dependencies.react).toBe('~19.2.0')
    expect(pkg.dependencies['react-dom']).toBe('~19.2.0')
  })
})
