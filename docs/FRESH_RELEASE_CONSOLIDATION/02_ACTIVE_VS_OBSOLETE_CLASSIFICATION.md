# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 02: Active vs. Obsolete Asset Classification

**Date:** October 14, 2026  
**Policy Standard:** Four-Category Rigorous Lifecycle Isolation

---

### Category A: Real User Data — ALWAYS PRESERVED & PROTECTED

These assets contain real customer data, active profiles, and keys. They are NEVER altered, quarantined, or touched during cleanup:
1. `C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite`: Authoritative local SQLite profile database.
2. `C:\Users\munaf\AppData\Roaming\mahi-browser\.mahi_master.key`: AES-256 master hardware encryption key.
3. `C:\Users\munaf\AppData\Roaming\mahi-browser\account-session.enc`: DPAPI-encrypted user login session.
4. `C:\Users\munaf\AppData\Roaming\mahi-browser\account-status-cache.enc`: RSA-signed entitlement cache.
5. `C:\Users\munaf\AppData\Roaming\mahi-browser\offline-license.key`: Cryptographic license key file.
6. `C:\Users\munaf\AppData\Roaming\mahi-browser\claimed-licenses.json`: Claimed device licenses.

---

### Category B: Active Application Assets — PRESERVED & FUNCTIONAL

Core tools, engines, source code, and release tools required for continuous building, debugging, and running:
1. `C:\Users\munaf\Desktop\mahai brouser`: Authoritative Git source repository.
2. `C:\Users\munaf\Desktop\mahai brouser\.mahi_data\engines\138.0.7204.0\chrome-win\chrome.exe`: Production Chromium 138 engine.
3. `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`: Installed desktop application executable.
4. `C:\Users\munaf\Desktop\mahai brouser\dist` & `dist-electron`: Active compiled Vite & Electron builds.
5. `C:\Users\munaf\Desktop\mahai brouser\electron-builder.json`: Active packaging configuration.

---

### Category C: Recovery Assets — RETAINED UNTIL REPLACED

Rollback assets, release manifests, and verified snapshots:
1. `C:\Users\munaf\Desktop\mahai brouser\release\MAHI-Browser-Setup-1.1.2.exe`: Current public release installer.
2. `C:\Users\munaf\Desktop\mahai brouser\release\MAHI-Browser-Setup-1.1.1.exe`: Last-known-good rollback release installer.
3. `C:\Users\munaf\Desktop\mahai brouser\release\latest.yml`: Update manifest for auto-updater.
4. `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Backups\local_pre_upgrade_1.1.2`: Pre-upgrade system snapshot.
5. `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Release_History`: Central historic release vault.

---

### Category D: Obsolete Development Artifacts — CLEANUP / QUARANTINE CANDIDATES

Items that consume disk space, create version confusion, or represent superseded temporary testing outputs:
1. `C:\Users\munaf\Desktop\mahai brouser\release-candidate`: Superseded v1.1.1 build output (~1,550 MB).
2. `C:\Users\munaf\Desktop\mahai brouser\release-preview`: Superseded unpacked build output (~986 MB).
3. `C:\Users\munaf\Desktop\mahai brouser\release-v1.1.2`: Duplicate copy of release directory (~564 MB).
4. `C:\Users\munaf\Desktop\mahai brouser\Mahi terabox`: Old recovery extract with duplicate node_modules (~4,690 MB).
5. `C:\Users\munaf\Desktop\mahai brouser\.test_data`: Temporary sqlite databases from automated tests (~2 MB).
