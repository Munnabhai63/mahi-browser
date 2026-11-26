const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const os = require('os');

function resolveDatabasePath() {
  if (process.env.MAHI_DB_PATH) return process.env.MAHI_DB_PATH;
  const dataDir =
    process.env.MAHI_DATA_DIR ||
    (process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mahi-browser')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'mahi-browser')
        : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'mahi-browser'));
  return path.join(dataDir, 'mahi_browser.sqlite');
}

async function main() {
  const SQL = await initSqlJs();
  const dbPath = resolveDatabasePath();
  
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found at', dbPath);
    return;
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const bytes = crypto.randomBytes(16).toString('hex').toUpperCase();
  const rawKey = 'MAHI-OWNER-' + bytes.substring(0, 4) + '-' + bytes.substring(4, 8) + '-' + bytes.substring(8, 12);
  const normalizedKey = rawKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const keyHash = crypto.createHash('sha256').update(normalizedKey).digest('hex');
  const keyMasked = 'MAHI-OWNER-****-****-' + bytes.substring(8, 12);
  
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const sqlQuery = 'INSERT INTO licenses (id, license_key_hash, key_masked, customer_name, account_id, status, duration_type, max_devices, starts_at, expires_at, created_at, created_by, revoked_at, last_validation_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  db.run(sqlQuery, [
    id,
    keyHash,
    keyMasked,
    'MAHI Master Owner (Lifetime Enterprise)',
    'owner-master',
    'ACTIVE',
    'LIFETIME',
    100,
    now,
    null,
    now,
    'SUPER_ADMIN_MINT',
    null,
    now,
    'Master Owner Commercial Lifetime License Key'
  ]);

  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('===MASTER_KEY_RESULT===');
  console.log('KEY:' + rawKey);
  console.log('CUSTOMER:Master Owner (Lifetime Enterprise)');
  console.log('DEVICES:100 Seats');
  console.log('VALIDITY:LIFETIME (Permanent)');
  console.log('===END_RESULT===');
}

main().catch(console.error);
