import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import {
  getConfigBackupsDir,
  getDbBackupsDir,
  getWritableUserDataDir,
} from '../07_BACKEND/utils/runtime-paths.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('db-connection');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let currentDbPath: string | null = null;
let transactionDepth = 0;
let isSaving = false;
let savePending = false;
let saveTimeout: NodeJS.Timeout | null = null;
let exitHookRegistered = false;

function registerProcessExitFlush(): void {
  if (exitHookRegistered) return;
  exitHookRegistered = true;

  const onExit = () => {
    try {
      flushDatabaseToDisk();
    } catch (err) {
      log.warn('SQLite flush failed during process exit', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  };

  process.on('beforeExit', onExit);
  process.on('SIGINT', () => {
    onExit();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    onExit();
    process.exit(143);
  });
}

export function isTestRunnerEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.VITEST_WORKER_ID) ||
    Boolean(process.env.JEST_WORKER_ID)
  );
}

export function assertPathIsNotProduction(targetPath: string): void {
  const norm = targetPath.toLowerCase().replace(/\\/g, '/');
  if (
    norm.includes('/appdata/roaming/mahi-browser') ||
    norm.includes('/appdata/local/programs/mahi browser') ||
    norm.includes('/library/application support/mahi-browser') ||
    norm.includes('/.config/mahi-browser') ||
    norm.includes('/.local/share/mahi-browser') ||
    norm.includes('/var/lib/mahibrowser')
  ) {
    throw new Error(
      `[GLOBAL TEST SAFETY GUARD VIOLATION] Automated tests must NEVER target production user database! Attempted path: "${targetPath}". Please use setCustomDatabasePath(...) with an isolated test directory or let the safety guard route to temporary storage.`
    );
  }
}

export function getDatabasePath(): string {
  if (currentDbPath) {
    if (isTestRunnerEnvironment()) {
      assertPathIsNotProduction(currentDbPath);
    }
    return currentDbPath;
  }

  // GLOBAL TEST SAFETY GUARD:
  // If running inside automated test runner and no custom path was explicitly bound,
  // automatically route to an isolated, disposable directory under .mahi_data/test-auto-isolated
  if (isTestRunnerEnvironment()) {
    const workerId = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID || 'isolated';
    const testDir = path.join(process.cwd(), '.mahi_data', 'test-auto-isolated');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    currentDbPath = path.join(testDir, `mahi_test_worker_${workerId}_${process.pid}.sqlite`);
    return currentDbPath;
  }

  const userDataDir = getWritableUserDataDir();
  currentDbPath = path.join(userDataDir, 'mahi_browser.sqlite');
  return currentDbPath;
}

export function setCustomDatabasePath(dbPath: string): void {
  if (isTestRunnerEnvironment()) {
    assertPathIsNotProduction(dbPath);
  }
  if (dbInstance) {
    try {
      flushDatabaseToDisk();
      dbInstance.close();
    } catch (err) {
      log.debug('Previous SQLite instance close skipped during path switch', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    dbInstance = null;
  }
  currentDbPath = dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function initSqlEngine(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => {
        try {
          const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
          if (process && resourcesPath) {
            const resPath = path.join(resourcesPath, file);
            if (fs.existsSync(resPath)) return resPath;
          }
          if (typeof __dirname !== 'undefined') {
            const dirWasm = path.join(__dirname, file);
            if (fs.existsSync(dirWasm)) return dirWasm;
          }
          const nmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
          if (fs.existsSync(nmPath)) return nmPath;
        } catch (err) {
          log.debug('sql.js wasm locateFile probe skipped', {
            file,
            err: err instanceof Error ? err.message : String(err),
          });
        }
        return file;
      }
    });
  }
  registerProcessExitFlush();
  return SQL;
}

export function saveDatabaseToDisk(): void {
  if (!dbInstance || transactionDepth > 0) return;
  if (isSaving) {
    savePending = true;
    return;
  }
  isSaving = true;
  let tmpPath: string | null = null;
  let fd: number | null = null;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Atomic write pattern: write to tmp file with fsync, then atomic rename (with transient Windows EPERM/EBUSY retry)
    tmpPath = `${dbPath}.tmp.${process.pid}.${Date.now()}`;
    fd = fs.openSync(tmpPath, 'w');
    fs.writeSync(fd, buffer);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    let renameErr: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        fs.renameSync(tmpPath, dbPath);
        renameErr = null;
        break;
      } catch (err: unknown) {
        renameErr = err;
        const code = (err as NodeJS.ErrnoException | null)?.code;
        if (err && (code === 'EPERM' || code === 'EBUSY') && attempt < 3) {
          const until = Date.now() + 25 * (attempt + 1);
          while (Date.now() < until) {}
          continue;
        }
        throw err;
      }
    }
    if (renameErr) throw renameErr;
    tmpPath = null;
  } catch (err) {
    log.error('[DATABASE ATOMIC SAVE ERROR] Failed to save SQLite database to disk', {
      err: err instanceof Error ? err.message : String(err),
    });
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (closeErr) {
        log.debug('SQLite temp file descriptor close skipped', {
          err: closeErr instanceof Error ? closeErr.message : String(closeErr),
        });
      }
    }
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (unlinkErr) {
        log.debug('SQLite temp file cleanup skipped', {
          tmpPath,
          err: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
        });
      }
    }
    isSaving = false;
    if (savePending) {
      savePending = false;
      saveDatabaseToDisk();
    }
  }
}

