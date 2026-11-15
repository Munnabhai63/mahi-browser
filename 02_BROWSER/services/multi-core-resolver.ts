import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserEngine } from '../../10_CONFIG/shared/types/profile.js';
import { getMahiCustomCorePath, getStealthOrbitaEnginePath, detectSystemBrowsers, getCamoufoxExecutablePath } from '../detector.js';
import {
  getBundledEngineExecutablePath,
  getProductionChromiumExecutablePath,
  isProductionChromiumInstalled,
  getManagedEngineExecutablePath,
  isManagedEngineInstalled,
} from '../managed-engine.js';
import { CHROMIUM_PRODUCTION_VERSION } from '../../10_CONFIG/engine-config.js';

export interface MultiCoreResolution {
  executablePath: string;
  majorVersion: number | null;
  coreType: 'exact-multi-core' | 'mahi-bundled' | 'mahi-managed' | 'mahi-custom-core' | 'stealth-orbita' | 'system-chromium' | 'camoufox';
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
 * Extracts the major Firefox/Gecko version from a User-Agent string.
 */
export function extractFirefoxMajorVersion(userAgent?: string): number | null {
  if (!userAgent) return null;
  const match = userAgent.match(/rv:(\d+)\./i) || userAgent.match(/Firefox\/(\d+)\./i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Discovers and resolves the exact Chromium / core binary matching the profile's User-Agent.
 * Prioritizes:
 * 1. Custom user-specified path (if valid)
 * 2. Camoufox C++ patched Firefox (if engine === 'camoufox' or Firefox UA)
 * 3. MAHI dedicated multi-cores (~/.mahi/cores/)
 * 4. Authoritative bundled production Chromium (shipped with MAHI Browser)
 * 5. Authoritative managed engine (%APPDATA%/mahi-browser/engines/)
 * 6. MAHI custom core (~/.mahi/cores)
 * 7. System Chrome / Chromium
 *
 * NOTE: Never attempts to spawn 3rd-party proprietary GoLogin binaries which crash with Exit Code 403.
 */
export function resolveMultiCoreExecutablePath(
  userAgent?: string,
  customPath?: string,
  engine?: BrowserEngine
): MultiCoreResolution {
  if (customPath && fs.existsSync(customPath)) {
    return {
      executablePath: customPath,
      majorVersion: engine === 'camoufox' ? extractFirefoxMajorVersion(userAgent) : extractChromeMajorVersion(userAgent),
      coreType: engine === 'camoufox' ? 'camoufox' : 'exact-multi-core',
      isExactVersionMatch: true,
    };
  }

  // Camoufox Dual-Engine check
  if (engine === 'camoufox' || (userAgent && userAgent.includes('Firefox') && !userAgent.includes('Chrome'))) {
    const camou = getCamoufoxExecutablePath();
    if (camou && fs.existsSync(camou)) {
      return {
        executablePath: camou,
        majorVersion: extractFirefoxMajorVersion(userAgent),
        coreType: 'camoufox',
        isExactVersionMatch: true,
      };
    }
    if (engine === 'camoufox') {
      throw new Error(
        'Camoufox engine executable not found. Please install Camoufox or set the CAMOUFOX_EXECUTABLE_PATH environment variable. (MAHI Anti-Detect never falsely substitutes Chromium for Camoufox).'
      );
    }
  }

  const major = extractChromeMajorVersion(userAgent);
  const home = os.homedir();
  const exeName = os.platform() === 'win32' ? 'chrome.exe' : 'chrome';

  // 1. Search in MAHI multi-core storage directory (~/.mahi/cores/)
  if (major) {
    const mahiCoreCandidates = [
      path.join(home, '.mahi', 'cores', `chrome-${major}`, exeName),
      path.join(home, '.mahi', 'cores', `mahi-${major}`, exeName),
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
  }

  // 2. Bundled production engine (Clean Chromium 138 shipped inside MAHI Browser package)
  const bundled = getBundledEngineExecutablePath();
  if (bundled && fs.existsSync(bundled)) {
    const isExact = major ? CHROMIUM_PRODUCTION_VERSION.startsWith(`${major}.`) : false;
    return {
      executablePath: bundled,
      majorVersion: major,
      coreType: 'mahi-bundled',
      isExactVersionMatch: isExact,
    };
  }

  // 3. Managed production engine (%APPDATA%/mahi-browser/engines/)
  if (isProductionChromiumInstalled()) {
    const prod = getProductionChromiumExecutablePath();
    if (fs.existsSync(prod)) {
      const isExact = major ? CHROMIUM_PRODUCTION_VERSION.startsWith(`${major}.`) : false;
      return {
        executablePath: prod,
        majorVersion: major,
        coreType: 'mahi-managed',
        isExactVersionMatch: isExact,
      };
    }
  }

  if (isManagedEngineInstalled()) {
    const managed = getManagedEngineExecutablePath();
    if (fs.existsSync(managed)) {
      return {
        executablePath: managed,
        majorVersion: major,
        coreType: 'mahi-managed',
        isExactVersionMatch: false,
      };
    }
  }

  // 4. Fallback to primary custom stealth engine if configured in ~/.mahi/cores
  const customCorePath = getMahiCustomCorePath();
  if (customCorePath && fs.existsSync(customCorePath)) {
    const isMahi = customCorePath.includes('mahi-') || customCorePath.includes('chrome-');
    return {
      executablePath: customCorePath,
      majorVersion: major,
      coreType: isMahi ? 'mahi-custom-core' : 'stealth-orbita',
      isExactVersionMatch: false,
    };
  }

  // 5. Fallback to system Chromium / Google Chrome
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

  // 6. Hardcoded platform default
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

/**
 * Returns a list of major Chromium versions available locally with exact binary match.
 */
export function getAvailableCores(): number[] {
  const supported = [120, 124, 128, 130, 138, 149, 150];
  const available: number[] = [];
  for (const major of supported) {
    const res = resolveMultiCoreExecutablePath(`Chrome/${major}.0.0.0`);
    if (res.isExactVersionMatch) {
      available.push(major);
    }
  }
  return available;
}
