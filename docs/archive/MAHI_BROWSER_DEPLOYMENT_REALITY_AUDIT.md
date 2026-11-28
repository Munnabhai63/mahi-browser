# MAHI BROWSER — FULL FORENSIC DEPLOYMENT REALITY AUDIT

**Date:** October 9, 2026  
**Mode:** FORENSIC READ-ONLY AUDIT (Zero modifications applied)  
**Authoritative Git HEAD:** `dbd927f6fe7853a1dd9f5e146e367f0754147d89`  
**Current Branch:** `feature/phase11-android-mobile`  

---

## EXECUTIVE SUMMARY & ROOT CAUSE RESOLUTION

The observed runtime symptoms reported in the user brief:
1. Account badge shows **FREE**
2. Profiles screen displays **"155 Profiles Stored"** with repeated test names (`Warmer-Test-1`, `Warmer-Test-2`, `Team Locked Profile 1`)
3. Sidebar does not show expected entitlement locks
4. New-user clean onboarding cards (6 starter profiles) are not visible

### THE 3 ROOT CAUSES DISCOVERED:

| Finding | Root Cause | Evidence |
| :--- | :--- | :--- |
| **1. Stale Installed App Running** | The running Electron app (`PID 19708`) is executing from `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI BROWSER.exe`. Its packaged bundle (`resources\app.asar`) has timestamp **October 7, 2026 (10:07:36 UTC)**. The Onboarding + Entitlements implementation was committed on **October 8/9, 2026 (`dbd927f6`)**. The installed app **predates the code by 34 hours** and was never repackaged or updated. | `app.asar` MTime: `2026-10-07T10:07:36Z`<br>Contains: `index-D4ne2LtZ.js` (Old renderer without Starter Profiles or BIZ/PRO locks). |
| **2. 155 Historical Profiles** | The 155 profiles in the user's database (`%APPDATA%\mahi-browser\mahi_browser.sqlite`) are **real SQLite database rows** created by automated integration test suites (`phase4-cookie-warmer.test.ts` and `v2-platform-enterprise.test.ts`) that did not isolate their test database path and polluted the local developer database. | Exact count: 67 `Warmer-Test-1` + 67 `Warmer-Test-2` + 21 `Team Locked Profile 1` = exactly 155 rows, all owned by `SYSTEM_OWNER`. |
| **3. Existing User Protection Gate** | Under the Phase 16 Onboarding design, starter demo profile cards are displayed **only to clean accounts with 0 profiles** (`isUserNew(ownerId) === true`). Because the local database contains 155 rows, the onboarding engine legitimately treats this account as an **EXISTING ACCOUNT** and preserves the existing profile list rather than wiping or hiding them. | Database profile count = 155 > 0, so `isUserNew` evaluates to `false` as designed. |

---

## SECTION 1 — GIT REALITY

```
Current Branch: feature/phase11-android-mobile
Current HEAD: dbd927f6fe7853a1dd9f5e146e367f0754147d89
Working Tree Status: Clean (0 tracked modifications staged or unstaged)
```

### Git Ancestry Verification
- `dbd927f6fe7853a1dd9f5e146e367f0754147d89` (Onboarding + Premium Entitlements) is **HEAD**.
- `dbff52f3e93b3fbbf4b82160b8bd07720fc72f14` (Windows Release Branding & Signing Pipeline) is **in HEAD ancestry** (`git merge-base --is-ancestor dbff52f3 HEAD` returns exit code `0`).
- No later commits exist on this branch.
- No commit reverted any onboarding or premium entitlement work.
- Uncommitted changes affect UI/runtime: **NONE** (Working tree clean).

### Latest 10 Commits Log
1. `dbd927f6` — `feat(onboarding): implement clean new-user onboarding with 6 starter profiles and multi-layer premium entitlement enforcement`
2. `dbff52f3` — `fix(release): establish professional Windows installer naming, icon binding, distribution routing, and SmartScreen diagnostic`
3. `8c3fab3a` — `docs(ga): add full commercial GA release closure report`
4. `50298840` — `test(ga): add Phase 14 full commercial GA release gate verification suite`
5. `511ce249` — `docs(ga): add final GA cutover audit and production release closure report`
6. `9a1708b5` — `test(ga): add Phase 13 GA cutover verification test suite`
7. `1d8ef1a1` — `docs(beta): complete beta launch execution and GA readiness gate report`
8. `b8e24501` — `test(beta): add Step 9, 11, 15, 17, and 18 beta launch drills and economics verification`
9. `acd6d774` — `docs(audit): update launch audit and add P0/P1 remediation report`
10. `4cfe46eb` — `feat(p1): remediate P1 blockers (macOS signing, proxy failover, edge nginx, AUP legal, and telemetry monitoring)`

