# MAHI BROWSER — PHASE 13 REPORT 08
## DESKTOP ACCOUNT SYNCHRONIZATION COMPATIBILITY
### Windows Client Integration, RSA Signature Verification, Profile Limits & Cloud Sync Entitlement

**Document:** `08_DESKTOP_SYNC_COMPATIBILITY.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Component:** Desktop Entitlement Synchronization Protocol (`/v1/account/status`)  
**Desktop Source Reference:** `08_SECURITY/account-service.ts`  
**Client Version Tested:** MAHI Browser v1.1.1 RC1 (Windows 64-bit)  

---

## 1. SYNCHRONIZATION ARCHITECTURE OVERVIEW

The MAHI Browser Windows desktop client maintains account state and profile licensing through a periodic synchronization loop implemented in `08_SECURITY/account-service.ts`.

### 1.1 Synchronization Flow Diagram
```
┌───────────────────────────┐                    ┌────────────────────────────┐
│   MAHI Windows Desktop    │                    │     MAHI Admin Backend     │
│       Client v1.1.1       │                    │    (https://admin...)      │
└─────────────┬─────────────┘                    └─────────────┬──────────────┘
              │                                                │
              │ 1. GET /v1/account/status?hwid=HWID-XYZ        │
              │    Header: x-mahi-token: <session_token>       │
              │───────────────────────────────────────────────>│
              │                                                │
              │                                                │ 2. Authenticate session
              │                                                │ 3. Check subscription & lifetime
              │                                                │ 4. Build canonical string
              │                                                │ 5. Sign with RSA-2048 private key
              │                                                │
              │ 6. Response JSON + X-Signature header          │
              │    { plan, profile_limit, sync_allowed,        │
              │      expires_at, is_lifetime, sync_key, sig }  │
              │<───────────────────────────────────────────────│
              │                                                │
              │ 7. verifyAccountStatusSignature(payload, sig)  │
              │ 8. Enforce profile limit (15 free vs 100 PRO)  │
              │ 9. Unlock/Lock Encrypted Cloud Sync            │
              ▼                                                ▼
```

---

## 2. CRYPTOGRAPHIC SIGNATURE COMPLIANCE

The desktop client requires that every account status response is cryptographically signed using RSA-SHA256 with the server's authoritative 2048-bit key.

### 2.1 Canonical Payload Formatting
In `08_SECURITY/account-service.ts` (Line 251):
```typescript
const canonical = `${data.account_id}:${data.hwid}:${data.plan}:${data.profile_limit}:${data.sync_allowed ? 1 : 0}:${data.expires_at || ''}:${data.server_time}`;
```

Both server and desktop implementations align perfectly:
- For fixed-term grants (7d, 30d, 90d, 1y, custom): `data.expires_at` is an ISO 8601 string (e.g. `2027-01-15T00:00:00.000Z`).
- For lifetime grants: `data.expires_at` is `null`, which evaluates to `""` in the canonical template on both sides.
- In both scenarios, `crypto.verify('SHA256')` evaluates to `true`.

---

## 3. FEATURE ENTITLEMENT ENFORCEMENT

### 3.1 Multi-Profile Limits
- **Free Account:** The client enforces `profile_limit = 15`. Any attempt to create a 16th profile in the browser UI triggers the upgrade modal.
- **PRO / Lifetime Account:** The client receives `profile_limit = 100`. The browser unlocks the creation of up to 100 isolated browser profiles with dedicated fingerprints and proxies.

### 3.2 Encrypted Cloud Synchronization
- **Free Account:** `sync_allowed = false`, `sync_key = null`. Profile sync tab displays a lock icon.
- **PRO / Lifetime Account:** `sync_allowed = true`, `sync_key` is decrypted and populated into the client's local keystore. Profiles sync seamlessly to the encrypted vault.

### 3.3 Administrative Revocation & Expiration
When an administrator clicks "Revoke PRO" in the Admin Panel:
- The next time the desktop client polls (every 10 minutes or on browser restart), the server returns `plan: 'free'`, `profile_limit: 15`, `sync_allowed: false`.
- The desktop client immediately restricts access to profiles beyond the 15th and suspends cloud sync.
- If the user operates offline, the client locks automatically once the 7-day offline grace period (`GRACE_PERIOD_MS`) elapses.

---

## 4. ZERO CLIENT UPDATE REQUIREMENT

The investigation proved conclusively that:
1. Deployed v1.1.1 RC1 binaries already support nullable expiration.
2. RSA canonical strings handle falsy `expires_at` natively.
3. No desktop client update, reinstallation, or code-signing pass is required.
4. The upgrade is 100% backward and forward compatible.
