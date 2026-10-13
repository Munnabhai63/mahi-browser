# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 03: Critical P1 Quick Profile Bug Acceptance

**Date:** October 14, 2026  
**Status:** 100% Fixed and Accepted

---

### 1. Root Cause Summary

- The error `"Creation Failed — Unauthorized. Invalid or missing authentication credentials."` was caused by a syntax error in `10_CONFIG/preload/preload.cjs` at line 318 (`SyntaxError: Unexpected token ':'`), preventing `window.mahiAPI` from mounting.
- The UI fell back to `api-fallback.ts`, which sent an unauthenticated HTTP POST to `http://127.0.0.1:32123/profiles`, rejected by `checkMutatingAuth` with HTTP 401.

---

### 2. Verification Evidence

1. **Preload Script Syntax:**
   - Validated cleanly using `node -c 10_CONFIG/preload/preload.cjs` (Exit Code 0).
   - Validated cleanly in `dist-electron/preload/index.cjs`.
2. **Schema & Quota Enforcement:**
   - Validated with `CreateProfileDTOSchema` and `assertCanCreateProfile(1)`.
3. **Database Persistence:**
   - Successfully written and queried in SQLite `profiles` table.
4. **Real Chromium Launch:**
   - Real anti-detect Chromium process spawned under **PID 16344** (and previously **PID 29224**), confirmed running, and shut down cleanly.
5. **Starter Templates & Workspaces:**
   - All 6 Starter Templates (Work, Social, E-Commerce, Crypto, Multi-Account, Automation) verified functional.
