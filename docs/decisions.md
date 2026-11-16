# MAHI Browser — Architecture & Design Decisions

## Decision 1: Centralized Writable Runtime Path Resolver
- **Context:** Packaged desktop applications (installed in `C:\Program Files\MAHI Browser\` on Windows, `/Applications/MAHI Browser.app/` on macOS, or mounted read-only AppImages on Linux) throw fatal `EPERM` or `EACCES` errors if the app writes to `process.cwd()`.
- **Decision:** All runtime state writes (`crash-log.txt`, SQLite databases, updates, enc caches, cloud-workers, downloads) must resolve through `getWritableUserDataDir()` (`app.getPath('userData')` or OS appdata fallbacks). Static bundled resources must resolve through `getBundledResourcePath()` or `getLandingBaseDir()`.

## Decision 2: Atomic SQLite Single-Use Web Handoff Persistence
- **Context:** In-memory `Map` handoff tokens were lost across backend server restarts and lacked atomic concurrency guards across multi-process workers.
- **Decision:** Web handoff sessions are stored in SQLite table `web_handoff_sessions` and consumed atomically with `UPDATE web_handoff_sessions SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?`. This prevents token loss on restart and guarantees strict anti-replay protection.

## Decision 3: Trial & Subscription Entitlement Alignment
- **Context:** Querying only `status = 'ACTIVE'` skipped users on `status = 'TRIAL'`, and expired users could retain elevated plan limits indefinitely if downgrade was not persisted.
- **Decision:** Queries inspect `status IN ('ACTIVE', 'TRIAL')`. When a subscription or trial expires, an atomic DB update changes `status = 'EXPIRED'` on the subscription and resets `plan_id = 'plan_free'` on the user records.


## Decision 5: Supabase Central Auth & SQLite ID Synchronization & Account Security
- **Context:** During Google OAuth, users were previously created only in local SQLite without syncing to Supabase PostgreSQL `auth_users`, causing 401s and FK errors on R2 cloud profiles. Additionally, suspended accounts could be erroneously revived to `ACTIVE`, and Nginx dropped security headers on static dashboard assets.
- **Decision:** Google OAuth logins now query Supabase PostgreSQL `auth_users` first. If the user exists in PostgreSQL, that exact `userId` is reused and synced to SQLite with atomic child FK migration (`PRAGMA foreign_keys = OFF;` ... `ON;`). Suspended accounts are immediately blocked with `ACCOUNT_SUSPENDED` and their status is never overwritten to `ACTIVE`. If PostgreSQL is configured, errors fail closed to prevent split-brain accounts. In Nginx, all 4 security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `X-Robots-Tag`) are repeated inside static asset caching locations to guarantee strict inheritance.
