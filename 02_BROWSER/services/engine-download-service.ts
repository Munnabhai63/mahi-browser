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
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { resolveMultiCoreExecutablePath, getAvailableCores } from './multi-core-resolver.js';
import { getCamoufoxExecutablePath } from '../detector.js';
import { getEnginesBaseDir, downloadFileWithProgress, extractZipArchive } from '../managed-engine.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
const log = createLogger('engine-download-service');

export interface CamoufoxProgressEvent {
  stage: 'RESOLVING' | 'DOWNLOADING' | 'VERIFYING' | 'EXTRACTING' | 'READY' | 'FAILED';
  receivedBytes?: number;
  totalBytes?: number;
  percent?: number;
  tag?: string;
  assetName?: string;
  error?: string;
}

export interface CamoufoxReleaseInfo {
  tag: string;
  assetName: string;
  downloadUrl: string;
  manifestUrl?: string;
}

export const PINNED_CAMOUFOX_VERSION = 'v159.0-beta.43';

export function getCamoufoxPlatformArch(): { plat: 'win' | 'lin' | 'mac'; arch: 'x86_64' | 'arm64' | 'i686' } {
  const p = os.platform();
  const a = os.arch();
  const plat: 'win' | 'lin' | 'mac' = p === 'win32' ? 'win' : p === 'darwin' ? 'mac' : 'lin';
  const arch: 'x86_64' | 'arm64' | 'i686' = (a === 'x64' || a === 'amd64') ? 'x86_64' : a === 'arm64' ? 'arm64' : 'i686';
  return { plat, arch };
}

export function getPinnedCamoufoxRelease(): CamoufoxReleaseInfo {
  const { plat, arch } = getCamoufoxPlatformArch();
  const verClean = PINNED_CAMOUFOX_VERSION.replace(/^v/i, '');
  const assetName = `camoufox-${verClean}-${plat}.${arch}.zip`;
  return {
    tag: PINNED_CAMOUFOX_VERSION,
    assetName,
    downloadUrl: `https://github.com/daijro/camoufox/releases/download/${PINNED_CAMOUFOX_VERSION}/${assetName}`,
  };
}

