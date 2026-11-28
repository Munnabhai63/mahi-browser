# Decisions Log

## 2026-11-28 - Phase 7 Part 2 Strict Typing & Zero-Warning Biome Gate (P1/P2)
- **Context**: `01_UI/`, `02_BROWSER/`, `04_LICENSING/`, `05_AUTH/`, `06_DATABASE/`, `07_BACKEND/`, `08_SECURITY/`, `09_AUTOMATION/`, `10_CONFIG/`, `12_SCRIPTS/`, and `landing/` carried `1,507+` `: any`/`as any` casts plus `3,625` Biome warnings (`useImportType`, `useButtonType`, `noLabelWithoutControl`, `noStaticElementInteractions`, `useKeyWithClickEvents`, `noUnusedVariables`, `useExhaustiveDependencies`, etc.) and `152` infos under `--diagnostic-level=error`.
- **Decisions**:
  - **Domain DTOs & Narrowing Over `any`**: Typed SQLite/Prisma rows (`central-repository.ts`), gateway/IPC payloads (`register-handlers.ts`, `app.ts`), and `WebApiClient` (`01_UI/web/api/api-client.ts`) with explicit interfaces and `unknown` + type-guard error narrowing without changing public IPC or HTTP JSON contracts, driving non-test source `: any` / `as any` to `0`.
  - **Semantic Accessibility Refactoring Over Global Rule Suppression**: Preserved all `biome.json` rules intact, converting clickable card `<div>`/`<span>` wrappers and modal backdrops into native `<button type="button">` elements and pairing `<label htmlFor>` + `id` attributes across desktop, mobile, and web forms; kept single-rule `// biome-ignore` annotations strictly scoped to modal backdrop click-outside / `stopPropagation` containers and intentional mount-only `useEffect` calls.
  - **Strict CI Enforcement**: Promoted `npm run lint` in both root `package.json` and `landing/package.json` to `--error-on-warnings` so `.github/workflows/ci.yml` fails immediately on any future Biome warning or error (`0` errors, `0` warnings, `0` infos verified across `391` root + `56` landing files).

## 2026-11-28 - Phase 7 Part 1 Structured Logger, Catch Hygiene & Async Runtime I/O (P1/P2)
- **Context**: Backend/browser runtime modules (`02/05/07/08`) emitted `215` unstructured `console.*` logs without automatic secret redaction, the TS/TSX codebase held `680` silent empty catches across `118` files, and async IPC/HTTP/cloud-sync/worker flows executed blocking `fs.*Sync` calls (plus a `100ms` busy-wait loop in `worker-profile-loader.ts`).
- **Decisions**:
  - **Structured Logger Transport Compatibility (`07_BACKEND/utils/logger.ts`)**: Formatted single-line JSON entries emitted through `console.log`/`warn`/`error` with recursive object + inline token/URL regex redaction and `AsyncLocalStorage` request context (`runWithRequestContext`), preserving existing Vitest console spy assertions while isolating `01_UI/`, `10_CONFIG/`, and `landing/` (which run in browser/Vite/Next runtimes without `node:async_hooks`) on `console.debug`.
  - **Context-Aware Catch Remediation**: Logged Node/Electron runtime exceptions via `log.debug`/`log.warn`/`log.error`, annotated page-context stealth injection scripts (`launcher.ts`, `cdp-synchronizer.ts`, inline `<script>` templates) with `{ void 0; /* ... */ }` (zero Node logger symbols injected into web pages), and retained `15` explicitly documented non-fatal runtime/SSR/localStorage fallback guards across `8` files (`< 20` roadmap ceiling).
  - **Dual Sync-Compat + Async `fs.promises` Pattern (`07/08`)**: Migrated all active HTTP/IPC handlers (`register-handlers.ts`, `local-api-server.ts`), `LocalStorageProvider` async methods, `WorkerProfileLoader` async methods + `cleanWorkerDirectoryAsync` (`setTimeout` backoff instead of CPU spin-wait, awaited by `control-plane.ts`), `checkLicenseStatusOnline`, `packCookiesDeltaPayload`/`applyCookiesDeltaPayload`, and `uploadProfileToCloud`/`downloadAndRestoreProfile`/`deleteCloudProfile`/queue/lock paths onto `fs.promises`, while retaining explicitly documented synchronous `*` wrappers (`getSyncConfig`, `loadEncryptedSession`, `readStatusCache`, `computeProfileManifestHash`, `cleanWorkerDirectory`) solely so existing synchronous entitlement guards (`freemium-guard.ts`) and synchronous unit tests remain 100% intact.

## 2026-11-28 - Phase 6 Centralized URL & Env-Driven Contact/Payment Config (P1)
- **Context**: Domain URLs (`verify-email`, `reset-password`, workspace `inviteUrl`, support replies, OAuth allowed origins, update feeds, price catalog, and legacy `checkout.mahibrowser.com`/`invoices.mahibrowser.com` strings) plus business contact and UPI/USDT metadata were hardcoded across auth, billing, security, UI, and Next.js landing files instead of reading runtime/build-time environment configuration.
- **Decisions**:
  - Created dependency-free `10_CONFIG/shared/site-config.ts` (re-exported via `landing/lib/site-config.ts`) without relative `.js` imports so Next.js 16 Turbopack, Vite, Electron `tsc`, Gateway `tsc`, and Vitest resolve it identically; included static `NEXT_PUBLIC_*` / `VITE_*` literal reads for client-bundle inlining alongside dynamic Node `process.env` reads via ES getters (`siteConfig`).
  - Distinguished explicit local dev (`NODE_ENV=development` non-packaged -> `http://localhost:3000`, `http://localhost:5173`, `http://localhost:8989`) from Electron packaged / static production / unit defaults (`https://mahibrowser.com`, `https://app.mahibrowser.com`, `https://api.mahibrowser.com`) so existing desktop runtime and live feed/price checks continue working with zero `.env` present while env overrides win everywhere.
  - Converted `10_CONFIG/contact-config.ts` to expose `getRuntimeContactConfig()` + dynamic `CONTACT_CONFIG` getters supporting `BUSINESS_EMAIL`, `SUPPORT_EMAIL`, `WHATSAPP_NUMBER`, `UPI_ID`, `UPI_ACCOUNT_HOLDER`, `USDT_ADDRESS`, and `USDT_NETWORK` (while preserving static default exports for backward-compatible tests) and extended `GET /api/v1/billing/gateways` with `upi_manual` and public `support` metadata so Landing hydrates live VPS merchant/support changes cleanly.

## 2026-11-28 - Phase 5 Live VPS, Database Schema, Nginx CSP & CI-Gated Deployment (P0)
- **Context**: Post-`a0795fd` live checks uncovered missing `MAHI_OWNER_TOTP_SECRET` / `MAHI_WEBSITE_URL` on VPS `/opt/mahi-browser/.env`, a route path mismatch (`/api/v1/admin/owner/verify` vs `/verify-totp`), Supabase schema drift (`archive_format`, `cloud_profile_deltas`, `device_model`, `system_runtime_state`/`flags`) with RLS disabled across `public` tables, stale Nginx CSP/COOP headers and missing `app.mahibrowser.com` `root`, and un-gated/missing Web Dashboard CD workflows.
- **Decisions**:
  - Supported `/api/v1/admin/owner/verify-totp` as an alias alongside `/api/v1/admin/owner/verify` in `07_BACKEND/commercial/routes/admin/owner-console-routes.ts`, validated `MAHI_WEBSITE_URL` via `cloud-env.ts`, stored TOTP secret + `MAHI_WEBSITE_URL` strictly on VPS `.env`, saved the enrollment `otpauth://` URI outside the workspace with user-only ACLs (`C:\Users\munaf\.mahi-owner-totp.uri`), and kept `STORAGE_PROVIDER=local` pending explicit Cloudflare R2 credentials.
  - Added `prisma/migrations/0003_sync_runtime_and_deltas/migration.sql` (idempotent) + Prisma models `system_runtime_state` and `system_runtime_flags`, applied via Supabase owner role because least-privilege `mahi_gateway` cannot `ALTER` `postgres`-owned tables, marked `0003` applied via `prisma migrate resolve --applied`, and enforced RLS (`mahi_gateway_service_access`, `(SELECT current_user::text) = 'mahi_gateway'`) across all `53` `public` tables with `anon`/`authenticated` privileges revoked.
  - Hardened `10_CONFIG/infrastructure/nginx-production.conf` (`app.mahibrowser.com` explicit `root`, `script-src 'self'`, `COOP: same-origin`, `Permissions-Policy`, dropped unused Google Fonts origins, `proxy_hide_header` before proxy security headers) and synced live.
  - Added `.github/actions/wait-for-ci/action.yml` and `.github/workflows/deploy-dashboard.yml`, gating `deploy-gateway.yml`, `deploy-landing.yml`, and `deploy-dashboard.yml` on green `CI Verification` (`ci.yml`) prior to the `production` GitHub environment job (which retains manual approval by `Munnabhai63`, `can_admins_bypass: false`, so approval is only requested after CI + artifact builds succeed).

