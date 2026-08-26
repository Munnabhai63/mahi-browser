# MAHI BROWSER — Changelog

## [2.0.0] - 2026-08-27

### Added
- **Commercial User + Admin Architecture Layer**:
  - `commercial_users`, `commercial_plans`, `commercial_subscriptions`, `commercial_devices`, `commercial_audit_logs`, and `software_versions` SQLite tables (Migration v8).
  - Server-side user authentication service with PBKDF2 password hashing and signed JWT tokens (`07_BACKEND/commercial/commercial-auth-service.ts`).
  - Dynamic commercial plans service supporting `FREE`, `PRO`, `BUSINESS`, and `ENTERPRISE` tiers (`07_BACKEND/commercial/commercial-plan-service.ts`).
  - Authoritative entitlement evaluation pipeline with limit checks for profile count, concurrent instances, and feature flags (`07_BACKEND/commercial/commercial-entitlement-service.ts`).
  - Device identity and activation limit management with instant revocation (`07_BACKEND/commercial/commercial-device-service.ts`).
  - Structured, immutable commercial audit logger (`07_BACKEND/commercial/commercial-audit-service.ts`).
  - Software version management and compatibility checker (`07_BACKEND/commercial/commercial-version-service.ts`).
  - Centralized `/api/v1/*` commercial REST API router (`07_BACKEND/commercial/commercial-api-router.ts`).
  - Web Admin Control Center with 15 real sections, empty state handling, and zero fake numbers (`07_BACKEND/server/web-admin-html.ts`).
  - Commercial User & Device Management UI Modal (`01_UI/components/CommercialUserModal.tsx`).
  - Unit and integration tests verifying commercial auth, plan limits, device activations, REST APIs, and audit trails.

### Preserved
- 100% of existing browser engine, stealth Chromium flags, CDP synchronizer, proxy encryption, cookie/history managers, unpacked extension loaders, and RPA visual automation engine.
- 100% of existing desktop application UI layouts, themes, and navigation.
- All 218 baseline unit, integration, stress, and E2E tests continue passing without regression.
