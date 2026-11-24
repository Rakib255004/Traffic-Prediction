import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { warmUpBackend } from './api.js'

// Warm up Render backend immediately on page load (prevents cold-start CORS failures)
warmUpBackend();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
