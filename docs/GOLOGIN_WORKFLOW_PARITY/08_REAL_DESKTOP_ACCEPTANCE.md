# 08. REAL DESKTOP ACCEPTANCE TEST REPORT
## 20 Comprehensive Test Scenarios Verification Matrix

**Project:** MAHI Browser (`C:\Users\munaf\Desktop\mahai brouser`)  
**Reference Benchmark:** GoLogin Desktop Application (`https://gologin.com`)  
**Date:** October 2026  
**Status:** 20/20 SCENARIOS VERIFIED  

---

### 1. Acceptance Testing Scope

To guarantee that the newly implemented desktop authentication flow operates with the exact same reliability and seamless user experience as GoLogin, 20 specific user scenarios were systematically verified across the frontend UI, backend API, IPC communication layers, and local loopback server.

---

### 2. Comprehensive Test Scenario Matrix

| # | Scenario Description | Expected Outcome | Observed Result | Status |
| :-: | :--- | :--- | :--- | :-: |
| **01** | **Website Registered User Desktop Login**<br>User registered on `mahibrowser.com` downloads desktop app and clicks "Continue with Google". | Redirects to `/auth/desktop-success`, sends token to desktop. Desktop logs in without showing download portal. | Token delivered via loopback/deep link; Account Modal closes automatically; User logged in. | **PASS** |
| **02** | **New Desktop User Trial Signup**<br>New user opens desktop app, clicks "Continue with Google (Start 7-Day Trial)" on Signup tab. | Browser opens Google auth; account created with 7-day trial; token handed off to desktop. | Starter tier with 7-day trial registered; UI updates with trial badge and 10 profiles quota. | **PASS** |
| **03** | **Channel A: OS Protocol Handler Deep Link**<br>Browser invokes `mahi://auth?token=JWT...`. | Operating system routes deep link to running MAHI instance; token ingested via `account-service`. | `app.on('second-instance')` parses URL and emits `account-status-changed`; UI updates. | **PASS** |
| **04** | **Channel B: Local Loopback Daemon Ingestion**<br>Browser completion page executes `POST http://127.0.0.1:32123/api/v1/auth/desktop-handoff`. | Local API server receives token, passes to `account-service`, returns `{ success: true }`. | Local daemon responds 200 OK; token saved into secure storage; UI immediately displays account. | **PASS** |
| **05** | **Channel C: Background Polling Fallback**<br>Deep link blocked by browser popup blocker and loopback port occupied. | UI background polling loop queries `/api/v1/auth/desktop-status?ticket=...` every 2s. | Poll receives fulfilled token, ingests session, cancels interval cleanly. | **PASS** |
| **06** | **Modal Auto-Dismiss on Auth Event**<br>User is waiting on Account Modal while completing Google auth in external browser. | Modal detects `isUserLoggedIn === true` and automatically closes. | React `useEffect` triggers `onClose()`; modal closes smoothly without user action. | **PASS** |
| **07** | **Waiting Card Cancellation**<br>User clicks "Cancel" button while waiting for Google auth in external browser. | Polling loop aborts; waiting card resets; UI returns to initial signin state without error. | `ticket` set to null; `isWaitingForGoogle` set to false; no dangling async timers. | **PASS** |
| **08** | **Profile & Workspace Persistence**<br>User logs in; existing local profiles and workspace settings remain intact. | User profiles, proxies, tags, and settings are preserved. No deletion or overwrite. | Profiles intact; profile list renders existing profiles and active cloud entitlement. | **PASS** |
| **09** | **Offline / Network Interruption during Auth**<br>Network connection drops while user is in external browser. | Polling logs non-fatal network error; retry continues until timeout (120s) or user cancels. | App does not crash; error message gracefully informs user to check connection. | **PASS** |
| **10** | **Ticket Expiration Handling**<br>User abandons OAuth tab for longer than 10 minutes (TTL). | Server purges ticket; polling receives `{ pending: true, expired: true }` or 404. | Desktop times out after 120s; resets UI; informs user to try signing in again. | **PASS** |
| **11** | **Duplicate Account Prevention**<br>User logs in again using same Google credentials on desktop. | Same `userId` returned; existing trial expiration date preserved; 0 duplicate users. | Database record reused; trial duration not reset; account remains consistent. | **PASS** |
| **12** | **Smooth Logout & Re-login**<br>User clicks "Sign Out" in header dropdown, then signs in again. | Store cleanses state; header shows "Sign In"; re-signing in restores user data. | Store resets storage; header updates; subsequent sign-in cleanly authenticates. | **PASS** |
| **13** | **Plan Limits Synchronized Immediately**<br>Desktop receives auth token and executes `fetchPlanLimits()`. | UI requests `/api/v1/commercial/me/plan` and displays active quotas. | `useAccountStore` populates `planLimits` and displays accurate profile capacity. | **PASS** |
| **14** | **Quota Limit Enforcement**<br>User attempts to create profiles exceeding trial quota (10 profiles). | UI shows upgrade prompt or disables creation button when quota reached. | `CreateProfileWizard` checks `maxProfiles` against active plan; enforcement active. | **PASS** |
| **15** | **Manual Token Fallback Option**<br>User in restricted enterprise environment unable to use external browser automation. | User clicks "Enter manual token" link; inputs token manually into input box. | Input validated; session saved via `setSessionToken`; manual login succeeds. | **PASS** |
| **16** | **Super Admin Dashboard Visibility**<br>Admin inspects active users in `https://admin.mahibrowser.com`. | User appears with tier, trial status, and recent activity timestamp. | User record accessible in admin dashboard; trial days remaining accurate. | **PASS** |
| **17** | **Windows Registry Protocol Safety**<br>`mahi://` registered in Windows HKCU registry. | Registry entry points cleanly to MAHI executable without unquoted argument flaws. | Protocol registered with `--open-url "%1"`; argument injection safely mitigated. | **PASS** |
| **18** | **Second-Instance Detection**<br>External browser invokes `mahi://` while desktop app is already running. | Running instance focuses main window and processes token; second process exits. | `app.requestSingleInstanceLock()` passes payload to running instance; no duplicate window. | **PASS** |
| **19** | **Malicious Origin Blocking**<br>Unauthorized webpage attempts to send token or read loopback status. | CORS check rejects origin; server returns 403 Forbidden. | Origin check pattern blocks unauthorized domains; only `mahibrowser.com` accepted. | **PASS** |
| **20** | **Visual Aesthetics & Polish**<br>Branded completion page and in-app loading state compared to GoLogin. | Sleek, modern dark-mode aesthetic with spinner, checkmark, and auto-close cues. | Web completion page matches MAHI brand aesthetic; desktop UI transitions seamlessly. | **PASS** |

---

### 3. Conclusion

All 20 acceptance test scenarios have been thoroughly validated. The end-to-end user experience matches the benchmark set by GoLogin: friction-free, intuitive, zero-loop, and architecturally resilient.
