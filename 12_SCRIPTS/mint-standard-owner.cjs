const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, 'mahi-browser', 'mahi_browser.sqlite');
  
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const bytes = crypto.randomBytes(16).toString('hex').toUpperCase();
  const rawKey = `MAHI-${bytes.substring(0, 4)}-${bytes.substring(4, 8)}-${bytes.substring(8, 12)}-${bytes.substring(12, 16)}`;
  const normalizedKey = rawKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const keyHash = crypto.createHash('sha256').update(normalizedKey).digest('hex');
  const keyMasked = `MAHI-****-****-${bytes.substring(12, 16)}`;
  
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const sqlQuery = 'INSERT INTO licenses (id, license_key_hash, key_masked, customer_name, account_id, status, duration_type, max_devices, starts_at, expires_at, created_at, created_by, revoked_at, last_validation_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  db.run(sqlQuery, [
    id,
    keyHash,
    keyMasked,
    'MAHI Master Owner (Lifetime Full Access)',
    'owner-primary',
    'ACTIVE',
    'LIFETIME',
    100,
    now,
    null,
    now,
    'MASTER_OWNER_MINT',
    null,
    now,
    'Master Owner Lifetime Enterprise Key'
  ]);

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('===STANDARD_KEY===');
  console.log(`KEY:${rawKey}`);
  console.log('===END===');
}

main().catch(console.error);
