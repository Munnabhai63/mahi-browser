# PHASE 14 — UNIFIED LOGIN RELEASE
## DOCUMENT 08: LIVE CUSTOMER JOURNEY ACCEPTANCE TESTS

**Test Target:** End-to-End User Experience (Website & Desktop Parity)  
**Reference Model:** GoLogin Workflow Parity  
**Verification Status:** 100% PASS  

---

### 1. The Critical Fixed Customer Journey

#### BEFORE (Broken State)
1. User registers or signs in on `https://mahibrowser.com`.
2. Browser redirects to `/download?token=...&login=success` (token exposed in URL).
3. User downloads and launches desktop app.
4. User clicks "Continue with Google" in Desktop.
5. Browser opens, authenticates, and redirects to `https://mahibrowser.com/download`.
6. Desktop app remains on login modal. User is confused and unable to use the app.

#### AFTER (Phase 14 Production State)
1. User registers or signs in on `https://mahibrowser.com`.
2. User downloads MAHI Browser v1.1.2.
3. User opens Desktop app and clicks "Continue with Google".
4. Browser opens Google OAuth directly:
   `https://accounts.google.com/o/oauth2/v2/auth?...`
5. Upon Google consent, Google redirects to `https://mahibrowser.com/api/v1/auth/google/callback`.
6. Cloud server validates state, creates authenticated session, issues single-use authorization code (60s TTL), and redirects to:
   `https://mahibrowser.com/auth/desktop-success?handoff=...&code=...&email=...&plan=...`
7. Zero token is exposed in the redirect URL or cookies.
8. The completion page simultaneously:
   - Displays user email and active trial / Pro plan badge.
   - Triggers desktop deep link: `mahi://auth?code=...&ticket=...`.
   - Sends local loopback POST to `http://127.0.0.1:32123/api/v1/auth/desktop-handoff`.
9. The Desktop client receives the code and invokes:
   `POST https://admin.mahibrowser.com/api/v1/auth/desktop-exchange`
   with `{ ticket, code, code_verifier }`.
10. The Cloud server verifies the SHA-256 PKCE challenge, consumes the code, and delivers the session token over TLS.
11. The Desktop client ingests the token into DPAPI storage, closes the modal, and unlocks the Profiles Dashboard.
12. Returning users with saved sessions open directly to the Dashboard.

---

### 2. Live Verification Matrix

| Flow Scenario | Expected Result | Live Production Test Evidence |
| :--- | :--- | :--- |
| **First-time Onboarding** | Direct unlock into dashboard | Verified via PKCE loopback test suite |
| **Existing Customer Re-login** | Canonical user profile retrieved | Preserved user ID and trial expiry verified |
| **Account Switching** | Email and quota updated in UI | Tested with AccountDropdown switch logic |
| **Tampered / Replayed Code** | Immediate rejection with 403 | Replay attack rejected with HTTP 403 |
| **Expired Attempt** | Polling returns unauthenticated | Expired ticket rejected with HTTP 200 `authenticated: false` |
