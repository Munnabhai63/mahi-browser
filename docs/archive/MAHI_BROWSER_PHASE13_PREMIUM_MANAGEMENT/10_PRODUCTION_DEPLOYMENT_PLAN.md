# MAHI BROWSER — PHASE 13 REPORT 10
## PRODUCTION DEPLOYMENT PLAN & RUNBOOK
### Pre-Flight Verification, Zero-Downtime Migration Steps, Smoke Testing & Rollback Safety

**Document:** `10_PRODUCTION_DEPLOYMENT_PLAN.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Target Environment:** Production VPS (`/opt/mahi-admin-panel/` on `admin.mahibrowser.com`)  
**Deployment Authorization Status:** STRICTLY NOT AUTHORIZED (Staging Verified Only)  
**Requirement for Execution:** Explicit Written Authorization from the Owner  

---

## 1. PRODUCTION DEPLOYMENT GOVERNANCE & GATES

In accordance with Phase 13 operational policy:
- **NO PRODUCTION DEPLOYMENT WAS EXECUTED DURING THIS PHASE.**
- The production server (`root@<VPS_HOST>:2222`), live database (`/opt/mahi-admin-panel/data/panel.db`), live Admin Panel (`https://admin.mahibrowser.com`), and real customer subscriptions remain 100% untouched.
- This runbook is prepared exclusively for future authorized execution following the owner's review.

---

## 2. PRE-DEPLOYMENT PREREQUISITES

Prior to initiating any production deployment window:
1. **Owner Sign-off:** Confirmation of review of all 11 Phase 13 reports.
2. **Maintenance Window:** Recommended duration: 5 minutes during low-traffic hours (e.g. 03:00 - 03:30 AM IST).
3. **SSH Access & Credentials:** Secured root access on port 2222 with validated key authentication.
4. **Active Client Safety:** Validate that desktop clients are actively polling without errors.

---

## 3. STEP-BY-STEP PRODUCTION DEPLOYMENT SEQUENCE

### Step 1: Immutable Cold Database Backup
Before touching any code or schemas, create an uncompressed timestamped cold backup of the production SQLite database:
```bash
# On VPS root:
mkdir -p /opt/mahi-admin-panel/backups/pre_p13_deployment
cp /opt/mahi-admin-panel/data/panel.db /opt/mahi-admin-panel/backups/pre_p13_deployment/panel_pre_p13_$(date +%Y%m%d_%H%M%S).db
cp /opt/mahi-admin-panel/data/panel.db-wal /opt/mahi-admin-panel/backups/pre_p13_deployment/ 2>/dev/null || true
cp /opt/mahi-admin-panel/data/panel.db-shm /opt/mahi-admin-panel/backups/pre_p13_deployment/ 2>/dev/null || true
```

### Step 2: Code Backup
Backup existing operational files:
```bash
tar -czf /opt/mahi-admin-panel/backups/pre_p13_deployment/code_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  /opt/mahi-admin-panel/src/ \
  /opt/mahi-admin-panel/public/
```

### Step 3: Deploy Remediated Source Files
Upload the verified Phase 13 files from `scratch/mahi-admin-panel/`:
- `src/account-service.js` -> `/opt/mahi-admin-panel/src/account-service.js`
- `src/server.js` -> `/opt/mahi-admin-panel/src/server.js`
- `src/auth-service.js` -> `/opt/mahi-admin-panel/src/auth-service.js`
- `public/index.html` -> `/opt/mahi-admin-panel/public/index.html`
- `public/app.js` -> `/opt/mahi-admin-panel/public/app.js`

### Step 4: Graceful Process Reload
Execute a zero-downtime cluster reload via PM2:
```bash
pm2 reload mahi-admin
# Or if single instance:
pm2 restart mahi-admin
```

Upon restart, `account-service.js` automatically detects the schema state, executes the `migratePhase13Schema` transaction, makes `expires_at` nullable, adds the required columns, and updates indexes.

---

## 4. POST-DEPLOYMENT SMOKE TEST VERIFICATION

Immediately execute the following verification curl commands on the VPS:

1. **Verify Health & Version:**
   ```bash
   curl -I https://admin.mahibrowser.com/
   ```
   *Expected: HTTP 200 OK*

2. **Verify Public Status Route (Crypto Invariant):**
   ```bash
   curl -s "http://127.0.0.1:4180/v1/account/status?hwid=TEST-HWID" -H "x-mahi-token: test"
   ```
   *Expected: HTTP 401 or valid signed payload (No 500 server crash)*

3. **Verify Database Integrity:**
   ```bash
   sqlite3 /opt/mahi-admin-panel/data/panel.db "PRAGMA integrity_check;"
   ```
   *Expected: `ok`*

4. **Verify Schema Columns:**
   ```bash
   sqlite3 /opt/mahi-admin-panel/data/panel.db "PRAGMA table_info(subscriptions);" | grep -E "is_lifetime|grant_category|idempotency_key"
   ```
   *Expected: All 3 columns present.*

---

## 5. EMERGENCY ROLLBACK PROCEDURE

If any unanticipated regression is observed:
1. **Restore Code:**
   ```bash
   tar -xzf /opt/mahi-admin-panel/backups/pre_p13_deployment/code_backup_*.tar.gz -C /
   ```
2. **Restore Database:**
   ```bash
   pm2 stop mahi-admin
   cp /opt/mahi-admin-panel/backups/pre_p13_deployment/panel_pre_p13_*.db /opt/mahi-admin-panel/data/panel.db
   pm2 start mahi-admin
   ```
3. **Verify Restoration:** Confirm panel is operational.
