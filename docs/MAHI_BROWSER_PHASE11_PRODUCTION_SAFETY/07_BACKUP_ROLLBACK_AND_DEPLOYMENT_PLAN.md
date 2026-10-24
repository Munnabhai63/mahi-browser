# MAHI BROWSER — PHASE 11 PRODUCTION SAFETY GATE
## REPORT 07: BACKUP, ROLLBACK & CONTROLLED DEPLOYMENT PLAN

**Project:** `C:\Users\munaf\Desktop\mahai brouser`  
**Target Domain:** `https://mahibrowser.com`  
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous DevOps & Site Reliability Lead  
**Status:** READY FOR OPERATIONAL REVIEW  

---

### 1. Scope & Risk Analysis of Required Production Changes

In accordance with Task 10, each necessary production modification is itemized below alongside its risk level, blast radius, and preventive mitigation:

| # | Action Required | Affected System | Risk Level | Blast Radius | Mitigation & Safe Procedure |
| :-: | :--- | :--- | :---: | :--- | :--- |
| **1** | **Upload 282 MB Installer** | Filesystem (`/var/www/mahibrowser.com/release/`) | **LOW** | Isolated to installer download path | Upload via SFTP/SCP. Check sha256sum matches `562F70...62621F`. Set permissions `644`. |
| **2** | **Deploy Updated `download.html`** | Web Root (`/var/www/mahibrowser.com/download.html`) | **LOW** | `/download` and `/dashboard` pages | Take atomic backup `download.html.bak`. Overwrite file. Zero impact on root landing page. |
| **3** | **Update Nginx Virtual Host** | `/etc/nginx/sites-available/mahibrowser.com` | **MEDIUM** | Entire domain routing | Take backup `mahibrowser.com.bak`. Test syntax with `nginx -t` before reload. If syntax fails, abort without reloading. |
| **4** | **Synchronize Backend Node.js Code** | Application Server (`/var/www/mahibrowser-backend/`) | **MEDIUM** | API routes & auth | Pre-backup backend folder & SQLite DB. Deploy updated router & app code. Gracefully reload via `pm2 reload`. |
| **5** | **Rotate Admin Environment Secrets** | `.env` on Application Server | **MEDIUM** | Admin access only | Generate fresh 32-char high-entropy keys. Standard customer auth is unaffected. |

---

### 2. Pre-Deployment Backup Checklist

Before initiating any change on the production server, execute the following atomic backup routine:

```bash
# 1. Create timestamped backup repository
BACKUP_DIR="/var/backups/mahibrowser/pre_phase11_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 2. Backup Nginx configuration
cp /etc/nginx/sites-available/mahibrowser.com "$BACKUP_DIR/mahibrowser.com.nginx.bak"

# 3. Backup Web Root HTML & Static Files
tar -czf "$BACKUP_DIR/web_root_static.tar.gz" -C /var/www/mahibrowser.com .

# 4. Backup Backend Application Code
tar -czf "$BACKUP_DIR/backend_source.tar.gz" -C /var/www/mahibrowser-backend .

# 5. Backup SQLite Database & Auth Sessions
cp /var/www/mahibrowser-backend/data/*.db "$BACKUP_DIR/" 2>/dev/null || true

echo "✓ Full pre-deployment backup successfully archived to $BACKUP_DIR"
```

---

### 3. Step-by-Step 3-Stage Controlled Deployment Pipeline

#### Stage 1: Static Assets & Installer Upload (Zero Downtime)
1. Upload local `landing/download.html` to `/var/www/mahibrowser.com/download.html`.
2. Ensure directory exists: `mkdir -p /var/www/mahibrowser.com/release/`.
3. Upload `C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe` to `/var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe`.
4. Run checksum verification on VPS:
   ```bash
   sha256sum /var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe
   # Expected Output: 562f70075f6b5ed7b8bbf2ff270d7ff36ae45a53559c020c39429784ec62621f
   chmod 644 /var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe
   ```

#### Stage 2: Backend Code Deployment & Graceful Reload
1. Deploy updated `07_BACKEND/` files (`app.ts`, `commercial-api-router.ts`, `web-admin-html.ts`, `super-admin-html.ts`).
2. Build typescript if production uses compiled dist: `npm run build`.
3. Perform zero-downtime process reload:
   ```bash
   pm2 reload mahibrowser-backend --update-env
   ```
4. Verify backend health:
   ```bash
   curl -s http://127.0.0.1:32123/api/v1/updates/check | grep "success"
   ```

#### Stage 3: Nginx Configuration Update & Worker Reload
1. Copy updated configuration to `/etc/nginx/sites-available/mahibrowser.com`.
2. Validate syntax:
   ```bash
   sudo nginx -t
   ```
   *CRITICAL: If output is anything other than `syntax is ok`, DO NOT PROCEED.*
3. Execute atomic worker reload:
   ```bash
   sudo systemctl reload nginx
   ```

---

### 4. Immediate Atomic Rollback Procedure (<30 Seconds)

If any unexpected regression, 502 error, or customer-facing defect occurs:

```bash
# RECOVERY PLAYBOOK: Restore to Last Stable Checkpoint (<30 seconds)

# Step 1: Restore Nginx configuration
cp "$BACKUP_DIR/mahibrowser.com.nginx.bak" /etc/nginx/sites-available/mahibrowser.com
nginx -t && systemctl reload nginx

# Step 2: Restore Web Root
tar -xzf "$BACKUP_DIR/web_root_static.tar.gz" -C /var/www/mahibrowser.com/

# Step 3: Restore Backend Code
tar -xzf "$BACKUP_DIR/backend_source.tar.gz" -C /var/www/mahibrowser-backend/
pm2 reload mahibrowser-backend

echo "✓ Full rollback complete. Production restored to pre-deployment baseline."
```
- **Total Duration to Rollback:** Under 30 seconds.
- **Estimated Service Interruption:** 0 seconds.

---

### 5. Post-Deployment Verification Checklist

Immediately following deployment, run the following automated smoke tests against the live domain:

- [ ] `GET https://mahibrowser.com/` -> Returns HTTP 200 OK (marketing page intact).
- [ ] `GET https://mahibrowser.com/pricing` -> Returns HTTP 200 OK.
- [ ] `GET https://mahibrowser.com/api/v1/pricing/catalog` -> Returns HTTP 200 OK with 4 active plans.
- [ ] `GET https://mahibrowser.com/dashboard` -> Returns HTTP 200 OK (renders Auth Gate for anonymous visitors).
- [ ] `GET https://mahibrowser.com/download/setup` -> Returns HTTP 302 redirect to signup.
- [ ] `POST https://mahibrowser.com/api/v1/auth/signup` -> Returns HTTP 201 Created and mints JWT.
- [ ] `GET https://mahibrowser.com/dashboard?token=...` -> Returns Customer Portal with 7-day trial countdown.
- [ ] `GET https://mahibrowser.com/download/setup?token=...` -> Initiates binary download stream with exact 295,644,799 bytes.
- [ ] `GET https://mahibrowser.com/api/v1/admin/dashboard` -> Returns HTTP 403 Forbidden to regular customer JWT.
- [ ] `GET https://mahibrowser.com/admin` -> Restriced by IP or requires admin credentials.
