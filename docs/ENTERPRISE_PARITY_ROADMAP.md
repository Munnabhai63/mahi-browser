# MAHI Browser — Enterprise Parity Roadmap (`digihubselllatest` Benchmark 95+ Plan)

> **Created:** 2026-11-28  
> **Baseline Commit:** `a0795fd` (Phases 1–4 Complete; Health Score `41/100` → **`83/100`**)  
> **Target:** Full operational, code-cleanliness, structural, and supply-chain parity (**`95+ / 100`**) matching `digihubselllatest` discipline across all runtimes.  
> **Execution Rule:** Complete **one phase / sub-step at a time**, keep `f:\UserData\Downloads\digihubselllatest` strictly read-only, run verification checks after every sub-step, update checkboxes here + `docs/progress.md` + `docs/decisions.md`, and checkpoint clean Git commits per phase.

---

## Completed Foundation (Phases 1–4 Baseline — `83 / 100`)

- [x] **Phase 1 (`P0` Security):** Removed `'testing-bypass'` TOTP fallback, enforced non-staff `404` stealth, added DB/session status & revocation checks (`getAuthUserAsync`), proxy SSRF + DNS rebinding guard, `z.strictObject()` + safe `AppError` masking, `getCloudEnv()` startup guard, strict API CSP & security headers (`2ade6c9`).
- [x] **Phase 2 (`P0/P1` DB, Payments & Redis State):** Tunable `pg.Pool` + `DB_SSL_CA` (`pool-config.ts`), `prisma.$transaction` + `FOR UPDATE` row locks + deterministic webhook SHA-256 IDs, Redis Lua atomic rate limits/sessions with PG fallback, and TOTP-gated `EMERGENCY_KILL_SWITCH` (`cafa427`).
- [x] **Phase 3 (`P1` Gateway & Backend Modularity):** Replaced `setNotFoundHandler` + `reply.hijack()` with native Fastify prefix plugins (`fastify-route-adapter.ts`), async streamed file I/O (`app.ts`, `local-api-server.ts`), and split `payment-service.ts`, `admin-owner-routes.ts`, and `remote-api-router.ts` (`0634e72`).
- [x] **Phase 4 (`P1/P2` Frontend Perf, HttpOnly Web Auth, SEO & Hygiene):** `React.lazy` + `<Suspense>` (`main-*.js`: `902.2 KB` → `39.10 kB`), `ProfilesList.tsx` (`3,344` → `1,133` lines), `HttpOnly; SameSite=Lax` web auth cookies + OAuth URL token removal, `next/font/google`, `error.tsx`/`not-found.tsx`/`manifest.ts`, `prefers-reduced-motion`, and `os.tmpdir()` test isolation (`a0795fd`, live across `api.mahibrowser.com`, `mahibrowser.com`, `app.mahibrowser.com`).

---

## Current Audit Scorecard & Remaining Gaps

| Metric | `digihubselllatest` (`233` TS/TSX files) | `MAHI Browser` (`348` TS/TSX files) | Target |
| :--- | :---: | :---: | :---: |
| Executive Health Score | `~92–95 / 100` | **`83 / 100`** | **`95+ / 100`** |
| `: any` / `as any` casts | `1` | **`1,507`** | `< 50` (typed rows/DTOs) |
| Silent `catch {}` blocks | `1` | **`619`** | `< 20` (logged/handled) |
| Lint warnings | `0` ESLint errors | `0` Biome errors / **`3,625` warnings** | `0` Biome warnings |
| Sync FS in `05/07/08` | Async / edge clean | **`130+` sync calls** (`52` in `cloud-sync-service.ts`) | Async `fs.promises` in runtime paths |
| `console.*` noise | `73` | **`233`** | Unified structured logger |
| Root `npm audit` | Modern deps | **`17` (`2 critical`, `6 high`)**; `3 high` in `--omit=dev` | `0 critical / 0 high` |
| React / Tailwind | `React 19.3` / `Tailwind v4` | `React 18.3.1` / `Tailwind 3.4` | `React 19` / `Tailwind v4` |
| CI / Deploy Parity | Unified SSR + `drizzle` | Missing live `0003` PG migration, live Nginx CSP, automated `dist/` VPS deploy, E2E/stress CI | Fully synced & automated |

---

## Remaining Execution Roadmap (Phases 5–9)

