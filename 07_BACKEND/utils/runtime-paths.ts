import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import * as electron from '../../08_SECURITY/electron-bridge.js';
import { createLogger } from './logger.js';

const log = createLogger('runtime-paths');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ElectronAppLike {
  isPackaged?: boolean;
  getPath?: (name: 'userData' | 'downloads') => string;
  getAppPath?: () => string;
}

interface ElectronModuleLike {
  app?: ElectronAppLike;
  default?: { app?: ElectronAppLike };
}

type ProcessWithResources = NodeJS.Process & { resourcesPath?: string };

/**
 * Safely resolves the Electron app object if running in an Electron main process.
 * In Vitest or standalone Node.js environments, returns null.
 */
function getElectronApp(): ElectronAppLike | null {
  try {
    const electronObj = electron as ElectronModuleLike;
    if (electronObj && typeof electronObj.app === 'object' && electronObj.app !== null) {
      return electronObj.app;
    }
    if (electronObj?.default && typeof electronObj.default.app === 'object' && electronObj.default.app !== null) {
      return electronObj.default.app;
    }
  } catch (err) {
    log.debug('Electron app object probe skipped', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/**
 * Returns true if the application is running packaged (e.g. inside Program Files, Applications, AppImage).
 */
export function isAppPackaged(): boolean {
  const app = getElectronApp();
  if (app && typeof app.isPackaged === 'boolean') {
    return app.isPackaged;
  }
  return process.env.NODE_ENV === 'production' && !process.env.VITE_DEV_SERVER_URL;
}

/**
 * Resolves the centralized writable user data directory.
 * Order of precedence:
 * 1. process.env.MAHI_USER_DATA_DIR (explicit test / runner override)
 * 2. Electron app.getPath('userData') (when Electron app is ready)
 * 3. OS-specific standard application data path:
 *    - Windows: %APPDATA%/mahi-browser
 *    - macOS: ~/Library/Application Support/mahi-browser
 *    - Linux: $XDG_CONFIG_HOME/mahi-browser or ~/.config/mahi-browser
 * 4. Fallback: <tempDir>/mahi-browser-data
 *
 * NEVER falls back to process.cwd() in packaged builds, preventing EPERM/EACCES crashes.
 */
export function getWritableUserDataDir(): string {
  // 1. Explicit override
  if (process.env.MAHI_USER_DATA_DIR && typeof process.env.MAHI_USER_DATA_DIR === 'string') {
    const custom = path.resolve(process.env.MAHI_USER_DATA_DIR);
    if (!fs.existsSync(custom)) {
      try {
        fs.mkdirSync(custom, { recursive: true });
      } catch (mkdirErr) {
        log.debug('Failed creating custom MAHI_USER_DATA_DIR', {
          custom,
          err: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
        });
      }
    }
    return custom;
  }

  // 2. Electron runtime
  const app = getElectronApp();
  if (app && typeof app.getPath === 'function') {
    try {
      const p = app.getPath('userData');
      if (p && typeof p === 'string') {
        if (!fs.existsSync(p)) {
          try {
            fs.mkdirSync(p, { recursive: true });
          } catch (mkdirErr) {
            log.debug('Failed creating Electron userData dir', {
              p,
              err: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
            });
          }
        }
        return p;
      }
    } catch (appErr) {
      log.debug('Electron app.getPath(userData) unavailable', {
        err: appErr instanceof Error ? appErr.message : String(appErr),
      });
    }
  }

  // 3. APPDATA override (supports cross-platform test isolation and Windows user data when APPDATA is set)
  if (process.env.APPDATA && typeof process.env.APPDATA === 'string') {
    const appDataCandidate = path.join(process.env.APPDATA, 'mahi-browser');
    if (!fs.existsSync(appDataCandidate)) {
      try {
        fs.mkdirSync(appDataCandidate, { recursive: true });
      } catch (mkdirErr) {
        log.debug('Failed creating APPDATA fallback userData dir', {
          appDataCandidate,
          err: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
        });
      }
    }
    return appDataCandidate;
  }

  // 4. OS-specific fallbacks
  let resolvedDir: string;
  const home = os.homedir() || '';

  if (process.platform === 'win32') {
    if (home) {
      resolvedDir = path.join(home, 'AppData', 'Roaming', 'mahi-browser');
    } else {
      resolvedDir = path.join(os.tmpdir(), 'mahi-browser-win32');
    }
  } else if (process.platform === 'darwin') {
    if (home) {
      resolvedDir = path.join(home, 'Library', 'Application Support', 'mahi-browser');
    } else {
      resolvedDir = path.join(os.tmpdir(), 'mahi-browser-darwin');
    }
  } else {
    // Linux and other POSIX
    const xdgConfig = process.env.XDG_CONFIG_HOME || (home ? path.join(home, '.config') : '');
    if (xdgConfig) {
      resolvedDir = path.join(xdgConfig, 'mahi-browser');
    } else {
      resolvedDir = path.join(os.tmpdir(), 'mahi-browser-linux');
    }
  }

  if (!fs.existsSync(resolvedDir)) {
    try {
      fs.mkdirSync(resolvedDir, { recursive: true });
    } catch (mkdirErr) {
      log.debug('Failed creating OS fallback userData dir', {
        resolvedDir,
        err: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
      });
    }
  }
  return resolvedDir;
}

/**
 * Returns a guaranteed writable subdirectory inside the user data directory.
 * Ensures the directory exists before returning.
 */
export function getWritableSubdir(subdirName: string): string {
  const base = getWritableUserDataDir();
  const fullPath = path.join(base, subdirName);
  if (!fs.existsSync(fullPath)) {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
    } catch (mkdirErr) {
      log.debug('Failed creating writable userData subdir', {
        fullPath,
        err: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
      });
    }
  }
  return fullPath;
}

/**
 * Locates a bundled application resource (icon, splash screen, wasm, binaries) across:
 * 1. process.resourcesPath (packaged Electron)
 * 2. app.getAppPath()
 * 3. process.cwd() / 13_ASSETS/resources
 * 4. Dev root relative to this file
 */
export function getBundledResourcePath(...segments: string[]): string | undefined {
  const app = getElectronApp();
  const proc = process as ProcessWithResources;
  const candidates: (string | null | undefined)[] = [
    proc.resourcesPath ? path.join(proc.resourcesPath, ...segments) : null,
    (() => {
      if (app && typeof app.getAppPath === 'function') {
        try {
          return path.join(app.getAppPath(), ...segments);
        } catch (err) {
          log.debug('Electron app.getAppPath skipped for resource lookup', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return null;
    })(),
    path.join(process.cwd(), '13_ASSETS', 'resources', ...segments),
    path.join(process.cwd(), 'resources', ...segments),
    path.join(process.cwd(), ...segments),
    path.resolve(__dirname, '../../13_ASSETS/resources', ...segments),
    path.resolve(__dirname, '../..', ...segments),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Locates the landing web assets directory across packaged and development environments.
 * 1. process.resourcesPath/landing
 * 2. app.getAppPath()/landing
 * 3. process.cwd()/landing
 * 4. Dev root relative to this file
 */
export function getLandingBaseDir(): string {
  const app = getElectronApp();
  const proc = process as ProcessWithResources;
  const candidates: (string | null | undefined)[] = [
    proc.resourcesPath ? path.join(proc.resourcesPath, 'landing') : null,
    (() => {
      if (app && typeof app.getAppPath === 'function') {
        try {
          return path.join(app.getAppPath(), 'landing');
        } catch (err) {
          log.debug('Electron app.getAppPath skipped for landing lookup', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return null;
    })(),
    path.join(process.cwd(), 'landing'),
    path.resolve(__dirname, '../../landing'),
    path.resolve(__dirname, '../../../landing'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'landing');
}

/**
 * Resolves the safe base directory for pre-update DB and config backups.
 * In test runs without MAHI_USER_DATA_DIR, routes backups next to the test DB
 * so real AppData user data is never touched.
 */
export function resolveBackupBaseDir(dbPath?: string): string {
  const isTestEnv = Boolean(
    process.env.NODE_ENV === 'test' ||
      process.env.VITEST ||
      process.env.VITEST_WORKER_ID ||
      process.env.JEST_WORKER_ID
  );
  if (isTestEnv && !process.env.MAHI_USER_DATA_DIR) {
    if (dbPath) {
      return path.dirname(path.resolve(dbPath));
    }
    return path.join(process.cwd(), '.mahi_data', 'test-auto-isolated');
  }
  return getWritableUserDataDir();
}

export function getDbBackupsDir(dbPath?: string): string {
  return path.join(resolveBackupBaseDir(dbPath), 'backups', 'db');
}

export function getConfigBackupsDir(): string {
  return path.join(resolveBackupBaseDir(), 'backups', 'config');
}
