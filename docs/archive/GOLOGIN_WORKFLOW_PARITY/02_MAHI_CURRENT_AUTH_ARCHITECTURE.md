# 02. MAHI BROWSER CURRENT AUTHENTICATION ARCHITECTURE
## System Audit: Marketing, Portal, Desktop, Licensing & Profile Lifecycle

- **Date:** October 13, 2026
- **Audited Target:** MAHI Browser Platform (`C:\Users\munaf\Desktop\mahai brouser`)
- **Document Status:** Comprehensive Pre-Fix Architectural Inventory

---

## 1. Architectural Topology Overview

MAHI Browser is architected around three interconnected subsystems:
1. **Public Marketing Website & Onboarding** (`landing/`, served via `07_BACKEND/server/app.ts` / Nginx)
2. **Central Commercial Auth & Entitlements API** (`07_BACKEND/commercial/*`, `07_BACKEND/server/app.ts`)
3. **Desktop Native Electron Anti-Detect Application** (`01_UI/`, `07_BACKEND/index.ts`, `02_BROWSER/`, `08_SECURITY/`)

The architecture was designed to unify identities across platforms, but contained an integration gap between the external browser Google OAuth redirection and the native Electron process.

---

## 2. Inventory of Current Subsystem Responsibilities

### 2.1 Marketing Website Authentication (`https://mahibrowser.com`)
* **Files:** `landing/signup.html`, `landing/login.html`, `landing/index.html`
* **Mechanics:**
  - `landing/signup.html`: Offers Email registration and a "Continue with Google" button.
  - Clicking "Continue with Google" executes `window.location.href = /api/v1/auth/google/start?intent=trial&plan=...`.
  - Supports standard form submission via POST to `/api/v1/auth/register`.
  - Sets browser cookie `mahi_token` upon completion.

### 2.2 Customer Portal & Download Gateway (`https://mahibrowser.com/dashboard`)
* **Files:** `landing/download.html`, `07_BACKEND/server/app.ts` (lines 179–198)
* **Mechanics:**
  - Route `/dashboard` serves `landing/download.html`.
  - Route `/download` ALSO serves `landing/download.html`.
  - When an unauthenticated visitor accesses `/dashboard` or `/download`, an `authGate` card is shown stating:
    *"Account Required to Download — To protect our multi-accounting infrastructure... please sign up or log in before downloading."*
  - When authenticated, it shows user email, trial countdown, and the "Download MAHI Browser (x64)" button.

### 2.3 Existing Desktop Browser Authentication
* **Files:** `08_SECURITY/account-service.ts`, `01_UI/components/AccountModal.tsx`, `01_UI/stores/useAccountStore.ts`
* **Mechanics:**
  - Desktop client renders `AccountModal.tsx` containing tabs: `signin`, `signup`, `verify`, `forgot`, `reset`.
  - Clicking "Continue with Google" executed:
    ```typescript
    const googleAuthUrl = 'https://admin.mahibrowser.com/api/v1/auth/google/start?intent=desktop_login';
    window.open(googleAuthUrl, '_blank');
    setShowTokenInput(true);
    ```
  - It presented a manual token text box: *"Please paste your session token from the browser"*.
  - Token was submitted via `accountLoginWithToken(token)` which verified against `/api/v1/auth/me`.

### 2.4 Google OAuth Service & State Engine
* **Files:** `07_BACKEND/commercial/google-oauth-service.ts`, `07_BACKEND/commercial/commercial-api-router.ts`
* **Mechanics:**
  - SQLite table `oauth_states`: Stores `state`, `nonce`, `provider`, `intent`, `plan_id`, `return_url`, `expires_at`.
  - `generateOAuthAuthorization()`: Creates high-entropy state (32 bytes) and nonce (16 bytes) with 10-minute TTL.
  - `exchangeGoogleAuthorizationCode()`: Exchanges authorization code server-side against `https://oauth2.googleapis.com/token`.
  - `fetchGoogleProfile()`: Retrieves OpenID claims (`sub`, `email`, `email_verified`, `name`, `picture`).
  - `authenticateWithGoogleClaims()`: Links or creates user in SQLite `commercial_users` and `auth_users`.

### 2.5 Account Status API & Signed Entitlements
* **Files:** `08_SECURITY/license-status-service.ts`, `08_SECURITY/account-service.ts`
* **Mechanics:**
  - Heartbeat scheduler (`startAccountStatusScheduler`) connects every 6 hours to `${ADMIN_API_BASE_URL}/api/v1/account/status`.
  - Response is digitally signed with RSA-2048 private key on server.
  - Desktop client verifies signature using embedded public key (`PUBLIC_KEY`) to prevent local tampering.
  - Grants a 7-day offline grace period (`GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000`).

### 2.6 Subscription Entitlement API
* **Files:** `07_BACKEND/commercial/commercial-entitlement-service.ts`, `07_BACKEND/commercial/canonical-plan-catalog.ts`
* **Plans Supported:**
  - `free`: 15 local profiles, 0 cloud sync
  - `trial`: 50 profiles, 7 days full access, cloud sync enabled
  - `professional_50` / `pro`: 50–100 profiles, full automation, unlimited proxy rotation
  - `business_scale`: 200+ profiles, team sharing, master vault

### 2.7 Installed Browser Session Persistence
* **Files:** `08_SECURITY/account-service.ts`
* **Storage Location:** `%APPDATA%\mahi-browser\account-session.enc`
* **Security:**
  - Uses Electron's native `safeStorage.encryptString()` (Windows DPAPI hardware-backed encryption).
  - Robust fallback: AES-256-GCM keyed by hardware ID (`getHWID() + 'mahi-account-enc-2026'`).
  - Plaintext credentials or tokens are **NEVER** stored unencrypted on disk.

### 2.8 User Identity Mapping
* **Primary Key:** `id` (`usr_${uuid}`)
* **Unique Key:** `email` (normalized lowercase)
* **Google Identity:** `google_sub` (unique stable OpenID subject identifier)
* **Account Linking:**
  - If a user signs up with email `alice@work.com` and later logs in with Google account `alice@work.com`, `authenticateWithGoogleClaims` safely links `google_sub` to the existing user ID rather than creating a duplicate.

### 2.9 Profile Storage and Cloud Synchronization
* **Files:** `02_BROWSER/services/profile-service.ts`, `08_SECURITY/cloud-sync-service.ts`
* **Local Profiles:** `%APPDATA%\mahi-browser\profiles\<id>\`
* **Database:** SQLite `profiles`, `profile_settings`, `profile_proxies`, `profile_tags`.
* **Cloud Sync:** End-to-end encrypted profile metadata and cookie synchronization using user's `sync_key`.

### 2.10 Browser Profile Launch Engine
* **Files:** `02_BROWSER/process-manager.ts`, `02_BROWSER/managed-engine.ts`, `10_CONFIG/engine-config.ts`
* **Engine:** Pinned Google Chromium milestone 138 (Commit position `1465706`, `138.0.7204.0`).
* **Execution:** Isolated user-data directory, runtime fingerprint injection, canvas/webgl noise, custom audio buffers, and proxy rotation.