### Phase 5 — Live VPS, Database Schema, Nginx CSP & Deploy Automation (`P0`)
> Close all live production & CI/CD discrepancies uncovered after `a0795fd`.

- [ ] **5A. VPS `.env` Security Completion (`/opt/mahi-browser/.env`):** *(5A.1–5A.2 complete; 5A.3 R2 cutover pending Cloudflare R2 credentials)*
  - [x] Generate Base32 `MAHI_OWNER_TOTP_SECRET` (`>= 16` chars — 32-char Base32 configured in VPS `/opt/mahi-browser/.env`; enrollment URI saved outside repo at `C:\Users\munaf\.mahi-owner-totp.uri` with user-only ACLs for Authenticator scan), add `/api/v1/admin/owner/verify-totp` route alias, and verify `/verify-totp` + `/kill-switch` end-to-end on live VPS.
  - [x] Set `MAHI_WEBSITE_URL=https://mahibrowser.com` explicitly in VPS `.env` and validate `MAHI_WEBSITE_URL` in `07_BACKEND/utils/cloud-env.ts`.
  - [ ] Cut over `STORAGE_PROVIDER` from `local` to Cloudflare R2 (`R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`) once credentials are supplied (`STORAGE_PROVIDER=local` kept intentionally).
- [x] **5B. Prisma Migration `0003` & Live Supabase Parity (`prisma/`):**
  - [x] Add `prisma/migrations/0003_sync_runtime_and_deltas/migration.sql` + `system_runtime_state`/`system_runtime_flags` in `prisma/schema.prisma` covering `cloud_sync_upload_sessions.archive_format`/`manifest_hash`, `cloud_profile_deltas`, and `mobile_device_tokens.device_model`.
  - [x] Apply migration `0003` against live Supabase Postgres (`blpqtardobbxnepbegfn`), mark applied in Prisma (`prisma migrate resolve --applied 0003_sync_runtime_and_deltas` + `prisma migrate status`), and verify `POST /api/v1/sync/upload-session` + `cloud_profile_deltas` + `system_runtime_state` with zero column errors in Gateway logs.
  - [x] Define and apply PostgreSQL RLS policies (`mahi_gateway_service_access`) across all `53` Supabase `public` tables (`0` security advisor lints) while verifying `mahi_gateway` role read/write parity and denying `anon`/`authenticated`.
- [x] **5C. Nginx CSP/COOP Parity (`10_CONFIG/infrastructure/nginx-production.conf` + Live VPS):**
  - [x] Fix checked-in `nginx-production.conf` `app.mahibrowser.com` server block to declare `root /var/www/mahibrowser/dashboard/dist;` explicitly, tightened `script-src 'self'` CSP, and added security headers on JS/MJS/CJS assets.
  - [x] Update `mahibrowser.com` CSP header in `nginx-production.conf` (dropped unused `https://fonts.googleapis.com` / `https://fonts.gstatic.com`, added `proxy_hide_header` on `/api/` + `/v1/` + `api.mahibrowser.com`, enforced `Permissions-Policy` & `Cross-Origin-Opener-Policy: same-origin` cleanly).
  - [x] Sync updated config to live VPS `/etc/nginx/sites-available/mahibrowser.com`, validate `nginx -t`, reload Nginx, and verify `Content-Security-Policy` + `COOP` on `https://mahibrowser.com/pricing` and `https://app.mahibrowser.com/`.
- [x] **5D. CI-Gated & Automated Web Dashboard Deployment (`.github/workflows/`):**
  - [x] Add Vite Web Dashboard `dist/` build (`npm run build` with `MAHI_SKIP_ADB_STAGE=1`) + atomic rsync upload to `/var/www/mahibrowser/dashboard/dist` in `.github/workflows/deploy-dashboard.yml`.
  - [x] Gate `deploy-gateway.yml`, `deploy-landing.yml`, and `deploy-dashboard.yml` via `.github/actions/wait-for-ci` (`ci-gate` job requiring green `CI Verification` on `github.sha` before `deploy-vps`), preserving the `production` GitHub environment approval rule (`Munnabhai63`, `can_admins_bypass: false`).

---

### Phase 6 — Eliminate Hardcodings & Unify Env-Driven Config (`P1`)
> Match `digihubselllatest`'s `lib/site-config.ts` + `lib/server/env.ts` single-source discipline.

