# MAHI BROWSER — PHASE 9 MASTER AUDIT
## 01. PROJECT ARCHITECTURE & SUBSYSTEM TOPOLOGY
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator (Senior Full-Stack & Systems Review)  
**Execution Mode:** Strictly Read-Only Production Audit  

---

### 1. Executive Summary & Topology Map
MAHI Browser comprises three distinct, highly decoupled subsystems rather than a monolithic full-stack application:

```
                                  +-------------------------------------------------------------+
                                  |                     MAHI BROWSER ECOSYSTEM                  |
                                  +-------------------------------------------------------------+
                                                                 |
               +-------------------------------------------------+-----------------------------------------------+
               |                                                 |                                               |
               v                                                 v                                               v
+-------------------------------+             +------------------------------------+           +----------------------------------+
|   1. DESKTOP CLIENT (LOCAL)   |             |   2. MARKETING SITE (LANDING)      |           |   3. CENTRAL CLOUD BACKEND       |
+-------------------------------+             +------------------------------------+           +----------------------------------+
| - Electron 33 / Chromium 138  |             | - Static HTML5 / CSS3 / Vanilla JS |           | - Node.js Central API Server     |
| - React 18 + Vite Frontend    |             | - Source: landing/*.html           |           | - Source: 07_BACKEND, 05_AUTH    |
| - SQLite Embedded DB          |             | - Production: mahibrowser.com      |           | - REST Endpoints: /api/v1/*      |
| - 289 Local User Profiles     |             | - Nginx web server delivery        |           | - Web Admin Control Center       |
| - 6 Starter Templates         |             | - Marketing Funnels & Auth Forms   |           | - Token Authentication (JWT)     |
| - "By Munna Bhai" Branding    |             | - Windows Installer Gateway        |           | - Cloud Sync & Team Workspaces   |
+-------------------------------+             +------------------------------------+           +----------------------------------+
```

---

### 2. Subsystem Breakdown & Source Locations

#### Subsystem A: Desktop Electron Application
- **Workspace Source:** `01_UI/` (React renderer), `07_BACKEND/` (Electron main process), `10_CONFIG/preload/` (IPC bridge).
- **Installed Binary:** `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe` (v1.1.1 RC1).
- **Core Engine:** Managed Google Chromium 138.0.7204.0 located in `.mahi_data/engines/138.0.7204.0/chrome-win/chrome.exe`.
- **Database:** Local SQLite database at `%APPDATA%\mahi-browser\mahi_browser.sqlite` containing 289 profiles and Phase 17 Starter Templates.
- **Creator Branding:** "By Munna Bhai" permanently embedded in title bar, sidebar, and package.json.

#### Subsystem B: Marketing Website & Landing Pages
- **Workspace Source:** `landing/`
  - `index.html` (Main conversion landing page, 99,646 bytes)
  - `download.html` (Authenticated installer download portal, 24,222 bytes)
  - `pricing.html` (Commercial tier comparison and billing matrix, 25,002 bytes)
  - `login.html` & `signup.html` (Client-side authentication entry points)
  - `book-demo.html` (Enterprise lead capture)
  - `privacy.html`, `terms.html`, `aup.html` (Legal and compliance)
  - `assets/` (Styles, images, videos, UI mockups, icons)
- **Deployment Host:** Hosted on production VPS behind Nginx at `https://mahibrowser.com`.

#### Subsystem C: Cloud Platform & Admin Backend
- **Workspace Source:** `07_BACKEND/` & `05_AUTH/`
  - `07_BACKEND/server/app.ts` (Central HTTP API Server, port 32123 locally)
  - `07_BACKEND/server/web-admin-html.ts` (Commercial Web Admin Control Center UI)
  - `07_BACKEND/commercial/commercial-api-router.ts` (`/api/v1/*` endpoints)
  - `05_AUTH/central-auth-service.ts` (PBKDF2 passwords, JWT tokens, session lifecycle)
- **Production Status:** Partially deployed behind Nginx. Authentication endpoints (`/api/v1/auth/me`, `/api/v1/auth/login`) respond, but `/dashboard`, `/api/v1/plans`, and installer file hosting return fallback or 404.

---

### 3. Build & Runtime Commands

| Target | Build Tool | Development Command | Production Build Command | Output Directory |
|---|---|---|---|---|
| Desktop Client | Vite + Electron Builder | `npm run dev` | `npm run build` / `npm run dist:win` | `dist/`, `release/` |
| Landing Pages | Static (HTML/CSS/JS) | Local file preview / HTTP server | Static rsync / scp to Nginx root | `/var/www/mahibrowser.com/` |
| Cloud Backend | Node.js (TypeScript) | `node 07_BACKEND/index.ts` | `tsc` -> `pm2 start dist/backend` | Nginx reverse proxy (`127.0.0.1:32123`) |

---

### 4. Shared vs Isolated Assets

| Asset / Component | Desktop Client | Landing Page | Cloud Dashboard | Shared Status |
|---|---|---|---|---|
| Product Logo & Favicon | Embedded in `13_ASSETS` & `public/` | `landing/assets/img/logo.png` | Embedded SVG / CSS | Identical Visual Asset |
| Creator Branding ("By Munna Bhai") | Active in v1.1.1 RC1 UI | Added in local `landing/download.html` | Present in local source | Local Only on Web |
| SQLite Database | Local only (`mahi_browser.sqlite`) | None | None | Strictly Isolated |
| Chromium Executable | Local bundled engine | None | None | Strictly Isolated |
| User Session Token | Stored in Electron secure storage | Stored in `localStorage` / cookies | Header `Authorization: Bearer` | Shared Contract |
