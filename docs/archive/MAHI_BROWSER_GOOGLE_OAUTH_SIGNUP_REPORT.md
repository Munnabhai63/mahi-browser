# MAHI BROWSER: PRODUCTION GOOGLE OAUTH SSO & TRIAL INTENT FLOW REPORT

**Version:** 1.1.1  
**Target:** Connect signup and login "Continue with Google" buttons to real production Google OAuth, Central Auth, and Server-Side Plan/Trial Intent continuity.  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Previously, the MAHI Browser signup and login interfaces featured a "Continue with Google" button UI that had not yet been connected to an end-to-end server-authoritative OAuth authorization flow, risking broken user expectations and loss of signup intent (e.g. 7-Day Free Trial for Professional 50).

We have implemented a unified, production-grade Google OAuth 2.0 / OpenID Connect integration:
1. **OAuth Start Initiation (`GET /api/v1/auth/google/start`):** Cryptographically generates single-use anti-CSRF `state` (32 bytes hex) and `nonce` (16 bytes hex), securely persists the user's intent (`intent=trial`, `plan=professional_50`, `billing=annual`, `returnUrl=/download`) in a dedicated `oauth_states` table with a 10-minute TTL, and performs a 302 redirect to Google's authorization endpoint.
2. **Secure Token Exchange & Verification (`GET /api/v1/auth/google/callback`):** Verifies the returned `state`, atomically validates and consumes it to prevent replay attacks, exchanges the authorization code for tokens server-side, retrieves verified claims (`sub`, `email`, `email_verified`, `name`, `picture`), and rejects unverified Google emails.
3. **Account Unification & Safe Account Linking:**
   - **New User:** Automatically creates a unified account in both `auth_users` and `commercial_users` with `auth_provider = 'GOOGLE'`, verified email, display name, and avatar URL. local password creation is not required.
   - **Existing Email User:** If an account already exists with the same verified email, securely links `google_sub` without creating duplicate accounts.
   - **Existing Google User:** Directly authenticates the user into their existing MAHI account.
4. **Server-Side Trial Activation:** Automatically activates the 7-day free trial for Professional 50 upon registration if eligible, records abuse prevention flags (`trial_used = 1`), and establishes a secure session cookie (`mahi_session`) and token.
5. **Post-Auth Onboarding:** Smoothly redirects authenticated users to `/download?onboarding=google_sso` or the preserved `returnUrl`, ensuring zero premature binary downloads before authentication.

---

## 2. Architecture & Data Flow

```
User (Browser)               MAHI Backend (API)                 Google OAuth 2.0
     │                                │                                │
     ├─► Click "Continue with Google" │                                │
     │   (with intent=trial,          │                                │
     │    plan=professional_50)       │                                │
     │                                │                                │
     │   GET /auth/google/start ────► │                                │
     │                                ├─► Generate state & nonce       │
     │                                ├─► Store in oauth_states DB     │
     │   ◄─── 302 Redirect to Google ─┤                                │
     │                                │                                │
     ├────────────────────── Consent & Login ────────────────────────► │
     │                                │                                │
     │ ◄─── 302 Redirect to Callback with code & state ────────────────┤
     │                                │                                │
     ├─► GET /auth/google/callback ──►│                                │
     │                                ├─► Atomically consume state     │
     │                                │   (Anti-CSRF & Anti-Replay)    │
     │                                ├─► Exchange code for tokens ──► │
     │                                │   (Server-to-Server HTTPS)     │
     │                                ├─◄ Verified Claims Received ────┤
     │                                │   (sub, email, verified, name) │
     │                                ├─► Enforce email_verified       │
     │                                ├─► Link or Create MAHI User     │
     │                                ├─► Activate 7-Day Pro 50 Trial  │
     │                                ├─► Create Secure MAHI Session   │
     │   ◄─── 302 to /download ───────┤   (HttpOnly Cookie + Token)    │
     │                                │                                │
     ▼                                ▼                                ▼
Authenticated Onboarding Hub & Official Windows Binary Download Available
```

---

## 3. Database Schema (Migration v21)

