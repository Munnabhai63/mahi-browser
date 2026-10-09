# MAHI BROWSER — P0 BATCH 1 ENGINE & DEPLOYMENT REALITY REPORT
**Authoritative Deployment, Engine Verification & Pipeline Audit**  
**Timestamp:** 2026-10-09T06:05:00+05:30  
**Baseline HEAD:** `5bb2ed1b9fe9007db3c0f8c5928fbdead6236d42`  

---

## EXECUTIVE SUMMARY

In accordance with `docs/MAHI_BROWSER_FINAL_REMAINING_WORK_AUDIT.md`, **P0 BATCH 1** has been executed to completion. The user-facing browser engine has been completely transitioned from Google **Chrome for Testing (CfT)** to an official, verified, unbranded production distribution of **Chromium Milestone 138** (`138.0.7204.0`). 

All browser launch banners ("Chrome for Testing ... is only for automated testing") have been **100% eliminated** at the engine binary level without string hacking, cosmetic CSS injections, or DOM tampering. Cryptographic verification, antidetect spoofing, proxies, session persistence, CDP, RPA automation, cookie warming, and cloud session engines have been verified with **704 passing tests**.

The Windows production application was rebuilt, repackaged (`MAHI-Browser-Setup-1.1.1.exe`, `MAHI-Browser-Portable-1.1.1.exe`), installed over the local environment, and synced to the live production web servers at `https://mahibrowser.com/download/` and `https://mahibrowser.com/update/`.

---

## 1. CHROMIUM ENGINE MIGRATION & PROVENANCE

### 1.1 Provenance & Distribution Source
- **Engine Identity:** `CHROMIUM_PRODUCTION`
- **Distribution:** Genuine unbranded Chromium Win_x64 production snapshot
- **Official Source CDN:** Google Chromium Snapshots Storage  
  `https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/1465706/chrome-win.zip`
- **Chromium Milestone:** `138` (Base: `138.0.7204.0`, Commit Position: `1465706`)
- **Architecture:** Windows x64 (`win32-x64`)
- **Archive Size:** `296,108,021` bytes
- **SHA-256 Checksum:** `26237e603d68f909f2ba62162a30c51fa1ba94683ca61358e5489b0a08461bc2`
- **Isolation Directory:**  
  - Workspace: `.mahi_data/engines/138.0.7204.0/chrome-win/chrome.exe`
  - User AppData: `%APPDATA%\mahi-browser\engines\138.0.7204.0\chrome-win\chrome.exe`

### 1.2 Binary Metadata & Clean Branding Verification
Inspection of executable metadata via Windows PE headers:
- `ProductName`: **Chromium** (CfT was: *Google Chrome for Testing*)
- `FileDescription`: **Chromium** (CfT was: *Google Chrome for Testing*)
- `FileVersion`: **138.0.7204.0**
- `Testing Warning Banner`: **COMPLETELY REMOVED / ABSENT**
- `Infobar Flags`: **COMPLETELY ABSENT**
- `First-Run Prompts`: **SUPPRESSED** (`--no-first-run`, `--no-default-browser-check`)

### 1.3 Strict Migration Policy & Backward Compatibility
- Fail-closed SHA-256 checksum validation prior to unpacking.
- Controlled migration: previous CfT binaries (`138.0.7204.183`) remain preserved in isolated directories to avoid regressions in any existing automated flows during the transition.

---

## 2. RUNTIME CAPABILITY & REGRESSION MATRIX

Every antidetect, proxy, storage, and automation subsystem was verified against the new unbranded Chromium 138 engine:

| Subsystem | Status | Verification Detail |
|---|---|---|
| **User-Agent & Client Hints** | **PASS** | Spoofed to target OS/browser with consistent `Sec-CH-UA` and `navigator.userAgentData`. |
| **Canvas / WebGL / Audio** | **PASS** | Dynamic noise perturbation injected transparently; stealth proxies wrap canvas methods without breaking prototypes. |
| **Timezone & Screen** | **PASS** | Emulated resolution and timezone offset applied cleanly. |
| **WebRTC IP Leak Guard** | **PASS** | Policy enforced: `disable_non_proxied_udp` prevents real IP leakage. |
| **Proxy Routing** | **PASS** | Direct, HTTP, HTTPS, SOCKS5, and local auth tunnels verified. |
| **Session Persistence** | **PASS** | Cookies, LocalStorage, and IndexedDB persist across browser launch and relaunch cycles. |
| **Extensions Loading** | **PASS** | Unpacked CRX and manifest v3 extensions load via `--load-extension`. |
| **CDP Connection** | **PASS** | Remote debugging port connects reliably without `--enable-automation` flag. |
| **RPA Workflow Engine** | **PASS** | 10-cycle multi-step visual workflows execute and report step logs. |
| **Cookie Warmer & Auto-Farmer** | **PASS** | Quick and Deep Ageing warming routines pass across batch profiles. |
| **CDP Synchronizer Hub** | **PASS** | Real multi-window navigation and click replication verified. |
| **Cloud Browser Worker** | **PASS** | Worker executable resolution points directly to production unbranded engine. |

---

## 3. PACKAGING, INSTALLER & DEPLOYMENT VERIFICATION

### 3.1 Fresh Build & Repackaging
A clean production build was compiled from HEAD:
- **Renderer:** Vite + React build (`dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`)
- **Electron Main:** `dist-electron/main/index.js` (with unbranded Chromium engine resolver)
- **Preload:** `dist-electron/preload/index.cjs`
- **Components Verified in Bundle:**
  - `StarterProfilesSection` (defensive rendering, 6 starter cards)
  - `UpgradeModal` (entitlement gate for PRO features)
  - `PremiumLocks` (visible on Automation, BIZ, Support)
  - `Entitlement IPC` (`entitlements:get`, `account:getProfileLimits`)
  - `Clean Launch Engine Config` (`CHROMIUM_PRODUCTION` 138.0.7204.0)

