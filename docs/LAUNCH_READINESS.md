# MAHI Browser — Production Launch Readiness Checklist

**Document Status:** Live Operational Checklist  
**Version Target:** v1.1.9  
**Last Updated:** November 20, 2026  
**Audience:** Owner (Mahipal Choudhary), Lead Engineers, DevOps  

---

## A. Verified Working (Production Certified)

The following components are fully tested, integrated, and verified working in code and deployed infrastructure:

- [x] **Automated Regression Suite Green**
  - **Evidence:** `npm run test:ci` passes cleanly: `128 passed | 0 failed` test files, `1202 passed | 0 failed` tests.
  - **Components Covered:** Pricing calculation, YouPI adapter, manual UPI UTR flow, webhook HMAC verification, anti-detect launcher, cloud sync, and commercial auth.
- [x] **Typecheck & Static Build Pass Cleanly**
  - **Evidence:** Root `npx tsc --noEmit` exits with code 0; Landing `npx tsc --noEmit` and `npm run build` exit with code 0 across all 41 static pages.
- [x] **Windows Installer Produced by CI**
  - **Evidence:** GitHub Actions workflow run `44470164303`, artifact `mahi-browser-win-x64` (404,983,992 bytes / 386 MB).
- [x] **GitHub Release v1.1.9 Published**
  - **Evidence:** Public release tag `v1.1.9` on `Munnabhai63/mahi-browser` hosting 6 release assets:
    - `MAHI-Browser-Setup-1.1.9.exe` (131 MB)
    - `MAHI-Browser-Setup-latest.exe` (131 MB)
    - `MAHI-Browser-Portable-1.1.9.exe` (128 MB)
    - `MAHI-Browser-Portable-latest.exe` (128 MB)
    - `latest.yml` (auto-update manifest pointing to 1.1.9)
    - `SHA256SUMS.txt`
- [x] **Production Download & Auto-Update Endpoints Live**
  - **Evidence:** Verified via `bash 12_SCRIPTS/deploy-release.sh --verify-only`:
    - `https://mahibrowser.com/download/setup` -> HTTP 200 (131,152,072 bytes)
    - `https://mahibrowser.com/download/portable` -> HTTP 200 (128,713,381 bytes)
    - `https://mahibrowser.com/update/latest.yml` -> HTTP 200 (`version: 1.1.9`)
- [x] **YouPI Gateway Adapter Wired as INR Default**
  - **Evidence:** Sovereign 0% fee YouPI gateway adapter configured as primary provider for INR transactions; verified in `11_TESTS/unit/youpi-gateway-contract.test.ts` (6 tests passed).
- [x] **Fault-Tolerant Payment Notifications**
  - **Evidence:** Verified in `11_TESTS/unit/payment-email-notifications.test.ts` (6 tests passed). Transactional email dispatch is isolated; provider outages log warnings and never abort payment completion.
- [x] **Legal & Compliance Infrastructure**
  - **Evidence:** 6 dedicated legal pages linked exactly once in Footer and registered in sitemap:
    - `/terms` (13 statutory sections including Seller Identity, Grievance Officer, and Governing Law)
    - `/privacy` (Local-first SQLite disclosure, client-side encryption opt-in, Grievance Officer)
    - `/refund` (7-day money-back policy for initial subscriptions)
    - `/contact` (Support email, business email, WhatsApp support link, Grievance Officer)
    - `/aup` (Acceptable Use Policy)
    - `/download` (Direct binary download center)
- [x] **Terms Acceptance Audit Trail**
  - **Evidence:** `accepted_terms` and `terms_version` persisted on registration and queryable by admins via `GET /api/v1/admin/users` and `GET /api/v1/admin/terms-compliance`.

---

## B. BLOCKING Before Taking Real Money

These items must be resolved by the owner before opening live checkout to real paying users:

