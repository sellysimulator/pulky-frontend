import { createElement, useMemo, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireBackend } from './routes/guards'
import { getRoutes, getShellComponent } from './routes/registry'

export default function App(): ReactElement {
  const routes = useMemo(() => getRoutes(), [])
  const alerts = getShellComponent('AlertContainer')

  return (
    <>
      <Routes>
        {routes.map(({ path, guard, component }) => {
          const page = createElement(component)
          const element =
            guard === 'public' ? (
              page
            ) : guard === 'auth' ? (
              <RequireAuth>{page}</RequireAuth>
            ) : (
              <RequireAuth>
                <RequireBackend>{page}</RequireBackend>
              </RequireAuth>
            )
          return <Route key={path} path={path} element={element} />
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {alerts ? createElement(alerts) : null}
    </>
  )
}
