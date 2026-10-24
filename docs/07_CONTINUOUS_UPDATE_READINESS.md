# 07 — CONTINUOUS UPDATE READINESS & FUTURE RELEASE ARCHITECTURE

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Product:** MAHI Browser Auto-Updater  

---

## 1. Updater Subsystem Inspection
The application updater subsystem is implemented in `07_BACKEND/services/updater-service.ts` using `electron-updater` with the following production architecture:

- **Feed Provider:** Generic HTTP/HTTPS provider targeting `https://mahibrowser.com/update/`
- **Channel Routing:** Supports `latest` (stable production) and `beta` (pre-release)
- **Manifest Architecture:** Electron-updater standard `latest.yml` containing:
  - `version`: Target semantic version (SemVer)
  - `files`: Executable name, SHA-512 hashes, blockmap metadata
  - `releaseDate`: ISO timestamp
- **Download Integrity:** SHA-512 cryptographic verification enforced before staging
- **Safety Pre-Check on Restart:** Calls `PRAGMA wal_checkpoint(FULL);` on SQLite before calling `autoUpdater.quitAndInstall()`, preventing database corruption during application updates.

## 2. Standardized Future Update Lifecycle
For any future incremental version or bug fix, adhere strictly to the following 9-stage pipeline:

```
[1. FIX]            Surgical code modification in authorized source
       ↓
[2. TEST]           Automated test suite (TypeScript + Vitest + Playwright)
       ↓
[3. BUILD]          Build unpacked app and NSIS setup in isolated staging directory
       ↓
[4. SIGN]           Authenticode binary signing with official certificate
       ↓
[5. STAGE]          Generate release manifest (latest.yml, latest.json, SHA-512)
       ↓
[6. VERIFY]         Install & launch in isolated sandbox; verify bit-for-bit integrity
       ↓
[7. APPROVAL]       Explicit Owner confirmation gate
       ↓
[8. RELEASE]        Synchronize files to update server (https://mahibrowser.com/update/)
       ↓
[9. MONITOR]        Observe crash reports and client telemetry
```

## 3. Public Update Policy
- Public automatic updates remain deactivated until authorized by the product owner.
- The local installation does not poll unapproved development feeds.
