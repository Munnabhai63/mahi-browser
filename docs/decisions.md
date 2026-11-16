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

## Decision 4: Multi-Tenant VPS Isolation & Port Scoping
- **Context:** Hostinger VPS `200.97.164.97` hosts active production workloads (`desisexy.in`, `falcon-smm`, `m4k-cobalt-api`, `rumbletraffic.com`, `ytcpm.com`, `ytcpm.tech`). Standard ports `3000`, `4080`, `5050`, `5432`, `6379`, `9000` were already bound by other projects.
- **Decision:** MAHI Browser services are strictly isolated: Fastify Gateway binds strictly to `127.0.0.1:8989`, isolated Redis binds strictly to `127.0.0.1:6380` inside Docker (`mahibrowser_redis`), and persistent data is partitioned in `/var/lib/mahibrowser` and `/var/www/mahibrowser`. Nginx rate-limiting zones are uniquely namespaced (`mahi_api_rate_limit`, `mahi_auth_rate_limit`, `mahi_conn_limit`). PostgreSQL connects to managed Supabase (`aws-0-ap-south-1.pooler.supabase.com:5432`) and profile storage connects to Cloudflare R2 (`mahibrowser-profiles`), guaranteeing zero port collision or resource exhaustion for existing VPS tenants.
