# MAHI BROWSER — P1 PRODUCTION BUG FIX
## Report 03: Corrected Source Changes & Entitlement Test Matrix

**Date:** October 14, 2026  

---

### 1. Corrected Source Changes

1. **`10_CONFIG/preload/preload.cjs`:**
   - Fixed missing syntax closing brace `},` in `onEngineDownloadProgress`.
   - Restored matching Cloud Profile Sync signatures from `index.ts`.
2. **`12_SCRIPTS/fix-preload.cjs`:**
   - Added automated syntax check `execSync('node -c ' + src)` before copying to build output. Build will abort if any syntax error exists.
3. **`07_BACKEND/api/local-api-server.ts`:**
   - Modified `checkMutatingAuth` to honor desktop session tokens.
   - Added `POST /profiles` endpoint using `CreateProfileDTOSchema` and plan limit checks `assertCanCreateProfile(1)`.
4. **`02_BROWSER/services/starter-profiles-service.ts`:**
   - Added `os?: string;` property to `StarterProfileTemplate` interface.
5. **`01_UI/components/StarterProfilesSection.tsx`:**
   - Updated hardcoded executable path to canonical installed location.

---

### 2. Entitlement Test Matrix (Free / Trial / PRO)

| Tier | Profile Limit | Test Case | Expected Result | Actual Result |
| :--- | :--- | :--- | :--- | :--- |
| **Free Tier** | 3 profiles | Create Profile 1-3 | Created successfully | **PASS** |
| **Free Tier** | 3 profiles | Create Profile 4 | Rejected: Limit reached (Upgrade Required) | **PASS** |
| **Trial Tier** | 10 profiles | Create Profile 1-10 | Created successfully | **PASS** |
| **PRO Tier** | 100 profiles | Bulk Profile Creation | Created successfully | **PASS** |

---

### 3. Security Regression Results

- Unauthorized mutating calls without an active desktop session or valid API key continue to be rejected with HTTP 401.
- Loopback listener prevents external non-localhost origins from submitting data.
- SQLite parameterized queries prevent SQL injection across all profile fields.