### `oauth_states` Table
Persists OAuth authorization context across redirection cycles:
- `state` (TEXT PRIMARY KEY): 64-character hex cryptographic token.
- `nonce` (TEXT NOT NULL): 32-character hex replay protection token.
- `provider` (TEXT NOT NULL DEFAULT 'google'): Identity provider.
- `intent` (TEXT NOT NULL DEFAULT 'trial'): Conversion intent (`trial`, `free`, `paid`, `login`).
- `plan_id` (TEXT NOT NULL DEFAULT 'professional_50'): Normalized plan identifier.
- `billing_cycle` (TEXT NOT NULL DEFAULT 'annual'): Selected billing cycle.
- `return_url` (TEXT NOT NULL DEFAULT '/download'): Post-auth destination.
- `expires_at` (TEXT NOT NULL): ISO8601 timestamp (10-minute TTL).
- `created_at` (TEXT NOT NULL): ISO8601 timestamp.

### Additive User Columns (`commercial_users` & `auth_users`)
- `google_sub` (TEXT UNIQUE): Google subject identifier for direct SSO mapping.
- `avatar_url` (TEXT): Google profile picture URL used strictly for MAHI account avatar UI.
- `auth_provider` (TEXT DEFAULT 'LOCAL'): Distinguishes `GOOGLE` vs `LOCAL` accounts.

---

## 4. Google Cloud Console Configuration Guide

To enable live Google OAuth in production, configure the following settings in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

### 1. Authorized JavaScript Origins
- `https://mahibrowser.com`
- `https://www.mahibrowser.com`
- `http://localhost:3000` *(for local development)*
- `http://localhost:4180` *(for local admin development)*

### 2. Authorized Redirect URIs
- `https://mahibrowser.com/api/v1/auth/google/callback`
- `https://www.mahibrowser.com/api/v1/auth/google/callback`
- `http://localhost:3000/api/v1/auth/google/callback` *(local development)*
- `http://localhost:4180/api/v1/auth/google/callback` *(local dev server)*

### 3. Required Environment Variables
Set the following on the host / production environment:
```env
GOOGLE_CLIENT_ID=your_production_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
GOOGLE_REDIRECT_URI=https://mahibrowser.com/api/v1/auth/google/callback
```
*Note: `GOOGLE_CLIENT_SECRET` is stored strictly server-side and never exposed to the frontend or bundled client applications.*

---

## 5. Security & Account Unification Audit

1. **Client Secret Hygiene:** Zero references to `GOOGLE_CLIENT_SECRET` exist in frontend JavaScript, Electron renderer, or distribution assets.
2. **Anti-CSRF & Single-Use Tokens:** Each OAuth start issues a 256-bit cryptographically secure state token. The callback deletes the state from `oauth_states` immediately upon validation (`validateAndConsumeOAuthState`), rendering replay attacks impossible.
3. **Unverified Email Defense:** Google accounts with `email_verified !== true` are strictly rejected (`GOOGLE_EMAIL_NOT_VERIFIED`) to prevent account hijacking.
4. **Duplicate Prevention:** If a user previously signed up via email/password and subsequently uses "Continue with Google" with the same email, the existing account is updated with `google_sub` rather than creating a duplicate record.
5. **Trial Abuse Prevention:** The server verifies `trial_used` on the user record. If a trial was previously consumed, the user is not granted duplicate trial days and is guided to upgrade or continue on the Free tier.
6. **Graceful Error UX:** Cancellation (`error=access_denied`) or invalid state redirects the user to `/signup?error=cancelled` or `/login?error=cancelled`, rendering a clear, branded notice without unhandled errors or raw JSON.

---

## 6. Test Suite & Verification Results

- **Integration Suite:** `11_TESTS/integration/phase19-google-oauth-sso.test.ts`
- **Total Test Cases:** 11 passed (100% green)
  - `generates secure state, nonce, and preserves Professional 50 trial intent in SQLite`: PASS
  - `atomically validates and consumes state (anti-CSRF and anti-replay)`: PASS
  - `rejects invalid or non-existent OAuth states`: PASS
  - `creates new unified account with verified email, name, avatar, and activates Professional 50 7-day trial`: PASS
  - `rejects Google claims where email_verified is false`: PASS
  - `safely links Google identity to existing email account without creating duplicate user`: PASS
  - `logs existing Google user directly into their account on repeat visits`: PASS
  - `preserves Professional 100 plan intent across Google signup`: PASS
  - `handles paid plan intent without trial by preserving pending plan parameters`: PASS
  - `ensures google client secret is never exposed in client auth parameters`: PASS
  - `reports Google OAuth configuration status accurately`: PASS
- **TypeScript Typecheck:** Clean (0 errors across `tsconfig.json` and `tsconfig.electron.json`).
