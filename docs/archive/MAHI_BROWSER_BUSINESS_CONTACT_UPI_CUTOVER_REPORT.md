# MAHI BROWSER: PRODUCTION BUSINESS CONTACT + SUPPORT + UPI PAYMENT CONFIGURATION CUTOVER REPORT

**Execution Date:** October 11, 2026  
**Status:** COMPLETE (Production Verified)  
**Target Platform:** Desktop App (Electron/React/TS) + Live Landing Website (`mahibrowser.com`) + Central Admin & Licensing Platform (`admin.mahibrowser.com`)

---

## 1. Executive Summary & Authoritative Values

All legacy and placeholder business contacts, dummy WhatsApp numbers, root social links, and unverified payment channels across MAHI Browser have been excised and replaced with authoritative business identities.

### Canonical Production Business Data
| Category | Field Name | Authoritative Value | Public Visibility |
| :--- | :--- | :--- | :--- |
| **Primary Business** | `BUSINESS_EMAIL` | `mahiverse.hub@gmail.com` | Public (Legal, Partnerships, Business) |
| **Support & Billing** | `SUPPORT_EMAIL` | `mahiverse.official@gmail.com` | Public (Support Drawer, Account, Help) |
| **Billing / Invoice** | `BILLING_EMAIL` | `mahiverse.official@gmail.com` | Public (Receipts, Billing Queries) |
| **Escalations** | `SUPPORT_ESCALATION_EMAIL` | `mahiverse.official@gmail.com` | Server-side recipient for payment tickets |
| **WhatsApp Support** | `WHATSAPP_NUMBER` | `+91 9376343629` | Public (`https://wa.me/919376343629`) |
| **Official X (Twitter)** | `X_URL` | `https://x.com/MunaBhai63` | Public Social Link |
| **Official LinkedIn** | `LINKEDIN_URL` | `https://www.linkedin.com/in/mahipal-choudhary-153ba83b1` | Public Social Link |
| **UPI Payment ID** | `UPI_ID` | `6375823589@slc` | Payment Modal / Drawer |
| **UPI Account Holder** | `UPI_ACCOUNT_HOLDER` | `Mr Mahipal Choudhary` | Payment Modal / Drawer |
| **UPI Official QR** | `UPI_QR_ASSET` | Slice Official QR (PNG) | Verified Asset (`/brand/mahi-upi-qr.png`) |
| **USDT Channel** | `USDT_ENABLED` | `false` (Disabled) | Wiped placeholder, Hidden |

---

## 2. Surgical Perimeter & Safety Compliance

- **Unrelated VPS Apps / Domains Unmodified:** DRIP SMM (`Mahi terabox`), MAHI SKILLS, My 4K Downloader, falcon-backend, rumble-traffic, and all external PM2 processes (ids 1, 25, 29, 30, 31, 33, 34, 36, 39, 40, 42, 43) were completely untouched.
- **PM2 Process Boundary:** Only PM2 process 45 (`mahi-admin`) was restarted to reload updated routes and handlers.
- **USDT Zero-Trust Enforcement:** Fake placeholder TRC20 address (`TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9`) has been purged from code, configs, landing pages, and database records. USDT remains disabled until real keys and network are provisioned.
- **Zero Placeholder Leakage:** Eliminated `+91 99999 99999`, `+919876543210`, bare `https://wa.me/`, `mahibrowser@upi`, and generic root socials (`linkedin.com`, `x.com`, `facebook.com`, `instagram.com`, `youtube.com`).
- **Unconfigured Socials Hidden:** Facebook, Telegram, Instagram, and YouTube links are suppressed across the entire frontend.

---

## 3. Centralized Architecture & Code Changes

### A. Core Desktop & App Config (`10_CONFIG/`)
- `10_CONFIG/contact-config.ts`: Single source of truth containing `CONTACT_CONFIG`, format validators (`validateEmail`, `validateWhatsApp`, `validateUpiId`, `validateUrl`), URL builders (`buildWhatsAppLink`), and safe getter `getAuthoritativeContactConfig()`.
- `10_CONFIG/brand-config.ts`: Added `BRAND_ASSETS.upiQr` pointing to authoritative Slice QR asset with strict SHA256 integrity check.
- `10_CONFIG/shared/types/ipc.ts` & `10_CONFIG/preload/index.ts`: Typed IPC contracts for `account:submitManualUpiPayment` and `account:getPaymentInfo`.

