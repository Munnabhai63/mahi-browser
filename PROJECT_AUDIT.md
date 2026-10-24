# MAHI BROWSER — Comprehensive Technical & Commercial Launch Audit Report

> **Audit Date:** October 2026  
> **Audited Workspace:** `C:\Users\munaf\Desktop\mahai brouser`  
> **Target Commercial Model:** ₹599 / Year Paid Subscription (Desktop App + VPS Backend + Domain + Razorpay Payments)  
> **Mode:** Full Recursive Codebase Audit (Read-Only Analysis)

---

## 1. PROJECT OVERVIEW

### What is this project? What does it do?
**MAHI BROWSER** is a desktop-based multi-profile browser management, anti-detect fingerprinting, and workflow automation application designed in the style of commercial tools like GoLogin, AdsPower, and Multilogin. 

Its primary purpose is to allow users to create and run isolated browser environments ("profiles") with:
- Dedicated, segregated storage directories (`cookies`, `history`, `localStorage`, `cache`, and session state per profile).
- Dynamic browser fingerprint spoofing (Canvas noise, WebGL vendor/renderer spoofing, AudioContext frequency perturbation, User-Agent, platform, hardware concurrency, and device memory masking).
- Per-profile proxy routing (HTTP, HTTPS, SOCKS5) with automated credential injection via a local loopback proxy tunnel (`127.0.0.1:port`) and Chrome DevTools Protocol (CDP) `Fetch.authRequired` interception.
- Profile warming/cookie farming automation visiting authoritative domains in sequence.
- Visual RPA browser automation using Playwright Core.
- Multi-window live action synchronizer (replicating mouse clicks, text inputs, scrolling from a master window to slave windows).

### Desktop app, web app, or both?
- **Desktop Application:** **Primary**. Built as a standalone desktop executable using Electron.
- **Embedded Web Server:** An embedded Node.js HTTP server (`http://127.0.0.1:32123`) runs locally inside the desktop process to provide a REST API v2, Web Admin portal (`/admin`), and Super Admin portal (`/super-admin`). A web fallback UI exists in `01_UI/web/WebApp.tsx`.
- **Cloud/Hosted Web App:** **NOT FOUND**. There is no deployed cloud web application or remote server hosted on the internet in this repository.

### Desktop Base Technology & Exact Version
- **Framework:** **Electron 33.2.1** running on Node.js runtime (`v22.x`/`v24.x`).
- **Browser Engine Execution Model:** **Process Wrapper & CDP Launcher** (spawning local system binaries).
  - The project is **NOT** a custom-compiled Chromium fork (like GoLogin's Orbita or AdsPower's SunBrowser).
  - The application dynamically locates and launches the user's locally installed Google Chrome, Microsoft Edge, or system Chromium binary via Node.js `child_process.spawn()` in [`02_BROWSER/launcher.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/launcher.ts#L1).
  - Anti-detect masking is injected via:
    1. Chromium command-line flags (`--user-data-dir`, `--user-agent`, `--force-webrtc-ip-handling-policy`, etc.).
    2. A dynamically generated unpacked Manifest V3 Chrome Extension placed inside each profile's directory (`storageDir/mahi_title_extension`) containing `stealth-core.js` and `background.js` running in the `MAIN` execution world at `document_start`.
    3. Chrome DevTools Protocol (CDP) remote debugging port (`34000-49000`) for automated proxy credential handling and action synchronization.

---

## 2. TECH STACK

### Languages Breakdown
Based on a scan of all 49,920 lines of code across active source folders (excluding `node_modules`, `dist`, `dist-electron`, and `release`):

| Language | Line Count | Percentage | Primary Usage |
| :--- | :--- | :--- | :--- |
| **TypeScript (`.ts`)** | 25,425 | **50.9%** | Backend services, IPC handlers, REST API, SQLite connection, types |
| **TypeScript JSX (`.tsx`)** | 15,820 | **31.7%** | React UI pages, components, modals, visual controls |
| **JavaScript (`.js`)** | 4,295 | **8.6%** | Bundled Cookie Editor extension scripts, background scripts |
| **CSS (`.css`)** | 1,959 | **3.9%** | Tailwind CSS root styles, custom glassmorphism styling |
| **HTML (`.html`)** | 1,915 | **3.8%** | `index.html`, admin portals, splash screen, extension popups |
| **CommonJS (`.cjs`)** | 506 | **1.0%** | Preload fix scripts, import migrators, packaging hooks |
| **Total Codebase** | **49,920** | **100%** | Full repository code volume |