- [x] **6A. Centralize URLs via `siteConfig` / `cloud-env.ts` (`WEBSITE_URL`, `APP_URL`, `API_URL`):**
  - [x] Create a single typed runtime config resolver ([10_CONFIG/shared/site-config.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/10_CONFIG/shared/site-config.ts) + [landing/lib/site-config.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/lib/site-config.ts)) reading `WEBSITE_URL` / `MAHI_WEBSITE_URL`, `APP_URL`, `API_URL`, and `SUPPORT_EMAIL` with safe local/dev defaults (`cloud-env.ts` validates `WEBSITE_URL`/`MAHI_APP_URL`/`MAHI_API_URL` HTTPS in production).
  - [x] Replace `6` hardcoded `https://mahibrowser.com/verify-email` & `/reset-password` template strings in [central-auth-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/central-auth-service.ts) with env-derived URLs.
  - [x] Replace hardcoded URLs in [team-workspace-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/team-workspace-service.ts) (`inviteUrl`), [support-ticket-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/support-ticket-service.ts), [google-oauth-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/google-oauth-service.ts), [updater-provider.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/updater-provider.ts), [updater-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/updater-service.ts), [price-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/price-service.ts), [account-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/account-service.ts), [license-status-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/license-status-service.ts), and [brand-config.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/10_CONFIG/brand-config.ts) (plus `01_UI` modals, `cloud-sync-service.ts`, `auth-routes.ts`, `landing/lib/brand.ts`, and `landing/lib/redirect.ts`).
  - [x] Remove dead placeholder subdomains (`checkout.mahibrowser.com`, `invoices.mahibrowser.com`) in [payment-adapters.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/payments/payment-adapters.ts) and [payment-activation.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/payments/payment-activation.ts) and point fallbacks to live `WEBSITE_URL` / `API_URL` endpoints.
- [x] **6B. Env-Configurable Contact & Payment Metadata (`10_CONFIG/contact-config.ts`):**
  - [x] Allow env overrides (`BUSINESS_EMAIL`, `SUPPORT_EMAIL`, `WHATSAPP_NUMBER`, `UPI_ID`, `UPI_ACCOUNT_HOLDER`, `USDT_ADDRESS`, `USDT_NETWORK`) in `10_CONFIG/contact-config.ts` (`getRuntimeContactConfig()` + live `CONTACT_CONFIG` getters) and Gateway runtime routes instead of immutable source literals, preserving production defaults.
  - [x] Ensure Landing/UI reads dynamic payment/support metadata from `/api/v1/billing/gateways` (enriched with `upi_manual` + `support` fields) and `NEXT_PUBLIC_*` / `BRAND` accessors cleanly without leaking staging vs production identities, verified by [phase6-env-config-centralization.test.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/11_TESTS/unit/phase6-env-config-centralization.test.ts).

---

### Phase 7 — Code Cleanliness: Strict Types, Zero Silent Catches, Async I/O & Structured Logger (`P1/P2`)
> Drive `: any` (`1,507` → `< 50`), silent `catch {}` (`619` → `< 20`), Biome warnings (`3,625` → `0`), and `console.*` (`233`) toward `digihubselllatest` clarity.

- [ ] **7A. Structured Logger & Redaction (`07_BACKEND/utils/logger.ts`):**
  - [ ] Introduce a central redact-safe structured logger (`info`/`warn`/`error`/`debug` + `requestId` / module context), replacing raw `console.log`/`warn`/`error` calls (`233`) across runtime services (`02_BROWSER`, `05_AUTH`, `07_BACKEND`, `08_SECURITY`).
- [ ] **7B. Eliminate Silent `catch {}` Blocks (`619` → `< 20`):**
  - [ ] Batch 1 (Core Desktop & Sync): [launcher.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/launcher.ts) (`131`), [managed-engine.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/managed-engine.ts) (`24`), [cdp-synchronizer.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/cdp-synchronizer.ts) (`17`), [process-manager.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/process-manager.ts) (`15`), [engine-download-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/services/engine-download-service.ts) (`11`).
  - [ ] Batch 2 (DB, Auth & Security): [cloud-sync-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/cloud-sync-service.ts) (`30`), [account-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/account-service.ts) (`23`), [connection.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/connection.ts) (`19`), [admin-data-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/admin-data-service.ts) (`13`), [google-oauth-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/google-oauth-service.ts) (`12`).
  - [ ] Batch 3: Audit and clean remaining files across `01_UI/` and `07_BACKEND/`, ensuring DB/network failures log cleanly and non-fatal cleanup catches carry explicit rationale comments.
