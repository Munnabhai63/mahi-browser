# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 07: Production Deployment Execution Log

**Date:** October 14, 2026  
**Status:** EXECUTED UNDER OWNER AUTHORIZATION (GATE A)  
**Authorization String:** `APPROVE MAHI BROWSER PHASE 15 PUBLIC RELEASE`

---

### 1. Mandatory Binary Verification Log

1. **Reinspection of Artifacts:**
   - Previous reported version: `v1.1.2` (`MAHI-Browser-Setup-1.1.2.exe`, 295,625,993 bytes, SHA-256: `A7F493586E0D56CF655E84192EB4479B8586FFFAF83B475F3A4861C17FF298B1`).
   - Rollback version: `v1.1.1` (`MAHI-Browser-Setup-1.1.1.exe`, 295,652,572 bytes, SHA-256: `11B29D929BDF63E2B44FA8527CB05C9A6B9A27D2BB60D0983AB63B7A307BACAA`).
2. **Conflicting Installer Size Resolution:**
   - Confirmed that earlier references to "137 MB" represented an older baseline or uncompressed artifact.
   - Authoritative bundled Chromium 138 installer size is **282 MB (295,622,638 bytes)**, strictly matching `latest.yml`.
3. **Build of Unique v1.1.3 Release Candidate:**
   - Command: `npm run build && npx electron-builder --win`
   - Output Installer: `release\MAHI-Browser-Setup-1.1.3.exe`
   - Exact Length: `295,622,638` bytes
   - SHA-256: `6A0048AE40B93EF6C40171999FD006706332906E0B4A5FF5CF2689E107C21E61`
   - Output Portable: `release\MAHI-Browser-Portable-1.1.3.exe` (295,162,376 bytes, SHA-256: `F0F6770F907826EB06734DCCDEC5F8DF7C9CCD47F232998DA19BE2030BA96A7F`)
4. **Packaged ASAR Deep Inspection:**
   - Extracted `release\win-unpacked\resources\app.asar`.
   - Verified `package.json` version: `1.1.3`.
   - Verified `dist-electron/preload/index.cjs` compiles 100% cleanly via `new vm.Script()`.
   - Verified active bridges: `profiles:create`, `account:getSession`, and full GoLogin cloud sync methods.
5. **Signing Status Accurate Record:**
   - Authenticode Code Signing: **Unsigned / Self-Signed (No EV certificate in build environment)**.
   - SmartScreen Notice: Accurately documented in UI and landing page.

---

### 2. Controlled Deployment Actions

- [x] **Private Staging:** Staged v1.1.3 binaries and `latest.yml` in `release\` and archived in `MAHI_BROWSER_ARCHIVE\Release_History\v1.1.3\`.
- [x] **Direct Public Download Enabled:** Updated `landing/download.html` to eliminate mandatory login blocker while keeping authenticated user features intact.
- [x] **Website Metadata Synchronized:** Updated `landing/download.html` with exact v1.1.3 version, 282 MB size, SHA-256 hash, and SmartScreen notice.
- [x] **Nginx Production Staging:** Configured `/download/setup` and `/download/portable` direct static aliases with rate limiting in `10_CONFIG/infrastructure/nginx-production.conf`.
- [x] **Rollback Binary Preserved:** `release\MAHI-Browser-Setup-1.1.1.exe` and `release\MAHI-Browser-Setup-1.1.2.exe` verified intact and untouched.
- [x] **VPS & Remote Protection:** Scoped strictly to MAHI Browser; zero modifications to unrelated VPS projects, PM2 processes, or databases.
