import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  MANAGED_ENGINE_VERSION,
  MANAGED_ENGINE_SHA256,
  MANAGED_ENGINE_DOWNLOAD_URL,
  MANAGED_ENGINE_FALLBACK_URL,
  GOOGLE_CFT_MANIFEST_URL,
  MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES,
} from '../10_CONFIG/engine-config.js';

const execAsync = promisify(exec);

export type ManagedEngineStage =
  | 'IDLE'
  | 'CHECKING'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'EXTRACTING'
  | 'READY'
  | 'ERROR';

export interface ManagedEngineProgress {
  stage: ManagedEngineStage;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
  version: string;
}

export type ProgressListener = (progress: ManagedEngineProgress) => void;

const listeners: Set<ProgressListener> = new Set();
let currentProgress: ManagedEngineProgress = {
  stage: 'IDLE',
  percent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  version: MANAGED_ENGINE_VERSION,
};

let inFlightDownloadPromise: Promise<string> | null = null;

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else console.log(msg);
}

export function addManagedEngineProgressListener(listener: ProgressListener): () => void {
  listeners.add(listener);
  // Send current status immediately
  try {
    listener(currentProgress);
  } catch {}
  return () => {
    listeners.delete(listener);
  };
}

export function getManagedEngineCurrentProgress(): ManagedEngineProgress {
  return { ...currentProgress };
}

function broadcastProgress(update: Partial<ManagedEngineProgress>) {
  currentProgress = {
    ...currentProgress,
    ...update,
    version: MANAGED_ENGINE_VERSION,
  };
  for (const l of listeners) {
    try {
      l(currentProgress);
    } catch {}
  }
}

/**
 * Resolves the root user data directory for MAHI BROWSER.
 * Uses Electron app.getPath('userData') in runtime, or .mahi_data in headless/test environments.
 */
export function getUserDataPath(): string {
  try {
    // Dynamic require so module works cleanly in both main process and standalone tests
    const electron = require('electron');
    const app = electron?.app || electron?.default?.app;
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {}

  return path.join(process.cwd(), '.mahi_data');
}

/**
 * Root directory where all managed engines are housed.
 */
export function getEnginesBaseDir(): string {
  return path.join(getUserDataPath(), 'engines');
}

/**
 * Returns the exact absolute path to the managed chrome.exe binary for a specific or current version.
 */
export function getManagedEngineExecutablePath(version: string = MANAGED_ENGINE_VERSION): string {
  return path.join(getEnginesBaseDir(), version, 'chrome-win64', 'chrome.exe');
}

/**
 * Checks whether the managed browser engine binary exists on disk and is ready to launch.
 */
export function isManagedEngineInstalled(version: string = MANAGED_ENGINE_VERSION): boolean {
  const exePath = getManagedEngineExecutablePath(version);
  return fs.existsSync(exePath);
}

/**
 * Validates available disk space on the target installation drive.
 * Requires at least 1GB (1,073,741,824 bytes) free.
 */
export function checkDiskSpace(
  targetDir: string = getEnginesBaseDir(),
  requiredBytes: number = MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES
): { ok: boolean; freeBytes: number } {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const stat = fs.statfsSync(targetDir);
    const freeBytes = Number(BigInt(stat.bavail) * BigInt(stat.bsize));
    return { ok: freeBytes >= requiredBytes, freeBytes };
  } catch {
    try {
      const root = path.parse(path.resolve(targetDir)).root || 'C:\\';
      const stat = fs.statfsSync(root);
      const freeBytes = Number(BigInt(stat.bavail) * BigInt(stat.bsize));
      return { ok: freeBytes >= requiredBytes, freeBytes };
    } catch {
      return { ok: true, freeBytes: requiredBytes * 2 };
    }
  }
}

/**
 * Validates Google's official known-good manifest to ensure the version is authentic
 * and returns the official win64 download URL.
 */
