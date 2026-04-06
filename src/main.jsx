import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('erp:pwa-offline-ready'));
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('erp:pwa-updating'));
    Promise.resolve(updateServiceWorker(true)).catch(() => {
      window.location.reload();
    });
  },
  onRegisteredSW(_, registration) {
    if (!registration) return;
    window.setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 1000);
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
