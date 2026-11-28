# MAHI BROWSER — Deployment Remediation & Test Database Isolation Report

**Execution Timestamp:** 2026-10-09T03:25:00+05:30  
**Source Commit Head:** `dbd927f6fe7853a1dd9f5e146e367f0754147d89` (with isolation guard additions)  
**Package Version:** `1.1.1`  
**Target Environment:** Windows 11 Pro x64  
**Authoritative Audit Reference:** `docs/MAHI_BROWSER_DEPLOYMENT_REALITY_AUDIT.md`  

---

## Executive Summary

This remediation operation resolved the deployment desynchronization and database fixture pollution identified in the deployment reality audit:
1. **155 automated test fixture profiles** were safely, transactionally removed from `%APPDATA%\mahi-browser\mahi_browser.sqlite` with **zero ambiguous rows** and **zero user data loss**.
2. A **Global Test Database Safety Guard** was embedded in `06_DATABASE/connection.ts` to permanently prevent test runners from writing to the production database location under `%APPDATA%`.
3. The latest source code was packaged into a fresh production release (`win-unpacked`, `MAHI-Browser-Setup-1.1.1.exe`, `MAHI-Browser-Portable-1.1.1.exe`), replacing the stale October 7 build.
4. The newly packaged build was installed to `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\`, verified by binary hash and native Electron runtime execution.
5. All **683 automated tests (82 test files)** passed cleanly with 100% test isolation, leaving the real application database untouched at **0 profiles**.

---

## 1. Safety Checkpoint & Database Metrics

### 1.1 Process Termination
All running instances of MAHI Browser (`MAHI BROWSER.exe`) were terminated cleanly before any file operations:
- Prior PIDs verified killed: `19708`, `27848`, `25316`, `27492`
- Post-termination check: `0` remaining MAHI processes.

### 1.2 Timestamped Backup
- **Source Database:** `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite`
- **Backup Location:** `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite.backup_2026-10-08T21-33-54-434Z`
- **Backup Size:** `1,753,088 bytes`
- **PRAGMA integrity_check:** `ok`
- **Baseline Metrics Recorded:**
  - Profile rows: `155`
  - Workspaces: `1` (Default workspace)
  - Commercial / Auth users: `0`

---

## 2. Test Fixture Provenance & Deletion Audit

### 2.1 Provenance Verification
Before executing any mutations, all 155 profile rows were evaluated against automated test provenance markers:

| Profile Name | Count | Originating Test Suite | Owner | Category / Folder | Provenance Status |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `Warmer-Test-1` | 67 | `phase4-cookie-warmer.test.ts` | `SYSTEM_OWNER` | Farming | **VERIFIED AUTOMATED FIXTURE** |
| `Warmer-Test-2` | 67 | `phase4-cookie-warmer.test.ts` | `SYSTEM_OWNER` | Farming | **VERIFIED AUTOMATED FIXTURE** |
| `Team Locked Profile 1` | 21 | `v2-platform-enterprise.test.ts` | `SYSTEM_OWNER` | General | **VERIFIED AUTOMATED FIXTURE** |
| **Total Candidate Rows** | **155** | — | — | — | — |
| **Verified Test Rows** | **155** | — | — | — | **155 / 155 (100%)** |
| **Ambiguous / User Rows**| **0** | — | — | — | **0 (SAFE TO PROCEED)** |

### 2.2 Transactional Deletion
An atomic SQL transaction was executed against the database:
- Deleted all dependent records in `profile_settings`, `profile_tags`, `profile_proxies`, `profile_workspaces`, and `profile_locks` belonging to the 155 test profile IDs.
- Deleted the 155 profile rows from `profiles`.
- Cleaned orphaned profile locks.
- Transaction committed cleanly.

### 2.3 Post-Cleanup Verification
- **Profiles remaining:** `0`
- **Workspaces preserved:** `1`
- **Database integrity check:** `ok`
- **File size:** `1,753,088 bytes`
- **Foreign key integrity:** Preserved, zero orphans.

---

## 3. Test Database Isolation & Global Safety Guard

### 3.1 Root Cause Analysis
Integration tests `11_TESTS/integration/phase4-cookie-warmer.test.ts` and `11_TESTS/integration/v2-platform-enterprise.test.ts` invoked `getDatabase()` directly without specifying `setCustomDatabasePath(...)`. `getDatabase()` defaulted to `getProductionDatabasePath()`, resolving `%APPDATA%\mahi-browser\mahi_browser.sqlite` and appending fixture rows directly into the user's active database.

### 3.2 Global Safety Guard Implementation (`06_DATABASE/connection.ts`)
A central guard was added to prevent test environments from targeting production AppData directories:
1. **Environment Detection:**
   ```typescript
   export function isTestRunnerEnvironment(): boolean {
     return (
       process.env.NODE_ENV === 'test' ||
       Boolean(process.env.VITEST) ||
       Boolean(process.env.VITEST_WORKER_ID) ||
       Boolean(process.env.JEST_WORKER_ID)
     );
   }
   ```
2. **Hard Error Assertion:**
   ```typescript
   export function assertPathIsNotProduction(targetPath: string): void {
     const norm = targetPath.toLowerCase().replace(/\\/g, '/');
     if (
       norm.includes('/appdata/roaming/mahi-browser') ||
       norm.includes('/appdata/local/programs/mahi browser')
     ) {
       throw new Error(
         `[GLOBAL TEST SAFETY GUARD VIOLATION] Automated tests must NEVER target production user database in AppData! Attempted path: "${targetPath}".`
       );
     }
   }
   ```
3. **Automatic Redirection:**
   When running in a test runner and no path is explicitly configured, `getDatabasePath()` automatically routes to a disposable database:
   `.mahi_data/test-auto-isolated/mahi_test_worker_${workerId}.sqlite`
4. **Individual Suite Isolation:**
   - `phase4-cookie-warmer.test.ts`: Isolated in `.mahi_data/test-warmer-isolated/warmer_test.sqlite` and cleaned up in `afterAll`.
   - `v2-platform-enterprise.test.ts`: Isolated in `.mahi_data/test-v2-enterprise-isolated/v2_enterprise_test.sqlite` and cleaned up in `afterAll`.

### 3.3 Regression Suite (`11_TESTS/unit/test-database-isolation-guard.test.ts`)
Added 5 explicit regression tests proving:
- Guard throws when test process attempts to set AppData Roaming path.
- Guard throws when test process attempts to set Local Programs path.
- Unspecified test database paths automatically resolve to `.mahi_data/test-auto-isolated/`.
- Safe temporary database paths are permitted and work as intended.
- Safety check is enforced when calling `setCustomDatabasePath(...)`.
**Result:** 5 / 5 PASSING.

---

## 4. Production Packaging & Release Artifacts

### 4.1 Packaging Execution
- Command: `npm run dist:win` (`vite build`, `tsc --noEmit`, `electron-builder --win`)
- Build target: NSIS installer (`x64`) and Portable executable (`x64`)
- Output directory: `release/` and `release/win-unpacked/`

### 4.2 Artifact Hashes & Comparison

| Artifact | Location | Size | SHA-256 Hash | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Old Stale app.asar** | `AppData\Local\Programs\...` | 44,697,971 B | `2E4EE8D175BFF805C5AF7B06E52ACD42FE003DD31B2F6874CF3B8EFC5EC435AB` | **REPLACED** |
| **New app.asar** | `release\win-unpacked\resources` | 45,321,110 B | `95F6A9D12CBAD2DDE8ECD2CACD9E04D1147FFDC4ECB902BFF9130A8F9E3CCFBF` | **FRESH** |
| **New Setup Installer**| `release\MAHI-Browser-Setup-1.1.1.exe` | 91,032,352 B | `2BC31E7E045E73BE245F10DB1C998754F9DB9751ABA89D1E6AB6B6FA2738F8D9` | **FRESH** |
| **New Portable Exe** | `release\MAHI-Browser-Portable-1.1.1.exe` | 90,785,073 B | `52BFD74B7E2CDA3377D47A9899F386D201327A15D4115EB9C61097C7CA0B6D40` | **FRESH** |
| **Unpacked Exe** | `release\win-unpacked\MAHI Browser.exe` | 188,784,128 B | `546804019411EDFBBA28C4A48FC6D4A4B3EF9FAFB0C67F7A8A2297117DB94D69` | **FRESH** |

### 4.3 Public Release Manifests
`release/latest.json` and `release/latest.yml` were regenerated with exact matching SHA-256 and SHA-512 hashes and byte counts:
- `Setup sha256`: `2bc31e7e045e73be245f10db1c998754f9db9751aba89d1e6ab6b6fa2738f8d9`
- `Setup sha512`: `09359058d3f149a603148516c184eb71351bb5ac53aa4c204d21f96626b643f1a73e8216a8837b5df47e42d2ff607494fbf226cc6773218ca823a8238a083c1d`

---

## 5. Local Installation & Runtime Verification

### 5.1 Installation Upgrade
- Executed silent upgrade installation using `release\MAHI-Browser-Setup-1.1.1.exe /S`.
- Installed directory: `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\`.
- Installed `app.asar` SHA-256: `95F6A9D12CBAD2DDE8ECD2CACD9E04D1147FFDC4ECB902BFF9130A8F9E3CCFBF` (Exact match).
- Installed `MAHI Browser.exe` SHA-256: `546804019411EDFBBA28C4A48FC6D4A4B3EF9FAFB0C67F7A8A2297117DB94D69` (Exact match).

### 5.2 Native Electron Runtime Smoke Test
Executed native smoke test against installed binary:
```
[SMOKE_HARNESS] Target Binary: C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI BROWSER.exe
[CHECKPOINT] Step 3: Setting Database Path - C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite
[CHECKPOINT] Step 3: Database Initialized Successfully
[CHECKPOINT] Step 4: IPC Handlers Registered
[CHECKPOINT] Step 4: Starting Local REST API Server (Port 32123)
[CHECKPOINT] Step 4: REST API Server Running
[SMOKE_TEST_PASS] MAHI Browser initialized cleanly without error.
Installed executable exited with code: 0
```

---

## 6. Onboarding & Premium Entitlements Verification

### 6.1 Clean Onboarding UI
With all 155 test fixtures removed and real profile count at 0:
- **Profiles Page:** Renders the `StarterProfilesSection` with exactly **6 starter / demo templates**:
  1. **Personal Browsing** (`PERSONAL`, Teal `#0D9488`, `STARTER`)
  2. **Social Media Profile** (`SOCIAL`, Blue `#3B82F6`, `STARTER`)
  3. **E-Commerce Store Profile** (`E-COMMERCE`, Emerald `#10B981`, `STARTER`)
  4. **Business & Work Profile** (`WORK`, Indigo `#6366F1`, `STARTER`)
  5. **Automation Example Profile** (`AUTOMATION`, Purple `#8B5CF6`, `DEMO`)
  6. **Sandbox & Test Profile** (`SANDBOX`, Slate `#64748B`, `EXAMPLE`)
