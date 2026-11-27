import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './api-fallback.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { PageLoadingFallback } from './components/PageFallback.js';
import './index.css';

const App = lazy(() => import('./App.js').then((m) => ({ default: m.App })));
const WebDashboardApp = lazy(() =>
  import('./web/WebDashboardApp.js').then((m) => ({ default: m.WebDashboardApp }))
);

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
      <Suspense fallback={<PageLoadingFallback fullScreen label="Starting MAHI Browser..." />}>
        {isWebDashboard ? <WebDashboardApp /> : <App />}
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
