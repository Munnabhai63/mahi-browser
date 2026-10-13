# MAHI BROWSER — PHASE 12 PRODUCTION DEPLOYMENT
## REPORT 01: PRODUCTION PREFLIGHT & INFRASTRUCTURE FORENSICS

**Project:** MAHI Browser  
**Target Domain:** `https://mahibrowser.com`  
**Host IP:** `200.97.164.97` (Ubuntu 24.04 LTS, Kernel 6.8.0-138-generic)  
**Access Method:** Authorized SSH (Port 2222, Key: `~/.ssh/id_ed25519`, User: `root`)  
**Audit Mode:** Strict Read-Only Forensic Discovery  
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Lead DevOps Engineer  
**Status:** PREFLIGHT COMPLETE & VERIFIED  

---

### 1. Executive Preflight Summary

A direct, authorized, read-only preflight inspection was executed on the live production VPS to establish ground-truth infrastructure boundaries before formulating the Phase 12 deployment plan.

**Key Findings:**
1. **Multi-Tenant Server Environment:** The VPS hosts **9 other active, independent production applications and services** (Falcon SMM, Desisexy, GGsel, Rumble Traffic, Trafik, YTCPM, etc.). MAHI Browser changes must remain strictly isolated.
2. **Actual Web Root:** `/var/www/mahi` (owned by `www-data:www-data`).
3. **Actual Backend Service:** PM2 Process ID 45 (`mahi-admin`), script path `/opt/mahi-admin-panel/src/server.js`, listening on `http://127.0.0.1:4180` (Node.js 22.23.2).
4. **Actual SQLite Database:** `/opt/mahi-admin-panel/data/panel.db` (WAL mode, ~4.3MB including `-wal` and `-shm`), containing 31 registered user accounts and 26 active subscriptions/trials.
5. **Nginx Virtual Hosts:**
   - `/etc/nginx/sites-available/mahibrowser.com` (Public landing & customer portal)
   - `/etc/nginx/sites-available/admin.mahibrowser.com` (Isolated administrative portal)
6. **TLS Certificates:** Managed by Certbot (`/etc/letsencrypt/live/mahibrowser.com/fullchain.pem`).
7. **Existing Download Directory:** `/var/www/mahi/download/` containing a stale 91,032,673-byte build (`MAHI-Setup.exe`, SHA-256 `8692d0...`).

---

### 2. Multi-Tenant Service Boundary Mapping

To guarantee zero cross-project impact, all active PM2 services on `200.97.164.97` were inventoried:

| PM2 ID | Service Name | Status | Memory | Domain / Function | Isolation Rule |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **45** | `mahi-admin` | **ONLINE** | 82.6 MB | `admin.mahibrowser.com` & MAHI API (Port 4180) | **TARGET FOR MAHI DEPLOYMENT** |
| 29 | `falcon-backend` | ONLINE | 192.2 MB | `falcon-smm` (Port 5000) | **DO NOT TOUCH** |
| 42 | `desisexy-autopilot` | ONLINE | 86.3 MB | Worker service | **DO NOT TOUCH** |
| 43 | `desisexy-web` | ONLINE | 73.6 MB | `desisexy.in` | **DO NOT TOUCH** |
| 57 | `ggsel-web` | ONLINE | 328.5 MB | `ggsel.us` | **DO NOT TOUCH** |
| 60 | `rumble-seo-autopilot` | ONLINE | 123.6 MB | SEO worker | **DO NOT TOUCH** |
| 39 | `rumble-traffic-bot` | ONLINE | 83.2 MB | Traffic generator | **DO NOT TOUCH** |
| 40 | `rumble-traffic-hermes` | ONLINE | 142.4 MB | Queue processor | **DO NOT TOUCH** |
| 25 | `rumble-traffic-web` | ONLINE | 284.3 MB | `rumbletraffic.com` | **DO NOT TOUCH** |
| 31 | `rumble-traffic-worker` | ONLINE | 230.5 MB | Worker process | **DO NOT TOUCH** |
| 33 | `smm-panel-web` | ONLINE | 73.1 MB | Panel UI | **DO NOT TOUCH** |
| 34 | `smm-panel-worker` | ONLINE | 78.4 MB | Background tasks | **DO NOT TOUCH** |
| 1 | `trafik-backend` | ONLINE | 99.9 MB | `trafik-admin` / `user` | **DO NOT TOUCH** |
| 30 | `ytcpm` | ONLINE | 51.8 MB | `ytcpm.com` / `ytcpm.tech` | **DO NOT TOUCH** |
| 36 | `clipbot-worker` | ONLINE | 158.9 MB | Video processing | **DO NOT TOUCH** |

**Isolation Policy:** No global `pm2 restart all`, no global `pm2 kill`, no Docker commands, and no system-wide package changes. Only `pm2 reload mahi-admin` is authorized.

---

### 3. Nginx Virtual Host Analysis

Inspection of `/etc/nginx/sites-available/mahibrowser.com` revealed the exact mechanism behind the Phase 9 findings:

```nginx
    # 1. Exact static page matches exist for these:
    location = /signup { try_files /signup.html =404; }
    location = /login { try_files /login.html =404; }
    location = /book-demo { try_files /book-demo.html =404; }
    location = /download { try_files /download.html =404; }
    location = /pricing { try_files /pricing.html =404; }
    location = /terms { try_files /terms.html =404; }
    location = /privacy { try_files /privacy.html =404; }
    location = /aup { try_files /aup.html =404; }

    # 2. MISSING: location = /dashboard!
    # Therefore, requests to /dashboard fell through to:
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }
    # Serving /var/www/mahi/index.html (the marketing landing page)!

    # 3. Download protection logic:
    location /download/ {
        # Validates cookie, Authorization: Bearer, or ?token=
        # If missing, redirects 302 to /signup?intent=trial&returnUrl=/download
        alias /var/www/mahi/download/;
    }
    # Because it aliases /download/ to /var/www/mahi/download/,
    # /download/setup was looking for /var/www/mahi/download/setup (which does NOT exist)!
```

---

### 4. Root Causes Confirmed

| Confirmed Production Defect | Technical Root Cause Verified on VPS | Remediation Required |
| :--- | :--- | :--- |
| **1. `/dashboard` renders marketing page** | Missing `location = /dashboard { try_files /download.html =404; }` in Nginx | Add explicit Nginx route |
| **2. Authenticated `/download/setup` returns 404** | Nginx looks for non-existent file `/var/www/mahi/download/setup` | Add explicit `location = /download/setup` mapping to setup installer |
| **3. Outdated Installer on Server** | File on server is stale 91,032,673-byte build from Oct 9 | Upload approved 295,644,799-byte `MAHI-Browser-Setup-1.1.1.exe` |
| **4. `/api/v1/pricing/catalog` returns 404** | Endpoint not registered in `/opt/mahi-admin-panel/src/server.js` | Add catalog endpoint to `server.js` |
| **5. `/api/v2/*` returns 404** | Endpoints not registered in `server.js` | Add `/api/v2/health` & `/api/v2/distribution/info` |
| **6. Missing "Created by Munna Bhai"** | Server's `download.html` is older revision (Oct 10) | Deploy updated `download.html` with attribution & verified SHA-256 |

---

### 5. Verdict

Production infrastructure preflight is **100% complete**. All service boundaries, file paths, database locations, and root causes have been directly verified on the live system.
