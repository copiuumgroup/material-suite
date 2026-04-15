import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ToasterProvider } from './components/Toaster'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToasterProvider>
      <App />
    </ToasterProvider>
  </StrictMode>,
)
