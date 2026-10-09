# MAHI BROWSER: WEBSITE CTA → AUTH → TRIAL / PLAN → DOWNLOAD ONBOARDING FLOW REPORT

**Version:** 1.1.1  
**Target:** Eliminate anonymous installer downloads from primary conversion CTAs and enforce an enterprise SaaS onboarding funnel (CTA → Auth → Trial/Plan → Download).  
**Status:** COMPLETE & FULLY VERIFIED  

---

## 1. Executive Summary

Previously, public landing page CTAs such as *Start 7-Day Trial*, *Sign Up*, *Pricing Card CTAs*, and *Book Demo* could directly trigger the local desktop binary installer download (`MAHI-Setup.exe`). This allowed anonymous visitors to download the application without establishing account identity, creating fragmented user experiences, bypassing trial entitlement activation, and risking license leakage.

### Implemented Solution Architecture:
```
Anonymous Visitor
   │
   ├─► Primary CTA ("Start Free 7-Day Trial") ──► /signup?intent=trial
   ├─► Plan CTA ("Professional 50") ───────────► /signup?plan=professional_50&billing=annual&intent=trial
   ├─► Enterprise CTA ("Book a Demo") ─────────► /book-demo (Lead Capture Form)
   └─► Download Navigation ─────────────────────► /download (Authenticated Download Portal)
         │
         ▼
Registration & Authentication (Google SSO or Email + Password)
   │
   ▼
Account Identity & Server-Side Entitlement Processing
   │  • Unified User ID created across Auth & Commercial DB
   │  • 7-Day Trial activated (trial_started_at, trial_expires_at)
   │  • Pending Plan & Billing Cycle intent preserved
   │
   ▼
Onboarding Dashboard & Authenticated Download Access (/download)
   │  • Validated session check (Token / Cookie / Authorization)
   │  • Shows official Windows x64 v1.1.1 installer with file size & release notes
   │  • Anonymous direct access to setup binaries redirected (302) to signup
   │
   ▼
Desktop MAHI Browser Continuity
      • User logs in with identical credentials
      • Unified entitlement syncs active trial / plan across Desktop, Web, and Mobile
```

---

## 2. Complete Website CTA Audit Table

All public entry points across `landing/index.html`, `landing/pricing.html`, `landing/terms.html`, `landing/privacy.html`, `landing/aup.html`, and `landing/assets/js/main.js` have been audited and updated:

| Location | CTA Label / Element | Current Action (Prior) | Target Action | Final Route | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Landing Header** | "Sign In" | `#` / modal | Authenticate existing user | `/login` | **PASS** |
| **Landing Header** | "Start Free 7-Day Trial" | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Landing Header Mobile** | "Start 7-Day Free Trial" | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Landing Hero** | "Start Free 7-Day Trial" (Primary) | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Landing Hero** | "Book a Demo" (Secondary) | Direct download `MAHI-Setup.exe` | Lead capture form (No binary download) | `/book-demo` | **PASS** |
| **Landing Hero** | "Windows x64 (.exe)" OS Badge | Direct download `MAHI-Setup.exe` | Authenticated download portal | `/download` | **PASS** |
| **Landing Features** | "Start 7-Day Free Trial" | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Landing Banner** | "Start Free 7-Day Trial" | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Landing Footer** | "Windows x64 (.exe)" | Direct download `MAHI-Setup.exe` | Authenticated download portal | `/download` | **PASS** |
| **Pricing Header** | "Sign In" | `#` / modal | Authenticate existing user | `/login` | **PASS** |
| **Pricing Header** | "Start Free 7-Day Trial" | Direct download `MAHI-Setup.exe` | Route to registration with trial intent | `/signup?intent=trial` | **PASS** |
| **Pricing Cards** | Free Plan: "Get Started" | Direct download `MAHI-Setup.exe` | Route to registration with free intent | `/signup?intent=free` | **PASS** |
| **Pricing Cards** | Pro 10: "Start 7-Day Trial" | Direct download `MAHI-Setup.exe` | Registration preserving Pro 10 + billing cycle | `/signup?plan=pro_10&billing=monthly&intent=trial` | **PASS** |
| **Pricing Cards** | Pro 25: "Start 7-Day Trial" | Direct download `MAHI-Setup.exe` | Registration preserving Pro 25 + billing cycle | `/signup?plan=pro_25&billing=monthly&intent=trial` | **PASS** |
| **Pricing Cards** | Pro 50: "Start 7-Day Trial" | Direct download `MAHI-Setup.exe` | Registration preserving Pro 50 + billing cycle | `/signup?plan=professional_50&billing=monthly&intent=trial` | **PASS** |
| **Pricing Cards** | Pro 100: "Start 7-Day Trial" | Direct download `MAHI-Setup.exe` | Registration preserving Pro 100 + billing cycle | `/signup?plan=professional_100&billing=monthly&intent=trial` | **PASS** |
| **Pricing Cards** | Custom / Enterprise: "Contact Sales" | Direct download `MAHI-Setup.exe` | Enterprise lead capture form | `/book-demo` | **PASS** |
| **Pricing Bottom Bar** | "Get Started Free" | Direct download `MAHI-Setup.exe` | Route to registration with free intent | `/signup?intent=free` | **PASS** |
| **Pricing Footer** | "Windows x64 (.exe)" | Direct download `MAHI-Setup.exe` | Authenticated download portal | `/download` | **PASS** |
| **Legal Pages** | Terms, Privacy, AUP Nav Download | Direct download `MAHI-Setup.exe` | Authenticated download portal | `/download` | **PASS** |
| **Direct Binary URLs** | `/download/setup`, `/download/portable`, `/download/MAHI-Setup.exe` | Unrestricted anonymous binary download | Authenticate first (302 redirect for unauth browser) | 302 -> `/signup?intent=trial&returnUrl=/download` | **PASS** |

