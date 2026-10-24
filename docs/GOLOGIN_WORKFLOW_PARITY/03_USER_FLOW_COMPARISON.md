# 03. USER FLOW COMPARISON
## Side-by-Side Analysis: GoLogin vs. Current MAHI Browser vs. Target Parity

- **Date:** October 13, 2026
- **Scope:** Complete Customer Archetype Lifecycle
- **Target Parity Benchmark:** GoLogin UX Model

---

## 1. Customer Archetype Lifecycle Matrix

| Customer Archetype | Reference GoLogin Experience | Current MAHI Browser (Pre-Fix) | Target MAHI Browser (Parity State) |
|---|---|---|---|
| **1. New Customer** | 1. Sign up on web (Google or Email)<br>2. Granted 7-day trial<br>3. Download app<br>4. Install & open<br>5. Sign in (external browser seamless handoff)<br>6. Lands directly on Profiles Dashboard | 1. Sign up on web<br>2. Granted 7-day trial<br>3. Download app<br>4. Open app<br>5. Click "Continue with Google"<br>6. **Loop:** Redirected back to `/download` web page; app prompts to manually paste token<br>7. Stuck | 1. Sign up on web<br>2. Granted 7-day trial<br>3. Download app<br>4. Open app<br>5. Click "Continue with Google"<br>6. Browser completes auth & signals app<br>7. **Lands directly on Profiles Dashboard with 7-day trial** |
| **2. Existing Website Customer** | Opens desktop app, signs in with existing email/Google. Automatically restores existing trial days and profiles. Zero duplicate account created. | Opens desktop app, signs in with Google. Browser loops to `/download`. If token manually pasted, existing account is preserved. | Opens desktop app, signs in with Google or Email. Instant seamless handoff. Exact remaining trial days recognized. Zero duplicate account. |
| **3. Returning Desktop Customer** | Opens app. Stored encrypted session restores instantaneously. Bypasses login screen completely. Renders Profiles Dashboard. | Stored encrypted session in `account-session.enc` restores. Opens directly to Profiles Dashboard. (*Functioning correctly*) | Stored encrypted session in `account-session.enc` restores. Opens directly to Profiles Dashboard. (*Preserved intact*) |
| **4. Existing PRO Customer** | Signs in. PRO entitlements retrieved from server. Unlimited profiles and team sharing unlocked. | Signs in. If using password, PRO status retrieved. If using Google, looped to download page. | Signs in via Google or password seamlessly. PRO entitlement loaded immediately. All features unlocked. |
| **5. Logged-Out Customer** | Clear "Sign In" / "Create Account" screen. No misleading phantom logged-in badges or fake profiles shown. | Shows "Not signed in" / "MAHI BROWSER" in header. Account modal offers login. (*Functioning correctly*) | Shows "Not signed in" / "MAHI BROWSER" in header. Clear login options. Zero phantom login. |
| **6. Account Switching** | Click user avatar &rarr; Log Out &rarr; Cleanly switch account &rarr; New account identity and plan rendered. | Logout clears `account-session.enc` and resets store. Can log in as new user. (*Functioning correctly*) | Logout cleanses all state. Seamless re-login instantly updates identity, email, and plan. |

---

## 2. In-Depth Step-by-Step Flow Breakdown

### Flow 1: New Customer Journey (Target Parity)
```
[Marketing Web: mahibrowser.com]
      │
      ├─► User clicks "Start 7-Day Free Trial" or "Continue with Google"
      ├─► Canonical account created in SQLite (commercial_users & auth_users)
      ├─► 7-day trial subscription record generated (starts_at: NOW, expires_at: NOW + 7d)
      │
[Download & Installation]
      │
      ├─► User downloads MAHI-Browser-Setup-1.1.1.exe
      ├─► Installs into %LOCALAPPDATA%\Programs\MAHI BROWSER
      └─► Launches MAHI Browser Desktop
      │
[Desktop First-Time Authentication]
      │
      ├─► AccountModal appears (Tabs: Sign In / Sign Up)
      ├─► User clicks "Continue with Google"
      ├─► Desktop app opens system browser:
      │   https://admin.mahibrowser.com/api/v1/auth/google/start?intent=desktop_login&handoff=<TICKET>
      ├─► Google OAuth consent completed on accounts.google.com
      ├─► Backend validates code and claims
      ├─► Backend redirects browser to:
      │   https://admin.mahibrowser.com/auth/desktop-success?token=<JWT>&handoff=<TICKET>
      ├─► Completion page executes dual-channel handoff:
      │   Channel A: mahi://auth?token=<JWT> (OS Protocol Deep Link)
      │   Channel B: http://127.0.0.1:32123/api/v1/auth/desktop-handoff?token=<JWT> (Loopback)
      │   Channel C: Desktop app polling on /api/v1/auth/desktop-status?ticket=<TICKET>
      │
[Immediate Dashboard Arrival]
      │
      ├─► Desktop app receives token in < 1.5 seconds
      ├─► Saves encrypted session to account-session.enc
      ├─► Closes AccountModal
      ├─► AccountDropdown displays: user@example.com [TRIAL]
      └─► Profiles Dashboard displayed with Starter Profiles ready to run!
```

---

## 3. Key Differences: GoLogin vs Pre-Fix MAHI vs Target MAHI

1. **The External Browser Landing Page:**
   - *Pre-Fix MAHI:* Landed on `https://mahibrowser.com/dashboard` which was an alias for `landing/download.html`. Result: User was told "Account Required to Download" while already inside the downloaded app!
   - *GoLogin & Target MAHI:* Lands on a dedicated, elegant success page (`/auth/desktop-success`) that confirms authentication and notifies the user to return to the desktop application.
2. **Token Transmission:**
   - *Pre-Fix MAHI:* Required manual copy and paste of a raw JWT string into a text field.
   - *GoLogin & Target MAHI:* Completely automated via deep linking and local loopback. Zero copy-pasting required.
3. **Trial Integrity:**
   - *Target MAHI:* Guarantees that whether authenticated on web or desktop, the trial expiration date is identical. Zero double-trials.
