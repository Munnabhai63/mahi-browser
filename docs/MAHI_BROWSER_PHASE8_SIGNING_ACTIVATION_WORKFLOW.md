# MAHI BROWSER — PHASE 8 SIGNING ACTIVATION WORKFLOW & PUBLISHER BRANDING

**Product Name:** MAHI Browser  
**Creator / Publisher Branding:** By Munna Bhai  
**Current Version:** v1.1.1 RC1  
**Target Platform:** Windows 11 / 10 x64 (Electron 33 / Chromium 138)  
**Status:** Verification Complete — Turnkey Signing Activation Ready  

---

## 1. Publisher Branding Confirmation Summary

The public-facing creator branding has been confirmed and applied across all authoritative surfaces:
- **Product Name:** `MAHI Browser`
- **Creator Attribution:** `By Munna Bhai`
- **Author / Maintainer:** `Munna Bhai <support@mahibrowser.com>`
- **Version:** `v1.1.1 RC1`

### Applied Surfaces
1. `package.json`: Author set to `Munna Bhai`.
2. `electron-builder.json`: Copyright set to `Copyright © 2026 MAHI Browser — By Munna Bhai`, Maintainer to `Munna Bhai <support@mahibrowser.com>`.
3. `10_CONFIG/brand-config.ts`: Central brand exports `creator: 'Munna Bhai'`, `creatorBranding: 'By Munna Bhai'`, `company: 'Munna Bhai'`.
4. `01_UI/pages/HelpAbout.tsx`: Version displayed as `v1.1.1 RC1` with subtitle `By Munna Bhai • Enterprise-grade multi-profile environment manager...`.
5. `01_UI/pages/AppSettings.tsx`: Version status shows `v1.1.1 RC1 • By Munna Bhai (x64)`.
6. `01_UI/components/Sidebar.tsx`: Subtle persistent footer attribution `By Munna Bhai • v1.1.1 RC1`.
7. `07_BACKEND/server/download-portal-html.ts`: Download hero renders `Version ${version} — Windows x64 • By Munna Bhai`; footer copyright binds to `By Munna Bhai`.
8. `landing/download.html`: Badge `Created by Munna Bhai`, version `v1.1.1 (RC1)`, accurate size `282 MB (Bundled Chromium 138)`.
9. `12_SCRIPTS/sign.cjs`: Signtool flags updated with `/d "MAHI Browser — By Munna Bhai"` and `/du "https://mahibrowser.com"`.

**Integrity Audit:** All application UI/UX, multi-profile isolation, database models, session encryption, and existing release binaries (`release/MAHI-Browser-Setup-1.1.1.exe` & `release/MAHI-Browser-Portable-1.1.1.exe`) remain 100% preserved.

---

## 2. Windows Authenticode Legal Identity Analysis

### The CA/Browser Forum Standard
Certificate Authorities (Certum, Sectigo, DigiCert) do not issue code signing certificates with informal display names or pseudonyms. Under **CA/Browser Forum Baseline Requirements**, certificate subject names must be legally verified against official government registries.

### Two Recognized Procurement Paths

#### Path A: Individual Validation (IV)
- **Certificate Subject:** `CN = <Applicant Full Legal Name>` (e.g. `CN = Munaf <Legal Surname>`, `C = IN`).
- **Required Documents:** Government Photo ID (Passport / Aadhaar / PAN card / Driver's License) + Proof of residential address + Video identity verification.
- **Windows Display:**
  - UAC Program Name: `MAHI Browser — By Munna Bhai` (via `signtool /d`)
  - Verified Publisher: `<Applicant Full Legal Name>`
  - Application UI & Website: `MAHI Browser — By Munna Bhai`

#### Path B: Registered Trade Name / Sole Proprietorship (OV/EV)
- **Certificate Subject:** `CN = Munna Bhai` (or `CN = Munna Bhai Enterprises`), `O = Munna Bhai`.
- **Required Documents:** Official government registration of the Trade Name:
  - In India: Udyam MSME Registration Certificate under enterprise name *"Munna Bhai"*, or GST Registration Certificate.
  - Internationally: Official DBA (Doing Business As) filing or Business Registration.
- **Windows Display:**
  - UAC Program Name: `MAHI Browser`
  - Verified Publisher: `Munna Bhai`

---

## 3. Phase 8 Signing Activation Procedure (Turnkey Execution)

When the owner procures the certificate, signing is activated with zero code changes:

1. **Set Environment Variable (Terminal session only — never commit to Git):**
   ```powershell
   # If using USB Token / SimplySign / Windows Certificate Store:
   $env:CERT_THUMBPRINT = "<YOUR_CERTIFICATE_SHA1_THUMBPRINT>"

   # Or if using PFX file:
   $env:WIN_CSC_LINK = "C:\path\to\certificate.pfx"
   $env:WIN_CSC_KEY_PASSWORD = "<PASSWORD>"
   ```

2. **Execute Autonomous Build:**
   ```powershell
   npm run dist:win
   ```

3. **Verify Signatures & Update Manifests:**
   ```powershell
   signtool verify /pa /v release\MAHI-Browser-Setup-1.1.1.exe
   signtool verify /pa /v release\MAHI-Browser-Portable-1.1.1.exe
   node 12_SCRIPTS/generate-release-manifest.cjs release
   ```

4. **Public Release Gate:**
   Publication to Cloudflare R2 or GitHub Releases remains strictly locked until explicit owner command.
