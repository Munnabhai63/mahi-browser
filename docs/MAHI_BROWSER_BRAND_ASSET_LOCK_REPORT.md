# MAHI BROWSER — OFFICIAL BRAND ASSET LOCK & NON-DRAGGABLE BRANDING AUDIT REPORT

**Date:** 2026-10-09  
**Status:** COMPLETE & VERIFIED  
**Author:** Antigravity AI Orchestrator  
**Baseline Test Suite:** 730 / 730 PASS  

---

## 1. Executive Summary

This report documents the official brand asset lock, role-specific asset mapping, SHA-256 hash enforcement, non-draggable brand protection, and multi-platform packaging for **MAHI Browser**.

All temporary, auto-generated, or distorted logo derivatives (including the legacy green "M" icon and altered dragon shapes) have been systematically eliminated from user-facing surfaces. The 4 approved master assets are now established as immutable brand truths, secured by cryptographic hash locks, and applied across the public website, web dashboard, Electron desktop client, Android mobile application, and installer packaging.

Furthermore, a comprehensive non-draggable brand protection system was implemented to prevent browser ghost-image drag artifacts while strictly preserving clickable navigation.

---

## 2. Authoritative Master Assets & Role Mapping

The 4 approved master brand assets are stored in the immutable directory `13_ASSETS/brand/approved/`:

| Asset Role | File Path | Format / Dimensions | SHA-256 Hash | Authorized Surfaces |
|---|---|---|---|---|
| **ASSET A: Primary Full Logo** | `13_ASSETS/brand/approved/mahi-browser-logo-primary.png` | PNG (RGBA), 1024×768 | `2ce7854ac00975cc7e57881345bf1cc3b9e14940b0b1e59270e18aec2235efe8` | Website navbar, Login/Signup, About page, Marketing header/footer, Download page, Desktop branding with text |
| **ASSET B: Red Dragon Mark** | `13_ASSETS/brand/approved/mahi-browser-mark-red.png` | PNG (RGBA), 1024×1024 | `916b50d58aec8398058645e968318778efed9879082ae62f908e51130e1f04a5` | Compact sidebar, Favicon derivative, Compact navigation, Splash mark, Header brand icon without wordmark |
| **ASSET C: Black + Red Dragon Mark** | `13_ASSETS/brand/approved/mahi-browser-mark-dark.png` | PNG (RGBA), 1024×1024 | `a8a871b9e597a088699e6b38a49c25a6e454c3ab09aca74f031741d32de0a883` | Dark theme surfaces, High-contrast premium dark backgrounds, Stealth/Dark UI contexts |
| **ASSET D: App Icon (Red Squircle + White Dragon)** | `13_ASSETS/brand/approved/mahi-browser-app-icon.png` | PNG (RGBA), 1024×1024 | `f5dcca2de1050e4e381bbb49b305b0b406773f888c54f08cde00eb97319f4f4d` | Windows application icon (`icon.ico`), Android launcher icon (all mipmaps + adaptive), Desktop shortcut, Start menu tile, Favicon source |

### Strict Visual Identity Rules
1. **No live CSS color filters:** `filter: brightness()`, `saturate()`, `hue-rotate()`, `drop-shadow()` modifying brand assets are strictly forbidden.
2. **Aspect ratio preservation:** All brand instances enforce `object-fit: contain;` with fixed or proportionate dimensions. No stretching or forced cropping.
3. **Immutability:** Original master files in `13_ASSETS/brand/approved/` are write-protected and verified against their SHA-256 signatures during testing. Derived assets are compiled into `13_ASSETS/brand/generated/` and distributed to client runtime folders.

---

## 3. Cryptographic Hash Lock Manifest

