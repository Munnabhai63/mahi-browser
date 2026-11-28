# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 01: Full Machine & Workspace Artifact Inventory

**Date:** October 14, 2026  
**Host Environment:** Windows 10/11 x64  
**Workspace Root:** `C:\Users\munaf\Desktop\mahai brouser`  
**Archive Root:** `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE`  
**Installed Application Path:** `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER`  
**User Data Directory:** `C:\Users\munaf\AppData\Roaming\mahi-browser`

---

### 1. Executive Summary

A forensic inventory was conducted across the local machine to discover all executables, build directories, test artifacts, runtime databases, installer packages, and archive stores. The goal is to establish **one authoritative development source repository**, **one verified public release installer**, **one last-known-good rollback release**, and safely catalog all obsolete development artifacts for quarantine and owner-approved cleanup.

---

### 2. Primary Location Inventory Table

| Component | Filesystem Path | Size / Count | Classification | State & Dependency |
|---|---|---|---|---|
| **Authoritative Source Repository** | `C:\Users\munaf\Desktop\mahai brouser` | Full Git Repo | **ACTIVE & PROTECTED** | Primary source code, all development, tests, configurations |
| **Installed Desktop App** | `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER` | ~190 MB | **ACTIVE & PROTECTED** | Active installed application executable & runtime |
| **Real User Data & SQLite** | `C:\Users\munaf\AppData\Roaming\mahi-browser` | ~8 MB | **ACTIVE & PROTECTED** | Real master key, SQLite DB, local profiles, DPAPI keys |
| **Authoritative Release Output** | `C:\Users\munaf\Desktop\mahai brouser\release` | ~2.1 GB | **RECOVERY & ACTIVE** | Contains v1.1.2 public release and v1.1.1 rollback installers |
| **Compiled Frontend Bundle** | `C:\Users\munaf\Desktop\mahai brouser\dist` | ~3.8 MB | **ACTIVE** | Vite production renderer bundle |
| **Compiled Electron Bundle** | `C:\Users\munaf\Desktop\mahai brouser\dist-electron` | ~2.8 MB | **ACTIVE** | Main process and validated CJS preload bundle |
| **Old Recovery Extract (Terabox)**| `C:\Users\munaf\Desktop\mahai brouser\Mahi terabox` | 4,690 MB | **OBSOLETE CANDIDATE** | Superseded recovery files including duplicate node_modules |
| **Old Preview Build Folder** | `C:\Users\munaf\Desktop\mahai brouser\release-preview` | 986 MB | **OBSOLETE CANDIDATE** | Unpacked test directory from previous manual test run |
| **Old Candidate Build Folder** | `C:\Users\munaf\Desktop\mahai brouser\release-candidate` | 1,550 MB | **OBSOLETE CANDIDATE** | Superseded v1.1.1 test packaging output |
| **Duplicate v1.1.2 Folder** | `C:\Users\munaf\Desktop\mahai brouser\release-v1.1.2` | 564 MB | **OBSOLETE CANDIDATE** | Redundant copy of release\MAHI-Browser-Setup-1.1.2.exe |
| **Test Database Artifacts** | `C:\Users\munaf\Desktop\mahai brouser\.test_data` | ~2 MB | **ARCHIVED** | Test run sqlite files moved to archive/Test_Artifacts |
| **Central Archive** | `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE` | Multi-GB | **RECOVERY & HISTORIC** | Long-term backup, release history, and quarantine vault |

---

### 3. Executable Binaries & Cryptographic Hashes

| Artifact File | Location | Size | SHA-256 Checksum | Classification |
|---|---|---|---|---|
| `MAHI-Browser-Setup-1.1.2.exe` | `release\` | 295,625,993 bytes | `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1` | **Current Public Release** |
| `MAHI-Browser-Portable-1.1.2.exe` | `release\` | 295,165,737 bytes | `36788bcb18b21aae55e56d3710be6f0c3417b76f087daeecc85625b33bd1e8e4` | **Current Portable Release** |
| `MAHI-Browser-Setup-1.1.1.exe` | `release\` | 295,652,572 bytes | `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa` | **Rollback Baseline Release** |
| `MAHI-Browser-Portable-1.1.1.exe` | `release\` | 295,192,239 bytes | `ad5a79366564a65fdf7123a0ee3a1f699000e74b467319aa48064c30960a99fa` | **Rollback Portable Baseline** |
| `MAHI Browser.exe` | `AppData\Local\Programs\MAHI BROWSER\` | 188,875,264 bytes | Runtime binary | **Installed User App** |

---

### 4. Running Process Audit

- Checked system process table via PowerShell and Node.js.
- Active instances of MAHI Browser: **0 active lingering test processes** at audit completion.
- No locking processes holding files in the project workspace or archive.
