# 07_BACKEND — Electron Main Process & Web Servers

This folder contains the Electron main process entry point, IPC bridge handlers, local REST API server, and web administration portals.

## Directory Structure
- index.ts: Electron application lifecycle, window management, crash logger
- ipc/
  - register-handlers.ts: Master IPC bridge linking frontend calls to backend services
- api/
  - local-api-server.ts: Local REST API server (port 32123)
- server/
  - app.ts: Central REST router powering Web Admin & Download Portal
  - web-admin-html.ts: Standalone Web Admin dashboard SPA
  - super-admin-html.ts: Secret Super Admin control center SPA
  - download-portal-html.ts: Client installer download & sharing portal
- services/
  - api-v2-service.ts: External API key hashing & management
  - fleet-service.ts: Multi-device fleet telemetry & heartbeat tracking
  - feature-flag-service.ts: Dynamic runtime feature flags
  - audit-service.ts: Activity log recorder & event broadcaster
  - stats-service.ts: Profile launch & uptime telemetry
  - settings-service.ts: App-wide settings & master PIN lock
  - updater-service.ts: Electron auto-updater wrapper
  - vault-service.ts: Encrypted master vault backup & restore
