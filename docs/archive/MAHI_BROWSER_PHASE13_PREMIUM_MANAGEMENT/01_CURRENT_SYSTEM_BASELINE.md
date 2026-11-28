# MAHI BROWSER — PHASE 13 REPORT 01
## CURRENT SYSTEM BASELINE & FORENSIC AUDIT VALIDATION
### Architectural State, Forensic Findings, and Vulnerability Root Causes

**Document:** `01_CURRENT_SYSTEM_BASELINE.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Component:** Backend Admin Panel (`/opt/mahi-admin-panel/`) & SQLite Storage (`panel.db`)  
**Desktop Client Interface:** `08_SECURITY/account-service.ts`  
**Execution Mode:** Autonomous Local Implementation + Private Staging Verification  
**Production Status:** Unmodified / Production Deployment Strictly Not Authorized  

---

## 1. EXECUTIVE SUMMARY

The MAHI Browser production environment utilizes an administrative control center running at `https://admin.mahibrowser.com`, backed by an Express/Node.js service (`/opt/mahi-admin-panel/src/server.js`) connected to an embedded SQLite database (`/opt/mahi-admin-panel/data/panel.db`).

A forensic evaluation and code-level inspection was conducted against the local code mirrors and staging services to validate the findings of the **MAHI BROWSER — ADMIN COMPLIMENTARY PREMIUM ACCESS VERIFICATION REPORT**.

The audit confirmed that while the basic administrative workflows (activating PRO, revoking access, unbinding HWID, approving manual payments) function as designed, there existed critical architectural gaps and data-loss risks that threatened paying customers and degraded administrative accountability.

---

## 2. ARCHITECTURAL BASELINE & ENDPOINTS

### 2.1 Service Topography
- **Node.js Process:** Express service serving authenticated REST endpoints and static SPA assets (`index.html`, `app.js`, `styles.css`).
- **Database Engine:** SQLite in WAL mode (`journal_mode = WAL`) accessed via `better-sqlite3`.
- **Desktop Client Protocol:** Desktop clients authenticate via `x-mahi-token` and poll `GET /v1/account/status?hwid={HWID}`. Responses are signed with an RSA-2048 private key (`RSA_PRIVATE_KEY`) using SHA-256 and verified client-side in `08_SECURITY/account-service.ts`.

### 2.2 Prior Administrative Endpoints Audited
Before Phase 13 remediation, the existing panel exposed the following subscription management routes:

1. `POST /api/users/:id/activate`
   - **Intended Purpose:** Grant PRO access for a user.
   - **Observed Behavior:** Accepted `{ durationType, months }`. Truncated any existing subscription by updating all active rows to `status = 'expired'`.
2. `POST /api/users/:id/extend`
   - **Intended Purpose:** Extend an existing subscription.
   - **Observed Behavior:** Looked for an active subscription; if found, added 30 days to its `expires_at`. Failed or misbehaved if `expires_at` was null or if the user was on a free plan.
3. `POST /api/users/:id/revoke`
   - **Intended Purpose:** Immediately cancel PRO access.
   - **Observed Behavior:** Marked active subscriptions as `status = 'cancelled'`. Downgraded the user to `free` (15 profiles, cloud sync disabled).
4. `GET /v1/account/status`
   - **Client Polling Endpoint:** Synchronizes profile limit (15 for free, 100 for pro/trial), cloud sync key, and RSA-SHA256 signature.

---

## 3. IDENTIFIED VULNERABILITIES & ROOT CAUSE ANALYSIS

### 3.1 Priority P0: Silent Truncation of Paid Customer Subscriptions
- **Root Cause:** In the legacy `activateSubscription(userId, months, durationType)` function:
  ```javascript
  // Legacy vulnerable logic:
  db.prepare(`UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status = 'active'`).run(userId);
  const now = new Date();
  const expiresAt = new Date(now.setMonth(now.getMonth() + months)).toISOString();
  db.prepare(`INSERT INTO subscriptions (id, user_id, plan, status, start_date, expires_at, ...) VALUES (?, ?, 'pro', 'active', ...)`).run(...);
  ```
