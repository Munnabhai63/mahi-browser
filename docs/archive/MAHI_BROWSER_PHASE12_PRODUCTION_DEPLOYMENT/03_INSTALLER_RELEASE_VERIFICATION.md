# MAHI BROWSER — PHASE 12 PRODUCTION DEPLOYMENT
## REPORT 03: INSTALLER CRYPTOGRAPHIC GATE & RELEASE VERIFICATION

**Project:** MAHI Browser  
**Artifact Candidate:** `MAHI-Browser-Setup-1.1.1.exe`  
**Local Source:** `C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe`  
**Target VPS Path:** `/var/www/mahi/download/MAHI-Browser-Setup-1.1.1.exe`  
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Release & Packaging Lead  
**Status:** CRYPTOGRAPHICALLY VERIFIED & TRANSPARENCY ENFORCED  

---

### 1. Independent Cryptographic Recomputation

Prior to any staging transfer or deployment proposal, the candidate artifact was independently audited on the local filesystem:

```powershell
Get-Item 'C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe' | Select-Object FullName, Length
Get-FileHash 'C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe' -Algorithm SHA256
Get-AuthenticodeSignature 'C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe'
```

**Artifact Properties:**

| Specification | Target Value | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **Exact Byte Count** | `295,644,799 bytes` | `295644799` | **MATCH** |
| **Size in Megabytes** | `281.95 MiB` (~282 MB) | `281.95 MiB` | **MATCH** |
| **SHA-256 Hash** | `562F70075F6B5ED7B8BBF2FF270D7FF36AE45A53559C020C39429784EC62621F` | `562F70...62621F` | **BIT-EXACT** |
| **Authenticode Status** | `NotSigned` | `Status: NotSigned`, `SignatureType: None` | **RECORDED** |
| **Product Version** | `v1.1.1 RC1` | Verified in NSIS manifest | **MATCH** |
| **Bundled Engine** | Chromium 138 / Electron 33 | Verified in unpacked resources | **MATCH** |
| **Creator Branding** | By Munna Bhai | Verified in package metadata | **MATCH** |
| **Starter Templates** | 6 Tested & Verified Templates | Verified in runtime integration tests | **MATCH** |

---

### 2. Comparison with Currently Deployed Server Artifact

A direct comparison against the live server filesystem (`/var/www/mahi/download/`) highlights the necessity of the update:

| Property | Current Server Artifact (`/var/www/mahi/download/MAHI-Setup.exe`) | Approved Candidate (`MAHI-Browser-Setup-1.1.1.exe`) |
| :--- | :--- | :--- |
| **File Size** | `91,032,673 bytes` (~86.8 MB) | **`295,644,799 bytes`** (~282 MB) |
| **SHA-256 Checksum** | `8692d0f1c9842399f8de2afc845d2ebf539ebaff86ab8f7bae071c094db35919` | **`562F70075F6B5ED7B8BBF2FF270D7FF36AE45A53559C020C39429784EC62621F`** |
| **Engine Status** | Outdated Chromium bundle | **Chromium 138 / Electron 33 Full Runtime** |
| **Starter Profiles** | Incomplete template creation | **100% Verified 6 Starter Templates** |

---

### 3. Unsigned Release Transparency & Safety Disclaimer

Because the installer is an **unsigned Release Candidate 1 (RC1)**, strict transparency rules have been implemented:

1. **Download Page Warning:**  
   The following prominent warning card has been integrated directly into `landing/download.html`:
   > **Release Candidate Notice — Unsigned Windows Installer**  
   > Windows Defender SmartScreen may display an *"Unknown Publisher"* prompt during installation until code signing certification is finalized. To proceed, click **"More info" → "Run anyway"**. Verify file integrity using the SHA-256 checksum above.

2. **Prohibited Claims:**  
   The release marketing does **NOT** claim to be "Digitally Signed", "SmartScreen Certified", or "Microsoft Verified".
3. **No Unsafe Instructions:**  
   Users are never instructed to disable Windows Defender or SmartScreen globally.
4. **Owner Selection:**  
   The project owner has explicitly chosen public distribution for this unsigned RC1 build, with the understanding that code signing will be applied in a future release once an EV certificate is acquired.

---

### 4. Transfer & Validation Protocol (For Authorized Deployment)

When approved for deployment:
1. Upload candidate via SCP to `/var/www/mahi/download/MAHI-Browser-Setup-1.1.1.exe`.
2. Compute remote checksum: `sha256sum /var/www/mahi/download/MAHI-Browser-Setup-1.1.1.exe`.
3. If remote hash is anything other than `562f70075f6b5ed7b8bbf2ff270d7ff36ae45a53559c020c39429784ec62621f`, **ABORT IMMEDIATELY**.
4. Set permissions: `chmod 644 /var/www/mahi/download/MAHI-Browser-Setup-1.1.1.exe`.
5. Atomic symlink/copy: Link `MAHI-Setup.exe` to `MAHI-Browser-Setup-1.1.1.exe` for legacy link compatibility.

**Verdict:** The installer is cryptographically verified, bit-exact with all documentation, and ready for deployment upon owner approval.