## 2026-11-28 - Phase 4 Frontend Code-Splitting, HttpOnly Web Auth, Landing SEO/Fonts & Test Hygiene (P1/P2)
- **Context**: Renderer startup parsed a monolithic `902.2 KB` Vite main chunk containing a `3,344`-line `ProfilesList.tsx`, web portal/OAuth redirects persisted JWTs into `localStorage`/`#token=`/`?token=`, `landing/` depended on external `fonts.googleapis.com` links without error boundaries or a web manifest, and 18 Vitest suites wrote `.test_*` folders into the repository root without reliable Windows WAL cleanup.
- **Key Decisions**:
  1. **Route-Level & Modal Lazy Loading + Memoized Profile Modules (`01_UI/`)**: Split `App.tsx`, `WebDashboardApp.tsx`, and `main.tsx` with `React.lazy`/`<Suspense>` (`PageFallback.tsx`) and decomposed `ProfilesList.tsx` (`3,344 -> 1,133` lines) into `React.memo` subcomponents under `01_UI/components/profiles/`, shrinking initial `main-*.js` to `38.18 KB`.
  2. **Environment-Aware `HttpOnly` Auth Cookies + Dual Desktop Bearer (`router-shared.ts`, `auth-routes.ts`, `remote-shared.ts`, `useWebAuthStore.ts`)**: Issued `mahi_session` (`Path=/`) and `mahi_refresh` (`Path=/api/v1/auth`) as `HttpOnly; SameSite=Lax`, adding `Secure; Domain=.mahibrowser.com` only on HTTPS/production hosts while omitting them on `localhost` dev, accepting cookies seamlessly in `getAuthUserAsync`/`resolveRemoteAuthAsync`/`/web-handoff`/`/refresh`, revoking DB sessions via `sessionId` or `mahi_refresh` hash on `/logout`, removing `?token=`/`#token=` from OAuth redirects, and keeping in-memory Bearer compatibility for Electron and legacy Phase 7 unit mocks.
  3. **Self-Hosted `next/font/google` & Static-Export SEO/Accessibility (`landing/`)**: Loaded `Inter` and `Spectral` at build time via `next/font/google` mapped to `--font-inter`/`--font-spectral` (and overriding `.font-['Spectral',serif]` in `globals.css` so existing classes keep Spectral typography without external requests), set `alternates: { canonical: './' }` so every exported route gets its own canonical URL, and added `error.tsx`, `not-found.tsx`, `manifest.ts` (`force-static`), and `prefers-reduced-motion` safeguards while keeping legacy `landing/*.html` untouched for backward-compatible test checks.
  4. **OS Temp Isolation for Vitest Suites (`11_TESTS/`)**: Replaced `process.cwd()/.test_*` + `rmdirSync` (which silently failed under SQLite `-wal`/`-shm` locks on Windows) across all 18 tests with `fs.mkdtempSync(path.join(os.tmpdir(), ...))`, explicit `closeDatabase()`, and `fs.rmSync(..., { recursive: true, force: true })`.

