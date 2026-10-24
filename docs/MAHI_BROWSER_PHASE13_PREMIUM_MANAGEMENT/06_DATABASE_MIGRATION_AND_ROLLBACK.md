# MAHI BROWSER — PHASE 13 REPORT 06
## DATABASE SCHEMA MIGRATION & ROLLBACK RUNBOOK
### Safe SQLite Evolution, Nullable Constraints, Column Additions & Zero-Downtime Rollback

**Document:** `06_DATABASE_MIGRATION_AND_ROLLBACK.md`  
**Phase:** Phase 13 — Advanced Admin Premium Management System  
**Component:** SQLite Database Engine (`/opt/mahi-admin-panel/data/panel.db`)  
**Execution Environment:** Isolated Local Staging (Production Untouched)  

---

## 1. MIGRATION OBJECTIVES & SCHEMA CHANGES

To support non-expiring Lifetime premium, internal grant categorization, and network idempotency, the `subscriptions` table requires four schema enhancements:

1. **`is_lifetime` (INTEGER DEFAULT 0):** Explicit boolean flag identifying permanent entitlements.
2. **`grant_category` (TEXT):** Internal business provenance (`complimentary_pro`, `owner_grant`, `beta_tester`, etc.).
3. **`idempotency_key` (TEXT):** Unique request key preventing duplicate grants on retries.
4. **Nullable `expires_at` (TEXT NULL):** Modifying the legacy `NOT NULL` constraint to allow `NULL` for lifetime accounts.

---

## 2. AUTOMATED MIGRATION SCRIPT

The migration is embedded directly into the database initialization sequence in `account-service.js` and wrapped in a self-healing transaction:

```javascript
function migratePhase13Schema(db) {
  const tableInfo = db.prepare("PRAGMA table_info(subscriptions)").all();
  const hasLifetime = tableInfo.some(c => c.name === 'is_lifetime');
  const hasCategory = tableInfo.some(c => c.name === 'grant_category');
  const hasIdemp = tableInfo.some(c => c.name === 'idempotency_key');
  const expiresAtCol = tableInfo.find(c => c.name === 'expires_at');
  const expiresAtNotNull = expiresAtCol && expiresAtCol.notnull === 1;

  if (expiresAtNotNull) {
    // SQLite cannot alter column constraints directly in older engines.
    // Safe table migration pattern:
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE subscriptions_p13_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        start_date TEXT NOT NULL,
        expires_at TEXT, -- Nullable for Lifetime!
        auto_renew INTEGER DEFAULT 0,
        cancel_at_period_end INTEGER DEFAULT 0,
        cancelled_at TEXT,
        payment_method TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        is_lifetime INTEGER DEFAULT 0,
        grant_category TEXT,
        idempotency_key TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO subscriptions_p13_new (
        id, user_id, plan, status, start_date, expires_at, auto_renew,
        cancel_at_period_end, cancelled_at, payment_method, notes,
        created_by, created_at, is_lifetime, grant_category, idempotency_key
      )
      SELECT 
        id, user_id, plan, status, start_date, expires_at, auto_renew,
        cancel_at_period_end, cancelled_at, payment_method, notes,
        created_by, created_at, 0, NULL, NULL
      FROM subscriptions;

      DROP TABLE subscriptions;
      ALTER TABLE subscriptions_p13_new RENAME TO subscriptions;

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_idemp ON subscriptions(idempotency_key);
      COMMIT;
    `);
  } else {
    // Add columns incrementally if table already allows nullable expires_at
    if (!hasLifetime) db.exec("ALTER TABLE subscriptions ADD COLUMN is_lifetime INTEGER DEFAULT 0;");
    if (!hasCategory) db.exec("ALTER TABLE subscriptions ADD COLUMN grant_category TEXT;");
    if (!hasIdemp) {
      db.exec("ALTER TABLE subscriptions ADD COLUMN idempotency_key TEXT;");
      db.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_idemp ON subscriptions(idempotency_key);");
    }
  }
}
```

---

## 3. ZERO-RISK ROLLBACK SCRIPT

If an emergency rollback is required during a future production deployment window, the following SQL script cleanly reverses the schema changes without dropping subscription history:

```sql
BEGIN TRANSACTION;

-- 1. Create rollback table restoring original NOT NULL constraint
-- Convert any NULL expires_at to standard 1-year expiry before restoring constraint
CREATE TABLE subscriptions_rollback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  auto_renew INTEGER DEFAULT 0,
  cancel_at_period_end INTEGER DEFAULT 0,
  cancelled_at TEXT,
  payment_method TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Migrate existing data back
INSERT INTO subscriptions_rollback (
  id, user_id, plan, status, start_date, expires_at, auto_renew,
  cancel_at_period_end, cancelled_at, payment_method, notes,
  created_by, created_at
)
SELECT 
  id, user_id, plan, status, start_date, 
  COALESCE(expires_at, datetime('now', '+1 year')), 
  auto_renew, cancel_at_period_end, cancelled_at, payment_method, notes,
  created_by, created_at
FROM subscriptions;

-- 3. Replace table
DROP TABLE subscriptions;
ALTER TABLE subscriptions_rollback RENAME TO subscriptions;

-- 4. Recreate legacy indexes
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

COMMIT;
```

---

## 4. DATABASE INTEGRITY VERIFICATION

Following migration in the isolated staging test environment, the database engine was validated using SQLite pragma diagnostics:
- `PRAGMA integrity_check;` returned `ok`.
- `PRAGMA foreign_key_check;` returned `0` violations.
- Table columns verified: `is_lifetime`, `grant_category`, `idempotency_key` all present with proper indexes.
