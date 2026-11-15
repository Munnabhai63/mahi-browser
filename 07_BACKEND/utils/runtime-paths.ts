import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import * as electron from 'electron';

/**
 * Safely resolves the Electron app object if running in an Electron main process.
 * In Vitest or standalone Node.js environments, returns null.
 */
function getElectronApp(): any {
  try {
    const electronObj = electron as any;
    if (electronObj && typeof electronObj.app === 'object' && electronObj.app !== null) {
      return electronObj.app;
    }
    if (electronObj?.default && typeof electronObj.default.app === 'object' && electronObj.default.app !== null) {
      return electronObj.default.app;
    }
  } catch {}
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
      try { fs.mkdirSync(custom, { recursive: true }); } catch {}
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
          try { fs.mkdirSync(p, { recursive: true }); } catch {}
        }
        return p;
      }
    } catch {}
  }

  // 3. OS-specific fallbacks
  let resolvedDir: string;
  const home = os.homedir() || '';

  if (process.platform === 'win32') {
    if (process.env.APPDATA) {
      resolvedDir = path.join(process.env.APPDATA, 'mahi-browser');
    } else if (home) {
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
    try { fs.mkdirSync(resolvedDir, { recursive: true }); } catch {}
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
    } catch {}
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
  const candidates: (string | null | undefined)[] = [
    process.resourcesPath ? path.join(process.resourcesPath, ...segments) : null,
    (() => {
      if (app && typeof app.getAppPath === 'function') {
        try {
          return path.join(app.getAppPath(), ...segments);
        } catch {}
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
  const candidates: (string | null | undefined)[] = [
    process.resourcesPath ? path.join(process.resourcesPath, 'landing') : null,
    (() => {
      if (app && typeof app.getAppPath === 'function') {
        try {
          return path.join(app.getAppPath(), 'landing');
        } catch {}
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
