// ── Global error logger (helps debug silent crashes on mobile) ────────────────
window.addEventListener('error', (e) => {
  console.error('[Kraken] Uncaught error:', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Kraken] Unhandled promise rejection:', e.reason);
});

// ── Polyfills for older Safari / iOS ─────────────────────────────────────────

// structuredClone — Safari < 15.4
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// Object.hasOwn — Safari < 15.4
if (!Object.hasOwn) {
  Object.hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
}

// crypto.randomUUID — Safari < 15.4
// crypto.getRandomValues is available since iOS 6 so it's safe to use here.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = () => {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = [...b].map(x => x.toString(16).padStart(2, '0'));
    return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
