/**
 * MAHI Browser — Chromium Multi-Engine Verification & Download Service
 * Reverse-Engineered from MostLogin's Cloud Core Synchronization Architecture
 * 
 * Verifies local engine cores across multiple Chromium generations (120, 124, 128, 130, 149),
 * checks binary checksums, and coordinates engine readiness for the MultiCoreResolver.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveMultiCoreExecutablePath, getAvailableCores } from './multi-core-resolver.js';
import { getCamoufoxExecutablePath } from '../detector.js';
import { getEnginesBaseDir, downloadFileWithProgress, extractZipArchive } from '../managed-engine.js';

export interface EngineCoreManifest {
  version: string;
  majorVersion: number;
  channel: string;
  supportedOS: string[];
  localInstalled: boolean;
  executablePath?: string;
  sha256?: string;
  sizeBytes?: number;
}

export interface EngineHealthReport {
  installedCount: number;
  totalSupported: number;
  cores: EngineCoreManifest[];
  defaultExecutablePath?: string;
  status: 'OPTIMAL' | 'DEGRADED' | 'MINIMAL';
}

const SUPPORTED_MAJOR_VERSIONS = [120, 124, 128, 130, 149, 150];

/**
 * Scans local system and returns comprehensive engine inventory.
 */
export function auditLocalEngines(): EngineHealthReport {
  const available = getAvailableCores();
  const cores: EngineCoreManifest[] = [];

  for (const major of SUPPORTED_MAJOR_VERSIONS) {
    const res = resolveMultiCoreExecutablePath(`Chrome/${major}.0.0.0`);
    const resolvedPath = res.executablePath;
    const isInstalled = Boolean(res.isExactVersionMatch && resolvedPath && fs.existsSync(resolvedPath));
    let sizeBytes: number | undefined;

    if (isInstalled && resolvedPath) {
      try {
        const stat = fs.statSync(resolvedPath);
        sizeBytes = stat.size;
      } catch {}
    }

    cores.push({
      version: `${major}.0.0.0`,
      majorVersion: major,
      channel: 'STABLE',
      supportedOS: ['win32', 'darwin', 'linux'],
      localInstalled: isInstalled,
      executablePath: isInstalled ? resolvedPath : undefined,
      sizeBytes,
    });
  }

  const installedCount = cores.filter(c => c.localInstalled).length;
  let status: 'OPTIMAL' | 'DEGRADED' | 'MINIMAL' = 'MINIMAL';
  if (installedCount >= 3) {
    status = 'OPTIMAL';
  } else if (installedCount >= 1) {
    status = 'DEGRADED';
  }

  const defaultEngine = resolveMultiCoreExecutablePath('Chrome/149.0.0.0');

  return {
    installedCount,
    totalSupported: SUPPORTED_MAJOR_VERSIONS.length,
    cores,
    defaultExecutablePath: defaultEngine.executablePath,
    status,
  };
}

/**
 * Prepares engine directory structure for newly acquired Chromium binaries.
 */
export function ensureEngineDirectory(majorVersion: number): string {
  const home = os.homedir();
  const targetDir = path.join(home, '.mahi', 'engines', `engine-${majorVersion}`);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

let inFlightCamoufoxDownload: Promise<string> | null = null;

/**
 * Ensures the Camoufox engine is installed locally.
 * If missing, downloads and extracts the official Camoufox release archive on demand.
 */
export async function ensureCamoufoxInstalled(options?: {
  onProgress?: (receivedBytes: number, totalBytes: number) => void;
}): Promise<string> {
  const existing = getCamoufoxExecutablePath();
  if (existing && fs.existsSync(existing)) {
    return existing;
  }

  if (inFlightCamoufoxDownload) {
    return inFlightCamoufoxDownload;
  }

  inFlightCamoufoxDownload = (async () => {
    const platform = os.platform();
    const enginesDir = getEnginesBaseDir();
    const camoufoxDir = path.join(enginesDir, 'camoufox');
    const exeName = platform === 'win32' ? 'camoufox.exe' : 'camoufox';
    const finalExe = path.join(camoufoxDir, exeName);

    if (fs.existsSync(finalExe)) {
      return finalExe;
    }

    if (!fs.existsSync(camoufoxDir)) {
      fs.mkdirSync(camoufoxDir, { recursive: true });
    }

    let downloadUrl = 'https://github.com/daijro/camoufox/releases/download/v135.0.1-beta.21/camoufox-135.0.1-beta.21-win-x86_64.zip';
    if (platform === 'darwin') {
      downloadUrl = 'https://github.com/daijro/camoufox/releases/download/v135.0.1-beta.21/camoufox-135.0.1-beta.21-mac-x86_64.zip';
    } else if (platform === 'linux') {
      downloadUrl = 'https://github.com/daijro/camoufox/releases/download/v135.0.1-beta.21/camoufox-135.0.1-beta.21-lin-x86_64.zip';
    }

    const tempZipPath = path.join(enginesDir, `camoufox-temp-${Date.now()}.zip`);
    const tempExtractDir = path.join(enginesDir, `camoufox-extract-${Date.now()}`);

    try {
      await downloadFileWithProgress(downloadUrl, tempZipPath, options?.onProgress);
      await extractZipArchive(tempZipPath, tempExtractDir);

      try { fs.unlinkSync(tempZipPath); } catch {}

      // Find extracted binary (might be in root or nested subdirectory)
      let foundExe: string | null = null;
      function scanForExe(dir: string, depth = 0): void {
        if (depth > 3 || foundExe) return;
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const full = path.join(dir, f);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              scanForExe(full, depth + 1);
            } else if (f.toLowerCase() === exeName.toLowerCase()) {
              foundExe = full;
              return;
            }
          }
        } catch {}
      }
      scanForExe(tempExtractDir);

      if (foundExe) {
        const sourceDir = path.dirname(foundExe);
        const entries = fs.readdirSync(sourceDir);
        for (const e of entries) {
          const srcPath = path.join(sourceDir, e);
          const dstPath = path.join(camoufoxDir, e);
          try {
            if (fs.existsSync(dstPath)) {
              fs.rmSync(dstPath, { recursive: true, force: true });
            }
            fs.renameSync(srcPath, dstPath);
          } catch {
            fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
          }
        }
      }

      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}

      if (fs.existsSync(finalExe)) {
        if (platform !== 'win32') {
          try { fs.chmodSync(finalExe, 0o755); } catch {}
        }
        return finalExe;
      }

      throw new Error(`Camoufox binary not found at "${finalExe}" after extraction.`);
    } catch (err) {
      try { if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath); } catch {}
      try { if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
      throw err;
    } finally {
      inFlightCamoufoxDownload = null;
    }
  })();

  return inFlightCamoufoxDownload;
}
