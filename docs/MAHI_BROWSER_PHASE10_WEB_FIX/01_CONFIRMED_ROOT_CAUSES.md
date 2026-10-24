# MAHI BROWSER — PHASE 10
## 01. CONFIRMED ROOT CAUSES ANALYSIS
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** Root Causes Fully Identified & Verified with Technical Evidence  

---

### Executive Overview
During Phase 9 Master Audit, 6 discrepancies between the local source and live production web services were uncovered. This document presents the exact technical root causes for each issue prior to staging fixes.

---

### Deep-Dive Root Cause Matrix

#### 1. Authenticated Download Returning HTTP 404
- **Symptom:** Unauthenticated requests to `https://mahibrowser.com/download/setup` return HTTP 302 redirecting to signup. When an authenticated request is submitted with a valid token, the server responds with **HTTP 404 Not Found** (`<html><center>404 Not Found</center><hr><center>nginx</center></html>`).
- **Root Cause:**
  1. The physical installer executable `MAHI-Browser-Setup-1.1.1.exe` (282 MB) has not been uploaded to the production server filesystem.
  2. In `07_BACKEND/server/app.ts`, the handler calls `sendFile(res, info.setupPath, info.setupFileName)`.
  3. When `fs.existsSync(filePath)` evaluates to false, the server returns 404.
  4. In addition, `03_HARDWARE/distribution-service.ts` previously looked only in Windows desktop candidate paths (`Desktop/mahai brouser/release`), lacking support for server environment variables (`RELEASE_DIR`) or VPS directories (`/var/www/mahibrowser.com/release`).

#### 2. Route `/dashboard` Displaying the Public Landing Page
- **Symptom:** Navigating to `https://mahibrowser.com/dashboard` returns HTTP 200 with 99,646 bytes of `landing/index.html` (the marketing landing page) instead of an account or admin control center.
- **Root Cause:**
  1. The production Nginx server configuration employs a single-page application fallback directive:
     ```nginx
     location / {
         try_files $uri $uri/ /index.html;
     }
     ```
  2. Nginx does not proxy requests for `/dashboard` to the Node.js backend.
  3. In local source (`07_BACKEND/server/app.ts`), `/dashboard` was conflated with the internal admin console (`web-admin-html.ts`).

#### 3. Missing "Created by Munna Bhai" Branding on Live Download Page
- **Symptom:** Live `https://mahibrowser.com/download` lacks the creator attribution badge present in the local Windows desktop application.
- **Root Cause:**
  - Local `landing/download.html` line 550 added:
    ```html
    <p style="font-size: 0.875rem; color: #10b981; font-weight: 700; margin-top: -0.25rem; margin-bottom: 0.75rem;">Created by Munna Bhai</p>
    ```
  - This file had not been synchronized to the production web root (`/var/www/mahibrowser.com/download.html`).

#### 4. Outdated Version, Release Status & Package-Size Information
- **Symptom:** Live download page displays `Version: v1.1.1 (Stable)` and `Size: 78.4 MB`.
- **Root Cause:**
  - Production is serving an earlier revision of `download.html` drafted prior to bundling the complete Chromium 138 engine (which brought the package size to 282 MB) and prior to designating this release as Release Candidate 1 (RC1).

#### 5. Pricing Catalog API Returning HTTP 404
- **Symptom:** Client console on `https://mahibrowser.com/pricing` logs: `Failed to load resource: the server responded with a status of 404 ()` for `/api/v1/pricing/catalog`.
- **Root Cause:**
  - In production Nginx, only the authentication routes (`/api/v1/auth/*`) were reverse-proxied to the VPS backend.
  - The commercial catalog endpoint (`/api/v1/pricing/catalog`), while fully implemented in `commercial-api-router.ts`, was not exposed through Nginx.

#### 6. Platform `/api/v2/` Routes Returning HTTP 404
- **Symptom:** `https://mahibrowser.com/api/v2/health` and `/api/v2/distribution/info` return 404.
- **Root Cause:**
  - Production Nginx lacks a location block for `/api/v2/`, routing all requests to the static file fallback.
