import type { ReactElement } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { PageRoute } from '../routes/registry'

export const route: PageRoute = { path: '/join/:roomCode', guard: 'public' }

export default function JoinRedirect(): ReactElement {
  const { roomCode = '' } = useParams()
  return <Navigate to={'/game/' + roomCode.toUpperCase()} replace />
}