### B. Desktop UI & Backend Bridge
- `01_UI/components/Sidebar.tsx`: Replaced outdated Telegram community links with direct WhatsApp support (`https://wa.me/919376343629`) and official support email.
- `01_UI/components/AccountModal.tsx`: Rendered complete UPI payment card with official Slice QR code image, Account Holder ("Mr Mahipal Choudhary"), UPI ID ("6375823589@slc"), one-click copy button, UTR reference input, duplicate detection guard, and live status updates.
- `08_SECURITY/account-service.ts` & `07_BACKEND/ipc/register-handlers.ts`: Implemented `submitManualUpiPayment()` with input validation and remote API dispatch.

### C. Live Landing Pages (`landing/`)
- `landing/content.json`: Updated canonical fields and disabled USDT.
- `landing/index.html`: Canonicalized hero/footer WhatsApp buttons and support drawer; hidden unconfigured socials.
- `landing/pricing.html`: Updated all consultation and payment escalation links to canonical WhatsApp.
- `landing/terms.html`, `landing/privacy.html`, `landing/aup.html`: Updated contact sections to `mahiverse.hub@gmail.com` and `mahiverse.official@gmail.com`.
- `landing/assets/js/main.js`: Added automatic suppression of unconfigured social channels and canonical WhatsApp fallback.

### D. Production Admin Backend & Database (`admin.mahibrowser.com`)
- **Database (`panel.db`):** Additive migration creating `manual_payments` table with `utr UNIQUE` constraint, indexes on `user_id` and `status`, and sanitized `settings` table.
- **Account Service (`/opt/mahi-admin-panel/src/account-service.js`):**
  - `submitManualPayment(userId, payload)`: Enforces server-side canonical price (₹1499 for PRO), checks for duplicate UTRs, and creates `PENDING_VERIFICATION` records.
  - `listManualPayments(query)`: Moderation queue listing.
  - `approveManualPayment(paymentId, reviewedBy)`: Sets status to `APPROVED` and invokes `activateSubscription` for 1-year entitlement extension.
  - `rejectManualPayment(paymentId, reason, reviewedBy)`: Sets status to `REJECTED`.
- **API Endpoints (`/opt/mahi-admin-panel/src/server.js`):**
  - `POST /v1/account/payments/upi/submit` (Authenticated via session token).
  - `GET /api/admin/payments/manual` (Admin protected).
  - `POST /api/admin/payments/manual/:id/approve` (Admin protected).
  - `POST /api/admin/payments/manual/:id/reject` (Admin protected).
  - `GET /api/settings/contact` & `POST /api/settings/contact`.
  - Support chat payment escalation route dispatched to `mahiverse.official@gmail.com`.
- **Admin UI (`/opt/mahi-admin-panel/public/`):** Added "UPI Payments" tab with moderation table and approve/reject actions.

---

## 4. Live Production E2E Verification Results

All 12 live end-to-end verification tests against `https://mahibrowser.com` and `https://admin.mahibrowser.com` passed:

1. **Live Content API (`content.json`):** PASS (WhatsApp `+91 9376343629`, emails, socials, UPI ID matched).
2. **Website Slice QR Asset:** PASS (HTTP 200, Content-Type `image/png`).
3. **Admin Panel QR Asset:** PASS (HTTP 200).
4. **Payment Info API (`/v1/account/payment-info`):** PASS (₹1499 canonical price, UPI ID `6375823589@slc`, USDT disabled).
5. **Website Placeholders Cleaned (`index.html`):** PASS (No dummy phones, no bare `wa.me/`, no placeholder UPI/USDT).
6. **Pricing Page Cleaned (`pricing.html`):** PASS (Canonical WhatsApp verified).
7. **User Registration (`/v1/account/signup`):** PASS (Session token generated).
8. **Manual UPI Submission:** PASS (HTTP 200, status `PENDING_VERIFICATION`, amount ₹1499).
9. **Duplicate UTR Protection:** PASS (HTTP 409 Rejected with duplicate error).
10. **Admin Payment Review & Approval:** PASS (HTTP 200 APPROVED).
11. **Entitlement Activation:** PASS (Account plan upgraded to `pro` for 12 months).
12. **Support Chat Escalation Route:** PASS (Escalation ticket generated and queued to `mahiverse.official@gmail.com`).

---

## 5. Security & Verification Summary

- **Secrets Protected:** No credentials, tokens, private keys, or passwords committed or exposed.
- **TypeScript Typecheck:** Clean (0 errors).
- **Unit & Integration Tests:** 12/12 new tests passing (`business-contact-upi-cutover.test.ts`), 100% regression suite passing.
