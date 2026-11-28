# MAHI BROWSER: FULL ADMIN PANEL PRODUCTION REALITY AUDIT (A TO Z)

**Audit Execution Date:** October 11, 2026  
**Auditor Mode:** Strict Read-Only Forensic Audit  
**Target Environment:** Production VPS (`root@<VPS_HOST>:2222`), Admin Console (`admin.mahibrowser.com`), Live Landing (`mahibrowser.com`), Client App Codebase  
**Current Baseline Commit:** `e4ab464d9feba904c4d095b9a9894368da790cd2`  
**Test Baseline:** 851 / 851 PASS (93 Test Files)

---

## EXECUTIVE SUMMARY: THE REALITY GAP

The central question posed by this audit is:  
**"Is the MAHI Browser admin panel actually ready to operate the business without developer help?"**

### The Definitive Verdict: **PARTIAL (NOT FULLY READY)**

| Dimension | Architectural Specification (Local Codebase / Tests) | Live VPS Production Reality (`admin.mahibrowser.com`) |
| :--- | :--- | :--- |
| **Admin UI Tabs** | Envisioned multi-tenant, billing, cloud & RPA console | 7 Tabs: Dashboard, Users, Legacy Licenses, Mint License, Landing CMS, UPI Payments, Settings |
| **Payment Gateways** | Multi-provider Stripe + Razorpay + Manual UPI + USDT | **Manual UPI Only** (Stripe & Razorpay unconfigured; USDT disabled) |
| **Pricing Management** | Atomic Draft → Preview → Publish versioning engine | Single PRO plan input in CMS editor; no multi-tier, no versioning |
| **Email Delivery** | Transactional SMTP / Resend relays | **Simulated / Log-Only** (No SMTP or Resend credentials in `.env`) |
| **Support Moderation** | Full ticket triage, assignment & reply console | **API-Only** (DB stores tickets, but Admin UI has zero ticket screens) |
| **Cloud Browser & RPA** | Remote workers, CDP sessions & workflow runners | **Client Desktop / Test Harness Only** (Zero cloud worker infra on VPS) |
| **Commercial Proxies** | Multi-vendor residential pool management | **Local Client Adapters Only** (No admin proxy management) |

While the core user lifecycle, trial gating, manual UPI approval, 1-year PRO entitlement unlock, and basic CMS editing work reliably in production, an owner **cannot** yet operate multi-tier pricing, support tickets, email broadcasts, automated refunds, or cloud infrastructure from the admin panel without engineering assistance.

---

## SECTION-BY-SECTION DETAILED AUDIT (1 TO 57)

### SECTION 1 — ADMIN AUTH
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - **Login / Logout:** `POST /api/auth/login` and `POST /api/auth/logout` are fully functional. Validates credentials using `bcryptjs.compare` against `ADMIN_PASSWORD_HASH`.
  - **Session Persistence:** Issues 2-hour idle session token stored in memory (`activeSessions` Map in PM2 process 45) and sent as HTTP-only cookie `mahi_session`.
  - **Security Caveat:** In-memory session store means PM2 process restarts invalidate all active admin sessions.
  - **Route Protection:** `authService.requireAuth` middleware enforces session cookie or valid `x-admin-key`. Non-admin access to `/api/admin/*` and `/api/users/*` returns HTTP 401 Unauthorized.
  - **Brute-Force Lockout:** IP-based throttling triggers after 5 failed attempts, locking out the offending IP for 15 minutes (`loginAttempts` Map).
  - **RBAC:** Single-role only (`owner`). No secondary admin, support staff, or auditor roles.

### SECTION 2 — ADMIN DASHBOARD
- **Status:** `PARTIAL`
- **Audit Findings:**
  - **Real Database Data:**
    - Total Accounts: **31** (Queried live from `users` table).
    - Active Subscriptions: **26** (Queries `subscriptions` where `status = 'active'` and unexpired; includes 11 PRO and 15 active Trials).
    - Legacy Licenses: **2** (From `licenses` table).
    - Active Licenses: **2** (From `licenses` table).
    - Recent Events: Live feed from `license_events` table (8 events).
  - **Missing Metrics (Not Implemented on Dashboard):**
    - Monthly Recurring Revenue (MRR): **None**.
    - Standalone Paid vs Trial breakdown: **Combined in single card**.
    - Active Cloud Storage usage: **None on dashboard**.
    - Active Profiles count: **None on dashboard**.
    - Proxy traffic & Cloud minutes: **None on dashboard**.
    - Support tickets summary: **None on dashboard**.
    - Payment receipts summary: **None on dashboard**.