---

## SECTION 2 — SOURCE IMPLEMENTATION VERIFICATION

All 18 core implementation files specified in the audit requirements were forensically verified in the current repository:

| File Path | Status | File Size | Last Modified (UTC) | Feature Verification |
| :--- | :---: | :---: | :---: | :--- |
| `02_BROWSER/services/starter-profiles-service.ts` | **PRESENT** | 10,936 B | 2026-10-08 20:24:06 | 6 starter templates, in-memory isolation, quota exclusion |
| `10_CONFIG/shared/types/commercial.ts` | **PRESENT** | 4,402 B | 2026-10-08 20:06:47 | 17 `FeatureCapability` union types |
| `07_BACKEND/commercial/commercial-entitlement-service.ts` | **PRESENT** | 17,288 B | 2026-10-08 20:21:30 | Central capability matrix, `checkCapability`, `canCreateProfile` |
| `08_SECURITY/freemium-guard.ts` | **PRESENT** | 4,649 B | 2026-10-08 20:13:22 | Desktop core capability assertion bridge |
| `07_BACKEND/commercial/commercial-auth-service.ts` | **PRESENT** | 13,627 B | 2026-10-08 20:13:09 | Bridged lookup for `commercial_users` and `auth_users` |
| `07_BACKEND/commercial/commercial-plan-service.ts` | **PRESENT** | 7,187 B | 2026-10-08 20:11:07 | Plan catalog and tier normalization |
| `07_BACKEND/commercial/remote-api-router.ts` | **PRESENT** | 59,991 B | 2026-10-08 19:52:20 | Remote API capability guards (`FEATURE_NOT_INCLUDED`) |
| `07_BACKEND/ipc/register-handlers.ts` | **PRESENT** | 67,118 B | 2026-10-08 19:56:07 | Desktop IPC guards and `starterProfiles:*` handlers |
| `10_CONFIG/preload/preload.cjs` | **PRESENT** | 19,617 B | 2026-10-08 19:57:32 | Renderer bridge for `starterProfiles` and `entitlements` |
| `10_CONFIG/preload/index.ts` | **PRESENT** | 23,672 B | 2026-10-08 19:57:18 | TypeScript definitions for preload bridge |
| `10_CONFIG/shared/types/ipc.ts` | **PRESENT** | 22,799 B | 2026-10-08 19:56:57 | Typed IPC signatures |
| `01_UI/components/UpgradeModal.tsx` | **PRESENT** | 5,212 B | 2026-10-08 19:59:12 | Premium feature upgrade lock modal |
| `01_UI/components/StarterProfilesSection.tsx` | **PRESENT** | 18,321 B | 2026-10-08 20:03:31 | 6 onboarding starter cards & cloning dialog |
| `01_UI/pages/ProfilesList.tsx` | **PRESENT** | 115,502 B | 2026-10-08 20:05:19 | Clean onboarding condition (`profiles.length === 0`) |
| `01_UI/components/Sidebar.tsx` | **PRESENT** | 10,174 B | 2026-10-08 20:02:50 | BIZ / PRO badges and modal triggers |
| `01_UI/stores/useAccountStore.ts` | **PRESENT** | 18,271 B | 2026-10-08 20:00:18 | Reactive `hasCapability()` state |
| `01_UI/stores/useProfileStore.ts` | **PRESENT** | 15,419 B | 2026-10-08 20:04:13 | Profile quota detection |
| `01_UI/api-fallback.ts` | **PRESENT** | 36,707 B | 2026-10-08 20:05:43 | Web/mock fallback bridge |

---

## SECTION 3 — SOURCE VS BUILT BUNDLE

### Workspace Build Output (`dist` & `dist-electron`)
Rebuilt at `2026-10-08T20:27:06Z` after committing `dbd927f6`:
- `dist/assets/index-D9XBIjUJ.js` (929,118 bytes) — **VERIFIED CONTAINS**:
  - `Starter Templates`
  - `Personal Browsing`
  - `E-Commerce Store Profile`
  - `Upgrade to Unlock` modal logic
  - `BIZ` and `PRO` badges
- `dist-electron/main/index.js` (1,339,791 bytes) — **VERIFIED CONTAINS**:
  - `checkCapability`
  - `starterProfiles:getTemplates` handler
  - `entitlements:checkCapability` handler
