# MAHI BROWSER — ADMIN PANEL & EMBEDDED API SERVER AUDIT REPORT

**Date:** October 7, 2026  
**Auditor:** Antigravity Autonomous Systems (Pair Programming Environment)  
**Target:** MAHI BROWSER Local Embedded API Server & Admin Surfaces  
**Mode:** READ-ONLY Architectural, Security & Freemium Compatibility Audit  
**Scope:** Embedded API Server (`127.0.0.1:32123`), Super Admin Web Portal, Commercial Web Admin Portal, In-App Admin Modules, Launchers & Keygen Interfaces.

---

## 1. ADMIN SURFACES INVENTORY

The MAHI BROWSER ecosystem possesses **five distinct admin interfaces** (two web browser consoles, one in-app desktop view, two orphaned React components, and two CLI minting scripts).

### 1.1 Secret Super Admin Console (Root Governance)
- **URL & Port:** [`http://127.0.0.1:32123/super-admin`](http://127.0.0.1:32123/super-admin) (Aliases: `/root-admin`, `/master-admin`) on TCP port `32123`.
- **Source File:** [07_BACKEND/server/super-admin-html.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L7-L724).
- **Launcher Scripts:**
  - [Run_MAHI_ADMIN.bat](file:///c:/Users/munaf/Desktop/mahai%20brouser/Run_MAHI_ADMIN.bat#L1-L4) (root launcher).
  - [12_SCRIPTS/Start-Super-Admin.bat](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/Start-Super-Admin.bat#L1-L39).
- **Credentials & Access Control:**
  - Client-side modal overlay unlock ([super-admin-html.ts:L454](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L454)).
  - Accepts hardcoded secrets in browser JS: `mahi_super_admin_2026`, `mahi2026`, or `admin123`.
  - **No HTTP authentication** on the backend for `/super-admin` HTML delivery or any `/api/v2/super-admin/*` sub-routes.
- **Interface Structure:**
  - **Header:** System title ("ROOT GOVERNANCE"), "Emergency Lockdown" button, "Lock Console" button.
  - **Tab 1: License Key Minting (`#tab-license-mint`):** Form inputs for Student Name, Plan Tier (Enterprise / Pro / Starter / Free), Profile quota, Device quota, Validity Days, and required **Student Hardware ID (HWID)**. "Mint Premium Offline Key" button, generated key display modal with clipboard copy, and an "Active System Licenses" table (+30D extend, Ban/Activate toggle, Delete, Copy).
  - **Tab 2: Distribution & Deploy (`#tab-distribution`):** Download links for NSIS Setup (`/download/setup`) and Portable `.exe` (`/download/portable`), direct download portal link (`/download`), and "Rebuild All Desktop Shortcuts" button.
  - **Tab 3: Global Fleet & HWID (`#tab-fleet-master`):** Master node telemetry table (Hardware ID / Device Key, Hostname/IP, OS/Node, Status) with "Force Revoke" button per device.
  - **Tab 4: SQLite Inspector (`#tab-db-inspector`):** Direct database query dropdown targeting 10 allowed tables (`profiles`, `profile_folders`, `profile_locks`, `fleet_devices`, `feature_flags`, `api_keys_v2`, `proxies`, `activity_logs`, `workspaces`, `licenses`) with a JSON record viewer.
  - **Tab 5: Core Overrides (`#tab-core-overrides`):** 4 toggle switches: "Bypass Commercial Profile Limit", "Strict Lock Collision Enforcement", "Force Canvas & WebGL Noise Injection", "Master Telemetry Streamer", and an "Apply Core Overrides" button.
  - **Tab 6: Root Authority (`#tab-root-tokens`):** Information card displaying master secrets (`mahi_super_admin_2026`, `Bearer mahi_browser_local_api_2024`, `* Full Root Authority`).

---

### 1.2 Commercial Web Admin Control Center
- **URL & Port:** [`http://127.0.0.1:32123/admin`](http://127.0.0.1:32123/admin) (Aliases: `/`, `""`, `/web`, `/dashboard`) on TCP port `32123`.
- **Source File:** [07_BACKEND/server/web-admin-html.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/web-admin-html.ts#L7-L697).
- **Launcher Script:** [12_SCRIPTS/Start-Web-Admin.bat](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/Start-Web-Admin.bat#L1-L38).
- **Credentials & Access Control:**
  - Header input `#admin-secret-input` ([web-admin-html.ts:L158](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/web-admin-html.ts#L158)), pre-filled by default with `mahi_super_admin_2026`.
  - Sent via HTTP header `X-Admin-Secret` on all fetch calls to `/api/v1/admin/*`.
  - Validated by [07_BACKEND/commercial/commercial-api-router.ts:L98](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L98) using `verifyAdminAccess()` or `isValidAdminWebSecret()`.
- **Interface Structure:**
  - **Sidebar:** Navigation links to 7 views: Dashboard, Users & Accounts, Plans & Tiers, Licenses & Minting, Device Activations, Software Versions, Audit Trail, plus an external link to `/super-admin`.
  - **Section 1: Dashboard (`dashboard`):** 4 KPI summary cards (Total Commercial Users, Active Licenses, Authorized Devices, Active Plans Configured) and recent records from `commercial_audit_logs`.
  - **Section 2: Users & Accounts (`users`):** Paginated table of registered users with role, plan, status, joined date; "Suspend", "Ban", and "Activate" action buttons.
  - **Section 3: Plans & Tiers (`plans`):** Pricing card grid showing configured tiers (Free, Pro, Business, Enterprise) with monthly pricing and quota limits.
  - **Section 4: Licenses & Minting (`licenses`):** "+ Mint License Key" action prompt modal and a table of issued DB licenses with a "Revoke" button.
  - **Section 5: Device Activations (`devices`):** List of active user hardware nodes with "Revoke Access" action.
  - **Section 6: Software Versions (`versions`):** "+ Publish Release" prompt modal and version rollout history table.
  - **Section 7: Audit Trail (`audit_logs`):** Full chronological log table of commercial actions and security events.

---

### 1.3 In-App Desktop Admin Tab (MahiProLicensePage Admin View)
- **Access:** Embedded directly inside the Electron Desktop GUI. Navigate to sidebar menu "License" (`currentPage === 'license'`), click the "Admin Management" tab.
- **Port:** N/A (invoked via Electron IPC `window.mahiAPI.admin*` through preload).
- **Source Files:**
  - UI Component: [01_UI/pages/MahiProLicensePage.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/pages/MahiProLicensePage.tsx#L38-L474).
  - Store: [01_UI/stores/useLicenseStore.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/stores/useLicenseStore.ts#L37-L162).
  - IPC Handlers: [07_BACKEND/ipc/register-handlers.ts:L1027-L1100](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts#L1027-L1100).
- **Credentials & Access Control:**
  - Unlocked by entering the Owner PIN / Admin Secret into `#adminSecretInput`.
  - Handled by `adminLogin()` in `useLicenseStore.ts`, validated against `verifyAdminAccess()` in `05_AUTH/admin-auth.ts`.
  - Accepts dynamic `masterAdminSecret` from `install-secrets.json`, dynamic SQLite `app_settings.owner_pin`, or hardcoded bypasses `MAHI_OWNER_AUTH_2026` / `mahi_pro_owner_master`.
- **Interface Structure:**
  - **Admin Login Overlay:** PIN input dialog.
  - **Management Console:** Top controls with Search input, Status dropdown filter, "+ Create License" button, "Change PIN" button, and "Refresh" button.
  - **License Table:** Displays customer name, masked key, duration, seat count (`active / max`), status badge, expiration timestamp, notes.
  - **Row Actions:** "+30 Days" extension modal, "Devices" inspector modal (displays registered device IDs, IP, status, with a "Deactivate" button), and "Revoke" button.
  - **Create License Modal:** Inputs for Customer Name, Account ID, Duration (1 Day, 7 Days, 30 Days, 90 Days, 1 Year, Lifetime, Custom), Max Devices, Notes. Displays raw unhashed key once minted.
  - **Change PIN Modal:** Updates administrative owner PIN in SQLite table `app_settings`.

---

### 1.4 Orphaned / Dead In-App Admin Components
- **Components Found:**
  - [01_UI/admin/AdminApp.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/admin/AdminApp.tsx#L27-L368): Complete standalone React admin dashboard featuring Platform Overview, Fleet Devices, Central Feature Flags & Kill Switches, and System Settings.
  - [01_UI/components/AdminFleetDashboard.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/AdminFleetDashboard.tsx#L32-L186): Fleet telemetry, resource usage meters, and hardware revocation dashboard.
- **Access Status:** **NOT FOUND in active routing.** Neither component is imported in [01_UI/App.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/App.tsx) or [01_UI/components/Sidebar.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/Sidebar.tsx). They exist as dead code remnants in the UI codebase.

---

### 1.5 CLI Admin Key Minting Tools
- **1. [12_SCRIPTS/mint-master-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-master-owner.cjs#L6-L56):**
  - Invocation: `node 12_SCRIPTS/mint-master-owner.cjs`
  - Function: Directly opens `%APPDATA%/mahi-browser/mahi_browser.sqlite` via `sql.js`, generates a random hex key formatted as `MAHI-OWNER-XXXX-XXXX-XXXX`, hashes it with SHA-256, and inserts a 100-seat `LIFETIME` record directly into the `licenses` table.
- **2. [12_SCRIPTS/mint-standard-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-standard-owner.cjs#L6-L48):**
  - Invocation: `node 12_SCRIPTS/mint-standard-owner.cjs`
  - Function: Same as above, but formats key as `MAHI-XXXX-XXXX-XXXX-XXXX`.
- **3. [12_SCRIPTS/start-server.js](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/start-server.js#L1-L30) / [start-server.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/start-server.ts#L1-L30):**
  - Invocation: `node 12_SCRIPTS/start-server.js`
  - Function: Runs standalone Central API Server instance from [07_BACKEND/server/app.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts#L81) on `http://127.0.0.1:32123`.

---

## 2. FEATURE-BY-FEATURE STATUS

Evaluation across all active admin panels:
- **Super Admin Web Portal** (`/super-admin`)
- **Commercial Web Admin Portal** (`/admin`)
- **In-App Desktop Admin Tab** (`MahiProLicensePage.tsx`)

| Feature / Button / Section | Panel | Status | Target / Connected Entity | Findings & Issues |
| :--- | :--- | :---: | :--- | :--- |
| **User List** | Web Admin | ✅ | `GET /api/v1/admin/users` &rarr; `commercial_users` table | Fully working with pagination and status filters. |
| **User Status (Suspend/Ban/Active)** | Web Admin | ✅ | `PUT /api/v1/admin/users/:id/status` &rarr; `commercial_users.status` | Fully working. Updates status and logs audit event. |
| **User Plan Change** | Web Admin | 🟡 | `PUT /api/v1/admin/users/:id/plan` &rarr; `commercial_users.plan_id` | Backend route exists ([commercial-api-router.ts:L318](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L318)), but **UI has no button or select menu** to invoke it. |
| **User Management** | Super Admin | ❌ | NOT FOUND | Super Admin has no user management tab or endpoints. |
| **License Minting (Super Admin)** | Super Admin | 🟡 | `POST /api/v2/super-admin/licenses/create` &rarr; `execSync(../mahi-keygen/keygen.cjs)` | **Working but severe security flaw**: Calls external keygen with zero auth! Quotas (profiles/tier) are ignored by `keygen.cjs`. In standalone `app.ts`, falls back to DB engine instead! |
| **License Listing (Super Admin)** | Super Admin | ✅ | `GET /api/v2/super-admin/licenses/list` &rarr; `licenses` table | Displays all SQLite licenses. |
| **License Status Toggle (Ban/Active)**| Super Admin | ✅ | `POST /api/v2/super-admin/licenses/action` &rarr; `licenses.status` | Fully working (`status = 'DISABLED' / 'ACTIVE'`). |
| **License Extension (+30D)** | Super Admin | ✅ | `POST /api/v2/super-admin/licenses/action` &rarr; `licenses.expires_at` | Fully working (`datetime(expires_at, '+30 days')`). |
| **License Deletion** | Super Admin | ✅ | `POST /api/v2/super-admin/licenses/action` &rarr; `DELETE FROM licenses` | Fully working. |
| **License Minting (Web Admin)** | Web Admin | 🟡 | `POST /api/v1/admin/licenses` &rarr; `04_LICENSING/license-engine.ts` | **Mints OLD DB-only key** (`MAHI-XXXX-XXXX...`). Does NOT generate RSA signatures from external keygen! |
| **License Listing (Web Admin)** | Web Admin | ✅ | `GET /api/v1/admin/licenses` &rarr; `licenses` table | Fully working. |
| **License Revocation (Web Admin)** | Web Admin | ✅ | `POST /api/v1/admin/licenses/revoke` &rarr; `licenses.status = 'REVOKED'` | Fully working. |
| **License Extension (Web Admin)** | Web Admin | 🟡 | `POST /api/v1/admin/licenses/extend` &rarr; `licenses.expires_at` | Backend route exists ([commercial-api-router.ts:L411](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L411)), but **Web Admin UI has no extend button**. |
| **In-App License Minting** | In-App | 🟡 | IPC `admin:createLicense` &rarr; `license-engine.ts` | Mints DB-only key, not RSA keygen signature. |
| **In-App License Extension** | In-App | ✅ | IPC `admin:extendLicense` &rarr; `license-engine.ts:extendLicense` | Fully working with custom additional days. |
| **In-App License Devices View** | In-App | ✅ | IPC `admin:getDevices` &rarr; `license_devices` table | Fully working. Displays activated seats and IP addresses. |
| **In-App Device Deactivation** | In-App | ✅ | IPC `admin:deactivateDevice` &rarr; `license_devices` | Fully working. Deactivates device seat from license. |
| **In-App Change Admin PIN** | In-App | ✅ | IPC `admin:setPin` &rarr; `app_settings:owner_pin` | Fully working. Hashes new PIN with salt. |
| **Profile Viewing / List** | Super Admin | 🟡 | `GET /api/v2/super-admin/db/table/profiles` &rarr; `profiles` table | Only viewable via raw SQLite Inspector. No dedicated profiles UI. |
| **Profile Viewing / List** | Web Admin | ❌ | NOT FOUND | Web Admin navigation has no Profiles section. |
| **Proxy Management** | Super Admin | 🟡 | `GET /api/v2/super-admin/db/table/proxies` &rarr; `proxies` table | Only viewable as raw database rows. |
| **Proxy Management** | Web Admin | ❌ | NOT FOUND | Web Admin has no proxy management screen. |
| **Telemetry / System Metrics** | Super Admin | ❌ | NOT FOUND / Dead UI | No metric graphs. "Master Telemetry Streamer" checkbox is dead UI. |
| **Telemetry / System Metrics** | Web Admin | ✅ | `GET /api/v1/admin/dashboard` &rarr; `commercial_users`, `licenses`, `commercial_devices` | Aggregates counts and statuses. |
| **Activity / Audit Logs** | Super Admin | ❌ | NOT FOUND | Endpoint `GET /api/v2/logs` exists, but no UI table in Super Admin HTML. |
| **Activity / Audit Logs** | Web Admin | ✅ | `GET /api/v1/admin/audit-logs` &rarr; `commercial_audit_logs` | Fully working with pagination and timestamps. |
| **Folder Management** | Super Admin | 🟡 | `GET /api/v2/super-admin/db/table/profile_folders` | Raw DB inspector only. |
| **Folder Management** | Web Admin | ❌ | NOT FOUND | No folder views in Web Admin. |
| **API Keys Management** | Super Admin | 🟡 | Display only in `#tab-root-tokens` | Shows static text strings. No management UI. |
| **API Keys Management** | Web Admin | ❌ | NOT FOUND | No API key views in Web Admin. |
| **Fleet / Device Governance** | Super Admin | ✅ | `GET /api/v2/fleet/devices` &rarr; `fleet_devices` table | Displays HWID, hostname, IP, OS, status. |
| **Fleet Force Revoke** | Super Admin | ✅ | `DELETE /api/v2/fleet/devices/:id` &rarr; `fleet_devices` | Fully working. Revokes device access. |
| **Commercial Device List** | Web Admin | ✅ | `GET /api/v1/admin/devices` &rarr; `commercial_devices` | Displays user hardware activations. |
| **Commercial Device Revoke** | Web Admin | ✅ | `DELETE /api/v1/admin/devices/:id` &rarr; `commercial_devices` | Fully working. Revokes activation. |
| **Payments / Subscriptions** | All Panels | ❌ | NOT FOUND / Placeholder | Plans list works, but payments are completely unintegrated (no Stripe/Razorpay). `commercial_subscriptions` has no billing webhook. |
| **Backup / Restore** | All Panels | ❌ | NOT FOUND | No database backup or restore feature exists in any admin surface. |
| **Emergency Lockdown Button** | Super Admin | ❌ | Dead UI ([super-admin-html.ts:L711](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L711)) | Only executes `confirm()` and displays toast. Makes **zero API calls**. |
| **Core Engine Overrides** | Super Admin | ❌ | Dead UI ([super-admin-html.ts:L717](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L717)) | Checkboxes have no backing API or DB bindings. |
| **Rebuild Desktop Shortcuts** | Super Admin | 🟡 | `POST /api/v2/system/fix-shortcuts` | Works ONLY when running standalone `app.ts`. **Fails with 404** on embedded `local-api-server.ts`. |
| **Installer Binaries Download** | Super Admin | 🟡 | `GET /download/setup`, `GET /download/portable` | Works only after running `npm run dist`. Otherwise returns 404. |

---

## 3. FULL REST API ENDPOINT MAP

Table of ALL endpoints hosted on `127.0.0.1:32123` across [07_BACKEND/commercial/commercial-api-router.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts), [07_BACKEND/api/local-api-server.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts), and [07_BACKEND/server/app.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts):

| Method | Path | Auth Required | What It Does | Works? |
| :--- | :--- | :--- | :--- | :---: |
| **POST** | `/api/v1/auth/register` | None (Public) | Registers new commercial user account | ✅ Yes |
| **POST** | `/api/v1/auth/login` | None (Public) | Authenticates commercial user; returns JWT & entitlements | ✅ Yes |
| **GET** | `/api/v1/auth/me` | Bearer Token (JWT) | Returns current authenticated commercial user | ✅ Yes |
| **GET** | `/api/v1/entitlements/check` | Bearer Token (JWT) | Evaluates user plan entitlements and device status | ✅ Yes |
| **POST** | `/api/v1/entitlements/activate-key` | Bearer Token (JWT) | Activates commercial license key on user account | ✅ Yes |
| **GET** | `/api/v1/devices/my-devices` | Bearer Token (JWT) | Lists devices registered to authenticated user | ✅ Yes |
| **POST** | `/api/v1/devices/revoke` | Bearer Token (JWT) | Revokes user hardware device | ✅ Yes |
| **GET** | `/api/v1/plans` | None (Public) | Returns public commercial plans and pricing tiers | ✅ Yes |
| **GET** | `/api/v1/updates/check` | None (Public) | Checks client version compatibility against DB | ✅ Yes |
| **GET** | `/api/v1/admin/dashboard` | Admin Auth (`X-Admin-Secret` / JWT) | Returns aggregated fleet/user/license telemetry & audit logs | ✅ Yes |
| **GET** | `/api/v1/admin/users` | Admin Auth | Lists registered commercial users with filters | ✅ Yes |
| **PUT** | `/api/v1/admin/users/:id/status` | Admin Auth | Updates user account status (ACTIVE, SUSPENDED, BANNED) | ✅ Yes |
| **PUT** | `/api/v1/admin/users/:id/plan` | Admin Auth | Updates user commercial plan | ✅ Yes |
| **GET** | `/api/v1/admin/plans` | Admin Auth | Lists all commercial plans (active + inactive) | ✅ Yes |
| **POST** | `/api/v1/admin/plans` | Admin Auth | Creates new commercial plan tier | ✅ Yes |
| **PUT** | `/api/v1/admin/plans/:id` | Admin Auth | Updates commercial plan limits and pricing | ✅ Yes |
| **GET** | `/api/v1/admin/licenses` | Admin Auth | Lists all licenses from SQLite database | ✅ Yes |
| **POST** | `/api/v1/admin/licenses` | Admin Auth | Mints DB-only license via `04_LICENSING/license-engine.ts` | 🟡 Yes (Old format) |
| **POST** | `/api/v1/admin/licenses/revoke` | Admin Auth | Revokes license in SQLite database | ✅ Yes |
| **POST** | `/api/v1/admin/licenses/extend` | Admin Auth | Extends license expiry date | ✅ Yes |
| **GET** | `/api/v1/admin/devices` | Admin Auth | Lists all commercial hardware devices | ✅ Yes |
| **DELETE** | `/api/v1/admin/devices/:id` | Admin Auth | Revokes commercial device | ✅ Yes |
| **GET** | `/api/v1/admin/audit-logs` | Admin Auth | Returns commercial audit trail records | ✅ Yes |
| **GET** | `/api/v1/admin/versions` | Admin Auth | Lists software releases | ✅ Yes |
| **POST** | `/api/v1/admin/versions` | Admin Auth | Publishes new software version | ✅ Yes |
| **GET** | `/super-admin` (or `/root-admin`, `/master-admin`) | None (Open) | Serves Super Admin Console HTML page | ✅ Yes |
| **GET** | `/admin` (or `/`, `""`, `/web`, `/dashboard`) | None (Open) | Serves Commercial Web Admin Portal HTML page | ✅ Yes |
| **GET** | `/download` (or `/install`, `/setup`, etc.) | None (Open) | Serves Client Download Portal HTML page | ✅ Yes |
| **GET** | `/download/setup` (or `/api/v2/download/setup`) | None (Open) | Downloads NSIS installer binary | 🟡 Yes (if built) |
| **GET** | `/download/portable` (or `/api/v2/download/portable`) | None (Open) | Downloads portable executable binary | 🟡 Yes (if built) |
| **GET** | `/api/v2/distribution/info` | None (Open) | Returns installer distribution metadata JSON | ✅ Yes |
| **POST** | `/api/v2/system/fix-shortcuts` | None in `app.ts` / Missing in `local-api-server.ts` | Reconstructs Windows desktop shortcuts | 🟡 Works only in `app.ts` |
| **GET** | `/health` (or `/api/v2/health`) | None (Open) | Health check endpoint (`status: 'HEALTHY'`) | ✅ Yes |
| **GET** | `/api/v2/feature-flags` | None (Open) | Returns list of all feature flags | ✅ Yes |
| **PUT** | `/api/v2/feature-flags/:key` | None (Open) | Updates feature flag configuration | 🟡 Unauthenticated |
| **GET** | `/api/v2/fleet/telemetry` | None (Open) | Returns live CPU/RAM/profile process telemetry | ✅ Yes |
| **GET** | `/api/v2/fleet/devices` | None (Open) | Lists enrolled fleet devices | ✅ Yes |
| **DELETE** | `/api/v2/fleet/devices/:id` | None (Open) | Revokes enrolled fleet device | 🟡 Unauthenticated |
| **GET** | `/api/v2/api-keys` | None (Open) | Lists developer API keys | ✅ Yes |
| **POST** | `/api/v2/api-keys` | None (Open) | Generates new developer API key | 🟡 Unauthenticated |
| **DELETE** | `/api/v2/api-keys/:id` | None (Open) | Revokes developer API key | 🟡 Unauthenticated |
| **POST** | `/api/v2/super-admin/licenses/create` | **None (Open!)** | Calls external keygen `../mahi-keygen/keygen.cjs` via `execSync` & saves to DB | 🟡 **CRITICAL SECURITY FLAW** |
| **GET** | `/api/v2/super-admin/licenses/list` | None (Open) | Lists all SQLite licenses | 🟡 Unauthenticated |
| **POST** | `/api/v2/super-admin/licenses/action` | None (Open) | Performs delete/disable/activate/extend on SQLite licenses | 🟡 Unauthenticated |
| **GET** | `/api/v2/super-admin/db/table/:tableName` | None (Open) | Dumps first 100 rows of allowed SQLite table | 🟡 Unauthenticated |
| **GET** | `/api/v2/logs` | None (Open) | Returns activity log entries | ✅ Yes |
| **GET** | `/api/v2/license/status` | None (Open) | Evaluates RSA `offline-license.key` or DB cache | ✅ Yes |
| **GET** | `/api/v2/profiles` | None (Open) | Lists browser profiles | ✅ Yes |
| **POST** | `/api/v2/profiles` | None (Open) | Creates profile (enforces `assertCanCreateProfile(1)`) | ✅ Yes |
| **POST** | `/api/v2/profiles/:id/start` | None (Open) | Launches browser profile | ✅ Yes |
| **POST** | `/api/v2/profiles/:id/stop` | None (Open) | Terminates running browser profile | ✅ Yes |
| **POST** | `/api/v2/profiles/:id/clone` | None (Open) | Clones profile (enforces `assertCanCreateProfile(1)`) | ✅ Yes |
| **POST** | `/api/v2/licenses/mint` (`app.ts` only) | None (Open) | Mints DB-only license via `createLicense()` | 🟡 Unauthenticated (`app.ts`) |
| **POST** | `/api/v2/licenses/revoke` (`app.ts` only) | None (Open) | Revokes DB license | 🟡 Unauthenticated (`app.ts`) |
| **POST** | `/api/v2/licenses/extend` (`app.ts` only) | None (Open) | Extends DB license | 🟡 Unauthenticated (`app.ts`) |
| **GET** | `/api/v2/folders` (`app.ts` only) | None (Open) | Lists folders | 🟡 Missing in `local-api-server` |
| **POST** | `/api/v2/folders` (`app.ts` only) | None (Open) | Creates folder | 🟡 Missing in `local-api-server` |
| **GET** | `/api/v2/proxies` (`app.ts` only) | None (Open) | Lists proxies | 🟡 Missing in `local-api-server` |
| **POST** | `/api/v2/proxies` (`app.ts` only) | None (Open) | Creates proxy | 🟡 Missing in `local-api-server` |
| **GET** | `/profiles` | Bearer Token (`isValidApiToken`) | Lists profiles with search and status filters | ✅ Yes |
| **POST** | `/profiles/bulk` | Bearer Token | Bulk creates profiles (enforces `assertCanCreateProfile`) | ✅ Yes |
| **POST** | `/profiles/bulk-update` | Bearer Token | Bulk updates profile attributes | ✅ Yes |
| **POST** | `/profiles/bulk-delete` | Bearer Token | Bulk deletes profile IDs | ✅ Yes |
| **POST** | `/profiles/bulk-assign-proxies` | Bearer Token | Bulk assigns proxy to profiles | ✅ Yes |
| **POST** | `/profiles/quick-switch` | Bearer Token | Quick switch / launch profile by index | ✅ Yes |
| **GET** | `/profiles/trash` | Bearer Token | Lists soft-deleted profiles in trash bin | ✅ Yes |
| **POST** | `/profiles/trash/empty` | Bearer Token | Permanently empties trash bin | ✅ Yes |
| **POST** | `/profiles/:id/restore` | Bearer Token | Restores profile from trash | ✅ Yes |
| **DELETE** | `/profiles/:id/permanent` | Bearer Token | Permanently deletes profile directory and DB row | ✅ Yes |
| **GET** | `/profiles/:id` | Bearer Token | Returns single profile | ✅ Yes |
| **PUT** | `/profiles/:id` | Bearer Token | Updates profile attributes | ✅ Yes |
| **DELETE** | `/profiles/:id` | Bearer Token | Soft-deletes profile to trash bin | ✅ Yes |
| **POST** | `/profiles/:id/start` | Bearer Token | Launches browser profile | ✅ Yes |
| **POST** | `/profiles/:id/stop` | Bearer Token | Stops browser profile process | ✅ Yes |
| **POST** | `/profiles/:id/clone` | Bearer Token | Clones profile (enforces `assertCanCreateProfile`) | ✅ Yes |
| **GET** | `/profiles/:id/warmer-queue` | Bearer Token | Consumes queued URLs for profile cookie warming | ✅ Yes |
| **GET** | `/proxies` | Bearer Token | Lists all proxies | ✅ Yes |
| **POST** | `/proxies` | Bearer Token | Creates proxy | ✅ Yes |
| **GET** | `/proxies/:id` | Bearer Token | Gets proxy details | ✅ Yes |
| **PUT** | `/proxies/:id` | Bearer Token | Updates proxy | ✅ Yes |
| **DELETE** | `/proxies/:id` | Bearer Token | Deletes proxy | ✅ Yes |
| **POST** | `/automation/run` | Bearer Token | Executes automation workflow | ✅ Yes |
| **GET** | `/license/status` | Bearer Token | Returns DB license validation status | ✅ Yes |
| **POST** | `/license/activate` | Bearer Token | Activates DB license key on device | ✅ Yes |
| **POST** | `/admin/license/create` | Bearer Token + Admin Secret | Mints DB license via `createLicense()` | ✅ Yes |
| **GET** | `/admin/licenses` | Bearer Token + Admin Secret | Lists DB licenses | ✅ Yes |
| **POST** | `/admin/license/revoke` | Bearer Token + Admin Secret | Revokes DB license | ✅ Yes |
| **POST** | `/admin/license/extend` | Bearer Token + Admin Secret | Extends DB license expiry | ✅ Yes |
| **GET** | `/admin/license/:id/devices` | Bearer Token + Admin Secret | Lists devices registered to license | ✅ Yes |
| **POST** | `/admin/license/deactivate-device` | Bearer Token + Admin Secret | Deactivates device from license | ✅ Yes |
| **GET** | `/sync/status` (or `/synchronizer/status`) | Bearer Token | Gets mouse/keyboard synchronizer state | ✅ Yes |
| **POST** | `/sync/start` (or `/synchronizer/start`) | Bearer Token | Starts synchronizer across profiles | ✅ Yes |
| **POST** | `/sync/stop` (or `/synchronizer/stop`) | Bearer Token | Stops synchronizer | ✅ Yes |
| **PUT** | `/sync/config` (or `/synchronizer/config`) | Bearer Token | Updates synchronizer configuration | ✅ Yes |
| **POST** | `/sync/broadcast` (or `/synchronizer/broadcast`) | Bearer Token | Broadcasts input events to slave profiles | ✅ Yes |
| **GET** | `/sync/events` (or `/synchronizer/events`) | Bearer Token | Server-Sent Events stream for sync events | ✅ Yes |
| **GET** | `/sync/running-profiles` | Bearer Token | Returns running profile IDs | ✅ Yes |

---

## 4. SECURITY CHECK OF ADMIN PANEL

### 4.1 CRITICAL: Can ANY local endpoint allow license minting/activation that BYPASSES the external keygen?
**YES. This is the #1 finding of this audit. There are TWO distinct bypass vectors:**

#### Vector A: Direct Unauthenticated Invocation of External Keygen via Local API
- **Endpoint:** `POST http://127.0.0.1:32123/api/v2/super-admin/licenses/create`
- **Location:** [07_BACKEND/api/local-api-server.ts:L265-L322](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L265-L322)
- **Mechanism:**
  ```typescript
  // 07_BACKEND/api/local-api-server.ts line 281-286:
  const keygenPath = path.resolve(process.cwd(), '..', 'mahi-keygen', 'keygen.cjs');
  if (fs.existsSync(keygenPath)) {
    const result = execSync(`node "${keygenPath}" "${hwid}" ${durationMonths}`).toString();
    const lines = result.trim().split('\n');
    generatedKey = lines[lines.length - 1].trim();
  }
  ```
- **Authentication Check:** **NONE.** Line 265 sits before the Bearer token gate (line 468). There is no PIN check, no token check, and no secret check.
- **Can it produce a valid PRO license locally?** **YES, 100%.** If `../mahi-keygen/keygen.cjs` exists (which it does on any development workstation or deployment directory with keygen installed), anyone on the machine can invoke this endpoint with their HWID and receive a genuine, cryptographically valid RSA PRO license key that passes `verifyLicense()` and activates PRO tier without touching external keygen manually.

#### Vector B: SQLite Database Engine Bypasses the RSA Keygen Completely
- **Endpoints:**
  - `POST /api/v1/admin/licenses` ([commercial-api-router.ts:L387](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L387))
  - `POST /admin/license/create` ([local-api-server.ts:L686](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L686))
  - `POST /api/v2/licenses/mint` ([app.ts:L279](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts#L279))
  - IPC `admin:createLicense` ([register-handlers.ts:L1027](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts#L1027))
  - CLI `12_SCRIPTS/mint-master-owner.cjs` and `mint-standard-owner.cjs`
- **Activation Endpoints:**
  - `POST /license/activate` ([local-api-server.ts:L679](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L679))
  - IPC `license:activate` ([register-handlers.ts:L1017](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts#L1017))
  - `POST /api/v1/entitlements/activate-key` ([commercial-api-router.ts:L184](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L184))
- **Why it grants PRO:**
  - [08_SECURITY/freemium-guard.ts:L61-L67](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/freemium-guard.ts#L61-L67) defines `hasValidLicense()`:
    ```typescript
    // 3. Check 04_LICENSING SQLite engine
    try {
      const status = validateCurrentLicense();
      if (status && status.isValid && status.status === 'ACTIVE') {
        return true;
      }
    } catch {}
    ```
  - When a DB key is minted, it is inserted into the `licenses` table. Activating it sets `local_license_cache` to `ACTIVE` with HMAC `'mahi_salt'`.
  - Once active, `hasValidLicense()` returns `true`, and `assertCanCreateProfile()` immediately raises the profile limit to `PRO_PROFILE_LIMIT` (100).
  - **Verdict:** An attacker or unauthorized user does NOT need RSA keys or `../mahi-keygen/` at all. They can simply create a DB license and activate it to gain full PRO status.

---

### 4.2 Which secrets protect the panels now (dynamic per-install or still hardcoded)?
- Dynamic secrets ARE generated on first boot in `%APPDATA%/mahi-browser/install-secrets.json` via [08_SECURITY/install-secrets.ts:L64-L79](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/install-secrets.ts#L64-L79).
- **CRITICAL BACKDOORS: Every dynamic secret check retains hardcoded fallbacks in production code:**
  1. **API Bearer Token:** [08_SECURITY/install-secrets.ts:L107](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/install-secrets.ts#L107):
     ```typescript
     return token === currentToken || token === 'mahi_browser_local_api_2024';
     ```
     &rarr; `mahi_browser_local_api_2024` works on EVERY installation regardless of dynamic secrets.
  2. **Admin Web Secret:** [08_SECURITY/install-secrets.ts:L116](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/install-secrets.ts#L116):
     ```typescript
     return secret === currentSecret || secret === 'mahi_super_admin_2026';
     ```
     &rarr; `mahi_super_admin_2026` works on EVERY installation.
  3. **Master Admin PIN / Secret:** [05_AUTH/admin-auth.ts:L13 & L31](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/admin-auth.ts#L13):
     ```typescript
     if (providedSecretOrKey === masterSecret || providedSecretOrKey === 'MAHI_OWNER_AUTH_2026') return true;
     ...
     const legacyHash = crypto.createHash('sha256').update('mahi_pro_owner_master').digest('hex');
     ```
     &rarr; Both `MAHI_OWNER_AUTH_2026` and `mahi_pro_owner_master` provide 100% bypass authority.
  4. **Super Admin Front-End PIN:** [07_BACKEND/server/super-admin-html.ts:L454](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L454):
     ```javascript
     if (pin === MASTER_SECRET || pin === 'mahi2026' || pin === 'admin123')
     ```
     &rarr; Allows frontend unlock with `mahi2026` or `admin123`.

---

### 4.3 Can the local API server be reached from outside 127.0.0.1? (Binding Address & CORS)
- **Socket Binding Address:** Explicitly bound to `'127.0.0.1'` in [07_BACKEND/api/local-api-server.ts:L805](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L805) and [12_SCRIPTS/start-server.js:L16](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/start-server.js#L16).
  - External TCP connections over LAN or WAN cannot directly connect to the socket.
- **Drive-By Browser Attack Vector (Wildcard CORS `*`):**
  - [local-api-server.ts:L73 & L81](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L73) and [commercial-api-router.ts:L51](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-api-router.ts#L51) configure:
    ```typescript
    'Access-Control-Allow-Origin': '*'
    ```
  - **Impact:** Any malicious web page opened by the user in **any browser** (Chrome, Firefox, Edge) can execute JavaScript `fetch('http://127.0.0.1:32123/api/v2/super-admin/licenses/create', ...)` or query `/api/v2/super-admin/db/table/profiles`, and the browser will NOT block reading the response.

---

### 4.4 Any endpoint that changes the profile limit or plan without a valid license?
1. **Standalone API Server Bypass:**
   - In [07_BACKEND/server/app.ts:L173](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts#L173), `POST /api/v2/profiles` directly calls `createProfile(body)` without calling `assertCanCreateProfile()`. Unlimited profiles can be created without a license if `start-server.js` is running.
2. **Commercial User Plan Manipulation:**
   - `PUT /api/v1/admin/users/:id/plan` allows changing user plan in `commercial_users`, but profile limits in the desktop app are guarded by `freemium-guard.ts`, which ignores `commercial_users.plan_id`.

---

## 5. POST-FREEMIUM COMPATIBILITY

### 5.1 Does the admin panel correctly show/display the NEW limits (15 / 100)?
- **Super Admin HTML:** **NO.**
  - [super-admin-html.ts:L158-L167](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L158-L167) shows legacy plans: "Enterprise (Unlimited Everything)", "Pro Tier (100 Profiles / 5 Devices)", "Starter Tier (20 Profiles / 2 Devices)", "Free Community".
  - Profile input defaults to `value="9999"` ([super-admin-html.ts:L166](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L166)).
  - Does NOT display the free limit of 15 anywhere.
- **Web Admin HTML:** **NO.**
  - [web-admin-html.ts:L410-L440](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/web-admin-html.ts#L410-L440) reads from `commercial_plans` seeded by [commercial-plan-service.ts:L14](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-plan-service.ts#L14):
    - Displays Free Trial limit as **5 profiles** (not 15!).
    - Displays Pro as 100, Business as 500, Enterprise as 2500.

### 5.2 Does it handle the NEW `MAHI-` prefixed license format everywhere?
- **RSA Format (`MAHI-` + base64(JSON({ hwid, exp, sig }))):**
  - Generated by `../mahi-keygen/keygen.cjs`.
  - Verified by [08_SECURITY/license-service.ts:L37](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/license-service.ts#L37).
  - Super Admin displays it properly in a scrollable `break-all` container ([super-admin-html.ts:L197](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L197)).
  - **Incompatibility:** Web Admin and In-App Admin expect short 24-character keys (`keyMasked = MAHI-****-****-XXXX`). When an RSA key is stored in SQLite `licenses`, `key_masked` stores the entire 400-char string, overflowing table layouts.
- **Legacy DB Format (`MAHI-XXXX-XXXX-XXXX-XXXX`):**
  - Generated by [04_LICENSING/license-engine.ts:L30](file:///c:/Users/munaf/Desktop/mahai%20brouser/04_LICENSING/license-engine.ts#L30) and CLI scripts.
  - Handled seamlessly by Web Admin and In-App Admin, but fails RSA cryptographic verification.

### 5.3 Anything still referencing deleted files (`_ADMIN_KEYGEN`, `keys.json`)?
- `_ADMIN_KEYGEN`: **NOT FOUND on disk.** Referenced only as an exclusion in [electron-builder.json:L20](file:///c:/Users/munaf/Desktop/mahai%20brouser/electron-builder.json#L20) and in historical markdown documentation [PROJECT_AUDIT.md:L170](file:///c:/Users/munaf/Desktop/mahai%20brouser/PROJECT_AUDIT.md#L170).
- `keys.json`: **NOT FOUND on disk.** Referenced only as an exclusion in [electron-builder.json:L21](file:///c:/Users/munaf/Desktop/mahai%20brouser/electron-builder.json#L21) and in [PROJECT_AUDIT.md:L362](file:///c:/Users/munaf/Desktop/mahai%20brouser/PROJECT_AUDIT.md#L362).

### 5.4 Anything still showing the old license system / old key format?
- **YES:**
  1. [07_BACKEND/commercial/commercial-plan-service.ts:L6-L83](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-plan-service.ts#L6-L83): Seeds outdated SaaS plans (`plan_free` = 5 profiles / $0, `plan_pro` = 100 / $29, `plan_business` = 500 / $79, `plan_enterprise` = 2500 / $199).
  2. [04_LICENSING/license-engine.ts:L28-L36](file:///c:/Users/munaf/Desktop/mahai%20brouser/04_LICENSING/license-engine.ts#L28-L36): Actively generates old non-RSA random hex keys.
  3. [12_SCRIPTS/mint-master-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-master-owner.cjs#L19): Generates `MAHI-OWNER-XXXX-XXXX-XXXX` format.
  4. [12_SCRIPTS/mint-standard-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-standard-owner.cjs#L14): Generates `MAHI-XXXX-XXXX-XXXX-XXXX` format.
  5. [05_AUTH/admin-auth.ts:L31](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/admin-auth.ts#L31): Verifies legacy hash `mahi_pro_owner_master`.

---

## 6. RECOMMENDED FIXES (DO NOT IMPLEMENT)

### P0 (Critical Vulnerabilities & Bypasses)
1. In [07_BACKEND/api/local-api-server.ts:L265](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L265), remove direct `execSync` execution of `../mahi-keygen/keygen.cjs` from the client app server, or require strict authenticated owner credentials.
2. In [08_SECURITY/freemium-guard.ts:L61-L67](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/freemium-guard.ts#L61-L67), eliminate fallback 3 (`validateCurrentLicense()`), making unforgeable RSA signatures (`verifyLicense()`) the sole criterion for PRO tier.
3. In [08_SECURITY/install-secrets.ts:L107 & L116](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/install-secrets.ts#L107), remove hardcoded fallback strings `'mahi_browser_local_api_2024'` and `'mahi_super_admin_2026'`.
4. In [05_AUTH/admin-auth.ts:L13 & L31](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/admin-auth.ts#L13), remove hardcoded credentials `'MAHI_OWNER_AUTH_2026'` and `'mahi_pro_owner_master'`.
5. In [07_BACKEND/api/local-api-server.ts:L73 & L81](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L73) and [07_BACKEND/server/app.ts:L32](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts#L32), restrict CORS origin from `'*'` to `null` / local origins to prevent cross-origin drive-by attacks from arbitrary websites.
6. In [07_BACKEND/api/local-api-server.ts:L325-L375](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts#L325-L375), wrap `/api/v2/super-admin/*` routes behind `verifyAdminAccess()` to prevent unauthorized listing, deletion, and table inspection.
7. In [07_BACKEND/server/app.ts:L173](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts#L173), add `assertCanCreateProfile()` to prevent bypassing profile limits when running standalone server.

### P1 (Broken Functionality & Freemium Alignment)
8. In [07_BACKEND/commercial/commercial-plan-service.ts:L6-L83](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/commercial-plan-service.ts#L6-L83), update default plans to reflect current freemium model: Free = 15 profiles, Pro = 100 profiles (₹599/yr), removing 5/500/2500 tiers.
9. In [07_BACKEND/server/super-admin-html.ts:L158-L167](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L158-L167), replace legacy dropdown tiers with Free (15) and Pro (100), removing `value="9999"` default.
10. In [07_BACKEND/api/local-api-server.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts), add the missing `/api/v2/system/fix-shortcuts` route so that the "Rebuild Desktop Shortcuts" button functions in the embedded app server.
11. In [07_BACKEND/server/super-admin-html.ts:L711 & L717](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/super-admin-html.ts#L711), connect "Emergency Lockdown" and "Core Engine Overrides" to actual backend APIs or remove dead UI elements.
12. In [07_BACKEND/server/web-admin-html.ts:L490](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/web-admin-html.ts#L490), add an "Extend" button in the licenses table to connect with existing `/api/v1/admin/licenses/extend` route.
13. In [07_BACKEND/server/web-admin-html.ts:L380](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/web-admin-html.ts#L380), add a Plan selector in the Users table to connect with existing `/api/v1/admin/users/:id/plan` route.

### P2 (Cleanup & Codebase Hygiene)
14. In [01_UI/admin/AdminApp.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/admin/AdminApp.tsx) and [01_UI/components/AdminFleetDashboard.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/AdminFleetDashboard.tsx), remove or route orphaned React components.
15. In [12_SCRIPTS/mint-master-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-master-owner.cjs) and [12_SCRIPTS/mint-standard-owner.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/12_SCRIPTS/mint-standard-owner.cjs), deprecate or delete scripts that mint obsolete non-RSA DB licenses.
16. Unify [07_BACKEND/server/app.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/app.ts) and [07_BACKEND/api/local-api-server.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts) into a single route handler to eliminate divergent behavior between standalone and embedded servers.