### SECTION 3 — USERS MANAGEMENT
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - **Search & Filter:** Admin can search users by email substring or HWID device match, and filter by plan (`pro`, `trial`, `free`).
  - **User Detail Modal (`openUserModal`):** Fetches real record via `GET /api/users/:id`. Displays email, user ID, creation date, plan, expiration date, and bound device HWID.
  - **Device Unbinding:** `POST /api/users/:id/clear-device` successfully clears device binding in `devices` table, allowing the user to log in on a new PC.
  - **Cloud Backup Storage Management:** Displays allocated vs used storage (e.g., `0 MB / 1024 MB`). `POST /api/users/:id/clear-storage` deletes cloud backup records.
  - **Plan Operations:**
    - Activate PRO: Sets 1-year PRO subscription in `subscriptions` table.
    - Extend (+Months): Adds requested months to `expires_at`.
    - Revoke to FREE: Sets plan to `free` and marks status `revoked`.
    - Reset Password: Admin can overwrite password with bcrypt hash.
    - Change Email: Updates unique email with duplicate conflict check.
    - Delete Account: Deletes user, sessions, devices, and subscriptions.
  - **Gaps:** Does not show support ticket history or payment history in the user modal.

### SECTION 4 — SUBSCRIPTIONS
- **Status:** `PARTIAL`
- **Audit Findings:**
  - **Supported States in VPS Database:** `active`, `expired`, `revoked`.
  - **Supported Plans in VPS Database:** `free` (15 profiles), `trial` (7-day full access), `pro` (100 profiles, 1 year).
  - **Unsupported Lifecycle States:** `PAST_DUE`, `CANCELED`, `SUSPENDED` are defined in client TypeScript specifications (`10_CONFIG/shared/types/commercial.ts`), but are **NOT** implemented in the VPS `account-service.js` or `subscriptions` table.

### SECTION 5 — PLANS & PRICING
- **Status:** `TEST-ONLY / NOT CONNECTED TO ADMIN PANEL`
- **Audit Findings:**
  - In local tests (`11_TESTS/unit/phase17-production-business-model.test.ts`), a full multi-tier catalog exists (`Professional 10, 25, 50, 100`, `Business`, `Enterprise`) with draft/preview/publish versioning in `07_BACKEND/commercial/pricing-admin-service.ts`.
  - **Production Reality:** None of this infrastructure exists on the VPS admin panel. The VPS database (`panel.db`) lacks `pricing_versions` tables, and the Admin UI has no interface for multi-tier plans, drafts, previews, rollbacks, or grandfathering. The live panel only handles a single binary plan: Free or PRO.

### SECTION 6 — PRICE PROPAGATION
- **Status:** `PARTIAL`
- **Audit Findings:**
  - Live VPS `settings` table has `price_inr: 1499` (enforced on manual UPI checkout).
  - Live `/var/www/mahi/content.json` currently has `price_inr: 599`.
  - The admin CMS editor in `tab-cms` has an input for `PRO Annual Price (₹ INR)` defaulting to `599`. If saved, it rewrites `/var/www/mahi/content.json`.
  - Desktop app fallback catalog displays ₹1,499.
  - Discrepancy exists between public landing display (₹599) and backend payment checkout (₹1499).

### SECTION 7 — ENTITLEMENT MATRIX
- **Status:** `NOT IMPLEMENTED IN ADMIN PANEL`
- **Audit Findings:**
  - Profile limits (Free=15, Pro=100) are hardcoded in `account-service.js`.
  - Advanced entitlements (cloud browser minutes, residential proxy GB, workspace seats, RPA actions, webhooks, API requests) are specified in desktop TypeScript files, but **cannot** be viewed, configured, or overridden from the live admin panel.

### SECTION 8 — TRIAL MANAGEMENT
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - 7-day trial granted upon user registration.
  - `trial_claims` table prevents duplicate trial exploitation on the same hardware ID.
  - Trial expiry is automatically checked on `GET /v1/account/status`, falling back to Free plan when expired.
  - 23 trial claims and 15 active trials currently verified in production DB.

