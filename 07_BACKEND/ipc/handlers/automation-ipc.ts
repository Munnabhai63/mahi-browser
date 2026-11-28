import { ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import { getProfileById } from '../../../02_BROWSER/services/profile-service.js';
import {
  detectAndParseAccountData,
  executeBulkImport,
  parseNetscapeCookies,
} from '../../../02_BROWSER/services/universal-importer-service.js';
import { auditProfileFingerprint, autoFixProfileFingerprint } from '../../../03_HARDWARE/diagnostics-service.js';
import { assertCapability } from '../../../08_SECURITY/freemium-guard.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import {
  deleteWorkflow,
  getWorkflowById,
  getWorkflowLogs,
  getWorkflows,
  runWorkflow,
  runWorkflowBatch,
  saveWorkflow,
} from '../../../09_AUTOMATION/automation-engine.js';
import { checkCaptchaBalance, getCaptchaConfig, saveCaptchaConfig, solveCaptcha } from '../../../09_AUTOMATION/captcha-service.js';
import { synchronizerHub, type SynchronizerConfig } from '../../../09_AUTOMATION/sync-hub.js';
import { RPA_TEMPLATES } from '../../../10_CONFIG/shared/constants/automation-templates.js';
import { AutomationWorkflowSchema } from '../../../10_CONFIG/shared/validation/schemas.js';
import { getActiveOwnerId } from './ipc-shared.js';

export function registerAutomationIpcHandlers(): void {
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
      const { generateStatisticalProfileSettings } = await import('../../../03_HARDWARE/fingerprint-generator-service.js');
      return generateStatisticalProfileSettings(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('mahi:generate-statistical-fingerprint', async (_event, options) => {
    try {
      const { generateStatisticalProfileSettings } = await import('../../../03_HARDWARE/fingerprint-generator-service.js');
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
  ipcMain.handle('synchronizer:start', async (_event, masterProfileId?: string, activeProfiles?: string[], config?: Partial<SynchronizerConfig>) => {
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
}
