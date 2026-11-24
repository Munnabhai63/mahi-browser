# MAHI BROWSER TARGET SPECIFICATION — 100% GOLOGIN ARCHITECTURAL & UI/UX PARITY BLUEPRINT

> **Document Name:** `MAHI_BROWSER_TARGET.md`  
> **Repository:** `Munnabhai63/mahi-browser`  
> **Role:** Exact Master Execution Spec for Next AI Agent / Senior Engineering Model  
> **Target Baseline:** 100% Feature, Architectural, Language, and UI/UX Parity with GoLogin Commercial Enterprise Platform  
> **Status:** Active Execution Directive  

---

## 1. THE NORTH STAR: WHAT WE ARE BUILDING

The objective of this repository is to transform **MAHI Browser** into a **100% production-identical counterpart to GoLogin**, matching its exact technology stack, programming languages, cloud architecture, deep-link authentication, anti-detect stealth engine, and pixel-perfect UI/UX micro-interactions.

Every single layer—from the public landing page, SEO documentation, and one-click Google OAuth desktop handoff to the encrypted Cloudflare R2 profile sync, distributed Redis locks, and stealth Chromium (MV3 main-world injection + rebrowser-patches flags; native C++ engine available as an optional build) and Camoufox—must behave with commercial perfection.

```mermaid
flowchart TD
    subgraph Funnel["1. Public Web Funnel & Docs"]
        LP["Landing Site & Pricing (Next.js 14 App Router)"]
        Docs["MDX Documentation & Knowledge Base (/docs)"]
        Blog["Dynamic MDX SEO Blog (/blog)"]
    end

    subgraph AuthLayer["2. Unified Auth & 1-Click SSO Handoff"]
        WebAuth["Web Auth (Google OAuth 2.0 / JWT)"]
        DeepLink["Custom Protocol Handoff (mahibrowser://auth-callback?token=...)"]
        DeskAuth["Desktop Client Auto-Unlock (Zero Typing)"]
    end

    subgraph DesktopClient["3. Desktop App & UI/UX (Electron + React 18)"]
        ProfilesUI["Profile Management, Tagging & Mass Actions"]
        ProxyUI["Multi-Protocol Proxy Pool & Mobile Rotator"]
        DiagUI["Diagnostics & Live Canvas/WebGL CreepJS Audit"]
        RPAUI["Visual Drag-and-Drop RPA Bot Builder"]
    end

    subgraph CloudInfra["4. Cloud Infrastructure & Storage"]
        CentralAPI["Central API Gateway (Node.js 22 / Fastify / TypeScript)"]
        CentralDB[("Hosted PostgreSQL / Supabase (Metadata & Fingerprints)")]
        RedisLock[("Distributed Redis Mutex (lock:profile:{id})")]
        R2Storage[("Cloudflare R2 Object Storage (Zero-Egress Session Archives)")]
    end

    subgraph StealthEngine["5. Anti-Detect Engine Subsystem"]
        ChromiumLauncher["Custom Chromium 138 + rebrowser-patches (Zero CDP Leaks)"]
        BrowserForgeModule["BrowserForge Statistical Real-Device Fingerprint Model"]
        CamoufoxModule["Camoufox C++ Engine (Firefox Multi-Engine Advantage)"]
    end

    LP & Docs & Blog --> WebAuth
    WebAuth -->|1-Click Browser Login| DeepLink --> DeskAuth
    DeskAuth --> DesktopClient
    DesktopClient <-->|REST + WebSockets| CentralAPI
    CentralAPI --> CentralDB
    CentralAPI --> RedisLock
    DesktopClient -->|Pre-signed PUT/GET| R2Storage
    DesktopClient --> ChromiumLauncher & CamoufoxModule
    BrowserForgeModule -.->|Inject Correlated HW Profile| ChromiumLauncher
```

---

## 2. EXACT PROGRAMMING LANGUAGE & FRAMEWORK MATRIX

To eliminate all discrepancies with GoLogin, each subsystem must strictly use the designated production technology:

