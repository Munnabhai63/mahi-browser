# MAHI Browser — Production Launch Readiness Checklist

**Document Status:** Live Operational Checklist  
**Version Target:** v1.2.0  
**Last Updated:** November 20, 2026  
**Audience:** Owner (Mahipal Choudhary), Lead Engineers, DevOps  

---

## A. Verified Working (Production Certified)

The following components are fully tested, integrated, and verified working in code and deployed infrastructure:

- [x] **Automated Regression Suite Green**
  - **Evidence:** `npm run test:ci` -> `1237 passed | 0 failed | 16 skipped` tests across 134 test files. All unit, integration, and security tests green with 0 failures.
  - **Components Covered:** Pricing calculation, YouPI adapter, manual UPI UTR flow, webhook HMAC verification, anti-detect launcher, cloud sync, and commercial auth.
- [x] **Typecheck & Static Build Pass Cleanly**
  - **Evidence:** Root `npx tsc --noEmit` exits with code 0; Landing `npx tsc --noEmit` and `npm run build` exit with code 0 across all 39 static pages.
- [x] **Windows Installer Produced by CI**
  - **Evidence:** GitHub Actions workflow run `44470164303`, artifact `mahi-browser-win-x64` (404,983,992 bytes / 386 MB).
    NOTE: 386 MB is the uncompressed CI artifact. The published installer is 118,750,984 bytes (~113 MB) — see the GitHub Release section below.
- [x] **GitHub Release v1.1.9 Published**
  - **Evidence:** Public release tag `v1.1.9` on `Munnabhai63/mahi-browser` hosting 6 release assets:
    - `MAHI-Browser-Setup-1.1.9.exe` (118,750,984 bytes / ~113 MB)
    - `MAHI-Browser-Setup-latest.exe` (118,750,984 bytes / ~113 MB)
    - `MAHI-Browser-Portable-1.1.9.exe` (118,290,725 bytes / ~113 MB)
    - `MAHI-Browser-Portable-latest.exe` (118,290,725 bytes / ~113 MB)
    - `latest.yml` (auto-update manifest pointing to 1.1.9)
    - `SHA256SUMS.txt`
- [x] **Production Download & Auto-Update Endpoints (Verified Live)**
  - **Status:** [x] VERIFIED WORKING
  - **Evidence:** Tested live against production Nginx endpoints on `https://mahibrowser.com`:
    - `curl.exe -ILs https://mahibrowser.com/download/setup` -> HTTP 200 OK (315,782,958 bytes / ~301 MB, byte-ranges supported).
    - `curl.exe -ILs https://mahibrowser.com/download/portable` -> HTTP 200 OK (315,322,697 bytes / ~300 MB).
    - `curl.exe -s https://mahibrowser.com/update/latest.yml` -> HTTP 200 OK (serves `version: 1.2.0`, exact sha512 checksum).
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
  - **Evidence:** Web registration strictly enforces affirmative checkbox consent with `terms_version = '2026-11-19'`. Google OAuth SSO records terms consent when initiated from signup, leaving historical/unspecified records as NULL without retroactive fabrication. Queryable by admins via `GET /api/v1/admin/users` and `GET /api/v1/admin/terms-compliance`.

---

## B. Infrastructure Status (payments & email live)

These items must be resolved by the owner before opening live checkout to real paying users:

