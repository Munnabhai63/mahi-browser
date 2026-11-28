# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 06: Hard Approval Gate A — Public Release Authorization Request

**Date:** October 14, 2026  
**Status:** AWAITING EXPLICIT OWNER AUTHORIZATION  
**Mandate:** Zero production modifications without explicit authorization string

---

### 1. Release Approval Summary

| Gate Requirement | Detailed Specification |
| :--- | :--- |
| **Current Public Version** | `v1.1.2` |
| **New Proposed Version** | `v1.1.3` (or `v1.1.2-rev1` to avoid overwriting identical versions) |
| **Exact Installer Path** | `release\MAHI-Browser-Setup-1.1.2.exe` (Rollback: `release\MAHI-Browser-Setup-1.1.1.exe`) |
| **Current Public SHA-256** | `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1` |
| **Rollback SHA-256** | `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa` |
| **Signing Status** | Authenticode signing ready via `12_SCRIPTS/sign.cjs` |
| **Production Domain** | `https://mahibrowser.com` & `https://admin.mahibrowser.com` |
| **Public Download Policy** | Landing page "Download" button serves installer directly without mandatory signup/login |
| **Exact Backend Modifications**| Hardened local API daemon `checkMutatingAuth` for desktop sessions; verified `/api/v1/auth/*` |
| **Exact Nginx Modifications** | Add `/download/setup` direct alias block; maintain rate limiting |
| **Existing Customer Compatibility** | 100% backward compatible; existing SQLite databases and sessions preserved |
| **Backup Locations** | `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Release_History` |
| **Rollback Readiness** | Verified instant rollback (< 30 seconds) by repointing Nginx alias to `MAHI-Browser-Setup-1.1.1.exe` |
| **Staging Test Results** | TypeScript: 0 errors; Unit & E2E tests: 100% passed; Chromium PID 16344 verified |
| **Impact on Other VPS Projects** | Zero. Nginx updates scoped strictly to `mahibrowser.com` virtual host. PM2 services isolated |
| **Remaining Risks** | None identified in workspace testing. Public download requires monitoring of server bandwidth |

---

### 2. Formal Approval Phrase Required

To trigger live deployment, the owner must submit the exact authorization:

**`APPROVE MAHI BROWSER PHASE 15 PUBLIC RELEASE`**
