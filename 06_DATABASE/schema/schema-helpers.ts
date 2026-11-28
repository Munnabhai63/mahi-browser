import { getDatabase, type SqliteWrapper } from '../connection.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';

const log = createLogger('db-schema');

export function tableExists(db: SqliteWrapper, tableName: string): boolean {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

export function columnExists(db: SqliteWrapper, tableName: string, columnName: string): boolean {
  try {
    if (!tableExists(db, tableName)) return false;
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return columns.some((c) => c.name.toLowerCase() === columnName.toLowerCase());
  } catch {
    return false;
  }
}

export function addColumnIfNotExists(db: SqliteWrapper, tableName: string, columnName: string, columnDef: string): void {
  if (tableExists(db, tableName) && !columnExists(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

export function runMigration(db: SqliteWrapper, version: number, name: string, fn: () => void): void {
  const check = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
  if (check) return;

  const spName = `mig_${version}`;
  db.exec(`SAVEPOINT ${spName}`);
  try {
    fn();
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      version,
      new Date().toISOString()
    );
    db.exec(`RELEASE SAVEPOINT ${spName}`);
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${spName}`);
      db.exec(`RELEASE SAVEPOINT ${spName}`);
    } catch (rbErr) {
      log.warn('SQLite migration savepoint rollback failed', {
        version,
        name,
        spName,
        err: rbErr instanceof Error ? rbErr.message : String(rbErr),
      });
    }
    log.error(`[MIGRATION] Migration v${version} (${name}) failed and was rolled back`, {
      version,
      name,
      err: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function getAppSchemaVersion(db?: SqliteWrapper): number {
  try {
    const conn = db || getDatabase();
    const row = conn.prepare('SELECT MAX(version) as ver FROM app_schema_version').get() as
      | { ver?: number | null }
      | undefined;
    return Number(row?.ver || 0);
  } catch {
    return 0;
  }
}

export function stampAppSchemaVersion(db: SqliteWrapper, version: number): void {
  const existing = db
    .prepare('SELECT version FROM app_schema_version WHERE version = ?')
    .get(version);
  if (!existing) {
    db.prepare('INSERT INTO app_schema_version (version, appliedAt) VALUES (?, ?)').run(
      version,
      new Date().toISOString()
    );
  }
}
