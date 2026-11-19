import { ipcMain, dialog, BrowserWindow, app, shell } from '../../08_SECURITY/electron-bridge.js';
import * as fs from 'fs';
import * as path from 'path';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { getWritableUserDataDir } from '../utils/runtime-paths.js';
import { verifyLicense, getHWID } from '../../08_SECURITY/license-service.js';
import { isOnlineRevoked, isGraceExpired, getOnlineStatusSummary, checkLicenseStatusOnline } from '../../08_SECURITY/license-status-service.js';
import { assertCanCreateProfile, getPlanLimitsInfo, assertCapability } from '../../08_SECURITY/freemium-guard.js';
import { getStarterTemplates, getStarterTemplateById, createProfileFromStarter, isUserNew } from '../../02_BROWSER/services/starter-profiles-service.js';
import { evaluateUserEntitlements, checkCapability, assertEntitled, activateUserTrial, getUserTrialStatus } from '../commercial/commercial-entitlement-service.js';
import { buildPlanCatalog } from '../commercial/pricing-admin-service.js';
import { paymentService } from '../commercial/payment-service.js';
import { getDynamicPrice, fetchDynamicPrice } from '../../08_SECURITY/price-service.js';
import {
  signup as accountSignup,
  login as accountLogin,
  logout as accountLogout,
  fetchAndCacheStatus as accountFetchStatus,
  switchDevice as accountSwitchDevice,
  getPaymentInfo as accountGetPaymentInfo,
  submitManualUpiPayment as accountSubmitManualUpiPayment,
  fetchPricingCatalogFromServer,
  createCheckoutSessionFromServer,
  fetchPaymentStatusFromServer,
  getAccountSession,
  getAccountPlanLimits,
  refreshAccountPlanLimits,
  startAccountStatusScheduler,
  refreshAccountToken,
  verifyEmail as accountVerifyEmail,
  resendVerificationEmail as accountResendVerificationEmail,
  forgotPassword as accountForgotPassword,
  resetPassword as accountResetPassword,
  listActiveSessions as accountListActiveSessions,
  revokeSession as accountRevokeSession,
  revokeAllSessions as accountRevokeAllSessions,
  loginWithToken as accountLoginWithToken,
  createDesktopOAuthRequest,
  exchangeDesktopAuthCode,
  activateTrialFromServer,
  getTrialStatusFromServer
} from '../../08_SECURITY/account-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { setActiveUserId, getActiveUserId, clearActiveSession } from '../commercial/session-context.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getTeamWorkspace,
  updateTeamWorkspace,
  deleteTeamWorkspace,
  transferWorkspaceOwnership,
  getWorkspaceMembers as getTeamWorkspaceMembers,
  updateMemberRole as updateTeamMemberRole,
  removeWorkspaceMember as removeTeamWorkspaceMember,
  inviteWorkspaceMember,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  shareProfileToWorkspace,
  revokeProfileShare,
  listWorkspaceProfiles,
  getWorkspaceAuditLogs,
} from '../services/team-workspace-service.js';
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
  claimLegacyProfiles,
  getUnassignedLegacyProfiles,
} from '../../02_BROWSER/services/profile-service.js';
import { warmProfile, warmBulkProfiles } from '../../09_AUTOMATION/cookie-warmer-service.js';
import {
  checkForAppUpdates,
  startDownloadUpdate,
  applyAndRestartUpdate,
  getAppUpdateStatus,
  getUpdateConfig,
  setUpdateConfig,
} from '../services/updater-service.js';
import { proxyProviderService } from '../services/proxy-provider-service.js';
import { sampleFleetResources, optimizeFleetMemory } from '../../03_HARDWARE/resource-monitor-service.js';
import { exportMasterVault, importMasterVault } from '../services/vault-service.js';
import {
  getDistributionInfo,
  openDistributionFolder,
  fixDesktopShortcuts,
  createProfileShortcut,
} from '../../03_HARDWARE/distribution-service.js';
import {
  isCloudSyncAllowed,
  getCloudSyncUsage,
  getCloudSyncList,
  uploadProfileToCloud,
  downloadAndRestoreProfile,
  deleteCloudProfile,
  getSyncConfig,
  setSyncConfig,
  syncAllProfiles,
  getAllProfilesSyncStatus,
  initCloudSync,
  resolveSyncConflict,
  acquireCloudLock,
  releaseCloudLock,
  getCloudLockStatus,
} from '../../08_SECURITY/cloud-sync-service.js';




