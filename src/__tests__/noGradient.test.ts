/**
 * Section 22, acceptance criterion 3 and failure mode 4 ("Gradient sneaks in"):
 * no file under `src/` other than `src/__tests__/` contains `gradient`
 * (design.md §1, §13). The scanner is tested on in-memory files first, so the
 * scan over `src/` cannot pass merely because it scans nothing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

interface SourceFile {
  path: string
  text: string
}

/** The files whose text contains the substring `gradient`, case-insensitive. */
function findGradients(files: SourceFile[]): string[] {
  return files.filter((f) => /gradient/i.test(f.text)).map((f) => f.path)
}

function listSources(dir: string, root: string): SourceFile[] {
  const out: SourceFile[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = relative(root, full)
    if (rel.split(sep)[0] === '__tests__') continue
    if (statSync(full).isDirectory()) out.push(...listSources(full, root))
    else out.push({ path: rel, text: readFileSync(full, 'utf8') })
  }
  return out
}

describe('the gradient scanner', () => {
  it('flags a Tailwind gradient utility in an in-memory file list', () => {
    const files: SourceFile[] = [
      { path: 'ok.tsx', text: '<div className="bg-card rounded-lg" />' },
      { path: 'bad.tsx', text: '<div className="bg-gradient-to-r from-accent" />' },
    ]
    expect(findGradients(files)).toEqual(['bad.tsx'])
  })

  it.each(['linear-gradient(red, blue)', 'createLinearGradient', 'RADIAL-GRADIENT(x)', 'repeating-linear-gradient(45deg)'])(
    'flags %s regardless of case',
    (text) => {
      expect(findGradients([{ path: 'x.css', text }])).toEqual(['x.css'])
    },
  )

  it('passes a clean list', () => {
    expect(findGradients([{ path: 'a.ts', text: 'const a = 1' }])).toEqual([])
  })
})

describe('src/ (criterion 3)', () => {
  const root = resolve(process.cwd(), 'src')
  const sources = listSources(root, root)

  it('scans real files, including the stylesheet and the shared components', () => {
    const paths = sources.map((s) => s.path)
    expect(paths).toContain('index.css')
    expect(paths.some((p) => p.startsWith(join('components', 'shared')))).toBe(true)
    expect(paths.some((p) => p.startsWith('__tests__'))).toBe(false)
  })

  it('contains no gradient anywhere', () => {
    expect(findGradients(sources)).toEqual([])
  })
})

describe('raw colours (conventions §4)', () => {
  const allowed = [
    'index.css',
    join('components', 'charts', 'chartSetup.ts'),
    join('components', 'game', 'views', 'board3d', 'scenePalette.ts'),
  ]

  /** The files outside the allowlist whose text contains a `#RRGGBB` literal. */
  function findRawHex(files: SourceFile[]): string[] {
    return files
      .filter((f) => !allowed.includes(f.path))
      .filter((f) => /#[0-9a-fA-F]{6}\b/.test(f.text))
      .map((f) => f.path)
  }

  it('flags a hex literal in any file other than the three allowed paths', () => {
    const hex = 'const c = "#1A2B3C"'
    const files: SourceFile[] = [
      { path: 'bad.tsx', text: hex },
      { path: join('components', 'charts', 'other.ts'), text: hex },
      ...allowed.map((path) => ({ path, text: hex })),
    ]
    expect(findRawHex(files)).toEqual(['bad.tsx', join('components', 'charts', 'other.ts')])
  })

  it('no hex literal outside index.css, chartSetup.ts and scenePalette.ts', () => {
    const root = resolve(process.cwd(), 'src')
    expect(findRawHex(listSources(root, root))).toEqual([])
  })
})