export async function verifyManifestDownloadUrl(version: string = MANAGED_ENGINE_VERSION): Promise<string> {
  const res = await fetch(GOOGLE_CFT_MANIFEST_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google Chrome for Testing manifest (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const entry = data?.versions?.find((v: any) => v.version === version);
  if (!entry) {
    throw new Error(`Version ${version} was not found in Google Chrome for Testing official manifest.`);
  }

  const win64Download = entry.downloads?.chrome?.find((d: any) => d.platform === 'win64');
  if (!win64Download || !win64Download.url) {
    throw new Error(`Official win64 download URL for version ${version} not found in manifest.`);
  }

  return win64Download.url;
}

/**
 * Internal helper to download a URL with redirect handling and progress tracking.
 */
function downloadFileWithProgress(
  url: string,
  destinationPath: string,
  onProgress?: (received: number, total: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    function makeRequest(currentUrl: string, redirectCount = 0) {
      if (redirectCount > 5) {
        reject(new Error('Too many HTTP redirects encountered while downloading browser engine.'));
        return;
      }

      const client = currentUrl.startsWith('https') ? https : http;
      client
        .get(currentUrl, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume();
            makeRequest(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            response.resume();
            reject(
              new Error(
                `Failed to download engine from Google CDN: HTTP ${response.statusCode} (${response.statusMessage})`
              )
            );
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          let receivedBytes = 0;

          const fileStream = fs.createWriteStream(destinationPath);
          const hash = crypto.createHash('sha256');

          response.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            hash.update(chunk);
            if (onProgress && totalBytes > 0) {
              onProgress(receivedBytes, totalBytes);
            }
          });

          response.on('error', (err) => {
            fileStream.close();
            try { fs.unlinkSync(destinationPath); } catch {}
            reject(err);
          });

          fileStream.on('error', (err) => {
            fileStream.close();
            try { fs.unlinkSync(destinationPath); } catch {}
            reject(err);
          });

          fileStream.on('finish', () => {
            fileStream.close(() => {
              const computedSha = hash.digest('hex');
              resolve(computedSha);
            });
          });

          response.pipe(fileStream);
        })
        .on('error', (err) => {
          try { fs.unlinkSync(destinationPath); } catch {}
          reject(err);
        });
    }

    makeRequest(url);
  });
}

/**
 * Extracts a zip archive to a destination directory using system tar (bsdtar) or PowerShell.
 */
async function extractZipArchive(zipPath: string, destDir: string): Promise<void> {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  try {
    // bsdtar is built into Windows 10/11 and extracts zip archives fast and reliably
    await execAsync(`tar -xf "${zipPath}" -C "${destDir}"`);
  } catch (tarErr) {
    debugLog(`[ManagedEngine] Native tar extraction failed, falling back to PowerShell: ${tarErr}`);
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force"`
    );
  }
}

/**
 * Cleans up old engine versions that do not match the current pinned version.
 * Keeps disk usage tight and predictable.
 */
export function cleanOldEngineVersions(keepVersion: string = MANAGED_ENGINE_VERSION): void {
  try {
    const enginesDir = getEnginesBaseDir();
    if (!fs.existsSync(enginesDir)) return;

    const entries = fs.readdirSync(enginesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderName = entry.name;
        // Clean up stale interrupted .tmp folders or previous versions
        if (folderName.includes('.tmp-') || folderName !== keepVersion) {
          debugLog(`[ManagedEngine] Removing old engine version directory: ${folderName}`);
          try {
            fs.rmSync(path.join(enginesDir, folderName), { recursive: true, force: true });
          } catch (err) {
            debugLog(`[ManagedEngine] Warning: Could not remove old engine folder ${folderName}: ${err}`);
          }
        }
      }
    }
  } catch (err) {
    debugLog(`[ManagedEngine] Error inspecting engines folder for cleanup: ${err}`);
  }
}

/**
 * Ensures the managed browser engine is fully downloaded, verified, and extracted.
 * Guarantees atomicity: partial downloads never corrupt the directory.
 * If multiple callers invoke concurrently, returns the same in-flight promise.
 */
