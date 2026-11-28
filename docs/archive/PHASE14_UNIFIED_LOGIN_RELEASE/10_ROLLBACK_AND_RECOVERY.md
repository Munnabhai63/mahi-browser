# PHASE 14 — UNIFIED LOGIN RELEASE
## DOCUMENT 10: ROLLBACK AND RECOVERY PLAYBOOK

**Purpose:** Comprehensive, step-by-step procedure to instantly restore pre-deployment baseline in the event of an unforeseen production incident.  
**Recovery Time Objective (RTO):** < 60 seconds  
**Recovery Point Objective (RPO):** Zero customer data loss  

---

### 1. Production Rollback Procedure (VPS)

In the event of an emergency, execute the following commands on `<VPS_HOST>`:

```bash
# 1. Restore server.js from pre-deploy backup
cp /opt/mahi-admin-panel/backups/phase14_pre_deploy/server.js.bak /opt/mahi-admin-panel/src/server.js

# 2. Restore Nginx configuration
cp /opt/mahi-admin-panel/backups/phase14_pre_deploy/mahibrowser.com.nginx.bak /etc/nginx/sites-available/mahibrowser.com

# 3. Test and reload Nginx
nginx -t && systemctl reload nginx

# 4. Reload PM2 process
pm2 reload mahi-admin

# 5. Verify live status
curl -s https://mahibrowser.com/api/v2/health
```

*Note: Do not overwrite live customer database `panel.db` with old snapshots unless explicitly necessary for schema repair, as new user accounts created during operation would be lost.*

---

### 2. Desktop Client Rollback Procedure (Local Machine)

If the local machine requires rolling back from v1.1.2 to v1.1.1:

```powershell
# 1. Reinstall MAHI Browser v1.1.1
& "C:\Users\munaf\Desktop\mahai brouser\release\MAHI-Browser-Setup-1.1.1.exe" /S

# 2. If SQLite was corrupted, restore from backup:
Copy-Item "C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Backups\local_pre_upgrade_1.1.2\mahi_browser.sqlite.bak" "C:\Users\munaf\AppData\Roaming\mahi-browser\mahi_browser.sqlite" -Force
```

---

### 3. Backup Locations Inventory

| Component | Backup File Path | Host | Verified Date |
| :--- | :--- | :--- | :--- |
| **Backend Code** | `/opt/mahi-admin-panel/backups/phase14_pre_deploy/server.js.bak` | VPS (`<VPS_HOST>`) | 2026-10-13 |
| **Backend Nginx** | `/opt/mahi-admin-panel/backups/phase14_pre_deploy/mahibrowser.com.nginx.bak` | VPS (`<VPS_HOST>`) | 2026-10-13 |
| **Backend SQLite** | `/opt/mahi-admin-panel/backups/phase14_pre_deploy/panel.db.bak` | VPS (`<VPS_HOST>`) | 2026-10-13 |
| **Local SQLite** | `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Backups\local_pre_upgrade_1.1.2\mahi_browser.sqlite.bak` | Local Machine | 2026-10-14 |
| **Local Master Key** | `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\Backups\local_pre_upgrade_1.1.2\.mahi_master.key.bak` | Local Machine | 2026-10-14 |
| **Release Binaries** | `C:\Users\munaf\Desktop\mahai brouser\release\MAHI-Browser-Setup-1.1.1.exe` | Local Machine | 2026-10-13 |
