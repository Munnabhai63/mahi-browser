# MAHI BROWSER — Clean Onboarding & Authoritative Premium Entitlements System Report

**Date:** October 9, 2026  
**Document Version:** 1.0.0 (Production / Commercial Release)  
**Authoritative Baseline:** Database Schema v18 (Stable, Zero Migrations Required)  
**Status:** COMPLETE & VERIFIED  

---

## Executive Summary

This report documents the architectural design, security enforcement, and verification of two key commercial capabilities in **MAHI Browser**:

1. **Clean New-User Profile Experience:** Elimination of clutter for brand-new users. Instead of seeing dozens of mock accounts or empty, confusing lists, a first-run user experiences a clean onboarding view with **6 carefully crafted Starter Demo Profile Cards** that explain the structure of isolated profiles, demonstrate anti-detect categories, and offer a seamless "Use Template → Create My Profile" clone flow. Demo profiles carry zero real session data or passwords, do not create cross-user database rows, and never consume real profile quotas. Existing users with real profiles remain completely unaffected and retain full access to templates via a dedicated tab.
2. **Authoritative Premium Feature Entitlement System:** Complete end-to-end capability-based access control (`FeatureCapability`). Premium capabilities (Cloud Sync, Cloud Browser, Built-in Commercial Proxies, Visual RPA Automation, Scheduler, Cookie Warmer, CDP Multi-Window Synchronizer, Team Workspaces, Profile Sharing, and Remote Cloud APIs) are enforced authoritatively across **UI**, **Desktop IPC**, **Remote API**, and **Backend Services**. Free users enjoy a robust free core (up to 15 profiles, local browser launches, manual BYOP proxies) while discovering premium features through non-intrusive badges (`PRO`, `BIZ`) and high-converting upgrade modals instead of raw HTTP 403 errors.

---

## 1. Before vs. After Onboarding Experience

| Aspect | Before | After |
| :--- | :--- | :--- |
| **New User First Run** | Empty table with plain icon or cluttered historical mock accounts. | **Clean Onboarding Hero Banner** + **6 Curated Starter Profile Cards**. |
| **Profile Discovery** | User had to guess what parameters, OS, or fingerprint settings look like. | User visually previews screen resolution, user agents, canvas/audio noise, and category blueprints. |
| **First Real Profile Action** | Generic form without context. | Prominent **"+ Create My Profile"** CTA and **"Use Template"** 1-click clone workflow. |
| **Existing Users** | Risk of clutter if demo profiles were injected into database. | **Zero Database Injection.** Templates are in-memory blueprints. Existing users see their real profiles untouched. |
| **Long-Term Access** | Templates vanished after onboarding. | Clean **"Starter Templates"** tab alongside folders allows accessing templates at any time without list clutter. |

---

## 2. Starter Demo Profiles Model

Six distinct starter blueprints are defined in `02_BROWSER/services/starter-profiles-service.ts`:

1. **Personal Browsing (`starter_personal`):**
   - *Category:* `PERSONAL` | *Badge:* `STARTER`
   - *Blueprint:* Clean everyday private browsing, Windows 11 Chrome 128, standard canvas & audio noise emulation.
2. **Social Media Profile (`starter_social`):**
   - *Category:* `SOCIAL` | *Badge:* `DEMO`
   - *Blueprint:* Social media identity container (Facebook, X, Instagram, LinkedIn), macOS Sonoma Chrome 128, isolated WebGL vendor.
3. **E-Commerce Store Profile (`starter_ecommerce`):**
   - *Category:* `E-COMMERCE` | *Badge:* `STARTER`
   - *Blueprint:* Merchant store container (Amazon, eBay, Shopify, Stripe) with strict WebRTC and proxy locking.
4. **Business & Work Profile (`starter_business`):**
   - *Category:* `WORK` | *Badge:* `DEMO`
   - *Blueprint:* Enterprise client workspace container for business SaaS, analytics, and CRM dashboards.
5. **Automation Example Profile (`starter_automation`):**
   - *Category:* `AUTOMATION` | *Badge:* `EXAMPLE`
   - *Blueprint:* Pre-configured for Visual RPA execution, multi-window CDP synchronizer, and cookie warming.
6. **Sandbox & Test Profile (`starter_sandbox`):**
   - *Category:* `SANDBOX` | *Badge:* `DEMO`
   - *Blueprint:* Ephemeral testing environment for anti-detect fingerprint verification and ad validation.

### Data Isolation & Quota Exclusion
- **Zero Real Credentials:** Templates contain no passwords, cookies, authorization tokens, or persistent session folders.
- **Zero Database Footprint:** Starter cards are purely code-defined structures. No shared IDs or cross-user database rows exist.
- **Quota Exemption:** Starter template cards do *not* count towards a user's real profile quota.
- **Cloning Flow:** Clicking "Use Template" opens a name confirmation dialog and executes `createProfileFromStarter(templateId, options)`. Quota is evaluated via `assertCanCreateProfile(1)` before instantiating the real profile.

---

## 3. Authoritative Central Entitlement Architecture

### 3.1 Capability Model (`FeatureCapability`)
Each product capability maps to a strongly typed capability string defined in `10_CONFIG/shared/types/commercial.ts`:

```typescript
export type FeatureCapability =
  | 'profile.basic'           // Basic local browser profile creation
  | 'profile.multiple'        // Bulk profile generation
  | 'cloud.sync'              // GoLogin-style encrypted cloud profile sync
  | 'cloud.browser'           // Remote cloud compute browser sessions
  | 'proxy.builtin'           // Commercial residential & mobile proxies
  | 'proxy.custom'            // BYOP custom HTTP/SOCKS5 manual proxies
  | 'automation.rpa'          // Visual RPA automation engine execution
  | 'automation.scheduler'    // Automated scheduled workflow triggers
  | 'automation.multiProfile'  // Batch parallel automation execution
  | 'automation.cookieWarmer'  // Autonomous cookie warming & farming
  | 'automation.synchronizer'  // Multi-window CDP keyboard/mouse synchronizer
  | 'workspace.team'          // Team organization creation & member seats
  | 'workspace.sharing'       // Cross-user profile sharing & permissions
  | 'api.remote'              // External Developer REST API v2
  | 'api.webhooks'            // Outbound webhook notification triggers
  | 'mobile.cloudBrowser'     // Android mobile companion cloud launch
  | 'advanced.fingerprint';   // Deep hardware canvas/WebGL noise control
```

### 3.2 Plan Capability Matrix

| Feature / Capability | FREE | PRO | BUSINESS | ENTERPRISE |
| :--- | :---: | :---: | :---: | :---: |
| **Max Real Profiles** | **15 Profiles** | **100 Profiles** | **300 Profiles** | **Custom / Unlimited** |
| `profile.basic` | **ENABLED** | **ENABLED** | **ENABLED** | **ENABLED** |
| `proxy.custom` (BYOP) | **ENABLED** | **ENABLED** | **ENABLED** | **ENABLED** |
| `cloud.sync` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `cloud.browser` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `proxy.builtin` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `automation.rpa` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `automation.scheduler` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `automation.cookieWarmer` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `automation.synchronizer` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `workspace.sharing` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `workspace.team` | 🔒 LOCKED | 🔒 LOCKED | **ENABLED** | **ENABLED** |
| `automation.multiProfile` | 🔒 LOCKED | 🔒 LOCKED | **ENABLED** | **ENABLED** |
| `api.remote` | 🔒 LOCKED | **ENABLED** | **ENABLED** | **ENABLED** |
| `api.webhooks` | 🔒 LOCKED | 🔒 LOCKED | **ENABLED** | **ENABLED** |

---

## 4. Multi-Layer Enforcement Guards

Enforcement exists across all application surfaces to prevent unauthorized usage or client-side tampering:

### 1. UI Layer
- Locked features display subtle badges (`PRO`, `BIZ`) and lock icons in navigation (`Sidebar.tsx`, etc.).
- Clicking a locked navigation item or action opens `UpgradeModal.tsx` detailing plan benefits and a direct checkout flow, completely eliminating raw 403 errors.

### 2. Desktop IPC Layer (`07_BACKEND/ipc/register-handlers.ts`)
- `profiles:warm` & `profiles:warmBulk`: guarded with `assertCapability('automation.cookieWarmer')`.
- `automation:runWorkflow`: guarded with `assertCapability('automation.rpa')`.
- `automation:runWorkflowBatch`: guarded with `assertCapability('automation.multiProfile')`.
- `synchronizer:start`: guarded with `assertCapability('automation.synchronizer')`.
- `sync:upload`, `sync:restore`, `sync:syncAll`: guarded with `assertCapability('cloud.sync')`.
- `teamWorkspace:create`: guarded with `assertCapability('workspace.team')`.
- `teamWorkspace:shareProfile`: guarded with `assertCapability('workspace.sharing')`.

### 3. Remote API Layer (`07_BACKEND/commercial/remote-api-router.ts`)
- Remote endpoints enforce capability checks before execution:
  - `POST /api/v1/workspaces` → `requireFeature('workspace.team')`
  - `POST /api/v1/cloud-browser/sessions` → `requireFeature('cloud.browser')`
  - `POST /api/v1/automation/workflows` → `requireFeature('automation.rpa')`
  - `POST /api/v1/automation/schedules` → `requireFeature('automation.scheduler')`
  - `POST /api/v1/profiles` → quota assertion `assertCanCreateProfile(1)`
- Unauthorized calls immediately return HTTP 403 with standard structured payload:
  ```json
  {
    "success": false,
    "error": "Feature 'cloud.browser' requires PRO or higher plan.",
    "code": "FEATURE_NOT_INCLUDED",
    "requiredPlan": "PRO"
  }
  ```

### 4. Billing & Instant Unlock Flow
- Activating a key (`commercialActivateKey`) or processing a webhook updates user plan in SQLite/central store.
- `evaluateUserEntitlements()` immediately evaluates the new tier capabilities dynamically without requiring software restart or reinstallation.
- When a plan expires, capabilities revert to Free while preserving all existing user profiles and local data.

---

## 5. Verification & Test Summary

A dedicated verification suite `11_TESTS/unit/phase16-onboarding-and-premium-entitlements.test.ts` was implemented:

1. **Starter Template Verification:** Validated 6 templates, categories, and zero credential leakage.
2. **Quota Isolation:** Validated templates do not increment `profiles` table count until cloned.
3. **Existing User Protection:** Confirmed users with real profiles evaluate `isUserNew = false` and do not receive synthetic profile rows.
4. **Plan Matrix Verification:** Verified Free, Pro, and Business capability resolutions against expected permissions.
5. **Guard & Bypass Testing:** Verified `assertEntitled` and `assertCapability` reject unauthorized access with structured `FEATURE_NOT_INCLUDED` errors.
6. **TypeScript Compilation:** Zero errors across renderer (`tsc`) and electron main (`tsc -p tsconfig.electron.json`).
7. **Database Integrity:** Zero migrations required; schema version preserved at **v18**.