- `dist-electron/preload/index.cjs` (19,617 bytes) — **VERIFIED CONTAINS**:
  - `starterProfiles`
  - `entitlements`

### Packaged ASAR in Installed App (`resources\app.asar`)
Timestamp: `2026-10-07T10:07:36Z` (44,697,971 bytes) — **STALE BUNDLE**:
- Packaged renderer: `dist/assets/index-D4ne2LtZ.js`
- Contains `Starter Templates`: **NO (false)**
- Contains `Personal Browsing`: **NO (false)**
- Contains `starter_personal`: **NO (false)**
- Contains `BIZ` lock: **NO (false)**
- Contains `starterProfiles`: **NO (false)**

**Conclusion:** The local workspace build is fresh and complete, but the installed application is running an older packaged ASAR.

---

## SECTION 4 — PACKAGE & VERSION METADATA

- `package.json` version: **1.1.1**
- `electron-builder.json` version: **1.1.1**
- `electron-builder.json` artifact name: `MAHI-Browser-Setup-${version}.${ext}`
- Installed application version in `app.asar/package.json`: **1.1.1**
- Executable Product Name: **MAHI Browser**

---

## SECTION 5 & 6 — RUNNING PROCESS & INSTALLED APP LOCATION

### Running Process Forensic Evidence
```json
[
  {
    "ProcessId": 19708,
    "Name": "MAHI BROWSER.exe",
    "ExecutablePath": "C:\\Users\\munaf\\AppData\\Local\\Programs\\MAHI BROWSER\\MAHI BROWSER.exe",
    "CommandLine": "\"C:\\Users\\munaf\\AppData\\Local\\Programs\\MAHI BROWSER\\MAHI BROWSER.exe\" "
  },
  {
    "ProcessId": 27492,
    "Name": "MAHI BROWSER.exe",
    "ExecutablePath": "C:\\Users\\munaf\\AppData\\Local\\Programs\\MAHI BROWSER\\MAHI BROWSER.exe",
    "CommandLine": "\"C:\\Users\\munaf\\AppData\\Local\\Programs\\MAHI BROWSER\\MAHI BROWSER.exe\" --type=renderer --user-data-dir=\"C:\\Users\\munaf\\AppData\\Roaming\\mahi-browser\" --app-path=\"C:\\Users\\munaf\\AppData\\Local\\Programs\\MAHI BROWSER\\resources\\app.asar\" ..."
  }
]
```

- **Running Source:** INSTALLED NSIS APP (`C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER`)
- **Not running from:** `npm run dev`, `electron .`, or `release\win-unpacked`.
- **User Data Directory:** `C:\Users\munaf\AppData\Roaming\mahi-browser`

---

## SECTION 7 — BINARY SHA-256 COMPARISON

| Artifact | Location | Timestamp | Size | SHA-256 |
| :--- | :--- | :---: | :---: | :--- |
| **Currently Running EXE** | `AppData\Local\Programs\MAHI BROWSER\MAHI BROWSER.exe` | 2026-10-07 10:07:36 | 188,784,128 B | `1be3e9c94a75a5659aa69004ee5de07aeebcb2c166b76a7714218b73a5837881` |
| **Installed app.asar** | `AppData\Local\Programs\MAHI BROWSER\resources\app.asar` | 2026-10-07 10:07:36 | 44,697,971 B | `2e4ee8d175bff805c5af7b06e52acd42fe003dd31b2f6874cf3b8efc5ec435ab` |
| **Local Win-Unpacked EXE** | `release\win-unpacked\MAHI BROWSER.exe` | 2026-10-08 05:04:14 | 188,784,128 B | `3b69ddb07847d6ecbf81087b9ec3e9c2a91c3d5756998b00db48b8ecd25f5e68` |
| **Local Win-Unpacked asar**| `release\win-unpacked\resources\app.asar` | 2026-10-08 05:04:14 | 45,183,741 B | `f0ff8df9529877f8f5fa529bd0cde6fbdb460c389b604b66c076fc081e3add60` |
| **Public Setup Installer** | `release\MAHI-Browser-Setup-1.1.1.exe` | 2026-10-07 10:07:39 | 90,943,215 B | `53f96b859823a5329bf3107da6dadbde64cbaba47ce5e8b1b4c6fbbbbf94352e` |

