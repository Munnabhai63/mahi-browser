# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 03: Release Version Consolidation & Single Source of Truth

**Date:** October 14, 2026  
**Primary Standard:** Single Authoritative Baseline Principle

---

### 1. Release Version Inventory

| Version | Packaging Type | Location | Hash / Status | Canonical Role |
|---|---|---|---|---|
| **v1.1.2** | NSIS Installer (.exe) | `release\MAHI-Browser-Setup-1.1.2.exe` | SHA-256: `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1` | **Current Public Production Release** |
| **v1.1.2** | Portable Binary (.exe) | `release\MAHI-Browser-Portable-1.1.2.exe` | SHA-256: `36788bcb18b21aae55e56d3710be6f0c3417b76f087daeecc85625b33bd1e8e4` | **Current Portable Production Release** |
| **v1.1.1** | NSIS Installer (.exe) | `release\MAHI-Browser-Setup-1.1.1.exe` | SHA-256: `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa` | **Verified Rollback Release** |
| **v1.1.1** | Portable Binary (.exe) | `release\MAHI-Browser-Portable-1.1.1.exe` | SHA-256: `ad5a79366564a65fdf7123a0ee3a1f699000e74b467319aa48064c30960a99fa` | **Verified Rollback Portable Release** |

---

### 2. Elimination of Build Output Confusion

Prior to this consolidation, three competing build directories existed in the project root:
1. `release\`: The real `electron-builder.json` output.
2. `release-candidate\`: Produced by experimental builds using `electron-builder-candidate.json`.
3. `release-preview\`: An older preview folder that was mistakenly referenced in `StarterProfilesSection.tsx`.
4. `release-v1.1.2\`: A manual snapshot folder.

**Resolution:**
- `release\` is established as the **SOLE AUTHORITATIVE BUILD OUTPUT** directory.
- `package.json` scripts (`pack`, `dist`, `dist:win`) strictly target `release\`.
- All hardcoded path references to `release-preview` in `StarterProfilesSection.tsx` have been surgically redirected to the canonical installed application executable:
  `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`.

---

### 3. Release Lineage & Upgrades

1. **Rollback Release:** v1.1.1 (`MAHI-Browser-Setup-1.1.1.exe`, 295,652,572 bytes) is preserved in `release\` and archived in `MAHI_BROWSER_ARCHIVE\Release_History`.
2. **Current Public Release:** v1.1.2 (`MAHI-Browser-Setup-1.1.2.exe`, 295,625,993 bytes) is preserved in `release\` and archived in `MAHI_BROWSER_ARCHIVE\Release_History`.
3. **Upcoming Candidate:** The newly fixed user-flow and auth-hardened build will be cleanly tagged and packaged once owner approval is granted. No old binaries will be overwritten under identical version numbers.
