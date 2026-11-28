# 05. MINIMAL FIX IMPLEMENTATION PLAN
## Surgical Engineering: Eliminating the Loop & Delivering GoLogin Parity

- **Date:** October 13, 2026
- **Architecture Standard:** GoLogin Workflow Parity
- **Constraint:** Surgical Modifications Only — Zero Changes to Chromium Engine, Proxies, or Profile DB

---

## 1. Overview of Proposed Changes

To eliminate the login loop, prevent the unwanted redirection to `download.html`, and provide a frictionless GoLogin-style experience, minimal changes are introduced across four technical boundaries:

```
┌────────────────────────────────────────────────────────┐
│ 1. Backend OAuth Router & Redirect Resolver            │
│    (google-oauth-service.ts, commercial-api-router.ts) │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. Branded Desktop Completion View & Handoff           │
│    (commercial-api-router.ts, app.ts)                  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. Native Electron Deep Link & Local Loopback Listener │
│    (index.ts, local-api-server.ts)                     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. Desktop Client UI Auto-Dismiss & Polling Fallback   │
│    (AccountModal.tsx, App.tsx, useAccountStore.ts)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Detailed File Modifications

### 2.1 `07_BACKEND/commercial/google-oauth-service.ts`
* **Changes:**
  1. Add `'/auth'` and `'/auth/desktop-success'` to `ALLOWED_EXACT_OR_PREFIXES` in `isSafeInternalUrl()`.
  2. In `resolvePostAuthRedirect()`:
     Add explicit mapping for `intent === 'desktop_login'` or `intent === 'desktop'`:
     ```typescript
     if (normalizedIntent === 'desktop_login' || normalizedIntent === 'desktop') {
       return '/auth/desktop-success';
     }
     ```
  3. In `generateOAuthAuthorization()`:
     Accept optional `handoff` ticket parameter and pass it into state and return URL.

---

### 2.2 `07_BACKEND/commercial/commercial-api-router.ts`
* **Changes:**
  1. In `GET /api/v1/auth/google/start`:
     Extract `handoff = parsedUrl.searchParams.get('handoff')`.
     Register the ticket in an active ticket store (`desktopAuthTickets`).
  2. In `GET /api/v1/auth/google/callback`:
     When `stateRecord.intent === 'desktop_login'`, construct target URL:
     `/auth/desktop-success?token=${authResult.token}&email=${encodeURIComponent(authResult.user.email)}&plan=${encodeURIComponent(authResult.user.planId || 'trial')}&login=success${handoff ? '&handoff=' + encodeURIComponent(handoff) : ''}`
     Set the token on the active `desktopAuthTickets` record.
  3. Add `GET /api/v1/auth/desktop-status?ticket=<ticket>`:
     Returns `{ success: true, authenticated: true, token, email }` once Google OAuth completes.
  4. Add `GET|POST /api/v1/auth/desktop-handoff`:
     Endpoint for local loopback on port 32123 to receive token directly from browser.
     Calls `accountLoginWithToken(token)` and broadcasts account status change.
  5. Add `GET /auth/desktop-success`:
     Serves the branded GoLogin-style HTML completion page.

---

### 2.3 `07_BACKEND/api/local-api-server.ts`
* **Changes:**
  1. Add `ALLOWED_ORIGIN_PATTERNS`: Include `https://mahibrowser.com` and `https://admin.mahibrowser.com` so the browser success page can securely communicate with the local desktop daemon on `http://127.0.0.1:32123`.
  2. Ensure `/api/v1/auth/desktop-handoff` is routed through `handleCommercialApiRoutes`.

---

### 2.4 `07_BACKEND/index.ts`
* **Changes:**
  1. Register OS custom protocol client:
     ```typescript
     app.setAsDefaultProtocolClient('mahi');
     ```
  2. In `app.on('second-instance')`:
     Inspect `argv` for arguments matching `mahi://auth?token=...`.
     Extract token, call `accountLoginWithToken(token)`, broadcast account change, and focus main window.
  3. In `app.on('open-url')` (macOS support):
     Extract token from `mahi://` URL and authenticate.

---

### 2.5 `01_UI/components/AccountModal.tsx`
* **Changes:**
  1. Update `handleGoogleLogin()`:
     - Generate secure `handoffTicket = 'dsk_' + randomId`.
     - Open `${ADMIN_API_BASE_URL}/api/v1/auth/google/start?intent=desktop_login&handoff=${handoffTicket}`.
     - Present clean GoLogin-style waiting state (*"Waiting for Google sign-in in your browser..."*) with spinner and Cancel button.
     - Start interval polling on `/api/v1/auth/desktop-status?ticket=${handoffTicket}`.
     - When token is returned or when `accountSession` updates, automatically close modal (`onClose()`) and toast success.
  2. Remove intrusive `setShowTokenInput(true)` prompt. Retain optional collapsed manual link.
  3. Add "Continue with Google" button to `signup` tab so new users have zero friction.

---

### 2.6 `01_UI/App.tsx`
* **Changes:**
  1. Add listener for `window.mahiAPI.onAccountStatusChanged`:
     When session status updates in main process, call `useAccountStore.getState().fetchPlanLimits()` to synchronize state globally across the UI in real time.
