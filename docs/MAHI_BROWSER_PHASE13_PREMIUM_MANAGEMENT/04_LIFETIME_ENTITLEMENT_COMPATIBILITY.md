# MAHI BROWSER — PHASE 13 REPORT 04
## LIFETIME ENTITLEMENT & DESKTOP COMPATIBILITY
### Semantics, Nullable Expiration, RSA-SHA256 Canonical String & Client Verification

**Document:** `04_LIFETIME_ENTITLEMENT_COMPATIBILITY.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Component:** Cryptographic Entitlement Layer & Desktop Client Synchronization  
**Source Reference:** `08_SECURITY/account-service.ts`  

---

## 1. WHY FAKE 100-YEAR HACKS WERE REJECTED

A naive implementation of "Lifetime" access sets `expires_at` to a date decades in the future (e.g. `2126-01-01`). This approach was explicitly rejected during Phase 13 architectural design due to three critical flaws:
1. **Misleading Audit & Reporting:** Expiration queries (`WHERE expires_at > datetime('now')`) treat the user as a temporary subscriber with a finite end date rather than an enduring permanent entitlement.
2. **Date Arithmetic Anomalies:** Adding months or stacking time onto a 100-year subscription results in integer overflow or parsing errors in third-party reporting tools.
3. **Semantic Inaccuracy:** Lifetime access does not mean a 100-year countdown; it means **no scheduled expiration while the entitlement remains valid and unrevoked**.

---

## 2. THE PHASE 13 LIFETIME ARCHITECTURE

### 2.1 Database Representation
In `panel.db`, the `subscriptions` table schema was updated to make `expires_at` nullable and add an explicit `is_lifetime` flag:
```sql
ALTER TABLE subscriptions ADD COLUMN is_lifetime INTEGER DEFAULT 0;
-- Schema migration safely recreates subscriptions with `expires_at TEXT NULL`
```

When a Lifetime grant is issued:
- `plan`: `'pro'`
- `status`: `'active'`
- `is_lifetime`: `1`
- `expires_at`: `NULL`
- `grant_category`: `'owner_grant'` (or selected internal category)
- `payment_method`: `'complimentary'`

---

## 3. CRYPTOGRAPHIC PROOF & DESKTOP CLIENT VERIFICATION

The MAHI Browser Windows desktop client authenticates licenses and status payloads using RSA-SHA256 asymmetric cryptographic signatures.

### 3.1 Canonical String Composition
In `08_SECURITY/account-service.ts` (Line 251), the desktop client reconstructs the canonical string:
```typescript
const canonical = `${data.account_id}:${data.hwid}:${data.plan}:${data.profile_limit}:${data.sync_allowed ? 1 : 0}:${data.expires_at || ''}:${data.server_time}`;
```

In the backend `account-service.js` (Line 592):
```javascript
const canonicalString = `${user.id}:${cleanHwid}:${plan}:${profileLimit}:${syncAllowed ? 1 : 0}:${expiresAt || ''}:${serverTime}`;
```

**Key Discovery & Mathematical Invariant:**
When `expiresAt` is `null`:
- The server evaluates `expiresAt || ''` as `""` (empty string).
- The desktop client evaluates `data.expires_at || ''` as `""` (empty string).
- Both server and desktop compute the exact identical canonical payload:
  `usr_owner777:HWID-OWNER-77:pro:100:1::1776098400000`
- The RSA-SHA256 signature validates with 100% cryptographic precision (`verify.verify(PUBLIC_KEY, sig, 'base64') === true`).

### 3.2 Client-Side Expiration Evaluation
In `08_SECURITY/account-service.ts` (Line 797):
```typescript
// Expiration check
if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) {
  return false;
}
```

Because `cached.expires_at` is `null` (falsy):
1. The conditional `cached.expires_at` evaluates to `false`.
2. The expiration check is cleanly skipped.
3. The desktop client evaluates the user as active PRO:
   - `profile_limit = 100`
   - `sync_allowed = true`
   - `plan = 'pro'`

---

## 4. OFFLINE GRACE PERIOD & REVOCABILITY

A critical requirement of lifetime entitlement is that it must remain **fully revocable by the owner** without requiring client software updates.

### 4.1 Client Offline Cache Security
In `08_SECURITY/account-service.ts` (Line 786):
```typescript
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days offline grace period
```
- The desktop client maintains cached entitlement for a maximum of 7 days offline.
- Every time the desktop browser boots or connects to the internet, it polls `GET /v1/account/status`.

### 4.2 Revocation Lifecycle
If an administrator clicks **Revoke PRO** in the Admin Panel:
1. The backend sets the subscription to `status = 'cancelled'`.
2. The next time the desktop client polls the server, the server returns `plan: 'free'`, `profile_limit: 15`, `sync_allowed: false`.
3. The desktop client immediately updates its local secure cache and locks additional profiles.
4. If the user disconnects their internet, the 7-day offline grace period expires, and the client locks automatically.

---

## 5. CLIENT VERSION COMPATIBILITY MATRIX

| Desktop Client Version | Lifetime Compatibility | Expiry Parsing | Signature Verification | Risk Level |
|---|---|---|---|---|
| **v1.1.1 RC1 (Current)** | ✅ 100% Compatible | Safely skipped | Valid (`expires_at = ''`) | Zero Risk |
| **v1.0.4** | ✅ 100% Compatible | Safely skipped | Valid | Zero Risk |
| **v1.0.3 Legacy** | ✅ Compatible via fallback | Evaluates PRO | Valid | Zero Risk |

No desktop client update or patch is required. The existing deployed desktop clients natively understand and correctly enforce the nullable lifetime representation.
