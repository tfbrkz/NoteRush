import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { MidiProvider } from './providers/MidiProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MidiProvider>
      <App />
    </MidiProvider>
    <Analytics />
  </StrictMode>,
)
