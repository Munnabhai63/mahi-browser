# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 10: Release & Deployment Plan

**Date:** October 14, 2026  
**Status:** Staged Locally — Stoppage Before Live Deployment  
**Mandate:** Explicit Owner Approval Required Before Production Actions

---

### 1. Release Inventory

1. **Current Public Release:**
   - File: `release\MAHI-Browser-Setup-1.1.2.exe`
   - Size: 137,294,616 bytes (~130.93 MB)
   - SHA-256: `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1`
2. **Rollback Release (Last-Known-Good):**
   - File: `release\MAHI-Browser-Setup-1.1.1.exe`
   - Size: 136,897,296 bytes (~130.56 MB)
   - SHA-256: `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa`
3. **New User-Flow Candidate:**
   - Built and validated in local workspace `C:\Users\munaf\Desktop\mahai brouser`.

---

### 2. Staged Deployment Procedure (Post-Approval)

When the owner explicitly approves deployment:
1. **Packaging:** Run `npm run package:win` to generate `MAHI-Browser-Setup-1.1.3.exe` (or refreshed v1.1.2 package).
2. **Upload Installer to VPS:** SCP / SFTP the installer and `latest.yml` to `/var/www/mahibrowser.com/releases/`.
3. **Nginx Symlink:** Point `/download/setup` to the new installer binary.
4. **Website Landing Page Update:** Deploy the direct download CTA on `https://mahibrowser.com`.
5. **Live Verification:** Verify download, install, in-app login, and profile launch on a clean test client.

---

### 3. Immediate Rollback Mechanism

If any unexpected regression occurs:
- Revert `/download/setup` alias in Nginx back to `MAHI-Browser-Setup-1.1.1.exe`.
- Reload Nginx (`sudo nginx -s reload`). Total rollback time: < 30 seconds.
