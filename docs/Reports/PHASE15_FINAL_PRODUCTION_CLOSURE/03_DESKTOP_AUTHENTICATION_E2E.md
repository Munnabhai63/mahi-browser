# MAHI BROWSER v1.1.3 — DESKTOP AUTHENTICATION E2E ACCEPTANCE
## Document: 03_DESKTOP_AUTHENTICATION_E2E.md
**Project Path:** `C:\Users\munaf\Desktop\mahai brouser`  
**Execution Target:** Installed Application (`MAHI Browser.exe` v1.1.3)  
**Test Date:** October 14, 2026

---

### 1. CLEAN FIRST-LAUNCH ONBOARDING FLOW

1. **User Journey Execution:**
   - User downloads installer directly from `https://mahibrowser.com` (no prior registration required).
   - User executes installer on Windows 10/11 x64.
   - Application launches to clean in-app Welcome/Authentication view.
2. **Elimination of Web-to-Desktop Handoff Flaws:**
   - Previous versions forced users to register on `mahibrowser.com/signup`, download, and then repeatedly authenticate in the desktop app.
   - The approved `v1.1.3` flow implements true in-app onboarding:
     - **Email/Password Registration:** Direct `account:signup` IPC invocation.
     - **Continue with Google:** PKCE loopback listener on `127.0.0.1:4180/auth/callback` handles tokens cleanly without exposing secrets.
     - **Existing User Login:** Instant authentication with immediate session establishment.

---

### 2. AUTHENTICATION LIFECYCLE & SECURITY VERIFICATION

```
+-----------------------------------------------------------------------------------+
| STEP                    IPC CHANNEL / ENDPOINT         STATUS   VERIFICATION      |
+-----------------------------------------------------------------------------------+
| 1. In-App Signup        account:signup                 PASS     Creates User Record|
| 2. Google OAuth SSO     account:startGoogleOAuth       PASS     PKCE Flow Validated|
| 3. Login                account:login                  PASS     Returns JWT + User |
| 4. Session Persistence  account:getSession             PASS     Restores on Launch |
| 5. Entitlement Sync     account:getPlanLimits          PASS     Free/Trial/PRO Sync|
| 6. Logout               account:logout                 PASS     Wipes Local Session|
| 7. Switch Account       account:loginWithToken         PASS     Zero Cross-Leak    |
+-----------------------------------------------------------------------------------+
```

---

### 3. SESSION PERSISTENCE & LOCAL SQLITE STORAGE

- **Storage Location:** `%APPDATA%\mahi-browser\account_session.json` and SQLite `panel.db` (`sessions` table).
- **Session Tokens:** Signed JWT tokens stored with strict access controls; hardware identity (`HWID`) bound to prevent session hijacking across machines.
- **Restart Verification:**
  - Application restarted while logged in.
  - On initialization, `getAccountSession()` reads cached token and verifies against `/api/v1/auth/me`.
  - User lands directly on `Dashboard.tsx` with profile grid pre-loaded.
  - Zero redirection to login or download pages during valid sessions.

---

### 4. DATA ISOLATION & MULTI-USER SAFETY

- Logout completely purges `localStorage` auth tokens and wipes memory references.
- Switching accounts refreshes workspace profiles:
  - Account A profiles (`owner_id = 'user_A'`) are segregated from Account B (`owner_id = 'user_B'`).
  - No profile contamination, shared cookies, or credentials persist between distinct logins.
