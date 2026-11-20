# MAHI BROWSER v1.1.3 — PRODUCTION DEPLOYMENT ACTIONS & BACKUPS
## Document: 05_DEPLOYMENT_ACTIONS_AND_BACKUPS.md
**Project Path:** `C:\Users\munaf\Desktop\mahai brouser`  
**Production Server:** `<VPS_HOST>:2222`  
**Deployment Date:** October 14, 2026

---

### 1. SAFETY BACKUPS CATALOG

Before applying any change to the live production server, full snapshots were captured to `/opt/mahi-admin-panel/backups/phase15_pre_deploy/`:

```
========================================================================================
LIVE FILE PATH                     BACKUP FILE LOCATION
========================================================================================
/opt/mahi-admin-panel/src/server.js /opt/mahi-admin-panel/backups/phase15_pre_deploy/server.js.bak
/etc/nginx/sites-available/mahibrowser.com /opt/mahi-admin-panel/backups/phase15_pre_deploy/nginx_mahibrowser.com.bak
/var/www/mahi/download.html        /opt/mahi-admin-panel/backups/phase15_pre_deploy/download.html.bak
/var/www/mahi/index.html           /opt/mahi-admin-panel/backups/phase15_pre_deploy/index.html.bak
/var/www/mahi/assets/js/main.js    /opt/mahi-admin-panel/backups/phase15_pre_deploy/main.js.bak
/opt/mahi-admin-panel/data/panel.db /opt/mahi-admin-panel/backups/phase15_pre_deploy/panel.db.bak (via SQLite backup)
========================================================================================
```

---

### 2. BINARY STAGING & RELEASES DEPLOYMENT

The following files were securely transferred over SCP to `/var/releases/mahibrowser/` and verified with `sha256sum`:

1. `MAHI-Browser-Setup-1.1.3.exe`
   - Size: 295,622,638 bytes
   - SHA-256: `6A0048AE40B93EF6C40171999FD006706332906E0B4A5FF5CF2689E107C21E61`
   - Permissions: `0644`, Owner: `root:www-data`
2. `MAHI-Browser-Portable-1.1.3.exe`
   - Size: 295,162,376 bytes
   - SHA-256: `F0F6770F907826EB06734DCCDEC5F8DF7C9CCD47F232998DA19BE2030BA96A7F`
   - Permissions: `0644`, Owner: `root:www-data`
3. `latest.yml`
   - Version: 1.1.3
   - Synced to `/var/releases/mahibrowser/latest.yml` and `/var/www/mahi/update/latest.yml`

---

### 3. BACKEND ROUTE & RUNTIME PATCHING

1. **Route Modification in `/opt/mahi-admin-panel/src/server.js`:**
   - Removed the unauthenticated 302 redirect on `/download/setup` and `/download/portable`.
   - Wired `X-Accel-Redirect` to serve `MAHI-Browser-Setup-1.1.3.exe` directly via Nginx.
   - Updated `/api/v2/health` to return `version: "1.1.3"`.
   - Updated `/api/v2/distribution/info` to return exact size `295622638` and SHA-256 checksum.
2. **PM2 Service Reload:**
   - Command: `pm2 restart mahi-admin --update-env`
   - Process PID: 3606529
   - Health Status: Online (0 CPU, 75.2 MB memory).

---

### 4. STATIC LANDING PAGE ENHANCEMENTS

1. **Direct Download Wireup:**
   - `/var/www/mahi/index.html` updated:
     - Hero CTA `#hero-download-btn` -> `href="/download/setup"`
     - Navbar CTA `#nav-btn-trial` -> `href="/download/setup"`
     - Mobile drawer button -> `href="/download/setup"`
     - Windows OS badges (hero & footer) -> `href="/download/setup"`
     - Bottom CTA banner -> `href="/download/setup"`
2. **JavaScript Click Interceptor Removal:**
   - In `/var/www/mahi/assets/js/main.js`, `initDownloadTriggers()` was modified to remove the redirect to `/download` for anonymous visitors, allowing the native browser download to start immediately.

---

### 5. INSTANT ROLLBACK RUNBOOK

If any issue arises during owner testing, rollback can be executed in under 30 seconds using the following SSH commands:

```bash
# 1. Restore previous server.js
cp /opt/mahi-admin-panel/backups/phase15_pre_deploy/server.js.bak /opt/mahi-admin-panel/src/server.js

# 2. Restart PM2 backend
pm2 restart mahi-admin --update-env

# 3. Restore static landing files
cp /opt/mahi-admin-panel/backups/phase15_pre_deploy/index.html.bak /var/www/mahi/index.html
cp /opt/mahi-admin-panel/backups/phase15_pre_deploy/main.js.bak /var/www/mahi/assets/js/main.js

# 4. Verify status
curl -s https://mahibrowser.com/api/v2/health
```
*(Rollback binaries `1.1.2` and `1.1.1` remain fully preserved on `/var/releases/mahibrowser/`)*.