- **Catastrophic Impact:** If a customer paid for 1 year (365 days) via Razorpay, Stripe, or Manual UPI, and an administrator subsequently clicked "Activate PRO" to grant a complimentary 7-day or 30-day trial extension, the existing 365-day subscription was immediately set to `expired`. The customer's expiration was overwritten with `now + 30 days`, resulting in the **silent loss of over 330 already-paid days**.
- **Financial Provenance Contamination:** Administrative grants failed to record distinct provenance tags, creating ambiguity between organic commercial revenue and complimentary perks.

### 3.2 Primitive Browser `prompt()` Dialogs
- **Deficiency:** Administrative actions were triggered via window prompts:
  `const months = prompt("Enter duration in months (e.g. 1, 3, 12):", "12");`
- **Impact:**
  - Zero visibility into the user's current plan, existing paid days, or expiration date.
  - No preview of the new calculated expiration date.
  - Zero warning if an existing paid subscription was about to be overwritten.
  - High risk of typos or accidental input by administrators on mobile/tablet devices.

### 3.3 Limited Search Capabilities
- **Deficiency:** The users table search input only executed client-side regex matching against `u.email`.
- **Impact:** When a user contacted support with their alphanumeric Account ID (`usr_...`) or their desktop Hardware ID (`HWID-...`), the administrator could not locate the user without manual pagination or direct database queries.

### 3.4 Inadequate Audit Attribution & Granularity
- **Deficiency:** While `admin_audit_logs` existed, it only recorded generic entries like `"USER_ACTIVATE_SUB"` with a flat notes string.
- **Missing Information:**
  - Grant category (Complimentary PRO vs Owner Grant vs Beta Tester vs Influencer vs Promotional).
  - Prior vs new expiration timestamp.
  - Idempotency key for network retry deduplication.
  - Protection override confirmation flags.

### 3.5 Absence of Native Lifetime Premium Semantics
- **Deficiency:** The SQLite schema strictly enforced `expires_at TEXT NOT NULL`.
- **Hack Risk:** Previous temporary attempts simulated "lifetime" by calculating dates 100 years into the future (`now + 100 years`), causing date parsing anomalies and masking true entitlement intent.

---

## 4. DATABASE INVENTORY & SCHEMA STATE

Before Phase 13 remediation, the SQLite database (`panel.db`) contained the following tables:

| Table | Role | Key Constraints / Issues |
|---|---|---|
| `users` | Primary user registry | `id TEXT PRIMARY KEY`, `email TEXT UNIQUE` |
| `subscriptions` | Entitlement records | `expires_at TEXT NOT NULL` blocked nullable lifetime representation. Lacked `is_lifetime`, `grant_category`, `idempotency_key`. |
| `devices` | Bound hardware IDs | `hwid TEXT`, `user_id TEXT` |
| `sessions` | Desktop client auth sessions | `token_hash TEXT PRIMARY KEY`, `user_id TEXT` |
| `manual_payments` | UPI/Manual payment receipts | Tracks UTR numbers, amounts, approval status. |
| `admin_audit_logs` | Security audit trail | Lacked structured grant category, prior/new expiration columns. |
| `admin_sessions` | Web admin session tokens | `token TEXT PRIMARY KEY`, `expires_at TEXT` |
| `cms_content` | Dynamic landing page content | Key-value store for site copy |
| `settings` | System-wide flags | Key-value configuration |

---

## 5. FORENSIC AUDIT REPORT CONFORMANCE

All conclusions in the forensic report regarding backend behavior, endpoint signatures, and cryptographic payload formats were verified against the local source codebase. The root cause analysis confirmed that immediate remediation at the database transaction layer, endpoint layer, and admin UI was mandatory to safeguard paid subscribers.
