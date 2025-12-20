import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { WhiteboardProvider } from './whiteboard/WhiteboardStore';

// Expose selected Vite env vars on globalThis so non-ESM test environments (Jest) don't choke on import.meta.env
(globalThis as any).__VITE_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
(globalThis as any).__VITE_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
(globalThis as any).__VITE_COLLAB_BASE_URL = (import.meta as any).env?.VITE_COLLAB_BASE_URL;


const basename = import.meta.env.BASE_URL || '/';

const rootElement = document.getElementById('root') as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <WhiteboardProvider>
        <App />
      </WhiteboardProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}