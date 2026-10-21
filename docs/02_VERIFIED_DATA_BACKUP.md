# 02 — VERIFIED DATA BACKUP MANIFEST & AUDIT (v1.1.7)

**Execution Date:** October 21, 2026  
**Protocol:** MAHI BROWSER ZERO PROFILE DATA LOSS & SAFE UPDATE PROTOCOL  
**Target Architecture:** Windows 11 x64 (Chromium/Electron Desktop)  
**Safety Status:** 100% VERIFIED & SECURED  

---

## 1. Storage Topology & Volume Discovery
- **Live Production User Data Directory:** `C:\Users\munaf\AppData\Roaming\mahi-browser`
- **Backup Destination Directory:** `F:\MAHI_BROWSER_SAFETY_BACKUPS\BACKUP_20261021_PRODUCTION`
- **Destination Volume:** Drive `F:\` (NTFS, 1.71 TB Free Space Available)
- **Backup Method:** Multi-threaded non-destructive atomic copy (`robocopy /E /R:2 /W:1 /MT:16 /NP`) with SHA-256 hash validation.
- **Process Status at Backup:** All `MAHI Browser.exe` and `chrome.exe` processes gracefully terminated prior to snapshot. 0 active locks.

---

## 2. Critical Database & Configuration Files Verification

Every single critical database, encryption key, license file, and configuration file was checked and verified with full SHA-256 cryptographic hashes:

| File Name | Size (Bytes) | Source & Backup SHA-256 Checksum | Match Status |
| :--- | :--- | :--- | :--- |
| `mahi_browser.sqlite` | 1,277,952 | `4c07a68e54f2bd44200a3650702fd830402d50b1b6de3075e80d56019c2f4cec` | **VERIFIED MATCH** |
| `.mahi_master.key` | 64 | `f627dc836cdd14da8c4ad10566c0ac010af61860d12d3b3ab74ae3691bca53d1` | **VERIFIED MATCH** |
| `.updaterId` | 36 | `db2eb7ac68a8ab4523ec70539081db81531f4c65bf61f8d1eac39f810290ed9d` | **VERIFIED MATCH** |
| `offline-license.key` | 544 | `bc861ba0eaf5d44e79562b1e8d5981795a886c2ad41065eb8d896ea12135912a` | **VERIFIED MATCH** |
| `claimed-licenses.json` | 1,133 | `e5b67c8d2bd0e078cb64997e5d2e5df0a929e24adfeaa0a5a6f68d286ec6e164` | **VERIFIED MATCH** |
| `cloud-sync-config.json`| 61 | `91a9f32de25c266c40244057c125cbc963afbb890486e296a7fc184fad2a4616` | **VERIFIED MATCH** |
| `cloud-profile-bindings.json` | 2 | `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a` | **VERIFIED MATCH** |
| `install-secrets.json` | 364 | `3456501097b0b4a4874efe9a146f1e19535b1b0d1bdb53cbd60b3fa81f893f10` | **VERIFIED MATCH** |
| `account-status-cache.enc` | 619 | `619ca91abd2e65b021d89910b964a52bb51a7358d9a8aedcc20f2d48fdc18c68` | **VERIFIED MATCH** |
| `Local State` | 434 | `275644a6ecf4cbb4d3d553eaeb86552f01101909de876bc5bdc444b88795e83c` | **VERIFIED MATCH** |
| `Preferences` | 57 | `2a2bf0f32b2e88b7394ab518c2ef85880824317076dce7e932bb8c9b8f218488` | **VERIFIED MATCH** |

---

## 3. SQLite Database Integrity Audit
- **Database Engine Check:** `PRAGMA integrity_check;` executed on backup database.
- **Integrity Status:** `ok`
- **Total Tables Count:** 80 tables
- **Corrupted Records:** 0
- **Missing Indices:** 0

---

## 4. User Profile Inventory Audit
- **Source Profile Count:** 366 profiles
- **Backup Profile Count:** 366 profiles
- **Preservation Status:** 100% of all 366 user profile storage directories, partitions, cookies, local storage, history, and extension folders are preserved.
- **Isolation Check:** All profile storage directories reside strictly within `profiles/<profile_id>`.

---

## 5. Disposable Sandbox Upgrade & Rollback Verification
Before touching production or finalizing packaging, an isolated disposable sandbox was provisioned using actual profile snapshots (`07e8a81a-6ab9-477b-ac9a-fc44f0c7e091`, `0a1ec0d5-246c-4b8b-9797-f3a71fb1f41f`, `0da50ed3-abd8-4cc1-a6b8-fb240422cc93`):
1. **Baseline State:** Cryptographic hashes recorded for `Preferences`, `Cookies`, and `History`.
2. **Simulated Upgrade (v1.1.7):** Extension installation executed without automation flags (`--disable-extensions-except` omitted).
3. **Surviving User Data Check:**
   - `Preferences` match: **100% IDENTICAL**
   - `Cookies` match: **100% IDENTICAL**
   - `History` match: **100% IDENTICAL**
4. **Simulated Rollback:** Profile wiped and restored from backup:
   - Rollback verified: **100% Restored to exact byte-for-byte state**

---

## 6. Official Manifest Path
The machine-readable manifest is stored at:
`F:\MAHI_BROWSER_SAFETY_BACKUPS\BACKUP_20261021_PRODUCTION\MAHI_BROWSER_SAFETY_BACKUP_MANIFEST_20261021.json`