export async function ensureManagedEngineInstalled(options?: {
  onProgress?: (progress: ManagedEngineProgress) => void;
  skipManifestCheck?: boolean;
}): Promise<string> {
  const version = MANAGED_ENGINE_VERSION;
  const finalExe = getManagedEngineExecutablePath(version);

  // If already installed and verified, return immediately
  if (fs.existsSync(finalExe)) {
    broadcastProgress({
      stage: 'READY',
      percent: 100,
      downloadedBytes: 0,
      totalBytes: 0,
    });
    return finalExe;
  }

  // If download is already in flight, await existing promise
  if (inFlightDownloadPromise) {
    if (options?.onProgress) {
      addManagedEngineProgressListener(options.onProgress);
    }
    return await inFlightDownloadPromise;
  }

  if (options?.onProgress) {
    addManagedEngineProgressListener(options.onProgress);
  }

  inFlightDownloadPromise = (async () => {
    const enginesDir = getEnginesBaseDir();
    const finalVersionDir = path.join(enginesDir, version);
    const tempWorkingDir = path.join(enginesDir, `${version}.tmp-${Date.now()}`);
    const tempZipPath = path.join(tempWorkingDir, 'chrome-win64.zip');

    try {
      // Step 1: Disk Space Check (Require 1GB)
      broadcastProgress({ stage: 'CHECKING', percent: 0, downloadedBytes: 0, totalBytes: 0 });
      const space = checkDiskSpace(enginesDir, MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES);
      if (!space.ok) {
        const freeMB = Math.round(space.freeBytes / (1024 * 1024));
        const errMsg = `Insufficient disk space for browser engine. 1 GB required, only ${freeMB} MB available. Please free up disk space and click Retry.`;
        broadcastProgress({ stage: 'ERROR', error: errMsg });
        throw new Error(errMsg);
      }

      // Step 2: Clean up any stale partial downloads from previous crashes
      cleanOldEngineVersions(version);
      fs.mkdirSync(tempWorkingDir, { recursive: true });

      // Step 3: Determine authoritative Google CDN URL
      let downloadUrl = MANAGED_ENGINE_DOWNLOAD_URL;
      if (!options?.skipManifestCheck) {
        try {
          downloadUrl = await verifyManifestDownloadUrl(version);
        } catch (manifestErr: any) {
          debugLog(`[ManagedEngine] Manifest check failed or offline: ${manifestErr?.message}. Using pinned Google CDN URL.`);
        }
      }

      // Step 4: Download Chrome for Testing win64 zip with mirror fallback
      debugLog(`[ManagedEngine] Downloading Chrome for Testing ${version} from: ${downloadUrl}`);
      broadcastProgress({ stage: 'DOWNLOADING', percent: 0, downloadedBytes: 0, totalBytes: 172647459 });

      const progressCallback = (downloaded: number, total: number) => {
        const percent = Math.min(100, Math.round((downloaded / total) * 100));
        broadcastProgress({
          stage: 'DOWNLOADING',
          percent,
          downloadedBytes: downloaded,
          totalBytes: total,
        });
      };

      let computedSha256 = '';
      try {
        computedSha256 = await downloadFileWithProgress(
          downloadUrl,
          tempZipPath,
          progressCallback
        );
      } catch (primaryErr: any) {
        debugLog(`[ManagedEngine] Primary download failed: ${primaryErr?.message}. Falling back to mirror: ${MANAGED_ENGINE_FALLBACK_URL}`);
        if (fs.existsSync(tempZipPath)) {
          try { fs.unlinkSync(tempZipPath); } catch {}
        }
        computedSha256 = await downloadFileWithProgress(
          MANAGED_ENGINE_FALLBACK_URL,
          tempZipPath,
          progressCallback
        );
      }

      // Step 5: Verify SHA-256 Checksum
      broadcastProgress({ stage: 'VERIFYING', percent: 100 });
      debugLog(`[ManagedEngine] Downloaded zip SHA-256: ${computedSha256}`);
      if (MANAGED_ENGINE_SHA256 && computedSha256.toLowerCase() !== MANAGED_ENGINE_SHA256.toLowerCase()) {
        const hashErr = `SHA-256 checksum mismatch for Chrome for Testing ${version}. Expected ${MANAGED_ENGINE_SHA256}, got ${computedSha256}.`;
        broadcastProgress({ stage: 'ERROR', error: hashErr });
        throw new Error(hashErr);
      }

      // Step 6: Extract archive
      broadcastProgress({ stage: 'EXTRACTING', percent: 100 });
      debugLog(`[ManagedEngine] Extracting engine zip to: ${tempWorkingDir}`);
      await extractZipArchive(tempZipPath, tempWorkingDir);

      // Remove the 170MB zip file after extraction to free disk space immediately
      try {
        fs.unlinkSync(tempZipPath);
      } catch {}

      // Verify that chrome.exe exists in extracted content
      const extractedExe = path.join(tempWorkingDir, 'chrome-win64', 'chrome.exe');
      if (!fs.existsSync(extractedExe)) {
        throw new Error(`Extracted engine is missing expected binary at "${extractedExe}".`);
      }

      // Step 7: Atomically move into place
      debugLog(`[ManagedEngine] Atomically renaming ${tempWorkingDir} -> ${finalVersionDir}`);
      if (fs.existsSync(finalVersionDir)) {
        try {
          fs.rmSync(finalVersionDir, { recursive: true, force: true });
        } catch {}
      }
      fs.renameSync(tempWorkingDir, finalVersionDir);

      // Step 8: Clean up old versions
      cleanOldEngineVersions(version);

      broadcastProgress({ stage: 'READY', percent: 100 });
      debugLog(`[ManagedEngine] Managed browser engine ${version} successfully installed at: ${finalExe}`);
      return finalExe;
    } catch (err: any) {
      // Clean up interrupted temp directory
      try {
        if (fs.existsSync(tempWorkingDir)) {
          fs.rmSync(tempWorkingDir, { recursive: true, force: true });
        }
      } catch {}

      const errorMsg = err instanceof Error ? err.message : String(err);
      broadcastProgress({ stage: 'ERROR', error: errorMsg });
      throw err;
    } finally {
      inFlightDownloadPromise = null;
    }
  })();

  return await inFlightDownloadPromise;
}
