import { app, BrowserWindow } from '../../08_SECURITY/electron-bridge.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type {
  UpdateState,
  UpdateChannel,
  UpdateProgress,
  UpdateStatusEvent,
  UpdateConfig,
  UpdateInstallOptions,
  UpdateInstallResult,
  UpdateReleaseFile,
  UpdateReleaseManifest,
} from '../../10_CONFIG/shared/types/updater.js';
import { logActivity } from './audit-service.js';
import {
  compareSemVer,
  isValidTransition,
  validateUpdateManifest,
  verifyFileIntegrity,
} from './updater-validator.js';
import { getActiveUpdateProvider } from './updater-provider.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { flushDatabaseToDisk } from '../../06_DATABASE/connection.js';
import { getWritableUserDataDir } from '../utils/runtime-paths.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { getDefaultUpdateFeedUrl, getSiteConfig } from '../../10_CONFIG/shared/site-config.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('updater-service');

function safeLogActivity(level: 'INFO' | 'WARNING' | 'ERROR', action: string, details: string) {
  try {
    logActivity('SYSTEM', level, action, details);
  } catch (err) {
    log.debug('Updater audit log skipped', {
      action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export const DEFAULT_UPDATE_FEED_URL = getDefaultUpdateFeedUrl();
export const UPDATE_FEED_URL = DEFAULT_UPDATE_FEED_URL;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getAllowedUpdateFeedHosts(): string[] {
  const hosts = new Set<string>(['mahibrowser.com', 'www.mahibrowser.com']);
  try {
    const parsedSite = new URL(getSiteConfig({ productionFallback: true }).websiteUrl);
    if (parsedSite.protocol === 'https:') {
      hosts.add(parsedSite.hostname.toLowerCase());
    }
    const parsedFeed = new URL(getDefaultUpdateFeedUrl());
    if (parsedFeed.protocol === 'https:') {
      hosts.add(parsedFeed.hostname.toLowerCase());
    }
  } catch (err) {
    // Keep canonical hosts if env feed/website URL is malformed
    log.debug('Allowed update feed URL parse fell back to defaults', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return Array.from(hosts);
}

/**
 * Any feed URL that is not https on the allowed hosts collapses to the production
 * default. This defends against a stale localhost port written by a test run, a
 * tampered updater_config.json, and a compromised renderer.
 */
export function sanitizeFeedUrl(input: unknown): string {
  const defaultFeed = getDefaultUpdateFeedUrl();
  try {
    if (typeof input !== 'string' || !input.trim()) return defaultFeed;
    const u = new URL(input.trim());
    if (u.protocol !== 'https:') return defaultFeed;
    if (!getAllowedUpdateFeedHosts().includes(u.hostname.toLowerCase())) return defaultFeed;
    const s = u.toString();
    return s.endsWith('/') ? s : `${s}/`;
  } catch {
    return defaultFeed;
  }
}

export { compareSemVer, isValidTransition };
export type UpdaterState = UpdateState;

function getConfigPath(): string {
  return path.join(getWritableUserDataDir(), 'updater_config.json');
}

export function loadUpdateConfig(): UpdateConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        channel: data.channel === 'BETA' ? 'BETA' : 'STABLE',
        autoCheck: data.autoCheck !== false,
        autoDownload: data.autoDownload !== false,
        notifyBeforeRestart: data.notifyBeforeRestart !== false,
        feedUrl: sanitizeFeedUrl(data.feedUrl),
        lastCheckedAt: data.lastCheckedAt,
      };
    }
  } catch (err) {
    log.warn('Failed reading updater_config.json; using defaults', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    channel: 'STABLE',
    autoCheck: true,
    autoDownload: true,
    notifyBeforeRestart: true,
    feedUrl: getDefaultUpdateFeedUrl(),
  };
}

export function saveUpdateConfig(config: UpdateConfig): void {
  try {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    log.error('[UpdaterService] Failed to save config:', err);
  }
}

export function getSafeAppVersion(): string {
  try {
    if (app && typeof app.getVersion === 'function') {
      const v = app.getVersion();
      if (v) return v;
    }
  } catch (err) {
    log.debug('app.getVersion unavailable outside packaged Electron', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return APP_VERSION;
}

interface AutoUpdaterUpdateInfo {
  version: string;
  releaseNotes?: unknown;
}

interface AutoUpdaterLike {
  channel: string;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  setFeedURL(options: { provider: 'generic'; url: string }): void;
  on(event: 'checking-for-update' | 'update-not-available', handler: () => void): void;
  on(event: 'update-available' | 'update-downloaded', handler: (info: AutoUpdaterUpdateInfo) => void): void;
  on(event: 'download-progress', handler: (progressObj: UpdateProgress) => void): void;
  on(event: 'error', handler: (err: unknown) => void): void;
  checkForUpdates(): Promise<{ updateInfo?: AutoUpdaterUpdateInfo | null } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

const esmRequire = createRequire(import.meta.url);
let autoUpdaterInstance: AutoUpdaterLike | null = null;

function getAutoUpdater(): AutoUpdaterLike | null {
  if (autoUpdaterInstance) return autoUpdaterInstance;
  try {
    const updaterMod = esmRequire('electron-updater') as {
      autoUpdater?: AutoUpdaterLike;
      default?: { autoUpdater?: AutoUpdaterLike };
    } & Partial<AutoUpdaterLike>;
    autoUpdaterInstance =
      updaterMod.autoUpdater ||
      updaterMod.default?.autoUpdater ||
      (updaterMod as AutoUpdaterLike);
    return autoUpdaterInstance;
  } catch (err: unknown) {
    log.warn('[UpdaterService] Failed to load autoUpdater:', err);
    return null;
  }
}

let activeConfig = loadUpdateConfig();
let updateStatus: UpdateStatusEvent = {
  state: 'IDLE',
  currentVersion: getSafeAppVersion(),
  channel: activeConfig.channel,
};

let currentPendingManifest: UpdateReleaseManifest | null = null;
let isManualCheck = false;
let recurringTimer: NodeJS.Timeout | null = null;
let isInitialized = false;

export function broadcastStatus(status: UpdateStatusEvent): void {
  updateStatus = {
    ...status,
    currentVersion: getSafeAppVersion(),
    channel: activeConfig.channel,
  };

  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('updater:statusChanged', updateStatus);
        }
      });
    } catch (ipcErr) {
      log.debug('Skipped updater status IPC broadcast', {
        err: ipcErr instanceof Error ? ipcErr.message : String(ipcErr),
      });
    }
  }
}

/**
 * IN-PLACE AUTO-UPDATE & USER DATA SAFETY CHECKLIST (v1.2.x -> Major Update)
 * - Existing user profiles, cookies, extensions, licenses, and settings JSON are never deleted or rewritten destructively on load.
 * - `initializeDatabase()` calls `backupDatabaseBeforeMigration()` (retaining up to 5 timestamped pre-upgrade snapshots) and tracks `app_schema_version`.
 * - `snapshotSyncConfigFirstRun()` preserves `cloud-sync-config.json` & `cloud-profile-bindings.json` once before updates touch sync settings.
 * - `parseStoredProfileSettings()` treats missing/legacy fields with runtime fallbacks without mutating stored DB rows.
 * - Shutdown hook stops running browsers cleanly (`processManager`) and flushes SQLite (`flushDatabaseToDisk()`) before `quitAndInstall()`.
 */
export function initAutoUpdater(): void {
  if (isInitialized) return;
  isInitialized = true;
  activeConfig = loadUpdateConfig();

  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;

  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: sanitizeFeedUrl(activeConfig.feedUrl),
    });
    autoUpdater.channel = activeConfig.channel === 'BETA' ? 'beta' : 'latest';
    autoUpdater.autoDownload = activeConfig.autoDownload;
    autoUpdater.autoInstallOnAppQuit = activeConfig.notifyBeforeRestart === false;

    autoUpdater.on('checking-for-update', () => {
      if (isManualCheck) {
        broadcastStatus({
          state: 'CHECKING',
          currentVersion: getSafeAppVersion(),
        });
      }
    });

    autoUpdater.on('update-available', (info: AutoUpdaterUpdateInfo) => {
      safeLogActivity('INFO', 'Auto-Updater', `Update available: v${info.version} (Channel: ${activeConfig.channel})`);
      updateStatus = {
        state: 'AVAILABLE',
        currentVersion: getSafeAppVersion(),
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      };
      if (isManualCheck || !activeConfig.autoDownload) {
        broadcastStatus(updateStatus);
      }
    });

    autoUpdater.on('update-not-available', () => {
      updateStatus = {
        state: 'NOT_AVAILABLE',
        currentVersion: getSafeAppVersion(),
      };
      if (isManualCheck) {
        broadcastStatus(updateStatus);
      }
      isManualCheck = false;
    });

    autoUpdater.on('download-progress', (progressObj: UpdateProgress) => {
      updateStatus = {
        state: 'DOWNLOADING',
        currentVersion: getSafeAppVersion(),
        availableVersion: updateStatus.availableVersion,
        progress: {
          bytesPerSecond: progressObj.bytesPerSecond,
          percent: Math.round(progressObj.percent),
          total: progressObj.total,
          transferred: progressObj.transferred,
        },
      };
      broadcastStatus(updateStatus);
    });

    autoUpdater.on('update-downloaded', (info: AutoUpdaterUpdateInfo) => {
      updateStatus = {
        state: 'DOWNLOADED',
        currentVersion: getSafeAppVersion(),
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      };
      broadcastStatus(updateStatus);
      safeLogActivity('INFO', 'Auto-Updater', `Update v${info.version} downloaded and verified. Ready to install.`);
    });

    autoUpdater.on('error', (err: unknown) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      safeLogActivity('WARNING', 'Auto-Updater', `Update check/download notice: ${errorMsg}`);

      updateStatus = {
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: errorMsg,
      };
      if (isManualCheck) {
        broadcastStatus(updateStatus);
      }
      isManualCheck = false;
    });
  } catch (initErr) {
    log.warn('[UpdaterService] AutoUpdater initialization warning:', initErr);
  }

  // Periodic check if autoCheck is enabled
  if (app?.isPackaged && activeConfig.autoCheck) {
    setTimeout(() => {
      checkForAppUpdates(false);
    }, 10000);

    if (recurringTimer) {
      clearInterval(recurringTimer);
    }
    recurringTimer = setInterval(() => {
      if (activeConfig.autoCheck) {
        checkForAppUpdates(false);
      }
    }, UPDATE_CHECK_INTERVAL_MS);
  }
}