| Subsystem | Exact Target Stack | Target Directory in Repo | Purpose |
| :--- | :--- | :--- | :--- |
| **Landing, Docs & Blog** | **Next.js 14 (App Router), TypeScript, TailwindCSS, MDX, Contentlayer** | `landing/` (Upgrade to Next.js project) | SEO indexation, dynamic pricing, documentation portal, and blog engine. |
| **Web Cloud Dashboard** | **React 18, TypeScript, Vite 6, TailwindCSS, Zustand** | `01_UI/web/` | Online portal for cloud profile management, devices, and workspaces. |
| **Desktop App Client** | **Electron, React 18, TypeScript, Vite 6, TailwindCSS, Lucide** | `01_UI/` & `10_CONFIG/preload/` | Desktop anti-detect control center matching GoLogin's exact UI design. |
| **Desktop Main Process** | **Node.js 22 LTS, TypeScript, Electron IPC** | `07_BACKEND/` | Desktop engine lifecycle, proxy binding, and local storage management. |
| **SSO Desktop Protocol** | **Electron `app.setAsDefaultProtocolClient('mahibrowser')`** | `07_BACKEND/index.ts` & `07_BACKEND/commercial/google-oauth-service.ts` | 1-Click browser-to-desktop Google OAuth handoff (`mahibrowser://`). |
| **Cloud Backend Gateway** | **Node.js (TypeScript), Fastify/Express** | `07_BACKEND/commercial/remote-api-router.ts` | Central REST API & WebSocket server for multi-tenant users. |
| **Central Database** | **PostgreSQL (Supabase or Hosted Postgres), Prisma** | Migration from `06_DATABASE/schema.ts` | Relational store for users, profile metadata, workspaces, and audit logs. |
| **Session Object Storage**| **Cloudflare R2 (S3-Compatible API), AWS SDK v3** | `08_SECURITY/storage-provider.ts` | Storing compressed encrypted profile cookies/storage with zero bandwidth fees. |
| **Concurrency Locks** | **Redis (`ioredis`), Upstash Serverless Redis** | `07_BACKEND/commercial/commercial-api-router.ts` | Distributed mutex locks preventing multi-device profile corruption. |
| **Anti-Detect Engine** | **Chromium 138 (MV3 Main-World JS + rebrowser flags; native C++ optional) + Camoufox** | `02_BROWSER/` & `F:\UserData\Downloads\ai-power-tools\` | Hardware, Canvas, WebGL, AudioContext, and CDP leak-free browser execution. |

---

## 3. UI/UX DESIGN SPECIFICATION & SENSITIVE DETAILS

GoLogin's UI/UX feels expensive, polished, fast, and frictionless. The next model must enforce these exact design standards across the entire application:

### A. Color Palette & Typography
- **Dark Elements:** Slate-900 (`#0F172A`) navigation bars, Slate-950 (`#020617`) contrast surfaces, Slate-800 borders (`#1E293B`).
- **Brand Accent:** Emerald-600 (`#059669`), Emerald-500 (`#10B981`), Emerald-50 ambient glows (`rgba(16, 185, 129, 0.1)`).
- **Light Theme Background:** Slate-50 (`#F8FAFC`), crisp white cards (`#FFFFFF`), subtle Slate-200 borders (`#E2E8F0`).
- **Typography:**
  - Primary UI: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif`.
  - Monospace (Ports, IDs, HWIDs, Tokens): `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.

### B. Micro-Interactions & State Discipline
Every interactive element across Desktop and Web must support all 5 UI states:
1. **Normal State:** Clean typography, subtle borders, high-contrast readable text.
2. **Hover State:** Smooth `150ms ease-in-out` background transition, subtle shadow elevation.
3. **Active/Pressed State:** `transform active:scale-[0.98]`.
4. **Loading/Async State:** Skeleton loaders for tables; spinner with disabled pointer events for buttons.
5. **Disabled State:** Opacity `0.5`, `cursor-not-allowed`, no click events.

### C. Specific GoLogin UX Patterns to Enforce
- **Profile Status Pills:**
  - `READY`: Neutral gray border, subtle green dot.
  - `STARTING`: Amber spinning circle with "Launching...".
  - `RUNNING`: Solid emerald background, white bold text, pulsing green dot, with an active "Stop" button.
  - `SYNCING`: Sky-blue icon with progress percentage (e.g. `Syncing 65%...`).
  - `LOCKED`: Rose-red pill showing `In use by [Device Name]`.
- **1-Click Smart Proxy Paste:**
  - In `ProxyConfigModal`, user can paste raw strings like `192.168.1.1:8080:username:password` or `socks5://user:pass@host:port` into a single input field. The modal automatically parses and populates Host, Port, Username, and Password fields instantly.
- **Instant Proxy Latency Ping:**
  - Shows real round-trip latency (e.g. `42ms` in green, `280ms` in amber, `Timeout` in red) next to the proxy before starting the profile.
