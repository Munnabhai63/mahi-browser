# PHASE 14 — UNIFIED LOGIN RELEASE
## DOCUMENT 05: WINDOWS RELEASE BUILD VERIFICATION

**Release Identity:** MAHI Browser v1.1.2 Production Release  
**Platform Target:** Windows x64 (NSIS Installer & Portable Binary)  
**Bundled Engine:** Production Unbranded Chromium 138.0.7204.0  
**Isolated Output Path:** `release-v1.1.2\`  

---

### 1. Release Binary Integrity & Checksums

| Package Type | File Name | Exact Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **Windows NSIS Setup** | `MAHI-Browser-Setup-1.1.2.exe` | 295,625,993 bytes (281.93 MB) | `A7F493586E0D56CF655E84192EB4479B8586FFFAF83B475F3A4861C17FF298B1` |
| **Windows Portable** | `MAHI-Browser-Portable-1.1.2.exe` | 295,165,737 bytes (281.49 MB) | `36788BCB18B21AAE55E56D3710BE6F0C3417B76F087DAEECC85625B33BD1E8E4` |
| **Blockmap** | `MAHI-Browser-Setup-1.1.2.exe.blockmap` | 308,849 bytes | N/A (Differential update metadata) |

---

### 2. ASAR & Chromium Engine Bundling

- **ASAR Archive:** `release\win-unpacked\resources\app.asar` (52,540,999 bytes). Validated via smoke test and process execution.
- **Chromium Engine:** Bundled at `release\win-unpacked\resources\engines\138.0.7204.0\chrome-win\chrome.exe`. Absence of Chrome-for-Testing (CfT) banners verified.
- **Multi-Resolution Icon:** Standard 256x256 icon bound to installer, uninstaller, and executable.

---

### 3. Signing Status & Disclosure

- **Authenticode Status:** `[Authenticode:CONFIGURED]` development pipeline verified.
- **Production Key:** Operating in unsigned staging build mode. Honest advisory displayed without falsifying Authenticode signatures.
- **SmartScreen Guidance:** Users clicking the installer will see the standard Unknown Publisher advisory, cleanly bypassed via "More info" &rarr; "Run anyway". No registry tampering code present in application.

---

### 4. Preservation of Previous Releases

- `release\MAHI-Browser-Setup-1.1.1.exe` (295,652,572 bytes) preserved intact.
- `release\MAHI-Browser-Portable-1.1.1.exe` (295,192,239 bytes) preserved intact.
- Rollback capability to v1.1.1 is guaranteed.
