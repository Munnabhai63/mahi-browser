import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';

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
    } catch {}
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
    norm.includes('/appdata/local/programs/mahi browser')
  ) {
    throw new Error(
      `[GLOBAL TEST SAFETY GUARD VIOLATION] Automated tests must NEVER target production user database in AppData! Attempted path: "${targetPath}". Please use setCustomDatabasePath(...) with an isolated test directory or let the safety guard route to temporary storage.`
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
    } catch {}
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
          if (process && (process as any).resourcesPath) {
            const resPath = path.join((process as any).resourcesPath, file);
            if (fs.existsSync(resPath)) return resPath;
          }
          if (typeof __dirname !== 'undefined') {
            const dirWasm = path.join(__dirname, file);
            if (fs.existsSync(dirWasm)) return dirWasm;
          }
          const nmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
          if (fs.existsSync(nmPath)) return nmPath;
        } catch {}
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
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Atomic write pattern: write to tmp file with fsync, then atomic rename
    const tmpPath = `${dbPath}.tmp.${process.pid}.${Date.now()}`;
    const fd = fs.openSync(tmpPath, 'w');
    fs.writeSync(fd, buffer);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    fs.renameSync(tmpPath, dbPath);
  } catch (err) {
    console.error('[DATABASE ATOMIC SAVE ERROR] Failed to save SQLite database to disk:', err);
  } finally {
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
  get: (...params: unknown[]) => Record<string, any> | undefined;
  all: (...params: unknown[]) => Record<string, any>[];
}

export interface SqliteWrapper {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatement;
  transaction?: <T extends (...args: any[]) => any>(fn: T) => T;
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
    } catch {}
  }

  const rawDb = dbInstance;

  return {
    transaction: <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: any[]) => {
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
          } catch {}
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
          const safeParams = params.map((p) => (p === undefined ? null : p));
          rawDb.run(sql, safeParams as any);
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
            } catch {}
          }
          if (transactionDepth === 0) {
            requestDatabaseSave();
          }
          return { changes, lastInsertRowid };
        },
        get: (...params: unknown[]) => {
          const safeParams = params.map((p) => (p === undefined ? null : p));
          const stmt = rawDb.prepare(sql);
          try {
            stmt.bind(safeParams as any);
            if (stmt.step()) {
              return stmt.getAsObject();
            }
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all: (...params: unknown[]) => {
          const safeParams = params.map((p) => (p === undefined ? null : p));
          const stmt = rawDb.prepare(sql);
          const results: Record<string, any>[] = [];
          try {
            stmt.bind(safeParams as any);
            while (stmt.step()) {
              results.push(stmt.getAsObject());
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
      } catch {}
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
    } catch {}
    dbInstance = null;
  }
}

if (typeof process !== 'undefined') {
  process.on('exit', () => {
    try {
      if (currentDbPath && fs.existsSync(currentDbPath) && currentDbPath.includes('test-auto-isolated')) {
        fs.unlinkSync(currentDbPath);
      }
    } catch {}
  });
}
