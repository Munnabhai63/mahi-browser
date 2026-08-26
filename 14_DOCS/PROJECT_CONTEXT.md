# MAHI BROWSER — PROJECT CONTEXT & MASTER MEMORY

> **Last Reconstructed & Verified:** August 2026  
> **Source of Truth:** Workspace codebase inspection, static type checking, production build, and 218/218 passing automated tests.

---

## 1. Executive Summary & Purpose

**MAHI BROWSER** is an enterprise-grade multi-profile browser management, workspace isolation, and automation platform built on **Electron 33 + React 18 + TypeScript + SQLite (sql.js)**.

The software enables users (developers, QA engineers, growth marketers, multi-account operators, and enterprises) to:
1. **Isolate Browser Environments:** Allocate 100% segregated filesystem storage directories (`cookies`, `localStorage`, `history`, `cache`, `extensions`, `session state`) per profile with zero data leakage.
2. **Launch Real Browsers:** Spawn genuine Google Chrome, Microsoft Edge, and Chromium processes using native OS executables, custom CLI flags, isolated user data directories, and deterministic CDP debugging ports.
3. **Anti-Detect & Stealth Fingerprint Spoofing:** Injects canvas dynamic hash perturbation, WebGL vendor/renderer masking, WebRTC non-proxied UDP disabling, AudioContext acoustic frequency jitter, and hardware concurrency/memory/platform spoofing with no automation traces (`navigator.webdriver = undefined`).
4. **Encrypted Proxy Routing & Latency Testing:** HTTP, HTTPS, and SOCKS5 proxy management with AES-256-GCM encrypted passwords at rest, TCP socket latency pinging, and a local authenticating proxy tunnel (`127.0.0.1:port`).
5. **Visual RPA Workflow Automation Engine:** Drag-and-drop workflow designer supporting steps (`OPEN_URL`, `CLICK`, `FILL`, `WAIT`, `SCREENSHOT`, `EXTRACT_TITLE`, `NAVIGATE`, `SOLVE_CAPTCHA`, `SCROLL`, `SLEEP`) with Playwright Core execution and step-by-step audit logging.
6. **Multi-Window Synchronizer:** Real-time action replication (clicks, typing, scrolling, keyboard navigation) from a master profile window to multiple slave browser instances via dual-channel SSE and Chrome extension runtime ports.
7. **Automated Cookie Warmer & Farmer:** Hands-free background profile warming visiting authoritative domains (Wikipedia, BBC, Amazon, GitHub, Reddit, etc.) with simulated human scrolling and history persistence.
8. **Mobile 4G/5G Hotspot IP Rotator:** Auto-detection of Android devices via ADB / USB tethering with airplane mode toggling for instant residential IP rotation.
9. **Universal Bulk Importer:** Smart parsing of CSV, TSV, JSON, Netscape formats, and single-line credentials (`email:pass:proxy`) with live preview and bulk profile creation.
10. **Team Workspaces & Role-Based Access:** Multi-tenant workspace management with member roles (`ADMIN`, `EDITOR`, `VIEWER`), profile locking, and importable/exportable workspace bundles.
11. **MAHI Pro Cryptographic Licensing:** Offline-capable 72-hour grace period licensing with PBKDF2/SHA-256 key verification, hardware device ID binding, and Super Admin direct minting console.
12. **Central REST API V2 & Embedded Admin Consoles:** Embedded HTTP server on port `32123` serving REST API endpoints, a Web Admin Control Center (`/admin`), and a Secret Super Admin Console (`/super-admin`).

---

## 2. Technical Architecture & Stack

