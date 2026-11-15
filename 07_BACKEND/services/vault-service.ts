import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { app, dialog } from 'electron';
import { getWritableUserDataDir } from '../utils/runtime-paths.js';
import { getProfiles, createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getProxies, createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { getWorkflows, saveWorkflow } from '../../09_AUTOMATION/automation-engine.js';
import { getWorkspaces, createWorkspace } from '../../02_BROWSER/services/workspace-service.js';
import { getAppSettings, updateAppSettings } from './settings-service.js';
import {
  MasterVaultBundle,
  MasterVaultExportOptions,
  MasterVaultImportResult,
} from '../../10_CONFIG/shared/types/resources.js';
import { logActivity } from './audit-service.js';

export async function exportMasterVault(options: MasterVaultExportOptions = {}): Promise<{ success: boolean; filePath: string; bundle: MasterVaultBundle }> {
  const profiles = getProfiles({ includeTrash: false });
  const proxies = getProxies();
  const workflows = getWorkflows();
  const workspaces = getWorkspaces();
  const settings = getAppSettings();

  const rawPayload = JSON.stringify({
    profiles,
    proxies,
    workflows,
    workspaces,
    settings,
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  });

  let bundle: MasterVaultBundle;

  if (options.password && options.password.trim().length > 0) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(options.password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(rawPayload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    bundle = {
      format: 'MAHI_MASTER_VAULT_V1',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      encrypted: true,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag,
      payload: encrypted,
      metadata: {
        profilesCount: profiles.length,
        proxiesCount: proxies.length,
        workflowsCount: workflows.length,
        workspacesCount: workspaces.length,
      },
    };
  } else {
    bundle = {
      format: 'MAHI_MASTER_VAULT_V1',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      encrypted: false,
      payload: Buffer.from(rawPayload, 'utf8').toString('base64'),
      metadata: {
        profilesCount: profiles.length,
        proxiesCount: proxies.length,
        workflowsCount: workflows.length,
        workspacesCount: workspaces.length,
      },
    };
  }

  let targetPath = options.filePath;
  if (!targetPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const defaultName = `MAHI-Vault-Backup-${timestamp}.mahi-vault`;
    let defaultDir = os.tmpdir();
    try {
      if (app && typeof app.getPath === 'function') {
        defaultDir = app.getPath('downloads') || app.getPath('desktop') || getWritableUserDataDir();
      } else {
        defaultDir = getWritableUserDataDir();
      }
    } catch {
      defaultDir = getWritableUserDataDir();
    }
    targetPath = path.join(defaultDir, defaultName);
  }

  fs.writeFileSync(targetPath, JSON.stringify(bundle, null, 2), 'utf8');

  logActivity(
    'SYSTEM',
    'INFO',
    'Vault Export',
    `Exported master vault backup with ${profiles.length} profiles to ${path.basename(targetPath)}`
  );

  return {
    success: true,
    filePath: targetPath,
    bundle,
  };
}

export async function importMasterVault(bundleJson: string, password?: string): Promise<MasterVaultImportResult> {
  try {
    const bundle: MasterVaultBundle = JSON.parse(bundleJson);
    if (bundle.format !== 'MAHI_MASTER_VAULT_V1') {
      throw new Error('Invalid vault bundle format. Must be a valid MAHI_MASTER_VAULT_V1 file.');
    }

    let payloadString = '';

    if (bundle.encrypted) {
      if (!password || !password.trim()) {
        throw new Error('This vault backup is encrypted. Please provide the master password to restore.');
      }
      if (!bundle.salt || !bundle.iv || !bundle.authTag) {
        throw new Error('Corrupted encrypted vault header: missing salt/iv/authTag.');
      }

      const salt = Buffer.from(bundle.salt, 'hex');
      const iv = Buffer.from(bundle.iv, 'hex');
      const authTag = Buffer.from(bundle.authTag, 'hex');
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(bundle.payload, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      payloadString = decrypted;
    } else {
      payloadString = Buffer.from(bundle.payload, 'base64').toString('utf8');
    }

    const data = JSON.parse(payloadString);

    let profilesRestored = 0;
    let proxiesRestored = 0;
    let workflowsRestored = 0;
    let workspacesRestored = 0;

    // 1. Restore Proxies
    if (Array.isArray(data.proxies)) {
      for (const p of data.proxies) {
        try {
          createProxy({
            name: p.name || 'Restored Proxy',
            protocol: (p.protocol || p.type || 'http') as any,
            host: p.host,
            port: p.port,
            username: p.username,
            password: p.password,
            notes: p.notes || 'Vault-Restore',
          });
          proxiesRestored++;
        } catch {}
      }
    }

    // 2. Restore Workspaces
    if (Array.isArray(data.workspaces)) {
      for (const w of data.workspaces) {
        try {
          if (!w.isDefault) {
            createWorkspace({
              name: w.name,
              description: w.description,
              color: w.color,
            });
            workspacesRestored++;
          }
        } catch {}
      }
    }

    // 3. Restore Profiles
    if (Array.isArray(data.profiles)) {
      for (const p of data.profiles) {
        try {
          createProfile({
            name: `${p.name} (Restored)`,
            description: p.description || '',
            folder: p.folder || 'General',
            tags: [...(p.tags || []), 'Vault-Restored'],
            notes: p.notes || '',
            pinned: Boolean(p.pinned),
            settings: p.settings,
          });
          profilesRestored++;
        } catch {}
      }
    }

    // 4. Restore Workflows
    if (Array.isArray(data.workflows)) {
      for (const wf of data.workflows) {
        try {
          saveWorkflow({
            name: `${wf.name} (Restored)`,
            description: wf.description || '',
            steps: wf.steps || [],
            defaultProfileId: wf.defaultProfileId,
          });
          workflowsRestored++;
        } catch {}
      }
    }

    logActivity(
      'SYSTEM',
      'INFO',
      'Vault Import',
      `Master vault restored successfully: ${profilesRestored} profiles, ${proxiesRestored} proxies restored.`
    );

    return {
      success: true,
      profilesRestored,
      proxiesRestored,
      workflowsRestored,
      workspacesRestored,
      message: `Vault successfully restored: ${profilesRestored} profiles, ${proxiesRestored} proxies, ${workflowsRestored} automation workflows.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      profilesRestored: 0,
      proxiesRestored: 0,
      workflowsRestored: 0,
      workspacesRestored: 0,
      message: `Vault Restore Failed: ${msg}`,
    };
  }
}
