# MAHI BROWSER

> **Professional Multi-Profile Browser Manager & Workspace Isolation Platform**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/mahi-browser)
[![Tests](https://img.shields.io/badge/tests-vitest_ci-success.svg)](https://github.com/mahi-browser)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.2-informational.svg)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🌟 Overview

**MAHI BROWSER** is a desktop application engineered from scratch to provide completely isolated browser environments for legitimate use cases:
- **Developer & QA Testing**: Validate web applications across different viewport resolutions, user agents, locales, and permissions.
- **Workspace Separation**: Run isolated browser sessions for multiple clients, companies, or personal accounts without session or cookie leakage.
- **Privacy Control**: Custom WebRTC routing policies, hardware acceleration toggling, and granular device permission control.
- **Workflow Automation**: Built-in visual automation engine powered by Playwright to script navigation, form filling, and automated screenshot captures.

---

## 🚀 Key Features

| Feature Area | Description |
| :--- | :--- |
| **Isolated Profiles** | Completely independent user data directories (`cookies`, `history`, `localStorage`, `sessionStorage`, `cache`, `extensions`). |
| **Real Browser Launching** | Spawns genuine Chrome, Edge, and Chromium instances with configured flags, viewports, proxies, and locales. |
| **Encrypted Proxy Manager** | Configure HTTP, HTTPS, and SOCKS5 proxies with live socket latency ping testing and AES-256-GCM encryption at rest. |
| **Browser Environment Matrix** | Consistent configuration for user agents, resolutions, device scale factors, timezones, and device permissions. |
| **Cookie & History Managers** | View, search, domain-filter, delete, import (JSON/Netscape), and export cookies with sensitive data protection. |
| **Extension Manager** | Install per-profile unpacked Chrome extensions with individual toggle controls and filesystem isolation. |
| **Profile Archiving (`.mahi-profile`)** | Export and import password-protected encrypted profile backups with pre-import schema validation and collision checks. |
| **Visual Automation Builder** | Drag-and-drop workflow designer supporting `OPEN_URL`, `CLICK`, `FILL`, `WAIT`, `SCREENSHOT`, `EXTRACT_TITLE`, and `NAVIGATE`. |
| **Local REST API** | Headless control via HTTP REST API (`http://127.0.0.1:32123`) secured with Bearer token authentication. |
| **Security & App Lock** | PIN lock security with PBKDF2 hashing, automatic log sanitization, and strict IPC schema validation. |

---

## 🛠️ Technology Stack

- **Desktop Framework**: Electron 33 (TypeScript, Context Isolation, Secure IPC)
- **Frontend Architecture**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **State Management**: Zustand
- **Database**: Local SQLite (`sql.js` WebAssembly engine with atomic writes and schema versioning)
- **Cryptography**: Node.js `node:crypto` (AES-256-GCM, PBKDF2-SHA256 with 100,000 iterations)
- **Browser Automation**: `rebrowser-playwright-core` (with opt-in ephemeral loopback CDP ports)
- **Validation**: Zod (typed runtime validation with forward-compatible schema preservation)
- **Testing**: Vitest (`npm run test:ci`) + Biome linter (`npm run lint`)

---

## 📦 Installation & Quick Start

### Prerequisites
- Node.js >= 20.0.0 (Node 22 or 24 recommended)
- npm >= 9.0.0
- Internet connection for initial managed engine download (~170MB, one-time)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mahi-browser/mahi-browser.git
cd mahi-browser
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```
This outputs both desktop/client entrypoints to `dist/index.html` and the Web Management Console SPA (`WebDashboardApp`) to `dist/app.html`.

---

## 🌐 Managed Browser Engine (Anti-Detect Architecture)

MAHI BROWSER uses a **dedicated, version-pinned Chromium engine ("Chrome for Testing")** downloaded directly from Google's official public CDN. It does not depend on the user's host Chrome or Edge installation.

### Key Benefits
- **Zero Fingerprint Drift**: Every profile on every machine runs on the exact same Chromium binary version, preventing OS browser update discrepancies from breaking stealth flags.
- **User-Agent Baseline Consistency**: Default Chrome-for-Testing metadata tracks `MANAGED_ENGINE_VERSION` (`158.0.8127.88` in [`10_CONFIG/engine-config.ts`](10_CONFIG/engine-config.ts)), while bundled offline installer builds ship Chromium snapshot `138.0.7204.0` unless compiled/updated.
- **Runtime Stealth Architecture**: Stock unbranded Chromium builds run with the JS stealth core (`stealth-core.js`, deterministic seeded canvas/audio/WebGL/fonts/screen/Client Hints & strict `disable_non_proxied_udp` WebRTC protection) unless a verified native binary with matching `mahi-engine.json` is explicitly provided.
- **Authenticated Proxies (HTTP / HTTPS / SOCKS5)**: Built-in local authenticating tunnel (`127.0.0.1`) bridges Chrome and Camoufox over authenticated HTTP/HTTPS/SOCKS5 proxies (RFC 1928/1929 with remote DNS `ATYP=0x03`).
- **Fail-Safe Integrity**: Binary downloads are validated against SHA-256 checksums and unpacked atomically.

### Engine Storage Location
- Path: `<userData>/engines/<VERSION>/...`
- Pre-flight check: Requires at least `600 MB` free disk space prior to download (`MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES`).

### Version Bump Procedure
To check or update the pinned Chrome for Testing engine version:
1. Run `node 12_SCRIPTS/engine-bump.cjs` to query Google's official `last-known-good-versions-with-downloads.json` manifest.
2. Run `node 12_SCRIPTS/engine-bump.cjs --apply` (with `--sha256=<hex>` after verifying the zip digest) or edit [`10_CONFIG/engine-config.ts`](10_CONFIG/engine-config.ts).
3. Rebuild and verify: `npm run lint && npm run typecheck && npm run test:ci && npm run build`.
4. Cleanup safety: `cleanOldEngineVersions()` preserves profile-referenced versions and keeps at least the 2 newest installed versions.

### Media Codec & DRM (Widevine) Status
- **Standard Video & Audio**: Supported natively (YouTube VP9/AV1/Opus/WebM).
- **DRM-Protected Streams (Widevine)**: Chrome for Testing official Google binaries **do not include proprietary Widevine CDM licenses** by Google policy. Streaming DRM media requiring Widevine Level 1/3 (such as Netflix, Amazon Prime Video, or Spotify Web Player) will not play protected streams out of the box in Chrome for Testing.

---

## 🖥️ Screen Directory

1. **Dashboard**: High-level telemetry, active browser counters, quick action launchers, and real-time audit feed.
2. **Profiles List**: Table & grid views with global search, folder filtering, tags, and actions (Run, Stop, Edit, Clone, Delete).
3. **Create Profile Wizard**: 5-step guided setup with live configuration preview and consistency generator.
4. **Profile Settings**: Tabbed fine-tuning (General, Browser, Privacy, Network, Permissions, Extensions, Storage).
5. **Browser Environment**: Simulator for user agent, display dimensions, locale, timezones, and WebRTC policy.
6. **Proxy Manager**: CRUD for HTTP/HTTPS/SOCKS5 endpoints with real-time socket latency pinging.
7. **Cookie Manager**: Per-profile cookie browser, Netscape/JSON importer/exporter, and domain search.
8. **History Manager**: Browsing log viewer with date filtering, domain sorting, and record clearing.
9. **Extension Manager**: Isolated Chrome extension loader for unpacked folders and manifest inspection.
10. **Automation Workflows**: List and runner for automated test pipelines.
11. **Workflow Builder**: Visual step-by-step automation designer.
12. **Import Profile**: Restores `.mahi-profile` encrypted archives with preview and integrity check.
13. **Export Profile**: Creates encrypted `.mahi-profile` archive backups with optional password.
14. **Application Settings**: Global theme, startup behavior, App Lock PIN, and REST API credentials.
15. **Activity Logs**: Audited stream of workspace lifecycle events with sanitized secrets.
16. **Help & About**: User documentation, keyboard shortcuts (`Ctrl+K`), and system diagnostics.

---

## 🔒 Responsible Use Policy

MAHI BROWSER is developed exclusively for legitimate development, testing, multi-session management, and privacy-focused workflows. It **does not** implement mechanisms intended to bypass bot detection, solve CAPTCHAs, or defeat website security systems.

---

## 📄 Documentation Links

- [Project Progress Log (`docs/progress.md`)](docs/progress.md)
- [Engineering Decisions Log (`docs/decisions.md`)](docs/decisions.md)
- [Custom C++ Patchset Guide (`14_ENGINE_PATCHES/chromium-138/README.md`)](14_ENGINE_PATCHES/chromium-138/README.md)
- [License (`LICENSE`)](LICENSE)

---

## ⚖️ License

MIT License © 2026 MAHI BROWSER Team.