```
+-----------------------------------------------------------------------------------------+
|                                    REACT 18 RENDERER                                    |
|   - 17 Views / Modals (Dashboard, Profiles, Wizard, Proxies, RPA, Captcha, Workspaces)  |
|   - Zustand Stores (useProfileStore, useProxyStore, useLicenseStore, useLogStore, etc.) |
|   - Tailwind CSS + Lucide Icons + Responsive Themes + Command Palette (Ctrl+K)         |
+-----------------------------------------------------------------------------------------+
                                             |
                                  Typed contextBridge API
                                     (window.mahiAPI)
                                             |
+-----------------------------------------------------------------------------------------+
|                                   ELECTRON MAIN PROCESS                                 |
|   - Strict Context Isolation (nodeIntegration: false, contextIsolation: true)           |
|   - Zod-Validated IPC Handlers (60+ channels)                                           |
|   - Local REST API V2 Server (node:http on 127.0.0.1:32123)                             |
|   - Real Browser Process Manager (PID tracking, graceful shutdown, crash recovery)      |
|   - Synchronizer Hub (SSE stream dispatcher & action broadcasting)                      |
|   - Resource Monitoring & Memory Optimization Engine                                    |
+-----------------------------------------------------------------------------------------+
                                             |
+-----------------------------------------------------------------------------------------+
|                                     STORAGE LAYER                                       |
|   - SQLite in WASM (sql.js) with disk synchronization & 7 automated migrations          |
|   - User Profile Storage: %APPDATA%/mahi-browser/profiles/<profileId>/                  |
|   - Encrypted Master Vaults & Password-Protected Archives (.mahi-profile)                |
+-----------------------------------------------------------------------------------------+
```

### Core Technologies
- **Runtime:** Node.js (v20+ / v22+), Electron 33.2.1 / 33.4.11
- **UI Framework:** React 18.3.1, TypeScript 5.7.2, Vite 6.0.3, Tailwind CSS 3.4.16, Lucide React
- **State Management:** Zustand 5.0.2
- **Database Engine:** SQLite compiled via WebAssembly (`sql.js` 1.14.2) with disk syncing to `%APPDATA%/mahi-browser/mahi_browser.sqlite`
- **Automation:** Playwright Core 1.49.1 & Chrome DevTools Protocol (CDP)
- **Validation:** Zod 3.24.1
- **Cryptography:** Node.js `node:crypto` (AES-256-GCM, PBKDF2-HMAC-SHA256, SHA-256)
- **Packaging:** Electron Builder 26.15.3, Electron Updater 6.8.9
- **Test Runner:** Vitest 2.1.8

---

## 3. Project Structure

