# MAHI BROWSER — PHASE 16 REPORT 06
## SUBSCRIPTION PROTECTION ENGINE REPORT

**MODULE:** Paid-Time Protection & Entitlement Stacking Engine  
**SERVICE:** `/opt/mahi-admin-panel/src/account-service.js`  
**ENDPOINT:** `POST /api/users/:id/grant`  
**ERROR CODE:** `409 Conflict` (`PAID_TIME_PROTECTED`, `LIFETIME_PROTECTED`)  

---

### 1. THE PROBLEM: ACCIDENTAL PAID-TIME FORFEITURE

In standard subscription billing systems, assigning a new plan or complimentary duration frequently overwrites the user's active expiration date (`expires_at = now + newDuration`).

**Scenario:**
- User purchased a 1-year PRO plan (365 days remaining).
- Admin awards a 30-day promotional extension or switches plan tier.
- If implemented naively as an immediate overwrite, the user's expiration resets to `now + 30 days`, resulting in the loss of **335 days** of paid subscription time.

---

### 2. ARCHITECTURAL SOLUTION: PAID-TIME PROTECTION ENGINE

The Phase 16 Paid-Time Protection Engine addresses this hazard:

#### 2.1 Safe Additive Stacking by Default (`mode: 'stack'`)
- If the user has an active subscription (`expires_at > now`), the new duration is added directly to `expires_at`:
  $$\text{newExpiresAt} = \text{currentExpiresAt} + (\text{days} \times 86400000)$$
- If the user has expired or is on the free tier, it stacks from the current timestamp:
  $$\text{newExpiresAt} = \text{now} + (\text{days} \times 86400000)$$

#### 2.2 Immediate Replace Guard (`mode: 'replace'`)
- When an administrator explicitly selects `replace` mode, the engine compares:
  $$\text{prospectiveExpiresAt} = \text{now} + (\text{days} \times 86400000)$$
- If $\text{currentExpiresAt} > \text{prospectiveExpiresAt}$, the replacement would forfeit active paid days:
  $$\text{truncatedDays} = \left\lceil \frac{\text{currentExpiresAt} - \text{prospectiveExpiresAt}}{86400000} \right\rceil$$
- If `overrideLoss: false`, the operation is aborted, and the server throws:
  ```json
  {
    "status": 409,
    "code": "PAID_TIME_PROTECTED",
    "message": "PAID_TIME_PROTECTED: Immediate replacement will truncate 335 remaining active paid days. Use Safe Stacking or confirm override.",
    "truncatedDays": 335,
    "currentExpiresAt": "2027-10-13T22:55:40.911Z",
    "prospectiveExpiresAt": "2026-11-13T22:55:40.911Z"
  }
  ```

#### 2.3 Lifetime Downgrade Lock (`LIFETIME_PROTECTED`)
- If a customer holds Lifetime Access (defined as expiration $\ge \text{2099-01-01}$), attempting to grant a finite duration (e.g., 30d, 365d) without checking the override checkbox is rejected with `LIFETIME_PROTECTED`.

#### 2.4 Transactional Concurrency Safety
The subscription upgrade and audit logging execute within an atomic SQLite transaction (`db.transaction(() => { ... })`), ensuring that superseded records and newly inserted subscriptions remain consistent even under concurrent requests.

---

### 3. FRONTEND LIVE IMPACT PREVIEW & DANGER WARNING

In `#grant-modal`:
1. **Dynamic Real-Time Calculation:** Adjusting duration pills (7d, 30d, 90d, 365d, Custom, Lifetime) or toggling the "Safe Additive Stacking" switch immediately updates the live impact preview box, showing current expiry, added days, and prospective new expiry.
2. **Hazard Callout:** If an admin toggles off stacking on a user where truncation would occur, the modal highlights a red danger banner stating the exact forfeited day count, disables the submit button, and requires checking an explicit override acknowledgment checkbox before proceeding.
