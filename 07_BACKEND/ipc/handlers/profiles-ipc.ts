import { BrowserWindow, ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import { processManager } from '../../../02_BROWSER/process-manager.js';
import {
  bulkAssignProxies,
  bulkCreateProfiles,
  bulkDeleteProfiles,
  bulkUpdateProfiles,
  claimLegacyProfiles,
  cloneProfile,
  createProfile,
  emptyTrash,
  getProfileById,
  getProfiles,
  getTrashProfiles,
  getUnassignedLegacyProfiles,
  permanentDeleteProfile,
  restoreProfile,
  softDeleteProfile,
  updateProfile,
} from '../../../02_BROWSER/services/profile-service.js';
import { getProxies } from '../../../02_BROWSER/services/proxy-service.js';
import {
  createProfileFromStarter,
  getStarterTemplateById,
  getStarterTemplates,
  isUserNew,
} from '../../../02_BROWSER/services/starter-profiles-service.js';
import { getAccountSession } from '../../../08_SECURITY/account-service.js';
import { assertCanCreateProfile, assertCapability } from '../../../08_SECURITY/freemium-guard.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { getWorkflows } from '../../../09_AUTOMATION/automation-engine.js';
import { warmBulkProfiles, warmProfile } from '../../../09_AUTOMATION/cookie-warmer-service.js';
import type { CookieWarmProfileOptions } from '../../../10_CONFIG/shared/types/automation.js';
import type { DashboardMetrics } from '../../../10_CONFIG/shared/types/ipc.js';
import type { CreateProfileFromStarterOptions } from '../../../10_CONFIG/shared/types/profile.js';
import { CloneProfileDTOSchema, CreateProfileDTOSchema, UpdateProfileDTOSchema } from '../../../10_CONFIG/shared/validation/schemas.js';
import { getActiveUserId } from '../../commercial/session-context.js';
import { getActivityLogs } from '../../services/audit-service.js';
import { getProfileStats } from '../../services/stats-service.js';
import { createLogger } from '../../utils/logger.js';
import { getActiveOwnerId } from './ipc-shared.js';

const log = createLogger('ipc-profiles');

export function registerProfileIpcHandlers(): void {
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
        } catch (ipcErr) {
          log.debug('Skipped profiles:batchProgress IPC send', {
            err: ipcErr instanceof Error ? ipcErr.message : String(ipcErr),
          });
        }
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

  ipcMain.handle('profiles:warm', async (_event, id: string, options?: CookieWarmProfileOptions) => {
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

  ipcMain.handle('profiles:warmBulk', async (_event, ids: string[], options?: CookieWarmProfileOptions) => {
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

  ipcMain.handle('starterProfiles:createFromTemplate', async (_event, templateId: string, options?: CreateProfileFromStarterOptions) => {
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
}