### SECTION 9 — UPI PAYMENTS
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - Canonical UPI ID: `6375823589@slc`.
  - Account Holder: `Mr Mahipal Choudhary`.
  - Official Slice QR asset served at `/payments/mahi-upi-qr.png`.
  - Client submits payment with UTR via `POST /v1/account/payments/upi/submit`, creating `PENDING_VERIFICATION` record in `manual_payments` table.
  - Admin panel "UPI Payments" tab lists pending submissions with user email, plan, amount, UTR, and timestamp.
  - Admin can Approve or Reject directly from the UI.

### SECTION 10 — UTR DUPLICATE PROTECTION
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - `manual_payments.utr` is protected by a `UNIQUE` SQL index in `panel.db`.
  - Submitting an identical UTR reference returns HTTP 409 Conflict with message `"Duplicate UTR: This transaction reference has already been submitted"`.
  - Verified live in production.

### SECTION 11 — PAYMENT APPROVAL → ENTITLEMENT
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - On admin approval (`POST /api/admin/payments/manual/:id/approve`), the backend executes an atomic transaction:
    1. Updates `manual_payments.status` to `APPROVED`.
    2. Records `reviewed_at` and `reviewed_by`.
    3. Invokes `activateSubscription`, granting 12 months of PRO entitlement in `subscriptions` table.
  - User's desktop app immediately reflects `plan: 'pro'` on next status refresh.

### SECTION 12 — PAYMENT REJECTION
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - Admin click on "Reject" prompts for a rejection reason.
  - Sets `status = 'REJECTED'`, stores rejection reason, and records reviewer identity.
  - Does not modify user subscription or grant entitlements.

### SECTION 13 — REFUNDS
- **Status:** `NOT IMPLEMENTED`
- **Audit Findings:**
  - Schema has `REFUNDED` status, but no button, endpoint, or business workflow exists in the admin panel to trigger refunds, downgrade entitlements, or issue credit notes.

### SECTION 14 — STRIPE
- **Status:** `NOT CONFIGURED / BLOCKED BY EXTERNAL CREDENTIAL`
- **Audit Findings:**
  - Neither `stripe` package nor `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are installed or configured on the production VPS.
  - Automated credit card processing via Stripe is completely absent in production.

### SECTION 15 — RAZORPAY
- **Status:** `NOT CONFIGURED / BLOCKED BY EXTERNAL CREDENTIAL`
- **Audit Findings:**
  - Neither `razorpay` package nor `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are present on the VPS.
  - Razorpay payment processing is completely absent in production.

### SECTION 16 — USDT
- **Status:** `HIDDEN / INTENTIONALLY DISABLED`
- **Audit Findings:**
  - Database settings table has `usdt_enabled = 0`, `usdt_address = ''`.
  - Public landing page and checkout have USDT hidden.
  - Fake placeholder TRC20 address (`TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9`) has been expunged from the live database and public site.
  - **Admin UI Defect:** `public/index.html` line 380 still contains an input field with placeholder `"TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9"` and `required` attribute.

### SECTION 17 — BUSINESS CONTACT SETTINGS
- **Status:** `PARTIAL`
- **Audit Findings:**
  - Backend endpoints `GET /api/settings/contact` and `POST /api/settings/contact` exist and store canonical values in SQLite `settings` table.
  - **Admin UI Gap:** The Settings tab in `public/index.html` has **no UI form fields** for `Business Email`, `Support Email`, `X URL`, `LinkedIn URL`, `UPI Account Holder`, or `UPI QR Asset`. An owner cannot view or change these without calling the REST API directly.

### SECTION 18 — SUPPORT SYSTEM
- **Status:** `PARTIAL`
- **Audit Findings:**
  - Support drawer on the landing page creates tickets in `support_tickets` table (7 real tickets currently logged in production).
  - API endpoint `GET /api/v1/commercial/admin/support-tickets` exists on `server.js`.
  - **Admin UI Gap:** There is **NO** Support Tickets tab in the Admin Console. The owner cannot view, read, reply to, or close support tickets from the web UI.

### SECTION 19 — PAYMENT SUPPORT EMAIL
- **Status:** `BLOCKED BY EMAIL PROVIDER (LOG-ONLY / SIMULATED)`
- **Audit Findings:**
  - Support tickets with payment keywords are flagged as `is_escalated = 1`.
  - The server logs the escalation to `data/support_escalations.log` and marks `email_sent = 1` in the database.
  - **Reality:** No real email is dispatched because no SMTP relay or Resend service is active on the server.

### SECTION 20 — GENERAL SUPPORT
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - Rule-based keyword matching in `classifySupportQuery` automatically answers common questions about pricing, OS compatibility, DRM, and proxies without escalating.