- **No Test Pollution:** Zero occurrences of `Warmer-Test-1`, `Warmer-Test-2`, or `Team Locked Profile 1`.
- **Profile Counter:** Accurately displays **0 Profiles Stored**. Starter templates do not inflate real profile count or consume quota.

### 6.2 Template Cloning & Profile Creation
- Cloned `starter_personal` using `createProfileFromStarter(...)`.
- Result: 1 user-owned profile created with isolated ID and storage directory.
- Profile counter incremented from 0 to 1.
- Cleaned verification profile to leave production database at clean 0 state.

### 6.3 Premium Feature Locks (FREE Account)
Entitlement evaluations in UI and backend:

| Feature | Plan Required | UI Badge | Click Behavior | IPC / Backend Status |
| :--- | :---: | :---: | :--- | :--- |
| **Workspaces & Team** | BUSINESS | `BIZ` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Automation & RPA** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Synchronizer** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Cloud Sync** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Built-In Proxy** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Cloud Browser** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Cookie Warmer** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Remote API** | PRO | `PRO` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Webhooks** | BUSINESS | `BIZ` Lock | Opens `UpgradeModal` | Denied (`FEATURE_NOT_INCLUDED`) |
| **Custom Proxies** | FREE | Unlocked | Normal creation | Allowed (`profile.basic`, `proxy.custom`) |