### Frameworks & Exact Versions
From [`package.json`](file:///C:/Users/munaf/Desktop/mahai%20brouser/package.json):

| Framework / Tool | Exact Version | Purpose |
| :--- | :--- | :--- |
| **Electron** | `33.2.1` | Desktop application shell and native OS lifecycle manager |
| **React** | `18.3.1` | Renderer UI component library |
| **React DOM** | `18.3.1` | DOM renderer for React |
| **Vite** | `6.0.3` | Bundler & dev server for frontend and Electron main process |
| **TypeScript** | `5.7.2` | Static type system across Main and Renderer |
| **Tailwind CSS** | `3.4.16` | Utility-first CSS styling framework |
| **PostCSS** | `8.4.49` | CSS transformation pipeline |
| **Autoprefixer** | `10.4.20` | Vendor prefixing for CSS |
| **Vitest** | `2.1.8` | Automated test runner (unit, integration, e2e, stress) |
| **Electron Builder** | `26.15.3` | Native desktop packaging, NSIS installer generator |
| **Vite Plugin Electron** | `0.29.0` | Vite integration for Electron Main and Preload scripts |
| **Vite Plugin Electron Renderer**| `0.14.6` | Context-bridge renderer integration |

### Significant Libraries & Packages
| Package | Exact Version | Usage in Project |
| :--- | :--- | :--- |
| **`sql.js`** | `1.14.2` | SQLite engine compiled to WebAssembly (WASM) for in-memory database management |
| **`playwright-core`** | `1.49.1` | Headless/headed browser automation execution for visual RPA workflows and warmer |
| **`zustand`** | `5.0.2` | Client-side reactive state management stores (profiles, proxies, licenses, logs) |
| **`zod`** | `3.24.1` | Runtime schema validation for all IPC channels, DTOs, and REST API payloads |
| **`lucide-react`** | `0.468.0` | SVG UI icons throughout the entire user interface |
| **`electron-updater`** | `6.8.9` | Auto-update client integration configured in backend service |
| **`tailwind-merge`** | `2.5.5` | Utility to safely merge Tailwind CSS classes |
| **`clsx`** | `2.1.1` | Conditional className construction utility |

### Runtime Requirements
- **Node.js:** `>= 20.0.0` (Verified on Node `22.x` and `24.19.0`).
- **Python:** None required for runtime. (One scratch script `patch-script.py` was used during past migrations, but is not part of the runtime).
- **OS Platform:** Windows 10/11 x64 (current primary target). Architecture supports macOS/Linux if Electron builder targets are configured.
- **External Dependencies:** Google Chrome, Microsoft Edge, or Chromium must be installed on the host OS.

---

## 3. ARCHITECTURE & FILE STRUCTURE

### Folder-by-Folder Breakdown

```text
C:\Users\munaf\Desktop\mahai brouser\
├── 01_UI/                    # React 18 Frontend
│   ├── components/           # 25+ UI components & modals (AccountDropdown, AdminFleet, Sync, Proxy, Fingerprints)
│   ├── pages/                # 17 view pages (Dashboard, ProfilesList, Wizard, Proxies, Workspaces, WorkflowBuilder)
│   ├── stores/               # Zustand stores (useProfileStore, useProxyStore, useLicenseStore, useLogStore)
│   ├── web/                  # Web fallback renderer (WebApp.tsx)
│   ├── App.tsx               # Root application shell, navigation router, license heartbeat
│   └── api-fallback.ts       # Fallback REST API bridge when IPC preload is bypassed
│
├── 02_BROWSER/               # Browser Engine, Process Manager & Isolation
│   ├── launcher.ts           # Spawns Chrome/Edge child processes with anti-detect flags & stealth extension
│   ├── process-manager.ts    # Tracks active PIDs, CPU/memory, crash detection, graceful kill
│   ├── detector.ts           # Auto-detects Chrome, Edge, Brave, Chromium installation paths on OS
│   ├── proxy-tunnel.ts       # Local loopback HTTP server handling basic auth upstream proxies
│   ├── cdp-proxy-authenticator.ts # Intercepts Chromium Fetch.authRequired (407) over CDP WebSocket
│   └── services/             # Profile CRUD, proxy testing, cookie extraction, LevelDB, history, archives
│
├── 03_HARDWARE/              # Hardware ID & Telemetry
│   ├── device-id.ts          # Deterministic HWID hashing (CPU model + total RAM)
│   ├── mobile-rotator-service.ts # Android ADB USB tethering IP rotation via airplane mode toggle
│   ├── system-info.ts        # OS, CPU architecture, memory metrics
│   └── distribution-service.ts # Desktop shortcut refresh and installer metadata
│
├── 04_LICENSING/             # Licensing Engine Core
│   └── license-engine.ts     # CRUD for licenses, SHA-256 key hashing, expiration math, 72h offline grace period
│
├── 05_AUTH/                  # Authentication & Password Security
│   └── admin-auth.ts         # PBKDF2 salt hashing, admin PIN validation, master recovery secrets
│
├── 06_DATABASE/              # SQLite Storage Layer
│   ├── connection.ts         # sql.js WASM SQLite engine, memory-to-disk exporter (writeFileSync)
│   └── schema.ts             # 33 database tables across 7 versioned automated migration phases
│
├── 07_BACKEND/               # Electron Main Process & Native Layer
│   ├── index.ts              # Electron lifecycle entry point, crash logger, single-instance lock
│   ├── ipc/                  # register-handlers.ts (60+ typed IPC channels with Zod validation)
│   ├── api/                  # local-api-server.ts (Central REST API server on 127.0.0.1:32123)
│   ├── commercial/           # commercial-api-router.ts, auth-service, plan-service, device-service
│   └── server/               # app.ts (HTTP server), web-admin-html.ts, super-admin-html.ts
│
├── 08_SECURITY/              # Cryptography & Security Subsystems
│   ├── encryption.ts         # AES-256-GCM encryption for proxy passwords and vault backups
│   ├── license-service.ts    # RSA-2048 SHA-256 license signature verifier
│   └── sanitizer.ts          # Redacts passwords, bearer tokens, and credentials from log outputs
│
├── 09_AUTOMATION/            # RPA & Cookie Warmer
│   ├── automation-engine.ts  # Playwright Core step runner (Click, Type, Wait, Screenshot, Extract)
│   ├── captcha-service.ts    # Captcha solver framework
│   ├── cdp-synchronizer.ts   # Dual-channel SSE + extension synchronizer dispatcher
│   └── cookie-warmer-service.ts # Hands-free automated browsing sequence runner
│
├── 10_CONFIG/                # Shared Contracts & Configurations
│   ├── preload/              # preload.cjs & index.ts (isolated contextBridge: window.mahiAPI)
│   └── shared/               # TypeScript interfaces, defaults.ts, Zod validation schemas
│
├── 11_TESTS/                 # Automated Testing Suites
│   ├── unit/                 # Unit tests (crypto, licensing, cookies, profiles)
│   ├── integration/          # Integration tests (IPC, REST API, SQLite migrations)
│   ├── e2e/                  # End-to-end tests (real browser launch, CDP connection)
│   └── stress/               # 20-cycle concurrency and memory leak tests
│
├── 12_SCRIPTS/               # Build Hooks & Management Tools
│   ├── fix-preload.cjs       # Ensures CommonJS preload and bundles sql-wasm.wasm
│   ├── Start-Super-Admin.bat # Launcher for Super Admin browser portal
│   └── Build-Installers.bat  # Automated production compilation script
│
├── 13_ASSETS/                # Icons, Media & Extensions
│   ├── resources/            # icon.ico, icon.png, splash.html, numbered icons M1-M20
│   └── interface/            # Bundled unpacked Cookie Editor Chrome extension
│
├── 14_DOCS/ & docs/          # Architecture, Security, API, and Changelog documentation
│
└── _ADMIN_KEYGEN/            # Local developer tools
    ├── keygen.cjs            # RSA license key generator containing PRIVATE KEY
    └── keygen.php            # PHP license key generator containing PRIVATE KEY
```

### Application Entry Points
1. **Desktop Main Process:** [`07_BACKEND/index.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/index.ts#L1) (compiled to `dist-electron/main/index.js`). Configured in `package.json` under `"main"`.
2. **Preload Script:** [`10_CONFIG/preload/preload.cjs`](file:///C:/Users/munaf/Desktop/mahai%20brouser/10_CONFIG/preload/preload.cjs) (copied to `dist-electron/preload/index.cjs`). Exposes secure `window.mahiAPI` via Electron `contextBridge`.
3. **Renderer Process (UI):** [`index.html`](file:///C:/Users/munaf/Desktop/mahai%20brouser/index.html) -> [`01_UI/main.tsx`](file:///C:/Users/munaf/Desktop/mahai%20brouser/01_UI/main.tsx) -> [`01_UI/App.tsx`](file:///C:/Users/munaf/Desktop/mahai%20brouser/01_UI/App.tsx).
4. **Embedded Local Server:** [`07_BACKEND/api/local-api-server.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts) & [`07_BACKEND/server/app.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts), started inside `07_BACKEND/index.ts` on port `32123`.

### How Components Communicate
1. **Renderer <-> Main Process:** Typed Electron IPC (`ipcRenderer.invoke()` <-> `ipcMain.handle()`) exposed through `contextBridge` with Zod validation on 60+ channels.
2. **Main Process -> Renderer:** IPC Events via `webContents.send()` for real-time events (`profile:statusChanged`, `sync:action`, `activity:logAdded`).
3. **External / Headless Control:** HTTP REST API on `http://127.0.0.1:32123` authenticated via `Authorization: Bearer mahi_browser_local_api_2024` or `X-API-Key`.
4. **Main Process <-> Launched Browsers:**
   - **CDP (WebSocket):** Connects to Chromium's remote debugging port (`ws://127.0.0.1:<port>/devtools/browser/...`) for proxy authentication challenges (`Fetch.authRequired`).
   - **Extension Port & SSE:** Server-Sent Events (`/sync/events`) and Chrome extension runtime ports (`mahi_sync_port`) for the Multi-Window Synchronizer.
5. **Renderer Fallback Bridge:** If Electron IPC preload is unavailable (e.g., in a browser tab), [`01_UI/api-fallback.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/01_UI/api-fallback.ts) redirects calls to the local REST API via HTTP `fetch()`.

---

## 4. CORE FEATURES INVENTORY

| Feature | Status | Details / Deficiencies |
| :--- | :---: | :--- |
| **Profile Management (CRUD)** | ✅ | **Fully implemented**. Create, list, search, duplicate, edit, soft-delete, restore, and trash profiles in SQLite. |
| **Profile Process Launch/Stop** | ✅ | **Fully implemented**. Spawns Chrome/Edge with custom args, PID tracking, lock cleanup, and graceful kill. |
| **Canvas Fingerprint Spoofing** | ✅ | **Fully implemented**. Intercepts `HTMLCanvasElement.prototype.toDataURL` and `CanvasRenderingContext2D.prototype.getImageData` with deterministic shift noise per profile. |
| **WebGL Fingerprint Spoofing** | ✅ | **Fully implemented**. Spoofs `UNMASKED_VENDOR_WEBGL` (37445) and `UNMASKED_RENDERER_WEBGL` (37446) based on OS profile settings. |
| **AudioContext Fingerprint Spoofing** | ✅ | **Fully implemented**. Adds acoustic frequency jitter to `AudioBuffer.prototype.getChannelData`. |
| **User-Agent Spoofing** | ✅ | **Fully implemented**. Passed via `--user-agent` Chromium CLI flag. |
| **Hardware Concurrency & Memory** | ✅ | **Fully implemented**. Proxies `navigator.hardwareConcurrency` and `navigator.deviceMemory`. |
| **Automation / WebDriver Masking** | ✅ | **Fully implemented**. `navigator.webdriver = undefined`, deletes `cdc_` properties, mocks `window.chrome.runtime`. |
| **WebRTC Leak Prevention** | ✅ | **Fully implemented**. Injects `--force-webrtc-ip-handling-policy --webrtc-ip-handling-policy=disable_non_proxied_udp`. |
| **Timezone Spoofing** | 🟡 | **Partially implemented**. Configured in settings schema and UI, but **NO** Chromium timezone flag or CDP `Emulation.setTimezoneOverride` call exists in `launcher.ts`. Uses host machine timezone. |
| **Geolocation Spoofing** | 🟡 | **Partially implemented**. Geolocation permission is in settings, but **NO** CDP `Emulation.setGeolocationOverride` call exists. Uses host machine or proxy exit IP location. |
| **Font Fingerprint Spoofing** | ❌ | **NOT FOUND**. No font enumeration blocking or font spoofing exists in the codebase. |
| **Proxy Support (Protocols & Auth)** | ✅ | **Fully implemented**. HTTP, HTTPS, and SOCKS5. Authenticated proxies supported via local loopback tunnel (`proxy-tunnel.ts`) and CDP auth (`cdp-proxy-authenticator.ts`). Live latency and IP resolution implemented. |
| **Cookie & Storage Isolation** | ✅ | **Fully implemented**. Separate Chromium `--user-data-dir` per profile. LevelDB and SQLite cookie import/export (Netscape and JSON formats). |
| **Encrypted Profile Archives** | ✅ | **Fully implemented**. `.mahi-profile` archive files encrypted with AES-256-GCM. |
| **Team Sharing / Workspaces** | 🟡 | **Partially implemented**. Local multi-workspace and role data model (`workspaces`, `workspace_members`), plus encrypted `.mahi-workspace` export/import bundles. **NO cloud synchronization server exists**; cannot share live across machines over the internet. |
| **Visual RPA Automation Engine** | ✅ | **Fully implemented**. Drag-and-drop workflow builder in UI; executes steps (`CLICK`, `FILL`, `WAIT`, `SCREENSHOT`, `EXTRACT_TITLE`) via Playwright Core. |
| **Multi-Window Synchronizer** | ✅ | **Fully implemented**. Captures clicks, typing, and scrolling from a master browser window and replicates to slave windows via SSE and Chrome extension runtime ports. |
| **Cookie Warmer / Profile Farmer** | ✅ | **Fully implemented**. Background queue visiting authoritative websites with simulated human scrolling and history persistence. |
| **Mobile 4G/5G Hotspot IP Rotator** | ✅ | **Fully implemented**. Android ADB USB tethering automation toggling airplane mode to rotate carrier residential IPs. |
| **REST API Automation** | ✅ | **Fully implemented**. HTTP server on port `32123` with 25+ REST endpoints. |

---

## 5. BACKEND & DATABASE (CRITICAL SECTION)

### Does ANY backend/server code exist in this repo? Where?
**YES, but it is an EMBEDDED LOCAL DESKTOP SERVER, NOT a remote cloud/VPS backend.**
- Code location:
  - [`07_BACKEND/api/local-api-server.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts)
  - [`07_BACKEND/server/app.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts)
  - [`07_BACKEND/commercial/commercial-api-router.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts)
- This server binds to `127.0.0.1:32123` on the user's local PC.
- **NO REMOTE/VPS BACKEND EXISTS**. There is no server codebase designed to be deployed to an external Linux VPS, no Docker container for cloud deployment, and no cloud database connection.

### Is there user auth (signup/login)? How is it implemented?
**YES, but it is implemented 100% LOCALLY on the user's client machine:**
1. **Frontend UI Auth:** [`01_UI/components/CommercialUserModal.tsx`](file:///C:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/CommercialUserModal.tsx#L13-L23) stores user credentials directly inside the Electron browser's `localStorage['mahi_accounts_v2']` in plaintext JSON:
   ```typescript
   // CommercialUserModal.tsx line 18-19:
   all[email.toLowerCase()] = { name, email: email.toLowerCase(), password };
   localStorage.setItem("mahi_accounts_v2", JSON.stringify(all));
   ```
2. **Local Backend Auth:** [`07_BACKEND/commercial/commercial-auth-service.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-auth-service.ts#L81) stores user credentials in the local SQLite table `commercial_users` using PBKDF2 with a hardcoded local salt and signs tokens using a hardcoded local JWT secret (`mahi_commercial_jwt_secret_2026_x893k`).
3. **Flaw:** Accounts created on one PC do not exist on any other PC. Wiping browser cache or reinstalling Windows wipes the user account.

### Is there subscription/licensing logic? Client-side or server-side?
**100% CLIENT-SIDE:**
- **License Generation:** [`04_LICENSING/license-engine.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/04_LICENSING/license-engine.ts) generates licenses locally in SQLite table `licenses`.
- **RSA Signature Verification:** [`08_SECURITY/license-service.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/license-service.ts#L4) verifies licenses locally against the machine's HWID using a hardcoded RSA-2048 public key.
- **Auto-login & Local Disk Storage:** [`07_BACKEND/ipc/register-handlers.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts#L1410-L1475) reads and writes license keys to `%APPDATA%/mahi-browser/claimed-licenses.json` and `offline-license.key`.
- **Heartbeat:** [`01_UI/App.tsx`](file:///C:/Users/munaf/Desktop/mahai%20brouser/01_UI/App.tsx#L71-L87) runs an interval every 5 seconds calling IPC handler `commercial:login` which checks the local SQLite database.
- **NO REMOTE SERVER-SIDE VALIDATION EXISTS.**

### Any database? What schema/tables?
**YES: SQLite in WebAssembly (`sql.js` 1.14.2) stored locally at `%APPDATA%/mahi-browser/mahi_browser.sqlite`.**
It operates in-memory and executes a full binary export (`rawDb.export()`) followed by a synchronous disk write (`fs.writeFileSync`) on every write operation ([`06_DATABASE/connection.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/connection.ts#L75-L81)).

**Schema contains 33 tables across 7 migrations:**
1. `schema_migrations`: Version tracking
2. `folders`: Profile organization folders
3. `tags`: Profile categorization tags
4. `proxies`: Proxy hosts, ports, protocols, AES-256 encrypted passwords, latencies
5. `profiles`: Main profile table (name, status, storage_path, deleted_at, owner_id)
6. `profile_settings`: JSON blob of all profile browser/fingerprint settings
7. `profile_tags`: Junction table mapping profiles to tags
8. `profile_proxies`: Junction table mapping profiles to proxies
9. `extensions`: Installed unpacked Chrome extensions per profile
10. `automation_workflows`: RPA workflow metadata
11. `automation_steps`: Workflow actions (click, fill, wait, screenshot, etc.)
12. `workflow_logs`: RPA execution audit logs
13. `app_settings`: Global application settings, theme, owner PIN hash
14. `audit_logs`: User activity and security event audit logs
15. `profile_statistics`: Launch counts, durations, error tracking
16. `licenses`: Commercial license records (key hash, validity, max devices, status)
17. `license_devices`: Activated devices bound to each license key
18. `local_license_cache`: Cached offline license status
19. `workspaces`: Team workspace containers
20. `workspace_members`: Team members and assigned profile IDs
21. `profile_workspaces`: Profile-to-workspace mapping
22. `profile_folders`: Nested folder tree for profiles
23. `profile_locks`: Concurrency locks preventing simultaneous profile launches
24. `profile_sync_state`: Sync tracking state
25. `feature_flags`: Dynamic feature flags (e.g. `dark_mode`, `bulk_import`)
26. `fleet_devices`: Hardware device inventory and telemetry records
27. `api_keys_v2`: Developer REST API keys and scoped permissions
28. `commercial_users`: User accounts (email, password_hash, salt, name, role)
29. `commercial_plans`: Commercial subscription plans (Free, Pro, Enterprise)
30. `commercial_subscriptions`: Subscriptions linking users to plans and license IDs
31. `commercial_devices`: Device counts linked to commercial users
32. `commercial_audit_logs`: Administrative actions log
33. `software_versions`: Version distribution and update records

### Any payment integration (Razorpay/Stripe/anything)?
**NOT FOUND (0% Implemented).**
- There is **NO Razorpay SDK, NO Stripe SDK, NO Cashfree SDK, NO payment webhooks, NO payment gateway endpoints, and NO order checkout flow** anywhere in this repository.
- The column `payment_provider` exists in table `commercial_subscriptions` ([`06_DATABASE/schema.ts:443`](file:///C:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/schema.ts#L443)), but it is populated only with hardcoded dummy strings like `'DIRECT_TRIAL'`.

### List ALL API Endpoints

#### Embedded REST API v2 & Admin Server (`http://127.0.0.1:32123`)
*From [`07_BACKEND/server/app.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts) & [`07_BACKEND/commercial/commercial-api-router.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts):*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/v2/health` | Service health status and uptime |
| `GET` | `/super-admin` | HTML Secret Super Admin Console |
| `GET` | `/admin` / `/` / `/dashboard` | HTML Web Admin Control Center |
| `GET` | `/download` / `/install` | HTML Download & setup portal |
| `GET` | `/download/setup` | Direct download of Windows Setup `.exe` |
| `GET` | `/download/portable` | Direct download of Windows Portable `.exe` |
| `GET` | `/api/v2/distribution/info` | Executable paths and installer metadata |
| `POST` | `/api/v2/system/fix-shortcuts` | Refreshes and fixes desktop shortcuts |
| `GET` | `/api/v2/feature-flags` | Returns all dynamic feature flags |
| `PUT` | `/api/v2/feature-flags/:key` | Updates a specific feature flag |
| `GET` | `/api/v2/profiles` | Lists all active profiles |
| `POST` | `/api/v2/profiles` | Creates a new profile |
| `GET` | `/api/v2/profiles/:id` | Gets single profile details |
| `PUT` | `/api/v2/profiles/:id` | Updates profile attributes |
| `DELETE` | `/api/v2/profiles/:id` | Deletes/soft-deletes profile |
| `POST` | `/api/v2/profiles/:id/start` | Spawns and launches browser process |
| `POST` | `/api/v2/profiles/:id/stop` | Terminates running browser process |
| `POST` | `/api/v2/profiles/:id/clone` | Duplicates a profile |
| `GET` | `/api/v2/folders` | Lists profile folders |
| `POST` | `/api/v2/folders` | Creates a profile folder |
| `GET` | `/api/v2/proxies` | Lists all stored proxies |
| `POST` | `/api/v2/proxies` | Creates a new proxy configuration |
| `GET` | `/api/v2/fleet/telemetry` | Live hardware CPU, RAM, and process telemetry |
| `GET` | `/api/v2/fleet/devices` | Lists registered hardware devices |
| `DELETE` | `/api/v2/fleet/devices/:id` | Revokes a device authorization |
| `GET` | `/api/v2/api-keys` | Lists developer API keys |
| `POST` | `/api/v2/api-keys` | Generates a new developer API key |
| `DELETE` | `/api/v2/api-keys/:id` | Revokes a developer API key |
| `GET` | `/api/v2/licenses` | Lists all minted commercial licenses |
| `POST` | `/api/v2/licenses/mint` | Mints a new commercial license key |
| `POST` | `/api/v2/licenses/revoke` | Revokes an existing license key |
| `POST` | `/api/v2/licenses/extend` | Extends license validity by N days |
| `GET` | `/api/v2/super-admin/db/table/:name` | Raw SQLite table browser (10 allowed tables) |
| `GET` | `/api/v2/logs` | Fetches activity audit logs |
| `GET` | `/api/v2/license/status` | Validates current local license status |
| `POST` | `/api/v1/auth/register` | User signup endpoint (local SQLite) |
| `POST` | `/api/v1/auth/login` | User login endpoint returning local JWT |
| `GET` | `/api/v1/auth/me` | Current authenticated user details |
| `GET` | `/api/v1/plans` | Lists available commercial subscription tiers |
| `GET` | `/api/v1/user/devices` | Lists devices active for logged-in user |
| `POST` | `/api/v1/user/license/activate` | Claims and activates a license key for user |
| `GET` | `/api/v1/admin/users` | Lists all registered commercial users |
| `PUT` | `/api/v1/admin/users/:id/status` | Sets user status (`ACTIVE`, `SUSPENDED`, `BANNED`) |
| `PUT` | `/api/v1/admin/users/:id/plan` | Assigns subscription plan to user |
| `POST` | `/api/v1/admin/plans` | Creates a new commercial subscription plan |
| `GET` | `/api/v1/admin/devices` | Lists fleet device records across all accounts |
| `POST` | `/api/v1/admin/licenses/mint` | Mints license from commercial API router |
| `GET` | `/api/v1/admin/audit-logs` | Fetches administrative audit records |
| `GET` | `/api/v1/versions` | Software version history |
| `GET` | `/api/v1/versions/check` | Checks client version compatibility |

---

## 6. SECURITY AUDIT

### Hardcoded Keys, Secrets, Tokens, and Passwords

| Category | File Path | Line | Masked Value | Remediation Required |
| :--- | :--- | :---: | :--- | :--- |
| **RSA Private Key** | `_ADMIN_KEYGEN/keygen.cjs` | 5 | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...[2048-bit RSA]...` | **CRITICAL LEAK**. Move completely off client repository onto a secure licensing VPS server. |
| **RSA Private Key** | `_ADMIN_KEYGEN/keygen.php` | 5 | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...[2048-bit RSA]...` | **CRITICAL LEAK**. Delete from client repository. |
| **RSA Private Key** | `keys.json` | 1 | `{"private":"-----BEGIN PRIVATE KEY-----\nMIIEvQIB...` | **CRITICAL LEAK**. Delete immediately; never commit private keys. |
| **JWT Secret** | `07_BACKEND/commercial/commercial-auth-service.ts` | 13 | `mahi_commercial_jwt_secret_****` | Replace with dynamic environment variable on VPS. |
| **Local API Bearer Token** | `01_UI/api-fallback.ts` | 10 | `mahi_browser_local_api_****` | Generate randomized per-session token upon app launch. |
| **Local API Bearer Token** | `02_BROWSER/launcher.ts` | 375, 633, 928 | `mahi_browser_local_api_****` | Pass per-session auth token via extension config. |
| **Local API Bearer Token** | `10_CONFIG/shared/constants/defaults.ts` | 182 | `mahi_browser_local_api_****` | Remove hardcoded default string. |
| **Local API Bearer Token** | `07_BACKEND/server/super-admin-html.ts` | 349 | `mahi_browser_local_api_****` | Require user session authentication. |
| **Admin Password Salt** | `05_AUTH/admin-auth.ts` | 5 | `mahi_pro_owner_rbac_****` | Generate dynamic per-user salt. |
| **Master Admin Secret** | `05_AUTH/admin-auth.ts` | 14 | `MAHI_OWNER_AUTH_****` | Remove static hardcoded backdoor key. |
| **Master Admin Hash** | `05_AUTH/admin-auth.ts` | 31 | `mahi_pro_owner_****` | Remove static fallback hash. |
| **Admin Web Secret** | `07_BACKEND/commercial/commercial-api-router.ts` | 97 | `mahi_super_admin_****` | Authenticate against cloud DB admin credentials. |
| **Admin Web Secret** | `07_BACKEND/server/super-admin-html.ts` | 85, 345, 421 | `mahi_super_admin_****` | Remove default password from HTML markup. |
| **Admin Web Secret** | `07_BACKEND/server/web-admin-html.ts` | 158, 178 | `mahi_super_admin_****` | Remove prefilled input value from HTML template. |
| **Admin Launcher PIN** | `12_SCRIPTS/Start-Super-Admin.bat` | 34 | `mahi_super_admin_****` | Remove echo of secret PIN in batch file. |

### Where Does License Validation Happen? (Is it crackable?)
- **Location:** **100% Client-Side**.
- **Crackability Assessment:** **EXTREMELY TRIVIAL TO CRACK (HIGH RISK)**.
  1. **Binary / Script Patching:** The desktop application is packaged with Electron and JavaScript. A reverse engineer or technical user can extract the ASAR archive or open `dist-electron/main/index.js` and change `verifyLicense()` to always return `{ valid: true }`. This single-line modification unlocks the full browser permanently without paying ₹599.
  2. **Offline Keygen Leakage:** Because the RSA-2048 private key was stored in the project files (`keys.json` and `_ADMIN_KEYGEN`), anyone with access to the source code can mint authentic cryptographic licenses for any machine HWID indefinitely.
  3. **No Revocation Enforcement:** Because there is no centralized remote server holding a single source of truth, an admin cannot effectively ban a client across the internet without the client voluntarily querying the admin's database.

### Git & .gitignore Audit
From [`.gitignore`](file:///C:/Users/munaf/Desktop/mahai%20brouser/.gitignore):
- `node_modules/`, `dist/`, `dist-electron/`, `release/`, `.mahi_data/`, `*.sqlite`, `*.log` are properly ignored.
- **CRITICAL DEFICIENCIES in `.gitignore`:**
  - ❌ `.env` and `.env.*` are **NOT** ignored!
  - ❌ `keys.json` is **NOT** ignored!
  - ❌ `_ADMIN_KEYGEN/` is **NOT** ignored!
  - ❌ `*.pem`, `*.key` are **NOT** ignored!
  - ❌ `crash-log.txt` is **NOT** ignored!

---

## 7. BUILD & DEPLOYMENT READINESS

### Build Scripts & Capabilities
From `package.json`:
- `npm run build`: Executes `tsc --noEmit && vite build && node 12_SCRIPTS/fix-preload.cjs`. Validates TypeScript, bundles React with Vite, bundles Electron Main with Vite, and copies the CommonJS preload script and `sql-wasm.wasm`.
- `npm run typecheck`: Validates full project types (`tsc --noEmit && tsc -p tsconfig.electron.json --noEmit`). Verified passing with 0 errors.
- `npm run pack`: Runs build and `electron-builder --dir`. Produces unpacked Windows executable directory in `release/win-unpacked/`.
- `npm run dist`: Runs build and `electron-builder`. Produces full Windows installers.

### Windows Installer Production (.exe / .msi)
- Configured in [`electron-builder.json`](file:///C:/Users/munaf/Desktop/mahai%20brouser/electron-builder.json):
  - Target 1: **NSIS Installer** (`MAHI BROWSER-1.0.0-Setup.exe`). Configured with custom install directory prompt, desktop shortcut, start menu shortcut, and uninstaller.
  - Target 2: **Portable Executable** (`MAHI BROWSER-1.0.0-Portable.exe`).
- **Code Signing Status:** **MISSING**.
  - `electron-builder.json` has **no code signing certificate** configured (`cscLink` / `cscKeyPassword` absent).
  - Without a code signing certificate, Windows SmartScreen will display an untrusted application popup ("Windows protected your PC") on every customer's machine.

### Auto-Update Mechanism
- **Client Implementation:** [`07_BACKEND/services/updater-service.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/updater-service.ts) fully implements `electron-updater` checking, downloading, progress events, and `quitAndInstall()`.
- **Server Infrastructure:** **NOT READY**.
  - The configured URL in `electron-builder.json` is `https://updates.mahibrowser.com/download/`.
  - This domain and storage bucket are currently unhosted / unconfigured. Releasing an update will result in a 404/DNS failure.

### Environment Separation (Dev / Prod)
- Development vs. production is currently handled via `app.isPackaged` and `process.env.VITE_DEV_SERVER_URL`.
- There are no separate `.env.development`, `.env.production`, or staging build flags.

---

## 8. GAPS TO LAUNCH (₹599/Year Subscription Product)

To launch this application successfully as a paid subscription product charging ₹599/year, the following items must be addressed, categorized by priority:

### 🔴 P0 — Launch Blockers (Must Be Resolved Before Taking Money)

1. **Cloud Licensing & Authentication Server (VPS Backend)**:
   - **Problem:** Currently, accounts and licenses exist only in the user's local SQLite database.
   - **Requirement:** Deploy an external Node.js/Go backend (e.g. on a ₹400-600/month Hetzner/DigitalOcean VPS) with a cloud database (PostgreSQL/Supabase).
   - The desktop app must authenticate against `https://api.yourdomain.com/v1/auth/login` and query `https://api.yourdomain.com/v1/license/validate` over HTTPS on launch.
2. **Razorpay Payment Gateway Integration**:
   - **Problem:** Zero payment code exists.
   - **Requirement:**
     - Razorpay Merchant Account setup and KYC verification.
     - VPS endpoint: `POST /api/v1/payments/create-order` generating a Razorpay Order ID for ₹599.
     - Frontend Razorpay Checkout script (or web checkout landing page) collecting payments via UPI, Cards, Netbanking.
     - Webhook endpoint: `POST /api/v1/payments/webhook` verifying `razorpay_signature`, capturing `payment.captured`, creating the user account, and issuing a 365-day subscription license in PostgreSQL.
3. **Product Landing Page & Marketing Website**:
   - **Problem:** No website exists where users can read features, view pricing (₹599/year), click "Buy Now", and download the installer.
   - **Requirement:** Landing page on custom domain (e.g., `mahibrowser.com`) with download links for `MAHI-Browser-Setup.exe` and a Razorpay Checkout button.
4. **Remove Hardcoded Private Keys & Static Backdoors**:
   - **Problem:** `keys.json` and `_ADMIN_KEYGEN/keygen.cjs` contain the private RSA key; hardcoded admin passwords exist in client code.
   - **Requirement:** Remove `keys.json` and `_ADMIN_KEYGEN/` from the client codebase. The private key must reside strictly on the private licensing server in an environment variable.
5. **Windows Code Signing Certificate**:
   - **Problem:** Unsigned executables get flagged by Windows SmartScreen and Chrome download protection as malware.
   - **Requirement:** Obtain an SSL/TLS Code Signing Certificate (Sectigo, Certum, or DigiCert) or set up Azure Trusted Signing to sign the installer during `npm run dist`.

### 🟡 P1 — Scale & Usability Requirements (Resolve Shortly After Launch)

1. **Cloud Profile Synchronization**:
   - In GoLogin/AdsPower, users expect their browser profiles to sync across devices or backup to the cloud. Currently, profiles are strictly local to `%APPDATA%`.
   - Implement encrypted cloud backup of profile cookies and settings to S3/Cloudflare R2.
2. **Enforce Timezone & Geolocation via CDP**:
   - Add CDP commands `Emulation.setTimezoneOverride` and `Emulation.setGeolocationOverride` to `02_BROWSER/launcher.ts` so proxy locations correctly match browser clocks and geolocation APIs.
3. **Font Fingerprinting Protection**:
   - Implement font enumeration protection or inject a standardized font list to prevent system font fingerprinting.
4. **Auto-Update Storage Hosting**:
   - Configure an AWS S3 bucket, Cloudflare R2 bucket, or GitHub Releases repository for `updates.mahibrowser.com` so `electron-updater` can deliver automated patches without requiring manual re-downloads.
5. **Subscription Expiry & Renewal Reminders**:
   - Automated email notifications (via Resend/SendGrid) 7 days before annual subscription renewal.

### 🟢 P2 — Enhancements & Polish (Nice-to-Have)

1. **Mac & Linux Installers**: Expand `electron-builder.json` to build DMG for macOS and AppImage/deb for Linux.
2. **Web-Based Customer Dashboard**: A portal where users can log in on the web, see their subscription status, view active devices, and download setup files.
3. **Built-in Residential Proxy Integration**: Affiliate integration with proxy providers (e.g. Bright Data, Smartproxy, IPRoyal) allowing users to purchase proxies directly inside the browser.

---

## 9. RISKS & CODE QUALITY

### Code Quality Assessment: TODO / FIXME Comments
A scan of custom project source code (`01_UI` through `12_SCRIPTS`) found **zero unresolved TODO, FIXME, or HACK comments**. The TypeScript codebase is clean, well-commented, and strictly typed.

The only TODO/HACK comments found in the repository belong to third-party open-source libraries bundled in assets:
- `13_ASSETS/cookie-editor.js:6`: `// TODO: Separate connections from CookieHandler and OptionsHandler.`
- `13_ASSETS/interface/devtools/permissionHandler.js:5`: `* TODO: Implement this in a way to only override specific functions.`
- `13_ASSETS/interface/lib/animate.js:28`: `// Hack to force firefox to resize the popup window after the animation`
- `13_ASSETS/interface/lib/genericCookieHandler.js:63`: `// Bad hack on safari because cookies needs to have the very exact same domain`
- `13_ASSETS/interface/lib/genericCookieHandler.js:146`: `// TODO: Check if this hack is needed on devtools.`
- `13_ASSETS/interface/options/options.js:208`: `// TODO: switch to clipboard API.`
- `13_ASSETS/interface/popup/cookie-list.js:1211`: `// TODO: switch to clipboard API.`

### Architecture Risk: SQLite In-Memory Buffer Serialization
In [`06_DATABASE/connection.ts`](file:///C:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/connection.ts#L75-L81):
```typescript
const data = dbInstance.export();
const buffer = Buffer.from(data);
fs.writeFileSync(dbPath, buffer);
```
- **Risk:** Because `sql.js` runs SQLite in WebAssembly, it does not write pages directly to disk like native SQLite. Every `saveDatabaseToDisk()` serializes the **entire in-memory database** into a buffer and writes the whole file to disk synchronously.
- **Scaling Limit:** When a user creates 100+ profiles with rich history and cookies, the database size can exceed 50-100 MB. Serializing and writing 100 MB synchronously on every write operation will freeze the UI thread and can cause file corruption if the user powers off the PC during a write.
- **Recommendation:** Migrate from `sql.js` (WASM) to native `better-sqlite3` for local storage, which uses standard WAL mode and native filesystem paging.

### Architecture Risk: Local Chromium Dependency
- The application requires Google Chrome or Microsoft Edge to be installed on the client machine.
- If Google updates Chrome with breaking changes to command-line flags (e.g., changes to extension loading or CDP permissions), anti-detect features may degrade until patched.
- **Long-term recommendation:** Package a specific, verified Chromium build or custom Chromium binary directly with the app.

---

## 10. EXECUTIVE SUMMARY AUDIT SCORECARD

| Dimension | Rating | Verdict |
| :--- | :---: | :--- |
| **Desktop UI / UX** | **9.5 / 10** | **Ready**. Sleek dark glassmorphism UI, intuitive profile wizard, robust controls. |
| **Browser Process Engine** | **9.0 / 10** | **Ready**. Real Chrome/Edge spawning, PID tracking, lock management, proxy tunneling. |
| **Fingerprint Spoofing** | **7.5 / 10** | **Functional for basic stealth**. Canvas, WebGL, AudioContext, User-Agent, WebRTC work. Missing Timezone CDP override, Geolocation CDP override, and Font masking. |
| **Database & Local Persistence** | **8.0 / 10** | **Functional for desktop**. Rich 33-table schema. Needs migration to native SQLite (`better-sqlite3`) at scale. |
| **Cloud Backend & Sync** | **0.0 / 10** | **NOT FOUND**. No remote server or cloud database exists. |
| **Payment & Billing Integration** | **0.0 / 10** | **NOT FOUND**. No Razorpay or payment gateway integration exists. |
| **Licensing Security** | **2.0 / 10** | **HIGH RISK**. Validation is 100% client-side and easily patched; private RSA keys are stored in the repo. |
| **Packaging & Distribution** | **7.0 / 10** | **Ready for manual distribution**. Produces NSIS `.exe`, but lacks Code Signing certificate. |
| **OVERALL LAUNCH READINESS** | **5.5 / 10** | **Desktop app is feature-rich, but requires VPS backend + Razorpay + cloud licensing before launching as a paid subscription product.** |
