# 01_UI — User Interface & Frontend

This folder contains all React frontend components, pages, state management stores, layouts, and styles.

## Directory Structure
- components/: Reusable UI components (Sidebar, Header, Modals, Dropdowns)
- pages/: Full page views (Dashboard, ProfilesList, ProxyManager, ShareInstall, etc.)
- stores/: Zustand state stores (useProfileStore, useProxyStore, useLicenseStore, etc.)
- admin/: Super Admin standalone web UI
- web/: Client web control portal
- App.tsx: Main application shell & router
- main.tsx: React DOM mount entry
- index.css: Global styles and Tailwind configuration
- api-fallback.ts: Web-mode REST API client fallback

## Development Rules
- Place all new React UI components in components/
- Place all new navigation pages in pages/
- Place all global client state in stores/
