/**
 * Section 32 - the shipped models and their credits (plan 32 section 3.2, failure mode 12; acceptance 2).
 * Reads the real files: a changed byte, a missing credit or a stripped asset.extras fails here.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_CREDIT, MODEL_CREDITS, MODEL_LICENSE } from '../components/game/views/board3d/assetCredits'

const ROOT = process.cwd()
const MODELS = resolve(ROOT, 'public/3dmodels')
const glbs = readdirSync(MODELS).filter((f) => f.endsWith('.glb'))
const attribution = readFileSync(resolve(MODELS, 'ATTRIBUTION.txt'), 'utf8')
const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')

interface Glb {
  version: number
  magic: string
  json: {
    asset: { extras?: Record<string, string> }
    extensionsUsed?: unknown[]
    skins?: unknown[]
    animations?: unknown[]
  }
}

function parse(bytes: Buffer): Glb {
  const length = bytes.readUInt32LE(12)
  return {
    magic: bytes.subarray(0, 4).toString('ascii'),
    version: bytes.readUInt32LE(4),
    json: JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')),
  }
}

describe('MODEL_CREDITS data', () => {
  it('lists truck, money and tree in that order, with the licence', () => {
    expect(MODEL_CREDITS.map((c) => c.file)).toEqual(['truck.glb', 'money.glb', 'tree.glb'])
    expect(MODEL_LICENSE).toEqual({ id: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' })
    expect(FONT_CREDIT).toEqual({
      name: 'Figtree',
      author: 'Erik Kennedy',
      license: 'SIL Open Font License 1.1',
      licenseUrl: 'https://openfontlicense.org',
      sourceUrl: 'https://github.com/erikdkennedy/figtree',
    })
  })

  it('quotes the table of plan 32 section 3.2', () => {
    const [truck, money, tree] = MODEL_CREDITS
    expect(truck).toMatchObject({
      title: 'Low Poly Truck',
      author: 'Arifido._',
      authorUrl: 'https://sketchfab.com/Arifido._',
      bytes: 230448,
      sha256: '04b118e577782b345019c54b3ff836154488567d22985706039e0a415b2ee98b',
      changes: 'resized; materials merged into vertex colours when drawn',
      sourceUrl: 'https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216',
    })
    expect(money).toMatchObject({
      title: 'Low Poly Stack of Money',
      author: 'Courvois',
      authorUrl: 'https://sketchfab.com/CourvoisZ',
      bytes: 195856,
      sha256: '2cff577b45cd5fdde962d43c9e559780d1a9a0ca1f66b8b07b3ae247ad170a03',
      changes: 'resized',
      sourceUrl: 'https://sketchfab.com/3d-models/low-poly-stack-of-money-632cf7dbc59a496283d1a6092dc6f9b0',
    })
    expect(tree).toMatchObject({
      title: 'Arvore - Lowpoly Tree Cartoon',
      author: 'DioMartins',
      authorUrl: 'https://sketchfab.com/diodesign',
      bytes: 48444,
      sha256: 'abe88c475be92aabca301891817cf1c875dd2ac65a2d7a1a3afc6129c5379f1c',
      changes: 'resized; materials merged into vertex colours when drawn',
      sourceUrl: 'https://sketchfab.com/3d-models/arvore-lowpoly-tree-cartoon-87b3e575b98743d295fb8800cc81030a',
    })
  })
})

describe('public/3dmodels (failure mode 12, acceptance 2)', () => {
  it('holds exactly the credited models and ATTRIBUTION.txt', () => {
    expect(readdirSync(MODELS).sort()).toEqual(['ATTRIBUTION.txt', 'money.glb', 'tree.glb', 'truck.glb'])
    expect([...glbs].sort()).toEqual(MODEL_CREDITS.map((c) => c.file).sort())
  })

  it('every file has a credit and every credit has a file', () => {
    for (const file of glbs) expect(MODEL_CREDITS.some((c) => c.file === file)).toBe(true)
    for (const credit of MODEL_CREDITS) expect(glbs).toContain(credit.file)
  })

  describe.each(MODEL_CREDITS.map((c) => [c.file, c] as const))('%s', (file, credit) => {
    const bytes = readFileSync(resolve(MODELS, file))
    const glb = parse(bytes)

    it('has the credited byte count and SHA-256', () => {
      expect(bytes.length).toBe(credit.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(credit.sha256)
    })

    it('is a glTF 2 binary', () => {
      expect(glb.magic).toBe('glTF')
      expect(glb.version).toBe(2)
    })

    it('carries the credit in asset.extras', () => {
      const extras = glb.json.asset.extras
      expect(extras).toBeDefined()
      expect(extras?.title).toBe(credit.title)
      expect(extras?.source).toBe(credit.sourceUrl)
      expect(extras?.author).toBe(`${credit.author} (${credit.authorUrl})`)
      expect(extras?.license?.startsWith('CC-BY-4.0')).toBe(true)
    })

    it('needs no decoder, skeleton or animation', () => {
      expect(glb.json.extensionsUsed ?? []).toEqual([])
      expect(glb.json.skins ?? []).toEqual([])
      expect(glb.json.animations ?? []).toEqual([])
    })

    it('is named in ATTRIBUTION.txt and the README with its title and author', () => {
      for (const text of [attribution, readme]) {
        expect(text).toContain(file)
        expect(text).toContain(credit.title)
        expect(text).toContain(credit.author)
      }
      expect(readme).toContain(credit.sourceUrl)
      expect(readme).toContain(credit.authorUrl)
      expect(readme).toContain(credit.changes)
    })
  })

  it('is a byte copy of docs/plan/assets/3dmodels when the plan is beside the repo', () => {
    const source = resolve(ROOT, '../docs/plan/assets/3dmodels')
    if (!existsSync(source)) return
    for (const file of readdirSync(source)) {
      expect(readFileSync(resolve(MODELS, file)).equals(readFileSync(resolve(source, file)))).toBe(true)
    }
  })

  it('credits the font in ATTRIBUTION.txt', () => {
    expect(attribution).toContain('Figtree')
    expect(attribution).toContain('Erik Kennedy')
  })
})

describe('README.md', () => {
  it('ends with the Third-party 3D assets section', () => {
    const at = readme.indexOf('## Third-party 3D assets')
    expect(at).toBeGreaterThan(0)
    const section = readme.slice(at)
    expect(section).not.toMatch(/\n## (?!Third-party)/)
    expect(section).toContain('https://creativecommons.org/licenses/by/4.0/')
    expect(section).toContain('**3D model credits**')
    expect(section).toContain('public/3dmodels/ATTRIBUTION.txt')
    expect(section).toContain('@fontsource/figtree')
    expect(section).toContain('Erik Kennedy')
    expect(section).toContain('new file name')
  })
})
