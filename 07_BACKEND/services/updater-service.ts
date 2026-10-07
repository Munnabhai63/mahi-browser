import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
import { UpdateStatusEvent, UpdateProgress } from '../../10_CONFIG/shared/types/updater.js';
import { logActivity } from './audit-service.js';

export const UPDATE_FEED_URL = 'https://mahibrowser.com/update/';
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export type UpdaterState = 'IDLE' | 'CHECKING' | 'AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADED' | 'NOT_AVAILABLE' | 'ERROR';

/**
 * Pure semver comparison utility.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemVer(v1: string, v2: string): number {
  const clean = (v: string) =>
    (v || '0.0.0')
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const parts1 = clean(v1);
  const parts2 = clean(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Validates whether a state transition follows expected auto-updater lifecycle.
 */
export function isValidTransition(from: UpdaterState, to: UpdaterState): boolean {
  const validTransitions: Record<UpdaterState, UpdaterState[]> = {
    IDLE: ['CHECKING', 'ERROR'],
    CHECKING: ['AVAILABLE', 'NOT_AVAILABLE', 'DOWNLOADING', 'ERROR', 'IDLE'],
    AVAILABLE: ['DOWNLOADING', 'ERROR', 'IDLE'],
    DOWNLOADING: ['DOWNLOADED', 'ERROR', 'IDLE'],
    DOWNLOADED: ['IDLE'],
    NOT_AVAILABLE: ['CHECKING', 'IDLE'],
    ERROR: ['CHECKING', 'IDLE'],
  };
  return validTransitions[from]?.includes(to) ?? false;
}

function getSafeAppVersion(): string {
  try {
    if (app && typeof app.getVersion === 'function') {
      return app.getVersion() || '1.0.0';
    }
  } catch {}
  return '1.0.0';
}

function getAutoUpdater() {
  return pkg.autoUpdater;
}

let updateStatus: UpdateStatusEvent = {
  state: 'IDLE',
  currentVersion: getSafeAppVersion(),
};

let isManualCheck = false;
let recurringTimer: NodeJS.Timeout | null = null;
let isInitialized = false;

function broadcastStatus(status: UpdateStatusEvent): void {
  updateStatus = { ...status, currentVersion: getSafeAppVersion() };
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && BrowserWindow.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('updater:statusChanged', updateStatus);
        }
      });
    } catch {}
  }
}

export function initAutoUpdater(): void {
  if (isInitialized) return;
  isInitialized = true;

  const autoUpdater = getAutoUpdater();

  // Feed URL: https://mahibrowser.com/update/ (Generic Provider)
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL,
  });

  // Download SILENTLY in background whenever an update is found
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (isManualCheck) {
      broadcastStatus({
        state: 'CHECKING',
        currentVersion: getSafeAppVersion(),
      });
    }
  });

  autoUpdater.on('update-available', (info: any) => {
    logActivity('SYSTEM', 'INFO', 'Auto-Updater', `Update available: v${info.version}, downloading silently in background...`);
    // Silent background download: do NOT broadcast AVAILABLE to avoid showing popups early
    updateStatus = {
      state: 'AVAILABLE',
      currentVersion: getSafeAppVersion(),
      availableVersion: info.version,
    };
  });

  autoUpdater.on('update-not-available', () => {
    if (isManualCheck) {
      broadcastStatus({
        state: 'NOT_AVAILABLE',
        currentVersion: getSafeAppVersion(),
      });
    } else {
      updateStatus = {
        state: 'NOT_AVAILABLE',
        currentVersion: getSafeAppVersion(),
      };
    }
  });

  autoUpdater.on('download-progress', (progressObj: UpdateProgress) => {
    // Keep internal state updated silently
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
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    broadcastStatus({
      state: 'DOWNLOADED',
      currentVersion: getSafeAppVersion(),
      availableVersion: info.version,
    });
    logActivity('SYSTEM', 'INFO', 'Auto-Updater', `Update v${info.version} downloaded and ready to install.`);
  });

  autoUpdater.on('error', (err: any) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logActivity('SYSTEM', 'WARNING', 'Auto-Updater', `Auto-updater check/download error (handled silently): ${errorMsg}`);

    // Offline / network failure -> completely silent in background checks
    if (isManualCheck) {
      broadcastStatus({
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: errorMsg,
      });
    } else {
      updateStatus = {
        state: 'ERROR',
        currentVersion: getSafeAppVersion(),
        error: errorMsg,
      };
    }
    isManualCheck = false;
  });

  // Check once at startup (after 10s delay so first launch stays fast) + every 6 hours
  if (app && app.isPackaged) {
    setTimeout(() => {
      checkForAppUpdates(false);
    }, 10000);

    if (recurringTimer) {
      clearInterval(recurringTimer);
    }
    recurringTimer = setInterval(() => {
      checkForAppUpdates(false);
    }, UPDATE_CHECK_INTERVAL_MS);
  }
}

export async function checkForAppUpdates(manual = true): Promise<UpdateStatusEvent> {
  isManualCheck = manual;
  try {
    if (!app || !app.isPackaged) {
      const mockResult: UpdateStatusEvent = {
        state: 'NOT_AVAILABLE',
        currentVersion: getSafeAppVersion() + ' (Dev)',
      };
      if (manual) {
        broadcastStatus(mockResult);
      }
      return mockResult;
    }

    const autoUpdater = getAutoUpdater();
    await autoUpdater.checkForUpdates();
    return updateStatus;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('SYSTEM', 'WARNING', 'Auto-Updater', `Update check failed: ${msg}`);
    const errorResult: UpdateStatusEvent = {
      state: 'ERROR',
      currentVersion: getSafeAppVersion(),
      error: msg,
    };
    if (manual) {
      broadcastStatus(errorResult);
    }
    return errorResult;
  }
}

export async function startDownloadUpdate(): Promise<boolean> {
  try {
    if (!app || !app.isPackaged) {
      // Simulate download in development mode for UI verification
      let percent = 0;
      const interval = setInterval(() => {
        percent += 20;
        if (percent >= 100) {
          clearInterval(interval);
          broadcastStatus({
            state: 'DOWNLOADED',
            currentVersion: getSafeAppVersion(),
            availableVersion: '1.0.1',
          });
        }
      }, 300);
      return true;
    }

    const autoUpdater = getAutoUpdater();
    await autoUpdater.downloadUpdate();
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('SYSTEM', 'WARNING', 'Auto-Updater', `downloadUpdate failed: ${msg}`);
    return false;
  }
}

export function applyAndRestartUpdate(): void {
  try {
    if (app && app.isPackaged) {
      const autoUpdater = getAutoUpdater();
      autoUpdater.quitAndInstall();
    } else {
      if (app && typeof app.relaunch === 'function') {
        app.relaunch();
        app.quit();
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('SYSTEM', 'ERROR', 'Auto-Updater', `applyAndRestartUpdate failed: ${msg}`);
    if (app && typeof app.quit === 'function') {
      app.quit();
    }
  }
}

export function getAppUpdateStatus(): UpdateStatusEvent {
  return {
    ...updateStatus,
    currentVersion: getSafeAppVersion(),
  };
}
