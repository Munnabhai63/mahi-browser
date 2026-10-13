# MAHI BROWSER — P1 PRODUCTION BUG FIX
## Report 02: Public Installer Version & SHA-256 Evidence

**Date:** October 14, 2026  

---

### 1. Authoritative Release Binaries in `release/`

| Release Name | File Path | File Size | SHA-256 Checksum | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **v1.1.2 Public** | `release\MAHI-Browser-Setup-1.1.2.exe` | 137,294,616 B | `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1` | Active Public Release |
| **v1.1.1 Rollback** | `release\MAHI-Browser-Setup-1.1.1.exe` | 136,897,296 B | `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa` | Last-Known-Good Rollback |
| **v1.1.0 Historic** | `release\MAHI-Browser-Setup-1.1.0.exe` | 136,541,208 B | `cb78f35f29d107a688975871b6932a9ec67295ff625c1b50424a7704df7c87c2` | Archived Historical |

---

### 2. Live Public Download Mapping

- **Website Route:** `https://mahibrowser.com/download/setup`
- **Current Live Binary:** Points to `MAHI-Browser-Setup-1.1.2.exe` (SHA-256: `a7f49358...`)
- **Correction Packaging:** Once approved, the bug fix will be packaged as `MAHI-Browser-Setup-1.1.2-rev1.exe` or `MAHI-Browser-Setup-1.1.3.exe` with updated checksums and signature manifest.