export async function checkForAppUpdates(manual = true, overrideChannel?: UpdateChannel): Promise<UpdateStatusEvent> {
  isManualCheck = manual;
  const targetChannel = overrideChannel || activeConfig.channel;

  if (manual) {
    broadcastStatus({
      state: 'CHECKING',
      currentVersion: getSafeAppVersion(),
    });
  }

  activeConfig.lastCheckedAt = new Date().toISOString();
  saveUpdateConfig(activeConfig);

  try {
    // 1. Packaged Electron runtime path
    if (app?.isPackaged) {
      const autoUpdater = getAutoUpdater();
      if (!autoUpdater) return updateStatus;
      autoUpdater.channel = targetChannel === 'BETA' ? 'beta' : 'latest';
      const checkResult = await autoUpdater.checkForUpdates();
      if (checkResult?.updateInfo) {
        const remoteVersion = checkResult.updateInfo.version;
        const currentVer = getSafeAppVersion();
        const cmp = compareSemVer(remoteVersion, currentVer);
        if (cmp > 0) {
          updateStatus = {
            state: 'AVAILABLE',
            currentVersion: currentVer,
            availableVersion: remoteVersion,
            releaseNotes: typeof checkResult.updateInfo.releaseNotes === 'string' ? checkResult.updateInfo.releaseNotes : undefined,
            channel: targetChannel,
          };
        } else {
          updateStatus = {
            state: 'NOT_AVAILABLE',
            currentVersion: currentVer,
            channel: targetChannel,
          };
        }
        broadcastStatus(updateStatus);
      }
      return updateStatus;
    }


    // 2. Standalone / Dev / Test Provider Path
    const provider = getActiveUpdateProvider();
    const manifest = await provider.fetchManifest(targetChannel, activeConfig.feedUrl);

    if (!manifest) {
      const notAvail: UpdateStatusEvent = {
        state: 'NOT_AVAILABLE',
        currentVersion: getSafeAppVersion(),
        channel: targetChannel,
      };
      broadcastStatus(notAvail);
      return notAvail;
    }

    // Validate manifest security
    const validation = validateUpdateManifest(manifest, getSafeAppVersion(), targetChannel);
    if (!validation.valid || !validation.validatedManifest) {
      const isDowngradeOrCurrent = validation.error?.includes('Downgrade or duplicate');
      if (isDowngradeOrCurrent) {
        const upToDate: UpdateStatusEvent = {
          state: 'NOT_AVAILABLE',
          currentVersion: getSafeAppVersion(),
          channel: targetChannel,
        };
        broadcastStatus(upToDate);
        return upToDate;
      }

      const errResult: UpdateStatusEvent = {
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: validation.error,
        channel: targetChannel,
      };
      broadcastStatus(errResult);
      return errResult;
    }

    currentPendingManifest = validation.validatedManifest;
    const availResult: UpdateStatusEvent = {
      state: 'AVAILABLE',
      currentVersion: getSafeAppVersion(),
      availableVersion: currentPendingManifest.version,
      releaseNotes: currentPendingManifest.releaseNotes,
      mandatory: currentPendingManifest.mandatory,
      channel: targetChannel,
    };
    broadcastStatus(availResult);

    if (activeConfig.autoDownload) {
      startDownloadUpdate();
    }

    return availResult;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    safeLogActivity('WARNING', 'Auto-Updater', `Update check failed: ${msg}`);

    const errorResult: UpdateStatusEvent = {
      state: 'ERROR',
      currentVersion: getSafeAppVersion(),
      error: msg,
      channel: targetChannel,
    };
    if (manual) {
      broadcastStatus(errorResult);
    }
    return errorResult;
  }
}

