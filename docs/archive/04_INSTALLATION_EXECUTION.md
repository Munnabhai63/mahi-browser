# 04 — CONTROLLED INSTALLATION EXECUTION LOG

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Action:** Silent NSIS In-Place Upgrade  
**Execution Status:** ✅ **COMPLETED SUCCESSFULLY (EXIT CODE 0)**

---

## 1. Owner Authorization & Confirmation Gate
- **Pre-Execution Check:** Verified 4,155 backed up files, SHA-256 installer hash, 0 running processes, and rollback readiness.
- **Interactive Gate:** Presented clear details and received explicit owner authorization before executing the upgrade.

## 2. Execution Command
```powershell
Start-Process -FilePath "C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe" -ArgumentList "/S" -Wait
```

## 3. Results & File Verification

| Path | File | Size | Modification Timestamp | Status |
| :--- | :--- | :--- | :--- | :--- |
| `AppData\Local\Programs\MAHI BROWSER` | `MAHI Browser.exe` | 188,875,264 bytes | 13-10-2026 10:05:48 | Upgraded |
| `AppData\Local\Programs\MAHI BROWSER\resources` | `app.asar` | 52,517,638 bytes | 13-10-2026 10:05:48 | Upgraded |
| `AppData\Local\Programs\MAHI BROWSER` | `Uninstall MAHI Browser.exe` | 285,473 bytes | 13-10-2026 10:05:52 | Upgraded |
| `AppData\Roaming\mahi-browser` | `mahi_browser.sqlite` | 1,142,784 bytes | Untouched | Preserved |
| `AppData\Roaming\mahi-browser` | `.mahi_master.key` | 64 bytes | Untouched | Preserved |
| `AppData\Roaming\mahi-browser\profiles` | 289 Profile Directories | 13.2 GB | Untouched | Preserved |

## 4. Post-Install Non-Destructive Integrity
The NSIS installer executed an in-place upgrade targeting exclusively the binaries directory (`%LOCALAPPDATA%\Programs\MAHI BROWSER\`). Zero files in `%APPDATA%\mahi-browser` were altered or deleted.
