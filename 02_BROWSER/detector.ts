import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserEngine } from '../10_CONFIG/shared/types/profile.js';
import {
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  getBundledEngineExecutablePath,
  isProductionChromiumInstalled,
  getProductionChromiumExecutablePath
} from './managed-engine.js';

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
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
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
    } catch {}
  }
  return null;
}

export const getStealthOrbitaEnginePath = getMahiCustomCorePath;

export function resolveExecutablePath(engine: BrowserEngine, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  // 1. Authoritative Bundled Production Chromium Engine (Packaged with MAHI Browser)
  const bundled = getBundledEngineExecutablePath();
  if (bundled && fs.existsSync(bundled)) {
    return bundled;
  }

  // 2. Authoritative Managed Engine (Provisioned in user data)
  if (isProductionChromiumInstalled()) {
    const prod = getProductionChromiumExecutablePath();
    if (fs.existsSync(prod)) return prod;
  }
  if (isManagedEngineInstalled()) {
    const managed = getManagedEngineExecutablePath();
    if (fs.existsSync(managed)) return managed;
  }

  // 3. User custom MAHI cores (~/.mahi/cores)
  const mahiCustom = getMahiCustomCorePath();
  if (mahiCustom && fs.existsSync(mahiCustom)) {
    return mahiCustom;
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
