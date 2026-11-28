# MAHI BROWSER — DESKTOP CLEANUP & CONSOLIDATION
## REPORT 01: COMPLETE DESKTOP INVENTORY

**Project:** MAHI Browser  
**Host System:** Windows 11  
**Scanned Location:** `C:\Users\munaf\Desktop`  
**Scan Timestamp:** October 13, 2026 — 11:55:00 IST  
**Auditor:** Antigravity Autonomous Systems Orchestrator  

---

### 1. Executive Summary

A comprehensive file system scan of the Windows Desktop was performed prior to any movement or consolidation.

- **Total Desktop Items Found:** 83
- **Total Desktop Footprint:** 27.09 GB (29,088,892,106 bytes)
- **Total Files Scanned:** 345,185 files across 33 directories and 50 root files

---

### 2. Comprehensive Inventory Classification Table

Each item on the Desktop was inspected, measured, and classified into one of four operational categories:
- **PROTECTED — DO NOT TOUCH:** Core application source, active profiles, user personal files/shortcuts.
- **ACTIVE — REQUIRED:** Active desktop launchers, batch scripts, or running processes.
- **ARCHIVE — KEEP OUTSIDE DESKTOP:** Completed audit phases, verified historical backups, old build artifacts, installers.
- **TEMPORARY — SAFE CLEANUP CANDIDATE / QUARANTINE:** Redundant logs, disposable build test outputs (subject to owner approval).