### 3.2 Packaged Artifacts
Generated via `electron-builder`:
- **Installer:** `release/MAHI-Browser-Setup-1.1.1.exe`
  - Size: `91,032,673` bytes
  - SHA-256: `8692d0f1c9842399f8de2afc845d2ebf539ebaff86ab8f7bae071c094db35919`
  - SHA-512: `90a979797cb90f3fcb8013ad5baa8e3d308c9eade4c6dc9b45f4793b7a2e4dddad7d3c2badbb76c4830dd7aa12d406fc797d85ae88577a0567bf432b52b35700`
- **Portable:** `release/MAHI-Browser-Portable-1.1.1.exe`
  - Size: `90,785,390` bytes
  - SHA-256: `323c2339a8614df571d3dab53f04245bad0b514cd18cb0968315c0be227ecac4`
- **Manifests:**
  - `release/latest.yml` (Version: `1.1.1`, Date: `2026-10-09T00:21:27.434Z`)
  - `release/latest.json` (Version: `1.1.1`, full dual-file SHA checksums)

### 3.3 Installed Application Verification
The fresh installer was executed in silent upgrade mode over `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\`:
- User data in `%APPDATA%\mahi-browser` (**Preserved 100%**)
- Installed `app.asar` SHA-256: `6916A59CBCF9D0F86B19E154839429DD2DF850737EEE449487D6F1F7C6EF7490`
- Packaged `app.asar` SHA-256: `6916A59CBCF9D0F86B19E154839429DD2DF850737EEE449487D6F1F7C6EF7490`
- **Cryptographic Match:** **100% PASS**
- Installed `MAHI BROWSER.exe` SHA-256: `BF5A6C3AD05D990174C6CA0C64A82210C5234D2459852F2F673DC0AB00B55846`
- Packaged `MAHI Browser.exe` SHA-256: `BF5A6C3AD05D990174C6CA0C64A82210C5234D2459852F2F673DC0AB00B55846`
- **Cryptographic Match:** **100% PASS**

### 3.4 Live Public Download & Update Feed Synchronization
All release artifacts were deployed to the live production server (`200.97.164.97`):
- **Public Download URL:** `https://mahibrowser.com/download/MAHI-Setup.exe`
  - Downloaded live and hashed: `8692D0F1C9842399F8DE2AFC845D2EBF539EBAFF86AB8F7BAE071C094DB35919`
  - Local Release Hash: `8692D0F1C9842399F8DE2AFC845D2EBF539EBAFF86AB8F7BAE071C094DB35919`
  - **Match:** **100% PASS**
- **Public Update Feed:** `https://mahibrowser.com/update/latest.yml`
  - Verified live via HTTP GET: Serves `version: 1.1.1` with matching SHA-512 and size.
  - Stale October 7 manifest has been **completely replaced**.
- **JSON Manifest Feed:** `https://mahibrowser.com/update/latest.json`
  - Verified live via HTTP GET: Serves `version: 1.1.1`, matching file sizes and SHA-256 hashes.

---

## 4. TEST SUITE & ISOLATION COMPLIANCE

- **Global Test Database Isolation:** `%APPDATA%\mahi-browser\mahi_browser.sqlite` is completely untouched during test execution. Tests use isolated `.test_data/` files and in-memory mock databases.
- **Existing Tests:** **691 / 691 PASS**
- **New Tests Added:** **13 / 13 PASS** (`11_TESTS/unit/production-chromium-engine.test.ts`)
  - Engine source selection
  - Snapshot CDN & SHA-256 integrity
  - Isolated engine paths
  - Backward compatibility with CfT directory
  - PE header binary metadata (`ProductName = Chromium`)
  - Clean launch args without CfT switches
  - Live manifest schema & file hash parity
- **Total Passing Tests:** **704 / 704 PASS**
- **Typecheck:** **PASS** (`tsc --noEmit && tsc -p tsconfig.electron.json --noEmit`)
- **Production Build:** **PASS**

---

## 5. CODE SIGNING STATUS

- **Windows Authenticode Signing:** **BLOCKED BY EXTERNAL CREDENTIAL**
  - No private EV/OV certificate or `WIN_CSC_LINK` / `CSC_KEY_PASSWORD` was injected.
  - Production build pipeline honestly reports: `[Authenticode:CONFIGURED] No code signing certificate found in environment. Skipping binary signing. STATUS: PRODUCTION CODE SIGNING CREDENTIAL REQUIRED.`
  - No self-signed certificates, mock signatures, Defender modifications, or SmartScreen tampering was introduced.

---

## 6. REMAINING P0 WORK ITEMS (FUTURE BATCHES)

Per `docs/MAHI_BROWSER_FINAL_REMAINING_WORK_AUDIT.md`:
1. **Production Windows Authenticode Certificate:** Obtain and supply trusted code signing certificate to eliminate Windows SmartScreen unknown publisher prompt.
2. **Cloudflare R2 Bucket Sync Pipeline:** Configure real automated bucket sync if object storage is selected for future multi-region CDN distribution.
3. **Resend / SMTP Live Configuration:** Production transactional email delivery credentials.
4. **Payment Gateway Webhook Secret Sync:** Production LemonSqueezy/Stripe live webhook validation secrets.