```
mahai brouser/
├── API.md                               # REST API v1 Reference documentation
├── ARCHITECTURE.md                      # Layered architecture documentation
├── README.md                            # High-level overview & quickstart
├── SECURITY.md                          # Cryptographic threat model & policy
├── TESTING.md                           # QA test matrix report
├── Start-Super-Admin.bat                # Direct shortcut to Super Admin Console (port 32123)
├── Start-Web-Admin.bat                  # Direct shortcut to Web Admin Control Center
├── start-app.bat                        # Production launcher script
├── create-desktop-shortcut.ps1          # Windows Desktop shortcut generator
├── cookie-editor.js                     # Extension background script for Cookie Editor
├── interface/                           # Unpacked Cookie Editor extension assets
├── electron-builder.json                # Packaging configuration (NSIS, portable, win64)
├── package.json                         # Dependencies & npm scripts
├── tsconfig.json                        # Renderer TypeScript config
├── tsconfig.electron.json               # Main process TypeScript config
├── vite.config.ts                       # Vite bundler config with Electron plugins
├── vitest.config.ts                     # Vitest test configuration
├── scripts/
│   ├── fix-preload.cjs                  # Post-build script copying CJS preload to dist-electron
│   ├── start-server.js                  # Standalone API server script
│   └── start-server.ts                  # TypeScript standalone server script
├── tests/                               # 33 comprehensive test suites (218 tests)
│   ├── encryption.test.ts
│   ├── profile-service.test.ts
│   ├── proxy-service.test.ts
│   ├── cookie-history.test.ts
│   ├── archive-service.test.ts
│   ├── validation.test.ts
│   ├── phase1-bulk-proxy.test.ts to phase15-team-workspaces.test.ts
│   └── phase12-real-e2e-master.test.ts
└── src/
    ├── admin/
    │   └── AdminApp.tsx                 # React-based Admin Dashboard Component
    ├── web/
    │   └── WebApp.tsx                   # React-based Web Portal Component
    ├── server/
    │   ├── app.ts                       # REST API V2 Router & HTTP Handler
    │   ├── web-admin-html.ts            # Self-contained Web Admin SPA HTML
    │   └── super-admin-html.ts          # Self-contained Secret Super Admin SPA HTML
    ├── shared/
    │   ├── constants/                   # Default settings, RPA templates, extension store
    │   ├── types/                       # TypeScript models (Profile, Proxy, Automation, etc.)
    │   └── validation/                  # Zod validation schemas
    ├── preload/
    │   ├── index.ts                     # TypeScript Preload Bridge definition
    │   └── preload.cjs                  # Compiled CommonJS Preload script (window.mahiAPI)
    ├── main/
    │   ├── index.ts                     # Electron main entry point, checkpoints, crash logs
    │   ├── api/
    │   │   └── local-api-server.ts      # Embedded REST API server (port 32123)
    │   ├── automation/
    │   │   └── automation-engine.ts     # Playwright-powered RPA engine
    │   ├── browser/
    │   │   ├── detector.ts              # System browser detection (Chrome, Edge, Brave)
    │   │   ├── launcher.ts              # Browser spawn, anti-detect injection, persistence
    │   │   ├── process-manager.ts       # PID tracker, graceful stop, auto status broadcasts
    │   │   ├── proxy-tunnel.ts          # Authenticating HTTP/SOCKS5 proxy tunnel
    │   │   ├── proxy-auth-extension.ts  # Manifest V3 extension for proxy auth
    │   │   └── cdp-proxy-authenticator.ts # CDP network credentials injector
    │   ├── database/
    │   │   ├── connection.ts            # sql.js engine initialization and disk persistence
    │   │   └── schema.ts                # Table creation & migrations (v1 through v7)
    │   ├── ipc/
    │   │   └── register-handlers.ts     # 60+ ipcMain handlers connecting UI to services
    │   ├── licensing/
    │   │   ├── license-engine.ts        # MAHI Pro license validation & cryptographic minting
    │   │   ├── device-id.ts             # Deterministic OS & motherboard hardware fingerprint
    │   │   └── admin-auth.ts            # Admin PIN security check
    │   ├── security/
    │   │   ├── encryption.ts            # AES-256-GCM & PBKDF2 cryptographic utilities
    │   │   └── sanitizer.ts             # Password/token redaction filter for logs & IPC
    │   ├── services/                    # 24 core backend services (profiles, proxies, cookies, etc.)
    │   └── synchronizer/
    │       ├── cdp-synchronizer.ts      # Direct CDP multi-window action replicator
    │       └── sync-hub.ts              # SSE pub-sub action hub
    └── renderer/
        ├── App.tsx                      # Root React container, keyboard shortcuts, fast switch
        ├── main.tsx                     # React DOM entry
        ├── index.css                    # Tailwind CSS imports & animations
        ├── api-fallback.ts              # Browser mock fallback when running outside Electron
        ├── stores/                      # Zustand state stores
        ├── components/                  # Modals, sidebar, header, global search, synchronizer
        └── pages/                       # 17 interactive pages (ProfilesList, Proxies, RPA, etc.)
```

---

## 4. Database Schema & Migrations

The database is powered by SQLite via `sql.js` with automated migrations:

### Migration Versions & Tables
1. **Migration v1 (Core Tables):**
   - `schema_migrations`: Migration tracking (`version`, `applied_at`)
   - `folders`: Folder organization (`id`, `name`, `color`, `created_at`)
   - `tags`: Tag taxonomy (`id`, `name`, `color`, `created_at`)
   - `proxies`: Proxy endpoints (`id`, `name`, `protocol`, `host`, `port`, `username`, `password_encrypted`, `country_region`, `status`, `latency_ms`, `last_tested_at`, `created_at`, `updated_at`)
   - `profiles`: Core profile directory (`id`, `name`, `description`, `folder`, `notes`, `status`, `storage_path`, `pinned`, `last_used_at`, `last_error`, `deleted_at`, `created_at`, `updated_at`)
   - `profile_settings`: JSON-serialized profile environment settings (`profile_id`, `settings_json`)
   - `profile_tags`: Profile-to-tag mapping (`profile_id`, `tag_name`)
   - `profile_proxies`: Profile-to-proxy mapping (`profile_id`, `proxy_id`)
   - `extensions`: Per-profile unpacked extensions (`id`, `profile_id`, `extension_id`, `name`, `version`, `enabled`, `source_type`, `source_path`, `installed_at`)
   - `automation_workflows`: RPA workflow headers (`id`, `name`, `description`, `default_profile_id`, `created_at`, `updated_at`)
   - `automation_steps`: RPA step definitions (`id`, `workflow_id`, `step_order`, `type`, `label`, `target`, `value`, `timeout_ms`, `continue_on_error`)
   - `workflow_logs`: Execution audit records (`id`, `workflow_id`, `profile_id`, `status`, `logs_json`, `started_at`, `completed_at`, `duration_ms`)
   - `app_settings`: Global key-value app settings (`key`, `value_json`, `updated_at`)
   - `audit_logs`: Sanitized event ledger (`id`, `timestamp`, `category`, `severity`, `action`, `details`, `profile_id`, `profile_name`, `metadata_json`)
2. **Migration v2 (Geo & IP Columns):**
   - Added `country_name` and `public_ip` to `proxies`.
3. **Migration v3 (Profile Statistics):**
   - `profile_statistics`: Persistent uptime telemetry (`profile_id`, `total_sessions`, `total_uptime_seconds`, `last_session_started_at`, `last_session_stopped_at`, `created_at`, `updated_at`).
4. **Migration v4 (Licensing System):**
   - `licenses`: Generated licenses (`id`, `license_key_hash`, `key_masked`, `customer_name`, `account_id`, `status`, `duration_type`, `max_devices`, `starts_at`, `expires_at`, `created_at`, `created_by`, `revoked_at`, `last_validation_at`, `notes`)
   - `license_devices`: Bound hardware devices (`id`, `license_id`, `device_id`, `device_name`, `ip_address`, `activated_at`, `last_seen_at`, `status`)
   - `local_license_cache`: Cryptographic offline verification cache (`id`, `license_id`, `license_key_hash`, `device_id`, `cached_status`, `last_verified_at`, `grace_expires_at`, `signature`).
5. **Migration v5 (Soft Deletion / Trash Bin):**
   - Added `deleted_at` column to `profiles` allowing instant restore or permanent purge.
6. **Migration v6 (Team Workspaces & Roles):**
   - `workspaces`: Team workspaces (`id`, `name`, `description`, `color`, `is_default`, `created_at`, `updated_at`)
   - `workspace_members`: Workspace team members (`id`, `workspace_id`, `name`, `email`, `role`, `status`, `assigned_profiles_json`, `created_at`)
   - `profile_workspaces`: Profile-to-workspace mapping (`profile_id`, `workspace_id`, `assigned_member_id`, `is_locked_by`).
7. **Migration v7 (Enterprise V2 Platform):**
   - `profile_folders`: Nested folders (`id`, `name`, `parent_id`, `color`, `icon`, `workspace_id`, `created_at`, `updated_at`)
   - `profile_locks`: Concurrency locks (`profile_id`, `locked_by_user_id`, `locked_by_user_name`, `locked_by_device_id`, `locked_at`, `expires_at`)
   - `profile_sync_state`: Cloud sync state (`profile_id`, `status`, `last_synced_at`, `local_version`, `remote_version`, `checksum`, `error`)
   - `feature_flags`: Dynamic feature flags (`key`, `name`, `description`, `enabled_global`, `min_plan_tier`, `rollout_percentage`, `allowed_user_ids_json`, `allowed_org_ids_json`, `kill_switch_active`, `updated_at`)
   - `fleet_devices`: Managed fleet endpoints (`id`, `device_id`, `user_id`, `device_name`, `os`, `client_version`, `ip_address`, `status`, `last_seen_at`, `registered_at`)
   - `api_keys_v2`: Developer API keys (`id`, `user_id`, `name`, `key_prefix`, `key_hash`, `scopes_json`, `rate_limit_per_min`, `requests_count_month`, `last_used_at`, `expires_at`, `created_at`, `revoked_at`).

