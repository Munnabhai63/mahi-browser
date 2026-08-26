import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  getProfiles,
  getProfileById,
  createProfile,
  bulkCreateProfiles,
  bulkUpdateProfiles,
  bulkAssignProxies,
  bulkDeleteProfiles,
  softDeleteProfile,
  getTrashProfiles,
  restoreProfile,
  permanentDeleteProfile,
  emptyTrash,
  updateProfile,
  deleteProfile,
  cloneProfile,
} from '../../02_BROWSER/services/profile-service.js';
import { warmProfile, warmBulkProfiles } from '../../09_AUTOMATION/cookie-warmer-service.js';
import {
  checkForAppUpdates,
  startDownloadUpdate,
  applyAndRestartUpdate,
  getAppUpdateStatus,
} from '../services/updater-service.js';
import { sampleFleetResources, optimizeFleetMemory } from '../../03_HARDWARE/resource-monitor-service.js';
import { exportMasterVault, importMasterVault } from '../services/vault-service.js';
import {
  getDistributionInfo,
  openDistributionFolder,
  fixDesktopShortcuts,
  createProfileShortcut,
} from '../../03_HARDWARE/distribution-service.js';




import { processManager } from '../../02_BROWSER/process-manager.js';
import {
  getProxies,
  getProxyById,
  createProxy,
  parseAndCreateProxy,
  updateProxy,
  deleteProxy,
  testProxyConnection,
} from '../../02_BROWSER/services/proxy-service.js';

import {
  getCookies,
  deleteCookie,
  deleteAllCookies,
  importCookies,
  exportCookies,
} from '../../02_BROWSER/services/cookie-service.js';
import {
  getHistory,
  deleteHistoryItem,
  clearHistory,
} from '../../02_BROWSER/services/history-service.js';
import {
  getExtensions,
  installExtension,
  installFromWebStoreUrl,
  toggleExtension,
  removeExtension,
} from '../../02_BROWSER/services/extension-service.js';

import {
  getWorkflows,
  getWorkflowById,
  saveWorkflow,
  deleteWorkflow,
  runWorkflow,
  runWorkflowBatch,
  getWorkflowLogs,
} from '../../09_AUTOMATION/automation-engine.js';
import { RPA_TEMPLATES } from '../../10_CONFIG/shared/constants/automation-templates.js';
import { synchronizerHub } from '../../09_AUTOMATION/sync-hub.js';


import {
  previewProfileArchive,
  importProfileFromArchive,
  exportProfileToArchive,
  exportNetscapeCookies,
  exportBulkProfilesToArchive,
  importCrossPlatformProfiles,
} from '../../02_BROWSER/services/archive-service.js';