- **Toast Notifications:**
  - Glassmorphic top-right notification stack auto-dismissing after 4 seconds with distinct colors for success (emerald), error (rose), and warning (amber).

---

## 4. 1-CLICK DEEP LINK GOOGLE SSO SPECIFICATION (`mahibrowser://`)

To match GoLogin's seamless login experience:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Web Browser (mahibrowser.com)
    participant Google as Google OAuth Server
    participant OS as Windows OS (Registry)
    participant Desktop as MAHI Desktop App (Electron)
    participant API as Central API (api.mahibrowser.com)

    User->>Browser: Clicks "Sign in with Google"
    Browser->>Google: Redirects to Google OAuth 2.0 Consent Screen
    User->>Google: Authorizes Account
    Google->>Browser: Returns Auth Code to Web Callback
    Browser->>API: Exchanges Code for JWT Session Token
    API-->>Browser: Issues Token & Generates Deep Link URL
    Browser->>OS: Opens mahibrowser://auth-callback?token=JWT_STRING
    OS->>Desktop: Focuses or Launches Desktop App with URI Arguments
    Desktop->>Desktop: Intercepts URI in app.on('second-instance')
    Desktop->>Desktop: Validates JWT & Stores in account_session_encrypted.json
    Desktop-->>User: Desktop App Instantly Unlocks with Profile Quota!
```

### Exact Code Implementation Directive for Desktop Main Process:
In `07_BACKEND/index.ts`:
```typescript
import path from 'node:path';
import { app } from 'electron';
import { handleDesktopAuthToken } from './commercial/commercial-auth-service.js';

const PROTOCOL_NAME = 'mahibrowser';

// 1. Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}

// 2. Windows Deep Link interceptor via second-instance
app.on('second-instance', (_event, commandLine) => {
  const uri = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://auth-callback`));
  if (uri) {
    try {
      const parsedUrl = new URL(uri);
      const token = parsedUrl.searchParams.get('token');
      if (token) {
        handleDesktopAuthToken(token);
      }
    } catch (err) {
      console.error('[DeepLink] Failed to parse auth URI:', err);
    }
  }
});
```

---

## 5. NEXT.JS 14 LANDING, BLOG & DOCUMENTATION SPECIFICATION

The current `landing/` directory must be migrated to a standalone or monorepo **Next.js 14 App Router** application:

### Route Structure:
- `/` — High-converting marketing landing page featuring interactive feature tours, animated pricing toggles, and live customer reviews.
- `/pricing` — Dynamic pricing matrix comparing Free (15 Profiles) vs Pro (100 Profiles) vs Enterprise custom plans.
- `/download` — Auto-detects user OS (Windows x64, macOS Apple Silicon/Intel, Linux) and delivers signed installer links.
- `/compare/gologin-alternative` — High-intent SEO comparison landing page targeting GoLogin users.
- `/docs/[[...slug]]` — Comprehensive documentation engine built with MDX:
  - Getting Started (Installation, First Profile)
  - Proxy Configuration (Residential, Mobile 4G/5G, Rotating)
  - Anti-Detect Fingerprinting (Canvas, WebGL, AudioContext, WebRTC)
  - Puppeteer & Playwright Automation API
  - Team Workspaces & Permissions
- `/blog/[slug]` — High-performance SEO blog with auto-generated open graph cards and Schema.org `Article` JSON-LD.

---

## 6. CLOUDFLARE R2 & ZERO-EGRESS CLOUD STORAGE SPECIFICATION

GoLogin stores compressed browser sessions in AWS S3. MAHI Browser uses **Cloudflare R2** via the existing `S3R2StorageProvider` ([`08_SECURITY/storage-provider.ts`](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/storage-provider.ts)):

### Why Cloudflare R2?
- 100% S3 API compatibility (`@aws-sdk/client-s3`).
- **\$0.00 Egress Fees:** Downloading 100GB of profile sessions per day costs zero bandwidth dollars (saving thousands of dollars compared to AWS S3).

### Required Environment Configuration:
```env
# Cloudflare R2 Configuration (S3 API Compatible)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=mahi-profiles-prod
R2_ENDPOINT=https://your_cloudflare_account_id.r2.cloudflarestorage.com
STORAGE_PROVIDER=s3-r2
```

### Profile Archive Rules:
1. **Exclude Bloat:** When creating `session.tar.gz`, exclude:
   - `Cache/`
   - `Code Cache/`
   - `GPUCache/`
   - `Crashpad/`
   - `Service Worker/CacheStorage/`
2. **Envelope Encryption:** Encrypt archive using AES-256-GCM before upload via `08_SECURITY/cloud-profile-crypto.ts`.
3. **Pre-signed Uploads:** Client requests pre-signed URL from API -> uploads directly to R2 bucket -> notifies server upon completion (`/api/v1/sync/finalize-upload`).

---

## 7. DISTRIBUTED CONCURRENCY LOCK (REDIS SPECIFICATION)

Prevent multi-device data corruption when team members access shared profiles:

```typescript
// Redis Distributed Mutex Pattern
const LOCK_TTL_SECONDS = 300; // 5 minutes