function pickPrimaryArtifact(manifest: UpdateReleaseManifest | null): UpdateReleaseFile | null {
  const files = manifest && Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) return null;
  return files.find((f) => /Setup/i.test(f.name || '')) || files[0];
}

export async function startDownloadUpdate(): Promise<boolean> {
  try {
    if (app?.isPackaged) {
      const autoUpdater = getAutoUpdater();
      if (!autoUpdater) return false;
      await autoUpdater.downloadUpdate();
      return true;
    }

    // Standalone / Dev / Test download using provider and integrity check
    if (!currentPendingManifest) {
      broadcastStatus({
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: 'No valid update manifest available for download',
      });
      return false;
    }

    broadcastStatus({
      state: 'DOWNLOADING',
      currentVersion: getSafeAppVersion(),
      availableVersion: currentPendingManifest.version,
      progress: {
        bytesPerSecond: 0,
        percent: 0,
        total: 0,
        transferred: 0,
      },
    });

    const primaryFile = pickPrimaryArtifact(currentPendingManifest);
    if (!primaryFile) {
      broadcastStatus({
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: 'Update manifest contains no downloadable artefact',
      });
      return false;
    }
    const updateDir = path.join(getWritableUserDataDir(), 'updates');
    if (!fs.existsSync(updateDir)) {
      fs.mkdirSync(updateDir, { recursive: true });
    }

    const destPath = path.join(updateDir, primaryFile.name || `mahi-setup-v${currentPendingManifest.version}.exe`);
    const provider = getActiveUpdateProvider();

    await provider.downloadFile(primaryFile.url, destPath, (prog) => {
      broadcastStatus({
        state: 'DOWNLOADING',
        currentVersion: getSafeAppVersion(),
        availableVersion: currentPendingManifest?.version,
        progress: prog,
      });
    });

    // Cryptographic integrity validation
    const expectedChecksum = primaryFile.sha256 || currentPendingManifest.sha256 || primaryFile.sha512 || currentPendingManifest.sha512;
    const algorithm = (primaryFile.sha512 || currentPendingManifest.sha512) ? 'sha512' : 'sha256';

    if (expectedChecksum) {
      const integrity = await verifyFileIntegrity(destPath, expectedChecksum, algorithm, primaryFile.size);
      if (!integrity.verified) {
        try {
          fs.unlinkSync(destPath);
        } catch (unlinkErr) {
          log.warn('Failed deleting corrupted update artifact', {
            destPath,
            err: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
          });
        }
        logActivity('SYSTEM', 'ERROR', 'Auto-Updater', `Tampered or corrupted update artifact rejected: ${integrity.error}`);
        broadcastStatus({
          state: 'ERROR',
          currentVersion: getSafeAppVersion(),
          error: `Corrupted or tampered update detected. Download aborted: ${integrity.error}`,
        });
        return false;
      }
    }

    broadcastStatus({
      state: 'DOWNLOADED',
      currentVersion: getSafeAppVersion(),
      availableVersion: currentPendingManifest.version,
      releaseNotes: currentPendingManifest.releaseNotes,
    });
    safeLogActivity('INFO', 'Auto-Updater', `Verified update package downloaded: v${currentPendingManifest.version}`);

    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    safeLogActivity('WARNING', 'Auto-Updater', `Download update failed: ${msg}`);
    broadcastStatus({
      state: 'ERROR',
      currentVersion: getSafeAppVersion(),
      error: msg,
    });
    return false;
  }
}

