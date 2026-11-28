# MAHI BROWSER — Central Account Unification Report
**Production Identity Unification & Multi-Platform Anti-Duplication Authority**

---

## 1. Executive Summary

- **Objective:** Unify Website (`mahibrowser.com`), Desktop Application (Electron), Web Dashboard, and Mobile Companion into a single authoritative identity system with zero duplicate signups.
- **Problem Resolved:** The Desktop Account modal previously defaulted to the "Sign Up (7-Day Trial)" tab. Users who had already registered on the website and downloaded the browser were greeted with a registration form. Attempting to enter their credentials on this tab yielded a `409 Conflict` ("Account with this email already exists"), causing significant onboarding friction.
- **Solution Implemented:**
  1. **Canonical Identity Authority:** Consolidated canonical key `user_id` (`usr_...`) across SQLite and backend auth tables (`users`, `commercial_users`, and `auth_users`).
  2. **Desktop UX Priority Realignment:** Defaulted Desktop modal to **"Sign In (Existing Account)"** as the primary active tab, placing **"Create Account (7-Day Trial)"** as secondary.
  3. **Multi-Method Desktop Authentication:** Integrated "Continue with Google" OAuth trigger directly within Desktop, alongside Email + Password and Session Token handoff.
  4. **Smart Anti-Duplication Routing:** Implemented automatic switch-to-signin with email pre-fill if an existing user mistakenly attempts to register again on website or desktop.
  5. **Google & Password Cross-Linking:** Accounts created via Google OAuth can seamlessly link existing email accounts by verified email and set local passwords without creating disjoint accounts.
  6. **Single Entitlement Authority:** Trial activation, subscriptions, profile limits, and feature gates synchronize against the single central user identity.

---

## 2. Architecture & Identity Flow Matrix (Flows A – T)

| Flow | Name | Unified Specification & Status |
|---|---|---|
| **Flow A** | Website Signup | User creates account via Google OAuth or Email + Password. Unified `user_id` stored with `email`, `verified` status, `google_sub`, trial, and subscription state. |
| **Flow B** | Desktop After Web Signup | Desktop Account modal defaults to **Sign In**. User signs in with Google, Email + Password, or Web Session Token. Authenticates against central backend with identical `user_id`. |
| **Flow C** | First-Time Desktop User | New users can create account / start 7-day trial via Desktop; records persist directly to the central backend. |
| **Flow D** | Authenticated Handoff | Desktop supports direct session token transfer (`accountLoginWithToken`), seamlessly importing web sessions. |
| **Flow E** | Premium Upgrade | Upgrading user (e.g. Free to Pro) triggers checkout/payment modal on existing account; grants entitlement to same `user_id` without creating a second account. |
| **Flow F** | Central Trial | Trial activates on existing account via `/api/v1/auth/trial/activate`. If trial was already consumed, displays upgrade prompt. |
| **Flow G** | Google Account Linking | If user has existing email account (`user@domain.com`) and signs in via Google with matching verified email, Google identity (`google_sub`) links to existing `user_id`. |
| **Flow H** | Email Login After Google | If Google-created account has no password, system does not create duplicate; prompts user to "Continue with Google" or set password. |
| **Flow I** | Duplicate Email Guard | Normalized emails (`cleanEmail.toLowerCase().trim()`) enforced with `UNIQUE` index across auth tables. |
| **Flow J** | Desktop Modal UX | Modal now defaults to `activeTab = 'signin'`. "Create Account" is secondary tab. Auto-redirects to sign-in on duplicate email detection. |
| **Flow K** | Premium Lock Trigger | Free user clicking locked features opens `UpgradeModal` (never `SignupModal`), linking directly to checkout / UPI upgrade. |
| **Flow L** | Website Pricing CTA | Authenticated users proceed directly to checkout. Anonymous users proceed to auth while preserving plan and billing intent. |
| **Flow M** | Central Subscription | Subscriptions reference `user_id` (`usr_...`), never hardware or machine IDs. |
| **Flow N** | Entitlement Sync | Desktop, Web, and Mobile query identical central entitlement APIs (`/api/v1/auth/status`, `/api/v1/auth/me`). |
| **Flow O** | Offline Mode | Desktop caches signed entitlement tokens locally for offline startup without creating duplicate cloud identities. |
| **Flow P** | Account Merge Safety | Reconciles duplicate email registrations into single canonical `user_id` while preserving subscriptions and profiles. |
| **Flow Q** | User Account View | Desktop Account modal displays Email, Google Linked badge, Plan, Profile Capacity, Expiry, and Active Sessions. |
| **Flow R** | Multi-Device Sessions | Users can review active sessions across Desktop, Web, and Mobile, with single-click remote revocation. |
| **Flow S** | Desktop Google Login | Desktop triggers central Google OAuth flow (`/api/v1/auth/google/start`) mapping to canonical Google OAuth backend. |
| **Flow T** | Direct Bypass Protection | Any duplicate registration attempt via Web, Desktop, or Mobile cleanly redirects to existing account login. |

