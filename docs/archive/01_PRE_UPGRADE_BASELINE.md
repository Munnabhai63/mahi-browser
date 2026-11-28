# 01 — PRE-UPGRADE BASELINE & AUDIT

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Project:** MAHI Browser  

---

## 1. Existing Installed Application Baseline
- **Executable Location:** `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`
- **Previous Build Date:** October 9, 2026 05:51:18
- **Executable Size:** 188,784,128 bytes
- **Existing Version:** v1.1.1 (pre-patch baseline)
- **Status:** Functional but lacked the Phase 17 Starter Template bug fixes (`starterProfiles:createFromTemplate` IPC wiring, `isDesktop: true` preload bridge flag, and dynamic template cards).

## 2. Authoritative Source Repository Baseline
- **Location:** `C:\Users\munaf\Desktop\mahai brouser`
- **Git Branch:** `feature/phase11-android-mobile`
- **Head Commit:** `5e4d460 fix(network): forensic network connectivity audit and no-proxy contract fix`
- **Branding:** "By Munna Bhai" (`brand-config.ts`, `package.json`, `electron-builder.json`)
- **Starter Templates:** 6 complete blueprint templates in `02_BROWSER/services/starter-profiles-service.ts`.

## 3. Verified Test Build Reference
- **Isolated Location:** `C:\Users\munaf\Desktop\MAHI_BROWSER_DESKTOP_TEST\build\win-unpacked\MAHI Browser.exe`
- **Verification Result:** 100% pass across all six Starter Templates, SQLite schema creation, and restart persistence.

## 4. User Data Storage Discovery
- **Runtime UserData:** `C:\Users\munaf\AppData\Roaming\mahi-browser`
- **Database:** `mahi_browser.sqlite` (1,142,784 bytes, intact)
- **Master Encryption Key:** `.mahi_master.key` (64 bytes, intact)
- **Existing User Profiles:** 289 profiles located in `profiles/`
- **License / Credential Files:** `claimed-licenses.json`, `install-secrets.json`, `offline-license.key`

## 5. Pre-Upgrade Process Audit
- Confirmed all MAHI Browser and Chromium background processes safely stopped before performing backup or upgrade operations.