---

## 3. Database & Backend Implementation Details

### Database Schema (Migration v20)
1. **`demo_requests` table:**
   - Fields: `id`, `full_name`, `email`, `company_name`, `team_size`, `use_case`, `contact_method`, `preferred_datetime`, `message`, `status` (`NEW`, `CONTACTED`, `SCHEDULED`, `COMPLETED`, `CLOSED`), `admin_notes`, `created_at`, `updated_at`.
2. **`funnel_events` table:**
   - Privacy-safe telemetry capturing: `trial_cta_clicked`, `signup_started`, `signup_completed`, `email_verified`, `trial_activated`, `checkout_started`, `payment_completed`, `download_started`, `desktop_first_login`.
   - Never logs passwords, credit cards, or user browsing activity.
3. **Additive User Columns (`auth_users` & `commercial_users`):**
   - `trial_started_at`, `trial_expires_at`, `trial_used` (boolean abuse prevention), `signup_intent`, `pending_plan_id`, `pending_billing_cycle`.

### Service & API Architecture
1. **Demo Service (`07_BACKEND/commercial/demo-service.ts`):**
   - Implements lead submission, retrieval, and status updates for sales administration.
2. **Funnel Service (`07_BACKEND/commercial/funnel-service.ts`):**
   - Records funnel events and calculates conversion analytics (`landingCtaClicks`, `signupRate`, `downloadRate`, `overallConversionRate`).
3. **Commercial Auth Service (`07_BACKEND/commercial/commercial-auth-service.ts`):**
   - `registerUser` now supports `explicitId`, ensuring that the `central-auth-service` and `commercial-user-service` share the identical `userId` across the entire system.
   - Persists `pending_plan_id`, `pending_billing_cycle`, and `signup_intent` upon account creation.
4. **Commercial Entitlement Service (`07_BACKEND/commercial/commercial-entitlement-service.ts`):**
   - `activateUserTrial`: Grants 7-day trial entitlement with 50 profiles and advanced capabilities.
   - `evaluateUserEntitlements`: Evaluates expiry against `Date.now()`. When expired, seamlessly falls back to Free plan (15 profiles) while strictly preserving all existing user profiles and data.
5. **Commercial API Router (`07_BACKEND/commercial/commercial-api-router.ts`):**
   - `POST /api/v1/auth/register`: 409 Conflict handling for duplicate emails; unified accounts.
   - `POST /api/v1/auth/login`: Authentication returning unified trial/plan state.
   - `POST /api/v1/auth/google`: Google OAuth SSO flow preserving intent and return URLs.
   - `POST /api/v1/auth/trial/activate`: Real server-side trial activation endpoint.
   - `GET /api/v1/auth/trial/status`: Real server-side trial entitlement status.
   - `POST /api/v1/commercial/demo-request`: Public lead submission endpoint.
   - `GET /api/v1/commercial/admin/demo-requests`: Admin leads view.
   - `PUT /api/v1/commercial/admin/demo-requests/:id/status`: Admin lead status workflow.
   - `POST /api/v1/funnel/track` & `GET /api/v1/commercial/admin/funnel-metrics`: Privacy-safe conversion telemetry.