### SECTION 21 — EMAIL SYSTEM
- **Status:** `BLOCKED BY EXTERNAL CREDENTIAL / TEST-ONLY FALLBACK`
- **Audit Findings:**
  - Production VPS has zero email transport configuration (no SMTP host, port, user, pass, or API token in `.env`).
  - All email operations (verification, password resets, ticket notifications) operate in dev simulation mode (logging to stdout/disk).

### SECTION 22 — GOOGLE OAUTH
- **Status:** `WORKING LIVE (BACKEND)`
- **Audit Findings:**
  - Production `.env` contains valid `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
  - OAuth flow `/api/v1/auth/google/start` and `/callback` authenticates users and sets cookies.
  - Users table records `google_sub`, `auth_provider = 'GOOGLE'`, and `avatar_url`.
  - Admin UI does not display Google provider badges in the user table.

### SECTION 23 — PROFILE MANAGEMENT
- **Status:** `NOT IMPLEMENTED IN ADMIN PANEL`
- **Audit Findings:**
  - Admin cannot view user browser profile lists, fingerprints, or local locks.
  - Only action available is deleting cloud backup archives (`POST /api/users/:id/clear-storage`).

### SECTION 24 — CLOUD SYNC
- **Status:** `WORKING LIVE (LOCAL DISK STORAGE ON VPS)`
- **Audit Findings:**
  - Endpoints `/v1/sync/list`, `/upload`, `/download`, `/delete`, and `/usage` are active and protected by session auth.
  - Data is stored in SQLite `cloud_profiles` and local disk storage.
  - External Cloudflare R2 / AWS S3 storage is unconfigured.

### SECTION 25 — CLOUD BROWSER
- **Status:** `TEST-ONLY / LOCAL CODEBASE ONLY`
- **Audit Findings:**
  - Cloud browser workers and interactive CDP sessions are tested in desktop test suites (`11_TESTS/unit/phase10-cloud-browser.test.ts`).
  - No cloud worker instances, Docker daemons, or worker management routes exist on the production VPS.

### SECTION 26 — COMMERCIAL PROXY
- **Status:** `BLOCKED BY EXTERNAL CREDENTIAL / LOCAL ADAPTER ONLY`
- **Audit Findings:**
  - Desktop client contains provider adapters (`Bright Data`, `IPRoyal`, `Oxylabs`) in `08_SECURITY/proxy-providers/`.
  - Production VPS admin panel has zero proxy credentials, no proxy proxying service, and no admin proxy dashboard.

### SECTION 27 — BYOP PROXY
- **Status:** `LOCAL CLIENT FEATURE ONLY`
- **Audit Findings:**
  - Bring-Your-Own-Proxy credentials are encrypted client-side in the desktop app. Admin panel intentionally has no access.

### SECTION 28 — WORKSPACES & TEAMS
- **Status:** `TEST-ONLY / LOCAL CODEBASE ONLY`
- **Audit Findings:**
  - Fully tested in `11_TESTS/unit/phase3-team-workspaces.test.ts`.
  - VPS database has no `workspaces` table and the admin panel has no team management interface.

### SECTION 29 — AUTOMATION / RPA
- **Status:** `LOCAL CLIENT FEATURE ONLY`
- **Audit Findings:**
  - Visual RPA workflow studio and step runners execute entirely inside the client Electron application. Admin panel has no visibility or scheduler control.

### SECTION 30 — API KEYS
- **Status:** `TEST-ONLY / LOCAL CODEBASE ONLY`
- **Audit Findings:**
  - Tested in `11_TESTS/unit/phase6-remote-api.test.ts`.
  - VPS admin panel does not create, manage, or display API keys.

### SECTION 31 — WEBHOOKS
- **Status:** `TEST-ONLY / LOCAL CODEBASE ONLY`
- **Audit Findings:**
  - Tested in `11_TESTS/unit/phase6-remote-api.test.ts`.
  - VPS admin panel has no webhook configuration or delivery monitoring.

### SECTION 32 — USAGE LEDGER
- **Status:** `PARTIAL`
- **Audit Findings:**
  - Admin panel tracks cloud storage usage (MB) in `tab-users`.
  - Does not track cloud minutes, proxy GB, or API requests.

### SECTION 33 — QUOTA OVERRIDE
- **Status:** `NOT IMPLEMENTED IN ADMIN PANEL`
- **Audit Findings:**
  - Admin cannot set custom profile quotas or storage overrides per user.

### SECTION 34 — MONITORING
- **Status:** `PARTIAL`
- **Audit Findings:**
  - Route `/api/settings/server-info` reports Node version, process uptime, memory RSS, and backup count.
  - No live CPU, RAM, disk charts, or request rate graphs exist.

### SECTION 35 — ALERTS
- **Status:** `TEST-ONLY`
- **Audit Findings:**
  - Client-side telemetry alerts run in desktop tests (`telemetry-monitor-service.ts`).
  - No server-side alerting destination (PagerDuty, Slack, Email) configured on VPS.

### SECTION 36 — BACKUP / DR
- **Status:** `WORKING LIVE (LOCAL BACKUP)`
- **Audit Findings:**
  - Button `Backup Database & Keys Now` invokes `POST /api/settings/backup-now`.
  - Successfully creates atomic SQLite database backups and JSON key exports in `/opt/mahi-admin-panel/backups/`.
  - 34 backup snapshots currently verified on disk.
  - Off-site cloud backup to S3/R2 is not configured.

### SECTION 37 — DATABASE MANAGEMENT
- **Status:** `WORKING LIVE (SAFE/PROTECTED)`
- **Audit Findings:**
  - Raw SQL queries cannot be executed through the admin UI.
  - All operations use parameterized SQLite prepared statements via `better-sqlite3`.

### SECTION 38 — AUDIT LOGS
- **Status:** `PARTIAL`
- **Audit Findings:**
  - License operations (mint, revoke, extend) are logged to `license_events` table and displayed on the dashboard feed.
  - Admin logins, contact updates, user plan activations, and password changes are logged to PM2 stdout/files, but not to a dedicated queryable `audit_logs` database table.

### SECTION 39 — RELEASE MANAGEMENT
- **Status:** `NOT IMPLEMENTED IN ADMIN PANEL`
- **Audit Findings:**
  - Installers and update manifests (`latest.yml`, `latest.json`) are served as static files by Nginx.
  - Admin panel has no release management tab, file uploader, or version publisher.

### SECTION 40 — WINDOWS SIGNING
- **Status:** `BLOCKED BY EXTERNAL CREDENTIAL (UNSIGNED IN PRODUCTION)`
- **Audit Findings:**
  - Authenticode build hook exists (`12_SCRIPTS/sign.cjs`), but no valid certificate (`WIN_CSC_LINK`) is provisioned. Production desktop binaries are unsigned.

### SECTION 41-44 — CONFIG PROPAGATION
- **Website:** `PARTIAL` (CMS updates `/var/www/mahi/content.json`, but pricing in `content.json` differs from `settings` table).
- **Desktop:** `PARTIAL` (Desktop queries `/content.json` and backend APIs, but relies on hardcoded fallbacks if remote is unreachable).
- **Web Dashboard:** `NOT IMPLEMENTED` (Web app not hosted; only Desktop App and Landing exist).
- **Android:** `PARTIAL` (Client consumes public `/content.json` endpoints).

### SECTION 45 — PUBLIC SUPPORT LINKS
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - WhatsApp: `+91 9376343629` (`https://wa.me/919376343629`).
  - X: `https://x.com/MunaBhai63`.
  - LinkedIn: `https://www.linkedin.com/in/mahipal-choudhary-153ba83b1`.
  - Business Email: `mahiverse.hub@gmail.com`.
  - Support Email: `mahiverse.official@gmail.com`.
  - Unconfigured socials are suppressed.