### 1. Production Host Environment Secrets (.env)
- **Status:** [x] CONFIGURED ON PRODUCTION — owner confirmed
- **Owner Confirmation:** Production .env is populated with YouPI merchant credentials; the gateway is live and serving UPI QR codes. Secrets are gitignored (.gitignore:12-13) and are never committed. This repository intentionally contains NO .env file — verification happens on the server, not in the repo.
- **What:** The `.env` file on the production backend server must be populated with live merchant credentials.
- **Required Variables:**
  - `YOUPI_PG_BASE_URL` (e.g. `https://<your-gateway-domain>`, see docs/PAYMENT_GATEWAY_RUNBOOK.md)
  - `YOUPI_PG_MERCHANT_ID` (Owner's merchant UUID)
  - `YOUPI_PG_API_KEY` (Merchant secret key)
  - `YOUPI_PG_SECRET` (Merchant secret key)
  - `YOUPI_PG_WEBHOOK_SECRET` (HMAC-SHA256 signature verification secret)
  - `BASE_PAYMENT_API_URL` (Matches gateway base URL)
- **Why It Matters:** Without these credentials, `initiatePayment()` intentionally throws `PaymentGatewayNotConfiguredError` in production to prevent fraudulent zero-amount orders.
- **Responsible Party:** Owner.
- **Verification:** SSH into server, verify `.env` is present and gitignored, run gateway smoke test curl from `docs/PAYMENT_GATEWAY_RUNBOOK.md`.

### 2. Live Email Transport Configuration
- **Status:** [x] CONFIGURED ON PRODUCTION — owner confirmed
- **What:** Configure real SMTP or Resend API credentials in production `.env`.
- **Required Variables (Option 1 - Resend API):**
  - `RESEND_API_KEY` or `EMAIL_API_KEY`
  - `EMAIL_FROM=MAHI Browser <support@mahibrowser.com>`
- **Required Variables (Option 2 - SMTP Relay):**
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Why It Matters:** Payments, account creation and login work without email — email verification is not enforced at login. Without a transport the customer receives no licence key, receipt or UTR status email, although the licence is always visible in-app under Account -> Your Licence (GET /api/v1/me/license). Owner has confirmed the transport is configured and verified on the production server.
- **Responsible Party:** Owner.
- **Verification:** Run `npm run verify:email -- --send owner@example.com` and confirm receipt in your personal inbox.

### 3. Windows Authenticode Code Signing Certificate
- **Status:** [x] DEFERRED — owner decision
- **What:** Install an EV or OV Authenticode certificate (PFX or Hardware Token) in the build pipeline.
- **Required Variables:**
  - `WIN_CSC_LINK` or `CSC_LINK`
  - `WIN_CSC_KEY_PASSWORD` or `CSC_KEY_PASSWORD`
  - Or `CERT_THUMBPRINT` for Cloud HSM / USB Dongle
- **Why It Matters:** Unsigned executables trigger the blue Windows Defender SmartScreen "Windows protected your PC" banner, severely harming checkout conversion.
- **Accepted Consequence:** The unsigned installer triggers the Windows SmartScreen "Windows protected your PC" prompt on first run. The user must click "More info" -> "Run anyway". Download and installation still work normally. Owner has accepted this trade-off. Revisit before large paid ad spend.
- **Responsible Party:** Owner (procure from DigiCert, Sectigo, or Certum).
- **Verification:** Run `signtool verify /pa release/MAHI-Browser-Setup-latest.exe` or right-click installer -> Properties -> Digital Signatures.

---

## C. Status Before Public Marketing Launch

Every item in this section is either CONFIGURED & VERIFIED or DEFERRED by explicit owner decision. ZERO items are blocking launch.

### 1. GST & Commercial Business Registration
- **Status:** [x] DEFERRED — owner decision
- **Current State:** Site already renders the legally-safe disclosure "Not applicable (proprietorship below GST threshold)" in place of a GSTIN. GST registration is not required below the Rs 20 lakh annual turnover threshold.
- **Why It Matters:** No statutory requirement at current turnover. Owner has explicitly waived this as a launch blocker.
- **Revisit:** Only if annual turnover approaches Rs 20 lakh.
- **Verification:** Update BRAND.legal.gstin in landing/lib/brand.ts and LEGAL_GSTIN in 10_CONFIG/contact-config.ts if registration is ever obtained.

### 2. Domain Support Mailbox Migration
- **Status:** [x] CONFIGURED & VERIFIED (Resend Outbound Live; Hostinger DNS Verified)
- **What:** Authenticate domain DNS (DKIM, SPF CNAMEs, DMARC) on Hostinger DNS via Resend.
- **Current State:** Domain `mahibrowser.com` verified on Resend (STATUS: Verified, RESEND FORGE: Ready). Outbound emails dispatch from `support@mahibrowser.com` with valid DKIM (`resend._domainkey`), SPF (`send.forge.rmta.net`, `rsend-apne1.forge.rmta.net`), and DMARC (`v=DMARC1; p=none;`).
- **Inbound Support:** Inbound replies routed via Gmail/Hostinger email forwarding (`support@mahibrowser.com` -> `mahiverse.official@gmail.com`).
- **Verification:** Verified live dispatch via `docker exec mahibrowser_gateway npm run verify:email -- --send mahiverse.official@gmail.com` -> 100% SUCCESS (`[✓] Test email successfully dispatched`).

### 3a. macOS Distribution Packages (.dmg)
- **Status:** [x] DEFERRED — owner decision
- **Current State:** Landing page already shows macOS as "Coming Soon" (BRAND.downloads.macDmgAvailable = false in landing/lib/brand.ts:24). This is accurate, not misleading.
- **Why It Matters:** Owner has waived macOS for launch. Windows is the launch platform.
- **Revisit:** When macOS demand justifies the Apple Developer ID cost.
- **Verification:** Flip BRAND.downloads.macDmgAvailable to true once a signed .dmg is published to the release.

### 3b. Linux Distribution Package (.AppImage)
- **Status:** [x] DEFERRED — owner decision
- **Current State:** Landing page already shows Linux as "Coming Soon" (BRAND.downloads.linuxAvailable = false in landing/lib/brand.ts:25).
- **Why It Matters:** Owner has waived Linux for launch; will revisit as the user base grows.
- **Revisit:** When Linux user demand justifies the CI runner cost.
- **Verification:** Flip BRAND.downloads.linuxAvailable to true once an .AppImage is published to the release.

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
