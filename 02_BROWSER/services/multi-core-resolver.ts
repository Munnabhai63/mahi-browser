import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserEngine } from '../../10_CONFIG/shared/types/profile.js';
import { getStealthOrbitaEnginePath, detectSystemBrowsers } from '../detector.js';

export interface MultiCoreResolution {
  executablePath: string;
  majorVersion: number | null;
  coreType: 'exact-multi-core' | 'stealth-orbita' | 'system-chromium';
  isExactVersionMatch: boolean;
}

/**
 * Extracts the major Chrome version from a User-Agent string.
 * Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/124.0.6367.60 Safari/537.36" -> 124
 */
export function extractChromeMajorVersion(userAgent?: string): number | null {
  if (!userAgent) return null;
  const match = userAgent.match(/Chrome\/(\d+)\./i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Discovers and resolves the exact Chromium / Orbita binary matching the profile's User-Agent.
 * Provides 100% parity with MostLogin's multi-core architecture (preventing UA vs V8 version leaks).
 */
export function resolveMultiCoreExecutablePath(
  userAgent?: string,
  customPath?: string
): MultiCoreResolution {
  if (customPath && fs.existsSync(customPath)) {
    return {
      executablePath: customPath,
      majorVersion: extractChromeMajorVersion(userAgent),
      coreType: 'exact-multi-core',
      isExactVersionMatch: true,
    };
  }

  const major = extractChromeMajorVersion(userAgent);
  const home = os.homedir();
  const exeName = os.platform() === 'win32' ? 'chrome.exe' : 'chrome';

  if (major) {
    // 1. Search in MAHI multi-core storage directory
    const mahiCoreCandidates = [
      path.join(home, '.mahi', 'cores', `chrome-${major}`, exeName),
      path.join(home, '.mahi', 'cores', `orbita-${major}`, exeName),
      path.join(home, '.mahi', 'cores', `${major}`, exeName),
    ];
    for (const cand of mahiCoreCandidates) {
      if (fs.existsSync(cand)) {
        return {
          executablePath: cand,
          majorVersion: major,
          coreType: 'exact-multi-core',
          isExactVersionMatch: true,
        };
      }
    }

    // 2. Search in MostLogin / GoLogin local cached version directories
    const externalEngineCandidates = [
      path.join(home, '.gologin', 'browser', `orbita-browser-${major}`, exeName),
      path.join(home, '.mostlogin', 'core', `${major}`, exeName),
      path.join(home, '.mostlogin', 'core', `chrome-${major}`, exeName),
    ];
    for (const cand of externalEngineCandidates) {
      if (fs.existsSync(cand)) {
        return {
          executablePath: cand,
          majorVersion: major,
          coreType: 'exact-multi-core',
          isExactVersionMatch: true,
        };
      }
    }
  }

  // 3. Fallback to primary C++ stealth engine (Orbita)
  const orbitaPath = getStealthOrbitaEnginePath();
  if (orbitaPath) {
    return {
      executablePath: orbitaPath,
      majorVersion: major,
      coreType: 'stealth-orbita',
      isExactVersionMatch: false,
    };
  }

  // 4. Fallback to system Chromium / Google Chrome
  const systemBrowsers = detectSystemBrowsers();
  const chromeSys = systemBrowsers.find((b) => b.engine === 'chrome' || b.engine === 'chromium');
  if (chromeSys && fs.existsSync(chromeSys.path)) {
    return {
      executablePath: chromeSys.path,
      majorVersion: major,
      coreType: 'system-chromium',
      isExactVersionMatch: false,
    };
  }

  // 5. Hardcoded platform default
  const defaultPath = os.platform() === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome';

  return {
    executablePath: defaultPath,
    majorVersion: major,
    coreType: 'system-chromium',
    isExactVersionMatch: false,
  };
}