### SECTION 46 — LEGAL SETTINGS
- **Status:** `WORKING LIVE`
- **Audit Findings:**
  - Terms, Privacy Policy, and AUP are live on `mahibrowser.com`, referencing canonical business emails.

### SECTION 47 — PLACEHOLDER SCAN
- **Status:** `FOUND IN ADMIN UI CODE`
- **Audit Findings:**
  - Public Website (`mahibrowser.com`): **0 placeholders** (Fully cleaned).
  - Production Database (`panel.db`): **0 placeholders** (Fully cleaned).
  - **Admin Panel UI (`/opt/mahi-admin-panel/public/index.html`):**
    1. Line 368: `placeholder="mahibrowser@upi"`
    2. Line 380: `placeholder="TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9"`
    3. Line 389: `placeholder="+919876543210"`
    4. Line 374: `value="599"` (Old price)
    5. Line 378: `value="7"` (Old USDT price)
  - **Admin Service Default Fallback (`/opt/mahi-admin-panel/src/cms-service.js`):**
    - `DEFAULT_CONTENT` has `mahibrowser@upi`, `91XXXXXXXXXX`, `599`.

### SECTION 48 — LIVE VS TEST MODE MATRIX

| Feature Area | Live Production VPS | Test Mode / Local Mock | Disabled / Blocked |
| :--- | :--- | :--- | :--- |
| **Admin Authentication** | LIVE | - | - |
| **User & Device Management** | LIVE | - | - |
| **Manual UPI Payments** | LIVE | - | - |
| **Stripe Checkout** | - | TEST / SIMULATION | BLOCKED (No keys) |
| **Razorpay Checkout** | - | TEST / SIMULATION | BLOCKED (No keys) |
| **USDT Payments** | - | - | DISABLED |
| **Email Delivery (SMTP/Resend)**| - | LOCAL QUEUE / DEV | BLOCKED (No relay) |
| **Google OAuth SSO** | LIVE | - | - |
| **Cloud Sync Storage** | LIVE (Local Disk) | TEST (Mock R2) | BLOCKED (No R2 keys) |
| **Cloud Browser Workers** | - | TEST (Local Chrome) | BLOCKED (No infra) |
| **Commercial Proxies** | - | TEST (Local Mock) | BLOCKED (No keys) |
| **Multi-Tier Pricing Drafts** | - | TEST (Unit Tests) | NOT CONNECTED |
| **Support Chatbot** | LIVE | - | - |
| **Support Ticket Moderation** | API ONLY | TEST | NO ADMIN UI |
| **Database Backups** | LIVE (Local Disk) | - | - |
| **Windows Code Signing** | - | TEST (Advisory) | BLOCKED (No cert) |