---

## 5. Major Features & Subsystems

### 1. Browser Process Management & Anti-Detect Launching
- Spawns genuine Chrome / Edge binaries with detached execution.
- Generates an on-disk Manifest V3 extension `mahi_title_extension` per profile containing:
  - Stealth Core Script (document_start in `MAIN` world): Spoofs Canvas with deterministic seeded hash shifts, WebGL vendor (`Google Inc. (NVIDIA)` / `Google Inc. (Apple)`), AudioContext acoustic jitter, hardware concurrency (16/12), device memory (16GB), and deletes `navigator.webdriver`.
  - Content Script: Injects a floating profile badge pill (`#1 Profile Name`) with color gradients and enables quick-switch shortcuts.
  - Background Service Worker: Connects to local SSE stream for live action replication and cookie warming.
- Session persistence: Configures `Preferences` (`restore_on_startup = 1`) and performs clean exit state tracking to avoid Chromium crash-recovery popups.

### 2. Encrypted Proxy Manager & Authenticating Tunnel
- AES-256-GCM encryption for stored proxy passwords.
- TCP socket latency check and live public IP / geo-location verification.
- `createProxyTunnel`: Automatically spins up a local Node.js proxy server on `127.0.0.1:auto_port` that attaches basic authentication headers upstream, enabling Chrome to authenticate proxies without native browser credential popups.

### 3. Visual RPA Automation Engine
- Step-by-step executor powered by Playwright Core.
- Supported steps:
  - `OPEN_URL`: Navigates to target URL.
  - `CLICK`: Clicks DOM element by CSS/XPath selector.
  - `FILL`: Types text value into input element.
  - `WAIT`: Pauses execution for configured milliseconds or waits for selector.
  - `SCREENSHOT`: Captures full page screenshot and saves to disk.
  - `EXTRACT_TITLE`: Reads `document.title` and stores in workflow context.
  - `NAVIGATE`: History back/forward navigation.
  - `SOLVE_CAPTCHA`: Auto-solves detected reCAPTCHA / hCaptcha / Turnstile via configured captcha API key.
- Batch execution across multiple profiles with error handling (`continueOnError`).

### 4. Multi-Window Synchronizer
- Real-time user action mirroring from master profile to slave profiles.
- Captures clicks (with normalized X/Y ratios), typing (input/change events), key presses (Enter form submissions), and scrolling.
- Replicates actions via dual-channel: SSE stream on port 32123 + Chrome Extension runtime ports.

### 5. Smart Cookie Warmer & Auto-Farmer
- Pre-populated repository of top authoritative sites (Google, Wikipedia, Amazon, BBC, GitHub, Reddit, IMDB, Apple, Microsoft).
- Automated tab progression with simulated smooth scrolling and history recording to build realistic browsing profiles.

### 6. Mobile 4G/5G Hotspot IP Rotator
- Communicates with connected Android devices over ADB (`adb shell cmd connectivity airplane-mode`).
- Queries real-time public IP before and after toggle to confirm fresh residential IP lease.

### 7. Universal Bulk Importer
- Parses arbitrary unstructured account data, Netscape cookie exports, JSON arrays, and CSV/TSV formats.
- Pre-import regex analysis detects and maps fields (`email`, `password`, `proxy`, `cookies`, `user_agent`, `2fa_secret`).

### 8. MAHI Pro Licensing Engine
- Offline-first validation with 72-hour grace period.
- Hardware device fingerprinting (`getDeviceId`) using CPU model, total RAM, network MAC, and OS machine GUID.
- Direct Super Admin minting interface for key durations (`1_DAY`, `7_DAYS`, `30_DAYS`, `90_DAYS`, `1_YEAR`, `LIFETIME`).

---

## 6. IPC Interface & API Routes