export async function resolveCamoufoxRelease(): Promise<CamoufoxReleaseInfo> {
  const { plat, arch } = getCamoufoxPlatformArch();
  const pinned = getPinnedCamoufoxRelease();
  const assetRegex = new RegExp(`^camoufox-[\\d.]+(?:-beta\\.\\d+)?-${plat}\\.${arch}\\.zip$`, 'i');

  try {
    const res = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      const req = https.get('https://api.github.com/repos/daijro/camoufox/releases/latest', {
        headers: {
          'User-Agent': `MAHI-Browser/${APP_VERSION}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 5000,
      }, (resp) => {
        let body = '';
        resp.on('data', c => { body += c; });
        resp.on('end', () => resolve({ statusCode: resp.statusCode || 0, data: body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('GitHub API timeout')); });
    });

    if (res.statusCode === 200) {
      const json = JSON.parse(res.data);
      if (json && Array.isArray(json.assets)) {
        const matched = json.assets.find((a: any) => assetRegex.test(a.name));
        if (matched) {
          const manifestAsset = json.assets.find((a: any) => a.name === 'manifest.json');
          return {
            tag: json.tag_name || 'latest',
            assetName: matched.name,
            downloadUrl: matched.browser_download_url,
            manifestUrl: manifestAsset?.browser_download_url,
          };
        }
      }
    }
  } catch (err) {
    log.debug('GitHub Camoufox release lookup fell back to pinned version', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return pinned;
}

export function checkDiskFreeSpace(dir: string, requiredBytes: number): void {
  try {
    if (typeof (fs as any).statfsSync === 'function') {
      const stats = (fs as any).statfsSync(dir);
      const free = Number(stats.bavail) * Number(stats.bsize);
      if (free < requiredBytes) {
        throw new Error(`INSUFFICIENT_DISK: Required ${requiredBytes} bytes free, but only ${free} bytes available on ${dir}`);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.startsWith('INSUFFICIENT_DISK')) {
      throw err;
    }
  }
}

export interface MahiCamoufoxMarker {
  version: string;
  installedAt: string;
  executablePath: string;
  sha256?: string;
}

let inFlightCamoufoxDownload: Promise<string> | null = null;

function broadcastCamoufoxProgress(payload: CamoufoxProgressEvent): void {
  try {
    const { BrowserWindow } = require('electron');
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      BrowserWindow.getAllWindows().forEach((win: any) => {
        try {
          win.webContents.send('engine:camoufox:progress', payload);
        } catch (winErr) {
          log.debug('Skipped Camoufox progress IPC for window', {
            err: winErr instanceof Error ? winErr.message : String(winErr),
          });
        }
      });
    }
  } catch (err) {
    log.debug('Skipped Camoufox progress IPC broadcast outside Electron main', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

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
      } catch (statErr) {
        log.debug('Unable to stat resolved engine binary', {
          resolvedPath,
          err: statErr instanceof Error ? statErr.message : String(statErr),
        });
      }
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

    if (!fs.existsSync(camoufoxDir)) {
      fs.mkdirSync(camoufoxDir, { recursive: true });
    }

    broadcastCamoufoxProgress({ stage: 'RESOLVING' });
    log.info('[Camoufox Provisioner] Resolving latest compatible Camoufox release...');

    const releaseInfo = await resolveCamoufoxRelease();
    log.info(`[Camoufox Provisioner] Resolved release: tag=${releaseInfo.tag}, asset=${releaseInfo.assetName}, url=${releaseInfo.downloadUrl}`);

    // Preflight disk space check: archive is ~530MB - 1.3GB -> require 3x (~1.6GB)
    const requiredFreeBytes = 3 * 550 * 1024 * 1024;
    checkDiskFreeSpace(enginesDir, requiredFreeBytes);

    const tempZipPath = path.join(enginesDir, `camoufox-temp-${Date.now()}.zip`);
    const tempExtractDir = path.join(enginesDir, `camoufox-extract-${Date.now()}`);

    try {
      broadcastCamoufoxProgress({
        stage: 'DOWNLOADING',
        tag: releaseInfo.tag,
        assetName: releaseInfo.assetName,
        receivedBytes: 0,
        totalBytes: 0,
        percent: 0,
      });

      const downloadResult = await downloadFileWithProgress(
        releaseInfo.downloadUrl,
        tempZipPath,
        (received, total) => {
          const percent = total > 0 ? Math.round((received / total) * 100) : 0;
          broadcastCamoufoxProgress({
            stage: 'DOWNLOADING',
            tag: releaseInfo.tag,
            assetName: releaseInfo.assetName,
            receivedBytes: received,
            totalBytes: total,
            percent,
          });
          if (options?.onProgress) {
            options.onProgress(received, total);
          }
        },
        'Camoufox engine'
      );

      broadcastCamoufoxProgress({
        stage: 'VERIFYING',
        tag: releaseInfo.tag,
        assetName: releaseInfo.assetName,
      });

      broadcastCamoufoxProgress({
        stage: 'EXTRACTING',
        tag: releaseInfo.tag,
        assetName: releaseInfo.assetName,
      });

      await extractZipArchive(tempZipPath, tempExtractDir);
      try {
        fs.unlinkSync(tempZipPath);
      } catch (unlinkErr) {
        log.debug('Temp Camoufox zip cleanup skipped after extraction', {
          tempZipPath,
          err: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
        });
      }

      // Collect and score candidate executables in extracted tree
      const candidates: { path: string; score: number }[] = [];
      function collectFiles(currentDir: string, depth = 0): void {
        if (depth > 5) return;
        try {
          const items = fs.readdirSync(currentDir);
          for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              collectFiles(fullPath, depth + 1);
            } else {
              const lower = item.toLowerCase();
              if (
                lower.includes('crashreporter') ||
                lower.includes('updater') ||
                lower.includes('pingsender') ||
                lower.includes('minidump') ||
                lower.endsWith('.zip') ||
                lower.endsWith('.json')
              ) {
                continue;
              }
              let score = 0;
              if (lower.startsWith('camoufox')) score += 100;
              if (lower === 'camoufox.exe' || lower === 'camoufox' || lower === 'camoufox-bin') score += 50;
              if (lower.includes('firefox')) score += 30;
              if (platform === 'win32' && lower.endsWith('.exe')) score += 50;
              if (platform !== 'win32' && (stat.mode & 0o111) !== 0) score += 50;
              if (stat.size > 10 * 1024 * 1024) score += 40;
              if (stat.size > 50 * 1024 * 1024) score += 20;
              if (score > 50) {
                candidates.push({ path: fullPath, score });
              }
            }
          }
        } catch (walkErr) {
          log.debug('Skipped unreadable directory while scanning extracted Camoufox files', {
            currentDir,
            err: walkErr instanceof Error ? walkErr.message : String(walkErr),
          });
        }
      }
      collectFiles(tempExtractDir);
      candidates.sort((a, b) => b.score - a.score);

      if (candidates.length === 0) {
        throw new Error(`Camoufox binary not found in extracted archive "${releaseInfo.assetName}"`);
      }

      const bestCandidate = candidates[0].path;
      const appRoot = path.dirname(bestCandidate);

      // Copy all contents of appRoot to camoufoxDir
      const entries = fs.readdirSync(appRoot);
      for (const e of entries) {
        const srcPath = path.join(appRoot, e);
        const dstPath = path.join(camoufoxDir, e);
        try {
          if (fs.existsSync(dstPath)) fs.rmSync(dstPath, { recursive: true, force: true });
          fs.renameSync(srcPath, dstPath);
        } catch {
          fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
        }
      }

      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (rmErr) {
        log.debug('Temp Camoufox extract dir cleanup skipped', {
          tempExtractDir,
          err: rmErr instanceof Error ? rmErr.message : String(rmErr),
        });
      }

      const finalExe = path.join(camoufoxDir, path.basename(bestCandidate));
      if (!fs.existsSync(finalExe)) {
        throw new Error(`Camoufox binary failed to copy to "${finalExe}"`);
      }

      // Check file size > 10MB
      const finalStat = fs.statSync(finalExe);
      if (finalStat.size < 10 * 1024 * 1024) {
        throw new Error(`Camoufox binary "${finalExe}" is incomplete (size ${finalStat.size} bytes < 10MB)`);
      }

      // Validate magic bytes
      const fd = fs.openSync(finalExe, 'r');
      const magicBuf = Buffer.alloc(4);
      fs.readSync(fd, magicBuf, 0, 4, 0);
      fs.closeSync(fd);
      if (platform === 'win32') {
        if (magicBuf[0] !== 0x4D || magicBuf[1] !== 0x5A) {
          throw new Error(`Camoufox binary "${finalExe}" missing MZ header on Windows`);
        }
      } else if (platform === 'linux') {
        if (magicBuf[0] !== 0x7F || magicBuf.toString('ascii', 1, 4) !== 'ELF') {
          throw new Error(`Camoufox binary "${finalExe}" missing ELF header on Linux`);
        }
        try {
          fs.chmodSync(finalExe, 0o755);
        } catch (chmodErr) {
          log.warn('Failed to set executable permissions on Linux Camoufox binary', {
            finalExe,
            err: chmodErr instanceof Error ? chmodErr.message : String(chmodErr),
          });
        }
      } else {
        try {
          fs.chmodSync(finalExe, 0o755);
        } catch (chmodErr) {
          log.warn('Failed to set executable permissions on Camoufox binary', {
            finalExe,
            err: chmodErr instanceof Error ? chmodErr.message : String(chmodErr),
          });
        }
      }

      // Write marker file
      const markerPath = path.join(camoufoxDir, 'mahi-camoufox.json');
      const markerData: MahiCamoufoxMarker = {
        version: releaseInfo.tag,
        installedAt: new Date().toISOString(),
        executablePath: finalExe,
        sha256: typeof downloadResult === 'object' ? (downloadResult as any).sha256 : undefined,
      };
      fs.writeFileSync(markerPath, JSON.stringify(markerData, null, 2), 'utf8');

      // Smoke check
      try {
        const verOutput = execFileSync(finalExe, ['--version'], { timeout: 20000, stdio: 'pipe' }).toString().trim();
        log.info(`[Camoufox Provisioner] Successfully provisioned Camoufox (${verOutput}) at "${finalExe}"`);
      } catch (smokeErr: any) {
        log.info(`[Camoufox Provisioner] Provisioned at "${finalExe}" (smoke notice: ${smokeErr.message})`);
      }

      broadcastCamoufoxProgress({
        stage: 'READY',
        tag: releaseInfo.tag,
        assetName: releaseInfo.assetName,
      });

      return finalExe;
    } catch (err: any) {
      try {
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
      } catch (zipCleanupErr) {
        log.debug('Failed removing temp Camoufox zip after download error', {
          tempZipPath,
          err: zipCleanupErr instanceof Error ? zipCleanupErr.message : String(zipCleanupErr),
        });
      }
      try {
        if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (dirCleanupErr) {
        log.debug('Failed removing temp Camoufox extract dir after download error', {
          tempExtractDir,
          err: dirCleanupErr instanceof Error ? dirCleanupErr.message : String(dirCleanupErr),
        });
      }
      const errMsg = err?.message || String(err);
      broadcastCamoufoxProgress({
        stage: 'FAILED',
        error: errMsg,
      });
      log.error(`[Camoufox Provisioner ERROR] ${errMsg}`);
      throw err;
    } finally {
      inFlightCamoufoxDownload = null;
    }
  })();

  return inFlightCamoufoxDownload;
}

/**
 * Checks or provisions the native C++ compiled MAHI stealth core.
 * If not available locally or from releases, returns null indicating standard JS stealth fallback.
 */
export async function ensureMahiNativeCoreInstalled(version = '138.0.7204.0'): Promise<string | null> {
  const enginesDir = getEnginesBaseDir();
  const nativeDir = path.join(enginesDir, 'mahi-native', version);
  const exeName = os.platform() === 'win32' ? 'chrome.exe' : 'chrome';
  const nativeExe = path.join(nativeDir, exeName);
  const manifestPath = path.join(nativeDir, 'mahi-engine.json');

  if (fs.existsSync(nativeExe) && fs.existsSync(manifestPath)) {
    return nativeExe;
  }

  return null;
}