**Are they the same build?** **NO.**  
The running application and the installer artifact `MAHI-Browser-Setup-1.1.1.exe` were built on **October 7, 2026**, prior to both the Windows branding updates and the Phase 16 Onboarding/Entitlements implementation.

---

## SECTION 8 — RENDERER & RUNTIME CACHE AUDIT

In `C:\Users\munaf\AppData\Roaming\mahi-browser`:
- `Cache` [DIR]
- `Code Cache` [DIR]
- `GPUCache` [DIR]
- `Local Storage` [DIR]
- `Session Storage` [DIR]

The primary issue is NOT stale Chromium HTTP/Code cache. The issue is that the packaged bundle inside `resources\app.asar` physically contains the old code.

---

## SECTION 9, 10, 11, 12 — DATABASE REALITY & THE "155 PROFILES" ROOT CAUSE

### Database Forensic Query Results
- **Target DB:** `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite`
- **File Size:** 1,753,088 bytes
- **Total Profiles in DB:** **155**
- **Active Profiles (`deleted_at IS NULL`):** **155**
- **Profiles by Owner:** `owner: "SYSTEM_OWNER": 155`
- **Breakdown by Profile Name:**
  - `Warmer-Test-1`: **67 profiles**
  - `Warmer-Test-2`: **67 profiles**
  - `Team Locked Profile 1`: **21 profiles**
  - **Sum:** 67 + 67 + 21 = **exactly 155 profiles**

### Root Cause of Test Pollution
1. `11_TESTS/integration/phase4-cookie-warmer.test.ts` connects via `initializeDatabase()` without invoking `setCustomDatabasePath(...)`.
2. `06_DATABASE/connection.ts` on Windows defaults `getDatabasePath()` to `%APPDATA%\mahi-browser\mahi_browser.sqlite`.
3. In `phase4-cookie-warmer.test.ts`, `beforeEach` created `Warmer-Test-1` and `Warmer-Test-2`. Because Chrome processes were spawned during integration tests, the profile directories were held locked on Windows, preventing cleanup on process exit.
4. In `11_TESTS/integration/v2-platform-enterprise.test.ts`, line 56 created `Team Locked Profile 1` repeatedly without database isolation.
5. Over repeated test executions, these 155 test fixtures accumulated in the developer's default local database.

---

## SECTION 13 & 14 — ACCOUNT CLASSIFICATION & ONBOARDING DETECTION

### Account State in Running App
- In `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite`, the `auth_users` table has **0 rows**.
- The app operates as an unauthenticated local user (`owner_id = 'SYSTEM_OWNER'`), which maps to the **Free Tier**.
- Because the database contains 155 profiles:
  ```typescript
  isUserNew('SYSTEM_OWNER') === false // 155 profiles exist!
  ```
- By architectural design, `isUserNew` returns `false` for accounts with existing profiles so that real user profiles are never hidden or deleted.

### Fresh Account Verification (Isolated Environment)
When executed against a clean test environment (`11_TESTS/unit/phase16-onboarding-and-premium-entitlements.test.ts`):
- `isUserNew(cleanUserId)` returns **`true`**.
- `getStarterTemplates()` returns **exactly 6 templates**:
  1. Personal Browsing (`starter_personal`, Category: `PERSONAL`, Badge: `STARTER`)
  2. Social Media Management (`starter_social`, Category: `SOCIAL`, Badge: `STARTER`)
  3. E-Commerce Store Profile (`starter_ecommerce`, Category: `E-COMMERCE`, Badge: `STARTER`)
  4. Business & Work Profile (`starter_work`, Category: `WORK`, Badge: `STARTER`)
  5. Automation & Bot Sandbox (`starter_automation`, Category: `AUTOMATION`, Badge: `STARTER`)
  6. Clean Testing Sandbox (`starter_sandbox`, Category: `SANDBOX`, Badge: `DEMO`)
- Starter templates contain zero cookies, zero passwords, and zero session files.
- Starter templates have zero database rows and do not consume plan profile quota.
- Cloning a template creates 1 user profile, transitioning `isUserNew` to `false`.

---

## SECTION 15 & 16 — PREMIUM UI & CAPABILITY ENFORCEMENT AUDIT

### Source Code Capability Matrix
Defined in `07_BACKEND/commercial/commercial-entitlement-service.ts`:

| Feature / Capability | Free Tier | Pro Tier | Business Tier | Enterprise Tier |
| :--- | :---: | :---: | :---: | :---: |
| **Basic Profiles (`profile.basic`)** | **YES** (up to 15) | **YES** (up to 100) | **YES** (up to 500) | **YES** (Custom) |
| **Multiple / Unlimited Profiles (`profile.multiple`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Cloud Profile Sync (`cloud.sync`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Cloud Browser Compute (`cloud.browser`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Built-In Commercial Proxy (`proxy.builtin`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Manual BYOP Proxy (`proxy.custom`)** | **YES** | **YES** | **YES** | **YES** |
| **RPA Automation (`automation.rpa`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Automation Scheduler (`automation.scheduler`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Cookie Warmer (`automation.cookieWarmer`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **CDP Synchronizer (`automation.synchronizer`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Team Workspaces (`workspace.team`)** | **LOCKED** | **LOCKED** | **YES** | **YES** |
| **Profile Sharing (`workspace.sharing`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Remote Cloud API (`api.remote`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Webhooks (`api.webhooks`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Mobile Cloud Controls (`mobile.cloudBrowser`)** | **LOCKED** | **YES** | **YES** | **YES** |
| **Advanced Fingerprint (`advanced.fingerprint`)** | **LOCKED** | **YES** | **YES** | **YES** |

### Sidebar Navigation Design in Source
In `01_UI/components/Sidebar.tsx`:
- `workspaces`: Displays `BIZ` badge and lock icon; clicking opens `UpgradeModal` requiring `BUSINESS`.
- `automation`: Displays `PRO` badge and lock icon; clicking opens `UpgradeModal` requiring `PRO`.
- `proxies`: Unrestricted in sidebar because manual BYOP proxies are supported on Free. Built-in commercial proxy platforms are locked within the proxy management interface.
- `mobile-rotator`, `cookies`, `history`, `trash-bin`: Intentionally accessible local utilities.
- Why no locks were visible in the user's running screenshot: **The running app is the October 7th build, which does not contain the updated `Sidebar.tsx`.**

---

## SECTION 17, 18, 19, 20 — FEATURE GUARDS & AUTO-UNLOCK

| Enforcement Layer | Implementation Location | Behavior on Unauthorized Free User |
| :--- | :--- | :--- |
| **Backend Core** | `07_BACKEND/commercial/commercial-entitlement-service.ts` | `checkCapability(userId, cap)` returns `allowed: false` |
| **Desktop IPC** | `07_BACKEND/ipc/register-handlers.ts` | Rejects `profiles:warm`, `automation:runWorkflow`, `synchronizer:start`, `sync:upload`, `teamWorkspace:create` with `FEATURE_NOT_INCLUDED` |
| **Remote API** | `07_BACKEND/commercial/remote-api-router.ts` | Returns HTTP `403` with `{ code: 'FEATURE_NOT_INCLUDED' }` or `{ code: 'PROFILE_LIMIT_REACHED' }` |
| **UI Presentation** | `01_UI/components/UpgradeModal.tsx` | Presents structured upgrade dialog; never throws raw HTTP 403 to users |
| **Auto-Unlock** | `activateCommercialLicenseForUser` | Immediately updates tier and subscription, unlocking capabilities without app reinstall |

---

## SECTION 21, 23, 24 — DEPLOYMENT PIPELINE AUDIT

```mermaid
graph TD
  A["Source Code (HEAD dbd927f6)"] -->|npm run build| B["Local Dist (dist & dist-electron)"]
  B -.->|STALLED: electron-builder not run| C["Packaged Installer (release/MAHI-Browser-Setup-1.1.1.exe)"]
  C -.->|NOT INSTALLED| D["Installed App (AppData/Local/Programs/MAHI BROWSER)"]
  D --> E["Running Process (PID 19708)"]

  style A fill:#10b981,stroke:#059669,color:#fff
  style B fill:#10b981,stroke:#059669,color:#fff
  style C fill:#ef4444,stroke:#dc2626,color:#fff
  style D fill:#ef4444,stroke:#dc2626,color:#fff
  style E fill:#ef4444,stroke:#dc2626,color:#fff
```

### Deployment Pipeline Status Table

| Pipeline Stage | Commit Hash | Timestamp (UTC) | State |
| :--- | :---: | :---: | :---: |
| **1. Source Repository** | `dbd927f6` | 2026-10-08 20:27:00 | **CURRENT & VERIFIED (678/678 PASS)** |
| **2. Workspace Build (`dist`)** | `dbd927f6` | 2026-10-08 20:27:06 | **BUILT (Fresh renderer & main bundles)** |
| **3. Packaged ASAR (`win-unpacked`)** | Pre-`dbd927f6` | 2026-10-08 05:04:14 | **STALE** |
| **4. Installer (`release/*.exe`)** | Pre-`dbd927f6` | 2026-10-07 10:07:39 | **STALE (October 7th build)** |
| **5. Installed App on Disk** | Pre-`dbd927f6` | 2026-10-07 10:07:36 | **STALE (October 7th build)** |
| **6. Running Process in Memory** | Pre-`dbd927f6` | 2026-10-07 10:07:36 | **STALE (Running PID 19708)** |

---

## SECTION 25 — FULL PHASE REALITY MATRIX

| Phase / Feature | Source Implemented? | Build Contains It? | Installed App Contains It? | Runtime Verified in App? | Deployed? | Classification |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Phase 1 Auth** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 2 Cloud Sync** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 3 Workspaces / RBAC** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 4 Updater** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 5 Proxy Platform** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 6 Remote API** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 7 Web Dashboard** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 8 Automation** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 9 Cross-Platform** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 10 Cloud Browser** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Phase 11 Android** | YES | YES | N/A (Mobile) | N/A (Mobile) | INTERNAL | CONFIGURED BUT EXTERNAL DEVICE BLOCKED |
| **Payments (Stripe/Razorpay)** | YES | YES | YES | YES | TEST MODE | CONFIGURED BUT EXTERNAL CREDENTIAL BLOCKED |
| **Production Email** | YES | YES | YES | YES | YES | IMPLEMENTED + DEPLOYED |
| **Starter Profiles (Phase 16)** | **YES** | **YES** | **NO** | **NO** | **NO** | **IMPLEMENTED BUT NOT PACKAGED / INSTALLED** |
| **Premium Locks (Phase 16)** | **YES** | **YES** | **NO** | **NO** | **NO** | **IMPLEMENTED BUT NOT PACKAGED / INSTALLED** |
| **Windows Authenticode Signing** | YES | YES | N/A | N/A | READY | CONFIGURED BUT EXTERNAL CERTIFICATE BLOCKED |

---

## SECTION 27 — GAP CLASSIFICATION SUMMARY

1. **Starter Profiles & Clean Onboarding:**
   - Classification: `IMPLEMENTED BUT NOT BUILT INTO INSTALLER / NOT INSTALLED`
2. **Premium Entitlement Sidebar Locks & Modal:**
   - Classification: `IMPLEMENTED BUT NOT BUILT INTO INSTALLER / NOT INSTALLED`
3. **Running MAHI Browser Instance:**
   - Classification: `STALE BUILD (Running October 7th binary from AppData)`
4. **Historical "155 Profiles Stored":**
   - Classification: `TEST DATA POLLUTION IN LOCAL APPDATA DATABASE`
5. **Onboarding Hidden for Current Local Account:**
   - Classification: `INTENTIONAL EXISTING-USER BEHAVIOR` (Preserves existing profile data when `count > 0`)

---

## RECOMMENDED REMEDIATION ORDER (FOR SUBSEQUENT PHASE)

*Note: Per strict instructions, zero remediation was applied during this audit.*

When authorized to remediate:

1. **Step 1 — Terminate Stale Electron Processes:**
   Gracefully close running MAHI BROWSER processes (`PID 19708`, `PID 27848`, `PID 25316`, `PID 27492`).
2. **Step 2 — Clean Polluted Test Fixtures from Local Database:**
   Remove the 155 test fixtures (`Warmer-Test-1`, `Warmer-Test-2`, `Team Locked Profile 1`) from `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite` so the database returns to a clean 0-profile state.
3. **Step 3 — Harden Test Suites Against Database Pollution:**
   Ensure `phase4-cookie-warmer.test.ts` and `v2-platform-enterprise.test.ts` use an isolated temporary database path via `setCustomDatabasePath(...)` so future test runs never pollute `%APPDATA%`.
4. **Step 4 — Package Latest Code with electron-builder:**
   Run `npm run dist:win` (or `npm run pack`) to produce updated `app.asar`, `win-unpacked`, and `MAHI-Browser-Setup-1.1.1.exe` containing commit `dbd927f6`.
5. **Step 5 — Install or Run Updated Application:**
   Launch the newly packaged application so that the updated renderer bundle (`dist/assets/index-D9XBIjUJ.js`) and preload bridge are loaded into runtime.
6. **Step 6 — Visual Verification:**
   Confirm that the 6 starter profile cards appear cleanly on first boot, and clicking "Workspaces & Team" or "Automation" prompts the `UpgradeModal`.
