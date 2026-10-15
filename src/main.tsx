import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Graceful handler for Google Maps authentication & billing failures
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-auth-error', { detail: { type: 'BillingNotEnabledMapError' } }));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  if (
    msg.includes('BillingNotEnabledMapError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('billing-not-enabled-map-error') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError')
  ) {
    console.warn('[Google Maps Notice]: Google Cloud billing is required to use Google Maps on this API key.', ...args);
    window.dispatchEvent(new CustomEvent('gmp-auth-error', { detail: { type: 'BillingNotEnabledMapError', message: msg } }));
    return;
  }
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

