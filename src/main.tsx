import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void (async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        const urls = Array.from(
          document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]'),
        )
          .map((el) => (el instanceof HTMLScriptElement ? el.src : (el as HTMLLinkElement).href))
          .filter(Boolean);
        registration.active?.postMessage({ type: 'CACHE_URLS', urls });
        navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_URLS', urls });
      } catch (error) {
        console.warn('[pwa] service worker registration failed', error);
      }
    })();
  });
}