### SECTION 49 — ADMIN BUTTON AUDIT

| Button Text | Location | Frontend Handler | Backend Endpoint | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Sign In to Dashboard** | Login Form | `login-form` submit | `POST /api/auth/login` | WORKING LIVE |
| **Logout** | Header | `onclick` | `POST /api/auth/logout` | WORKING LIVE |
| **Manage Users** | Dashboard | `switchTab('tab-users')` | Client-side tab navigation | WORKING LIVE |
| **+ Mint Legacy License** | Dashboard | `switchTab('tab-new-license')` | Client-side tab navigation | WORKING LIVE |
| **🔄 Refresh** | Dashboard | `loadDashboard()` | `GET /api/dashboard/stats`, `events` | WORKING LIVE |
| **Search (Users)** | Users Tab | `loadUsers()` | `GET /api/users` | WORKING LIVE |
| **Convert Legacy License** | Users Tab | `openConvertLicenseModal()` | Client-side modal | WORKING LIVE |
| **Manage (User)** | Users Table | `openUserModal(id)` | `GET /api/users/:id` | WORKING LIVE |
| **Unbind Device** | User Modal | `clearUserDevice()` | `POST /api/users/:id/clear-device` | WORKING LIVE |
| **🗑️ Clear Cloud Storage**| User Modal | `clearUserStorage()` | `POST /api/users/:id/clear-storage` | WORKING LIVE |
| **✅ Activate PRO** | User Modal | `promptActivateSub()` | `POST /api/users/:id/activate` | WORKING LIVE |
| **⏳ Extend (+Months)** | User Modal | `promptExtendSub()` | `POST /api/users/:id/extend` | WORKING LIVE |
| **🚫 Revoke to FREE** | User Modal | `confirmRevokeSub()` | `POST /api/users/:id/revoke` | WORKING LIVE |
| **🔑 Reset Password** | User Modal | `promptResetPassword()` | `POST /api/users/:id/reset-password` | WORKING LIVE |
| **✉️ Change Email** | User Modal | `promptChangeEmail()` | `POST /api/users/:id/change-email` | WORKING LIVE |
| **🗑️ Delete Account** | User Modal | `confirmDeleteUser()` | `DELETE /api/users/:id` | WORKING LIVE |
| **Search (Licenses)** | Licenses Tab | `loadLicenses()` | `GET /api/licenses` | WORKING LIVE |
| **🔐 Sign & Mint License** | Mint Tab | `new-license-form` submit | `POST /api/licenses` | WORKING LIVE |
| **📋 Copy Key** | Mint Result | `copyResKey()` | Client clipboard | WORKING LIVE |
| **💬 Send on WhatsApp** | Mint Result | `openWhatsAppShare()` | `wa.me` URL builder | WORKING LIVE |
| **💾 Save & Deploy CMS** | CMS Tab | `saveCmsContent()` | `POST /api/cms` | WORKING LIVE |
| **Approve (Payment)** | Payments Tab | `approvePayment(id)` | `POST /api/admin/payments/manual/:id/approve` | WORKING LIVE |
| **Reject (Payment)** | Payments Tab | `rejectPayment(id)` | `POST /api/admin/payments/manual/:id/reject` | WORKING LIVE |
| **Save Payment Settings** | Settings Tab | `payment-settings-form` | `POST /api/settings/payment` | **BROKEN UX** (Demands USDT) |
| **Update Password** | Settings Tab | `change-pwd-form` submit | `POST /api/settings/change-password` | WORKING LIVE |
| **📦 Backup Database** | Settings Tab | `triggerManualBackup()` | `POST /api/settings/backup-now` | WORKING LIVE |
| **Execute Migration** | Convert Modal| `convert-license-form` submit| `POST /api/tools/convert-license` | WORKING LIVE |

