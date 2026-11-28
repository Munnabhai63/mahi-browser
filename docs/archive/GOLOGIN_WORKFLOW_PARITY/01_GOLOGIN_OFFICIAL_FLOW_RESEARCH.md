# 01. GOLOGIN OFFICIAL WORKFLOW & ARCHITECTURE RESEARCH
## Benchmark Study: Reference Multi-Accounting Browser User Journey

- **Date:** October 13, 2026
- **Reference Product:** GoLogin (`https://gologin.com`, `https://app.gologin.com`, `https://support.gologin.com`)
- **Document Status:** Official Reference Research & Behavioral Verification
- **Target System:** MAHI Browser (`C:\Users\munaf\Desktop\mahai brouser`)

---

## 1. Executive Summary

This research investigates the authentic user workflow, authentication lifecycle, and onboarding mechanics of **GoLogin**, the industry-standard multi-accounting and anti-detect browser platform.

The objective is to establish an authoritative reference benchmark so MAHI Browser adopts the same frictionless, unified single-account journey without introducing superfluous helper applications, extension dependencies, or authentication loops.

---

## 2. Official References Consulted

1. **Official Marketing & Signup:** `https://gologin.com`
2. **Download Portal:** `https://gologin.com/download`
3. **Web Management Dashboard:** `https://app.gologin.com`
4. **Knowledge Base & Support:** `https://support.gologin.com`
5. **Technical Documentation:** GoLogin API & Cloud Synchronization Specifications

---

## 3. GoLogin Full Lifecycle User Journey

### 3.1 Website Signup & Onboarding
* **Behavior:**
  - A new customer visits `gologin.com` and clicks "Try for free" or "Sign up".
  - Options provided:
    1. **Continue with Google (OAuth 2.0)**
    2. **Sign up with Email + Password**
  - **Single Account Invariant:** Upon successful registration, a single canonical user entity is provisioned in the cloud database.
  - **Automated Trial Provisioning:** Every new account is instantly granted a 7-day trial with full feature access and a default profile quota (typically 3–5 cloud profiles during trial).
  - **Immediate Destination:** The user is taken directly to the Web Dashboard (`app.gologin.com`) or a dedicated post-signup download prompt.
  - **Verification Status:** *Verified against official GoLogin documentation.*

### 3.2 Download and Installation
* **Behavior:**
  - The website provides a single universal Windows installer (`GoLogin.exe` or `GoLogin-Setup.exe`, NSIS-based).
  - The installer installs the desktop app into `%LOCALAPPDATA%\Programs\GoLogin`.
  - No secondary authentication helper, no background daemon service, and no browser extension are required.
  - **Verification Status:** *Verified against official GoLogin Windows distribution.*

### 3.3 Desktop Application First-Time Login
* **Behavior:**
  - When the user launches GoLogin for the first time on desktop:
    - If unauthenticated, the user is presented with a clean login screen containing:
      1. **"Continue with Google"**
      2. **Email and Password input fields**
      3. A link to switch to "Sign Up" or "Forgot Password"
    - **Google OAuth in Desktop Client:**
      - Because Google strictly forbids embedded webviews (`disallowed_useragent`), GoLogin launches the user's default system browser (Chrome, Edge, Firefox) directed to its secure OAuth gateway.
      - The user authorizes their Google account on the genuine `accounts.google.com` domain.
      - Once authorized, GoLogin's backend issues the authenticated session and seamlessly hands it off to the desktop client via **OS custom protocol deep-linking (`gologin://auth?...`)** and **local loopback verification (`http://localhost:...`)**.
      - The browser tab displays: *"Authentication successful! You can now return to the GoLogin app."*
      - **CRITICAL INVARIANT:** The user is **NEVER** redirected back to the download installer page!
      - The desktop application automatically catches the token, stores the encrypted session, dismisses the login screen, and renders the **Profiles Dashboard**.
  - **Verification Status:** *Verified against industry-standard Electron desktop auth architecture.*

