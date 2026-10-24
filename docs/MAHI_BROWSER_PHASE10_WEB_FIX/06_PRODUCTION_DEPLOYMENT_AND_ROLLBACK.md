# MAHI BROWSER — PHASE 10
## 06. CONTROLLED DEPLOYMENT & ROLLBACK SPECIFICATION
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** READY FOR REVIEW — DEPLOYMENT NOT EXECUTED  

---

### 1. Proposed Production Nginx Configuration

On the VPS (`/etc/nginx/sites-available/mahibrowser.com`):

```nginx
# 1. Static Web Root
root /var/www/mahibrowser.com;
index index.html;

# 2. Public Static Pages
location / {
    try_files $uri $uri.html $uri/ /index.html;
}

# 3. Customer Dashboard Route (Serves download & account portal)
location = /dashboard {
    try_files /download.html =404;
}

# 4. Restrict Admin Console to Port 32123 with optional IP allowlist
location ~ ^/(admin|super-admin) {
    # allow 1.2.3.4; # Optional: Restrict to owner IP
    # deny all;
    proxy_pass http://127.0.0.1:32123;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 5. Direct Authenticated Downloads
location ~ ^/(download/setup|download/portable|download/MAHI-Setup.exe) {
    proxy_pass http://127.0.0.1:32123;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 600s;
}

# 6. Commercial & Platform APIs (/api/v1/* and /api/v2/*)
location ~ ^/(api/v1/|api/v2/) {
    proxy_pass http://127.0.0.1:32123;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

### 2. VPS File Staging & Permissions

1. Copy updated `landing/download.html` to `/var/www/mahibrowser.com/download.html`.
2. Upload `MAHI-Browser-Setup-1.1.1.exe` to `/var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe`.
3. Set `chmod 644 /var/www/mahibrowser.com/release/MAHI-Browser-Setup-1.1.1.exe`.
4. Run `nginx -t` to validate syntax.
5. Reload Nginx without downtime: `systemctl reload nginx`.

---

### 3. Immediate Rollback Procedure (<30 Seconds)

1. Keep a pre-deployment backup of `download.html` (`cp download.html download.html.bak`).
2. Keep a backup of Nginx configuration (`cp mahibrowser.com mahibrowser.com.bak`).
3. If any issue arises, restore the configuration and reload:
   ```bash
   cp /etc/nginx/sites-available/mahibrowser.com.bak /etc/nginx/sites-available/mahibrowser.com
   systemctl reload nginx
   ```
- Expected downtime: **0 seconds (Zero downtime)**.