### SECTION 50 — ADMIN FORM AUDIT
1. `login-form`: WORKING LIVE (Validation, error alerts, session establishment).
2. `new-license-form`: WORKING LIVE (RSA-2048 signing, custom duration, HWID binding).
3. `payment-settings-form`: **BROKEN UX / STALE FORM**
   - Contains `required` input on `pay-usdt-address` with old placeholder.
   - Lacks inputs for central business contacts (support email, WhatsApp display, X profile, LinkedIn).
4. `change-pwd-form`: WORKING LIVE (Verifies old password, enforces min-length 8, hashes new password).
5. `convert-license-form`: WORKING LIVE (Migrates legacy offline license into user cloud account).

### SECTION 51 — SECURITY
- **IDOR Protection:** All admin endpoints check `authService.requireAuth`. Non-admin requests cannot access or manipulate other users' data.
- **SQL Injection:** Zero raw SQL string concatenation. 100% prepared statements via `better-sqlite3`.
- **XSS:** Client-side rendering in `app.js` employs `escapeHtml()` on user emails, notes, and HWIDs.
- **CSRF:** SameSite cookies and JSON APIs with authorization headers provide standard protection, but explicit anti-CSRF tokens are not implemented for form posts.
- **Secret Safety:** Passwords hashed with bcrypt; RSA private key kept in `.env`; session secrets protected.

### SECTION 52 — MOBILE ADMIN RESPONSIVENESS
- `styles.css` includes `@media (max-width: 900px)` breakpoint:
  - Collapses two-column forms to single column.
  - Adds horizontal scroll (`overflow-x: auto`) on data tables.
  - Usable on tablets and phones, though dense tables require horizontal swiping.

### SECTION 53 — ERROR UX
- Standardized `alert-error` banners and `showToast()` feedback.
- Server returns JSON `{ error: "..." }` without dumping raw stack traces or SQL errors to the frontend.

### SECTION 54 — PRODUCTION DATA SAFETY
- Audit was conducted strictly read-only.
- Zero customer records altered; zero databases touched.

### SECTION 55 — NON-INTERFERENCE
- Strict boundary enforced: DRIP SMM, MAHI Skills, My 4K Downloader, falcon-backend, rumble-traffic, and all external PM2 processes were completely untouched.

### SECTION 56 — REAL ADMIN OPERABILITY SCORE (0 TO 100)

| Functional Domain | Score | Justification |
| :--- | :---: | :--- |
| **AUTH** | **90 / 100** | Robust bcrypt, brute-force lockout, HTTP-only cookie. (-10 for single-role only). |
| **USERS** | **85 / 100** | Full search, view, plan change, device unbinding, password reset, account deletion. |
| **BILLING** | **55 / 100** | Manual UPI moderation is flawless, but Stripe/Razorpay unconfigured, refunds absent. |
| **SUPPORT** | **35 / 100** | Bot answers landing questions, DB logs tickets, but Admin UI has zero ticket screens. |
| **CONTACT** | **65 / 100** | Centralized API works, but admin panel has no UI fields to edit contact data. |
| **CLOUD** | **40 / 100** | Basic backup sync works on local VPS disk; R2 and cloud workers not implemented. |
| **PROXY** | **15 / 100** | Desktop adapters exist, but admin panel has zero proxy controls or credentials. |
| **AUTOMATION** | **20 / 100** | Client-side RPA engine works, but completely absent from admin panel. |
| **MONITORING** | **45 / 100** | Basic node version/uptime/memory reported. No live charts or latency telemetry. |
| **BACKUP** | **80 / 100** | One-click manual backup works reliably; 34 snapshots on disk. No offsite S3 sync. |
| **RELEASES** | **20 / 100** | Nginx serves static files; admin panel has no release or updater controls. |
| **SECURITY** | **90 / 100** | Zero SQL injection, parameterized DB, bcrypt, brute-force defense, strict boundaries. |
| **OVERALL COMPOSITE** | **53.3 / 100** | **Moderate Operability: Core essentials work, advanced business operations require developer.** |