6. **Download Gate (`07_BACKEND/server/app.ts`):**
   - Authenticated check for direct binary requests (`/download/setup`, `/download/portable`, `/download/MAHI-Setup.exe`).
   - Anonymous browser requests are redirected to `/signup?intent=trial&returnUrl=/download`.
7. **Admin Console (`07_BACKEND/server/web-admin-html.ts`):**
   - Integrated "Demo Leads" table with status action dropdowns.
   - Integrated "Funnel Telemetry" conversion card showing visitor-to-paid metrics.

---

## 4. Frontend SaaS Experience

1. **Signup Page (`landing/signup.html`):**
   - Clean, centered card layout in MAHI Browser dark theme.
   - Official non-draggable brand lock (`assets/img/logo.png?v=2.5.0`).
   - Dynamic Intent Badge displaying target plan/trial context (e.g., "Activating 7-Day Free Trial (50 Profiles)").
   - Dual authentication options: Continue with Google and Email + Password with confirmation validation.
   - Query parameters preserved and forwarded to API.
2. **Login Page (`landing/login.html`):**
   - Consistent brand card layout.
   - Google SSO and Email credentials.
   - Preserves `returnUrl`, `plan`, and `intent` query parameters across authentication.
3. **Book Demo Page (`landing/book-demo.html`):**
   - Enterprise lead form requesting: Full Name, Business Email, Company/Team Name, Team Size, Primary Use Case, Preferred Contact Method, Preferred Date/Time, and Message.
   - Submits to `/api/v1/commercial/demo-request` and renders an instant confirmation screen with a unique tracking Reference ID.
4. **Authenticated Download Portal (`landing/download.html`):**
   - Modern software download hub displaying:
     - Platform: Windows x64 (Executable Installer)
     - Current Version: v1.1.1 (Stable Release)
     - Approximate Size: ~85 MB
     - Release Notes & Installation Instructions (3-step guide: Install, Launch, Login)
   - Dynamic user badge displaying current plan / trial days remaining.
   - Anonymous gate prompting visitors to sign up or log in before downloading.

---

## 5. Verification of Acceptance Tests

All 6 acceptance tests specified in the requirements were executed via automated integration suite `11_TESTS/integration/phase18-cta-auth-onboarding.test.ts`:

- **TEST 1: Anonymous -> Start 7-Day Trial -> Signup -> Account Creation -> Trial Activation -> Dashboard/Download -> Installer**  
  *Result: PASS.* Anonymous visitors are routed to `/signup?intent=trial`. Account creation registers unified user, activates real 7-day trial (`isTrialActive = true`, expires in 7 days), and unlocks download access. No installer binary is served anonymously.
- **TEST 2: Anonymous -> Professional 50 -> Signup -> Intent Preserved -> Selected Plan Maintained**  
  *Result: PASS.* Visiting `/signup?plan=professional_50&billing=annual&intent=trial` preserves `pending_plan_id: "professional_50"` and `pending_billing_cycle: "annual"` on the user record through account creation.
- **TEST 3: Existing Logged-in User -> Plan CTA -> No Duplicate Signup**  
  *Result: PASS.* Authenticated users visiting `/signup` or clicking plan CTAs are immediately directed to dashboard/checkout without being forced to re-register.
- **TEST 4: Book Demo -> Demo Form -> Submission -> Admin Receives Lead -> No Installer Download**  
  *Result: PASS.* Lead submitted via `/book-demo` creates record in `demo_requests` table with status `NEW`. Admin retrieves lead and can update status to `CONTACTED`. Zero software binary is downloaded.
- **TEST 5: Anonymous Download -> Auth Gate -> Download Page**  
  *Result: PASS.* Anonymous direct GET requests to `/download/setup` or `/download/MAHI-Setup.exe` receive HTTP 302 redirecting to `/signup?intent=trial&returnUrl=/download`. Authenticated requests succeed with HTTP 200.
- **TEST 6: Desktop Login After Website Signup -> Same Entitlement Appears Automatically**  
  *Result: PASS.* Account created via website signs in to desktop/API with identical credentials and immediately retrieves active trial entitlement (50 profiles, cloud sync, anti-detect capabilities).

---

## 6. Test Suite and Build Summary

- **Total Test Suites:** 39 passed out of 39 files
- **Baseline Tests:** 808 / 808 PASS
- **New Tests (Phase 18):** 8 / 8 PASS
- **Total Tests:** 816 / 816 PASS
- **Typecheck:** Clean (0 errors across `tsconfig.json` & `tsconfig.electron.json`)
- **Vite & Electron Build:** SUCCESS (Production bundles and sanitized outputs built with exit code 0)
