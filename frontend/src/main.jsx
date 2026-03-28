import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProviders } from './app/providers/AppProviders'
import { AppRouter } from './app/router/AppRouter'

/** Vite entry: mounts React root with Redux + toasts + `AppRouter`. */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