export async function acquireRedisProfileLock(profileId: string, deviceId: string, deviceName: string): Promise<LockResult> {
  const lockKey = `lock:profile:${profileId}`;
  const payload = JSON.stringify({ deviceId, deviceName, acquiredAt: Date.now() });

  // Atomic Set-If-Not-Exists with TTL
  const acquired = await redis.set(lockKey, payload, 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!acquired) {
    const existing = JSON.parse(await redis.get(lockKey) || '{}');
    return { success: false, lockedBy: existing.deviceName || 'Another Device' };
  }
  return { success: true };
}
```

---

## 8. INTEGRATING THE 9 ANTI-DETECT ENGINES FROM DRIVE F:

The next model must link and utilize the 9 repositories cloned on Drive `F:`:

1. **`rebrowser-patches` (`F:\UserData\Downloads\ai-power-tools\rebrowser-patches`):**
   - Patch `02_BROWSER/launcher.ts` launch flags to strip CDP `Runtime.evaluate` indicators so Cloudflare Turnstile, DataDome, and Kasada never detect automated browsing.
2. **`browserforge` (`F:\UserData\Downloads\ai-power-tools\browserforge`):**
   - Replace simple random seeds with statistical Bayesian models that generate mathematically authentic GPU, OS, Screen resolution, and Header distributions.
3. **`camoufox` (`F:\UserData\Downloads\ai-power-tools\camoufox`):**
   - Offer a dual-engine toggle in the UI: Chromium 138 (Orbita-style) OR Camoufox (C++ Patched Firefox). GoLogin has no Firefox engine; this makes MAHI superior.
4. **`creepjs` (`F:\UserData\Downloads\ai-power-tools\creepjs`):**
   - Embed CreepJS test assertions into `11_TESTS/` to automatically score fingerprint authenticity in CI.

---

## 9. STEP-BY-STEP IMPLEMENTATION ROADMAP FOR NEXT MODEL

The next model should execute the remaining work in these 5 sequential phases:

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Protocol SSO Handoff (mahibrowser:// Deep Link)    │
│  - Register default protocol client in Electron main        │
│  - Wire web Google OAuth callback to trigger desktop unlock │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ PHASE 2: Cloudflare R2 Cloud Storage Activation             │
│  - Activate S3R2StorageProvider with R2 bucket credentials  │
│  - Test upload & download of encrypted profile session blob │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ PHASE 3: PostgreSQL / Supabase Central DB Migration         │
│  - Mirror SQLite schema to hosted PostgreSQL                │
│  - Wire remote-api-router.ts to live cloud database         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ PHASE 4: Anti-Detect Hardening (rebrowser-patches & Forge)   │
│  - Inject rebrowser-patches CDP fixes into Chromium launcher│
│  - Connect BrowserForge for real fingerprint generation     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ PHASE 5: Next.js 14 Landing, Docs & Blog Portal             │
│  - Build Next.js App Router project in landing/             │
│  - Add MDX docs and deploy to Cloudflare / Vercel           │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. ACCEPTANCE CRITERIA FOR MODEL AUDIT

Before any task is considered complete, the implementing agent must verify:
- [ ] User can click "Sign in with Google" on the web landing page, and the desktop client automatically unlocks via `mahibrowser://` protocol without manual token entry.
- [ ] Profile created on Machine A automatically syncs its cookies/storage to Cloudflare R2 upon closing, and can be downloaded and opened on Machine B.
- [ ] Profile running on Machine A blocks Machine B from starting it, displaying an active lock badge.
- [ ] Profile passes CreepJS audit without detecting `navigator.webdriver` or CDP tampering.
- [ ] All existing automated tests (`npm run test:ci`) continue to pass with 0 regressions.

---
*Created on branch `antigravity-fixes` for Munaf. To be pushed to origin and verified.*