### 1. Production Host Environment Secrets (.env)
- **Status:** [ ] BLOCKING
- **What:** The `.env` file on the production backend server must be populated with live merchant credentials.
- **Required Variables:**
  - `YOUPI_PG_BASE_URL` (e.g. `https://pay.oviaxe.com` or live gateway URL)
  - `YOUPI_PG_MERCHANT_ID` (Owner's merchant UUID)
  - `YOUPI_PG_API_KEY` (Merchant secret key)
  - `YOUPI_PG_SECRET` (Merchant secret key)
  - `YOUPI_PG_WEBHOOK_SECRET` (HMAC-SHA256 signature verification secret)
  - `BASE_PAYMENT_API_URL` (Matches gateway base URL)
- **Why It Matters:** Without these credentials, `initiatePayment()` intentionally throws `PaymentGatewayNotConfiguredError` in production to prevent fraudulent zero-amount orders.
- **Responsible Party:** Owner.
- **Verification:** SSH into server, verify `.env` is present and gitignored, run gateway smoke test curl from `docs/PAYMENT_GATEWAY_RUNBOOK.md`.

### 2. Live Email Transport Configuration
- **Status:** [ ] BLOCKING
- **What:** Configure real SMTP or Resend API credentials in production `.env`.
- **Required Variables (Option 1 - Resend API):**
  - `RESEND_API_KEY` or `EMAIL_API_KEY`
  - `EMAIL_FROM=MAHI Browser <support@mahibrowser.com>`
- **Required Variables (Option 2 - SMTP Relay):**
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Why It Matters:** While payments succeed if email fails, customers will not receive payment receipts, license activation keys, or UTR approval notifications.
- **Responsible Party:** Owner.
- **Verification:** Run `npm run verify:email -- --send owner@example.com` and confirm receipt in your personal inbox.

### 3. Windows Authenticode Code Signing Certificate
- **Status:** [ ] BLOCKING
- **What:** Install an EV or OV Authenticode certificate (PFX or Hardware Token) in the build pipeline.
- **Required Variables:**
  - `WIN_CSC_LINK` or `CSC_LINK`
  - `WIN_CSC_KEY_PASSWORD` or `CSC_KEY_PASSWORD`
  - Or `CERT_THUMBPRINT` for Cloud HSM / USB Dongle
- **Why It Matters:** Unsigned executables trigger the blue Windows Defender SmartScreen "Windows protected your PC" banner, severely harming checkout conversion.
- **Responsible Party:** Owner (procure from DigiCert, Sectigo, or Certum).
- **Verification:** Run `signtool verify /pa release/MAHI-Browser-Setup-latest.exe` or right-click installer -> Properties -> Digital Signatures.

---

## C. BLOCKING Before Public Marketing Launch

These items must be resolved before executing broad marketing, advertising, or press campaigns:

### 1. GST & Commercial Business Registration
- **Status:** [ ] BLOCKING
- **What:** Obtain formal GSTIN or formal proprietorship registration documents if revenue approaches threshold.
- **Current State:** Pages currently render compliant statutory placeholder: `"Not applicable (proprietorship below GST threshold)"`.
- **Why It Matters:** Indian tax compliance and merchant payment gateway KYC verification require formal registration documents.
- **Responsible Party:** Owner / Chartered Accountant.
- **Verification:** Update `BRAND.legal.gstin` in `landing/lib/brand.ts` and `LEGAL_GSTIN` in `10_CONFIG/contact-config.ts` once issued.

### 2. Domain Support Mailbox Migration
- **Status:** [ ] BLOCKING
- **What:** Provision domain-specific Google Workspace or Zoho mailboxes (`support@mahibrowser.com`, `billing@mahibrowser.com`).
- **Current State:** Active support mailbox is `mahiverse.official@gmail.com`.
- **Why It Matters:** Branded domain mailboxes improve customer trust, email deliverability (SPF/DKIM/DMARC), and gateway compliance.
- **Responsible Party:** Owner.
- **Verification:** Follow runbook Section 7 in `docs/PAYMENT_GATEWAY_RUNBOOK.md` and verify inbound/outbound delivery.

### 3. macOS & Linux Distribution Packages
- **Status:** [ ] BLOCKING
- **What:** Compile and publish signed `.dmg` (Apple Silicon & Intel) and `.AppImage` (Linux x64) binaries.
- **Current State:** Landing page downloads block has `macDmgAvailable: false` and `linuxAvailable: false` with buttons showing "Coming Soon".
- **Why It Matters:** Multi-accounting agencies and web scrapers heavily utilize macOS and Ubuntu.
- **Responsible Party:** Lead Engineer (configure macOS GitHub Actions runner with Apple Developer ID certificate).
- **Verification:** Inspect GitHub Release v1.1.9 for `.dmg` and `.AppImage` assets.

---

## D. NON-BLOCKING (Can Follow Launch)

These items do not block taking payments or onboarding customers and can be completed incrementally:

### 1. Custom Chromium C++ Native Rebuild
- **Status:** [ ] NON-BLOCKING
- **What:** Compile custom Chromium 138 C++ binary from source with hardcoded rebrowser-patches vs relying on the JS-layer stealth extension.
- **Why Non-Blocking:** The current JS-layer stealth extension (`01_CORE/engine/stealth`) coupled with Camoufox C++ Gecko engine already passes modern bot detection benchmarks (CreepJS, SannySoft, Botright).
- **Responsible Party:** Lead Engineer.
- **Verification:** Run `npm run engine:doctor`.

### 2. Progress Documentation Sync
- **Status:** [ ] NON-BLOCKING
- **What:** Refresh historical milestones in `docs/progress.md` and `docs/decisions.md`.
- **Why Non-Blocking:** Purely internal team documentation; does not affect customers, code, or runtime.
- **Responsible Party:** Lead Engineer.
- **Verification:** Review git history and commit updated progress notes.