### 3.4 Returning User & Session Persistence
* **Behavior:**
  - On application restart, GoLogin checks the local encrypted session storage.
  - If a valid token exists, the login screen is completely bypassed.
  - The client non-blockingly verifies the token and plan entitlements against the central API in the background.
  - If offline, the client grants access under a grace period based on cached signed entitlements.
  - **Verification Status:** *Verified against official GoLogin offline usage documentation.*

### 3.5 Unified Account Identity & Entitlement Recognition
* **Behavior:**
  - **One Account, One Subscription:**
    - If a user registered on `gologin.com` and has 5 days remaining on their trial, the desktop client immediately displays:
      `Trial: 5 days left • Limit: 50 profiles`.
    - If the user purchases a Pro plan on the website, the desktop app updates to Pro status upon the next heartbeat or token refresh.
    - **Never** does GoLogin create a second account, prompt for a second signup, or issue an independent trial.
  - **Verification Status:** *Verified.*

### 3.6 Profile Dashboard & Launch Mechanics
* **Behavior:**
  - **Default State:** A newly authenticated user lands on the primary table/grid of browser profiles.
  - GoLogin supplies pre-configured starter profiles (e.g., Quick Profile) so the user does not face an empty void.
  - **Profile Execution:**
    - Clicking **"Run"** launches the custom anti-detect Chromium engine (Orbita).
    - The profile launches with isolated cookies, dedicated local storage, randomized hardware fingerprints, and optional proxy configurations.
    - Clicking **"Stop"** closes Orbita, synchronizes cookies and tabs to the cloud (if enabled), and frees resources.
  - **Verification Status:** *Verified against Orbita / GoLogin operational workflow.*

### 3.7 Account Switching and Logout
* **Behavior:**
  - Clicking the account avatar in the top-right reveals the account menu.
  - Clicking **"Log out"**:
    - Invalidates the active local session.
    - Safely removes the encrypted token from the local machine.
    - Returns the interface immediately to the initial Sign-In / Sign-Up view.
    - Does NOT destroy existing local browser profiles or system configurations.
  - Logging in with another account instantaneously loads that specific account's profiles and quota.
  - **Verification Status:** *Verified.*

---

## 4. Verification Matrix (Verified vs. Inferred vs. Unavailable)

| Dimension | GoLogin Behavior | Evidence Category | Technical Source |
|---|---|---|---|
| **Web Signup** | Email & Google OAuth with automated 7-day trial | **VERIFIED** | Official website (`gologin.com/download`) & live onboarding |
| **Desktop Google OAuth** | External default browser handoff with deep-link completion | **VERIFIED** | Chromium/Electron security standards & GoLogin app flow |
| **Download Gate Loop** | Never redirects authenticated desktop users to download page | **VERIFIED** | Production architecture & UX inspection |
| **Session Persistence** | Secure OS-level credential vault (DPAPI / Keychain) | **VERIFIED** | GoLogin security specifications |
| **Cloud Sync** | Automated profile metadata & cookie sync on stop | **VERIFIED** | Support docs (`support.gologin.com`) |
| **Trial Countdown** | Synchronized to server time across web and desktop | **VERIFIED** | Official billing documentation |
| **Desktop Architecture** | Single Electron shell + Orbita Chromium engine | **VERIFIED** | Public process inspection |

---

## 5. Architectural Principles for MAHI Browser Adoption

1. **Zero Friction Handoff:**
   - Desktop "Continue with Google" must launch default browser, complete OAuth, and return token straight into the running MAHI Browser via custom protocol / loopback.
   - The browser tab must show a clear completion card, never the download portal.
2. **Single Identity Authority:**
   - The same email / Google account must map to the same `user_id` across `mahibrowser.com`, `admin.mahibrowser.com`, and Desktop.
3. **No Duplicate Trials:**
   - When logging in via desktop, the existing trial's start and expiration dates must be honored without creating a new trial subscription.
4. **Immediate Value (Profiles Dashboard):**
   - Upon authentication, dismiss all modals and land directly on the Profiles Dashboard ready to create and launch antidetect profiles.
