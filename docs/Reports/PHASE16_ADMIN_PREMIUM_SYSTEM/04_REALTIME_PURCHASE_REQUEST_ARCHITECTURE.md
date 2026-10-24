# MAHI BROWSER — PHASE 16 REPORT 04
## REAL-TIME PURCHASE REQUEST ARCHITECTURE

**MODULE:** Commercial Purchase Request Pipeline  
**PUBLIC ENDPOINT:** `POST /api/v1/plans/request`  
**ADMIN ENDPOINTS:** `GET /api/admin/premium-requests`, `POST /api/admin/premium-requests/:id/approve`, `POST /api/admin/premium-requests/:id/reject`  
**TABLE:** `premium_requests`  

---

### 1. MOTIVATION & SECURITY MANDATE

To support user upgrades via bank transfers, UPI QR codes, or cryptocurrency without exposing the business to fraudulent activation:
1. **Zero Auto-Grant on Unverified Payment:** When a customer submits payment proof (UTR / transaction hash), the system must **NOT** automatically elevate their subscription status.
2. **Asynchronous Verification Queue:** Requests enter a structured administrative queue for owner review.
3. **Instant Administrative Notification:** When a request is filed, an SSE event is dispatched immediately to active admin consoles with visual banners and an audible chime.
4. **Controlled Approval with Safe Stacking:** When approved, the entitlement is applied safely without truncating existing paid time.

---

### 2. DATABASE SCHEMA SPECIFICATION

Table `premium_requests` was created with the following definition:
```sql
CREATE TABLE IF NOT EXISTS premium_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL,
  payment_ref TEXT,
  proof_asset TEXT,
  status TEXT NOT NULL DEFAULT 'PAYMENT_SUBMITTED',
  notes TEXT,
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prem_req_user ON premium_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prem_req_status ON premium_requests(status);
CREATE INDEX IF NOT EXISTS idx_prem_req_created ON premium_requests(created_at);
```

---

### 3. API WORKFLOW & LIFECYCLE

#### 3.1 Customer Submission: `POST /api/v1/plans/request`
- **Request Body:**
  ```json
  {
    "email": "customer@example.com",
    "plan_id": "pro",
    "billing_cycle": "annual",
    "amount": 1499,
    "payment_method": "UPI",
    "payment_ref": "412389471928",
    "notes": "Payment via PhonePe"
  }
  ```
- **Execution:**
  1. Identifies or registers user record.
  2. Inserts new row with status `'PAYMENT_SUBMITTED'`.
  3. Triggers `notificationService.broadcast('premium_request_created', ...)`.
  4. Returns HTTP 200 with receipt confirmation.
  5. **Subscription remains unchanged** (verified in integration tests).

#### 3.2 Admin Review & Approval: `POST /api/admin/premium-requests/:id/approve`
- **Request Body:**
  ```json
  {
    "duration": null,
    "mode": "stack"
  }
  ```
- **Execution:**
  1. Verifies request existence and current status.
  2. Determines effective duration from billing cycle (`monthly` -> 30d, `annual` -> 365d, `lifetime` -> lifetime).
  3. Invokes `grantSubscription(userId, { plan, duration, mode, ... })`.
  4. Updates request status to `'APPROVED'`, records `reviewed_by` and `reviewed_at`.
  5. Dispatches `premium_request_approved` event to SSE stream.

#### 3.3 Admin Rejection: `POST /api/admin/premium-requests/:id/reject`
- **Request Body:**
  ```json
  {
    "reason": "Invalid or unverified UTR reference number"
  }
  ```
- **Execution:**
  1. Updates request status to `'REJECTED'`.
  2. Records admin explanation in `admin_notes`.
  3. Dispatches `premium_request_rejected` notification.
