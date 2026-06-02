import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Web3Provider from './config/Web3Provider'
import { NotificationProvider } from './context/NotificationContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Web3Provider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </Web3Provider>
  </StrictMode>,
)

