# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 04: Duplicate & Dependency Analysis

**Date:** October 14, 2026  
**Focus:** Elimination of Redundant Data, Stale References & Build Bloat

---

### 1. Duplicate Directories Analysis

| Candidate Directory | Size | Identical / Redundant Counterpart | Active Dependencies | Recommendation |
|---|---|---|---|---|
| `release-v1.1.2\` | 564 MB | Byte-for-byte identical to `release\MAHI-Browser-Setup-1.1.2.exe` & `release\MAHI-Browser-Portable-1.1.2.exe` | None. No script, test, or code references this folder. | Move to Quarantine |
| `release-candidate\` | 1,550 MB | Older packaging outputs for v1.1.1; identical copies already preserved in `Release_History`. | Referenced only by `electron-builder-candidate.json` (unused in `package.json`). | Move to Quarantine |
| `release-preview\` | 986 MB | Contains `win-unpacked` output from an older dev run. | Path in `StarterProfilesSection.tsx` has been redirected to AppData. No other dependencies. | Move to Quarantine |
| `Mahi terabox\` | 4,690 MB | Contains an old unpacked source copy with its own 4.5 GB `node_modules` directory. | Zero dependencies in active codebase or build tools. | Move to Quarantine |
| `.test_data\` | ~2 MB | Generated sqlite and profile export from earlier vitest execution. | Zero active dependencies. Already copied to `MAHI_BROWSER_ARCHIVE\Test_Artifacts`. | Delete from active repo |

---

### 2. Recoverable Disk Space

- Total redundant disk space across these 4 obsolete directories: **7,790 MB (~7.8 GB)**.
- Reclaiming this space removes clutter from the Git working tree, prevents accidental inclusion in builds, and speeds up repository tooling.

---

### 3. Dependency Check Results

A global search was conducted across all TypeScript, JavaScript, JSON, and Markdown files:
1. `release-preview`: Was found in 2 lines of `StarterProfilesSection.tsx`. **Fixed** to point to the canonical installed path.
2. `release-candidate`: Was found in `electron-builder-candidate.json`. Cleanly segregated from standard `npm run dist`.
3. `Mahi terabox`: Zero matches across entire active codebase.
4. `release-v1.1.2`: Zero matches across entire active codebase.
