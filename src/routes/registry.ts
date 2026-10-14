import type { ComponentType } from 'react'

export type Guard = 'public' | 'auth' | 'auth+backend'

export interface PageRoute {
  path: string
  guard: Guard
}

interface PageModule {
  route?: unknown
  default?: unknown
}

const GUARDS: readonly string[] = ['public', 'auth', 'auth+backend']

const pageModules = import.meta.glob<PageModule>('../pages/*.tsx', { eager: true })

const shellModules = import.meta.glob<{ default?: ComponentType }>(
  [
    '../components/shared/BackendWakeUp.tsx',
    '../components/shared/AlertContainer.tsx',
    '../components/shared/LoadingSpinner.tsx',
  ],
  { eager: true },
)

function isPageRoute(value: unknown): value is PageRoute {
  if (typeof value !== 'object' || value === null) return false
  const { path, guard } = value as { path?: unknown; guard?: unknown }
  return typeof path === 'string' && path !== '' && typeof guard === 'string' && GUARDS.includes(guard)
}

/** Every page module's valid route descriptors, in module-name order. */
export function getRoutes(): Array<PageRoute & { component: ComponentType }> {
  const routes: Array<PageRoute & { component: ComponentType }> = []
  for (const file of Object.keys(pageModules).sort()) {
    const mod = pageModules[file]
    const component = mod.default
    if (!component) continue
    const descriptors = Array.isArray(mod.route) ? mod.route : [mod.route]
    for (const descriptor of descriptors) {
      if (isPageRoute(descriptor)) {
        routes.push({
          path: descriptor.path,
          guard: descriptor.guard,
          component: component as ComponentType,
        })
      }
    }
  }
  return routes
}

/** Resolves src/components/shared/<name>.tsx, or null when it does not exist yet. */
export function getShellComponent(
  name: 'BackendWakeUp' | 'AlertContainer' | 'LoadingSpinner',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any> | null {
  const mod = shellModules[`../components/shared/${name}.tsx`]
  return mod?.default ?? null
}