- [ ] **7C. Eliminate `: any` / `as any` (`1,507` → `< 50`):**
  - [ ] Batch 1 (DB & Admin): Typed SQLite/Prisma row interfaces in [central-repository.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/central-repository.ts) (`81`), [admin-data-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/admin-data-service.ts) (`79`), [owner-console-routes.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/routes/admin/owner-console-routes.ts) (`50`).
  - [ ] Batch 2 (Auth, Payments, Cloud & Licensing): [account-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/account-service.ts) (`46`), [cloud-profile-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/cloud-profile-service.ts) (`43`), [license-engine.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/04_LICENSING/license-engine.ts) (`42`), [payment-activation.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/payments/payment-activation.ts) (`36`), [manual-payment-handlers.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/payments/manual-payment-handlers.ts) (`34`).
  - [ ] Batch 3 (IPC, Gateway & UI): [index.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/index.ts) (`47`), [register-handlers.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts) (`36`), and remaining UI/browser files.
- [ ] **7D. Async Filesystem Conversion in Remaining Backend/Security Services:**
  - [ ] Migrate blocking `fs.*Sync` calls in [cloud-sync-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/cloud-sync-service.ts) (`52` calls), [account-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/account-service.ts) (`15`), [register-handlers.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts) (`12`), [worker-profile-loader.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/cloud-browser/worker-profile-loader.ts) (`12`), [license-status-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/license-status-service.ts) (`10`), and [storage-provider.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/storage-provider.ts) (`10`) to `fs.promises`.
- [ ] **7E. Zero-Warning Biome Lint & `TODO` Cleanup:**
  - [ ] Resolve `3,625` warnings + `152` infos cleanly (`useImportType`, `useButtonType`, `noAutofocus`, unused vars, etc.) in batches, resolve or remove the `30` `TODO`/`FIXME` comments, and promote CI `npm run lint` to strict zero-warning mode.

---

### Phase 8 — Structural Consolidation, Monolith Splitting & Legacy Retirement (`P2`)
> Achieve `digihubselllatest`'s single-source, modular directory architecture.

