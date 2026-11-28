import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { BrowserEngine } from '../10_CONFIG/shared/types/profile.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
import {
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  getBundledEngineExecutablePath,
  isProductionChromiumInstalled,
  getProductionChromiumExecutablePath,
  getEnginesBaseDir,
  resolveEngineManifest,
  hasNativeStealthEngine,
  type MahiEngineManifest,
} from './managed-engine.js';

const log = createLogger('browser-detector');

export interface DetectedBrowser {
  name: string;
  engine: BrowserEngine;
  path: string;
  version?: string;
  isDefault?: boolean;
}

export function detectSystemBrowsers(): DetectedBrowser[] {
  const platform = os.platform();
  const detected: DetectedBrowser[] = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const chromeCandidates = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];

    const edgeCandidates = [
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    const chromiumCandidates = [
      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
    ];

    for (const p of chromeCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Google Chrome', engine: 'chrome', path: p });
        break;
      }
    }

    for (const p of edgeCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Microsoft Edge', engine: 'edge', path: p });
        break;
      }
    }

    for (const p of chromiumCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Chromium', engine: 'chromium', path: p });
        break;
      }
    }
  } else if (platform === 'darwin') {
    const home = os.homedir();
    const macCandidates = [
      { name: 'Google Chrome', engine: 'chrome' as BrowserEngine, path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Google Chrome (User)', engine: 'chrome' as BrowserEngine, path: path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome') },
      { name: 'Microsoft Edge', engine: 'edge' as BrowserEngine, path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Brave Browser', engine: 'chrome' as BrowserEngine, path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
      { name: 'Chromium', engine: 'chromium' as BrowserEngine, path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
    ];
    for (const c of macCandidates) {
      if (fs.existsSync(c.path)) {
        detected.push(c);
      }
    }
  } else {
    // Linux
    const linuxCandidates = [
      { name: 'Google Chrome', engine: 'chrome' as BrowserEngine, path: '/usr/bin/google-chrome' },
      { name: 'Google Chrome Stable', engine: 'chrome' as BrowserEngine, path: '/usr/bin/google-chrome-stable' },
      { name: 'Chromium Browser', engine: 'chromium' as BrowserEngine, path: '/usr/bin/chromium-browser' },
      { name: 'Chromium', engine: 'chromium' as BrowserEngine, path: '/usr/bin/chromium' },
      { name: 'Chromium (Snap)', engine: 'chromium' as BrowserEngine, path: '/snap/bin/chromium' },
      { name: 'Brave Browser', engine: 'chrome' as BrowserEngine, path: '/usr/bin/brave-browser' },
      { name: 'Microsoft Edge', engine: 'edge' as BrowserEngine, path: '/usr/bin/microsoft-edge' },
    ];
    for (const c of linuxCandidates) {
      if (fs.existsSync(c.path)) {
        detected.push(c);
        break;
      }
    }
  }

  return detected;
}

/**
 * Searches for an authorized MAHI custom core in ~/.mahi/cores
 * to provide native multi-core spoofing (checking chrome-* / mahi-* before orbita-*).
 */
