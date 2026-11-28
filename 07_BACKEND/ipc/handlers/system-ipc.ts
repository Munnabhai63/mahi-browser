import type { OpenDialogOptions } from 'electron';
import { app, dialog, ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import { detectSystemBrowsers } from '../../../02_BROWSER/detector.js';
import {
  ensureManagedEngineInstalled,
  getManagedEngineCurrentProgress,
  getManagedEngineExecutablePath,
  isManagedEngineInstalled,
  repairManagedEngine,
} from '../../../02_BROWSER/managed-engine.js';
import {
  createProfileShortcut,
  fixDesktopShortcuts,
  getDistributionInfo,
  openDistributionFolder,
} from '../../../03_HARDWARE/distribution-service.js';
import {
  checkPublicIp,
  clearRotationHistory,
  getAdbEnvironmentStatus,
  getConnectedAdbDevices,
  getRotationHistory,
  getRotatorConfig,
  installAdbPlatformTools,
  rotateMobileIp,
  saveRotatorConfig,
} from '../../../03_HARDWARE/mobile-rotator-service.js';
import { optimizeFleetMemory, sampleFleetResources } from '../../../03_HARDWARE/resource-monitor-service.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { MANAGED_ENGINE_VERSION } from '../../../10_CONFIG/engine-config.js';
import type { FeatureFlagDefinition, PlanTierId } from '../../../10_CONFIG/shared/types/platform.js';
import type { UpdateConfig, UpdateInstallOptions } from '../../../10_CONFIG/shared/types/updater.js';
import { APP_VERSION } from '../../../10_CONFIG/shared/version.js';
import { generateApiKey, getApiKeys, revokeApiKey } from '../../services/api-v2-service.js';
import { clearActivityLogs, getActivityLogs } from '../../services/audit-service.js';
import { getFeatureFlags, isFeatureEnabled, updateFeatureFlag } from '../../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../../services/fleet-service.js';
import { getAppSettings, saveAppSettings, setAppPinCode, verifyAppPinCheck } from '../../services/settings-service.js';
import {
  applyAndRestartUpdate,
  checkForAppUpdates,
  getAppUpdateStatus,
  getUpdateConfig,
  setUpdateConfig,
  startDownloadUpdate,
} from '../../services/updater-service.js';
import { exportMasterVault, importMasterVault } from '../../services/vault-service.js';
import { createLogger } from '../../utils/logger.js';
import { toErrMsg } from './ipc-shared.js';

const log = createLogger('ipc-system');

export function registerSystemIpcHandlers(): void {
  // SETTINGS & PIN
  ipcMain.handle('settings:get', async () => {
    try {
      return getAppSettings();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('settings:update', async (_event, settings) => {
    try {
      return saveAppSettings(settings);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('settings:verifyPin', async (_event, pin: string) => {
    try {
      return verifyAppPinCheck(pin);
    } catch (_err) {
      return false;
    }
  });

  ipcMain.handle('settings:setPin', async (_event, newPin: string, oldPin?: string) => {
    try {
      return setAppPinCode(newPin, oldPin);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // LOGS
  ipcMain.handle('logs:get', async (_event, filter) => {
    try {
      return getActivityLogs(filter);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('logs:clear', async () => {
    try {
      return clearActivityLogs();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // SYSTEM & DIALOGS
  ipcMain.handle('system:getBrowsers', async () => {
    return detectSystemBrowsers();
  });

  ipcMain.handle('dialog:openFile', async (_event, options) => {
    const res = await dialog.showOpenDialog({
      title: options?.title || 'Open File',
      filters: options?.filters,
      properties: (options?.properties as OpenDialogOptions['properties']) || ['openFile'],
    });
    if (res.canceled) return null;
    return res.filePaths;
  });

  ipcMain.handle('dialog:openSave', async (_event, options) => {
    const res = await dialog.showSaveDialog({
      title: options?.title || 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    if (res.canceled) return null;
    return res.filePath || null;
  });

  // MOBILE IP ROTATOR HANDLERS
  ipcMain.handle('mobileRotator:checkIp', async () => {
    try {
      return await checkPublicIp();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:getDevices', async () => {
    try {
      return await getConnectedAdbDevices();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:rotate', async (_event, config) => {
    try {
      return await rotateMobileIp(config);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:getConfig', async () => {
    try {
      return getRotatorConfig();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:saveConfig', async (_event, config) => {
    try {
      return saveRotatorConfig(config);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:getAdbStatus', async () => {
    try {
      return await getAdbEnvironmentStatus();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:installAdb', async () => {
    try {
      return await installAdbPlatformTools();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:getHistory', async () => {
    try {
      return getRotationHistory();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mobileRotator:clearHistory', async () => {
    try {
      return clearRotationHistory();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // UPDATER HANDLERS
  ipcMain.handle('updater:check', async (_event, channel?: 'STABLE' | 'BETA') => {
    try {
      return checkForAppUpdates(true, channel);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      return startDownloadUpdate();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('updater:install', async (_event, options?: UpdateInstallOptions) => {
    try {
      return applyAndRestartUpdate(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('updater:getStatus', async () => {
    try {
      return getAppUpdateStatus();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('updater:getConfig', async () => {
    try {
      return getUpdateConfig();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('updater:setConfig', async (_event, config: Partial<UpdateConfig>) => {
    try {
      const { feedUrl: _ignoredFeedUrl, ...safeConfig } = (config && typeof config === 'object') ? config : {};
      return setUpdateConfig(safeConfig);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // RESOURCE MONITORING & MEMORY OPTIMIZER
  ipcMain.handle('resources:getFleetUsage', async () => {
    try {
      return sampleFleetResources();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('resources:optimizeMemory', async () => {
    try {
      return optimizeFleetMemory();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // MASTER ENCRYPTED VAULT BACKUP & RESTORE
  ipcMain.handle('vault:export', async (_event, options) => {
    try {
      return exportMasterVault(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('vault:import', async (_event, bundleJson, password) => {
    try {
      return importMasterVault(bundleJson, password);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Feature Flags, Fleet & API Keys
  ipcMain.handle('featureFlags:get', async () => {
    try {
      return getFeatureFlags();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('featureFlags:update', async (_event, key: string, updates: Partial<FeatureFlagDefinition>) => {
    try {
      return updateFeatureFlag(key, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('featureFlags:check', async (_event, key: string, userTier?: PlanTierId, userId?: string, orgId?: string) => {
    try {
      return isFeatureEnabled(key, userTier, userId, orgId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('fleet:getDevices', async () => {
    try {
      return getFleetDevices();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('fleet:getTelemetry', async () => {
    try {
      return getLiveTelemetry();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('fleet:revokeDevice', async (_event, deviceId: string) => {
    try {
      return revokeDevice(deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('apiKeys:get', async (_event, userId?: string) => {
    try {
      return getApiKeys(userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('apiKeys:generate', async (_event, name: string, userId?: string, scopes?: string[]) => {
    try {
      return generateApiKey(name, userId, scopes);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('apiKeys:revoke', async (_event, keyId: string) => {
    try {
      return revokeApiKey(keyId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Distribution & Shortcuts Management
  ipcMain.handle('distribution:getInfo', async () => {
    try {
      return getDistributionInfo();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('distribution:openFolder', async () => {
    try {
      return await openDistributionFolder();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('distribution:fixShortcuts', async () => {
    try {
      return await fixDesktopShortcuts();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('distribution:createProfileShortcut', async (_event, profileId: string, profileName: string) => {
    try {
      return await createProfileShortcut(profileId, profileName);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Managed Browser Engine Handlers
  ipcMain.handle('engine:getStatus', async () => {
    const installed = isManagedEngineInstalled();
    const currentProg = getManagedEngineCurrentProgress();
    return {
      installed,
      version: MANAGED_ENGINE_VERSION,
      path: getManagedEngineExecutablePath(),
      stage: currentProg.stage,
      percent: currentProg.percent,
      downloadedBytes: currentProg.downloadedBytes,
      totalBytes: currentProg.totalBytes,
      error: currentProg.error,
    };
  });

  ipcMain.handle('engine:download', async () => {
    try {
      const exe = await ensureManagedEngineInstalled();
      return { success: true, path: exe };
    } catch (err: unknown) {
      return { success: false, error: toErrMsg(err) };
    }
  });

  ipcMain.handle('engine:repair', async () => {
    try {
      return await repairManagedEngine();
    } catch (err: unknown) {
      return { success: false, error: toErrMsg(err) };
    }
  });

  ipcMain.handle('app:getVersion', async () => {
    try {
      if (app && typeof app.getVersion === 'function') {
        const v = app.getVersion();
        if (v) return v;
      }
    } catch (err) {
      log.debug('app.getVersion skipped outside packaged Electron', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return APP_VERSION;
  });
}