### 6.4 UpgradeModal Flow
Clicking any locked feature displays the high-conversion `UpgradeModal`:
- Shows required plan (`PRO` or `BUSINESS`).
- Displays tailored feature benefits and quota expansion.
- Provides "Upgrade to PRO / Business" CTA routing to Stripe checkout.
- Zero raw 403 error pages or uncaught exceptions.

### 6.5 Dynamic Entitlement Lifecycle
- Activating a simulated paid entitlement updates capabilities dynamically without reinstalling.
- Revoking / downgrading the entitlement re-locks premium features safely without deleting any user-created profiles or settings.

---

## 7. Automated Test Suite Results

```
Test Files  82 passed (82)
     Tests  683 passed (683)
  Duration  96.46s
```

All 678 baseline tests + 5 new database isolation guard tests passed.
Post-test inspection of `%APPDATA%\mahi-browser\mahi_browser.sqlite` verified:
- **Profile count:** `0` (Completely untouched by the test run)
- **Workspaces:** `1`
- **Integrity check:** `ok`

---

## 8. Remaining External Blockers

| Blocker | Description | Production Status | Next Action |
| :--- | :--- | :---: | :--- |
| **Windows Authenticode** | Production code-signing certificate (EV/OV) | `BLOCKED BY CREDENTIAL` | Bind `WIN_CSC_LINK` & `WIN_CSC_KEY_PASSWORD` in CI/CD secrets |
| **Android Physical QA** | Physical device matrix verification | `PENDING HARDWARE` | Connect physical devices to QA runner |
| **Stripe Live Merchant** | Live production payment cutover | `READY FOR CREDENTIAL` | Inject live Stripe keys (`pk_live_`, `sk_live_`) |

---

## Conclusion
The MAHI Browser deployment desynchronization is completely remediated. Automated test pollution is eliminated, the production database is permanently protected by central isolation guards, and the installed desktop application runs the exact latest build with complete onboarding and premium locking capabilities.