- [ ] **8A. Consolidate Duplicate & Legacy Systems:**
  - [ ] Unify `auth_users` (PBKDF2 central) and legacy `commercial_users` (SHA-256 mirror/fallback) so registration/login/entitlements query one authoritative user model with zero split-brain fallback paths.
  - [ ] Merge duplicate `runtime-paths.ts` (`07_BACKEND/utils/runtime-paths.ts` vs `10_CONFIG/shared/runtime-paths.ts`) and clarify licensing module boundaries (`04_LICENSING/` vs `08_SECURITY/license-*.ts`).
  - [ ] Unify Electron preload ([10_CONFIG/preload/index.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/10_CONFIG/preload/index.ts) vs [preload.cjs](file:///c:/Users/munaf/Desktop/mahai%20brouser/10_CONFIG/preload/preload.cjs) + `fix-preload.cjs`) into one compiled source.
- [ ] **8B. Split Remaining Oversized Monoliths (`> ~400` lines/file target where practical):**
  - [ ] UI/Landing: Split [AccountModal.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/AccountModal.tsx) (`2,098` lines) and [PricingView.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/components/PricingView.tsx) (`1,564` lines) into focused subcomponents (`PlanGrid`, `ComparisonMatrix`, `UpiPaymentModal`, `CryptoPaymentModal`, `PricingFaq`, `AccountBillingTab`, `AccountSessionsTab`).
  - [ ] Backend/Database: Modularize [register-handlers.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/ipc/register-handlers.ts) (`2,782` lines → domain IPC modules), [cloud-sync-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/08_SECURITY/cloud-sync-service.ts) (`1,782`), [cloud-profile-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/services/cloud-profile-service.ts) (`1,735`), [local-api-server.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/api/local-api-server.ts) (`1,671`), [central-auth-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/central-auth-service.ts) (`1,349`), [auth-routes.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/routes/auth-routes.ts) (`1,313`), [schema.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/schema.ts) (`1,609`), and [central-repository.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/06_DATABASE/central-repository.ts) (`1,604`).
  - [ ] Browser Core: Decompose [launcher.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/02_BROWSER/launcher.ts) (`4,969` lines) into `chromium-args-builder.ts`, `camoufox-launcher.ts`, `cdp-attach-helper.ts`, `extension-loader.ts`, and `launch-orchestrator.ts`.
- [ ] **8C. Externalize Admin HTML Scripts (`'unsafe-inline'` Removal):**
  - [ ] Extract inline JavaScript and styles out of [web-admin.template.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/templates/web-admin.template.ts) (`2,268` lines), [super-admin.template.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/templates/super-admin.template.ts), and [owner-admin.template.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/server/templates/owner-admin.template.ts) into static bundled assets served under strict `script-src 'self'`, removing `'unsafe-inline'` scripts from `ADMIN_HTML_CSP` / `PORTAL_HTML_CSP` and Nginx.
- [ ] **8D. Retire Legacy `landing/*.html` & Workspace Clutter:**
  - [ ] Migrate assertions in [step3-onboarding-trial-deeplink.test.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/11_TESTS/unit/step3-onboarding-trial-deeplink.test.ts) and [google-oauth-runtime-prevention.test.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/11_TESTS/unit/google-oauth-runtime-prevention.test.ts) to test modern Next.js routes (`landing/app/*`, `landing/components/*`, `landing/out/*.html`), then delete the `11` stale root `landing/*.html` / `landing/content.json` / `robots.txt` / `sitemap.xml` legacy copies.
  - [ ] Archive historical phase reports inside [docs/](file:///c:/Users/munaf/Desktop/mahai%20brouser/docs) (`63` files → `docs/archive/`) and audit root clutter (`Mahi terabox/`, `scratch/`, `Run_MAHI_*.bat`, `brand-assets.json`).

---

### Phase 9 — Supply Chain Upgrades, Modern Frontend (`React 19` + `Tailwind v4`) & Full CI Gates (`P2`)
> Clear `npm audit` critical/high findings, match `digihubselllatest` React/Tailwind generation, and run E2E/stress gates in CI.

- [ ] **9A. Clear Root `npm audit` Advisories (`0 critical / 0 high`):**
  - [ ] Upgrade `vitest` (`2.1.8` → `5.x`) and resolve `tinypool`/`vite` critical/high dev advisories; re-verify all unit/integration suites.
  - [ ] Upgrade `electron` (`33.2.1` → latest patched `45.x` / compatible release) + `extract-zip` and verify packaged Electron `--smoke-test` + Chromium/Camoufox launch.
  - [ ] Resolve `prisma@7.10.1` transitive `@prisma/config` / `effect` high advisory cleanly when patched upstream without losing Prisma 7 adapter behavior.
  - [ ] Add `npm audit --omit=dev --audit-level=high` check in `.github/workflows/ci.yml`.
- [ ] **9B. React `19` + Tailwind `v4` Migration:**
  - [ ] Upgrade `react` & `react-dom` (`18.3.1` → `19.x`) in root (`01_UI`) and `landing/`, eliminating the Next.js 16 React 18 deprecation warning.
  - [ ] Migrate `tailwind.config.js` / `landing/tailwind.config.ts` (`3.4.x`) cleanly to Tailwind CSS v4 (`@tailwindcss/vite` / `@tailwindcss/postcss` + CSS `@theme` tokens).
- [ ] **9C. E2E & Stress Tests in CI (`11_TESTS/e2e` & `11_TESTS/stress`):**
  - [ ] Audit all `8` E2E test files (`11_TESTS/e2e/`) and `5` stress test files (`11_TESTS/stress/`), isolate any local env dependencies cleanly under `os.tmpdir()`, and enable an automated headless E2E + stress CI job in `.github/workflows/ci.yml`.

---

## Execution Protocol for Each Upcoming Step
1. Pick the next unchecked sub-step in order (`5A → 5B → 5C → 5D → 6A → ...`).
2. Inspect affected files first, preserve all working behavior, and avoid modifying `f:\UserData\Downloads\digihubselllatest`.
3. Run verification gates (`npm run typecheck`, `npm run build:gateway`, `npm --prefix landing run typecheck`, `npm --prefix landing run build`, `npm run lint`, `npm run test:ci`, plus live/container checks for VPS steps).
4. Mark completed `[x]` checkboxes here, update `docs/progress.md` and `docs/decisions.md`, and create a clean Git checkpoint commit.
