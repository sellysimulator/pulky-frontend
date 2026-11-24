import './api/socketHandlers'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { BackendStatusProvider } from './contexts/BackendStatusContext'
import { claimPreloadReload } from './utils/storage'

// After a deploy, an open tab may request chunk files that no longer exist. Reload once.
window.addEventListener('vite:preloadError', (event) => {
  if (!claimPreloadReload()) return
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendStatusProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </BackendStatusProvider>
  </StrictMode>,
)
