# MAHI BROWSER — P1 PRODUCTION BUG FIX
## Report 01: Forensic Root Cause Analysis & Architecture Traces

**Date:** October 14, 2026  
**Bug:** Quick Create Profile fails with: `"Creation Failed — Unauthorized. Invalid or missing authentication credentials."`  
**Severity:** P1 (Core Browser Functionality Blocked)

---

### 1. Root Cause Analysis

The reported error was triggered by a cascade starting with an undetected syntax error in Electron's preload script:

#### Source Locations:
1. **Primary Bug Location:** `10_CONFIG/preload/preload.cjs:318`
   - A missing closing brace `},` in the `onEngineDownloadProgress` handler left the subsequent method `onCloudProfileSynced:` unparseable, resulting in a fatal:
     `SyntaxError: Unexpected token ':'`
2. **Preload Execution Failure:**
   - Because of this syntax error, Electron aborted loading the preload script during window initialization.
   - The global bridge `window.mahiAPI` was never defined on `window`.
3. **UI Fallback Activation:**
   - In `01_UI/api-fallback.ts`, the UI detected `!window.mahiAPI` and routed the profile creation call to HTTP:
     `POST http://127.0.0.1:32123/profiles`
4. **Local Daemon Authentication Rejection:**
   - In `07_BACKEND/api/local-api-server.ts:518`, `checkMutatingAuth` inspected the request headers for an API key. Because internal fallback calls did not supply a bearer token, the daemon returned:
     `HTTP 401 Unauthorized: {"error": "Unauthorized. Invalid or missing authentication credentials."}`
5. **Toast Notification:**
   - `useProfileStore.ts` caught the 401 response and surfaced the toast:
     `"Creation Failed — Unauthorized. Invalid or missing authentication credentials."`

---

### 2. Website-to-Desktop Authentication Trace

```
[ Web Auth Callback ] ──(Issue Ticket)──> [ mahi:// callback or loopback ]
                                                      │
                                           [ Exchange Ticket for JWT ]
                                                      │
                                           [ Persist to useAccountStore ]
                                                      │
                                    ┌─────────────────┴─────────────────┐
                             (Native IPC)                        (Daemon Fallback)
                                    │                                   │
                      window.mahiAPI.profiles.create()          POST /profiles (Bearer Token)
                                    │                                   │
                                    └─────────────────┬─────────────────┘
                                                      │
                                            [ Profile Created ]
```

---

### 3. Quick Profile IPC/API Trace

- **Native Route (Fixed):**
  `QuickCreateModal.tsx` → `useProfileStore.createProfile()` → `window.mahiAPI.profiles.create(dto)` → Electron `ipcMain.handle('profiles:create')` → SQLite DB write.
- **Daemon Route (Hardened Fallback):**
  `api-fallback.ts` → `POST http://127.0.0.1:32123/profiles` → `checkMutatingAuth` (checks both API keys and active `getAccountSession()`) → `profileService.create()` → SQLite DB write.