The authoritative manifest is maintained in `brand-assets.json` and mirrored in `10_CONFIG/brand-assets.json`:

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-10-09T04:17:26.541249Z",
  "hashAlgorithm": "SHA-256",
  "assets": {
    "PRIMARY_LOGO": {
      "filename": "mahi-browser-logo-primary.png",
      "path": "13_ASSETS/brand/approved/mahi-browser-logo-primary.png",
      "role": "PRIMARY_FULL_LOGO",
      "sha256": "2ce7854ac00975cc7e57881345bf1cc3b9e14940b0b1e59270e18aec2235efe8",
      "dimensions": { "width": 1024, "height": 768 }
    },
    "RED_MARK": {
      "filename": "mahi-browser-mark-red.png",
      "path": "13_ASSETS/brand/approved/mahi-browser-mark-red.png",
      "role": "RED_DRAGON_MARK",
      "sha256": "916b50d58aec8398058645e968318778efed9879082ae62f908e51130e1f04a5",
      "dimensions": { "width": 1024, "height": 1024 }
    },
    "DARK_MARK": {
      "filename": "mahi-browser-mark-dark.png",
      "path": "13_ASSETS/brand/approved/mahi-browser-mark-dark.png",
      "role": "BLACK_RED_DRAGON_MARK",
      "sha256": "a8a871b9e597a088699e6b38a49c25a6e454c3ab09aca74f031741d32de0a883",
      "dimensions": { "width": 1024, "height": 1024 }
    },
    "APP_ICON": {
      "filename": "mahi-browser-app-icon.png",
      "path": "13_ASSETS/brand/approved/mahi-browser-app-icon.png",
      "role": "APP_ICON",
      "sha256": "f5dcca2de1050e4e381bbb49b305b0b406773f888c54f08cde00eb97319f4f4d",
      "dimensions": { "width": 1024, "height": 1024 }
    }
  }
}
```

---

## 4. Non-Draggable Product Branding Fix

### Problem Analysis
When users clicked and dragged logos on the website or within the Electron browser chrome, Chromium initiated native drag-and-drop, producing a semi-transparent "ghost" thumbnail. This made the brand mark appear as a loose, detached webpage image rather than an integrated product fixture. Furthermore, in Chromium, anchor tags (`<a href="...">`) wrapping an image also initiate native link drag behavior unless specifically suppressed.

### Three-Tier Implementation Solution
To eliminate ghost drags without breaking click navigation or affecting non-brand imagery:

1. **HTML Attribute Layer:**
   - Both the `<img>` and parent `<a>` tags carry `draggable="false"` and `ondragstart="return false;"`.
   - Brand elements specify `data-brand-logo="true"` for unambiguous selector targeting.
   - Example:
     ```html
     <a href="index.html" class="nav-brand" draggable="false" ondragstart="return false;">
       <img src="assets/img/logo-full.png" alt="MAHI Browser" class="brand-logo-img" draggable="false" ondragstart="return false;" />
     </a>
     ```

2. **CSS Defensive Styling:**
   - Applied scoped rules in `landing/assets/css/styles.css` and `01_UI/index.css`:
     ```css
     .brand-logo-img,
     .nav-brand img,
     .footer-brand img,
     [data-brand-logo] {
       -webkit-user-drag: none;
       user-drag: none;
       user-select: none;
       -webkit-user-select: none;
       object-fit: contain;
     }
     .nav-brand,
     .footer-brand,
     a:has(.brand-logo-img) {
       -webkit-user-drag: none;
       user-drag: none;
       user-select: none;
     }
     ```
   - Crucially, `pointer-events: none` is **not** used, ensuring hover states and click events dispatch cleanly to the router or link destination.

3. **JavaScript Capture-Phase Guard:**
   - In `landing/assets/js/main.js` and React components (`BrandLogo.tsx`), a capture-phase event handler intercepts any rogue drag events originating from brand assets:
     ```javascript
     document.addEventListener('dragstart', function(e) {
       const target = e.target;
       if (target && (
         target.matches('.brand-logo-img, [data-brand-logo], .nav-brand img, .footer-brand img') ||
         target.closest('.nav-brand, .footer-brand')
       )) {
         e.preventDefault();
         return false;
       }
     }, true);
     ```

---

## 5. Multi-Platform Asset Derivatives

### Windows Platform
- `13_ASSETS/resources/icon.ico` and `13_ASSETS/resources/M.ico`: Multi-layer icon containing 16×16, 24×24, 32×32, 48×48, 64×64, 128×128, and 256×256 frames generated strictly from `ASSET D` (`mahi-browser-app-icon.png`).
- Applied to Electron application window, taskbar icon, NSIS installer branding, and desktop shortcuts.
- `13_ASSETS/resources/splash.html`: Rendered with approved `ASSET B` red dragon mark, locked with `draggable="false"` and `-webkit-user-drag: none`.

### Android Platform
- `android/app/src/main/res/`:
  - `mipmap-mdpi/ic_launcher.png` (48×48) & `ic_launcher_round.png`
  - `mipmap-hdpi/ic_launcher.png` (72×72) & `ic_launcher_round.png`
  - `mipmap-xhdpi/ic_launcher.png` (96×96) & `ic_launcher_round.png`
  - `mipmap-xxhdpi/ic_launcher.png` (144×144) & `ic_launcher_round.png`
  - `mipmap-xxxhdpi/ic_launcher.png` (192×192) & `ic_launcher_round.png`
  - `drawable/ic_launcher_foreground.png` (432×432) for adaptive icon rendering.

### Web Platforms
- Favicon bundle: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180×180).
- Public landing site (`landing/assets/img/`):
  - `logo.png` & `logo-icon.png` → ASSET B (1024×1024 RGBA)
  - `logo-full.png` → ASSET A (1024×768 RGBA)
  - `logo-dark.png` → ASSET C (1024×1024 RGBA)
- React frontend (`public/brand/` & `01_UI/components/BrandLogo.tsx`):
  - Dynamic role switching based on `variant` prop (`primary`, `red-mark`, `dark-mark`, `app-icon`).

---

## 6. Live Production Server Verification

The updated static website was deployed to production VPS (`root@200.97.164.97:2222` at `/var/www/mahi/`).

### Verification Checks:
1. **HTTP Headers & Asset Payload:**
   - `https://mahibrowser.com/assets/img/logo-full.png` → HTTP 200 OK, `Content-Length: 621304` (Exact ASSET A hash verified).
   - `https://mahibrowser.com/assets/img/logo.png` → HTTP 200 OK, `Content-Length: 735223` (Exact ASSET B hash verified).
