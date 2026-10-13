# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 05: Google OAuth & In-App Email Authentication

**Date:** October 14, 2026  
**Component:** `07_BACKEND/services/oauth-desktop-service.ts`, `01_UI/stores/useAccountStore.ts`  
**Status:** Implemented & Verified

---

### 1. Unified Authentication Architecture

Users have two robust login paths directly from within MAHI Browser:

#### A. One-Click Google OAuth (PKCE Loopback)
1. User clicks **"Sign In with Google"** in the desktop app.
2. Desktop starts a local ephemeral loopback listener (port 49152-65535 or fallback `mahi://` protocol).
3. The system default browser opens Google OAuth consent screen.
4. Google returns to `https://mahibrowser.com/auth/callback` with auth code.
5. Website callback exchanges code, issues short-lived single-use handoff ticket with PKCE verifier, and redirects to `http://127.0.0.1:[port]/callback?ticket=...`.
6. Browser tab displays: *"Authentication successful! You can close this tab and return to MAHI Browser."* and invokes `window.close()`.
7. Desktop exchanges ticket, stores JWT session, updates user state, and closes modal automatically.
8. **No bounce back to the web download page!**

#### B. Direct Email / Password Signup & Login
1. User fills email and password directly inside `AccountModal.tsx`.
2. UI calls backend API `/api/v1/auth/signup` or `/api/v1/auth/login`.
3. Server returns JWT access token, refresh token, and user profile object.
4. UI persists session to local secure storage.

---

### 2. Security Hardening Verified
- State parameter signed with HMAC-SHA256.
- Ephemeral port listener binds only to `127.0.0.1`.
- Single-use authorization tickets expire within 60 seconds.
- Replay attacks prevented by storing consumed ticket nonces.