import {
  getAppSettings,
  saveAppSettings,
  verifyAppPinCheck,
  setAppPinCode,
} from '../services/settings-service.js';
import {
  getActivityLogs,
  clearActivityLogs,
  addLogListener,
} from '../services/audit-service.js';
import {
  createLicense,
  getLicenses,
  getLicenseById,
  activateLicense,
  validateCurrentLicense,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../04_LICENSING/license-engine.js';
import {
  checkPublicIp,
  getConnectedAdbDevices,
  rotateMobileIp,
  getRotatorConfig,
  saveRotatorConfig,
} from '../../03_HARDWARE/mobile-rotator-service.js';
import {
  auditProfileFingerprint,
  autoFixProfileFingerprint,
} from '../../03_HARDWARE/diagnostics-service.js';
import {
  getCaptchaConfig,
  saveCaptchaConfig,
  checkCaptchaBalance,
  solveCaptcha,
} from '../../09_AUTOMATION/captcha-service.js';
import {
  getWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateMemberRole,
  deleteWorkspaceMember,
  assignProfileToMember,
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from '../../02_BROWSER/services/workspace-service.js';
import {
  detectAndParseAccountData,


  executeBulkImport,

  parseNetscapeCookies,
} from '../../02_BROWSER/services/universal-importer-service.js';
import { verifyAdminAccess, setOwnerAdminPin } from '../../05_AUTH/admin-auth.js';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../../02_BROWSER/services/folder-service.js';
import { getProfileLock, acquireProfileLock, releaseProfileLock } from '../../02_BROWSER/services/profile-lock-service.js';
import { getFeatureFlags, isFeatureEnabled, updateFeatureFlag } from '../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../services/fleet-service.js';
import { getApiKeys, generateApiKey, revokeApiKey } from '../services/api-v2-service.js';
import { registerUser, loginUser } from '../commercial/commercial-auth-service.js';
import { getCommercialPlans } from '../commercial/commercial-plan-service.js';
import { evaluateUserEntitlements, activateCommercialLicenseForUser } from '../commercial/commercial-entitlement-service.js';
import { getUserDevices, revokeCommercialDevice } from '../commercial/commercial-device-service.js';

import { detectSystemBrowsers } from '../../02_BROWSER/detector.js';
import {
  CreateProfileDTOSchema,
  UpdateProfileDTOSchema,
  CloneProfileDTOSchema,
  CreateProxyDTOSchema,
  UpdateProxyDTOSchema,
  AutomationWorkflowSchema,
} from '../../10_CONFIG/shared/validation/schemas.js';
import { DashboardMetrics } from '../../10_CONFIG/shared/types/ipc.js';
import { sanitizeError } from '../../08_SECURITY/sanitizer.js';
import { getProfileStats } from '../services/stats-service.js';

export function registerIpcHandlers(): void {
  // PROFILES
  ipcMain.handle('profiles:getAll', async (_event, filter) => {
    try {
      return getProfiles(filter);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getById', async (_event, id: string) => {
    try {
      return getProfileById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:create', async (_event, dto) => {
    try {
      const validated = CreateProfileDTOSchema.parse(dto);
      return createProfile(validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkCreate', async (_event, dto) => {
    try {
      return bulkCreateProfiles(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('profiles:update', async (_event, id: string, dto) => {
    try {
      const validated = UpdateProfileDTOSchema.parse(dto);
      return updateProfile(id, validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    try {
      if (processManager.isRunning(id)) {
        await processManager.stopProfile(id);
      }
      return softDeleteProfile(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getTrash', async () => {
    try {
      return getTrashProfiles();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:restore', async (_event, id: string) => {
    try {
      return restoreProfile(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:permanentDelete', async (_event, id: string) => {
    try {
      if (processManager.isRunning(id)) {
        await processManager.stopProfile(id);
      }
      return permanentDeleteProfile(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:emptyTrash', async () => {
    try {
      return emptyTrash();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('profiles:clone', async (_event, dto) => {
    try {
      const validated = CloneProfileDTOSchema.parse(dto);
      return cloneProfile(validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:start', async (_event, id: string) => {
    try {
      const result = await processManager.startProfile(id);
      return result;
    } catch (err) {
      return { success: false, error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:stop', async (_event, id: string) => {
    try {
      return await processManager.stopProfile(id);
    } catch (err) {
      return { success: false, error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:bulkStart', async (_event, profileIds: string[], delayMs?: number) => {
    try {
      return await processManager.startProfilesBatch(profileIds, delayMs, (progress) => {
        try {
          const wins = BrowserWindow.getAllWindows();
          for (const win of wins) {
            if (!win.isDestroyed()) {
              win.webContents.send('profiles:batchProgress', progress);
            }
          }
        } catch {}
      });
    } catch (err) {
      return { results: [], error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:bulkStop', async (_event, profileIds: string[]) => {
    try {
      return await processManager.stopProfilesBatch(profileIds);
    } catch (err) {
      return { results: [], error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:bulkUpdate', async (_event, dto) => {
    try {
      return bulkUpdateProfiles(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkDelete', async (_event, profileIds: string[]) => {
    try {
      for (const id of profileIds) {
        if (processManager.isRunning(id)) {
          await processManager.stopProfile(id);
        }
      }
      return bulkDeleteProfiles(profileIds);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkAssignProxies', async (_event, dto) => {
    try {
      return bulkAssignProxies(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getStatus', async (_event, id: string) => {
    const isRunning = processManager.isRunning(id);
    const pid = processManager.getActivePid(id);
    return { status: isRunning ? 'RUNNING' : 'STOPPED', pid };
  });

  ipcMain.handle('profiles:getRunningProfiles', async () => {
    return processManager.getRunningProfileIds();
  });



  ipcMain.handle('profiles:quickSwitch', async (_event, num: number) => {
    try {
      return await processManager.quickSwitchProfile(num);
    } catch (err) {
      return { success: false, error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:getStats', async (_event, id: string) => {
    try {
      return getProfileStats(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:warm', async (_event, id: string, options?: any) => {
    try {
      return await warmProfile(id, options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:warmBulk', async (_event, ids: string[], options?: any) => {
    try {
      return await warmBulkProfiles(ids, options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  // DASHBOARD METRICS
  ipcMain.handle('dashboard:getMetrics', async (): Promise<DashboardMetrics> => {
    const allProfiles = getProfiles();
    const runningCount = processManager.getRunningCount();
    const stoppedCount = Math.max(0, allProfiles.length - runningCount);
    const proxies = getProxies();
    const workflows = getWorkflows();
    const recentLogs = getActivityLogs({ limit: 10 });
    const recentProfiles = allProfiles.slice(0, 5);

    return {
      totalProfiles: allProfiles.length,
      runningProfiles: runningCount,
      stoppedProfiles: stoppedCount,
      totalProxies: proxies.length,
      activeProxies: proxies.filter((p) => p.status === 'CONNECTED').length,
      totalWorkflows: workflows.length,
      recentActivity: recentLogs,
      recentProfiles,
    };
  });

  // PROXIES
  ipcMain.handle('proxies:getAll', async () => {
    try {
      return getProxies();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:getById', async (_event, id: string) => {
    try {
      return getProxyById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:create', async (_event, dto) => {
    try {
      const validated = CreateProxyDTOSchema.parse(dto);
      return createProxy(validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:parseAndCreate', async (_event, rawString: string, customName?: string) => {
    try {
      return await parseAndCreateProxy(rawString, customName);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:update', async (_event, id: string, dto) => {

    try {
      const validated = UpdateProxyDTOSchema.parse(dto);
      return updateProxy(id, validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:delete', async (_event, id: string) => {
    try {
      return deleteProxy(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxies:test', async (_event, dto) => {
    try {
      return await testProxyConnection(dto);
    } catch (err) {
      return { success: false, latencyMs: 0, errorMessage: sanitizeError(err) };
    }
  });

  // COOKIES
  ipcMain.handle('cookies:get', async (_event, options) => {
    try {
      return getCookies(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:delete', async (_event, profileId: string, cookieId: string) => {
    try {
      return deleteCookie(profileId, cookieId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:deleteAll', async (_event, profileId: string) => {
    try {
      return deleteAllCookies(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:import', async (_event, profileId: string, content: string) => {
    try {
      return importCookies(profileId, content);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:export', async (_event, options) => {
    try {
      return exportCookies(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // HISTORY
  ipcMain.handle('history:get', async (_event, options) => {
    try {
      return getHistory(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('history:delete', async (_event, profileId: string, historyId: string) => {
    try {
      return deleteHistoryItem(profileId, historyId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('history:clear', async (_event, profileId: string) => {
    try {
      return clearHistory(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // EXTENSIONS
  ipcMain.handle('extensions:get', async (_event, profileId: string) => {
    try {
      return getExtensions(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:getStore', async () => []);

  ipcMain.handle('extensions:install', async (_event, dto) => {
    try {
      return installExtension(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:installFromStore', async () => {
    throw new Error('Curated store feature has been removed');
  });

  ipcMain.handle('extensions:installBatch', async () => {
    return { installedCount: 0, extensions: [] };
  });

  ipcMain.handle('extensions:installFromWebStore', async (_event, profileId: string, webStoreUrl: string) => {
    try {
      return await installFromWebStoreUrl(profileId, webStoreUrl);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('extensions:toggle', async (_event, profileId: string, extensionId: string, enabled: boolean) => {
    try {
      return toggleExtension(profileId, extensionId, enabled);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:remove', async (_event, profileId: string, extensionId: string) => {
    try {
      return removeExtension(profileId, extensionId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  // AUTOMATION
  ipcMain.handle('automation:getWorkflows', async () => {
    try {
      return getWorkflows();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:getById', async (_event, id: string) => {
    try {
      return getWorkflowById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:saveWorkflow', async (_event, workflow) => {
    try {
      const validated = AutomationWorkflowSchema.parse(workflow);
      return saveWorkflow(validated);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:deleteWorkflow', async (_event, id: string) => {
    try {
      return deleteWorkflow(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:runWorkflow', async (_event, dto) => {
    try {
      return await runWorkflow(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:runWorkflowBatch', async (_event, dto) => {
    try {
      return await runWorkflowBatch(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:getTemplates', async () => {
    try {
      return RPA_TEMPLATES;
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:getLogs', async (_event, workflowId?: string) => {
    try {
      return getWorkflowLogs(workflowId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  // ARCHIVE (IMPORT/EXPORT)
  ipcMain.handle('archive:preview', async (_event, filePath: string, password?: string) => {
    try {
      return previewProfileArchive(filePath, password);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:import', async (_event, options) => {
    try {
      return importProfileFromArchive(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:export', async (_event, options) => {
    try {
      return exportProfileToArchive(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:exportNetscape', async (_event, profileId: string) => {
    try {
      return exportNetscapeCookies(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:exportBulk', async (_event, options) => {
    try {
      return exportBulkProfilesToArchive(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:importCrossPlatform', async (_event, dto) => {
    try {
      return importCrossPlatformProfiles(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


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
    } catch (err) {
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

  // DIAGNOSTICS & STEALTH AUDIT
  ipcMain.handle('diagnostics:audit', async (_event, profileId: string) => {
    try {
      return auditProfileFingerprint(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('diagnostics:autoFix', async (_event, profileId: string) => {
    try {
      return autoFixProfileFingerprint(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // CAPTCHA SOLVER ENGINE
  ipcMain.handle('captcha:getConfig', async () => {
    try {
      return getCaptchaConfig();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('captcha:saveConfig', async (_event, config) => {
    try {
      return saveCaptchaConfig(config);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('captcha:checkBalance', async (_event, provider, apiKey) => {
    try {
      return await checkCaptchaBalance(provider, apiKey);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('captcha:solve', async (_event, request) => {
    try {
      return await solveCaptcha(request);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // WORKSPACES & TEAM COLLABORATION
  ipcMain.handle('workspace:getAll', async () => {
    try {
      return getWorkspaces();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getById', async (_event, id: string) => {
    try {
      return getWorkspaceById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:create', async (_event, dto) => {
    try {
      return createWorkspace(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:update', async (_event, id: string, dto) => {
    try {
      return updateWorkspace(id, dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:delete', async (_event, id: string) => {
    try {
      return deleteWorkspace(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getActive', async () => {
    try {
      return getActiveWorkspaceId();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:setActive', async (_event, id: string) => {
    try {
      return setActiveWorkspaceId(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getMembers', async (_event, workspaceId: string) => {
    try {
      return getWorkspaceMembers(workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:addMember', async (_event, dto) => {
    try {
      return addWorkspaceMember(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:updateMemberRole', async (_event, memberId: string, role) => {
    try {
      return updateMemberRole(memberId, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:deleteMember', async (_event, memberId: string) => {
    try {
      return deleteWorkspaceMember(memberId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:assignProfile', async (_event, profileId: string, workspaceId: string, memberId: string | null) => {
    try {
      return assignProfileToMember(profileId, workspaceId, memberId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:exportBundle', async (_event, options) => {
    try {
      return await exportWorkspaceBundle(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:importBundle', async (_event, bundleJson: string, targetWorkspaceId?: string) => {
    try {
      return await importWorkspaceBundle(bundleJson, targetWorkspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });




  // LICENSING & MAHI PRO
  ipcMain.handle('license:getStatus', async () => {
    try {
      return validateCurrentLicense();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:activate', async (_event, dto) => {
    try {
      return activateLicense(dto.licenseKey, undefined, dto.deviceName, dto.accountId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:createLicense', async (_event, dto, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required to create licenses.');
    }
    try {
      return createLicense(dto, 'OWNER_ADMIN');
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:getLicenses', async (_event, adminSecret: string, filter) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return getLicenses(filter);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:revokeLicense', async (_event, licenseId: string, adminSecret: string, reason?: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required to revoke licenses.');
    }
    try {
      return revokeLicense(licenseId, reason);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:extendLicense', async (_event, dto, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required to extend licenses.');
    }
    try {
      return extendLicense(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:getDevices', async (_event, licenseId: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return getLicenseDevices(licenseId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:deactivateDevice', async (_event, licenseId: string, deviceId: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return deactivateDevice(licenseId, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('admin:setPin', async (_event, newPin: string, adminSecret: string) => {
    if (!verifyAdminAccess(adminSecret)) {
      throw new Error('Unauthorized. Admin authentication required.');
    }
    try {
      return setOwnerAdminPin(newPin, adminSecret);
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
      properties: (options?.properties as any) || ['openFile'],
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

  // UNIVERSAL BULK IMPORTER HANDLERS
  ipcMain.handle('importer:parsePreview', async (_event, rawText: string) => {
    try {
      return detectAndParseAccountData(rawText);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('importer:executeBulkImport', async (_event, accounts, options) => {
    try {
      return await executeBulkImport(accounts, options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('importer:parseNetscape', async (_event, rawText: string) => {
    try {
      return parseNetscapeCookies(rawText);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // SYNCHRONIZER HANDLERS
  ipcMain.handle('synchronizer:start', async (_event, masterProfileId?: string, activeProfiles?: string[], config?: any) => {
    try {
      return synchronizerHub.startSync(masterProfileId, activeProfiles, config);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('synchronizer:stop', async () => {
    try {
      return synchronizerHub.stopSync();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('synchronizer:getStatus', async () => {
    try {
      return synchronizerHub.getState();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('synchronizer:updateConfig', async (_event, config) => {
    try {
      return synchronizerHub.updateConfig(config);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // UPDATER HANDLERS
  ipcMain.handle('updater:check', async () => {
    try {
      return checkForAppUpdates(true);
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

  ipcMain.handle('updater:install', async () => {
    try {
      applyAndRestartUpdate();
      return true;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // V2 Enterprise Handlers: Folders, Locks, Feature Flags, Fleet & API Keys
  // ─────────────────────────────────────────────────────────────────────────────
  ipcMain.handle('folders:get', async (_event, workspaceId?: string) => {
    try {
      return getFolders(workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:create', async (_event, dto: { name: string; parentId?: string | null; color?: string; icon?: string; workspaceId?: string }) => {
    try {
      return createFolder(dto.name, dto.parentId, dto.color, dto.icon, dto.workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:update', async (_event, id: string, updates: any) => {
    try {
      return updateFolder(id, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:delete', async (_event, id: string, targetFolderName?: string) => {
    try {
      return deleteFolder(id, targetFolderName);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:get', async (_event, profileId: string) => {
    try {
      return getProfileLock(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:acquire', async (_event, profileId: string, userId: string, userName: string, deviceId: string) => {
    try {
      return acquireProfileLock(profileId, userId, userName, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:release', async (_event, profileId: string, userId?: string) => {
    try {
      return releaseProfileLock(profileId, userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('featureFlags:get', async () => {
    try {
      return getFeatureFlags();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('featureFlags:update', async (_event, key: string, updates: any) => {
    try {
      return updateFeatureFlag(key, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('featureFlags:check', async (_event, key: string, userTier?: any, userId?: string, orgId?: string) => {
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

  // COMMERCIAL ARCHITECTURE IPC HANDLERS
  ipcMain.handle('commercial:register', async (_event, dto) => {
    try {
      return registerUser(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:login', async (_event, dto) => {
    try {
      return loginUser(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getEntitlements', async (_event, userId: string, deviceId?: string) => {
    try {
      return evaluateUserEntitlements(userId, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getDevices', async (_event, userId: string) => {
    try {
      return getUserDevices(userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:revokeDevice', async (_event, deviceId: string, userId: string) => {
    try {
      return revokeCommercialDevice(deviceId, { id: userId, name: 'User', role: 'USER' }, userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getPlans', async () => {
    try {
      return getCommercialPlans();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:activateKey', async (_event, userId: string, rawKey: string) => {
    try {
      return activateCommercialLicenseForUser(userId, rawKey);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });





  // Wire event emitters from processManager and audit logger to renderer windows
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
