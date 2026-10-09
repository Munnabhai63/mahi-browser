# MAHI Browser — Production Business Model & Pricing Architecture

**Version:** 1.0.0  
**Status:** PRODUCTION READY  
**Component:** Commercial Engine, Billing, Entitlements & Admin Pricing Suite  
**Date:** October 2026  

---

## 1. Executive Summary

MAHI Browser's production business model establishes an **admin-controlled, versioned, real-time entitlement and pricing system**. The entire architecture is grounded on a fundamental rule:

> **Price and Entitlements are strictly decoupled.**  
> A user's plan tier (e.g., Professional 50) determines their capabilities, quotas, and limits. The monetary price charged for that tier is an administrative attribute that can change over time through versioned releases without mutating subscriber entitlements.

### Core Architecture Highlights

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Admin Control Suite                  │
│     (One Single Place to Control All Pricing & Policies)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Draft → Preview → Publish (Atomic Snapshot)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Pricing Versioning Engine                   │
│           (Immutable Versions v1, v2, v3... + Rollback)     │
└──────┬───────────────────────┬───────────────────────┬──────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│  Public API  │       │ Entitlements │        │   Payment    │
│   Catalog    │       │   Service    │        │  Providers   │
│ (/pricing/   │       │ (Quota &     │        │(Stripe, RPay,│
│   catalog)   │       │ Capabilities)│        │ Simulation)  │
└──────┬───────┘       └──────┬───────┘        └──────────────┘
       │                      │
       ├──────────────────────┼───────────────────────┐
       ▼                      ▼                       ▼
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│ Landing Page │       │ Desktop App  │        │   Web App    │
│  (Live Sync) │       │ (Live Guards)│        │(Cloud Engine)│
└──────────────┘       └──────────────┘        └──────────────┘
```

---

## 2. Canonical Plan Catalog & Entitlement Matrix

MAHI Browser defines **9 canonical tiers** organized into Personal and Business categories, plus a Free Tier.

### A. Free Tier
- **Plan ID:** `free`
- **Profiles:** 15 anti-detect profiles
- **Price:** Free forever (₹0)
- **Features:** Anti-detect spoofing, basic fingerprint generator, local storage, community support.

---

### B. Personal Plans (Individual Users)

| Plan ID | Display Name | Profiles | Cloud Android | Proxy GB | Annual Price (50% off) | Monthly Price | Key Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pro_10` | **Professional 10** | 10 | 30 min/mo | — | ₹299/mo (₹3,588/yr) | ₹599/mo | Unique fingerprints, folders/groups, bulk actions |
| `pro_25` | **Professional 25** | 25 | 30 min/mo | 2 GB/mo | ₹749/mo (₹8,988/yr) | ₹1,499/mo | Proxy devices, profile shares, cloud sync |
| `pro_50` | **Professional 50** *(Popular)* | 50 | 30 min/mo | 2 GB/mo | ₹1,499/mo (₹17,988/yr) | ₹2,999/mo | Cloud Browser via web, cookie import/export |
| `pro_100` | **Professional 100** | 100 | 30 min/mo | 2 GB/mo | ₹2,999/mo (₹35,988/yr) | ₹5,999/mo | Synchronizer, Cookie Bot, Custom Extensions, REST API & SDKs |

---

### C. Business Plans (Teams & Organizations)

| Plan ID | Display Name | Profiles | Seats | Proxy GB | Annual Price (50% off) | Monthly Price | Key Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `team_50` | **Team 50** | 50 | 2 | 5 GB/mo | ₹1,499/mo (₹17,988/yr) | ₹2,999/mo | Team folders, member permissions, proxy device sharing |
| `team_100` | **Team 100** | 100 | 5 | 10 GB/mo | ₹1,999/mo (₹23,988/yr) | ₹3,999/mo | Role-Based Access Control (RBAC), Visual RPA builder |
| `team_200` | **Team 200** | 200 | 8 | 15 GB/mo | ₹2,499/mo (₹29,988/yr) | ₹4,999/mo | Multi-window synchronizer, 4G/5G ADB rotator, 1000 RPM API |
| `team_300` | **Team 300** *(Popular)* | 300 | Unlimited | 25 GB/mo | ₹2,999/mo (₹35,988/yr) | ₹5,999/mo | Full RPA, Headless CDP automation, 99.99% SLA, WhatsApp VIP support |

---

## 3. Strict Separation of Price and Entitlements

1. **Entitlement Authority:**
   All feature gating queries (`evaluateUserEntitlements`, `assertCanCreateProfile`, `hasCapability`) query `commercial_users.plan_id` and evaluate against `CANONICAL_PLAN_CATALOG[planId]`.
2. **Never Check Numerical Price:**
   No frontend component or backend guard evaluates numeric price amounts to grant features. A price reduction or discount campaign has **zero effect** on a user's quotas.
3. **Cumulative Progression:**
   Every higher tier includes 100% of the capabilities of lower tiers, preventing capability regressions when users upgrade from Pro 10 to Pro 100 or Team 50 to Team 300.

---

## 4. Admin Pricing Control Workflow

### Workflow Stages:
```
[Admin Edits Monthly Price]
           │
           ▼
[Annual Price Auto-Computed at 50% Off]
           │
           ▼
[Admin Saves DRAFT (vN)]
           │
           ▼
[Admin Clicks PREVIEW CHANGES]
  - Side-by-side diff (Old vs New price)
  - % price shift calculation
  - Subscriber impact analysis (Grandfathered vs Affected)
  - Pre-flight validation warnings
           │
           ▼
[Admin Confirms & PUBLISHES]
  - Atomic database commit (Status: PUBLISHED)
  - Previous version becomes SUPERSEDED
  - Provider mappings generated (Stripe/Razorpay/Simulation)
  - Public `/pricing/catalog` immediately serves new version
  - Audit trail record logged with actor ID and timestamp
```

### Grandfathering & Migration Policy:
- **`GRANDFATHER` (Default):** Existing active subscribers continue paying their locked price indefinitely until they change plans.
- **`MIGRATE_RENEWAL`:** Existing subscribers continue at their existing rate for the remainder of their paid period, but transition to the newly published price on their next billing cycle renewal.
- **`MIGRATE_IMMEDIATE`:** Subscriptions are prorated and updated immediately to the new pricing version.

### Rollback Guarantee:
At any point, the admin can select a superseded version and click **Rollback**. The previous version's prices are restored into a new active version snapshot with complete audit trail provenance.

---

## 5. Money Precision & Financial Safety

1. **Integer Representation (Paise):**
   All prices are stored and processed internally as 64-bit integer paise (`1 INR = 100 Paise`), eliminating IEEE 754 floating-point rounding errors.
   - Example: ₹599.00 = `59900` paise.
2. **Display Formatting:**
   Paise are formatted using `Intl.NumberFormat('en-IN')` for human presentation.

---

## 6. End-to-End System Integration

1. **Web Admin Suite (`http://127.0.0.1:32123/admin`):**
   Interactive UI under the "Plans & Tiers" tab allows changing monthly prices with real-time annual auto-recalculation, draft saving, diff modal preview, direct publishing, and version history audit tables.
2. **Public REST Endpoint (`GET /api/v1/pricing/catalog`):**
   Returns the current active catalog containing display prices, paise amounts, limits, capabilities, and popular flags.
3. **Landing Page (`landing/assets/js/main.js`):**
   Dynamically fetches `/api/v1/pricing/catalog` on load and updates the pricing cards, popular badges, and billing toggle seamlessly.
4. **Desktop App & Web App:**
   Entitlements are evaluated in real time against the central database and SQLite migration v19 tables.