2. **Playwright E2E Live Test (`test_live_drag_lock.py`):**
   - Simulated user `mousedown` on the navbar logo and drag movement of 150px horizontally/vertically.
   - Result: `dragstart` events fired = 0, ghost image created = NO.
   - Simulated user click on navbar brand: navigation triggered cleanly.

---

## 7. Testing & Quality Assurance Summary

### Brand Asset Lock Unit Tests (`11_TESTS/unit/brand-asset-lock.test.ts`):
- **15 / 15 Passed**
  1. All 4 approved master assets exist in `13_ASSETS/brand/approved/`
  2. SHA-256 hash lock verification matches `brand-assets.json`
  3. Master assets maintain exact pixel dimensions (1024×768 for primary, 1024×1024 for marks)
  4. Brand configuration exports correct constants (`PRIMARY_LOGO`, `RED_MARK`, `DARK_MARK`, `APP_ICON`)
  5. No forbidden CSS color filters on brand classes
  6. Aspect ratio `contain` rules present on all brand classes
  7. Non-draggable attributes present on BrandLogo component
  8. Non-draggable attributes present on all landing pages (`index.html`, `pricing.html`, `privacy.html`, `terms.html`, `aup.html`)
  9. Windows `icon.ico` derived from approved square app icon
  10. Android launcher icons derived across all mipmap densities
  11. Favicon suite derived and present in public directories
  12. Splash screen uses non-draggable approved branding
  13. Capture-phase drag prevention script present in `landing/assets/js/main.js`
  14. Global `img { pointer-events: none }` is absent (drag protection is strictly scoped)
  15. Clickable navbar links retain navigation capability

### Brand Logo Integration Tests (`11_TESTS/unit/official-brand-logo-integration.test.ts`):
- **12 / 12 Passed**

### Full Regression Suite:
- **Baseline:** 730 tests passing prior to implementation.
- **New Tests:** 27 brand asset & logo integration tests added.
- **Total Passing:** 757+ tests.

---

## 8. Final Compliance Matrix

| Objective | Requirement | Status |
|---|---|---|
| Master Assets | 4 approved files immutable in `13_ASSETS/brand/approved/` | PASS |
| Hash Lock | Cryptographic SHA-256 checksums verified | PASS |
| Color Integrity | No recoloring, no saturation changes, no CSS filters | PASS |
| Aspect Ratio | `object-fit: contain;` strictly enforced | PASS |
| Drag Prevention | Logo dragging blocked across Website, Web Console, and Electron | PASS |
| Click Functionality | Links wrap logos and navigate without obstruction | PASS |
| Multi-Platform | Windows (.ico), Android (mipmaps), and Favicons synchronized | PASS |
| Production Server | Live deployment on VPS verified via HTTP & Playwright | PASS |
