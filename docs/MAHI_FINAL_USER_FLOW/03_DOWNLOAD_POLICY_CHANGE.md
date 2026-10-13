# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 03: Website Direct Public Download Policy Change

**Date:** October 14, 2026  
**Component:** Website Landing Page & Distribution Routes  
**Production Status:** Staged (Deployment requires separate explicit owner approval)

---

### 1. Objective

Allow any visitor on `https://mahibrowser.com` to download the verified Windows installer directly without an account gate, trial activation hurdle, or dashboard redirect.

---

### 2. Website Route Architecture & Routing Strategy

#### Direct Download Routes:
- Primary Link: `https://mahibrowser.com/download/setup`
- Direct Static Release: `https://mahibrowser.com/releases/MAHI-Browser-Setup-1.1.2.exe`
- Version Manifest: `https://mahibrowser.com/releases/latest.yml`

#### Changes Prepared for Website:
1. **Hero Section Download CTA:**
   - Instead of routing to `/auth/signup?redirect=/download`, the "Download for Windows" CTA points directly to `/download/setup`.
2. **Auto-Detection & Fallback:**
   - Detects Windows OS (x64 / arm64) and serves `MAHI-Browser-Setup-1.1.2.exe`.
   - Displays a clean secondary "Download Started! Need help installing?" modal with clear 3-step instructions:
     1. Open the downloaded `.exe` file.
     2. Follow the Windows installation prompt.
     3. Launch MAHI Browser and sign in to get started.

---

### 3. Nginx Server Configuration Staged

In `10_CONFIG/infrastructure/nginx-production.conf`, the direct download block is verified:

```nginx
location /download/setup {
    alias /var/www/mahibrowser.com/releases/MAHI-Browser-Setup-1.1.2.exe;
    default_type application/octet-stream;
    add_header Content-Disposition 'attachment; filename="MAHI-Browser-Setup-1.1.2.exe"';
    add_header Cache-Control "public, max-age=3600";
}
```

---

### 4. Safety & Production Protection

- **No live server modifications have been made without explicit authorization.**
- The static files and Nginx configuration snippets are prepared in the repository for review and staged deployment.
