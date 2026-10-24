# MAHI BROWSER PRODUCTION DEPLOYMENT REPORT

**Date:** 2026-10-07  
**Live Production URL:** [https://mahibrowser.com](https://mahibrowser.com)  
**Direct Installer Download URL:** [https://mahibrowser.com/download/MAHI-Setup.exe](https://mahibrowser.com/download/MAHI-Setup.exe)  
**Server IP:** `200.97.164.97` (Ubuntu 24.04 LTS)  
**Status:** **DEPLOYMENT COMPLETE & 100% VERIFIED**

---

## 1. Executive Summary

MAHI BROWSER has been successfully deployed to production on your existing multi-tenant VPS without disrupting any existing project or container.

- **Zero Outage:** All pre-existing projects (`desisexy.in`, `falcon-smm`, `rumbletraffic.com`, `ytcpm.com`, `ytcpm.tech`, `trafik-admin/user`, `m4k-cobalt-api`, `smm-panel`, Docker databases) remain 100% operational with identical response codes.
- **Zero Modification to Existing Configs:** Existing Nginx configurations and firewall rules were 100% untouched.
- **SSL / TLS Active:** Let's Encrypt certificates issued and active for both `mahibrowser.com` and `www.mahibrowser.com`.
- **Verified Download:** Binary installer size (90,936,073 bytes) and MD5 checksum (`1CFC97F97E388E19506E1A1CF2D0DFD5`) verified byte-for-byte on the live server.

---

## 2. DNS Verification

```text
Command: dig +short mahibrowser.com @8.8.8.8
Output:  200.97.164.97

Command: dig +short www.mahibrowser.com @8.8.8.8
Output:  mahibrowser.com. -> 200.97.164.97
```

---

## 3. Deployment Steps & Actions Taken

### 3.1 Safety Backup
- Backup archive created: `/root/nginx_backup_20261007.tar.gz`

### 3.2 Web Root & Permissions
- Web directory: `/var/www/mahi`
- Installer directory: `/var/www/mahi/download`
- Ownership: `www-data:www-data` (chmod 755/644)

### 3.3 Production Landing Page
- File: `/var/www/mahi/index.html` (30 KB)
- Single-file standalone HTML/CSS with modern dark aesthetics, responsive layout, Hindi + English copy, pricing table (Free 15 vs Pro ₹599/yr), UPI + WhatsApp purchasing guide, anti-detect FAQ, and direct installer download button.

### 3.4 Production Installer Binary
- Source: `release/MAHI BROWSER-1.0.0-Setup.exe`
- Target: `/var/www/mahi/download/MAHI-Setup.exe`
- Verification:
  - Size: `90,936,073` bytes
  - MD5: `1cfc97f97e388e19506e1a1cf2d0dfd5`

### 3.5 Isolated Nginx Virtual Host
- Config file: `/etc/nginx/sites-available/mahibrowser.com`
- Symlink: `/etc/nginx/sites-enabled/mahibrowser.com`
- Routing:
  - Gzip compression enabled for HTML, CSS, JS, SVG, and JSON.
  - Windows installer served with `application/octet-stream` and `Content-Disposition: attachment; filename="MAHI-Setup.exe"`.
  - HTTP $\rightarrow$ HTTPS 301 redirection.
  - `www.mahibrowser.com` $\rightarrow$ `https://mahibrowser.com` 301 apex redirection.

### 3.6 Automated SSL via Certbot
- Command: `certbot --nginx -d mahibrowser.com -d www.mahibrowser.com`
- Certificate path: `/etc/letsencrypt/live/mahibrowser.com/fullchain.pem`
- Key path: `/etc/letsencrypt/live/mahibrowser.com/privkey.pem`
- Issuer: Let's Encrypt (CN = YE2)
- Expiration: 2027-01-05 (Automatic renewal configured in systemd timer)

---

## 4. Phase 3 Verification Outputs

### 4.1 HTTPS Landing Page
```text
$ curl.exe -I https://mahibrowser.com
HTTP/1.1 200 OK
Server: nginx
Date: Wed, 07 Oct 2026 02:39:05 GMT
Content-Type: text/html
Content-Length: 30242
Last-Modified: Wed, 07 Oct 2026 02:29:53 GMT
Connection: keep-alive
Vary: Accept-Encoding
ETag: "6ac5aea1-7622"
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Accept-Ranges: bytes
```

### 4.2 HTTPS Installer Download
```text
$ curl.exe -I https://mahibrowser.com/download/MAHI-Setup.exe
HTTP/1.1 200 OK
Server: nginx
Date: Wed, 07 Oct 2026 02:39:05 GMT
Content-Type: application/octet-stream
Content-Length: 90936073
Last-Modified: Wed, 07 Oct 2026 02:30:41 GMT
Connection: keep-alive
ETag: "6ac5aed1-56b9309"
Content-Disposition: attachment; filename="MAHI-Setup.exe"
Cache-Control: public, max-age=3600
Accept-Ranges: bytes
```

### 4.3 Redirect Verification
- **HTTP $\rightarrow$ HTTPS:**
  ```text
  $ curl.exe -I http://mahibrowser.com
  HTTP/1.1 301 Moved Permanently
  Location: https://mahibrowser.com/
  ```
- **WWW $\rightarrow$ Apex:**
  ```text
  $ curl.exe -I http://www.mahibrowser.com
  HTTP/1.1 301 Moved Permanently
  Location: https://www.mahibrowser.com/

  $ curl.exe -I https://www.mahibrowser.com
  HTTP/1.1 301 Moved Permanently
  Location: https://mahibrowser.com/
  ```

### 4.4 SSL Certificate Verification
```text
issuer=C = US, O = Let's Encrypt, CN = YE2
subject=CN = mahibrowser.com
notBefore=Oct  7 01:34:46 2026 GMT
notAfter=Jan  5 01:34:45 2027 GMT
```

---

## 5. Critical Coexistence Audit (All Existing Projects)

All pre-existing projects from the Reconnaissance inventory were audited before and after deployment:

| Project / Service | Port / Protocol | Target / URL | Before Status | After Status | Result |
|---|---|---|---|---|---|
| **desisexy.in** | 443 / HTTPS | `https://desisexy.in/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **ytcpm.com** | 443 / HTTPS | `https://ytcpm.com/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **ytcpm.tech** | 443 / HTTPS | `https://ytcpm.tech/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **rumbletraffic.com** | 443 / HTTPS | `https://rumbletraffic.com/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **smm-panel-web** | 3000 / HTTP | `http://127.0.0.1:3000/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **falcon-backend** | 5050 / HTTP | `http://127.0.0.1:5050/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **m4k-cobalt-api** | 9000 / HTTP | `http://127.0.0.1:9000/` | HTTP 200 | HTTP 200 | ✅ Healthy |
| **trafik-backend** | 3001 / HTTP | `http://127.0.0.1:3001/` | HTTP 404 (Live Express) | HTTP 404 (Live Express) | ✅ Healthy |
| **Docker Containers** | Internal / Bridges | 11 Containers | 11 Running | 11 Running | ✅ Healthy |
| **PM2 Process List** | Node Processes | 12 Processes | 12 Online | 12 Online | ✅ Healthy |
| **UFW Firewall** | 80, 443, 2222 | Allow In | Active | Active (Untouched) | ✅ Untouched |

---

## 6. How to Deploy Future Version Updates

Whenever a new build is packaged locally (`release/MAHI BROWSER-X.X.X-Setup.exe`):

1. **Upload the updated installer to the VPS:**
   ```powershell
   scp "release/MAHI BROWSER-1.0.0-Setup.exe" root@200.97.164.97:/var/www/mahi/download/MAHI-Setup.exe
   ```

2. **(Optional) If you edit `scratch/index.html`:**
   ```powershell
   scp "scratch/index.html" root@200.97.164.97:/var/www/mahi/index.html
   ```

No server restart or downtime is required!