/**
 * Checks if any browser profiles are currently running.
 */
export function getActiveProfilesRunning(): string[] {
  try {
    return processManager.getRunningProfiles().map((p) => p.name);
  } catch {
    return [];
  }
}

/**
 * Applies update and coordinates restart with strict profile data safety.
 */
export async function applyAndRestartUpdate(options?: UpdateInstallOptions): Promise<UpdateInstallResult> {
  const activeProfiles = getActiveProfilesRunning();

  // Safety Gate: Block abrupt restart if profiles are running without explicit force
  if (activeProfiles.length > 0 && !options?.force) {
    safeLogActivity(
      'WARNING',
      'Auto-Updater',
      `Update install deferred: ${activeProfiles.length} browser profiles are active (${activeProfiles.join(', ')})`
    );
    return {
      success: false,
      reason: 'PROFILES_ACTIVE',
      activeProfiles,
      error: `Cannot update while ${activeProfiles.length} browser profile(s) are running. Please close them or confirm force restart.`,
    };
  }

  // Pre-Update Flush: Ensure database and storage state are flushed to disk
  try {
    flushDatabaseToDisk();
  } catch (flushErr) {
    safeLogActivity('WARNING', 'Auto-Updater', `Pre-update database flush notice: ${flushErr}`);
  }

  broadcastStatus({
    state: 'INSTALLING',
    currentVersion: getSafeAppVersion(),
    availableVersion: updateStatus.availableVersion,
  });

  safeLogActivity('INFO', 'Auto-Updater', `Applying update and restarting application.`);

  try {
    if (app?.isPackaged) {
      const autoUpdater = getAutoUpdater();
      if (!autoUpdater) return { success: false, error: 'autoUpdater not available' };
      // Pass (isSilent: true, isForceRunAfter: true) for zero-wizard seamless background update
      autoUpdater.quitAndInstall(true, true);
    } else {
      // Development / Staging simulation
      if (typeof app?.relaunch === 'function') {
        app.relaunch();
        app.quit();
      }
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    safeLogActivity('ERROR', 'Auto-Updater', `applyAndRestartUpdate execution failed: ${msg}`);
    broadcastStatus({
      state: 'ERROR',
      currentVersion: getSafeAppVersion(),
      error: msg,
    });
    return { success: false, error: msg };
  }
}

export function getAppUpdateStatus(): UpdateStatusEvent {
  return {
    ...updateStatus,
    currentVersion: getSafeAppVersion(),
    channel: activeConfig.channel,
  };
}

export function getUpdateConfig(): UpdateConfig {
  return { ...activeConfig };
}

export function setUpdateConfig(partial: Partial<UpdateConfig>): UpdateConfig {
  activeConfig = {
    ...activeConfig,
    ...partial,
  };
  saveUpdateConfig(activeConfig);

  // Update live autoUpdater configuration
  try {
    const autoUpdater = getAutoUpdater();
    if (autoUpdater) {
      if (partial.channel) {
        autoUpdater.channel = partial.channel === 'BETA' ? 'beta' : 'latest';
      }
      if (partial.autoDownload !== undefined) {
        autoUpdater.autoDownload = partial.autoDownload;
      }
      if (partial.feedUrl) {
        autoUpdater.setFeedURL({
          provider: 'generic',
          url: partial.feedUrl,
        });
      }
    }
  } catch (err) {
    log.warn('Failed updating live autoUpdater runtime configuration', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  broadcastStatus(updateStatus);
  return { ...activeConfig };
}

// Reset internal state for test harnesses
export function resetUpdaterStateForTesting(): void {
  updateStatus = {
    state: 'IDLE',
    currentVersion: getSafeAppVersion(),
    channel: activeConfig.channel,
  };
  currentPendingManifest = null;
  isManualCheck = false;
}
