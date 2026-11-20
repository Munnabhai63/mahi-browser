# PHASE 14 — UNIFIED LOGIN RELEASE
## DOCUMENT 01: BASELINE AND DEPENDENCY MAP

**Project:** MAHI Browser  
**Release Target:** v1.1.2 Production Release  
**Production Identity:** `mahibrowser.com` / `admin.mahibrowser.com`  
**Host Target:** `<VPS_HOST>:2222`  
**Environment Baseline:** Electron 33.4.11 / Node.js 22.23.2 / Chromium 138.0.7204.0  

---

### 1. Executive Summary & Problem Scope

Prior to Phase 14, the user onboarding and Google authentication journey suffered from a critical redirect loop and disconnect between website and desktop:
1. A user would register or sign in with Google on `https://mahibrowser.com`.
2. The user was redirected to `/download` where the raw token was exposed in the URL query string (`/download?token=...&login=success`).
3. After downloading and installing the MAHI Browser desktop application, clicking "Continue with Google" opened the browser, authenticated with Google, and redirected back to `https://mahibrowser.com/download` instead of the desktop application.
4. The desktop client remained stuck on the login modal, requiring manual token copying or leaving the desktop session incomplete.

**Phase 14 Mandate:** Complete the official GoLogin-style seamless onboarding:
$$\text{Website Signup} \longrightarrow \text{Download Desktop} \longrightarrow \text{Google Verification} \longrightarrow \text{Automatic Desktop Unlock} \longrightarrow \text{Profiles Dashboard}$$

---

### 2. Architectural Product Boundaries

The canonical customer identity is strictly owned and centralized by the production Cloud Admin Backend:
- **Canonical Identity Authority:** `https://admin.mahibrowser.com` (running on port `4180`, proxied by Nginx).
- **Canonical Session & Token Authority:** SQLite database `/opt/mahi-admin-panel/data/panel.db` (tables `users`, `subscriptions`, `sessions`, `oauth_states`, `desktop_auth_tickets`).
- **Cryptographic Entitlement Provider:** RSA-2048 signing engine issuing signed account status proofs with HWID binding and 7-day grace period.
- **Desktop Application Client:** MAHI Browser Windows Desktop Application (`com.mahibrowser.app`), using DPAPI encrypted session storage and local daemon port `32123`.

---

### 3. Component & Dependency Map

| Component | Repository Path / Production Path | Role & Changes in Phase 14 |
| :--- | :--- | :--- |
| **Account Service (Desktop)** | `08_SECURITY/account-service.ts` | Implemented `createDesktopOAuthRequest()` (PKCE code_verifier, code_challenge) and `exchangeDesktopAuthCode()`. |
| **Commercial API Router** | `07_BACKEND/commercial/commercial-api-router.ts` | Registered PKCE exchange `/api/v1/auth/desktop-exchange`, polling `/api/v1/auth/desktop-status`, and completion HTML `/auth/desktop-success`. |
| **Production Server** | `/opt/mahi-admin-panel/src/server.js` | Added single-use authorization code generation (60s TTL), SQLite-backed ticket storage, PKCE verification, and GoLogin-style redirect. |
| **Reverse Proxy (Nginx)** | `/etc/nginx/sites-available/mahibrowser.com` | Added `location /auth/` proxy pass to backend port 4180 to route completion page. |
| **IPC Bridge Handlers** | `07_BACKEND/ipc/register-handlers.ts` | Registered IPC channels `account:startDesktopOAuth` and `account:exchangeDesktopCode`. |
| **Preload Interfaces** | `10_CONFIG/preload/preload.cjs` | Exposed sanitized `window.api.account` methods for PKCE desktop flow. |
| **Desktop UI Login Modal** | `01_UI/components/AccountModal.tsx` | Updated Google login button to generate PKCE challenge, launch browser, and listen on loopback/deep-link. |
| **Single-Instance Deep Link** | `07_BACKEND/index.ts` | Updated `handleDeepLinkUrl()` to capture `code` and `ticket` without logging secrets and invoke PKCE exchange. |

---

### 4. Git State & Uncommitted Modifications

- **Branch:** `feature/phase11-android-mobile`
- **Integrity Rule:** Zero destructive resets, zero force pushes. Uncommitted changes in working directory preserved without touching unrelated features.
