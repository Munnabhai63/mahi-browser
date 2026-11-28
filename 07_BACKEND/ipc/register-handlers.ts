import * as fs from 'node:fs';
import * as path from 'node:path';
import { app, BrowserWindow, ipcMain } from '../../08_SECURITY/electron-bridge.js';
import {
  addManagedEngineProgressListener,
  getManagedEngineExecutablePath,
  isManagedEngineInstalled,
} from '../../02_BROWSER/managed-engine.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { exportNetscapeCookies } from '../../02_BROWSER/services/archive-service.js';
import { getProfileById } from '../../02_BROWSER/services/profile-service.js';
import {
  getDecryptedProxyCredentials,
  getProxyById,
  testAndSaveProxyStatus,
  testProxyConnection,
} from '../../02_BROWSER/services/proxy-service.js';
import { startAccountStatusScheduler } from '../../08_SECURITY/account-service.js';
import { initCloudSync } from '../../08_SECURITY/cloud-sync-service.js';
import { sanitizeError } from '../../08_SECURITY/sanitizer.js';
import type { CreateProxyDTO } from '../../10_CONFIG/shared/types/proxy.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { addLogListener } from '../services/audit-service.js';
import { cleanProfileCaches, type CleanCacheResult } from '../services/profile-cache-cleaner.js';
import { redactSensitiveTokens } from '../utils/http-security.js';
import { createLogger } from '../utils/logger.js';
import { getWritableUserDataDir } from '../utils/runtime-paths.js';
import { registerAccountAndLicensingIpcHandlers } from './handlers/account-licensing-ipc.js';
import { registerAutomationIpcHandlers } from './handlers/automation-ipc.js';
import { registerBrowserDataIpcHandlers } from './handlers/browser-data-ipc.js';
import { getActiveOwnerId, isEnoentError, type ProxiesTestInput } from './handlers/ipc-shared.js';
import { registerProfileIpcHandlers } from './handlers/profiles-ipc.js';
import { registerProxyIpcHandlers } from './handlers/proxies-ipc.js';
import { registerSystemIpcHandlers } from './handlers/system-ipc.js';
import { registerWorkspaceIpcHandlers } from './handlers/workspaces-ipc.js';

const log = createLogger('ipc-register-handlers');

export async function handlePreviewCacheCleanup(baseDir?: string): Promise<CleanCacheResult> {
  return cleanProfileCaches({
    baseDir: baseDir || getWritableUserDataDir(),
    apply: false,
    silent: true,
  });
}

export async function handleApplyCacheCleanup(baseDir?: string): Promise<CleanCacheResult> {
  return cleanProfileCaches({
    baseDir: baseDir || getWritableUserDataDir(),
    apply: true,
    silent: true,
  });
}

export async function handleProxiesTest(dto: ProxiesTestInput) {
  try {
    const proxyId = dto?.proxyId || dto?.id;
    if (proxyId) {
      const savedProxy = getProxyById(proxyId);
      if (savedProxy) {
        const hasHostOverride = dto.host !== undefined && dto.host !== savedProxy.host;
        const hasPortOverride = dto.port !== undefined && Number(dto.port) !== Number(savedProxy.port);
        const hasProtocolOverride = dto.protocol !== undefined && dto.protocol !== savedProxy.protocol;
        const hasUsernameOverride = dto.username !== undefined && dto.username !== (savedProxy.username || '');
        const hasNewPassword = Boolean(dto.password);

        const isUnchanged =
          !hasHostOverride &&
          !hasPortOverride &&
          !hasProtocolOverride &&
          !hasUsernameOverride &&
          !hasNewPassword;

        if (isUnchanged) {
          return await testAndSaveProxyStatus(proxyId);
        }

        // User supplied edited fields in ProxyConfigModal (host, port, protocol, username, or a new password)
        // Fall back to stored creds.password only if host/port/protocol still match the saved proxy and !dto.password
        let password = dto.password;
        if (!password && !hasHostOverride && !hasPortOverride && !hasProtocolOverride) {
          const creds = getDecryptedProxyCredentials(proxyId);
          if (creds) {
            password = creds.password;
          }
        }

        const testDto: Partial<CreateProxyDTO> = {
          protocol: dto.protocol || savedProxy.protocol,
          host: dto.host || savedProxy.host,
          port: dto.port ? Number(dto.port) : savedProxy.port,
          username: dto.username !== undefined ? dto.username : (savedProxy.username || undefined),
          password: password || undefined,
        };

        return await testProxyConnection(testDto);
      }
    }
    return await testProxyConnection(dto);
  } catch (err) {
    return { success: false, latencyMs: 0, errorMessage: sanitizeError(err) };
  }
}

export function registerIpcHandlers(): void {
  // Domain IPC registrars
  registerProfileIpcHandlers();
  registerProxyIpcHandlers(handleProxiesTest);
  registerBrowserDataIpcHandlers();
  registerAutomationIpcHandlers();
  registerWorkspaceIpcHandlers();
  registerAccountAndLicensingIpcHandlers();
  registerSystemIpcHandlers();

  // Facade-retained IPC channels verified directly by parity/security tests
  ipcMain.handle('profiles:previewCacheCleanup', async () => {
    try {
      return await handlePreviewCacheCleanup();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:applyCacheCleanup', async () => {
    try {
      return await handleApplyCacheCleanup();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:exportNetscape', async (_event, profileId: string, targetFilePath?: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      const text = exportNetscapeCookies(profileId);
      if (targetFilePath && typeof targetFilePath === 'string') {
        const resolved = path.resolve(targetFilePath);
        const parent = path.dirname(resolved);
        await fs.promises.mkdir(parent, { recursive: true });
        await fs.promises.writeFile(resolved, text, 'utf8');
      }
      return text;
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('app:getDiagnostics', async () => {
    let version = APP_VERSION;
    try {
      if (app && typeof app.getVersion === 'function') {
        const v = app.getVersion();
        if (v) version = v;
      }
    } catch (err) {
      log.debug('app.getVersion skipped in diagnostics', {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    let logTail = '';
    try {
      const crashLogPath = path.join(getWritableUserDataDir(), 'crash-log.txt');
      let content = '';
      try {
        content = await fs.promises.readFile(crashLogPath, 'utf-8');
      } catch (readErr: unknown) {
        if (!isEnoentError(readErr)) throw readErr;
      }
      if (content) {
        const lines = content.split('\n');
        logTail = redactSensitiveTokens(lines.slice(-200).join('\n'));
        if (logTail.length > 20000) {
          logTail = logTail.slice(-20000);
        }
      }
    } catch (readErr) {
      log.warn('Failed reading crash-log.txt for diagnostics', {
        err: readErr instanceof Error ? readErr.message : String(readErr),
      });
    }

    return {
      version,
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron || '',
      node: process.versions.node || '',
      generatedAt: new Date().toISOString(),
      logTail,
    };
  });

  // Initialize startup cloud sync queue resumption & account status scheduler
  initCloudSync();
  startAccountStatusScheduler();

  // Wire event emitters from processManager, audit logger, and engine downloader to renderer windows
  addManagedEngineProgressListener((progress) => {
    const statusPayload = {
      installed: isManagedEngineInstalled(),
      path: getManagedEngineExecutablePath(),
      ...progress,
    };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('engine:downloadProgress', statusPayload);
      }
    }
  });

  processManager.onStatusChange((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('profile:statusChanged', event);
      }
    }
  });

  addLogListener((logItem) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('activity:logAdded', logItem);
      }
    }
  });
}
