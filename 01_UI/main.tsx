import React from 'react';
import ReactDOM from 'react-dom/client';
import './api-fallback.js';
import { App } from './App.js';
import { WebDashboardApp } from './web/WebDashboardApp.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './index.css';

const isWebDashboard =
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/app') ||
   window.location.search.includes('mode=web') ||
   window.location.hash.startsWith('#/app') ||
   window.location.hostname.startsWith('app.') ||
   localStorage.getItem('mahi_app_mode') === 'web');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isWebDashboard ? <WebDashboardApp /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
