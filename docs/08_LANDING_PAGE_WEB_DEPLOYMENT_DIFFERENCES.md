# 08 — LANDING PAGE & WEB DEPLOYMENT DIFFERENCES REPORT

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Scope:** Desktop Electron vs. Local Landing Page vs. Online Website vs. Cloud Dashboard  

---

## 1. Subsystem Architecture Map

| Subsystem | Source Location | Deployment Target | Pipeline |
| :--- | :--- | :--- | :--- |
| **Desktop Application** | `01_UI/`, `07_BACKEND/`, `10_CONFIG/` | Local Windows Desktop (`Program Files` / `AppData`) | `electron-builder` / NSIS |
| **Local Landing Page** | `landing/` (`index.html`, `download.html`, etc.) | Static Web Root / Cloudflare Pages | Git / Web Server Sync |
| **Live Marketing Website** | `https://mahibrowser.com` | Production Web Host | Public CDN |
| **Cloud Web Dashboard** | `https://mahibrowser.com/dashboard` | Live Web Application Server | Cloud API & Dashboard Hosting |

## 2. Forensic Difference Audit
1. **Desktop vs. Web Independence:** The Electron desktop browser runs locally and accesses the SQLite database on disk (`%APPDATA%\mahi-browser`). The live cloud web dashboard (`https://mahibrowser.com/dashboard`) runs in the cloud and communicates via cloud API routes. Updating the desktop app does not modify the cloud web dashboard.
2. **Starter Templates Catalog:** The Starter Templates feature is a desktop-native capability embedded inside the Electron React bundle (`01_UI/components/StarterProfilesSection.tsx`) and backed by local SQLite profiles.
3. **Public Release Authorization:** The new v1.1.1 RC1 installer (`MAHI-Browser-Setup-1.1.1.exe`) has NOT been deployed to `https://mahibrowser.com/update/` or the live website download button. This adheres strictly to the rule: **PUBLIC RELEASE: STRICTLY NOT AUTHORIZED**.
4. **Website Differences:** Any local changes made to `landing/download.html` remain strictly within the local workspace repository and have not been pushed to production DNS, VPS, Cloudflare, or GitHub.

## 3. Recommended Future Web Deployment Workflow
When public release authorization is granted by the owner:
1. Verify signed installer binaries.
2. Upload setup installer and `latest.yml` to the update server (`/update/`).
3. Deploy updated `landing/` HTML assets to the web server.
4. Purge Cloudflare cache and perform live sanity testing.
