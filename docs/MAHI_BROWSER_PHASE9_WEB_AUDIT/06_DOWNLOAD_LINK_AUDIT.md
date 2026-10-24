# MAHI BROWSER — PHASE 9 MASTER AUDIT
## 06. DOWNLOAD BUTTON & INSTALLER ARTIFACT AUDIT
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Release Target:** MAHI Browser v1.1.1 RC1  
**Verification Method:** Network Trace, Redirect Following, HTTP Binary Probes  

---

### 1. Download Link Flow & Authentication Gate

In both local source and production, the primary download button on `download.html` executes client-side JavaScript:
```javascript
function triggerDownload(type) {
  const downloadUrl = type === 'portable' 
    ? `/download/portable?token=${encodeURIComponent(token || '')}`
    : `/download/setup?token=${encodeURIComponent(token || '')}`;
  window.location.href = downloadUrl;
}
```

#### Step-by-Step Execution on Production:

1. **Anonymous Visitor (No Token):**
   - User navigates to `https://mahibrowser.com/download`.
   - The auth gate is displayed: *"Sign up for free 7-day trial or log in to download"*.
   - Direct navigation to `https://mahibrowser.com/download/setup` returns HTTP 302:
     `Location: https://mahibrowser.com/signup?intent=trial&returnUrl=/download`
   - **Behavior:** Working as designed (Intended conversion funnel gate).

2. **Authenticated Visitor (Token Provided):**
   - User signs up or passes `token` via cookie/header.
   - The client invokes: `GET https://mahibrowser.com/download/setup?token=...`
   - Production Nginx/Backend response: **HTTP 404 Not Found** (`<html><center>404 Not Found</center><hr><center>nginx</center></html>`).
   - **Finding:** **P1 RELEASE BLOCKER**. The actual executable installer is missing from the production server file system.

---

### 2. Artifact Comparison: Local vs Live

| Attribute | Local Verified Build | Live Website Representation | Production Server Artifact |
|---|---|---|---|
| Product Version | **v1.1.1 RC1** | Claims `v1.1.1 (Stable)` | None (Returns 404) |
| Binary File Name | `MAHI-Browser-Setup-1.1.1.exe` | `MAHI-Setup.exe` | Missing |
| Physical File Size | **282,143,896 bytes (269.07 MB)** | Displays `78.4 MB` | Missing |
| Bundled Engine | Bundled Chromium 138.0.7204.0 | Not specified on live | Missing |
| SHA-256 Checksum | `562f70075f6b5ed7b8bbf2ff270d7ff36ae45a53559c020c39429784ec62621f` | Displays generic `Verified Build` | N/A |
| Digital Signature | Self-signed / Test Certificate | Displays `SmartScreen Safe` | N/A |

---

### 3. Release Blocker Summary
1. The live website download link triggers a 404 error for authenticated users trying to download the installer.
2. The live download page displays an obsolete package size (78.4 MB instead of 282 MB).
3. The live download page does not include the creator attribution badge (*"Created by Munna Bhai"*).
4. **Safety Constraint:** In strict compliance with user instructions, no installer was uploaded or published during this audit.