| Item Name | Type | Size (MB) | File Count | Operational Relationship | Classification | Action Taken |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| `mahai brouser` | Dir | 22,037.91 | 292,450 | Primary Authoritative Source Code & `Mahi terabox` Admin Panel | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_DESKTOP_TEST` | Dir | 1,681.55 | 918 | Test build containing 4 active running `MAHI Browser.exe` processes (PIDs 23876, 30440, 31000, 33740) | **ACTIVE — REQUIRED** | Retained on Desktop (Active Lock) |
| `mahiskills` | Dir | 1,678.64 | 45,349 | Separate user project (MAHI SKILLS) | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_UPGRADE_INSTALLER` | Dir | 1,268.67 | 173 | Approved v1.1.1 RC1 installer (`295,644,799 bytes`) & build artifacts | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Release_History` |
| `Antigravity_Full_Backup` | Dir | 418.18 | 403 | IDE Full Backup | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `mahai brouser.zip` | File | 159.96 | 1 | Historical source archive (August 2026) | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Old_Builds` |
| `MAHI_BROWSER_PRE_UPGRADE_BACKUP_20261013` | Dir | 149.38 | 4,156 | Verified user-data backup before local desktop upgrade | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Verified_Backups` |
| `Old Firefox Data` | Dir | 73.70 | 745 | Personal browser profile data | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `Antigravity_Before_Update` | Dir | 73.00 | 283 | IDE Pre-update snapshot | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `Antigravity_Backup` | Dir | 70.29 | 298 | IDE Snapshot | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `mahai` | Dir | 41.99 | 282 | Discovered Chromium User Data directory (Cookies, History) | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `obs-studio` | Dir | 34.02 | 3 | Personal recording software config | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `vid iq` | Dir | 28.77 | 154 | Personal analytics data | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_PHASE9_WEB_AUDIT` | Dir | 5.34 | 33 | Phase 9 Forensic audit documentation | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `referral_accounts.txt` | File | 5.11 | 1 | User personal account data | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_SHAREABLE_SOURCE` | Dir | 3.41 | 317 | Shareable source code distribution | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Old_Builds` |
| `MAHI_BROWSER_SHAREABLE_SOURCE.zip` | File | 1.29 | 1 | Shareable source archive | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Old_Builds` |
| `MAHI_BROWSER_SAFE_BACKUP_20261013` | Dir | 1.10 | 11 | Verified safe database & master encryption key snapshot | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Verified_Backups` |
| `Camo Studio Installer.exe` | File | 1.06 | 1 | Personal utility installer | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `YOYO_SMM_Shortcuts_and_Assets` | Dir | 0.73 | 11 | Personal client assets | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_PHASE10_WEB_FIX` | Dir | 0.66 | 13 | Phase 10 Staging reports & fixes | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `Firefox.exe` | File | 0.37 | 1 | Personal browser executable | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_FINAL_LOCAL_UPGRADE` | Dir | 0.35 | 13 | Phase 8/Local upgrade execution reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `Chrome Profile Generator.exe` | File | 0.35 | 1 | Personal profile tool | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `hanumanchalisa-622234_l.jpg` | File | 0.28 | 1 | Personal image | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `changes.jsonl` | File | 0.25 | 1 | Local tracking data | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_PHASE2A_AUDIT` | Dir | 0.07 | 8 | Phase 2A audit reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE12_PRODUCTION_DEPLOYMENT` | Dir | 0.05 | 11 | Phase 12 deployment records | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE4_RELEASE_CANDIDATE` | Dir | 0.05 | 10 | Phase 4 release reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE11_PRODUCTION_SAFETY` | Dir | 0.05 | 8 | Phase 11 safety gate reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE1_UX_AUDIT` | Dir | 0.04 | 7 | Phase 1 UX audit reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_READINESS_AUDIT` | Dir | 0.04 | 6 | Initial readiness audit reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE7_SIGNING_STAGING` | Dir | 0.04 | 10 | Phase 7 signing reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE5_PUBLIC_RELEASE_PREPARATION` | Dir | 0.04 | 10 | Phase 5 public preparation reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE6_PRELAUNCH` | Dir | 0.03 | 10 | Phase 6 prelaunch reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE2B_IMPLEMENTATION` | Dir | 0.03 | 10 | Phase 2B implementation reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `cooking for garna.txt` | File | 0.03 | 1 | Personal document | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_PHASE3_RELEASE_READINESS` | Dir | 0.02 | 10 | Phase 3 readiness reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `New Text Document.txt` | File | 0.02 | 1 | Personal document | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI_BROWSER_PHASE8_PRELAUNCH` | Dir | 0.01 | 4 | Phase 8 prelaunch reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_PHASE8_LOCAL_ACTIVATION` | Dir | 0.01 | 8 | Phase 8 activation reports | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `MAHI_BROWSER_TEMPLATE_CREATION_BUG_REPORT.md` | File | 0.01 | 1 | Template creation bug documentation | **ARCHIVE — OUTSIDE DESKTOP** | Relocated to `Reports` |
| `mahi-keygen` | Dir | 0.01 | 2 | Licensing keygen tool (`keygen.cjs`) | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
| `MAHI Browser.lnk` | File | <0.01 | 1 | Primary Desktop shortcut to installed app | **ACTIVE — REQUIRED** | Retained on Desktop |
| `Mahi Admin Panel.lnk` | File | <0.01 | 1 | Primary Desktop shortcut to Admin Panel | **ACTIVE — REQUIRED** | Retained on Desktop |
| `Mahi Admin Panel.bat` | File | <0.01 | 1 | Batch launcher for Admin Panel (`Mahi terabox`) | **ACTIVE — REQUIRED** | Retained on Desktop |
| `Mahi Student Dashboard.lnk` | File | <0.01 | 1 | Shortcut to Student Dashboard | **ACTIVE — REQUIRED** | Retained on Desktop |
| `Mahi Student Dashboard.bat` | File | <0.01 | 1 | Batch launcher for Student Dashboard | **ACTIVE — REQUIRED** | Retained on Desktop |
| `MAHI Super Admin Console.lnk`| File | <0.01 | 1 | Shortcut to Super Admin Console | **ACTIVE — REQUIRED** | Retained on Desktop |
| `MAHI Web Admin.lnk` | File | <0.01 | 1 | Shortcut to Web Admin Console | **ACTIVE — REQUIRED** | Retained on Desktop |
| `MAHI Browser - TEST.lnk` | File | <0.01 | 1 | Shortcut to Desktop Test Build | **ACTIVE — REQUIRED** | Retained on Desktop |
| *(All other personal shortcuts/files)* | Files | <0.01 | ~30 | Discord, Telegram, WhatsApp, Filmora, Chrome, etc. | **PROTECTED — DO NOT TOUCH** | Retained on Desktop |
