# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 01: Forensic Audit of the Current User Journey

**Date:** October 14, 2026  
**Reference:** GoLogin Baseline Workflow Comparison

---

### 1. The Friction in the Previous Flow

Prior to this restructure, a user visiting `https://mahibrowser.com` experienced excessive friction:
```
Google Search
   ↓
mahibrowser.com
   ↓
Click "Download"
   ↓
Gate: Redirected to /auth/login or /auth/signup (Mandatory Account Creation BEFORE Download)
   ↓
Activate Trial on Website / Dashboard Redirection
   ↓
Customer Dashboard (/dashboard)
   ↓
Download Link / Client Setup Route
   ↓
Download Windows Installer (Setup.exe)
   ↓
Install MAHI Browser
   ↓
Launch Desktop Application
   ↓
App Opens -> User must authenticate AGAIN
   ↓
OAuth Google Redirect to Browser -> Lands on Web Download Page (Redirect Loop)
   ↓
Session token confusion / Token missing
   ↓
User attempts Quick Create Profile
   ↓
ERROR TOAST: "Creation Failed — Unauthorized. Invalid or missing authentication credentials."
```

### 2. Root Friction Points Identified

1. **Pre-Download Registration Gate:** Requiring a visitor to sign up and configure a trial on the website before getting the installer caused immediate drop-off.
2. **Download Page Redirection Loop:** Google OAuth handoff returned users to the download page instead of closing the browser tab and returning focus directly to the desktop application.
3. **Session Rehydration Amnesia:** On desktop restart, `useAccountStore` wiped `currentUser` unless `rememberMe` had been explicitly toggled, forcing repeated logins.
4. **Preload Syntax Failure (The P1 Bug):** A syntax error in `preload.cjs` prevented Electron from exposing `window.mahiAPI`. The app fell back to `api-fallback.ts`, which sent an unauthenticated request to the local daemon, failing with `401 Unauthorized`.