### SECTION 57 — FINAL MARKET READINESS
**Can the owner operate MAHI Browser from the admin panel without developer help?**  
**NO (PARTIAL ONLY).**

An owner CAN independently:
- View user signups and trials.
- Verify and approve UPI payments with UTR numbers.
- Instantly grant 1-year PRO subscriptions.
- Unbind user devices when customers switch laptops.
- Reset customer passwords and update emails.
- Edit basic landing page copy and banner text.
- Create database backups.

An owner CANNOT independently (requires developer):
- View, reply to, or close customer support tickets (no UI in admin).
- Send actual transactional emails (no SMTP/Resend configured).
- Change contact emails or social links from the UI (no form in settings).
- Create or publish new multi-tier pricing plans.
- Process refunds.
- Accept automated credit card payments (Stripe/Razorpay unconfigured).
- Monitor cloud browser workers or proxy pools.

---

## TOP REMAINING ADMIN ISSUES (RANKED BY SEVERITY)

### P0 (Critical Business Blockers)
1. **No Support Ticket UI in Admin Panel:** Support tickets generated by landing chat or payment escalations accumulate in `support_tickets` table, but the owner has no way to see or manage them from the admin panel.
2. **Missing Transactional Email Relay:** No SMTP or Resend credentials on VPS. Payment escalations and password resets cannot be sent to real mailboxes.
3. **Broken Settings Payment Form:** `payment-settings-form` in `tab-settings` demands a USDT address (`required`) and still references old placeholders, blocking the admin from updating pricing or UPI details cleanly.

### P1 (High Operational Deficiencies)
4. **Missing Central Contact UI in Settings:** Admin cannot view or update `BUSINESS_EMAIL`, `SUPPORT_EMAIL`, WhatsApp, X, or LinkedIn URLs from the admin console without running raw API calls.
5. **Pricing Discrepancy between Landing & Backend:** `content.json` displays ₹599, whereas backend checkout enforces ₹1499. No UI exists to synchronize multi-tier prices.
6. **In-Memory Admin Sessions:** Admin sessions are lost whenever PM2 process 45 restarts.

### P2 (Platform & Automation Enhancements)
7. **No Automated Payment Gateways:** Stripe and Razorpay are mocked in tests but not configured on the live server.
8. **No Cloud Worker or Proxy Management:** Cloud browser workers and commercial proxy pools are not visible in the admin console.
9. **No Release Publishing Console:** App updates and installer binaries must be manually moved on the VPS filesystem.

---

## RECOMMENDED REMEDIATION ORDER

1. **Step 1: Fix Settings Payment & Contact Form:**
   - Remove `required` from USDT address in `public/index.html`.
   - Add input fields for `Business Email`, `Support Email`, `Billing Email`, `WhatsApp Number`, `X URL`, `LinkedIn URL`, and `UPI Account Holder`.
   - Wire form submission to `POST /api/settings/contact`.
2. **Step 2: Add "Support Tickets" Tab to Admin Console:**
   - Add `tab-support` navigation button and table in `index.html`.
   - Wire to existing `GET /api/v1/commercial/admin/support-tickets` and `PUT .../status` endpoints in `app.js`.
3. **Step 3: Provision Transactional Email Credentials:**
   - Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (or `RESEND_API_KEY`) to `/opt/mahi-admin-panel/.env`.
   - Hook real nodemailer transport into `handleSupportChatRoute`.
4. **Step 4: Synchronize Landing & Backend Pricing:**
   - Harmonize `price_inr` across `content.json` and `settings` table to prevent customer confusion.
5. **Step 5: Persist Admin Sessions in SQLite:**
   - Store admin session tokens in an `admin_sessions` SQLite table so admin logins survive PM2 restarts.
