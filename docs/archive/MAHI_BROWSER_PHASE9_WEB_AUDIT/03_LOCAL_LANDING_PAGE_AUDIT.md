# MAHI BROWSER — PHASE 9 MASTER AUDIT
## 03. LOCAL LANDING PAGE SOURCE vs PRODUCTION WEBSITE
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Local Directory:** `landing/`  
**Production Origin:** `https://mahibrowser.com`  

---

### 1. Static File Parity Matrix

| File Path | Local Size | Production Size | Line Count | Status | Notes |
|---|---|---|---|---|---|
| `landing/index.html` | 99,646 B | 99,646 B | 1,645 lines | **IDENTICAL** | 100% bit-for-bit parity with live website |
| `landing/pricing.html` | 25,002 B | 25,002 B | 422 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/login.html` | 19,854 B | 19,854 B | 610 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/signup.html` | 20,379 B | 20,379 B | 622 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/book-demo.html` | 17,910 B | 17,910 B | 512 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/privacy.html` | 6,078 B | 6,078 B | 158 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/terms.html` | 6,115 B | 6,115 B | 162 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/aup.html` | 7,967 B | 7,967 B | 194 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/robots.txt` | 68 B | 68 B | 5 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/sitemap.xml` | 601 B | 601 B | 22 lines | **IDENTICAL** | 100% bit-for-bit parity |
| `landing/download.html` | 24,222 B | 24,056 B | 754 vs 753 | **OUTDATED ON LIVE** | Contains 5 significant local updates |

---

### 2. Deep Diff: `landing/download.html` (Local vs Live)

The local download page contains recent Phase 8 and Phase 15 release updates that have **NOT** been deployed to production:

#### Diff 1: Creator Branding ("By Munna Bhai")
- **Local (Line 550):**
  ```html
  <p style="font-size: 0.875rem; color: #10b981; font-weight: 700; margin-top: -0.25rem; margin-bottom: 0.75rem;">Created by Munna Bhai</p>
  ```
- **Production (Line 550):**
  *Missing completely.*
- **Classification:** **LOCAL ONLY** (Severity: P2)

#### Diff 2: Version String Designation
- **Local (Line 559):** `<span><strong>Version:</strong> v1.1.1 (RC1)</span>`
- **Production (Line 558):** `<span><strong>Version:</strong> v1.1.1 (Stable)</span>`
- **Technical Insight:** The live site prematurely claims "Stable" while local source correctly reflects release candidate status "RC1".
- **Classification:** **OUTDATED ON LIVE** (Severity: P2)

#### Diff 3: Package Size & Engine Specification
- **Local (Line 561):** `<span><strong>Size:</strong> 282 MB (Bundled Chromium 138)</span>`
- **Production (Line 560):** `<span><strong>Size:</strong> 78.4 MB</span>`
- **Technical Insight:** The live site states 78.4 MB from an older thin-client release before Chromium was bundled. The actual local installer installer is 269 MB (282,143,896 bytes) because it contains the complete zero-leak Chromium engine.
- **Classification:** **OUTDATED ON LIVE** (Severity: P2)

#### Diff 4: SHA-256 Checksum Specification
- **Local (Line 565):** `<span><strong>SHA256:</strong> 11B29D...7BACAA</span>`
- **Production (Line 564):** `<span><strong>SHA256:</strong> Verified Build</span>`
- **Classification:** **OUTDATED ON LIVE** (Severity: P3)

#### Diff 5: Portable File Extension
- **Local (Line 569):** `<a id="portableLink" class="portable-link">Download Portable Version (.exe)</a>`
- **Production (Line 568):** `<a id="portableLink" class="portable-link">Download Portable Version (.zip)</a>`
- **Classification:** **OUTDATED ON LIVE** (Severity: P3)