import { processManager } from '../../02_BROWSER/process-manager.js';
import {
  getProxies,
  getProxyById,
  createProxy,
  parseAndCreateProxy,
  updateProxy,
  deleteProxy,
  testProxyConnection,
  testAndSaveProxyStatus,
  getDecryptedProxyCredentials,
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
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  ensureManagedEngineInstalled,
  getManagedEngineCurrentProgress,
  addManagedEngineProgressListener,
  repairManagedEngine,
} from '../../02_BROWSER/managed-engine.js';
import { MANAGED_ENGINE_VERSION } from '../../10_CONFIG/engine-config.js';


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
import { activateCommercialLicenseForUser } from '../commercial/commercial-entitlement-service.js';
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

export async function handleProxiesTest(dto: any) {
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

        const testDto = {
          protocol: dto.protocol || savedProxy.protocol,
          host: dto.host || savedProxy.host,
          port: dto.port ? Number(dto.port) : savedProxy.port,
          username: dto.username !== undefined ? dto.username : (savedProxy.username || undefined),
          password: password || undefined,
        };

        return await testProxyConnection(testDto as any);
      }
    }
    return await testProxyConnection(dto);
  } catch (err) {
    return { success: false, latencyMs: 0, errorMessage: sanitizeError(err) };
  }
}