export function flushDatabaseToDisk(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveDatabaseToDisk();
}

export function requestDatabaseSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseToDisk();
  }, 200);
}

export interface PreparedStatement {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: <T = Record<string, unknown>>(...params: unknown[]) => T | undefined;
  all: <T = Record<string, unknown>>(...params: unknown[]) => T[];
}

export interface SqliteWrapper {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatement;
  transaction?: <T extends (...args: never[]) => unknown>(fn: T) => T;
  close: () => void;
  export: () => Uint8Array;
}

export function getDatabase(): SqliteWrapper {
  if (!SQL) {
    throw new Error('SQLite engine not initialized. Please await initSqlEngine() before getDatabase()');
  }

  if (!dbInstance) {
    const dbPath = getDatabasePath();
    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        if (fileBuffer.length > 0) {
          const testDb = new SQL.Database(fileBuffer);
          testDb.exec('PRAGMA schema_version;');
          dbInstance = testDb;
        } else {
          dbInstance = new SQL.Database();
        }
      } catch (loadErr) {
        // CORRUPTION PRESERVATION: Never silently overwrite! Preserve corrupt copy.
        const bakPath = `${dbPath}.corrupt.${Date.now()}.bak`;
        try {
          fs.copyFileSync(dbPath, bakPath);
          console.error(`[DATABASE CRITICAL] Database at "${dbPath}" failed to load. Preserved copy at "${bakPath}":`, loadErr);
        } catch (copyErr) {
          console.error(`[DATABASE CRITICAL] Failed to create backup of corrupted database at "${dbPath}":`, copyErr);
        }
        dbInstance = new SQL.Database();
      }
    } else {
      dbInstance = new SQL.Database();
    }

    // Always enforce foreign key constraints
    try {
      dbInstance.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      log.debug('Failed enforcing SQLite PRAGMA foreign_keys = ON', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rawDb = dbInstance;

  return {
    transaction: <T extends (...args: never[]) => unknown>(fn: T): T => {
      return ((...args: Parameters<T>) => {
        const spName = `sp_${transactionDepth}`;
        rawDb.exec(`SAVEPOINT ${spName};`);
        transactionDepth++;
        try {
          const res = fn(...args);
          rawDb.exec(`RELEASE ${spName};`);
          transactionDepth--;
          if (transactionDepth === 0) {
            requestDatabaseSave();
          }
          return res;
        } catch (err) {
          try {
            rawDb.exec(`ROLLBACK TO ${spName};`);
            rawDb.exec(`RELEASE ${spName};`);
          } catch (rbErr) {
            log.warn('SQLite savepoint rollback failed', {
              spName,
              err: rbErr instanceof Error ? rbErr.message : String(rbErr),
            });
          }
          transactionDepth--;
          throw err;
        }
      }) as T;
    },
    exec: (sql: string) => {
      const isBegin = /BEGIN/i.test(sql);
      const isCommitOrRollback = /COMMIT|ROLLBACK/i.test(sql);

      if (isBegin) transactionDepth++;
      rawDb.exec(sql);
      if (isCommitOrRollback && transactionDepth > 0) transactionDepth--;

      if (transactionDepth === 0) {
        requestDatabaseSave();
      }
    },
    prepare: (sql: string): PreparedStatement => {
      return {
        run: (...params: unknown[]) => {
          const safeParams = params.map((p) => (p === undefined ? null : p)) as Parameters<Database['run']>[1];
          rawDb.run(sql, safeParams);
          const changes = rawDb.getRowsModified();
          let lastInsertRowid: number | bigint = 0;
          if (/^\s*INSERT\b/i.test(sql)) {
            try {
              const res = rawDb.exec('SELECT last_insert_rowid() AS id;');
              if (res.length > 0 && res[0].values.length > 0) {
                const val = res[0].values[0][0];
                if (typeof val === 'number') lastInsertRowid = val;
                else if (typeof val === 'bigint') lastInsertRowid = val;
                else if (typeof val === 'string') lastInsertRowid = parseInt(val, 10) || 0;
              }
            } catch (rowIdErr) {
              log.debug('Failed reading SQLite last_insert_rowid()', {
                err: rowIdErr instanceof Error ? rowIdErr.message : String(rowIdErr),
              });
            }
          }
          if (transactionDepth === 0) {
            requestDatabaseSave();
          }
          return { changes, lastInsertRowid };
        },
        get: <T = Record<string, unknown>>(...params: unknown[]): T | undefined => {
          const safeParams = params.map((p) => (p === undefined ? null : p)) as Parameters<Database['run']>[1];
          const stmt = rawDb.prepare(sql);
          try {
            stmt.bind(safeParams);
            if (stmt.step()) {
              return stmt.getAsObject() as T;
            }
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all: <T = Record<string, unknown>>(...params: unknown[]): T[] => {
          const safeParams = params.map((p) => (p === undefined ? null : p)) as Parameters<Database['run']>[1];
          const stmt = rawDb.prepare(sql);
          const results: T[] = [];
          try {
            stmt.bind(safeParams);
            while (stmt.step()) {
              results.push(stmt.getAsObject() as T);
            }
            return results;
          } finally {
            stmt.free();
          }
        },
      };
    },
    close: () => {
      transactionDepth = 0;
      flushDatabaseToDisk();
      try {
        rawDb.close();
      } catch (err) {
        log.debug('SQLite db.close() threw during wrapper close', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      dbInstance = null;
    },
    export: () => rawDb.export(),
  };
}

export function closeDatabase(): void {
  if (dbInstance) {
    transactionDepth = 0;
    flushDatabaseToDisk();
    try {
      dbInstance.close();
    } catch (err) {
      log.debug('SQLite closeDatabase() threw during close', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    dbInstance = null;
  }
}

export interface DbBackupResult {
  backedUp: boolean;
  backupPath?: string;
  removedCount: number;
}

function readPreMigrationVersionFromFile(dbPath: string): number {
  if (!SQL) return 0;
  try {
    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length === 0) return 0;
    const probeDb = new SQL.Database(fileBuffer);
    try {
      const appVerRes = probeDb.exec(
        "SELECT MAX(version) FROM app_schema_version;"
      );
      const appVer = Number(appVerRes?.[0]?.values?.[0]?.[0] ?? 0);
      if (Number.isFinite(appVer) && appVer > 0) {
        return appVer;
      }
    } catch (err) {
      // app_schema_version does not exist yet
      log.debug('app_schema_version probe skipped on pre-migration DB', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      const migRes = probeDb.exec(
        "SELECT MAX(version) FROM schema_migrations;"
      );
      const migVer = Number(migRes?.[0]?.values?.[0]?.[0] ?? 0);
      if (Number.isFinite(migVer) && migVer > 0) {
        return migVer;
      }
    } catch (err) {
      // schema_migrations does not exist yet
      log.debug('schema_migrations probe skipped on pre-migration DB', {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      probeDb.close();
    }
  } catch (err) {
    log.debug('Pre-migration SQLite version probe skipped', {
      dbPath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return 0;
}

/**
 * Copies the active SQLite database (plus WAL/SHM sidecars if present) into
 * `<userData>/backups/db/pre-<version>-<timestamp>.sqlite` BEFORE any migration runs.
 * Keeps the `keepCount` (default 5) newest backups and deletes older ones.
 * Never throws so startup is never blocked by read-only or unavailable backup storage.
 */
export function backupDatabaseBeforeMigration(options?: {
  dbPath?: string;
  backupsDir?: string;
  keepCount?: number;
}): DbBackupResult {
  try {
    const dbPath = options?.dbPath ? path.resolve(options.dbPath) : getDatabasePath();
    if (!fs.existsSync(dbPath)) {
      return { backedUp: false, removedCount: 0 };
    }
    const stat = fs.statSync(dbPath);
    if (!stat.isFile() || stat.size === 0) {
      return { backedUp: false, removedCount: 0 };
    }

    const backupsDir = options?.backupsDir
      ? path.resolve(options.backupsDir)
      : getDbBackupsDir(dbPath);
    fs.mkdirSync(backupsDir, { recursive: true });

    const preVersion = readPreMigrationVersionFromFile(dbPath);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueSuffix = `${ts}-${process.pid}`;
    let backupFileName = `pre-v${preVersion}-${uniqueSuffix}.sqlite`;
    let backupPath = path.join(backupsDir, backupFileName);
    let seq = 1;
    while (fs.existsSync(backupPath)) {
      backupFileName = `pre-v${preVersion}-${uniqueSuffix}-${seq}.sqlite`;
      backupPath = path.join(backupsDir, backupFileName);
      seq++;
    }

    fs.copyFileSync(dbPath, backupPath);

    for (const sidecar of ['-wal', '-shm']) {
      const srcSidecar = `${dbPath}${sidecar}`;
      if (fs.existsSync(srcSidecar)) {
        try {
          fs.copyFileSync(srcSidecar, `${backupPath}${sidecar}`);
        } catch (err) {
          log.debug('SQLite backup sidecar copy skipped', {
            srcSidecar,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const keepCount = Math.max(1, options?.keepCount ?? 5);
    const entries = fs
      .readdirSync(backupsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^pre-.*\.sqlite$/i.test(e.name))
      .map((e) => {
        const full = path.join(backupsDir, e.name);
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(full).mtimeMs;
        } catch (statErr) {
          log.debug('Failed stating SQLite backup file during pruning', {
            full,
            err: statErr instanceof Error ? statErr.message : String(statErr),
          });
        }
        return { name: e.name, full, mtimeMs };
      })
      .sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return b.name.localeCompare(a.name);
      });

    let removedCount = 0;
    for (const stale of entries.slice(keepCount)) {
      try {
        fs.unlinkSync(stale.full);
        removedCount++;
      } catch (unlinkErr) {
        log.debug('Failed pruning stale SQLite backup file', {
          path: stale.full,
          err: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
        });
      }
      for (const sidecar of ['-wal', '-shm']) {
        try {
          if (fs.existsSync(`${stale.full}${sidecar}`)) {
            fs.unlinkSync(`${stale.full}${sidecar}`);
          }
        } catch (sidecarErr) {
          log.debug('Failed pruning stale SQLite backup sidecar', {
            path: `${stale.full}${sidecar}`,
            err: sidecarErr instanceof Error ? sidecarErr.message : String(sidecarErr),
          });
        }
      }
    }

    return { backedUp: true, backupPath, removedCount };
  } catch (err) {
    log.warn('Pre-migration SQLite backup failed softly so startup can proceed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return { backedUp: false, removedCount: 0 };
  }
}

export interface ConfigSnapshotResult {
  snapshotted: boolean;
  snapshotDir?: string;
  filesCopied: string[];
}

const FIRST_RUN_CONFIG_FILES = [
  'cloud-sync-config.json',
  'cloud-profile-bindings.json',
  'cloud-sync-status.json',
] as const;

/**
 * On first run after update, snapshots cloud sync JSON files into
 * `<userData>/backups/config/<timestamp>/`. Never throws or blocks startup.
 */
export function snapshotSyncConfigFirstRun(options?: {
  userDataDir?: string;
  backupsConfigDir?: string;
  markerName?: string;
}): ConfigSnapshotResult {
  try {
    const userDataDir = options?.userDataDir
      ? path.resolve(options.userDataDir)
      : getWritableUserDataDir();
    const backupsConfigDir = options?.backupsConfigDir
      ? path.resolve(options.backupsConfigDir)
      : getConfigBackupsDir();
    const markerPath = path.join(
      backupsConfigDir,
      options?.markerName || '.first-run-snapshot-v1.done'
    );

    if (fs.existsSync(markerPath)) {
      return { snapshotted: false, filesCopied: [] };
    }

    const existingSources = FIRST_RUN_CONFIG_FILES.map((fileName) => ({
      fileName,
      srcPath: path.join(userDataDir, fileName),
    })).filter((entry) => fs.existsSync(entry.srcPath));

    fs.mkdirSync(backupsConfigDir, { recursive: true });

    if (existingSources.length === 0) {
      try {
        fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');
      } catch (err) {
        log.debug('Failed writing empty first-run config snapshot marker', {
          markerPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return { snapshotted: false, filesCopied: [] };
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(backupsConfigDir, ts);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const filesCopied: string[] = [];
    for (const item of existingSources) {
      try {
        fs.copyFileSync(item.srcPath, path.join(snapshotDir, item.fileName));
        filesCopied.push(item.fileName);
      } catch (copyErr) {
        log.warn('Failed snapshotting first-run sync config file', {
          srcPath: item.srcPath,
          err: copyErr instanceof Error ? copyErr.message : String(copyErr),
        });
      }
    }

    try {
      fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');
    } catch (markerErr) {
      log.debug('Failed writing first-run config snapshot marker', {
        markerPath,
        err: markerErr instanceof Error ? markerErr.message : String(markerErr),
      });
    }

    return { snapshotted: filesCopied.length > 0, snapshotDir, filesCopied };
  } catch (err) {
    log.warn('First-run sync config snapshot failed cleanly', {
      err: err instanceof Error ? err.message : String(err),
    });
    return { snapshotted: false, filesCopied: [] };
  }
}

if (typeof process !== 'undefined') {
  process.on('exit', () => {
    try {
      if (currentDbPath && fs.existsSync(currentDbPath) && currentDbPath.includes('test-auto-isolated')) {
        fs.unlinkSync(currentDbPath);
      }
    } catch (err) {
      log.debug('Isolated test DB exit cleanup skipped', {
        currentDbPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
