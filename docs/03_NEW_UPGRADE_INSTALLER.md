# 03 — NEW UPGRADE INSTALLER VERIFICATION REPORT

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Product Version:** v1.1.1 RC1  
**Build Tool:** electron-builder 26.15.3 / NSIS 3.0.4  

---

## 1. Upgrade Installer Artifact Details
- **Installer Path:** `C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe`
- **Installer Size:** 295,644,799 bytes (~282 MB)
- **Installer SHA-256:** `562f70075f6b5ed7b8bbf2ff270d7ff36ae45a53559c020c39429784ec62621f`
- **Blockmap:** `MAHI-Browser-Setup-1.1.1.exe.blockmap` (308,833 bytes)
- **Isolation Guarantee:** Built into a dedicated staging directory; the original `release\MAHI-Browser-Setup-1.1.1.exe` was completely preserved.

## 2. Bundled ASAR Inspection
- **ASAR Path:** `win-unpacked\resources\app.asar`
- **ASAR SHA-256:** `42a4191f6603480d1466d649c90e53b9c7e73b17427d98f5f5300bb651a2a5ab`
- **ASAR File Count:** 2,749 files
- **Preload Verification:**
  - `isDesktop: true` — VERIFIED
  - `getStarterTemplates()` IPC binding — VERIFIED
  - `createProfileFromStarter(templateId, options)` IPC binding — VERIFIED
- **Branding Verification:**
  - `package.json` author: `"Munna Bhai"` — VERIFIED
  - Renderer copyright banner: `"By Munna Bhai • v1.1.1 RC1"` — VERIFIED
  - Engine Provisioning: Managed Chromium 138.0.7204.0 — VERIFIED

## 3. NSIS Target Configuration
- `appId`: `com.mahibrowser.app`
- `productName`: `MAHI Browser`
- `perMachine`: `false` (Per-user install in `%LOCALAPPDATA%\Programs\MAHI BROWSER\`)
- `deleteAppDataOnUninstall`: `false` (Protects all real user data in `%APPDATA%\mahi-browser`)
- `createDesktopShortcut`: `true`
- `createStartMenuShortcut`: `true`