### IPC Channels Exposed via `window.mahiAPI`
- **Profiles:** `profiles:getAll`, `profiles:getById`, `profiles:create`, `profiles:bulkCreate`, `profiles:bulkStart`, `profiles:bulkStop`, `profiles:bulkUpdate`, `profiles:bulkDelete`, `profiles:bulkAssignProxies`, `profiles:update`, `profiles:delete`, `profiles:getTrash`, `profiles:restore`, `profiles:permanentDelete`, `profiles:emptyTrash`, `profiles:clone`, `profiles:start`, `profiles:stop`, `profiles:quickSwitch`, `profiles:getStatus`, `profiles:getRunningProfiles`, `profiles:getStats`, `profiles:warm`, `profiles:warmBulk`.
- **Proxies:** `proxies:getAll`, `proxies:getById`, `proxies:create`, `proxies:parseAndCreate`, `proxies:update`, `proxies:delete`, `proxies:test`.
- **Cookies & History:** `cookies:get`, `cookies:delete`, `cookies:deleteAll`, `cookies:import`, `cookies:export`, `history:get`, `history:delete`, `history:clear`.
- **Extensions:** `extensions:get`, `extensions:getStore`, `extensions:install`, `extensions:installFromStore`, `extensions:installBatch`, `extensions:installFromWebStore`, `extensions:toggle`, `extensions:remove`.
- **Automation:** `automation:getWorkflows`, `automation:getById`, `automation:saveWorkflow`, `automation:deleteWorkflow`, `automation:runWorkflow`, `automation:runWorkflowBatch`, `automation:getTemplates`, `automation:getLogs`.
- **Archives & Vault:** `archive:preview`, `archive:import`, `archive:export`, `archive:exportNetscape`, `archive:exportBulk`, `archive:importCrossPlatform`, `vault:export`, `vault:import`.
- **Licensing & Admin:** `license:getStatus`, `license:activate`, `admin:createLicense`, `admin:getLicenses`, `admin:revokeLicense`, `admin:extendLicense`, `admin:getDevices`, `admin:deactivateDevice`, `admin:setPin`.
- **Settings & Logs:** `settings:get`, `settings:update`, `settings:verifyPin`, `settings:setPin`, `logs:get`, `logs:clear`.
- **Advanced Tools:** `mobileRotator:*`, `importer:*`, `synchronizer:*`, `diagnostics:*`, `captcha:*`, `workspace:*`, `updater:*`, `resources:*`, `folders:*`, `profileLock:*`, `featureFlags:*`, `fleet:*`, `apiKeys:*`.

### REST API Endpoints (`http://127.0.0.1:32123`)
- `GET /health` / `GET /api/v2/health` — Service health check
- `GET /admin` — Web Admin Control Center SPA
- `GET /super-admin` — Secret Super Admin Console SPA (Master Key PIN: `mahi_super_admin_2026`)
- `GET /api/v2/profiles` — List profiles
- `POST /api/v2/profiles` — Create profile
- `GET /api/v2/profiles/:id` — Get profile details
- `PUT /api/v2/profiles/:id` — Update profile
- `DELETE /api/v2/profiles/:id` — Delete profile
- `POST /api/v2/profiles/:id/start` — Launch profile browser
- `POST /api/v2/profiles/:id/stop` — Stop profile browser
- `POST /api/v2/profiles/:id/clone` — Clone profile
- `GET /api/v2/proxies` & `POST /api/v2/proxies` — Proxy management
- `GET /api/v2/folders` & `POST /api/v2/folders` — Folder management
- `GET /api/v2/fleet/telemetry` & `GET /api/v2/fleet/devices` — Fleet monitoring
- `GET /api/v2/api-keys` & `POST /api/v2/api-keys` — Developer API keys
- `GET /api/v2/feature-flags` & `PUT /api/v2/feature-flags/:key` — Feature flag toggling
- `GET /sync/events` & `POST /sync/broadcast` — Synchronizer SSE event stream

---

## 7. Status Classification

