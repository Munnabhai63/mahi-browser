# MAHI BROWSER — P1 PRODUCTION BUG FIX
## Report 05: Safe Deployment & Rollback Plan

**Date:** October 14, 2026  
**Status:** Staged Locally — Awaiting Production Approval

---

### 1. Pre-Deployment Staging Checklist

- [x] All TypeScript errors eliminated (`npm run typecheck` passed with 0 errors).
- [x] Preload syntax automated check integrated into `fix-preload.cjs`.
- [x] Full test suite passing (104 files / 955 tests).
- [x] Real Chromium launch verified with PID tracking.
- [x] Backward compatibility with existing user databases confirmed.

---

### 2. Step-by-Step Production Release Procedure

1. **Step 1: Production Package Build**
   - Command: `npm run package:win`
   - Generates: `release\MAHI-Browser-Setup-1.1.2-fixed.exe` (or v1.1.3).
2. **Step 2: Checksum & VirusTotal Hash Verification**
   - Generate SHA-256 and update `latest.yml`.
3. **Step 3: Staging Server Upload**
   - Upload new binary to `/var/www/mahibrowser.com/releases/`.
4. **Step 4: Atomic Symlink Switch**
   - Point `/download/setup` to the new binary.
5. **Step 5: Smoke Test on Clean Machine**
   - Download from live URL, install, launch, and create quick profile.

---

### 3. Rollback Procedure (< 30 Seconds)

If any issue is detected in the field:
1. Re-point `/download/setup` to `MAHI-Browser-Setup-1.1.1.exe`.
2. Revert `latest.yml` version to `1.1.1`.
3. Issue Nginx reload: `systemctl reload nginx`.