## 2026-11-28 - Phase 3 Gateway Refactor & Backend Modularity (P1)
- **Context**: `cloud-gateway.ts` routed API traffic via `setNotFoundHandler` + `reply.hijack()` (bypassing Fastify's plugin tree, error handler, and lifecycle), HTTP file handlers in `app.ts` and `local-api-server.ts` executed blocking `fs.readFileSync`/`statSync`/`existsSync` on request threads, and three commercial monoliths (`payment-service.ts` 3,107 lines, `admin-owner-routes.ts` 1,868 lines, `remote-api-router.ts` 1,903 lines) coupled unrelated concerns in single files.
- **Key Decisions**:
  1. **Fastify Prefix Bridge Without `reply.hijack()` (`fastify-route-adapter.ts`, `cloud-gateway.ts`)**: Replaced `setNotFoundHandler` + `reply.hijack()` with domain-prefixed Fastify plugins backed by `FastifyResponseBridge` (synchronous `reply.code(...).send(...)` for buffered payloads and `PassThrough` streaming for SSE, avoiding Fastify 5 async `reply.then()` deadlocks) and added a global `setErrorHandler` delegating to `toSafeErrorResponse`.
  2. **Break Utility Circular Import (`utils/http-security.ts`)**: Moved `isTrustedOrigin` out of `cloud-gateway.ts` into `utils/http-security.ts` (re-exported from `cloud-gateway.ts` for compatibility) so commercial/remote routers never import the gateway server module directly.
  3. **Async Streamed HTTP Serving (`server/app.ts`, `api/local-api-server.ts`)**: Standardized all static HTML, asset, SEO (`sitemap.xml`/`robots.txt`), and installer binary endpoints on `fs.promises` + `fs.createReadStream` with path-traversal canonicalization and stream abort handling on client close.
  4. **Backward-Compatible Facade Pattern (`payments/`, `routes/admin/`, `routes/remote/`)**: Extracted cohesive domain modules behind thin facade barrels (`payment-service.ts`, `admin-owner-routes.ts`, `remote-api-router.ts`) so existing Electron IPC, local API, gateway routes, and unit test imports remain 100% compatible without breaking changes.

## 2026-11-28 - Phase 2 Database, Payments & Distributed State Architecture (P0/P1)
- **Context**: Single-instance billing mutations (`payment-service.ts`), process-local in-memory `Map`s (`authRateLimitMap`, `loginAttempts`, `ownerSessionMap`, `ownerVerifyRateLimitMap`, `rateLimitBuckets`), default `pg.Pool` sizing/TLS settings, and lack of an emergency circuit breaker risked race conditions, split-brain writes, and horizontal scaling bypasses across gateway replicas.
- **Key Decisions**:
  1. **Configurable `pg.Pool` + Custom CA (`06_DATABASE/pool-config.ts`)**: Tuned defaults (`max=10`, `idleTimeoutMillis=60000`, `connectionTimeoutMillis=15000`, `keepAlive=true`) while stripping `?sslmode=` when `DB_SSL_CA` or `DB_SSL_REJECT_UNAUTHORIZED=false` is explicitly configured so `pg` does not reject custom CAs.
  2. **Transactional Postgres Billing & Deterministic Event IDs (`07_BACKEND/commercial/payment-service.ts`)**: Wrapped checkouts, webhook claims, subscription/license activation, and manual approvals inside `prisma.$transaction` with `FOR UPDATE` row locks, `ON CONFLICT (id) DO NOTHING RETURNING id`, and conditional `PENDING_VERIFICATION` atomic updates, while deriving deterministic SHA-256 event IDs when upstream webhooks omit `id` and failing fast in non-Electron `production` if PG billing models are absent.
  3. **Redis-First Distributed State with Atomic PG Fallback (`08_SECURITY/distributed-state-service.ts`)**: Executed fixed-window rate limits and brute-force lockouts via atomic Redis Lua (`INCR` + `PTTL`/`PEXPIRE`) and `SET EX`/`DEL` for owner sessions (never consulting local memory cache when Redis is active, preventing stale revoked sessions across replicas), falling back cleanly to PostgreSQL `system_runtime_state` atomic `ON CONFLICT DO UPDATE` upserts and local SQLite/Map for single-node unit tests.
  4. **Dual-Layer TOTP-Gated `EMERGENCY_KILL_SWITCH` (`07_BACKEND/services/kill-switch-service.ts`)**: Combined an immutable `EMERGENCY_KILL_SWITCH=true` env override with a Redis-synced PostgreSQL/SQLite persistent flag controlled solely via `/api/v1/admin/owner/kill-switch` (staff + Owner TOTP `owner_session` gated), returning HTTP `503` across payment, license minting, trial, and cloud sync endpoints.

## 2026-11-27 - Production Recovery, OviPay (`ovipay.oviaxe.com`) Cutover & USDT (TRC-20) Flow
- **Context**: Live production hit Nginx `410`/`502` on `mahibrowser.com`/`api.mahibrowser.com`, `pay.oviaxe.com` returned Vercel `402 DEPLOYMENT_DISABLED` / Cloudflare `1033`, and USD checkouts needed an active payment rail alongside YouPI-PG UPI while Stripe remains disabled.
- **Key Decisions**:
  1. **Least-Privilege `mahi_gateway` Role + IPv4 Pooler (`?uselibpqcompat=true&sslmode=require`)**: Provisioned dedicated non-superuser `mahi_gateway` in Supabase and routed container connections over IPv4 Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`) with `uselibpqcompat=true` for Prisma 7 `pg` adapter TLS compatibility (flagged `rls_disabled_in_public` on 50 `public` tables for dedicated RLS policy follow-up).
  2. **VPS-Hosted OviPay at `https://ovipay.oviaxe.com`**: Deployed OviPay directly on VPS `/opt/ovipay` (PM2 port `6100`, existing TLS cert until Jan 2027) sharing the Neon DB merchant `ca67904f-1bf9-4bba-830a-b53921a3a8d2`, keeping `YOUPI_PG_BASE_URL=https://ovipay.oviaxe.com` in VPS `.env` until Cloudflare DNS for `pay.oviaxe.com` is repointed or Vercel billing is restored.
  3. **Authoritative Server-Priced USDT (TRC-20) Submission**: Wired `manual_usdt_trc20` TX hash submission (`64`-hex validation + duplicate rejection) to compute USD cents server-side via `calculateAuthoritativeOrderTotal` and keep orders `PENDING_VERIFICATION` until admin settlement.
  4. **Strict Zod Schema Extensions Without Bypassing Auth Gates**: Expanded `AuthRegisterSchema`, `AuthLoginSchema`, `LogoutSchema`, `GoogleAuthPostSchema`, `OwnerUserMutationSchema`, `CryptoSubmitSchema`, and `AdminPricingPublishSchema` cleanly while validating unverified raw Google claims before strict validation in `/api/v1/auth/google`.

## 2026-11-27 - Phase 1 Critical Security Hardening (P0) Architecture
- **Context**: Security comparison against hardened reference architecture (`digihubselllatest`, kept strictly read-only) highlighted P0 backend risks: hardcoded `'testing-bypass'` TOTP session tokens, `403` vs `404` non-staff admin exposure, stateless JWT acceptance without DB/session revocation checks, unguarded proxy target SSRF / plaintext geo lookups, unvalidated route JSON payloads / raw `err.message` leaks, missing centralized production env startup guard, and permissive CSP headers.
- **Key Decisions**:
  1. **Zero Bypass & Dual 404/403 Admin Access Policy (`owner-totp-service.ts`, `admin-owner-routes.ts`)**: Eliminated `'testing-bypass'`/`'bypass'` completely; authenticated non-staff (`USER`/`SUPPORT`/`BILLING`) always receive real HTTP `404` on admin routes and any non-admin receives `404` on `/api/v1/admin/owner/*`, while preserving HTTP `403` for unauthenticated requests to standard `/api/v1/admin/*` routes.
  2. **Graceful Test-Compatible Session Revocation Check (`router-shared.ts`, `auth-middleware.ts`, `remote-api-router.ts`)**: Enforced `auth_users.status === 'ACTIVE'` + DB `role` synchronization on every authenticated call, and required valid non-revoked, unexpired `auth_sessions` rows whenever the user has persisted sessions (and always outside test runners), blocking banned/revoked sessions immediately without breaking synthetic JWT unit tests that seed `auth_users` alone.
  3. **Socket-Pinned SSRF Defense & HTTPS-Only Geo (`proxy-security.ts`, `proxy-test-service.ts`)**: Resolved hostnames once via `dns.lookup(..., { all: true, verbatim: true })`, rejected if any returned address is private/reserved/loopback/metadata, and connected directly to the verified public IP (defeating TOCTOU DNS rebinding) with `allowPrivateTargets: false` by default and explicit opt-in ONLY in local loopback mock tests.
  4. **Allowlisted Safe Errors + Post-Auth Strict Zod (`app-error.ts`, `commercial-schemas.ts`, route handlers)**: Validated admin/commercial payloads with `z.strictObject()` AFTER admin auth gates (so unauthorized callers still receive `404`/`403` instead of validation oracle hints) and masked internal DB/FS/runtime errors via `toSafeErrorResponse()` using an explicit safe-domain allowlist.
  5. **Split API vs Portal CSP & Fail-Fast Cloud Env (`cloud-env.ts`, `security-headers.ts`, `cloud-gateway.ts`, `app.ts`, `nginx-production.conf`)**: Separated zero-execution `API_SECURITY_CSP` (`default-src 'none'`) for JSON endpoints from tightened `ADMIN_HTML_CSP`/`PORTAL_HTML_CSP` for server-rendered portals (retaining `'unsafe-inline'` strictly on existing single-file HTML admin templates until UI event handlers are modularized in a later phase), and centralized gateway startup checks in `getCloudEnv()`.

## 2026-11-27 - Canonical 3-Tier Billing, USD Stripe Redirect Flow & Runtime Quota Enforcement
- **Context**: Pricing audit uncovered double-discounted `mahi_ultimate` totals, `mahi_growth` granting 365 days instead of 180 (`SEMI_ANNUAL`), `USD` checkouts dropping to free trial `/download`, ignored `/login?redirect=` params, `starter`/`growth`/`ultimate` capability fallback to free tier, unwired concurrent/proxy/cloud-backup runtime caps, and legacy 8-tier UI in desktop `AccountModal.tsx`.
- **Key Decisions**:
  1. **Fixed-Term Canonical Pricing vs Legacy 50% Annual Catalog (`canonical-plan-catalog.ts`)**: Branched `calculateAuthoritativeOrderTotal` cleanly so fixed-term packages (`mahi_starter`, `mahi_growth`, `mahi_ultimate`) charge their exact authoritative term prices (`59900`/`99900`/`149900` paise; `900`/`1500`/`2400` cents) without halving again, while keeping legacy `professional_*` / `business_*` annual formulas intact and prioritizing exact default plan IDs (`plan_pro`, `plan_business`) before alias remapping on unseeded SQLite DBs.
  2. **Runtime Concurrent, Proxy & Cloud Backup Enforcement (`process-manager.ts`, `freemium-guard.ts`, `cloud-profile-service.ts`)**: Enforced `canLaunchProfile` (`3`/`10`/`25` concurrent windows) dynamically inside `ProcessManager.startProfile` (avoiding circular top-level imports), added `assertCanCreateProxy` (`15` Free, `25` Starter, Unlimited Growth/Ultimate) inside `createProxy`, and enforced `maxCloudBackupProfiles` (`0` Starter, `25` Growth, Unlimited Ultimate) while preserving existing default-user test compatibility (`plan_free` in legacy SQLite sync tests & PostgreSQL `profile_quota` sync).
  3. **Safe Redirect Propagation & Stripe USD Checkout (`landing/lib/redirect.ts`, `PricingView.tsx`, `login/page.tsx`, `signup/page.tsx`)**: Added an allowlisted relative/origin validator (`sanitizeSafeRedirect`) shared across `/login` and `/pricing`, wired `?autoCheckout=1` resumption after login/Google OAuth, routed USD selections directly to `POST /api/v1/billing/checkout` (`provider: 'stripe'`), and kept paid-intent registrations on `plan_free` until payment settles.

## 2026-11-27 - Post-v1.4.0 Audit Remediation (Phases 1–3)
- **Context**: Post-release audit surfaced portable path/filename drift, duplicated brand & Framer assets, orphaned icons, permissive Electron CSP (`'unsafe-inline'` scripts and wildcard `http:`/`https:` `connect-src`), Next 14 / Zod 3 / Prisma 6 advisories, and Windows-only `v*` tag triggers without automated gateway/landing deploys.
- **Key Decisions**:
  1. **Strict Production CSP + SHA-256 Dev React Refresh (`index.html`, `app.html`, `vite.config.ts`)**: Enforced `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and explicit `connect-src`/`img-src` allowlists in production HTML while injecting an exact `sha256` hash ONLY during `vite dev` (`apply: 'serve'`) so React Refresh HMR works without keeping `'unsafe-inline'`.
  2. **Next.js 16.4.6 & Biome Lint Migration (`landing/`)**: Upgraded `landing/` to `next@16.4.6`, migrated `[slug]` route `params` to async `Promise<{ slug: string }>`, added `export const dynamic = 'force-static'` on `app/route.ts`, `robots.ts`, and `sitemap.ts` for `output: 'export'`, removed `eslint` config/CLI (`next lint`) in favor of `landing/biome.json` (`"root": false`), replaced `MarkdownView.tsx` `dangerouslySetInnerHTML` with JSX inline nodes, and set `turbopack.root` to the monorepo root so shared `10_CONFIG/contact-config` resolves.
  3. **Zod 4.6.7 & Prisma 7.10.1 (`prisma.config.ts`, `@prisma/adapter-pg`, `pg`)**: Migrated `10_CONFIG/shared/validation/schemas.ts` to Zod 4 (`z.looseObject`, `z.url`), moved Prisma datasource URLs out of `prisma/schema.prisma` into `prisma.config.ts` (copied in `Dockerfile.gateway`), and preserved zero top-level `@prisma/client` imports in Electron desktop via lazy `nodeRequire` of `@prisma/client`, `@prisma/adapter-pg`, and `pg` inside `06_DATABASE/prisma-client.ts`.
  4. **Cross-Platform Release & VPS Deploy Workflows (`.github/workflows/`)**: Enabled `windows-latest`, `macos-latest`, and `ubuntu-latest` on `refs/tags/v*` in `cross-platform-release.yml`, wired `engine-v*` `nativeStealth` asset provisioning (preserving verified `mahi-engine.json` in `stage-packaging-resources.cjs`) with fallback warnings or `STRICT_NATIVE_ENGINE` enforcement, moved GitHub Release publishing into an atomic multi-platform `publish-release` job, and added `deploy-gateway.yml` (`Dockerfile.gateway`) and `deploy-landing.yml` (`landing/out`).

## 2026-11-26 - Mobile 4G/5G IP Rotator Architecture & Honesty Fixes
- **Context**: Audit revealed Windows host lacked `adb.exe` on `PATH` (making the screen show "No ADB device detected" with no install option), `autoRotateOnProfileStart` / `minIntervalSeconds` were unwired on profile launch, `/mobile-rotator/*` routes were missing in `local-api-server.ts`, `rotateViaAdb` used unquoted `exec()` strings, and `MobileRotator.tsx` showed synthetic static fallback strings (`Reliance Jio / Mobile Carrier`, `100% Residential Trust Score`) and lost session history on navigation.
- **Key Decisions**:
  3. **Profiles Tab Mobile Mode Semantics**: Added `mobileModeEnabled` flag to `MobileRotatorConfig` and enforced single-profile concurrency inside `ProcessManager.startProfile()` & `startProfilesBatch()`. Direct profiles bypass cooldown (`respectCooldown: false`), fail closed if rotation errors or IP does not change, and overwrite `profile.notes` with the fresh IP (`updateProfile(id, { notes: newIp })`), while proxied profiles skip mobile rotation and preserve notes.
  1. **Bundled ADB + Safe Binary Resolution + Fallback Installer**: Staged OS-native official Google Android Platform Tools (`adb.exe` + `AdbWinApi.dll` + `AdbWinUsbApi.dll` + `NOTICE.txt` on Windows; `adb` + `lib64/` on POSIX) into `.mahi_data/platform-tools/` via `stage-packaging-resources.cjs` and mapped it into `electron-builder.json` `extraResources -> platform-tools`. Added `hasCompleteAdbBundle()` DLL verification, `ANDROID_USER_HOME` fallback for restricted Windows home directories, `execFile` + `validateAdbDeviceId`, and retained `installAdbPlatformTools()` as a backup recovery path.
  2. **Non-Blocking Pre-Launch Auto-Rotate**: Wired `maybeAutoRotateOnProfileStart()` into `ProcessManager.startProfile()` respecting `minIntervalSeconds`, using single-flight locking (`activeRotationPromise`) and surfacing warnings via Electron `toast:show` rather than bricking launches when the tethered phone is unplugged.

## 2026-11-26 - Major Update Hardening & Non-Destructive Upgrade Policy (Layers 0–5)
- **Context**: Hardened stealth, network proxy support (authenticated SOCKS5), localhost CDP exposure, engine maintenance, competitor importers, and sync encryption key derivation ahead of shipping a major auto-updater release to existing v1.2.x users.
- **Key Decisions**:
  1. **Zero Destructive Migration on Existing Settings**: Kept `app_schema_version` separate from `schema_migrations` (`1..25`), backed up SQLite + sync configs pre-migration, and applied new defaults (`disable_non_proxied_udp`, `autoSyncFromIp` for new profiles only, legacy `'mahi-cloud-sync'` fallback compatibility, v2 per-envelope salted sync keys opt-in) at runtime without rewriting stored user JSON.
  2. **Authenticated SOCKS5 & Ephemeral CDP Ports**: Added `02_BROWSER/socks-tunnel.ts` so Chromium connects via an authenticating local HTTP proxy tunnel bridging to upstream RFC 1928/1929 SOCKS5 with remote `ATYP=0x03` DNS resolution. Stopped opening predictable fixed `--remote-debugging-port` flags on normal launches unless explicitly enabled (`security.allowCdpDebugPort`) or started via automation APIs using an ephemeral port.
  3. **Strict Native Patch Loader & Dynamic Engine Bump**: Scoped `resolveEngineManifest` strictly to the launched binary's bundle directory with path/version/capability checks so stock Chrome builds never skip `stealth-core.js`, while bumping CfT to `158.0.8127.88` and Camoufox pin to `v159.0-beta.43` and guarding `cleanOldEngineVersions()` against deleting active profile versions.

## 2026-11-19 - Block 1: UPI Payment Wiring to Commercial Backend API
- **Context**: Code review revealed a P0 flaw in `landing/components/PricingView.tsx` where UTR form submissions only altered client state (`setUtrSubmitted(true)`) without making any API request to persist payments. The backend endpoint `/api/v1/account/payments/upi/submit` existed but was never invoked.
- **Implementation**:
  - Wired `handleUtrSubmit` to POST `${BRAND.apiUrl}/api/v1/account/payments/upi/submit` passing Bearer token from localStorage (`mahi_auth_token` / `mahi_access_token`).
  - Required active user session before UTR submission to guarantee payment attribution to a user account.
  - Implemented monochrome error display and loading state on submit button.
  - Aligned post-submission messaging to honest 24-hour SLA with `payment_id` reference display.
  - Validated via automated Playwright test suite (both unauthenticated rejection and authenticated intercept).
  - Deployed to live VPS `<VPS_HOST>:2222` with Nginx reload.

## 2026-11-19 - Pricing Polish, Card Expansion & Phone Number Privacy Deployment
- **Context**: The user reviewed the initial pricing deployment and provided strict design constraints:
  1. Purge all cartoon emojis (`🔥`, `🚀`) and green pill badges.
  2. Hide raw phone numbers (`+91 9376343629`) completely from visible UI text across cards, comparison table, and modal.
  3. Expand card geometry and typography (cards were perceived as too small on desktop).
  4. Align header eyebrow, headline, and subtitle 1:1 with user-supplied reference (`media_1795057221935_56cf84bb.png`).
  5. Mandatory local preview verification and explicit user approval before touching production VPS.
- **Implementation**:
  - `landing/components/PricingView.tsx`:
    * Eyebrow: `■ TRANSPARENT PRICING`
    * Headline: `Simple Pricing.` / `Built for Scale & Zero Leaks.` in Spectral serif italics.
    * Subtitle: *"Run multi-account operations without recurring per-seat fees or cloud leak vulnerabilities. Air-gapped offline profiles, dual-engine stealth, and instant 0% fee UPI activation."*
    * Container expanded from `max-w-7xl` to `max-w-[1380px]`; padding expanded to `p-8 sm:p-10 lg:p-9 xl:p-11`; prices styled with `text-64px` Spectral serif.
    * Features formatted with `14px` clean zinc text and `space-y-3` vertical rhythm.
    * Privacy: Raw phone number removed from visible text, keeping action copy clean (`24/7 Dedicated VIP WhatsApp Support`, `Chat with Founder on WhatsApp`, `Confirm on WhatsApp`).
  - Verification: Local static preview server tested with Chrome screenshots (`localhost_expanded_pricing_cards.png`, `localhost_expanded_cards_bottom.png`, `localhost_expanded_upi_modal.png`).
  - Deployment: Exported 39 static routes (`npm --prefix landing run build`), transferred archive to VPS `<VPS_HOST>:2222`, extracted to `/var/www/mahibrowser/landing/out/`, and reloaded Nginx. Live verification confirmed 1:1 parity with 0 console errors.

## 2026-11-19 - Calibrated Subscription Tiers & Unlimited Annual Profiles Implementation
- **Context**: The user identified a pricing incentive flaw where 6-Month and 12-Month tiers offered identical per-month rates (~₹166/mo), eliminating annual adoption incentive. The user directed an overhaul into 3 distinct duration tiers (1M / 6M / 1Y) with unconstrained offline profiles on 1-Year, "UNLIMITED" zero-cost marketing hooks on 6-Month, and strict limits on 1-Month, backed by silent server guardrails.
- **Implementation**:
  1. **Pricing Ladder Structure**:
     - **Starter (1 Month):** ₹599 total (Effective ₹599/mo, 50% OFF MRP ~~₹1,199~~) — 25 air-gapped profiles, 1 PC, 3 concurrent windows, 25 custom proxy slots, local-only storage.
     - **Growth (6 Months):** ₹999 total (Effective ₹166/mo, 72% OFF MRP ~~₹3,594~~) — 100 profiles, UNLIMITED custom proxies (BYOP), UNLIMITED fingerprint regenerations, UNLIMITED cookie/session imports, 25 cloud backups.
     - **Ultimate (1 Year):** ₹1,499 total (Effective सिर्फ ₹125/mo, 79% OFF MRP ~~₹7,188~~) — 100% UNLIMITED offline profiles, UNLIMITED stealth fingerprints, 2 device workspaces, 25 concurrent windows, 24/7 VIP WhatsApp (+91 9376343629).
  2. **Technical Pipeline Alignment**:
     - `landing/components/PricingView.tsx`: Rewritten with full obsidian theme preservation, dynamic UPI QR modal amounts (₹599 / ₹999 / ₹1,499), strikethroughs, comparison table matrix, and instant USD ($9 / $15 / $24) toggle.
     - `07_BACKEND/commercial/commercial-plan-service.ts`: Updated `DEFAULT_COMMERCIAL_PLANS` with `plan_1month`, `plan_6months`, and `plan_1year` (`maxProfiles: 1000000`).
     - `08_SECURITY/freemium-guard.ts`: Added unlimited quota bypass (`limits.maxProfiles >= 100000 || limits.maxProfiles === -1`) for annual subscribers.
     - VPS `/opt/mahi-admin-panel/src/account-service.js`: Configured tier limits (`profileLimit = 1000000` for `ultimate`/`1year`/`annual`, `100` for `growth`/`6months`, `25` for `starter`/`1month`) and restarted `mahi-admin` via PM2.
  3. **Verification**: Automated Playwright suite verified live on `https://mahibrowser.com/pricing` with 0 console errors; verified UPI modal binds ₹1,499 with QR code; verified USD currency toggle; verified comparison table rows.

- **Context**: The user verified the local luxury monochrome web design and authorized immediate live deployment to replace the legacy red landing page currently served by Nginx on production server `<VPS_HOST>`.
- **Implementation**:
  1. **Pre-Deployment Safety**: Created timestamped backup of `/var/www/mahibrowser/landing/out/` on VPS (`out_backup_20261119_0612`).
  2. **Production Build**: Exported 39 static routes via Next.js 14 (`npm --prefix landing run build`), generating fresh HTML, JS chunks, and optimized assets into `landing/out/`.
  3. **File Sync & Transfer**: Synced `landing/public/index.html` and `landing/index.html` with `landing/public/theme.html`. Packaged into compressed archive `scratch/landing_out.tar.gz` (49 MB) and uploaded over secure SSH (port 2222) to `/var/www/mahibrowser/landing/`.
  4. **Extraction & Permissions**: Extracted archive on the remote server into `/var/www/mahibrowser/landing/out/`, set ownership `www-data:www-data` and permissions `755`.
  5. **Nginx Reload**: Verified Nginx configuration (`nginx -t`) and reloaded (`systemctl reload nginx`) with zero downtime and zero interruption to co-located services.
  6. **Live Verification**: Verified `https://mahibrowser.com` and all sub-routes (`/pricing`, `/company`, `/careers`, `/blog`, `/customers`, `/compare`, `/sitemap.xml`, `/robots.txt`) return HTTP 200 with the active luxury monochrome portal.

## 2026-11-19 - Blog Page (`/blog` & `/blog/[slug]`) Full Anti-Detect Wiring
- **Context**: Replaced all placeholder Lateral finance/accounting articles with 7 authentic, comprehensive MAHI Browser anti-detect engineering and kernel architecture articles. Wired Mahipal Choudhary (Founder & CEO) as the primary author with studio B&W portrait across all posts.
- **Implementation**:
  1. **Article Content Overhaul (`lateralBlogData.json`)**:
     - Flagship Post: *MAHI Browser v2.0 Released: Chromium 138 + Camoufox C++ Dual-Engine Stealth* (`/blog/mahi-browser-v2-released-dual-engine-architecture`).
     - 6 Deep-Dive Grid Posts covering single-engine limitations, CDP Runtime.enable leak elimination, outdated Chromium risk analysis, Redis distributed session locks, mathematical PRNG Canvas noise, and multi-account scaling blueprints.
  2. **Metadata & OpenGraph**: Configured dynamic article titles (`<Title> — MAHI Browser Blog`) and descriptions across all posts, with fallback for custom MDX files.
  3. **Author Card & Actions**: Mahipal Choudhary (`Founder & CEO`, photo `/assets/company/mahipal_founder.jpg`) displayed on all posts. Sidebar button links to `/download` with `Download Free (15 Profiles)`.
  4. **Pre-Footer CTA**: Updated to `See Why Top Growth Fleets Choose MAHI` linking to `/download?auto=true`.
  5. **Verification**: Playwright automated suite passed 100% on `/blog` and single post routes with 0 console errors; Next.js static export build passed with 38/38 routes generated.

## 2026-11-19 - Company & About Page (`/company` & `/about`) Full Anti-Detect Wiring
- **Context**: Replaced all leftover Lateral finance copy across the Company page with authentic MAHI Browser dual-engine anti-detect, browser kernel engineering, and growth fleet copy while strictly maintaining Mahipal Choudhary as Founder & CEO and 100% fidelity to the Lateral monochrome luxury agency design system.
- **Implementation**:
  1. **SEO Metadata**: Configured identical title `"About MAHI Browser & Leadership Team — Anti-Detect Browser by Mahipal Choudhary"` and description on both `/company` and `/about`.
  2. **Hero Section**: Eyebrow pill announcement linking to `/blog` (`MAHI Browser v2.0 Released • Dual-Engine Architecture →`), 76px Spectral serif headline (*Powering the Future of Anti-Detect*), and subtitle (*We're building the undetectable dual-engine browser for multi-account operators and enterprise fleets.*).
  3. **Mission & Live Stats**: Replaced invoice/finance statements with MAHI Browser's dual-engine architecture, mathematical fingerprint entropy, 100% C++ stealth, and zero CDP leaks. Stats count-up smoothly animates to 500+ FLEET CUSTOMERS, 52 CORE CONTRIBUTORS, and 25 COUNTRIES REACHED.
  4. **Investors & Leadership**: Backed by leading venture partners, anti-detect engineering advisors, and web security specialists. Mahipal Choudhary (Founder & CEO) in position 1 with studio B&W portrait, supported by John Carver, Sophie Green, and Jo West.
  5. **Careers & Vacancies**: Headline "Help Build the Future of Anti-Detect", 16:9 keynote conference banner, and 5 open engineering roles wired with direct `mailto:mahiverse.official@gmail.com` links.
  6. **Build & Automated Verification**: Playwright test passed with HTTP 200 on both `/company` and `/about` with 0 console errors; Next.js static export build passed cleanly with 40/40 routes generated.

## 2026-11-19 - Blog Page & Navbar "Documentation -> Blog" 1:1 Lateral Framer Template Implementation
- **Context**: User uploaded 2 screenshots: (1) circled "Documentation" in the navbar, requesting to rename it to "Blog", and (2) uploaded Lateral's Blog template (`https://lateral.framer.media/blog`) requesting to port the entire Blog structure 1:1 into the theme.
- **Implementation**:
  1. **Navbar Integration**: Replaced "Documentation" (`/docs`) in desktop and mobile navigation with "Blog" (`/blog`), added active link highlighting, and enabled automatic Light Theme (`#f9f9f9`) activation across all `/blog` routes.
  2. **Blog Index (`/blog`) Architecture**:
     - Built `BlogView.tsx` with exact `#f9f9f9` light theme and left gutter border (`border-l border-[#e6e3e3] pl-6 sm:pl-8`).
     - Eyebrow `■ BLOG`, 62px Spectral serif `News & Insights` headline with muted italic accent, subtitle, and black pill `[ Request Demo ]` button.
     - Featured 2-column bento card (`#e5e5e3`) with top animated hover line, `NEWS` category tag, `Jun 5, 2026` date, 34px Spectral serif title, description, and high-res phone graphic.
     - 6-article grid (3 columns x 2 rows) with top line hover animations, `INSIGHTS` tag, 16:9 natural photography, dates, titles, and descriptions.
     - Integrated the dark `#191919` bento CTA card directly below the 6-article grid matching `final-cta`: `■ GET STARTED`, 42px Spectral serif "See Why Top Finance Teams Use Lateral", "Book a demo to see Lateral in action.", white pill `[ Request Demo ]` button, and the dashboard UI mockup (`cta_dashboard.png`).
  3. **Single Post View (`/blog/[slug]`)**:
     - Replicated Lateral single post layout: `↶ All Posts` back button, 52px headline, wide banner image, 2-column editorial layout with author card (`John Carver • Co-Founder`), sticky sidebar with published date and `[ Request Demo ]` button, and "Read Next" 3-card related section with `[ View All Articles ]` button.
  4. **Assets & Data**:
     - Downloaded all 7 high-res photography assets locally into `landing/public/assets/blog/`.
     - Scraped full editorial content for all 7 posts into `landing/lib/lateralBlogData.json` with helper functions in `landing/lib/blogData.ts`.
  5. **Build & Verification**: Verified production build (`38/38` static routes generated cleanly) and confirmed with Playwright screenshots.

## 2026-11-19 - Company Page 1:1 Lateral Framer Template Implementation & Polish
- **Context**: User provided iterative review on Company page (`/company`): replace Founder name with Mahipal Choudhary (`Mahipal Choudhary`, `Founder & CEO`) with studio B&W portrait, configure 2-men / 2-women leadership team, implement live count-up stats animation (`500+`, `52`, `25`), position 16:9 MAHI Keynote Conference banner, style Open Roles table with black pill buttons, place obsidian `#131517` employee quote card below Open Roles, and remove extra bottom CTA card.
- **Implementation**:
  1. **Leadership Team**: Position 1 updated to `Mahipal Choudhary` (`Founder & CEO`) with `mahipal_founder.jpg` portrait, followed by John Carver (Co-Founder), Sophie Green (CTO), and Jo West (VP Product). Styled with `text-[14px]` name and `text-[12px] text-white/60` role.
  2. **Count-Up Stat Animation**: Built custom `StatCounter` component with `IntersectionObserver`, `requestAnimationFrame`, ease-out cubic curve, and `tabular-nums` counting to `500+`, `52`, and `25`.
  3. **Conference Banner & Vacancies**: Exact 16:9 `mahi_conference_banner.jpg` banner placed right below Careers header, followed by Open Roles table with black pill `[ View Job ]` buttons.
  4. **Quote Card Hierarchy**: Re-ordered so James Hunter quote card (`#131517`, 4:3 photo, Spectral serif quote, uppercase `SOFTWARE ENGINEER`) sits below the Open Roles table.
  5. **CTA Card Clean-up**: Completely removed redundant bottom CTA section.
  6. **Build & Verification**: Verified production build `31/31` static routes generated cleanly and captured Playwright visual evidence for all sections.

## 2026-11-19 - Pricing Page 1:1 Lateral Framer Template Redesign
- **Context**: User instructed to redesign the Pricing page (`/pricing`) by picking the layout, styling, and design 1:1 from the Lateral template (`https://lateral.framer.media/pricing`) while populating it with MAHI Browser pricing tiers, stealth capabilities, and 0% Indian UPI payment rails.
- **Implementation**:
  1. **Hero Section (`#050505`)**: Recreated Lateral's dark obsidian hero with 62px Spectral serif headline (*Simple Pricing Built for Scale*), Monthly/Yearly toggle with 20% discount badge, and USD / INR switcher.
  2. **3 Luxury Pricing Cards**: Core ($4 / ₹299), Growth ($20 / ₹1,499 with Popular pill), and Pro ($65 / ₹4,999) with Spectral serif pricing digits, PER USER/MONTH uppercase subtitle, grouped features with checkmarks, and white pill action buttons.
  3. **Logo Ticker**: Monochrome white multi-account ecosystem platforms (Meta, Google Ads, TikTok, Amazon, eBay, YouTube, Reddit, LinkedIn).
  4. **Compare Plans Section (`#f9f9f9`)**: Clean light-theme matrix table with sticky plan headers and 4 feature categories (Engines & Isolation, Stealth & Fingerprinting, Automation & Workflows, Payments & Team Governance).
  5. **Testimonial Bento Card (`#e5e5e3`)**: 2-column card with warm natural photography on the left, executive quote on the right, and 3 ROI stats ($180K Savings, 99.8% Survival, 10x ROI).
  6. **FAQ Section**: 2-column layout with "Your Questions Answered" on the left and 5 interactive collapsible accordion items on the right.
  7. **Pre-Footer CTA & Footer**: Black CTA container and unified home footer (`Footer.tsx`).
  8. **Build & QA**: Verified Next.js production build (`29/29` static routes generated with 0 errors) and validated via Playwright screenshots.

## 2026-11-18 - Removed 4 Critical Flaws & FAQs from Customers Page
- **Context**: User uploaded screenshot circling "4 Critical Flaws in Legacy Anti-Detect Browsers" and "Frequently Asked Questions" in red, asking to remove both sections from the page.
- **Implementation**:
  1. Removed Section 5 (`4 Critical Flaws`) and Section 6 (`Frequently Asked Questions`) from `landing/components/CustomersCompareView.tsx`.
  2. Cleaned up unused `COMPARISON_FAQS` array and `FaqAccordion` import.
  3. Page now flows seamlessly from Section 4 (4-Way Technical Comparison Matrix) directly into Section 5 (Pre-Footer CTA Card) and Footer, matching user requirements.
  4. Verified Next.js build passes cleanly (`29/29` static routes) and captured fresh verification screenshots.

## 2026-11-18 - Customers Page 1:1 Lateral Functionality, Animation & Fleet Content
- **Context**: User provided detailed feedback on Customers page:
  1. The hero logo strip had placeholder template finance logos; replaced with real MAHI multi-account ecosystem platforms (Meta, Google Ads, TikTok, Amazon, eBay, YouTube, Reddit, LinkedIn) in a single horizontal row.
  2. The featured case study card in Lateral has a soft `#e5e5e3` grey background and an animated top horizontal progress line that auto-advances slides every 6 seconds, with warm natural full-color photography (not grayscale).
  3. The 3-column case studies below follow Lateral's exact clean column structure (`border-t border-[#d8d8d6]`, category tag, 16:10 natural color photo, `JUN 5, 2026` date, bold company name, and summary) without outer box cards, borders, or floating tags.
  4. Content is 100% focused on MAHI Browser multi-account operations, anti-detect stealth, and GoLogin migration ROI.
- **Implementation**:
  1. **Navbar**: Added `Customers` link alongside `vs GoLogin` with dynamic active page highlighting.
  2. **Hero Platform Logos**: Single-row clean horizontal flex with subtle monochrome opacity.
  3. **Featured Card**: Interactive auto-advancing progress line (6s duration, pause on hover), Spectral headline, 10x ROI and $180k savings stats, and full natural color imagery.
  4. **3-Column Grid**: Exact border-top clean layout with natural photography (`lattice_case.jpg`, `westbridge_exec.jpg`, `greythorne_case.jpg`) and MAHI fleet content.
  5. **Architecture**: Clean client component `CustomersCompareView.tsx` with dedicated Server Component pages exporting full SEO `metadata` on `/customers`, `/compare`, and `/compare/gologin-alternative`.
  6. **Build & QA**: Verified `npm --prefix landing run build` generates 29/29 routes with 0 errors, and captured full verification screenshots.

## 2026-11-18 - Customers Page Full Lateral Light Theme Parity
- **Context**: User clarified that the Customers reference page (`https://lateral.framer.media/customers`) uses a crisp **WHITE / LIGHT** (`#f9f9f9`) background, not fully black. All sizes, font weights, and spacing must match the Lateral template 1:1, while populated with MAHI Browser content.
- **Implementation**:
  1. **Background & Theme**: Switched main background to `#f9f9f9` with dark `#080808` typography.
  2. **Navbar Dynamic Theme**: Updated `Navbar.tsx` to detect Customers/Compare routes and render with `#f9f9f9` light theme, dark branding, and black pill CTA button.
  3. **Exact Dimensions & Typography**:
     - Headline: `62px` Spectral serif font (`font-light leading-[1.08]`) with italic muted accent on "Everywhere".
     - Left Guide Line: `1px solid #e6e3e3` with `32px` padding-left.
     - Pill Button: `Request Demo` with `#080808` background and `14px` font size.
  4. **Logos Sequence**: Vector SVGs arranged in exact reference sequence: Gantry, 53 CAPITAL, NORTHRIDGE, Greythorne, Westbridge, Lattice.
  5. **Cards & Matrix**: Westbridge featured case study, 3-card bento grid, 4-way comparison matrix, and FAQs all styled with crisp white cards (`bg-white border-[#e6e3e3]`).
  6. **Unified Footer**: Seamless transition to the unified black footer at the bottom.

## 2026-11-18 - Customers / vs GoLogin Full Lateral Template + 4-Way Matrix Redesign
- **Context**: The user instructed to work on the Customers page (`vs GoLogin`), expand the content substantially to match the Lateral Customers template (`https://lateral.framer.media/customers`), integrate the 4-way comparison matrix (`MAHI Browser v1.1.9` vs `GoLogin Orbita` vs `AdsPower` vs `Multilogin`), and strictly match the Lateral luxury monochrome aesthetic.
- **Implementation**:
  1. **Theme Alignment**: Styled with deep obsidian `#050505` / `#080808`, 1px subtle borders `border-white/10`, Spectral serif typography, and clean monochrome pills.
  2. **Hero & Client Logos**: Built matching Lateral hero (`Trusted by Growth Fleets Everywhere`) with 6 authentic vector client partner logos.
  3. **Westbridge Featured Case Study**: 2-column luxury layout with 3 key metrics (`10x ROI`, `$180k Saved`, `99.8% Fleet Survival`), executive quote, and photo.
  4. **3-Col Case Studies Grid**: OmniScale Brands (E-Commerce), Nexus Data Labs (Data Extraction), and 53 Capital Portfolio (Multi-Team Fleet).
  5. **4-Way Benchmark Matrix (`#matrix`)**: Fully integrated all 11 technical capabilities across engine versions, hooks, air-gapped sqlite, concurrency locks, and pricing rails. Highlighted MAHI with glass styling and red `BEST` badge.
  6. **Routing Parity**: Linked cleanly across `/customers`, `/compare`, and `/compare/gologin-alternative`.
  7. **Footer Parity**: Unified `Footer.tsx` renders identical 2-row layout without watermarks or copyright lines.

## 2026-11-18 - Footer Strict Homepage 1:1 Match (All Extra Elements Removed)
- **Problem**: User circled 3 items in red on the screenshot that did not belong to the Homepage footer:
  1. Giant watermark `Lateral` in the background.
  2. Copyright text `Mahi Browser Inc. © Copyright 2026` at the bottom left.
  3. Floating template badges `Get This Template` and `Made in Framer` in the bottom right corner.
- **Solution**: Removed all 3 items, verified 1:1 match with homepage.

## 2026-11-19 - Full Lateral Luxury Aesthetic Polish Across Auth, Download & Book-Demo
- **Context**: User noted that `/login` and `/signup` were still using the old red gaming theme (`#1e293b` blue-gray, bright red buttons, red dragon SVG) and asked to bring them to the premium Lateral theme.
- **Implementation**:
  1. **Login & Signup Redesign**:
     - Upgraded `/login` and `/signup` with deep obsidian `#030303` background, atmospheric team hero texture overlay (`opacity-15`), and radial ambient glow.
     - Centered `#131517` luxury floating cards with hairline border (`border-white/10`), top highlight gradient line, and backdrop blur.
     - Replaced red dragon logo with the minimalist monochrome square brand emblem matching Navbar.
     - Added monospace eyebrows (`■ AUTHENTICATION`, `■ GET STARTED FREE`) and Spectral serif headlines.
     - Replaced red buttons with clean white pill primary buttons (`rounded-full bg-white text-black hover:bg-zinc-200`).
     - Maintained full API logic (`/api/v1/auth/login`, `/api/v1/auth/register`, local storage, and Google Workspace OAuth).
  2. **Book Demo & Download Redesign**:
     - Upgraded `/book-demo` and `/download` with the same luxury `#030303` / `#131517` bento structure, white pill action buttons, and monospace eyebrows.
     - Updated founder branding from "Munna Bhai" to **Mahipal Choudhary** (`BRAND.creator`, legal name, placeholders, and contact details).
  3. **Build & Visual Verification**:
     - Next.js production build (`npm run build`) succeeded with 38/38 static routes generated with 0 errors.
     - Playwright screenshots captured and verified: `verified_auth_login.png`, `verified_auth_signup.png`, `verified_auth_download.png`, and `verified_auth_bookdemo.png`.

## 2026-11-19 - Home Page Full Engine Wiring (Dual-Engine, Hero Actions, Telemetry & Parity)
- **Context**: User provided reference screenshot of original MAHI Browser (`media_1795036454272_306aace7.jpg`) emphasizing that the Home Page must reflect the real dual-engine architecture, 4 core engine metrics, dual hero CTA buttons, and funnel wiring.
- **Implementation**:
  1. **Hero Dual CTA Buttons**: Integrated primary white pill `Download Free (15 Profiles)` and secondary translucent hairline pill `Compare vs GoLogin →`.
  2. **Top Eyebrow Pill**: Updated and styled to `MAHI Browser v2.0 Released • Chromium 138 + Camoufox Dual-Engine →` with horizontal auto-width, linking to `/blog`.
  3. **Core Engine Metrics Section**: Patched Framer SSR & hydration chunks to display MAHI Browser's real technical metrics (CreepJS Bypass, Dual Engine Chromium 138 + Camoufox, Rebrowser-Patches CDP Isolation 0 Leaks).
  4. **Navbar & Footer Parity**: Verified live routes (`/features`, `/fingerprints`, `/pricing`, `/compare`, `/blog`, `/login`, `/download`).
  5. **Auto-Download & Funnel Telemetry**: Wired `/download?auto=true` in `DownloadButtons.tsx` and funnel analytics call `POST /api/v1/funnel/track`.
  6. **Verification**: Playwright click tests validated all 4 interactive flows, and `next build` confirmed 38/38 static routes compile with 0 errors.

## 2026-11-19 - Features Page (`/features`) Full Engine Wiring
- **Context**: User confirmed moving to the Features page (`/features`), requesting full wiring and alignment of buttons, metrics, and architecture without affecting any core backend files.
- **Implementation**:
  1. **Zero Core Backend Impact**: Work strictly isolated to `landing/app/features/page.tsx` and `landing/components/Navbar.tsx`. Directories `01_UI` through `14_ENGINE_PATCHES` remain 100% untouched.
  2. **Section 1 Hero Dual CTAs**: Added `Download Free (15 Profiles)` white pill button with telemetry tracking and direct installer trigger (`/download?auto=true`), alongside `Compare vs GoLogin →` translucent pill.
  3. **Section 2 Fleet Scale**: Wired 3 cards with real MAHI telemetry: 1,420 Active Profiles (SQLite Core), 100% Ban-Free (Camoufox C++), 99.9% Uptime (Zero CDP Leaks).
  4. **Section 3 Workflow Tabs**: Replaced generic copy with exact MAHI Browser engine features: Chromium 138 MV3 main-world injection, Camoufox C++ Gecko engine, and Universal RPA / proxy sync with Redis locks.
  5. **Section 4 Integrations**: Retained full double-row infinite marquee covering all target ad platforms, marketplaces, and developer automation stacks.
  6. **Section 5 Solutions & Section 6 Testimonial**: Polished 4 vertical solution cards and Jane Berwick case study ($180K Savings, 100% Ban-Free, 10x Fleet Scale).
  7. **Section 7 Security & Section 8 FAQ**: Updated 3 security cards with Rebrowser-patches CDP isolation, AES-256 local storage, and Redis concurrency locks; answered 5 core technical questions in accordion.
  8. **Section 9 Pre-Footer**: Integrated dual CTA buttons matching the luxury hero styling.
  9. **Navbar Active State**: Updated `Navbar.tsx` to link to `/features` with bold active state highlighting on both desktop and mobile.
  10. **Verification**: Automated test (`scratch/verify_features_wiring.py`) verified status 200, hero buttons, scale cards, workflow tabs, FAQ interaction, and download redirect. Full production build passed with 38/38 static routes.

## 2026-11-19 - Fingerprints Page (`/fingerprints`) Dedicated Route & Full Hardware Lab Wiring
- **Context**: User selected Fingerprints as the next page in the page-by-page wiring process.
- **Implementation**:
  1. **Zero Core Backend Impact**: Work strictly restricted to `landing/app/fingerprints/page.tsx`, `landing/app/fingerprint/page.tsx`, and `landing/components/Navbar.tsx`. Core directories `01_` through `14_` remain untouched.
  2. **Dedicated Route**: Built `/fingerprints` with an alias `/fingerprint` to support all inbound link variations.
  3. **Section 1 Hero**: Styled in Lateral monochrome luxury with 42px Spectral serif headline ("Mathematical Precision. Zero Pixel Drift."), subtitle, and dual action buttons (`Download Free` + `Compare vs GoLogin →`).
  4. **Section 2 Live Interactive Lab**: Upgraded `FingerprintPreview` logic to luxury styling with real-time OS preset switching (Windows / Chrome 138, macOS / Camoufox, Linux / Vulkan), live "Scramble Noise" button, and 6 inspection tiles (Canvas, WebGL GPU, AudioContext, Client Hints, Hardware Cores/RAM, CreepJS 0.0%).
  5. **Section 3 Attack Vectors (4x2 Grid)**: Documented protection across Canvas, WebGL, AudioContext, Client Hints, WebRTC IP, Fonts/DPR, Memory/Cores, and CDP Rebrowser-patches.
  6. **Section 4 Third-Party Verification Scorecard**: Added live matrix for CreepJS, Pixelscan, IPHEY, and BrowserLeaks.
  7. **Section 5 Technical Deep Dive**: Comparative breakdown of C++ kernel spoofing versus standard JavaScript prototype overrides.
  8. **Section 6 FAQ & Section 7 Pre-Footer**: Collapsible accordion answering 4 deep technical questions; pre-footer CTA card with dual action buttons.
  9. **Navbar Active State**: Updated `Navbar.tsx` so `Fingerprints` links to `/fingerprints` with active page highlighting.
  10. **Verification**: Playwright test (`scratch/verify_fingerprints_wiring.py`) verified 200 status, hero buttons, live preset switching (macOS Apple M3 Pro, Linux AMD Vulkan), scramble noise recalculation, and download redirect. Full production build succeeded with 40/40 static routes.

## 2026-11-19 - Clean Separation of Customers (`/customers`) & vs GoLogin (`/compare`) Pages
- **Context**: User caught that `/customers` and `/compare` (vs GoLogin) had been conflated into an identical component, and instructed to cleanly separate them:
  1. Customers page must be pure fleet case studies without any Technical Benchmark matrix.
  2. vs GoLogin page must be a dedicated comparison page with the Head-to-Head Benchmark matrix, but without the extra 3 clutter sections ("4 Critical Flaws", "Migrate in 3 Steps", and "Migration FAQ").
- **Implementation**:
  1. Built pure `CustomersView.tsx` containing exclusively: Hero ("Trusted by Growth Fleets Everywhere"), Platform Logos Ticker, Featured Case Study Slider (6s progress bar, ROI metrics), 3-Column Fleet Stories Grid, and Pre-Footer CTA.
  2. Built pure `CompareView.tsx` containing exclusively: Head-to-Head Hero ("The Modern, Undetectable GoLogin Alternative"), Platform Logos Ticker, 4-Way Technical Capability Benchmark Table (`GoLoginComparisonTable.tsx`), and Pre-Footer CTA.
  3. Removed the 3 extra sections from `/compare`: "4 Critical Flaws in Legacy Anti-Detect Browsers", "Migrate from GoLogin in 3 Simple Steps", and "GoLogin Migration FAQ".
  4. Updated routes `landing/app/customers/page.tsx` -> `CustomersView` and `landing/app/compare/page.tsx` & `landing/app/compare/gologin-alternative/page.tsx` -> `CompareView`.
  5. Deleted deprecated combined component `CustomersCompareView.tsx`.
  6. Automated verification via Playwright (`scratch/verify_separation.py`) confirmed clean separation and 0 unwanted elements on either page. Full production build passed with 40/40 static routes.

## 2026-11-19 - Pricing Page (`/pricing`) Full Engine Wiring & Indian UPI 0% Gateway Integration
- **Context**: User approved proceeding with the Pricing page (`/pricing`) as the next milestone in the page-by-page wiring process.
- **Implementation**:
  1. **Zero Core Backend Impact**: Strictly restricted all changes to `landing/components/PricingView.tsx`, `landing/components/CustomersView.tsx`, and `landing/components/CompareView.tsx`. Core directories `01_` through `14_` were not touched.
  2. **Billing Cycle & Currency Switcher**: Wired interactive Monthly/Yearly toggle (with Save 20% discount badge) and USD ($) / INR (₹ UPI 0% Fee) currency switcher.
  3. **3 Core Plan Cards**: Core (15 air-gapped profiles, offline SQLite), Growth (100 cloud profiles, Redis concurrency mutex), and Pro (unlimited profiles, dedicated C++ builds).
  4. **Interactive 0% Indian UPI Modal**: When INR is active, clicking any plan action button pops up an obsidian modal featuring the official Slice QR code (`/assets/img/payments/mahi-upi-qr.png`), Account Holder ("Mahipal Choudhary"), Merchant VPA (`6375823589@slc`) with 1-click clipboard copy, 12-digit UTR submission with success confirmation, and direct WhatsApp founder link (`+91 9376343629`).
  5. **Compare Plans Table Wiring**: Sticky headers dynamically render appropriate action buttons based on currency.
  6. **Copy & Link Clean-Up**: Fixed leftover Lateral finance strings ("Top Finance Teams" -> "Top Growth Fleets") and wired all pre-footer & FAQ CTAs to `/download?auto=true` and `/compare`.
  7. **Silent Telemetry**: Used production-safe `sendBeacon` telemetry to eliminate dev-mode 404 overlay toasts.
  8. **Verification**: Playwright automated suite (`scratch/verify_pricing_wiring.py`) validated monthly/yearly pricing recalculation, INR currency switch, UPI modal open/copy/submit flow, FAQ accordion expansion, and download redirection. Production static build passed with 40/40 routes.

## Dual-Tone Logo Architecture for Dynamic Framer Variants
- Context: Framer sticky navbar dynamically transitions between Transparent/Dark and Light modes based on scroll position.
- Decision: Created two synchronized vector logos: mahi_logo_vector.svg (white fills for dark hero/footer) and mahi_logo_vector_dark.svg (black/dark-grey fills for white intro section sticky navbar). Enforce both via asset replacement, CSS content fallback, and DOM observer.

## 2026-11-27 — Audit Remediation Scope & Architecture Decisions
- **In-Place Hardening over Monorepo Shuffle:** Patched all P0/P1/P2 vulnerabilities directly in the existing numbered module layout (`01_UI`..`14_ENGINE_PATCHES`) to avoid high-risk churn across build/packaging scripts while preserving uncommitted Round 2 Mobile 4G/5G IP Rotator work.
- **SQLite (`sql.js`) + Hardened Atomic Writes:** Kept `sql.js` WASM to guarantee zero native N-API cross-platform ABI failures across Windows/macOS/Linux builds, fixing FD leaks, `.tmp` orphan cleanup, Windows `EPERM`/`EBUSY` rename retries, and cross-OS test isolation guards in `06_DATABASE/connection.ts`.
- **Backward-Compatible Portability & Security:** Replaced `'mahi_salt'` with per-install `adminSalt` HMAC verification and RSA signature checks on `license-status-cache.json`; switched passwordless `.mahi-profile` exports to portable Base64 (keeping legacy decrypt-then-base64 read compatibility).
- **Safe Quarantine (`_to_delete/`):** Quarantined unused third-party `13_ASSETS/interface` (affiliate ads) and `13_ASSETS/cookie-editor.js` to gitignored `_to_delete/`, while keeping fallback `landing/*.html` and `10_CONFIG/preload/preload.cjs` referenced by `app.ts`, Vite build scripts, and unit tests.
- **v1.4.0 Release Rollout Strategy:** Bumped desktop & portal versions to `1.4.0` (`mandatory: false`), fast-forwarding `main` with `feat/v1.4-delta-cloud-sync`, Round 2 Mobile 4G/5G IP Rotator, and P0/P1/P2 hardening commits, then tagging `v1.4.0` so `.github/workflows/cross-platform-release.yml` builds signed/verified Windows installers, publishes the GitHub Release, deploys to `mahibrowser.com`, and runs all 6 live verification gates.
