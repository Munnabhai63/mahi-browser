# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 01: Source Repository & Release Baseline

**Date:** October 14, 2026  
**Authoritative Source:** `C:\Users\munaf\Desktop\mahai brouser`  
**Git Branch:** `feature/phase11-android-mobile`  
**Git HEAD:** `389ca059e5aa5720041d36ab2f61ea6ff542a81a` (`389ca05`)  
**Installed Desktop Application:** `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`  
**Archive Root:** `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE`

---

### 1. Release Binaries Baseline

| Release Tier | Binary Path | File Size | SHA-256 Checksum | Purpose / Role |
| :--- | :--- | :--- | :--- | :--- |
| **Current Public Release** | `release\MAHI-Browser-Setup-1.1.2.exe` | 137,294,616 B | `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1` | Live public download served on website |
| **Rollback Release** | `release\MAHI-Browser-Setup-1.1.1.exe` | 136,897,296 B | `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa` | Last-known-good production rollback asset |
| **Historical Release** | `release\MAHI-Browser-Setup-1.1.0.exe` | 136,541,208 B | `cb78f35f29d107a688975871b6932a9ec67295ff625c1b50424a7704df7c87c2` | Archived initial commercial baseline |
| **Proposed Phase 15 Candidate** | To be versioned as `v1.1.3` | ~137 MB | Calculated post-package | Incorporates P1 bug fix & GoLogin flow |

---

### 2. Forensic Source Audit & Integrity Verification

1. **Preload Script (`10_CONFIG/preload/preload.cjs`):**
   - Verified clean syntax compilation with `node -c`.
   - Missing closing brace `},` in `onEngineDownloadProgress` repaired.
   - Restored GoLogin cloud profile sync and commercial account IPC bridges.
2. **Build Guard (`12_SCRIPTS/fix-preload.cjs`):**
   - Integrated automated syntax check before copying to `dist-electron/preload/index.cjs`. Build will halt if syntax errors exist.
3. **Local API Daemon (`07_BACKEND/api/local-api-server.ts`):**
   - Hardened `checkMutatingAuth` to validate active desktop account sessions (`getAccountSession()`).
   - Implemented `POST /profiles` schema validation and freemium quota checks.
4. **Session Persistence (`01_UI/stores/useAccountStore.ts`):**
   - Defaulted `rememberMe: true`.
   - Updated `partialize` to persist `currentUser` and `accountSession` across restarts.
5. **Starter Templates (`01_UI/components/StarterProfilesSection.tsx`):**
   - Corrected hardcoded path from `release-preview` to canonical installed application path.
