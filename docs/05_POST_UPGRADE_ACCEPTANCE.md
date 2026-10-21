# 05 — POST-UPGRADE ACCEPTANCE & RUNTIME VERIFICATION (v1.1.7)

**Date:** October 21, 2026  
**Platform:** Windows 11 x64  
**Target:** MAHI Browser v1.1.7 Release Package  
**Status:** ✅ **100% PASSED — FULL ZERO DATA LOSS CRITERIA SATISFIED**

---

## 1. Extension System Verification
- **Issue Resolved:** Fixed `"Installation is not enabled [OK]"` error on Chrome Web Store pages (e.g., Urban VPN Proxy).
- **Culprit Switch Removed:** `--disable-extensions-except` eliminated from `02_BROWSER/launcher.ts`.
- **Preserved Flags:** `--load-extension` retained to ensure anti-detect stealth extensions and unpacked profile extensions load cleanly.
- **Modern CRX3 Protocol:** Upgraded `02_BROWSER/services/extension-service.ts` with verified CRX3 parameters (`os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&lang=en-US&acceptformat=crx2,crx3`).
- **Bidirectional Sync:** Chromium native installations inside `${storageDir}/Default/Extensions/` automatically discovered and synced to SQLite with localized manifest strings.
- **Selective Removal Safety:** `removeExtension` strictly validates paths to ensure parent `Default` or `Extensions` directories are never deleted.

---

## 2. Production User Data Preservation Audit
- **Database Connection:** Verified `mahi_browser.sqlite` (1,277,952 bytes, 80 tables, `PRAGMA integrity_check = ok`).
- **Total Production Profiles:** 366 profiles under `C:\Users\munaf\AppData\Roaming\mahi-browser\profiles` fully accounted for and protected.
- **Zero Profile Deletions / Resets:** Zero existing profiles were modified, recreated, or cleared.
- **Safety Backup:** Complete snapshot secured to `F:\MAHI_BROWSER_SAFETY_BACKUPS\BACKUP_20261021_PRODUCTION`.
- **Integrity Manifest:** SHA-256 verified manifest recorded at `F:\MAHI_BROWSER_SAFETY_BACKUPS\BACKUP_20261021_PRODUCTION\MAHI_BROWSER_SAFETY_BACKUP_MANIFEST_20261021.json`.

---

## 3. Packaging & Distribution Artifacts
- **Installer:** `release/MAHI-Browser-Setup-1.1.7.exe`
- **Portable:** `release/MAHI-Browser-Portable-1.1.7.exe`
- **Update Metadata:** `release/latest.yml` and `release/latest.json`
- **Installer Script Safety:** NSIS configured with `deleteAppDataOnUninstall: false` to ensure user profiles are never purged during upgrades or uninstalls.
