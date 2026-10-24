# MAHI BROWSER — PHASE 13 REPORT 02
## SUBSCRIPTION PROTECTION SYSTEM DESIGN
### Non-Destructive Time Stacking, Concurrency Guards & Financial Provenance Preservation

**Document:** `02_SUBSCRIPTION_PROTECTION_DESIGN.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Component:** Backend Transaction Logic & API Safety Guards (`account-service.js`, `server.js`)  
**Security Level:** Priority P0 Financial & Data Integrity Standard  

---

## 1. CORE DESIGN PRINCIPLES

The primary architectural mandate of Phase 13 is:
> **NEVER SACRIFICE A CUSTOMER'S PAID SUBSCRIPTION TO GRANT COMPLIMENTARY ACCESS.**

To fulfill this mandate, all administrative subscription mutations must adhere to five immutable rules:
1. **Mathematical Preservation:** If a user possesses remaining paid days, no administrative operation can reduce those days without atomic rejection or explicit confirmation.
2. **Default Non-Destructive Stacking:** Complimentary duration defaults to appending *after* the current paid expiration date (`new_expiry = current_paid_expiry + grant_duration`).
3. **Atomic Concurrency Protection:** All database state evaluations, calculation of remaining days, and record updates occur within a single atomic SQLite transaction (`BEGIN IMMEDIATE`).
4. **Idempotency Guarantee:** Network retries or double-submissions transmitting identical idempotency keys return the previous operation result without creating duplicate entitlements.
5. **Separation of Financial Provenance:** Administrative grants must never insert rows into `manual_payments`, modify real payment audit trails, or disguise complimentary perks as organic revenue.

---

## 2. PROVENANCE CLASSIFICATION ENGINE

To protect commercial customers, the system introduces the `isPaidSubscription(sub)` heuristic engine:

```javascript
function isPaidSubscription(sub) {
  if (!sub) return false;
  // Provenance check 1: Commercial payment gateway or manual UPI
  if (['manual_upi', 'stripe', 'razorpay'].includes(sub.payment_method)) return true;
  // Provenance check 2: Real transaction notes containing verified UTR or gateway ID
  if (sub.notes && (sub.notes.includes('UTR:') || sub.notes.includes('pi_') || sub.notes.includes('pay_'))) return true;
  return false;
}
```

Any subscription row matching this classification is locked under **Paid Protection Rules**.

---

## 3. MATHEMATICAL TIME STACKING ALGORITHM

When an administrator configures a grant for a user, the system evaluates the state via `previewSubscriptionGrant(userId, options)` and executes it via `grantSubscription(userId, options)`.

### 3.1 Scenario Analysis Matrix

| Current User State | Requested Duration | Chosen Mode | Resulting Expiration | Safety Classification |
|---|---|---|---|---|
| **Free / Expired** | 30 Days | Immediate | `now + 30 days` | Safe (Fresh grant) |
| **Paid PRO (180d left)** | 30 Days | **Stack (Default)** | `paid_expiry + 30 days` (210d total) | **Safe (Zero paid days lost)** |
| **Paid PRO (180d left)** | 30 Days | Immediate (No override) | Attempted `now + 30 days` | **REJECTED (HTTP 409 Conflict)** |
| **Paid PRO (180d left)** | 30 Days | Immediate (`overrideLoss=true`) | `now + 30 days` (150d lost) | Explicit override with audit warning |
| **Paid PRO (180d left)** | Lifetime | Any | `null` (Permanent VIP) | Safe (Upgraded to non-expiring) |
| **Complimentary PRO (10d left)** | 30 Days | Stack | `comp_expiry + 30 days` (40d total) | Safe (Extended) |

### 3.2 Time Calculation Logic

```javascript
let baseTime = now;
if (stackMode === 'stack' && currentExpiresAt && new Date(currentExpiresAt).getTime() > now) {
  // Safe stacking: calculate from current active expiry
  baseTime = new Date(currentExpiresAt).getTime();
}
const newExpiresAt = new Date(baseTime + days * 24 * 3600 * 1000).toISOString();
```

---

## 4. SERVER-SIDE PAID PROTECTION GUARD (HTTP 409)

The server enforces an unbypassable backend validation barrier. If a request attempts to start immediately (`stackMode === 'immediate'`) and results in an expiration date earlier than the user's current paid expiration, the server calculates the exact days truncated:

```javascript
let paidDaysTruncated = 0;
if (currentIsPaid && currentRemainingDays > 0 && !isLifetime) {
  if (stackMode === 'immediate') {
    const prospectiveRemaining = Math.max(0, Math.ceil((new Date(newExpiresAt).getTime() - now) / (24 * 3600 * 1000)));
    if (prospectiveRemaining < currentRemainingDays) {
      paidDaysTruncated = currentRemainingDays - prospectiveRemaining;
    }
  }
}

if (paidDaysTruncated > 0 && !overrideLoss) {
  const err = new Error(`PAID_TIME_PROTECTED: User has ${currentRemainingDays} days of active paid subscription. Granting ${days} days starting immediately would truncate ${paidDaysTruncated} paid days. Select 'Add time after existing expiration' or provide explicit override.`);
  err.status = 409;
  err.code = 'PAID_TIME_PROTECTED';
  err.details = { currentRemainingDays, prospectiveDays: days, paidDaysTruncated };
  throw err;
}
```

This guarantees that even if a modified or rogue client bypasses the frontend UI, the backend will reject the truncation with `409 Conflict`.

---

## 5. ACID CONCURRENCY & TRANSACTION ISOLATION

To prevent race conditions (such as two administrators granting time simultaneously, or an incoming webhook approving a payment while an admin grants complimentary access), the operation executes within SQLite's synchronous transaction wrapper:

```javascript
const result = db.transaction(() => {
  // 1. Read latest locked state
  const currentSub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'").get(userId);
  
  // 2. Perform idempotency verification
  if (idempotencyKey) {
    const existing = db.prepare("SELECT * FROM subscriptions WHERE idempotency_key = ?").get(idempotencyKey);
    if (existing) return { idempotent_replay: true, subscription: existing };
  }
  
  // 3. Verify paid protection constraints
  ...
  
  // 4. Retire previous active row cleanly
  db.prepare("UPDATE subscriptions SET status = 'replaced' WHERE user_id = ? AND status = 'active'").run(userId);
  
  // 5. Insert new authoritative subscription record
  db.prepare("INSERT INTO subscriptions (...) VALUES (...)").run(...);
  
  // 6. Write comprehensive audit record
  db.prepare("INSERT INTO admin_audit_logs (...) VALUES (...)").run(...);
})();
```

SQLite guarantees serializable ACID isolation under WAL mode. Rapid concurrent requests are sequenced safely without lost updates.

---

## 6. FINANCIAL INTEGRITY PRESERVATION

Under no circumstances does `grantSubscription` write records to `manual_payments`.
- Commercial UPI, Stripe, and Razorpay records remain unmodified.
- Complimentary grants write exclusively to `subscriptions` with `payment_method = 'complimentary'` and record the internal `grant_category` (`complimentary_pro`, `owner_grant`, `beta_tester`, `influencer`, `promotional`, `customer_support`).
- Financial metrics, revenue reports, and billing provenance remain completely untainted.
