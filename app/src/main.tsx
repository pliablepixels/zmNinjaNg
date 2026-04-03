import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { initTvNavigation } from './lib/tv-dpad-nav'
import App from './App.tsx'

// Initialize TV D-pad navigation early, before React renders
initTvNavigation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