export function registerIpcHandlers(): void {
  function getActiveOwnerId(): string {
    const session = getAccountSession();
    if (session?.account_id) return session.account_id;
    const activeUid = getActiveUserId();
    if (activeUid) return activeUid;
    return 'SYSTEM_OWNER';
  }

  // PROFILES
  ipcMain.handle('profiles:getAll', async (_event, filter) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      // SECURITY: Always enforce server-validated activeOwnerId!
      // Renderer-supplied ownerId is ignored to prevent cross-account enumeration.
      const effectiveFilter = {
        ...(filter || {}),
        ownerId: activeOwnerId,
      };
      return getProfiles(effectiveFilter);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getById', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const profile = getProfileById(id, activeOwnerId);
      if (!profile) {
        throw new Error(`Profile ${id} not found or access denied`);
      }
      return profile;
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:create', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      assertCanCreateProfile(1, activeOwnerId);
      const validated = CreateProfileDTOSchema.parse(dto);
      // Strictly bind to server-validated session ID
      return createProfile({
        ...validated,
        ownerId: activeOwnerId,
      });
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkCreate', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      assertCanCreateProfile(dto?.count || 1, activeOwnerId);
      return bulkCreateProfiles({
        ...dto,
        ownerId: activeOwnerId,
      });
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('profiles:update', async (_event, id: string, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const validated = UpdateProfileDTOSchema.parse(dto);
      return updateProfile(id, validated, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        throw new Error(`Profile ${id} not found or access denied`);
      }
      if (processManager.isRunning(id)) {
        await processManager.stopProfile(id);
      }
      return softDeleteProfile(id, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getTrash', async () => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return getTrashProfiles(activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:restore', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return restoreProfile(id, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:permanentDelete', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        throw new Error(`Profile ${id} not found or access denied`);
      }
      if (processManager.isRunning(id)) {
        await processManager.stopProfile(id);
      }
      return permanentDeleteProfile(id, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:emptyTrash', async () => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return emptyTrash(activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('profiles:clone', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      assertCanCreateProfile(1, activeOwnerId);
      const existing = getProfileById(dto.sourceProfileId, activeOwnerId);
      if (!existing) {
        throw new Error(`Source profile ${dto.sourceProfileId} not found or access denied`);
      }
      const validated = CloneProfileDTOSchema.parse(dto);
      return cloneProfile(validated, undefined, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:start', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        return { success: false, error: `Profile ${id} not found or access denied` };
      }
      const result = await processManager.startProfile(id);
      return result;
    } catch (err) {
      return { success: false, error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:stop', async (_event, id: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        return { success: false, error: `Profile ${id} not found or access denied` };
      }
      return await processManager.stopProfile(id);
    } catch (err) {
      return { success: false, error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:bulkStart', async (_event, profileIds: string[], delayMs?: number) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const authorizedIds = profileIds.filter((id) => Boolean(getProfileById(id, activeOwnerId)));
      if (authorizedIds.length === 0 && profileIds.length > 0) {
        return { results: [], error: 'Profiles not found or access denied' };
      }
      return await processManager.startProfilesBatch(authorizedIds, delayMs, (progress) => {
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
      const activeOwnerId = getActiveOwnerId();
      const authorizedIds = profileIds.filter((id) => Boolean(getProfileById(id, activeOwnerId)));
      return await processManager.stopProfilesBatch(authorizedIds);
    } catch (err) {
      return { results: [], error: sanitizeError(err) };
    }
  });

  ipcMain.handle('profiles:bulkUpdate', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return bulkUpdateProfiles(dto, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkDelete', async (_event, profileIds: string[]) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      for (const id of profileIds) {
        if (processManager.isRunning(id)) {
          await processManager.stopProfile(id);
        }
      }
      return bulkDeleteProfiles(profileIds, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:bulkAssignProxies', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return bulkAssignProxies(dto, activeOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getStatus', async (_event, id: string) => {
    const activeOwnerId = getActiveOwnerId();
    const existing = getProfileById(id, activeOwnerId);
    if (!existing) {
      return { status: 'STOPPED', pid: undefined, error: 'Access denied' };
    }
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
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        throw new Error(`Profile ${id} not found or access denied`);
      }
      return getProfileStats(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:warm', async (_event, id: string, options?: any) => {
    try {
      assertCapability('automation.cookieWarmer');
      const activeOwnerId = getActiveOwnerId();
      const existing = getProfileById(id, activeOwnerId);
      if (!existing) {
        throw new Error(`Profile ${id} not found or access denied`);
      }
      return await warmProfile(id, options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:warmBulk', async (_event, ids: string[], options?: any) => {
    try {
      assertCapability('automation.cookieWarmer');
      const activeOwnerId = getActiveOwnerId();
      const authorizedIds = ids.filter((id) => Boolean(getProfileById(id, activeOwnerId)));
      if (authorizedIds.length === 0 && ids.length > 0) {
        throw new Error('Profiles not found or access denied');
      }
      return await warmBulkProfiles(authorizedIds, options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Safe Owner-Claim process for legacy unassigned SYSTEM_OWNER profiles
  ipcMain.handle('profiles:claimLegacy', async (_event, dto: { profileIds: string[]; userConfirmed: boolean; machineHwid?: string }) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      return claimLegacyProfiles(activeOwnerId, dto.profileIds, {
        userConfirmed: dto.userConfirmed,
        machineHwid: dto.machineHwid,
      });
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profiles:getUnassignedLegacy', async () => {
    try {
      return getUnassignedLegacyProfiles();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  // DASHBOARD METRICS
  ipcMain.handle('dashboard:getMetrics', async (): Promise<DashboardMetrics> => {
    const activeOwnerId = getActiveOwnerId();
    const allProfiles = getProfiles({ ownerId: activeOwnerId });
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

  ipcMain.handle('proxies:test', async (_event, dto) => handleProxiesTest(dto));

  // COMMERCIAL PROXY PROVIDER PLATFORM (Phase 5)
  ipcMain.handle('proxy:getCatalog', async (_event, query) => {
    try {
      return await proxyProviderService.getCatalog(query);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:getProviders', async () => {
    try {
      return await proxyProviderService.getProviders();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:generateSession', async (_event, request) => {
    try {
      return await proxyProviderService.generateSession(request);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:rotateSession', async (_event, sessionId: string) => {
    try {
      return await proxyProviderService.rotateSession(sessionId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:releaseSession', async (_event, sessionId: string) => {
    try {
      return await proxyProviderService.releaseSession(sessionId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:getSessions', async () => {
    try {
      return proxyProviderService.getSessions();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('proxy:getUsage', async (_event, sessionId?: string) => {
    try {
      return await proxyProviderService.getUsage(sessionId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // COOKIES
  ipcMain.handle('cookies:get', async (_event, options) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      if (options?.profileId) {
        const p = getProfileById(options.profileId, activeOwnerId);
        if (!p) return [];
      }
      return getCookies(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:delete', async (_event, profileId: string, cookieId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return deleteCookie(profileId, cookieId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:deleteAll', async (_event, profileId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return deleteAllCookies(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:import', async (_event, profileId: string, content: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return importCookies(profileId, content);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('cookies:export', async (_event, options) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      if (options?.profileId) {
        const p = getProfileById(options.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${options.profileId} not found or access denied`);
      }
      return exportCookies(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // HISTORY
  ipcMain.handle('history:get', async (_event, options) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      if (options?.profileId) {
        const p = getProfileById(options.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${options.profileId} not found or access denied`);
      }
      return getHistory(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('history:delete', async (_event, profileId: string, historyId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return deleteHistoryItem(profileId, historyId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('history:clear', async (_event, profileId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return clearHistory(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // EXTENSIONS
  ipcMain.handle('extensions:get', async (_event, profileId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return getExtensions(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:getStore', async () => []);

  ipcMain.handle('extensions:install', async (_event, dto) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      if (dto?.profileId) {
        const p = getProfileById(dto.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${dto.profileId} not found or access denied`);
      }
      return installExtension(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:installFromStore', async (_event, profileId?: string, _storeExtensionId?: string) => {
    try {
      if (profileId) {
        const activeOwnerId = getActiveOwnerId();
        const p = getProfileById(profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      }
      throw new Error('Curated store feature has been deprecated. Please install via Chrome Web Store URL.');
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:installBatch', async (_event, dto?: { profileId?: string; extensionIds?: string[] }) => {
    try {
      if (dto?.profileId) {
        const activeOwnerId = getActiveOwnerId();
        const p = getProfileById(dto.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${dto.profileId} not found or access denied`);
      }
      return { installedCount: 0, extensions: [] };
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:installFromWebStore', async (_event, profileId: string, webStoreUrl: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return await installFromWebStoreUrl(profileId, webStoreUrl);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });


  ipcMain.handle('extensions:toggle', async (_event, profileId: string, extensionId: string, enabled: boolean) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
      return toggleExtension(profileId, extensionId, enabled);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('extensions:remove', async (_event, profileId: string, extensionId: string) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      const p = getProfileById(profileId, activeOwnerId);
      if (!p) throw new Error(`Profile ${profileId} not found or access denied`);
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
      assertCapability('automation.rpa');
      const activeOwnerId = getActiveOwnerId();
      if (dto?.profileId) {
        const p = getProfileById(dto.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${dto.profileId} not found or access denied`);
      }
      return await runWorkflow(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('automation:runWorkflowBatch', async (_event, dto) => {
    try {
      assertCapability('automation.multiProfile');
      const activeOwnerId = getActiveOwnerId();
      if (Array.isArray(dto?.profileIds)) {
        for (const pid of dto.profileIds) {
          const p = getProfileById(pid, activeOwnerId);
          if (!p) throw new Error(`Profile ${pid} not found or access denied`);
        }
      }
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
      const activeOwnerId = getActiveOwnerId();
      assertCanCreateProfile(1, options?.ownerId || activeOwnerId);
      return importProfileFromArchive({
        ...options,
        ownerId: options?.ownerId || activeOwnerId,
      });
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('archive:export', async (_event, options) => {
    try {
      const activeOwnerId = getActiveOwnerId();
      if (options?.profileId) {
        const p = getProfileById(options.profileId, activeOwnerId);
        if (!p) throw new Error(`Profile ${options.profileId} not found or access denied`);
      }
      return exportProfileToArchive(options);
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
        if (!fs.existsSync(parent)) {
          fs.mkdirSync(parent, { recursive: true });
        }
        fs.writeFileSync(resolved, text, 'utf8');
      }
      return text;
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
      const activeOwnerId = getActiveOwnerId();
      assertCanCreateProfile(1, activeOwnerId);
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

  ipcMain.handle('fingerprint:generateStatistical', async (_event, options) => {
    try {
      const { generateStatisticalProfileSettings } = await import('../../03_HARDWARE/fingerprint-generator-service.js');
      return generateStatisticalProfileSettings(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mahi:generate-statistical-fingerprint', async (_event, options) => {
    try {
      const { generateStatisticalProfileSettings } = await import('../../03_HARDWARE/fingerprint-generator-service.js');
      return generateStatisticalProfileSettings(options);
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

  // PHASE 3 MULTI-USER TEAM WORKSPACES & RBAC
  ipcMain.handle('teamWorkspace:list', async () => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) return [];
      return listUserTeamWorkspaces(userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:create', async (_event, input) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required to create a team workspace');
      assertCapability('workspace.team');
      return createTeamWorkspace(userId, input);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:get', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) return null;
      return getTeamWorkspace(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:update', async (_event, workspaceId: string, updates) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return updateTeamWorkspace(userId, workspaceId, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:delete', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return deleteTeamWorkspace(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:transferOwnership', async (_event, workspaceId: string, newOwnerId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return transferWorkspaceOwnership(userId, workspaceId, newOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:getMembers', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return getTeamWorkspaceMembers(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:inviteMember', async (_event, workspaceId: string, email: string, role) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return await inviteWorkspaceMember(userId, workspaceId, email, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:updateMemberRole', async (_event, workspaceId: string, memberUserId: string, role) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return updateTeamMemberRole(userId, workspaceId, memberUserId, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:removeMember', async (_event, workspaceId: string, memberUserId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return removeTeamWorkspaceMember(userId, workspaceId, memberUserId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:listInvitations', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return listWorkspaceInvitations(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:revokeInvitation', async (_event, workspaceId: string, inviteId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return revokeWorkspaceInvitation(userId, workspaceId, inviteId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:acceptInvitation', async (_event, token: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required to accept an invitation');
      return acceptWorkspaceInvitation(userId, token);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:listProfiles', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return listWorkspaceProfiles(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:shareProfile', async (_event, workspaceId: string, input) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      assertCapability('workspace.sharing');
      return shareProfileToWorkspace(userId, workspaceId, input);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:revokeProfileShare', async (_event, workspaceId: string, cloudProfileId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return revokeProfileShare(userId, workspaceId, cloudProfileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:getAuditLogs', async (_event, workspaceId: string, limit?: number) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return getWorkspaceAuditLogs(userId, workspaceId, limit);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });




  // LICENSING & MAHI PRO
  ipcMain.handle('license:getStatus', async () => {
    try {
      const userDataDir = getWritableUserDataDir();
      const licenseFile = path.join(userDataDir, 'offline-license.key');
      if (fs.existsSync(licenseFile)) {
        const rawKey = fs.readFileSync(licenseFile, 'utf8').trim();
        if (rawKey) {
          const check = verifyLicense(rawKey);
          if (check.valid) {
            if (isOnlineRevoked()) {
              return {
                isValid: false,
                status: 'REVOKED',
                message: 'License revoked. Support se contact karein.',
                license: {
                  id: 'local-rsa-license',
                  customerName: 'MAHI PRO Subscriber',
                  keyMasked: 'MAHI-RSA-REVOKED',
                  expiresAt: check.expiresAt,
                  maxDevices: 1,
                  activeDevicesCount: 1,
                },
              };
            }
            if (isGraceExpired()) {
              return {
                isValid: false,
                status: 'GRACE_EXPIRED',
                message: 'Internet se connect karein — license verify ke liye',
                license: {
                  id: 'local-rsa-license',
                  customerName: 'MAHI PRO Subscriber',
                  keyMasked: 'MAHI-RSA-OFFLINE',
                  expiresAt: check.expiresAt,
                  maxDevices: 1,
                  activeDevicesCount: 1,
                },
              };
            }
            return {
              isValid: true,
              status: 'ACTIVE',
              message: 'MAHI Pro Active',
              license: {
                id: 'local-rsa-license',
                customerName: 'MAHI PRO Subscriber',
                keyMasked: 'MAHI-RSA-ACTIVE',
                expiresAt: check.expiresAt || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                maxDevices: 1,
                activeDevicesCount: 1,
              },
            };
          } else if (check.error === 'License has expired') {
            return {
              isValid: false,
              status: 'EXPIRED',
              message: 'Your MAHI PRO license has expired. Free plan limits apply.',
              license: {
                id: 'local-rsa-license',
                customerName: 'MAHI PRO Subscriber',
                keyMasked: 'MAHI-RSA-EXPIRED',
                expiresAt: check.expiresAt,
                maxDevices: 1,
                activeDevicesCount: 1,
              },
            };
          }
        }
      }
      return validateCurrentLicense();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:getOnlineStatus', async () => {
    try {
      return getOnlineStatusSummary();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:checkOnlineNow', async () => {
    try {
      return await checkLicenseStatusOnline();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('app:getDynamicPrice', async () => {
    try {
      return getDynamicPrice();
    } catch (err) {
      return 599;
    }
  });

  ipcMain.handle('license:activate', async (_event, dto) => {
    try {
      const rawKey = dto?.licenseKey?.trim();
      if (!rawKey) {
        return { success: false, status: 'NOT_ACTIVATED', message: 'License key is required.' };
      }

      // 1. Check RSA signature
      const rsaCheck = verifyLicense(rawKey);
      if (rsaCheck.valid) {
        const userDataDir = getWritableUserDataDir();
        const licenseFile = path.join(userDataDir, 'offline-license.key');
        fs.writeFileSync(licenseFile, rawKey, 'utf8');
        setActiveUserId('local-license-user');
        return {
          success: true,
          status: 'ACTIVE',
          message: 'MAHI Pro license successfully activated!',
        };
      }

      // Only RSA-2048 verified licenses can activate
      return {
        success: false,
        status: 'NOT_ACTIVATED',
        message: rsaCheck.error || 'Invalid RSA-2048 license key. A cryptographically signed MAHI- license is required.',
      };
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('license:getLimits', async () => {
    return getPlanLimitsInfo(getActiveOwnerId());
  });

  ipcMain.handle('admin:createLicense', async (_event, _dto, _adminSecret: string) => {
    throw new Error('License minting is disabled in the app. Contact support.');
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
      assertCapability('automation.synchronizer');
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

  ipcMain.handle('updater:install', async (_event, options?: any) => {
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

  ipcMain.handle('updater:setConfig', async (_event, config: any) => {
    try {
      return setUpdateConfig(config);
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // V2 Enterprise Handlers: Folders, Locks, Feature Flags, Fleet & API Keys
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  ipcMain.handle('commercial:getHwid', async () => getHWID());

  ipcMain.handle('commercial:login', async (_event, dto) => {
    try {
      const claimedFile = path.join(getWritableUserDataDir(), 'claimed-licenses.json');
      const licenseFile = path.join(getWritableUserDataDir(), 'offline-license.key');

      // Helper: read claimed licenses { email -> licenseKey }
      function readClaimed(): Record<string, string> {
        try { return JSON.parse(fs.readFileSync(claimedFile, 'utf8')); } catch { return {}; }
      }
      function writeClaimed(data: Record<string, string>) {
        fs.writeFileSync(claimedFile, JSON.stringify(data), 'utf8');
      }

      // â”€â”€ MODE 1: CHECK_LICENSE â”€â”€
      // Called after user logs in with email+password.
      // Returns: { success: true, licenseKey } if email has valid license
      //          { needsLicense: true }        if email has no license yet
      if (dto.mode === 'CHECK_LICENSE') {
        const claimed = readClaimed();
        const storedKey = claimed[dto.email?.toLowerCase()];
        if (storedKey) {
          const check = verifyLicense(storedKey);
          if (check.valid) {
            setActiveUserId('local-license-user');
            return { success: true, licenseKey: storedKey };
          } else {
            // License expired â€” remove it and ask for new one
            delete claimed[dto.email?.toLowerCase()];
            writeClaimed(claimed);
            return { needsLicense: true, error: 'License expired. Please enter a new key.' };
          }
        }
        return { needsLicense: true };
      }

      // â”€â”€ MODE 2: ACTIVATE_LICENSE â”€â”€
      // Called when user submits a new license key.
      // Validates the key, ensures 1-to-1 email mapping, saves it.
      if (dto.mode === 'ACTIVATE_LICENSE') {
        const { email, licenseKey: rawKey } = dto;
        if (!email || !rawKey) return { success: false, error: 'Missing email or license key.' };

        const check = verifyLicense(rawKey);
        if (!check.valid) return { success: false, error: check.error || 'Invalid license key.' };

        const claimed = readClaimed();
        const emailLower = email.toLowerCase();

        // Check if this license key is already claimed by a DIFFERENT email
        const alreadyClaimedBy = claimed[Object.keys(claimed).find(k => claimed[k] === rawKey) || ''];
        if (alreadyClaimedBy && alreadyClaimedBy !== emailLower) {
          return { success: false, error: 'This license key is already activated on another account.' };
        }

        // Link license to this email
        claimed[emailLower] = rawKey;
        writeClaimed(claimed);
        fs.writeFileSync(licenseFile, rawKey, 'utf8');

        setActiveUserId('local-license-user');
        return { success: true, licenseKey: rawKey };
      }

      // â”€â”€ LEGACY: LICENSE_MODE (auto-login on app start) â”€â”€
      if (dto.password === 'LICENSE_MODE') {
        let licenseKey = dto.email;
        if (licenseKey === 'AUTO') {
          if (fs.existsSync(licenseFile)) {
            licenseKey = fs.readFileSync(licenseFile, 'utf8').trim();
          } else {
            return { success: false, error: 'NO_SAVED_LICENSE' };
          }
        }
        const check = verifyLicense(licenseKey);
        if (check.valid) {
          setActiveUserId('local-license-user');
          const user = { id: 'local-license-user', email: 'Enterprise License', name: 'MAHI PRO', role: 'PRO' as any, status: 'ACTIVE' as any, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          return { success: true, user, token: licenseKey };
        }
        return { success: false, error: check.error };
      }

      // â”€â”€ Normal DB login (fallback) â”€â”€
      const result = loginUser(dto);
      if (result.success && result.user) setActiveUserId(result.user.id);
      return result;

    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('commercial:getEntitlements', async (_event, userId?: string, deviceId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return evaluateUserEntitlements(uid, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('entitlements:get', async (_event, userId?: string, deviceId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return evaluateUserEntitlements(uid, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('entitlements:checkCapability', async (_event, capability: any, userId?: string) => {
    try {
      const uid = userId || getActiveUserId() || getAccountSession()?.account_id || 'anonymous';
      return checkCapability(uid, capability);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Starter / Demo Profiles (New User Clean Onboarding)
  ipcMain.handle('starterProfiles:getTemplates', async () => {
    try {
      return getStarterTemplates();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('starterProfiles:getTemplateById', async (_event, id: string) => {
    try {
      return getStarterTemplateById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('starterProfiles:isUserNew', async (_event, ownerId?: string) => {
    try {
      const uid = ownerId || getActiveUserId() || getAccountSession()?.account_id;
      return isUserNew(uid);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('starterProfiles:createFromTemplate', async (_event, templateId: string, options?: any) => {
    try {
      const session = getAccountSession();
      const resolvedOwnerId = options?.ownerId || getActiveUserId() || session?.account_id;
      return createProfileFromStarter(templateId, {
        ...options,
        ownerId: resolvedOwnerId,
      });
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
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('engine:repair', async () => {
    try {
      return await repairManagedEngine();
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Cloud Profile Sync Handlers (GoLogin-style)
  ipcMain.handle('sync:isAllowed', async () => isCloudSyncAllowed());
  ipcMain.handle('sync:getUsage', async () => getCloudSyncUsage());
  ipcMain.handle('sync:list', async () => getCloudSyncList());
  ipcMain.handle('sync:upload', async (_e, profileId: string) => {
    assertCapability('cloud.sync');
    return uploadProfileToCloud(profileId);
  });
  ipcMain.handle('sync:restore', async (_e, cloudProfileId: string, options?: any) => {
    assertCapability('cloud.sync');
    const activeOwnerId = getActiveOwnerId();
    assertCanCreateProfile(1, activeOwnerId);
    return downloadAndRestoreProfile(cloudProfileId, options);
  });
  ipcMain.handle('sync:delete', async (_e, cloudProfileId: string) => deleteCloudProfile(cloudProfileId));
  ipcMain.handle('sync:getConfig', async () => getSyncConfig());
  ipcMain.handle('sync:setConfig', async (_e, config: any) => setSyncConfig(config));
  ipcMain.handle('sync:syncAll', async () => {
    assertCapability('cloud.sync');
    return syncAllProfiles();
  });
  ipcMain.handle('sync:getAllStatuses', async () => getAllProfilesSyncStatus());
  ipcMain.handle('sync:resolveConflict', async (_e, profileId: string, resolution: any) => resolveSyncConflict(profileId, resolution));
  ipcMain.handle('sync:lock:acquire', async (_e, cloudProfileId: string, ttlSeconds?: number) => acquireCloudLock(cloudProfileId, ttlSeconds));
  ipcMain.handle('sync:lock:release', async (_e, cloudProfileId: string) => releaseCloudLock(cloudProfileId));
  ipcMain.handle('sync:lock:status', async (_e, cloudProfileId: string) => getCloudLockStatus(cloudProfileId));

  // Account & Subscription IPC Handlers (v1.1.0+)
  ipcMain.handle('account:signup', async (_e, dto: { email: string; password: string }) => {
    const res = await accountSignup(dto.email, dto.password);
    if (res.success && (res as any).user?.id) {
      setActiveUserId((res as any).user.id);
    }
    return res;
  });
  ipcMain.handle('account:login', async (_e, dto: { email: string; password: string }) => {
    const res = await accountLogin(dto.email, dto.password);
    if (res.success && (res as any).user?.id) {
      setActiveUserId((res as any).user.id);
    }
    return res;
  });
  ipcMain.handle('account:loginWithToken', async (_e, dto: { token: string } | string) => {
    const token = typeof dto === 'string' ? dto : dto.token;
    const res = await accountLoginWithToken(token);
    if (res.success && (res as any).user?.id) {
      setActiveUserId((res as any).user.id);
    }
    return res;
  });
  ipcMain.handle('commercial:logout', async () => {
    clearActiveSession();
    return accountLogout();
  });
  ipcMain.handle('account:logout', async () => {
    clearActiveSession();
    return accountLogout();
  });
  ipcMain.handle('account:getStatus', async () => {
    return accountFetchStatus();
  });
  ipcMain.handle('account:switchDevice', async () => {
    return accountSwitchDevice();
  });
  ipcMain.handle('account:getPaymentInfo', async () => {
    return accountGetPaymentInfo();
  });
  ipcMain.handle('account:getPricingCatalog', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        return { success: true, catalog: buildPlanCatalog() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    const remoteRes = await fetchPricingCatalogFromServer();
    if (remoteRes.success && remoteRes.catalog) {
      return remoteRes;
    }
    // Offline / fallback to local builder
    try {
      return { success: true, catalog: buildPlanCatalog() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('account:createCheckoutSession', async (_e, payload: any) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const result = await paymentService.createCheckoutSession({
          userId,
          planId: payload.planId || payload.plan_id,
          billingCycle: (payload.billingCycle || payload.billing_cycle || 'ANNUAL').toUpperCase(),
          currency: payload.currency || 'INR',
          extraMembers: payload.extraMembers,
          extraProxyGb: payload.extraProxyGb,
          successUrl: payload.successUrl,
          cancelUrl: payload.cancelUrl,
        }, payload.provider || 'youpi_pg');
        return { success: true, session: result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const remoteRes = await createCheckoutSessionFromServer(payload);
    if (remoteRes.success && remoteRes.session?.checkoutUrl) {
      const url = remoteRes.session.checkoutUrl;
      if (url.startsWith('https://') || url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
        try {
          await shell.openExternal(url);
        } catch {}
      }
    }
    return remoteRes;
  });

  ipcMain.handle('account:submitManualUpiPayment', async (_e, payload: any) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const res = await paymentService.submitManualUpiPayment({
          userId,
          planId: payload.plan_id || payload.planId,
          billingCycle: (payload.billing_cycle || payload.billingCycle || 'MONTHLY').toUpperCase() as any,
          utr: payload.utr,
          proofAsset: payload.proof_asset || payload.proofAsset,
          extraMembers: payload.extra_members || payload.extraMembers,
          extraProxyGb: payload.extra_proxy_gb || payload.extraProxyGb,
        });
        return {
          success: true,
          payment_id: res.paymentId,
          status: res.status,
          utr: res.utr,
          amount_paise: res.amountPaise,
          message: 'Payment submitted successfully for verification.'
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return await accountSubmitManualUpiPayment({
      plan_id: payload.plan_id || payload.planId,
      billing_cycle: payload.billing_cycle || payload.billingCycle,
      utr: payload.utr,
      proof_asset: payload.proof_asset || payload.proofAsset,
      extra_members: payload.extra_members || payload.extraMembers,
      extra_proxy_gb: payload.extra_proxy_gb || payload.extraProxyGb,
    });
  });

  ipcMain.handle('account:getPaymentStatus', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      try {
        const session = getAccountSession();
        const userId = session?.account_id || getActiveUserId() || 'SYSTEM_OWNER';
        const history = paymentService.getUserPaymentHistory(userId);
        return { success: true, payments: history };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return await fetchPaymentStatusFromServer();
  });
  ipcMain.handle('account:getSession', async () => {
    return getAccountSession();
  });
  ipcMain.handle('account:getPlanLimits', async (_e, dto?: { force?: boolean }) => {
    return refreshAccountPlanLimits(dto?.force);
  });
  ipcMain.handle('account:refreshPlanLimits', async () => {
    return refreshAccountPlanLimits(true);
  });
  ipcMain.handle('app:getVersion', async () => {
    try {
      if (app && typeof app.getVersion === 'function') {
        const v = app.getVersion();
        if (v) return v;
      }
    } catch {}
    return APP_VERSION;
  });
  ipcMain.handle('app:getDiagnostics', async () => {
    let version = APP_VERSION;
    try {
      if (app && typeof app.getVersion === 'function') {
        const v = app.getVersion();
        if (v) version = v;
      }
    } catch {}

    let logTail = '';
    try {
      const crashLogPath = path.join(getWritableUserDataDir(), 'crash-log.txt');
      if (fs.existsSync(crashLogPath)) {
        const content = fs.readFileSync(crashLogPath, 'utf-8');
        const lines = content.split('\n');
        logTail = lines.slice(-200).join('\n');
        if (logTail.length > 20000) {
          logTail = logTail.slice(-20000);
        }
      }
    } catch {}

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

  ipcMain.handle('account:verifyEmail', async (_e, dto: { token: string }) => {
    return accountVerifyEmail(dto.token);
  });
  ipcMain.handle('account:resendVerification', async (_e, dto: { email: string }) => {
    return accountResendVerificationEmail(dto.email);
  });
  ipcMain.handle('account:forgotPassword', async (_e, dto: { email: string }) => {
    return accountForgotPassword(dto.email);
  });
  ipcMain.handle('account:resetPassword', async (_e, dto: { token: string; newPassword: string }) => {
    return accountResetPassword(dto.token, dto.newPassword);
  });
  ipcMain.handle('account:listSessions', async () => {
    return accountListActiveSessions();
  });
  ipcMain.handle('account:revokeSession', async (_e, dto: { sessionId: string }) => {
    return accountRevokeSession(dto.sessionId);
  });
  ipcMain.handle('account:revokeAllSessions', async (_e, dto?: { keepCurrent?: boolean }) => {
    return accountRevokeAllSessions(dto?.keepCurrent ?? true);
  });
  ipcMain.handle('account:refreshToken', async () => {
    return refreshAccountToken();
  });
  ipcMain.handle('account:startDesktopOAuth', async (_e, planId?: string) => {
    return createDesktopOAuthRequest(planId);
  });
  ipcMain.handle('account:exchangeDesktopCode', async (_e, dto: { ticket: string; code: string }) => {
    return exchangeDesktopAuthCode(dto.ticket, dto.code);
  });
  ipcMain.handle('account:activateTrial', async (_e, planId?: string) => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      const activeUserId = getActiveUserId() || 'local-license-user';
      return activateUserTrial(activeUserId, planId || 'professional_50');
    }
    return activateTrialFromServer(planId || 'professional_50');
  });
  ipcMain.handle('account:getTrialStatus', async () => {
    if (process.env.MAHI_LOCAL_COMMERCIAL_MODE === 'true') {
      const activeUserId = getActiveUserId() || 'local-license-user';
      return { success: true, ...getUserTrialStatus(activeUserId) };
    }
    return getTrialStatusFromServer();
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






