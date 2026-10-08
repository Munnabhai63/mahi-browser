import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let currentDbPath: string | null = null;
let inTransaction = false;
let isSaving = false;
let saveTimeout: NodeJS.Timeout | null = null;

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
    currentDbPath = path.join(testDir, `mahi_test_worker_${workerId}.sqlite`);
    return currentDbPath;
  }

  let userDataDir = '';
  if (process.env.APPDATA) {
    userDataDir = path.join(process.env.APPDATA, 'mahi-browser');
  } else if (process.env.HOME) {
    userDataDir = path.join(process.env.HOME, '.mahi-browser');
  } else {
    userDataDir = path.join(process.cwd(), '.mahi_data');
  }

  if (!userDataDir) {
    userDataDir = process.env.APPDATA 
      ? path.join(process.env.APPDATA, 'mahi_browser')
      : path.join(process.cwd(), '.mahi_data');
  }

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  currentDbPath = path.join(userDataDir, 'mahi_browser.sqlite');
  return currentDbPath;
}

export function setCustomDatabasePath(dbPath: string): void {
  if (isTestRunnerEnvironment()) {
    assertPathIsNotProduction(dbPath);
  }
  currentDbPath = dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (dbInstance) {
    try { dbInstance.close(); } catch {}
    dbInstance = null;
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
  return SQL;
}

export function saveDatabaseToDisk(): void {
  if (!dbInstance || inTransaction || isSaving) return;
  isSaving = true;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  } finally {
    isSaving = false;
  }
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
        dbInstance = new SQL.Database(fileBuffer);
      } catch {
        dbInstance = new SQL.Database();
      }
    } else {
      dbInstance = new SQL.Database();
    }
  }

  const rawDb = dbInstance;

  return {
    transaction: <T extends (...args: any[]) => any>(fn: T): T => {
      return ((...args: any[]) => {
        rawDb.exec('BEGIN TRANSACTION;');
        inTransaction = true;
        try {
          const res = fn(...args);
          rawDb.exec('COMMIT;');
          inTransaction = false;
          requestDatabaseSave();
          return res;
        } catch (err) {
          try { rawDb.exec('ROLLBACK;'); } catch {}
          inTransaction = false;
          throw err;
        }
      }) as T;
    },
    exec: (sql: string) => {
      const isBegin = /BEGIN/i.test(sql);
      const isCommitOrRollback = /COMMIT|ROLLBACK/i.test(sql);

      if (isBegin) inTransaction = true;
      rawDb.exec(sql);
      if (isCommitOrRollback) inTransaction = false;

      if (!inTransaction) {
        requestDatabaseSave();
      }
    },
    prepare: (sql: string): PreparedStatement => {
      return {
        run: (...params: unknown[]) => {
          const safeParams = params.map((p) => (p === undefined ? null : p));
          rawDb.run(sql, safeParams as any);
          if (!inTransaction) {
            requestDatabaseSave();
          }
          return { changes: 1, lastInsertRowid: 0 };
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
      inTransaction = false;
      saveDatabaseToDisk();
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
    inTransaction = false;
    saveDatabaseToDisk();
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}