export function getMahiCustomCorePath(): string | null {
  const home = os.homedir();
  const mahiCoresDir = path.join(home, '.mahi', 'cores');
  if (fs.existsSync(mahiCoresDir)) {
    try {
      const entries = fs.readdirSync(mahiCoresDir);
      // Prioritize chrome-* and mahi-* over orbita-*
      const sortedEntries = entries.sort((a, b) => {
        const aPrefix = a.startsWith('chrome-') ? 0 : (a.startsWith('mahi-') ? 1 : (a.startsWith('orbita-') ? 3 : 2));
        const bPrefix = b.startsWith('chrome-') ? 0 : (b.startsWith('mahi-') ? 1 : (b.startsWith('orbita-') ? 3 : 2));
        return aPrefix - bPrefix;
      });
      for (const entry of sortedEntries) {
        const candidate = path.join(mahiCoresDir, entry, os.platform() === 'win32' ? 'chrome.exe' : 'chrome');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch (err) {
      log.debug('Failed scanning ~/.mahi/cores for custom Chromium binary', {
        mahiCoresDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Optional env-configured custom core directories
  const envCoreDirs = (process.env.MAHI_CUSTOM_CORE_DIRS || '')
    .split(path.delimiter)
    .map((d) => d.trim())
    .filter(Boolean);
  for (const dir of envCoreDirs) {
    const exeNames = os.platform() === 'win32' ? ['chrome.exe', 'chromium.exe'] : ['chrome', 'chromium'];
    for (const exe of exeNames) {
      const candidate = path.join(dir, exe);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

export const getStealthOrbitaEnginePath = getMahiCustomCorePath;

/**
 * Resolves the Camoufox (C++ Patched Firefox) binary path.
 * Checks process.env.CAMOUFOX_EXECUTABLE_PATH, ~/.mahi/cores/camoufox*, ~/.cache/camoufox,
 * and standard OS installation paths.
 */
export function getCamoufoxExecutablePath(): string | null {
  if (process.env.CAMOUFOX_EXECUTABLE_PATH && fs.existsSync(process.env.CAMOUFOX_EXECUTABLE_PATH)) {
    return process.env.CAMOUFOX_EXECUTABLE_PATH;
  }

  const platform = os.platform();
  const home = os.homedir();
  const enginesDir = getEnginesBaseDir();

  // 0. Check provisioned marker file in engines/camoufox/mahi-camoufox.json
  const markerPath = path.join(enginesDir, 'camoufox', 'mahi-camoufox.json');
  if (fs.existsSync(markerPath)) {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      if (marker?.executablePath && fs.existsSync(marker.executablePath)) {
        const stat = fs.statSync(marker.executablePath);
        if (stat.size > 10 * 1024 * 1024) {
          return marker.executablePath;
        }
      }
    } catch (err) {
      log.warn('Failed reading Camoufox marker manifest', {
        markerPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 0b. Glob check inside engines/camoufox for any camoufox* binary
  const camoufoxEnginesDir = path.join(enginesDir, 'camoufox');
  if (fs.existsSync(camoufoxEnginesDir)) {
    try {
      const files = fs.readdirSync(camoufoxEnginesDir);
      for (const f of files) {
        const full = path.join(camoufoxEnginesDir, f);
        const lower = f.toLowerCase();
        if (lower.startsWith('camoufox') && (platform === 'win32' ? lower.endsWith('.exe') : true)) {
          const stat = fs.statSync(full);
          if (stat.isFile() && stat.size > 10 * 1024 * 1024) {
            return full;
          }
        }
      }
    } catch (err) {
      log.debug('Failed scanning managed engines/camoufox directory', {
        camoufoxEnginesDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const exeName = platform === 'win32' ? 'camoufox.exe' : 'camoufox';

  // 1. Check ~/.mahi/cores/camoufox*
  const mahiCoresDir = path.join(home, '.mahi', 'cores');
  if (fs.existsSync(mahiCoresDir)) {
    try {
      const entries = fs.readdirSync(mahiCoresDir);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith('camoufox')) {
          const direct = path.join(mahiCoresDir, entry, exeName);
          if (fs.existsSync(direct)) return direct;
          const binFallback = path.join(mahiCoresDir, entry, platform === 'win32' ? 'camoufox.exe' : 'camoufox-bin');
          if (fs.existsSync(binFallback)) return binFallback;
        }
      }
    } catch (err) {
      log.debug('Failed scanning ~/.mahi/cores for Camoufox binary', {
        mahiCoresDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Check ~/.cache/camoufox
  const cacheDir = path.join(home, '.cache', 'camoufox');
  if (fs.existsSync(cacheDir)) {
    const cacheExe = path.join(cacheDir, exeName);
    if (fs.existsSync(cacheExe)) return cacheExe;
    try {
      const subEntries = fs.readdirSync(cacheDir);
      for (const sub of subEntries) {
        const subExe = path.join(cacheDir, sub, exeName);
        if (fs.existsSync(subExe)) return subExe;
      }
    } catch (err) {
      log.debug('Failed scanning ~/.cache/camoufox directory', {
        cacheDir,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Check OS standard locations
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      path.join(localAppData, 'Camoufox', 'camoufox.exe'),
      path.join(localAppData, 'camoufox', 'camoufox', 'Cache', 'camoufox.exe'),
      path.join(localAppData, 'camoufox', 'Cache', 'camoufox.exe'),
      path.join(getEnginesBaseDir(), 'camoufox', 'camoufox.exe'),
      path.join(programFiles, 'Camoufox', 'camoufox.exe'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Camoufox', 'camoufox.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Camoufox.app/Contents/MacOS/camoufox',
      path.join(home, 'Applications', 'Camoufox.app', 'Contents', 'MacOS', 'camoufox'),
      path.join(getEnginesBaseDir(), 'camoufox', 'camoufox'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    // Linux
    const candidates = [
      path.join(getEnginesBaseDir(), 'camoufox', 'camoufox'),
      '/usr/bin/camoufox',
      '/usr/local/bin/camoufox',
      '/opt/camoufox/camoufox',
      '/usr/bin/camoufox-bin',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  return null;
}

export function isCamoufoxInstalled(): boolean {
  return getCamoufoxExecutablePath() !== null;
}

export function getEngineAvailability(): {
  chromium138: boolean;
  camoufox: boolean;
  chrome: boolean;
  edge: boolean;
} {
  const sys = detectSystemBrowsers();
  const hasManaged = isProductionChromiumInstalled() || isManagedEngineInstalled() || Boolean(getBundledEngineExecutablePath());
  return {
    chromium138: hasManaged,
    camoufox: isCamoufoxInstalled(),
    chrome: sys.some((b) => b.engine === 'chrome'),
    edge: sys.some((b) => b.engine === 'edge'),
  };
}

export function resolveExecutablePath(engine: BrowserEngine, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  // Camoufox Dual-Engine resolution: strictly enforce honest binary resolution
  if (engine === 'camoufox') {
    const camou = getCamoufoxExecutablePath();
    if (camou && fs.existsSync(camou)) {
      return camou;
    }
    throw new Error(
      'Camoufox engine executable not found. Please install Camoufox or set the CAMOUFOX_EXECUTABLE_PATH environment variable. (MAHI Anti-Detect never falsely substitutes Chromium for Camoufox).'
    );
  }

  // 1. User custom MAHI cores (~/.mahi/cores) or native stealth engine (Highest priority for stealth)
  const mahiCustom = getMahiCustomCorePath();
  if (mahiCustom && fs.existsSync(mahiCustom)) {
    return mahiCustom;
  }

  // 2. Authoritative Bundled Production Chromium Engine (Packaged with MAHI Browser)
  const bundled = getBundledEngineExecutablePath();
  if (bundled && fs.existsSync(bundled)) {
    return bundled;
  }

  // 3. Authoritative Managed Engine (Provisioned in user data)
  if (isProductionChromiumInstalled()) {
    const prod = getProductionChromiumExecutablePath();
    if (fs.existsSync(prod)) return prod;
  }
  if (isManagedEngineInstalled()) {
    const managed = getManagedEngineExecutablePath();
    if (fs.existsSync(managed)) return managed;
  }

  // 4. Detected System Browsers (Chrome, Edge, Chromium)
  const detected = detectSystemBrowsers();
  const match = detected.find((b) => b.engine === engine) || detected[0];
  if (match) {
    return match.path;
  }

  // 5. Fallback defaults
  if (os.platform() === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else if (os.platform() === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

export { resolveEngineManifest, hasNativeStealthEngine };
export type { MahiEngineManifest };
