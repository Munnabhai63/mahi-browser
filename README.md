# MAHI BROWSER

> **Professional Multi-Profile Browser Manager & Workspace Isolation Platform**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/mahi-browser)
[![Tests](https://img.shields.io/badge/tests-25%2F25%20passing-success.svg)](https://github.com/mahi-browser)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.4-informational.svg)](https://www.electronjs.org/)
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
- **Database**: Local SQLite with automated migrations and WAL mode (`node:sqlite`)
- **Cryptography**: Node.js `node:crypto` (AES-256-GCM, PBKDF2 with 100,000 iterations)
- **Browser Automation**: Playwright Core
- **Validation**: Zod (100% typed runtime validation on all IPC and API payloads)
- **Testing**: Vitest test runner

---

## 📦 Installation & Quick Start

### Prerequisites
- Node.js >= 20.0.0 (Node 22 or 24 recommended)
- npm >= 9.0.0
- Google Chrome, Microsoft Edge, or Chromium installed on your OS

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

- [Architecture & Design (`ARCHITECTURE.md`)](ARCHITECTURE.md)
- [Security & Encryption Model (`SECURITY.md`)](SECURITY.md)
- [Testing & Quality Assurance Report (`TESTING.md`)](TESTING.md)
- [Local REST API Reference (`API.md`)](API.md)

---

## ⚖️ License

MIT License © 2026 MAHI BROWSER Team.
