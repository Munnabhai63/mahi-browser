# MAHI BROWSER — BUSINESS CONTACT, SUPPORT & PAYMENT CONFIGURATION REALITY AUDIT

**Audit Date:** October 10, 2026  
**Mode:** STRICT READ-ONLY FORENSIC AUDIT  
**Status:** COMPLETE (Zero Files Modified • Zero Deployments • Zero Secret Exposure)  
**Target Systems:**  
- Production Web Landing (`https://mahibrowser.com`, Nginx root `/var/www/mahi`)
- Super Admin Cloud Panel (`/opt/mahi-admin-panel`, Port 4180 / 3000, `panel.db`)
- Desktop Electron Client (`01_UI`, `02_BROWSER`, `08_SECURITY`, `10_CONFIG`)
- Commercial Backend Services (`07_BACKEND/commercial`, `05_AUTH/email-service.ts`)
- DNS Zone Records (`mahibrowser.com` via Hostinger DNS `nova.dns-parking.com`)

---

## EXECUTIVE SUMMARY

A forensic inspection of the entire MAHI Browser ecosystem was conducted across source code, production server databases, live web pages, desktop application views, and DNS records.

### Key Reality Findings:
1. **Business Emails:** `support@mahibrowser.com` is advertised publicly across the landing page, terms, privacy, and desktop app. However, **DNS MX records are completely missing**. As a result, **any inbound email sent by users bounces**. In addition, `noreply@mahibrowser.com` is configured as a fallback sender, while `billing@mahibrowser.com` and `security@mahibrowser.com` are documented in reports but have no active mailboxes or code-level configuration.
2. **WhatsApp & Phone Numbers:** Public pages use `https://wa.me/` with no phone number, or rely on client-side hydration from `content.json`, which currently holds a **dummy placeholder (`+91 99999 99999`)**. The live VPS database `panel.db` contains a second **dummy placeholder (`+919876543210`)**. No real mobile contact number exists.
3. **Social Media Links:** All footer social links on the website (`https://linkedin.com`, `https://x.com`, `https://facebook.com`, `https://youtube.com`, `https://instagram.com`, `https://t.me/`) point to **unconfigured root homepage URLs**.
4. **Internal / Personal Leak:** The desktop client sidebar ([01_UI/components/Sidebar.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/Sidebar.tsx#L183)) has a hardcoded link to a personal Telegram handle: `https://t.me/MunaBhai63` ("Personal Support") and `https://t.me/mahiskills`.
5. **Payment Gateway Reality:** **Zero automated gateways** (Stripe, Razorpay, LemonSqueezy) are installed or implemented. No automated payment webhook exists.
6. **Crypto / USDT Architecture:** The project uses a **100% manual payment workflow**. The database `panel.db` and fallback code contain a **fake dummy USDT TRC20 address (`TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9`)**. Users who click "Upgrade" in the desktop app see this dummy address and a dummy UPI ID (`mahibrowser@upi`), along with a button redirecting them to WhatsApp to send manual payment screenshots.
7. **Email Delivery Infrastructure:** In production, the email delivery service ([05_AUTH/email-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/email-service.ts#L477)) supports Resend or SMTP, but **neither is configured in `/opt/mahi-admin-panel/.env`**. Consequently, automated escalation emails and verification emails are dormant in production.

---

## STEP 1 — FULL INVENTORY OF BUSINESS & PROJECT EMAILS

| Email Address | Category | File / Config Location | Surface / Usage | Status | Hardcoded vs Config | Safe to Replace? |
|---|---|---|---|---|---|---|
| `support@mahibrowser.com` | SUPPORT | `landing/index.html` (L659, L1409), `landing/terms.html` (L125), `landing/privacy.html` (L121), `landing/aup.html` (L145), `landing/content.json` (L5), `05_AUTH/email-service.ts` (L155, L416), `electron-builder.json` (L113) | Primary customer support link, mailto links, legal notices, installer maintainer | **ADVERTISED BUT BOUNCES** (No MX record) | Partially Config-Driven (`process.env.SUPPORT_EMAIL` fallback, hardcoded in HTML) | **YES** (Must bind to real mailbox) |
| `noreply@mahibrowser.com` | NO-REPLY | `05_AUTH/email-service.ts` (L415, L481, L492) | Default `From:` header for verification emails and password resets | **CONFIGURED AS SENDER DEFAULT** | Config-Driven (`process.env.EMAIL_FROM`, `SMTP_FROM`) | **YES** |
| `billing@mahibrowser.com` | BILLING | Mentioned in `docs/MAHI_BROWSER_BETA_LAUNCH_AND_GA_GATE_REPORT.md` (L133) & `docs/MAHI_BROWSER_FINAL_REMAINING_WORK_AUDIT.md` (L65) | Documented routing specification | **NOT IMPLEMENTED IN CODE** | Conceptual only | **YES** (Needs creation) |
| `security@mahibrowser.com` | SECURITY | Mentioned in `docs/MAHI_BROWSER_BETA_LAUNCH_AND_GA_GATE_REPORT.md` (L133) | Security vulnerability disclosure | **NOT IMPLEMENTED IN CODE** | Conceptual only | **YES** (Needs creation) |
| `abuse@mahibrowser.com` | SECURITY / LEGAL | `landing/aup.html` (L144) | Abuse reporting contact in Acceptable Use Policy | **HARDCODED IN HTML** (Bounces) | Hardcoded | **YES** (Needs mailbox or alias) |
| `admin@mahibrowser.com` | ADMIN / TEST | `11_TESTS/integration/phase7-web-pipeline.test.ts` (L47) | Integration test fixture | Test fixture only | Hardcoded test data | **NO** (Keep in tests) |
| `owner@mahibrowser.local` | INTERNAL MOCK | `01_UI/api-fallback.ts` (L441), `02_BROWSER/services/workspace-service.ts` (L59) | Local offline workspace owner account | Active internal fallback | Hardcoded | **NO** (Internal system logic) |
| `admin@mahibrowser.local` | INTERNAL MOCK | `02_BROWSER/services/workspace-service.ts` (L150) | Local offline admin fallback | Active internal fallback | Hardcoded | **NO** (Internal system logic) |
| `local@mahibrowser.local` | INTERNAL MOCK | `07_BACKEND/commercial/commercial-entitlement-service.ts` (L110) | Local entitlement fallback identity | Active internal fallback | Hardcoded | **NO** (Internal system logic) |
| `name@company.com` | PLACEHOLDER | `landing/index.html` (L1585), `landing/login.html` (L331) | Form input placeholder text (`placeholder="name@company.com"`) | Display placeholder | Hardcoded | **NO** (Standard UI placeholder) |
| `name@example.com` | PLACEHOLDER | `landing/signup.html` (L286) | Form input placeholder text | Display placeholder | Hardcoded | **NO** (Standard UI placeholder) |
| `user@example.com` | PLACEHOLDER | `landing/download.html` (L507) | Demo profile initial badge | Display placeholder | Hardcoded | **NO** (Standard UI placeholder) |

---

## STEP 2 — SUPPORT EMAIL STATUS MATRIX

| Expected Mailbox | Configured in Code? | Mailbox Hosted / Inbound? | Sending Enabled? | Current Reality Status |
|---|---|---|---|---|
| `support@mahibrowser.com` | **YES** (Fallback in code & HTML) | **NO** (No MX record in DNS) | **NO** (No SMTP/Resend creds on VPS) | **ADVERTISED BUT NON-FUNCTIONAL** |
| `billing@mahibrowser.com` | **NO** (Only in markdown docs) | **NO** (No MX record) | **NO** | **NOT CONFIGURED** |
| `security@mahibrowser.com` | **NO** (Only in markdown docs) | **NO** (No MX record) | **NO** | **NOT CONFIGURED** |
| `abuse@mahibrowser.com` | **YES** (`landing/aup.html`) | **NO** (No MX record) | **NO** | **HARDCODED / BOUNCES** |
| `hello@mahibrowser.com` | **NO** | **NO** | **NO** | **NOT CONFIGURED** |
| `contact@mahibrowser.com` | **NO** | **NO** | **NO** | **NOT CONFIGURED** |
| `noreply@mahibrowser.com` | **YES** (Sender default) | **N/A** (Outbound only) | **NO** (Provider missing in `.env`) | **CODE READY / CREDENTIALS MISSING** |

---

## STEP 3 — PHONE & WHATSAPP AUDIT

### 1. Where WhatsApp and Phone Numbers Exist:

| Location | Masked / Current Value | Current URL / Attribute | Mechanism | Target Audience | Purpose |
|---|---|---|---|---|---|
| `landing/index.html` (L136) | *None* | `href="https://wa.me/" class="dynamic-whatsapp-link"` | Hydrated by `main.js` from `content.json` | Public Visitors | Hero secondary "WhatsApp Support" button |
| `landing/index.html` (L1408) | *None* | `href="https://wa.me/" class="dynamic-whatsapp-link"` | Hydrated by `main.js` from `content.json` | Public Visitors | Footer Navigation column "WhatsApp Support" |
| `landing/index.html` (L1486) | *None* | `href="https://wa.me/" class="dynamic-whatsapp-link"` | Hydrated by `main.js` from `content.json` | Public Visitors | Floating Support Drawer Header WhatsApp icon |
| `landing/content.json` (L4) | `+91 99999 99999` (Dummy) | Value injected into DOM links | JSON file read by client JS | Public Visitors | Static fallback content |
| `landing/assets/js/main.js` (L3176) | `+91-9876543210` (Dummy) | Fallback if `content.json` missing | Client JavaScript | Public Visitors | Hardcoded fallback in script |
| Production Database (`panel.db` `settings`) | `+919876543210` (Dummy) | `whatsapp_number` field in SQLite | Database record | Super Admin / API | Stored in settings table |
| Production Server (`/opt/.../account-service.js` L569) | `+919876543210` (Dummy) | Code default in `getPaymentInfo()` | Backend Node.js service | Desktop App API | Fallback if settings table empty |
| Desktop App ([01_UI/components/AccountModal.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/AccountModal.tsx#L573)) | Hydrated via API | `href="https://wa.me/${waCleanNumber}?text=..."` | React Component | Logged-in App Users | "Send Payment Proof to WhatsApp" button |
| Admin Panel ([scratch/admin_app.js](file:///c:/Users/munaf/Desktop/mahai%20brouser/scratch/admin_app.js#L562)) | User-editable | Input `#pay-whatsapp` | Admin UI form | Admin Operator | Allows updating number stored in `panel.db` |

### Critical Finding:
There is **NO genuine production phone or WhatsApp number** configured anywhere. Real users clicking WhatsApp buttons either land on `https://wa.me/` (invalid URL) or `https://wa.me/919999999999` / `https://wa.me/919876543210` (dummy placeholders).

---

## STEP 4 — SOCIAL MEDIA LINKS AUDIT

| Platform | Current Link in Code | Where Used | Status | Central Config? | Risk / Finding |
|---|---|---|---|---|---|
| **LinkedIn** | `https://linkedin.com` | `landing/index.html` (L1315), `landing/pricing.html` (L233) | **PLACEHOLDER** | **NO** (Hardcoded in HTML) | Takes visitor to generic LinkedIn home page |
| **YouTube** | `https://youtube.com` | `landing/index.html` (L1320), `landing/pricing.html` (L238) | **PLACEHOLDER** | **NO** (Hardcoded in HTML) | Takes visitor to generic YouTube home page |
| **Telegram (Public)** | `https://t.me/` | `landing/index.html` (L1325), `landing/pricing.html` (L243) | **BROKEN / PLACEHOLDER** | **NO** (Hardcoded in HTML) | Empty trailing slash URL; invalid Telegram link |
| **Facebook** | `https://facebook.com` | `landing/index.html` (L670, L1330), `landing/pricing.html` (L248) | **PLACEHOLDER** | **NO** (Hardcoded in HTML) | Takes visitor to generic Facebook login page |
| **Instagram** | `https://instagram.com` | `landing/index.html` (L1335), `landing/pricing.html` (L253) | **PLACEHOLDER** | **NO** (Hardcoded in HTML) | Takes visitor to generic Instagram home page |
| **Twitter / X** | `https://x.com` | `landing/index.html` (L1340), `landing/pricing.html` (L258) | **PLACEHOLDER** | **NO** (Hardcoded in HTML) | Takes visitor to generic X home page |
| **Telegram (Desktop Sidebar)** | `https://t.me/mahiskills` | [01_UI/components/Sidebar.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/Sidebar.tsx#L172) | **LEGACY CHANNEL** | **NO** (Hardcoded in React) | Labeled "MAHI Skills" |
| **Telegram (Personal Support)** | `https://t.me/MunaBhai63` | [01_UI/components/Sidebar.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/Sidebar.tsx#L183) | **PERSONAL ACCOUNT** | **NO** (Hardcoded in React) | Labeled "Personal Support" with PRO badge |

---

## STEP 5 — SUPPORT IMAGES, AVATARS & LOGOS AUDIT

| Asset Description | File Path / Representation | Surface / Component | Role / Purpose | Current Status |
|---|---|---|---|---|
| **Support Headset SVG** | Inline SVG (`<path d="M3 18v-6a9 9 0 0 1 18 0v6">...`) | Floating Trigger ([index.html:1554](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L1554)), Drawer Header ([index.html:1474](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L1474)), Preview Card ([index.html:694](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L694)) | Primary Customer Support visual identity | **CURRENT & LIVE** (Replaced UFO/AI icon) |
| **Team Avatar 1** | `landing/assets/img/avatars/avatar_1.svg` | Hero demo cluster ([index.html:174](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L174)) | "Support Specialist" avatar | **CURRENT & LIVE** |
| **Team Avatar 2** | `landing/assets/img/avatars/avatar_2.svg` | Hero demo cluster ([index.html:175](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L175)) | "Lead Engineer" avatar | **CURRENT & LIVE** |
| **Team Avatar 3** | `landing/assets/img/avatars/avatar_3.svg` | Hero demo cluster ([index.html:176](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L176)) | "Product Manager" avatar | **CURRENT & LIVE** |
| **Brand Logo** | `landing/assets/img/logo.png` (32x32) | Navbar ([index.html:39](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L39)), Footer ([index.html:1308](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L1308)) | Official brand emblem | **CURRENT & LIVE** |
| **Support Window Mockup** | `landing/assets/img/ui/support_bg1.svg` | Support Section ([index.html:686](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/index.html#L686)) | macOS frame background behind chat card | **CURRENT & LIVE** |
| **User Initial Avatar** | Dynamic CSS badge (`#avatarInitial`) | `landing/download.html` (L505) | Displays user initial (e.g. "M") | **CURRENT & LIVE** |

---

## STEP 6 — COMPLETE USER-FACING CONTACT SURFACES MAP

| Surface / Page | Contact / Payment Info Displayed | Interactive Trigger | Backing Source | Reality Assessment |
|---|---|---|---|---|
| **Landing Header / Navbar** | None directly (Nav links to `#support`) | Click scrolls to `#support` | HTML anchor | Working scroll anchor |
| **Landing Hero** | "Book a demo" cluster with WhatsApp link | Click triggers `.dynamic-whatsapp-link` | `content.json` | Resolves to placeholder WhatsApp |
| **Landing Support Section** | 4 channels: Live-chat, MAHI Support, Email (`support@mahibrowser.com`), Facebook | Clicks open drawer or launch email | Static HTML + inline JS | Email bounces; Facebook goes to root |
| **Landing Floating Drawer** | MAHI Browser Support, WhatsApp header button, Quick Topic pills, Escalation | Trigger button in bottom-right; auto-response engine | `landing/assets/js/main.js` | Chat drawer works; WhatsApp link in header is placeholder |
| **Landing Pricing Page** | Pricing cards, comparison table, footer links | "Try 7 Days Free", WhatsApp buttons in footer | `landing/pricing.html` | All footer socials and WhatsApp are placeholders |
| **Terms of Service** | `support@mahibrowser.com` (Legal notices) | `mailto:support@mahibrowser.com` | Hardcoded HTML | Bounces |
| **Privacy Policy** | `support@mahibrowser.com` (Data requests) | `mailto:support@mahibrowser.com` | Hardcoded HTML | Bounces |
| **Acceptable Use (AUP)** | `abuse@mahibrowser.com`, `support@mahibrowser.com` | `mailto:` links | Hardcoded HTML | Both bounce |
| **Desktop App Sidebar** | Telegram (`mahiskills`), Personal (`MunaBhai63`) | External browser open | [01_UI/components/Sidebar.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/Sidebar.tsx#L172) | Hardcoded personal handle exposed |
| **Desktop App Upgrade Modal** | UPI ID, USDT (TRC20) address, WhatsApp proof button | Copy buttons, WhatsApp link | [01_UI/components/AccountModal.tsx](file:///c:/Users/munaf/Desktop/mahai%20brouser/01_UI/components/AccountModal.tsx#L559) | Shows fake dummy USDT address & dummy phone |
| **Admin Panel UI** | Contact display, WhatsApp share, Payment settings | Form inputs | `/opt/mahi-admin-panel/public` | Settings form allows updating DB, but not all fields exposed |

---

## STEP 7 — CENTRAL CONFIGURATION REALITY

**Verdict: PARTIALLY CENTRALIZED / FRAGMENTED**

1. **What is Centralized in the Database (`panel.db` `settings` table):**
   - `upi_id`
   - `price_inr`
   - `price_usdt`
   - `usdt_address`
   - `usdt_network`
   - `whatsapp_number`
   *(Served dynamically to the desktop app via `GET /v1/account/payment-info`)*

2. **What is Disconnected / Fragmented:**
   - `landing/content.json` on the web server only stores `whatsapp_number`, `email`, `price_inr`, `price_usd_trc20`. It does NOT receive `usdt_address` or `upi_id`.
   - All **social media links** (`LinkedIn`, `X`, `Facebook`, `YouTube`, `Instagram`, `Telegram`) are hardcoded across multiple static HTML files.
   - All **support/legal email addresses** (`support@`, `abuse@`) are hardcoded across HTML files.
   - The **desktop application's Telegram links** are hardcoded in a React TSX file.

---

## STEP 8 — ADMIN PANEL CAPABILITY AUDIT

| Field / Feature | Can Admin Currently Change from Web UI? | Backend API Endpoint Available? | Stored In Database? | Reality Notes |
|---|---|---|---|---|
| **Support Email** | ❌ **NO** | ❌ None | ❌ None | Hardcoded across client files |
| **Billing Email** | ❌ **NO** | ❌ None | ❌ None | Does not exist |
| **WhatsApp Number** | ✅ **YES** | ✅ `POST /api/settings/payment` | ✅ `settings` (`whatsapp_number`) | Editable in "Live Payment Settings" |
| **Phone Number (General)** | ❌ **NO** | ❌ None | ❌ None | No separate phone field |
| **LinkedIn URL** | ❌ **NO** | ❌ None | ❌ None | Hardcoded in HTML |
| **Twitter / X URL** | ❌ **NO** | ❌ None | ❌ None | Hardcoded in HTML |
| **Facebook URL** | ❌ **NO** | ❌ None | ❌ None | Hardcoded in HTML |
| **Telegram URL** | ❌ **NO** | ❌ None | ❌ None | Hardcoded in HTML & TSX |
| **Support Avatar** | ❌ **NO** | ❌ None | ❌ None | Hardcoded SVG assets |
| **USDT Wallet Address** | ✅ **YES** | ✅ `POST /api/settings/payment` | ✅ `settings` (`usdt_address`) | Editable in Admin UI (currently dummy value) |
| **USDT Network** | ⚠️ **PARTIAL** | ✅ Stored in DB | ✅ `settings` (`usdt_network`) | Input is `readonly` ("TRC20" only) |
| **Payment Instructions** | ❌ **NO** | ❌ None | ❌ None | Hardcoded in client templates |

---

## STEP 9 — PAYMENT SYSTEM ARCHITECTURE AUDIT

| Gateway / Mechanism | Implementation Status | Live Production Status | Webhook Receiver | Notes |
|---|---|---|---|---|
| **Stripe** | ❌ **NOT IMPLEMENTED** | Not configured | None | No SDK, no API keys, no checkout session logic |
| **Razorpay** | ❌ **NOT IMPLEMENTED** | Not configured | None | No SDK, no API keys, no order creation logic |
| **Simulation / Test Provider** | ⚠️ **MOCK ONLY** | Active in unit tests | None | `manual_upi` and `manual_usdt` mock tags used in tests |
| **Manual UPI** | ✅ **IMPLEMENTED** | Active (Static copy-paste) | None | Displays `upi_id` for manual copy; proof on WhatsApp |
| **Manual Crypto / USDT** | ✅ **IMPLEMENTED** | Active (Static copy-paste) | None | Displays `usdt_address` for manual copy; proof on WhatsApp |
| **Bank / Wire Transfer** | ❌ **NOT IMPLEMENTED** | None | None | Not offered |
| **Automated Invoicing** | ❌ **NOT IMPLEMENTED** | None | None | No invoice generator configured |
| **Operator Manual Activation** | ✅ **IMPLEMENTED** | **LIVE IN ADMIN PANEL** | N/A | Admin clicks "Activate", selects plan/duration/source |

---

## STEP 10 — EXISTING USDT IMPLEMENTATION REALITY

- **TRC20 Recognition:** The codebase exclusively assumes the TRC20 (Tron) network.
- **Current Hardcoded Fallback Address:** `TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9` (Found in `/opt/mahi-admin-panel/src/account-service.js:567` and database table `settings`).
- **Blockchain Connectivity:** Zero TronGrid, Etherscan, or RPC nodes are connected.
- **Transaction Hash (TXID) Handling:** There is no field or database column to store, validate, or record a transaction hash.
- **Confirmation Mechanism:** Strictly manual visual check of payment screenshot submitted by the user on WhatsApp.

---

## STEP 11 & 12 — USDT INTEGRATION READINESS & SAFETY DIRECTIVES

### Recommended Architecture for Production USDT:
Do **NOT** hardcode a wallet address into frontend HTML or JavaScript files.
The existing `/api/settings/payment` endpoint and `panel.db` `settings` table are already built to store payment data. However, the schema should be expanded to ensure safety:

```ini
USDT_ENABLED=true
USDT_PRIMARY_NETWORK=TRC20
USDT_TRC20_WALLET_ADDRESS="T..."
USDT_ERC20_WALLET_ADDRESS="0x..."   # Optional future
USDT_BEP20_WALLET_ADDRESS="0x..."   # Optional future
USDT_PRICE_USD=7
USDT_PAYMENT_EXPIRY_MINUTES=60
USDT_SUPPORT_EMAIL="billing@mahibrowser.com"
```

### Safety Rules:
1. **Explicit Network Warning:** Because sending USDT on the wrong network causes total loss of funds, any UI displaying the wallet address must feature a prominent high-contrast badge stating:
   `"Send ONLY USDT on TRC20 (Tron) network. Deposits from other networks will be permanently lost."`
2. **Single Source of Truth:** The desktop app and landing page must both fetch the active address from `/v1/account/payment-info` or `/api/public/content`, never from static files.
3. **No Automatic Address Mixing:** Never use the same input for TRC20 and ERC20/BEP20.

---

## STEP 13 — PAYMENT SUPPORT ESCALATION FLOW AUDIT

When a user in the live support chat reports a payment issue (e.g. "payment failed", "money deducted", "USDT sent but not activated"):
1. **Keyword Detection:** Regular expressions in [07_BACKEND/commercial/support-ticket-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/07_BACKEND/commercial/support-ticket-service.ts#L72) and [landing/assets/js/main.js](file:///c:/Users/munaf/Desktop/mahai%20brouser/landing/assets/js/main.js#L1962) correctly classify the query as category `PAYMENT`.
2. **Ticket Generation:** An immutable ticket reference is generated (e.g., `#ESC-2026-4358`).
3. **Database Recording:** The ticket is saved in the `support_tickets` table in `panel.db`.
4. **User Feedback:** The user immediately receives the reassurance message:
   *"Your payment-related query has been forwarded to our support team. We will review it shortly. Reference Ticket: #ESC-2026-XXXX"*
5. **Email Notification Dispatch:** The service attempts to dispatch an email alert to `support@mahibrowser.com`.
   - **Current Reality:** Because no email provider credentials exist in `/opt/mahi-admin-panel/.env`, the outbound dispatch fails quietly or logs to the console.

---

## STEP 14 — EMAIL DELIVERY INFRASTRUCTURE AUDIT

- **Configured Engine:** Resend REST API or Nodemailer SMTP ([05_AUTH/email-service.ts](file:///c:/Users/munaf/Desktop/mahai%20brouser/05_AUTH/email-service.ts#L477)).
- **Production Environment (`/opt/mahi-admin-panel/.env`):**
  - `RESEND_API_KEY`: **MISSING**
  - `SMTP_HOST`: **MISSING**
  - `SMTP_USER`: **MISSING**
  - `SMTP_PASS`: **MISSING**
  - `SUPPORT_EMAIL`: **MISSING**
- **Production Readiness:** ❌ **NOT PRODUCTION READY** (No real emails can be delivered).

---

## STEP 15 — DNS EMAIL RECORDS REALITY AUDIT

Live DNS resolution for `mahibrowser.com` via authoritative nameservers (`dns.google`, `nova.dns-parking.com`):

```
Record Type | Target Domain               | Result Status      | Raw DNS Query Output
-----------------------------------------------------------------------------------------
MX          | mahibrowser.com             | ❌ MISSING         | None (SOA record returned)
TXT (SPF)   | mahibrowser.com             | ❌ MISSING         | None (No v=spf1 record)
TXT (DKIM)  | resend._domainkey.mahibrowser.com | ❌ MISSING   | NXDOMAIN (Non-existent)
TXT (DMARC) | _dmarc.mahibrowser.com      | ❌ MISSING         | NXDOMAIN (Non-existent)
```

**Impact:**
- Any customer sending an email to `support@mahibrowser.com` receives an immediate failure bounce (`550 No MX record`).
- Any outbound email sent from `noreply@mahibrowser.com` will be classified as spam or rejected by Gmail, Outlook, and Yahoo due to missing SPF/DKIM/DMARC records.

---

## STEP 16 — LIVE SITE VISITOR REALITY (`https://mahibrowser.com`)

What an actual user currently encounters on the live website:
1. **Hero "WhatsApp Support" Button:** Points to `https://wa.me/` (Blank URL) or loads dummy number `+91 99999 99999`.
2. **Support Section Email:** Displays `mailto:support@mahibrowser.com` (Bounces if sent).
3. **Support Drawer Headset & Name:** Correctly shows "MAHI Browser Support" with modern headset icon.
4. **Support Drawer WhatsApp Icon:** Opens `https://wa.me/` (Blank URL).
5. **Support Drawer Topic Pills:** Smoothly scrollable with arrows; queries work via local fallback.
6. **Footer Social Icons:** Clicking LinkedIn, YouTube, Facebook, Instagram, or X navigates to the generic homepages of those services (`linkedin.com`, `x.com`, etc.).
7. **Footer Telegram Icon:** Clicking navigates to `https://t.me/` (Broken link).

---

## STEP 17 — INVENTORY OF STALE, DUMMY & PLACEHOLDER DATA

| Stale / Placeholder Item | Location in Code / Database | Recommended Action |
|---|---|---|
| `TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9` | `panel.db` (`settings`), `account-service.js` (L567) | Replace with real admin-managed USDT TRC20 wallet |
| `+91 99999 99999` | `landing/content.json` (L4) | Replace with real dedicated WhatsApp business number |
| `+919876543210` | `panel.db` (`settings`), `account-service.js` (L569) | Replace with real dedicated WhatsApp business number |
| `mahibrowser@upi` | `panel.db` (`settings`), `account-service.js` (L564) | Replace with verified business UPI ID or disable |
| `https://t.me/MunaBhai63` | `01_UI/components/Sidebar.tsx` (L183) | **REMOVE IMMEDIATELY** (Exposes personal contact) |
| `https://t.me/mahiskills` | `01_UI/components/Sidebar.tsx` (L172) | Replace with official `@mahibrowser` Telegram or remove |
| `https://t.me/` | `landing/index.html` (L1325), `landing/pricing.html` (L243) | Update to official channel (e.g. `https://t.me/mahibrowser_official`) or hide |
| Root social links (`linkedin.com`, `x.com`, etc.) | `landing/index.html` (L1315-1340), `landing/pricing.html` | Bind to real registered company pages or hide icons until created |
| `name@company.com` | `landing/index.html` (L1585) | Safe to leave as UI placeholder |

---

## STEP 18 — SECURITY & PRIVACY RISK ASSESSMENT

1. **Risk 1 (Financial Loss / Brand Damage):** The presence of dummy USDT address `TDjX7mKjW4o8U1u8R5a2b3c4d5e6f7g8h9` in the desktop app's PRO upgrade modal is a critical risk. If an active user copies this address and transfers funds, those funds are permanently burned.
2. **Risk 2 (Personal Privacy Exposure):** Exposing `https://t.me/MunaBhai63` directly in the distributed desktop application bypasses company boundaries and exposes personal account information to arbitrary users.
3. **Risk 3 (Customer Frustration / Bounced Communications):** Prominently advertising `support@mahibrowser.com` while lacking MX records prevents all customer contact and harms credibility.
4. **Risk 4 (Domain Spoofing):** Absence of SPF, DKIM, and DMARC leaves `mahibrowser.com` completely unprotected against phishing and spoofed sender abuse.

---

## STEP 19 — SOURCE OF TRUTH ARCHITECTURAL RECOMMENDATION

To eliminate fragmentation and hardcoded values, implement a unified **Business & Contact Config Schema** managed centrally from the admin panel and synchronized to all clients:

```json
{
  "business": {
    "name": "MAHI Browser LLC",
    "legal_entity": "MAHI Browser LLC",
    "established_year": 2026,
    "website": "https://mahibrowser.com"
  },
  "contacts": {
    "support_email": "support@mahibrowser.com",
    "billing_email": "billing@mahibrowser.com",
    "security_email": "security@mahibrowser.com",
    "abuse_email": "abuse@mahibrowser.com",
    "whatsapp_number": "+91XXXXXXXXXX",
    "whatsapp_display": "+91 XXXXX XXXXX",
    "phone_number": ""
  },
  "socials": {
    "telegram_channel": "https://t.me/mahibrowser",
    "telegram_support": "https://t.me/mahibrowser_support",
    "twitter": "https://x.com/mahibrowser",
    "linkedin": "https://linkedin.com/company/mahibrowser",
    "facebook": "",
    "youtube": "",
    "instagram": ""
  },
  "payments": {
    "upi_enabled": true,
    "upi_id": "realname@upi",
    "usdt_enabled": true,
    "usdt_network": "TRC20",
    "usdt_address": "T...",
    "price_inr": 599,
    "price_usdt": 7,
    "instructions": "Transfer exact amount and send screenshot/TXID to WhatsApp support."
  }
}
```

---

## STEP 20 — RECOMMENDED NEXT DEPLOYMENT ORDER

When the user is ready to proceed with implementation, execute in this strict five-phase order:

### Phase A: DNS Records & Mailbox Provisioning (Zero Code Changes)
1. Add MX records for `mahibrowser.com` pointing to the designated mail provider (Google Workspace, Zoho, Proton, or Hostinger Titan Mail).
2. Configure SPF (`v=spf1 ... ~all`), DKIM (`_domainkey`), and DMARC (`_dmarc.mahibrowser.com`) records.
3. Verify that inbound emails sent to `support@mahibrowser.com` and `billing@mahibrowser.com` are received successfully.

### Phase B: Centralized Admin Configuration & Persistence
1. Expand the admin panel `settings` table to store verified business contacts and social URLs.
2. Update `/api/settings/payment` and `/api/cms` so that saving in the Admin UI atomically updates `content.json` on the web server.

### Phase C: Landing Page Contact Synchronization
1. Update `landing/assets/js/main.js` to dynamically bind verified WhatsApp, email, and social URLs from the central config.
2. Fallback to hiding unconfigured social icons rather than displaying broken root domains.

### Phase D: Desktop App Cleanup & USDT Binding
1. Remove `https://t.me/MunaBhai63` from `01_UI/components/Sidebar.tsx` and bind to official support channels.
2. In `01_UI/components/AccountModal.tsx`, ensure `usdtAddress` and `upiId` only display when valid values are provided by `/v1/account/payment-info` (hide dummy defaults if unconfigured).

### Phase E: Live E2E Verification
1. Test inbound and outbound emails.
2. Verify WhatsApp links open the correct number with prefilled text.
3. Test copy button for verified USDT TRC20 address.
4. Verify all social buttons navigate to legitimate profiles.
