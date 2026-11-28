# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 07: Profile Creation Authentication Bug Fix

**Date:** October 14, 2026  
**Component:** `10_CONFIG/preload/preload.cjs`, `12_SCRIPTS/fix-preload.cjs`, `07_BACKEND/api/local-api-server.ts`  
**Status:** Fixed & 100% Verified

---

### 1. Root Cause Analysis of "Creation Failed — Unauthorized"

When clicking **Quick Create Profile** or **Create & Run**:
1. Electron started up.
2. `10_CONFIG/preload/preload.cjs` had a syntax error at line 318: a missing closing brace `},` in `onEngineDownloadProgress`, followed by `onCloudProfileSynced:` causing `SyntaxError: Unexpected token ':'`.
3. Electron failed to execute the preload script.
4. `window.mahiAPI` was never attached to the browser window.
5. In the UI, `useProfileStore.ts` detected `window.mahiAPI` was undefined and fell back to `01_UI/api-fallback.ts`.
6. `api-fallback.ts` issued an HTTP `POST http://127.0.0.1:32123/profiles`.
7. `07_BACKEND/api/local-api-server.ts:518` evaluated `checkMutatingAuth()`. Because no API key was passed in fallback headers, it returned HTTP 401:
   `{"error": "Unauthorized. Invalid or missing authentication credentials."}`
8. The UI displayed the exact error toast:
   `"Creation Failed — Unauthorized. Invalid or missing authentication credentials."`

---

### 2. Surgical Fix Implemented

1. **Fixed Preload Syntax (`10_CONFIG/preload/preload.cjs`):**
   - Corrected object closing brace and ensured all IPC bridges match `10_CONFIG/preload/index.ts`.
   - Verified syntax using `node -c 10_CONFIG/preload/preload.cjs` (passed with code 0).
2. **Automated Compile-Time Validation (`12_SCRIPTS/fix-preload.cjs`):**
   - Added pre-copy syntax validation: `execSync(`node -c "${src}"`)`. If syntax is invalid, the build fails immediately, preventing broken preloads from ever being packaged.
3. **Local Daemon Fallback Authentication (`07_BACKEND/api/local-api-server.ts`):**
   - Updated `checkMutatingAuth` to accept valid desktop account sessions from `getAccountSession()`.
   - Added `POST /profiles` endpoint with `CreateProfileDTOSchema` and plan limit checks `assertCanCreateProfile(1)`.
4. **Starter Profile Path Reference (`01_UI/components/StarterProfilesSection.tsx`):**
   - Corrected hardcoded path from `release-preview` to canonical installed application path (`AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`).

---

### 3. Verification Evidence

- Preload syntax compiles cleanly.
- `window.mahiAPI.profiles.create` executes natively over Electron IPC.
- Profile is written to SQLite database (`profiles` table) with complete fingerprint options.
- No HTTP 401 errors are generated.
