# MAHI BROWSER v1.1.3 — REAL PRODUCTION BASELINE
## Document: 01_REAL_PRODUCTION_BASELINE.md
**Project Path:** `C:\Users\munaf\Desktop\mahai brouser`  
**Production Server:** `<VPS_HOST>:2222` (Ubuntu 24.04 LTS x86_64, Kernel 6.8.0)  
**Domains:** `https://mahibrowser.com`, `https://admin.mahibrowser.com`  
**Date of Audit:** October 14, 2026 (03:15 UTC)

---

### 1. INITIAL MISMATCH INVESTIGATION & RECONNAISSANCE

An independent verification of `https://mahibrowser.com` revealed a divergence between prior completion assertions and the active production server:

1. **Health API Divergence:**
   - Endpoint: `https://mahibrowser.com/api/v2/health`
   - Initial Response: `{"status":"ok","version":"1.1.1","uptime":...}`
   - Expected Version: `1.1.3`
2. **Distribution API Divergence:**
   - Endpoint: `https://mahibrowser.com/api/v2/distribution/info`
   - Initial Response: Returned version `1.1.2`, package size `295625993`
   - Expected: `1.1.3`, package size `295622638`
3. **Download Routing Divergence:**
   - Endpoint: `https://mahibrowser.com/download/setup`
   - Initial HTTP Behavior: `HTTP 302 Found -> Location: /signup?intent=trial&returnUrl=/download`
   - Expected: `HTTP 200 OK` direct attachment download for all unauthenticated visitors.

---

### 2. FORENSIC ROOT CAUSE ANALYSIS

Direct SSH connection to `root@<VPS_HOST>:2222` identified the root causes:

1. **Omission of Remote Binary Deployment:**
   - The proposed `v1.1.3` installer was successfully compiled locally in `C:\Users\munaf\Desktop\mahai brouser\release\`.
   - The binary had **not** been transferred over SFTP/SCP to `/var/releases/mahibrowser/` on the remote VPS.
   - `/var/releases/mahibrowser/` contained only:
     - `MAHI-Browser-Setup-1.1.1.exe` (295,644,799 bytes)
     - `MAHI-Browser-Setup-1.1.2.exe` (295,625,993 bytes)
2. **Hardcoded Server Route Constraints:**
   - In `/opt/mahi-admin-panel/src/server.js`, line 2346 enforced:
     ```javascript
     const user = getSessionUser(req);
     if (!user) {
       return res.redirect('/signup?intent=trial&returnUrl=/download');
     }
     ```
   - It also hardcoded `targetBinary = 'MAHI-Browser-Setup-1.1.2.exe'` and `version: '1.1.2'` in distribution metadata.
3. **Landing Page Interceptor:**
   - In `/var/www/mahi/assets/js/main.js`, `initDownloadTriggers()` intercepted download clicks for unauthenticated visitors and redirected them:
     ```javascript
     if (!token) {
       e.preventDefault();
       window.location.href = '/download';
       return;
     }
     ```
   - This prevented direct downloads from the landing page.

---

### 3. EFFECTIVE PRODUCTION INFRASTRUCTURE BASELINE

- **Web Server / Reverse Proxy:** Nginx 1.24.0
  - Configuration: `/etc/nginx/sites-available/mahibrowser.com`
  - Routes `/download/setup` to local Node.js port 4180
  - Implements internal offloading via `X-Accel-Redirect` to `/var/releases/mahibrowser/`
- **Application Process:** Node.js (v20 LTS via PM2)
  - Process Name: `mahi-admin` (PID: 3606529)
  - Working Directory: `/opt/mahi-admin-panel`
- **Database Engine:** SQLite 3 (WAL mode)
  - Database Path: `/opt/mahi-admin-panel/data/panel.db`
  - Pre-Deployment Record Counts:
    - `users`: 16
    - `subscriptions`: 20
    - `licenses`: 2
    - `cloud_profiles`: 5
    - `sessions`: 31
- **Unrelated VPS Applications:** 15 active PM2 instances (`falcon-backend`, `rumble-traffic-web`, `desisexy-web`, `traffic-backend`, etc.) — all verified operational prior to intervention.
