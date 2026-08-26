import { app, BrowserWindow } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { UpdateStatusEvent, UpdateProgress, AppUpdateInfo } from '../../10_CONFIG/shared/types/updater.js';
import { logActivity } from './audit-service.js';

let updateStatus: UpdateStatusEvent = {
  state: 'IDLE',
  currentVersion: app.getVersion() || '1.0.0',
};

function broadcastStatus(status: UpdateStatusEvent): void {
  updateStatus = { ...status, currentVersion: app.getVersion() || '1.0.0' };
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:statusChanged', updateStatus);
    }
  });
}

export function initAutoUpdater(): void {
  // Configure autoUpdater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcastStatus({
      state: 'CHECKING',
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('update-available', (info: any) => {
    let releaseNotes = '';
    if (typeof info.releaseNotes === 'string') {
      releaseNotes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      releaseNotes = info.releaseNotes.map((n: any) => n.note || '').join('\n');
    }

    broadcastStatus({
      state: 'AVAILABLE',
      currentVersion: app.getVersion(),
      availableVersion: info.version,
      releaseNotes: releaseNotes || 'A new version of MAHI BROWSER is available with performance and stealth enhancements.',
    });

    logActivity('SYSTEM', 'INFO', 'Auto-Updater', `Update available: version ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    broadcastStatus({
      state: 'NOT_AVAILABLE',
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('error', (err) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    broadcastStatus({
      state: 'ERROR',
      currentVersion: app.getVersion(),
      error: errorMsg,
    });
  });

  autoUpdater.on('download-progress', (progressObj: UpdateProgress) => {
    broadcastStatus({
      state: 'DOWNLOADING',
      currentVersion: app.getVersion(),
      availableVersion: updateStatus.availableVersion,
      progress: {
        bytesPerSecond: progressObj.bytesPerSecond,
        percent: Math.round(progressObj.percent),
        total: progressObj.total,
        transferred: progressObj.transferred,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info: any) => {
    broadcastStatus({
      state: 'DOWNLOADED',
      currentVersion: app.getVersion(),
      availableVersion: info.version,
    });
    logActivity('SYSTEM', 'INFO', 'Auto-Updater', `Update v${info.version} downloaded and ready to install.`);
  });

  // Background check on launch if packaged
  if (app.isPackaged) {
    setTimeout(() => {
      checkForAppUpdates(false);
    }, 10000);
  }
}

export async function checkForAppUpdates(manual = true): Promise<UpdateStatusEvent> {
  try {
    if (!app.isPackaged) {
      const mockResult: UpdateStatusEvent = {
        state: 'NOT_AVAILABLE',
        currentVersion: app.getVersion() || '1.0.0 (Dev)',
      };
      if (manual) {
        broadcastStatus(mockResult);
      }
      return mockResult;
    }

    await autoUpdater.checkForUpdates();
    return updateStatus;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const errorResult: UpdateStatusEvent = {
      state: 'ERROR',
      currentVersion: app.getVersion(),
      error: msg,
    };
    broadcastStatus(errorResult);
    return errorResult;
  }
}

export async function startDownloadUpdate(): Promise<boolean> {
  try {
    if (!app.isPackaged) {
      // Simulate download in development mode for UI verification
      let percent = 0;
      const interval = setInterval(() => {
        percent += 20;
        broadcastStatus({
          state: 'DOWNLOADING',
          currentVersion: app.getVersion(),
          availableVersion: '1.0.1',
          progress: {
            percent,
            bytesPerSecond: 2500000,
            total: 90000000,
            transferred: (90000000 * percent) / 100,
          },
        });
        if (percent >= 100) {
          clearInterval(interval);
          broadcastStatus({
            state: 'DOWNLOADED',
            currentVersion: app.getVersion(),
            availableVersion: '1.0.1',
          });
        }
      }, 500);
      return true;
    }

    await autoUpdater.downloadUpdate();
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    broadcastStatus({
      state: 'ERROR',
      currentVersion: app.getVersion(),
      error: msg,
    });
    return false;
  }
}

export function applyAndRestartUpdate(): void {
  try {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall(false, true);
    } else {
      app.relaunch();
      app.quit();
    }
  } catch {
    app.quit();
  }
}

export function getAppUpdateStatus(): UpdateStatusEvent {
  return {
    ...updateStatus,
    currentVersion: app.getVersion() || '1.0.0',
  };
}
