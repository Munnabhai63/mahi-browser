# MAHI BROWSER — PHASE 9 MASTER AUDIT
## 10. SAFE PRODUCTION DEPLOYMENT & READINESS PLAN
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** PROPOSAL ONLY — STRICTLY NO EXECUTION PERFORMED  
**Deployment Authorization:** NOT GRANTED (Requires Explicit Owner Approval)  

---

### 1. Deployment Scope & Partitioning

To guarantee zero downtime and eliminate regression risk, deployment must be partitioned into three independent stages:

```
+-----------------------------------+     +-----------------------------------+     +-----------------------------------+
|      STAGE 1: STATIC ASSETS       | --> |      STAGE 2: NGINX ROUTING       | --> |      STAGE 3: INSTALLER BINARY    |
| (Zero risk, instant rollback)     |     | (Unlocks dashboard & APIs)        |     | (Enables public downloads)        |
+-----------------------------------+     +-----------------------------------+     +-----------------------------------+
```

---

### 2. Stage 1: Static Marketing Website Deployment

- **Source Directory:** `landing/`
- **Target Files:**
  - `landing/download.html` (Adds *"Created by Munna Bhai"*, 282 MB size, v1.1.1 RC1 designation)
  - `landing/sitemap.xml` (Expanded sitemap)
- **Deployment Mechanism:** Atomic copy to production web root (`/var/www/mahibrowser.com/`).
- **Database Migrations:** None.
- **Rollback Procedure:** Retain backup copy (`cp download.html download.html.bak`). Rollback takes <5 seconds.
- **Pre-Conditions:** None.

---

### 3. Stage 2: Nginx Reverse Proxy & Dashboard Routing

- **Configuration Target:** `/etc/nginx/sites-available/mahibrowser.com`
- **Required Modifications:**
  1. Add reverse proxy location for `/dashboard` and `/admin`:
     ```nginx
     location ~ ^/(dashboard|admin|super-admin) {
         proxy_pass http://127.0.0.1:32123;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```
  2. Route `/api/v2/` to port 32123 alongside `/api/v1/`.
- **Validation Check:** Run `nginx -t` before reloading.
- **Service Restart:** Zero-downtime reload (`systemctl reload nginx`).
- **Rollback Procedure:** Restore previous Nginx configuration file and reload.

---

### 4. Stage 3: Desktop Download Distribution Deployment

- **Source Artifact:** `C:\Users\munaf\Desktop\MAHI_BROWSER_UPGRADE_INSTALLER\MAHI-Browser-Setup-1.1.1.exe` (282 MB).
- **Target Location on VPS:** `/var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe` (aliased to `MAHI-Setup.exe`).
- **Integrity Verification:** Calculate SHA-256 on VPS after upload; assert match against `562f70075f6b5ed7b8bbf2ff270d7ff36ae45a53559c020c39429784ec62621f`.
- **Rollback Procedure:** Delete or point symlink back to prior release artifact.

---

### 5. Gates Requiring Explicit Owner Approval

| Action | Impact | Requires Explicit Approval |
|---|---|---|
| Uploading 282 MB installer binary to VPS | Bandwidth & disk consumption on server | **YES** |
| Modifying VPS Nginx configuration file | Modifies web routing | **YES** |
| Overwriting production `download.html` | Public website branding change | **YES** |
| Launching backend PM2 process for port 32123 | Memory footprint on VPS | **YES** |
