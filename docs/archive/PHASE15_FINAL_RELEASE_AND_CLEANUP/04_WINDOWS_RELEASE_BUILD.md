# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 04: Windows Release Candidate Build Specification

**Date:** October 14, 2026  
**Packaging Platform:** Windows 10/11 x64 (NSIS + Portable)  
**Output Target Directory:** `release\`  

---

### 1. Build Specifications

- **Product Name:** MAHI Browser
- **App ID:** `com.mahibrowser.app`
- **Proposed Semantic Version:** `1.1.3` (or `1.1.2-rev1` to prevent replacing identical binaries under identical checksums)
- **Artifact Setup Name:** `MAHI-Browser-Setup-1.1.3.exe`
- **Artifact Portable Name:** `MAHI-Browser-Portable-1.1.3.exe`
- **Signing Script:** `12_SCRIPTS/sign.cjs` (Verifies Authenticode / SmartScreen compliance)

---

### 2. Compilation Pipeline Verification

1. `npm run typecheck`:
   - `tsc --noEmit && tsc -p tsconfig.electron.json --noEmit` passed with 0 errors.
2. `npm run build`:
   - Cleans `dist-electron`.
   - Runs TypeScript compilation.
   - Bundles renderer with Vite.
   - Executes `12_SCRIPTS/fix-preload.cjs` with mandatory `node -c` syntax assertion.
3. Packaging command: `npm run dist:win` (staged, ready for execution upon Approval Gate A).
