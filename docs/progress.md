# MAHI Browser — Development Progress

## Step 8: Multi-Tenant VPS Isolated Production Cutover (VPS 200.97.164.97)
- **Branch:** `feature/v2-enterprise-anti-detect` (synced to `main` at `b5bca1f`)
- **Status:** COMPLETED & 100% VERIFIED LIVE IN PRODUCTION
- **Live Infrastructure:**
  * **Marketing Portal & Blog:** `https://mahibrowser.com/` (Next.js 14 SSR/SSG, dark theme, semantic SEO/GEO, Schema.org JSON-LD, sitemap, robots)
  * **Web Cloud Dashboard:** `https://app.mahibrowser.com/` (Vite SPA Cloud Dashboard)
  * **Cloud Gateway API:** `https://api.mahibrowser.com/health` (Fastify Node 22, Supabase PostgreSQL, Redis Mutex, Cloudflare R2, Google OAuth)
  * **Web Admin Portal:** `https://admin.mahibrowser.com/` (Admin Panel reverse proxy)
  * **Direct Windows Downloads:** `https://mahibrowser.com/download/setup`, `/download/MAHI-Setup.exe`, `/download/portable` (~282 MB signed installers)
- **Verified Zero-Downtime Multi-Tenant VPS Coexistence:**
  * Zero interference with pre-existing services on VPS `200.97.164.97` (`desisexy.in`, `falcon-smm`, `m4k-cobalt-api`, `rumbletraffic.com`, `trafik-admin`, `trafik-user`, `ytcpm.com`, `ytcpm.tech`).
  * All 11 pre-existing PM2 apps maintained 47h+ continuous online uptime with 0 restarts.
  * System CPU: 4.2%, RAM usage: 31%.
  * MAHI Browser gateway bound strictly to `127.0.0.1:8989`, isolated Redis on `127.0.0.1:6380`.
  * Let's Encrypt SAN SSL certificate issued and auto-renewing for all 5 domains.
  * Supabase PostgreSQL (`aws-0-ap-south-1.pooler.supabase.com:5432`) connected with 6ms latency.
  * Cloudflare R2 storage bucket (`mahibrowser-profiles`) ready.
  * Google OAuth start route (`/api/v1/auth/google/start`) returns 302 redirect to Google OAuth consent.

## Step 7: Packaged Desktop App Hardening, Writable Paths & Backend Caveats Closure
- **Branch:** `antigravity-fixes`
- **Latest Commit:** `4e84374`
- **Status:** COMPLETED & VERIFIED

### What is Built & Verified:
1. **Centralized Writable Runtime Path Resolver (`07_BACKEND/utils/runtime-paths.ts`, `10_CONFIG/shared/runtime-paths.ts`):**
   - Eliminated all writes to read-only `process.cwd()` when `app.isPackaged === true`.
   - `getWritableUserDataDir()` routes to `MAHI_USER_DATA_DIR` -> `app.getPath('userData')` -> `%APPDATA%/mahi-browser` / `~/Library/Application Support/mahi-browser` / `~/.config/mahi-browser`.
   - `getBundledResourcePath()` and `getLandingBaseDir()` safely resolve assets from `process.resourcesPath`, app path, or repo roots.
   - Migrated `07_BACKEND/index.ts`, `07_BACKEND/services/updater-service.ts`, `02_BROWSER/managed-engine.ts`, `06_DATABASE/connection.ts`, `07_BACKEND/cloud-browser/control-plane.ts`, all `08_SECURITY/` modules (`account-service`, `cloud-sync-service`, `encryption`, `freemium-guard`, `install-secrets`, `license-status-service`, `price-service`, `storage-provider`), `02_BROWSER/services/archive-service.ts`, and `07_BACKEND/server/app.ts`.

2. **Packaging Configuration & Resource Staging:**
   - Added `{ "from": "landing", "to": "landing" }` to `extraResources` in `electron-builder.json`.
   - Retained `electron-updater` runtime in `app.asar` without exclusion.
   - Added pre-packaging staging script `12_SCRIPTS/stage-packaging-resources.cjs` integrated into `npm run build`.
   - Verified dry run `npx electron-builder --dir` and confirmed `win-unpacked/resources` contains `engines/`, `landing/`, `app.asar`, `sql-wasm.wasm`, `icon.ico`, `icon.png`, and `splash.html`.

3. **Step 3 Backend Caveat Closures:**
   - Strict single instance lock in `07_BACKEND/index.ts` (secondary instances yield immediately to prevent SQLite/port 32123 collisions, allowing `--smoke-test`).
   - Persistent SQLite `web_handoff_sessions` table (`06_DATABASE/schema.ts`, `07_BACKEND/commercial/commercial-api-router.ts`) with atomic single-use anti-replay consumption (`UPDATE ... SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?`) and automatic expired session pruning.
   - Subscription & trial entitlement sync (`07_BACKEND/commercial/commercial-entitlement-service.ts`) querying `status IN ('ACTIVE', 'TRIAL')` and automatically downgrading expired subscriptions/trials to `plan_free` with `status = 'EXPIRED'`.

4. **CI Release Workflow & Smoke Test Harness Hardening:**
   - Updated `.github/workflows/cross-platform-release.yml`: removed deprecated `macos-13`, added pre-stage packaging step, and set `if-no-files-found: error`.
   - Updated `12_SCRIPTS/smoke-test-packaged-app.cjs`: strictly fails in CI if packaged binary is missing. Verified packaged smoke test on `release/win-unpacked/MAHI Browser.exe` passes with exit code 0 (`[SMOKE_TEST_PASS]`).

5. **Test Suite:**
   - Created `11_TESTS/unit/step7-packaged-hardening.test.ts` (8/8 passed).
   - All 80 unit test files passed: **842 passed, 0 failed**.