### VERIFIED FROM CODE (100% Present & Tested)
- Full Profile CRUD, bulk operations, search, folder categorization, tag filtering, soft deletion / trash bin.
- Real browser launching (Chrome, Edge) with `--user-data-dir` isolation, clean exit marking, and `Preferences` session restoration.
- AES-256-GCM proxy password encryption, proxy socket latency test, authenticating local proxy tunnel.
- Anti-Detect Stealth Engine with dynamic canvas perturbation, WebGL spoofing, AudioContext jitter, and `navigator.webdriver` removal.
- Playwright-powered RPA workflow builder & execution engine with step logging.
- Multi-Window Synchronizer with SSE and Chrome extension port communication.
- Smart Cookie Warmer with authoritative site surfing and HUD progression.
- Mobile 4G/5G Hotspot IP Rotator with ADB airplane mode switching.
- Universal Bulk Importer for CSV/TSV/JSON/Netscape formats.
- MAHI Pro Cryptographic Licensing with hardware device ID binding and 72h offline grace period.
- Local REST API Server on port 32123 with Web Admin & Super Admin single-page applications.
- Global Command Palette (`Ctrl+K`), quick profile switcher (`Space + Number` / `Shift + Number`), and toast notifications.
- Typecheck (0 errors), Build (Vite + Electron main + Preload CJS), and Vitest (33/33 suites, 218/218 passing tests).

### PARTIALLY IMPLEMENTED
- **Electron Auto-Updater (`updater-service.ts`):** `autoUpdater.autoDownload = false` is configured for manual user confirmation; full production update requires an active GitHub Releases or S3 bucket URL configured in `package.json` / `electron-builder.json`.
- **Remote Cloud Sync (`profile_sync_state`):** Database tables and sync state schema exist (Migration v7), ready for cloud backend integration.

### MISSING / NOT IN SCOPE
- Native mobile client applications (Android/iOS apps) — current architecture uses Web Admin / Mobile Rotator over ADB.
- Bot detection bypass / CAPTCHA bypass without third-party solver API keys (complies with Responsible Use Policy in `README.md`).

### UNKNOWN
- Git history: The workspace directory is not initialized as a git repository (`.git` absent). All versioning context is reconstructed from codebase files and schema migrations.

---

## 8. Verification & QA Matrix

| Verification Check | Target / Command | Status | Result Summary |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | **PASSED** | 0 type errors across renderer and main configurations |
| **Production Build** | `npm run build` | **PASSED** | Vite bundle (`dist/`), Electron main (`dist-electron/main/`), Preload CJS (`dist-electron/preload/index.cjs`) |
| **Vitest Test Suite** | `npm test` | **PASSED** | **33 test files passed (33/33)**, **218 tests passed (218/218)**, 0 failed, duration: ~36s |
| **Runtime Initializer** | `src/main/index.ts` | **VERIFIED** | Single instance lock, SQLite initialization, IPC bridge registration, port 32123 REST API server startup |

---

## 9. Development & Operational Commands

- **Run in Development:**
  ```bash
  npm run dev
  ```
- **Typecheck Codebase:**
  ```bash
  npm run typecheck
  ```
- **Run Full Automated Test Suite:**
  ```bash
  npm test
  ```
- **Build Production Bundle:**
  ```bash
  npm run build
  ```
- **Pack Desktop Application:**
  ```bash
  npm run pack
  ```
- **Generate Production Distributable:**
  ```bash
  npm run dist
  ```
- **Open Super Admin Console:**
  Run `Start-Super-Admin.bat` or navigate to `http://127.0.0.1:32123/super-admin` with Master Key PIN `mahi_super_admin_2026`.
- **Open Web Admin Control Center:**
  Run `Start-Web-Admin.bat` or navigate to `http://127.0.0.1:32123/admin`.

---

## 10. Future Development Rules

1. **Do Not Rebuild from Zero:** Always inspect existing services in `src/main/services/`, components in `src/renderer/`, and types in `src/shared/types/` before adding new functionality.
2. **Preserve Isolation Model:** Never allow profile user data directories or cookie files to be shared or mixed between profiles.
3. **Strict IPC Typing & Sanitization:** All IPC handlers must validate payloads using Zod schemas in `src/shared/validation/schemas.ts` and sanitize errors using `sanitizeError`.
4. **Preload CJS Integrity:** Electron preload must always be CommonJS (`.cjs`). Ensure `scripts/fix-preload.cjs` runs after build.
5. **Real Verification Required:** Never claim a change works without executing `npm run typecheck`, `npm run build`, or `npm test` to verify real output.