# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 02: Target User Journey — GoLogin Workflow Parity

**Date:** October 14, 2026  
**Status:** Implemented & Verified in Workspace

---

### 1. The Target Streamlined User Journey

The friction-free GoLogin-style user flow implemented in MAHI Browser:

```
[ Visitor arrives at mahibrowser.com ]
                ↓
[ Clicks "Download for Windows" ]
   - No registration gate
   - Direct binary download: MAHI-Browser-Setup-1.1.2.exe
                ↓
[ Installs MAHI Browser ]
   - Standard NSIS silent/assisted installer
   - Creates Desktop & Start Menu shortcuts
                ↓
[ Launches MAHI Browser ]
   - Electron app loads UI immediately
   - If no active session, presents sleek in-app Welcome / Login Modal
                ↓
[ Signs Up or Signs In Inside App ]
   - Choice A: One-click "Sign In with Google" (PKCE loopback, tab closes immediately, desktop gains session)
   - Choice B: "Sign In with Email & Password" / "Create Account" tab
                ↓
[ Enters Profiles Dashboard ]
   - Session stored securely in local app state & encrypted vault
   - `rememberMe` defaults to TRUE — persistent across restarts
   - Profile limits and plan entitlements synced from server
                ↓
[ Creates & Launches Isolated Browser Profile ]
   - Quick Profile Creation succeeds instantly (Preload bridge verified)
   - Real anti-detect Chromium launches with custom fingerprint & proxy
```

---

### 2. Key Architecture Comparison

| Step | Previous Broken Flow | New Target Flow (GoLogin Parity) |
| :--- | :--- | :--- |
| **Download** | Required signup, trial activation, and dashboard redirect | 1-Click direct public download on landing page |
| **Onboarding** | In-app login redirect bounced user to web download page | In-app modal with direct desktop loopback callback |
| **Session Persistence** | User forgotten on app relaunch (cleared `currentUser`) | Session persisted in encrypted storage and Zustand rehydration |
| **Profile Creation** | Failed with `401 Unauthorized` due to preload syntax bug | Preload bridge exposes `window.mahiAPI.profiles.create` cleanly |
| **Chromium Launch** | Blocked by missing profile | Launches anti-detect Chromium with custom PID & isolation |

---

### 3. User Experience Guarantees

1. **Zero Friction Before Download:** Users evaluate software after installing, not by filling forms beforehand.
2. **Desktop-First Account Handling:** Users do not need to switch back and forth between browser tabs and desktop windows.
3. **Seamless Identity Sync:** Free tier includes 3 active profiles out of the box, with instant upgrade paths via license keys or web checkout.
