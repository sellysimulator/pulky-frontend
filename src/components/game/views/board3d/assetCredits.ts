export interface ModelCredit {
  file: 'truck.glb' | 'money.glb' | 'tree.glb'
  title: string
  author: string
  authorUrl: string
  sourceUrl: string
  changes: string
  bytes: number
  sha256: string
}

export const MODEL_LICENSE = {
  id: 'CC-BY-4.0',
  name: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/',
} as const

export const MODEL_CREDITS: readonly ModelCredit[] = [
  {
    file: 'truck.glb',
    title: 'Low Poly Truck',
    author: 'Arifido._',
    authorUrl: 'https://sketchfab.com/Arifido._',
    sourceUrl: 'https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216',
    changes: 'resized; materials merged into vertex colours when drawn',
    bytes: 230448,
    sha256: '04b118e577782b345019c54b3ff836154488567d22985706039e0a415b2ee98b',
  },
  {
    file: 'money.glb',
    title: 'Low Poly Stack of Money',
    author: 'Courvois',
    authorUrl: 'https://sketchfab.com/CourvoisZ',
    sourceUrl: 'https://sketchfab.com/3d-models/low-poly-stack-of-money-632cf7dbc59a496283d1a6092dc6f9b0',
    changes: 'resized',
    bytes: 195856,
    sha256: '2cff577b45cd5fdde962d43c9e559780d1a9a0ca1f66b8b07b3ae247ad170a03',
  },
  {
    file: 'tree.glb',
    title: 'Arvore - Lowpoly Tree Cartoon',
    author: 'DioMartins',
    authorUrl: 'https://sketchfab.com/diodesign',
    sourceUrl: 'https://sketchfab.com/3d-models/arvore-lowpoly-tree-cartoon-87b3e575b98743d295fb8800cc81030a',
    changes: 'resized; materials merged into vertex colours when drawn',
    bytes: 48444,
    sha256: 'abe88c475be92aabca301891817cf1c875dd2ac65a2d7a1a3afc6129c5379f1c',
  },
]

export const FONT_CREDIT = {
  name: 'Figtree',
  author: 'Erik Kennedy',
  license: 'SIL Open Font License 1.1',
  licenseUrl: 'https://openfontlicense.org',
  sourceUrl: 'https://github.com/erikdkennedy/figtree',
} as const
