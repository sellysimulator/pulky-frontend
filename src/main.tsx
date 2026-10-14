import './api/socketHandlers'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { BackendStatusProvider } from './contexts/BackendStatusContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BackendStatusProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </BackendStatusProvider>
    </AuthProvider>
  </StrictMode>,
)