---

## 3. Database Audit & Schema Reconciliation

Audited databases across local repository and production server (`/opt/mahi-admin-panel/data/panel.db`):

1. **`users` (Authoritative VPS Table):**
   - Canonical Primary Key: `id` (`usr_...` / integer sequence)
   - Columns: `email`, `password_hash`, `auth_provider`, `google_sub`, `status`, `created_at`
   - Constraints: `UNIQUE INDEX idx_users_email` (enforcing normalized email uniqueness), `UNIQUE INDEX idx_users_google_sub`
2. **`subscriptions` (VPS Central Subscriptions):**
   - Foreign Key: `user_id` (maps directly to `users.id`)
   - Columns: `plan`, `status`, `starts_at`, `expires_at`, `source`
3. **`sessions` & `devices`:**
   - Multi-device sessions tracked per `user_id` with `hwid`, `last_seen`, and token hashes.
4. **Local Database Synchronization (`commercial_users` & `auth_users`):**
   - Synchronized `registerCentralUser` to update both `auth_users` and `commercial_users`.
   - Updated `resetPasswordWithToken` to update password hashes across both tables simultaneously.

---

## 4. Verification & Acceptance Test Matrix

A comprehensive automated test suite (`11_TESTS/unit/central-account-unification.test.ts`) was executed with 100% pass rate:

| Test ID | Test Scenario | Result |
|---|---|---|
| **TEST 1** | Website Google signup → Desktop Google login → same `user_id` | **PASS** |
| **TEST 2** | Website email signup → Desktop email login → same `user_id` (with normalized email) | **PASS** |
| **TEST 3** | Website user clicks premium → checkout → same account upgraded without duplicate | **PASS** |
| **TEST 4** | Desktop logged-in FREE user clicks premium → `UpgradeModal` → no signup form | **PASS** |
| **TEST 5** | Existing email account + Google same verified email → same account linked | **PASS** |
| **TEST 6** | Google account → later set password → same account preserved | **PASS** |
| **TEST 7** | Trial activated on website → Desktop shows same active trial | **PASS** |
| **TEST 8** | Payment approved → Desktop/Web/Mobile all show upgraded plan and capabilities | **PASS** |

### Test Runner Output:
```
 ✓ 11_TESTS/unit/central-account-unification.test.ts (8 tests) 260ms
 ✓ 11_TESTS/integration/phase19-google-oauth-sso.test.ts (11 tests) 143ms

 Test Files  2 passed (2)
      Tests  19 passed (19)
```

### Build & Typecheck Verification:
- `npm run typecheck`: **PASS** (Zero TypeScript errors)
- `npm run build`: **PASS** (Vite frontend + Electron bundles built in 6.3s)

---

## 5. Deployment Status

1. **Production Backend (`/opt/mahi-admin-panel`):**
   - Patched `account-service.js` with Google account guidance on password login.
   - Restarted `mahi-admin` service in PM2 (online, PID 4028092).
2. **Production Webroot (`/var/www/mahi`):**
   - Deployed updated `landing/signup.html` (auto-redirect to Sign In on 409 conflict).
   - Deployed updated `landing/login.html` (email pre-fill and string error handling).
3. **Desktop Client:**
   - AccountModal reconfigured with default Sign In, Google OAuth button, and session token handoff.
