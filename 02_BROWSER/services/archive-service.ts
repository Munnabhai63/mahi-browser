import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import * as electron from 'electron';
import {
  ExportProfileOptions,
  BulkExportOptions,
  ImportProfileOptions,
  ImportProfilePreview,
  CrossPlatformImportDTO,
  CrossPlatformImportResult,
  MahiProfileArchiveData,
} from '../../10_CONFIG/shared/types/archive.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { getProfileById, createProfile, getProfileStoragePath } from './profile-service.js';
import { getCookies, importCookies } from './cookie-service.js';
import { getHistory } from './history-service.js';
import { getExtensions, installExtension } from './extension-service.js';
import { createProxy } from './proxy-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { encryptData, decryptData, deriveKeyFromPassword } from '../../08_SECURITY/encryption.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';


interface RawArchiveFileStructure {
  magic: 'MAHI_PROFILE_ARCHIVE';
  version: '1.0';
  isEncrypted: boolean;
  saltHex?: string;
  payload: string; // Base64 JSON or encrypted ciphertext
}

function getDefaultExportDir(): string {
  try {
    const electronObj = electron as any;
    const app = electronObj?.app || electronObj?.default?.app;
    if (app && typeof app.getPath === 'function') {
      const p = app.getPath('downloads');
      if (p && fs.existsSync(p)) return p;
    }
  } catch {}
  return os.tmpdir();
}

const EXCLUDED_DIRS = new Set([
  'cache',
  'code cache',
  'gpucache',
  'dawncache',
  'dawngraphitecache',
  'dawnwebgpucache',
  'service worker',
  'shared dictionary',
  'fonts_config',
  'blob_storage',
  'cachestorage',
  'scriptcache',
  'crashpad',
  '.tmp'
]);

export function collectEssentialStorageFiles(profileId: string): Record<string, string> {
  const baseDir = getProfileStoragePath(profileId);
  const filesMap: Record<string, string> = {};

  if (!fs.existsSync(baseDir)) return filesMap;

  let totalBytes = 0;
  const MAX_STORAGE_BYTES = 180 * 1024 * 1024; // 180MB

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const lowerName = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(lowerName)) {
          continue; // Exclude browser caches
        }
        scan(fullPath);
      } else if (entry.isFile()) {
        if (lowerName.endsWith('.tmp') || lowerName.endsWith('.lock')) {
          continue;
        }
        try {
          const stat = fs.statSync(fullPath);
          if (totalBytes + stat.size > MAX_STORAGE_BYTES) {
            continue;
          }
          const content = fs.readFileSync(fullPath);
          totalBytes += stat.size;
          filesMap[relPath] = content.toString('base64');
        } catch {}
      }
    }
  }

  try {
    scan(baseDir);
  } catch {}

  return filesMap;
}

export function restoreStorageFiles(profileId: string, filesMap: Record<string, string>): void {
  const baseDir = getProfileStoragePath(profileId);
  for (const [relPath, b64Data] of Object.entries(filesMap)) {
    try {
      const targetPath = path.join(baseDir, relPath);
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, Buffer.from(b64Data, 'base64'));
    } catch (err) {
      console.warn(`[ArchiveService] Failed to restore file ${relPath}:`, err);
    }
  }
}

export function exportProfileToArchive(options: ExportProfileOptions): { success: boolean; filePath: string } {
  const profile = getProfileById(options.profileId);
  if (!profile) {
    throw new Error(`Profile ${options.profileId} not found`);
  }

  const archiveData: MahiProfileArchiveData = {
    formatVersion: '1.0',
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    profile,
  };

  if (options.includeCookies) {
    archiveData.cookies = getCookies({ profileId: profile.id });
  }

  if (options.includeHistory) {
    archiveData.history = getHistory({ profileId: profile.id });
  }

  if (options.includeExtensions) {
    archiveData.extensions = getExtensions(profile.id);
  }

  if (options.includeStorage) {
    archiveData.storageFiles = collectEssentialStorageFiles(profile.id);
  }

  const jsonStr = JSON.stringify(archiveData);
  let fileStructure: RawArchiveFileStructure;

  if (options.password && options.password.trim().length > 0) {
    const salt = crypto.randomBytes(16);
    const derivedKey = deriveKeyFromPassword(options.password, salt);
    const encryptedPayload = encryptData(jsonStr, derivedKey);

    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: true,
      saltHex: salt.toString('hex'),
      payload: encryptedPayload,
    };
  } else {
    // Unencrypted or master-encrypted
    const encryptedPayload = encryptData(jsonStr);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: false,
      payload: encryptedPayload,
    };
  }

  const targetPath = options.targetFilePath || path.join(getDefaultExportDir(), `${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mahi-profile`);
  const parentDir = path.dirname(targetPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(fileStructure, null, 2), 'utf8');

  logActivity('PROFILE', 'SUCCESS', 'Export Profile', `Exported profile "${profile.name}" to archive`, profile.id, profile.name);

  return { success: true, filePath: targetPath };
}

export function previewProfileArchive(filePath: string, password?: string): ImportProfilePreview {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      formatVersion: '',
      exportedAt: '',
      profileName: '',
      folder: '',
      tags: [],
      cookieCount: 0,
      historyCount: 0,
      extensionCount: 0,
      browserEngine: '',
      isEncrypted: false,
      errorMessage: `File not found at ${filePath}`,
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const fileStructure: RawArchiveFileStructure = JSON.parse(raw);

    if (fileStructure.magic !== 'MAHI_PROFILE_ARCHIVE') {
      return {
        valid: false,
        formatVersion: '',
        exportedAt: '',
        profileName: '',
        folder: '',
        tags: [],
        cookieCount: 0,
        historyCount: 0,
        extensionCount: 0,
        browserEngine: '',
        isEncrypted: false,
        errorMessage: 'Invalid archive format. Missing Mahi header.',
      };
    }

    let jsonStr: string;
    if (fileStructure.isEncrypted) {
      if (!password) {
        return {
          valid: true,
          formatVersion: fileStructure.version,
          exportedAt: '',
          profileName: '',
          folder: '',
          tags: [],
          cookieCount: 0,
          historyCount: 0,
          extensionCount: 0,
          browserEngine: '',
          isEncrypted: true,
          errorMessage: 'Password required to decrypt profile archive',
        };
      }

      const salt = Buffer.from(fileStructure.saltHex!, 'hex');
      const derivedKey = deriveKeyFromPassword(password, salt);
      try {
        jsonStr = decryptData(fileStructure.payload, derivedKey);
      } catch {
        return {
          valid: false,
          formatVersion: fileStructure.version,
          exportedAt: '',
          profileName: '',
          folder: '',
          tags: [],
          cookieCount: 0,
          historyCount: 0,
          extensionCount: 0,
          browserEngine: '',
          isEncrypted: true,
          errorMessage: 'Incorrect password for profile archive',
        };
      }
    } else {
      try {
        jsonStr = decryptData(fileStructure.payload);
      } catch {
        jsonStr = Buffer.from(fileStructure.payload, 'base64').toString('utf8');
      }
    }

    const archiveData: MahiProfileArchiveData = JSON.parse(jsonStr);
    return {
      valid: true,
      formatVersion: archiveData.formatVersion,
      exportedAt: archiveData.exportedAt,
      profileName: archiveData.profile.name,
      folder: archiveData.profile.folder,
      tags: archiveData.profile.tags,
      cookieCount: archiveData.cookies?.length || 0,
      historyCount: archiveData.history?.length || 0,
      extensionCount: archiveData.extensions?.length || 0,
      browserEngine: archiveData.profile.settings?.browser?.engine || 'chrome',
      isEncrypted: fileStructure.isEncrypted,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      formatVersion: '',
      exportedAt: '',
      profileName: '',
      folder: '',
      tags: [],
      cookieCount: 0,
      historyCount: 0,
      extensionCount: 0,
      browserEngine: '',
      isEncrypted: false,
      errorMessage: `Failed to read archive: ${msg}`,
    };
  }
}

export function importProfileFromArchive(options: ImportProfileOptions) {
  const preview = previewProfileArchive(options.sourceFilePath, options.password);
  if (!preview.valid) {
    throw new Error(preview.errorMessage || 'Invalid archive');
  }

  const raw = fs.readFileSync(options.sourceFilePath, 'utf8');
  const fileStructure: RawArchiveFileStructure = JSON.parse(raw);

  let jsonStr: string;
  if (fileStructure.isEncrypted) {
    const salt = Buffer.from(fileStructure.saltHex!, 'hex');
    const derivedKey = deriveKeyFromPassword(options.password!, salt);
    jsonStr = decryptData(fileStructure.payload, derivedKey);
  } else {
    try {
      jsonStr = decryptData(fileStructure.payload);
    } catch {
      jsonStr = Buffer.from(fileStructure.payload, 'base64').toString('utf8');
    }
  }

  const archiveData: MahiProfileArchiveData = JSON.parse(jsonStr);
  const orig = archiveData.profile;

  const profileName = options.overrideName || `${orig.name} (Imported)`;
  const folder = options.targetFolder || orig.folder || 'General';

  const newProfile = createProfile({
    name: profileName,
    description: orig.description,
    folder,
    tags: orig.tags,
    notes: orig.notes,
    ownerId: options.ownerId || orig.ownerId,
    settings: orig.settings,
  });

  // Import cookies if present
  if (archiveData.cookies && archiveData.cookies.length > 0) {
    importCookies(newProfile.id, JSON.stringify(archiveData.cookies));
  }

  // Import extensions if present
  if (archiveData.extensions && archiveData.extensions.length > 0) {
    for (const ext of archiveData.extensions) {
      try {
        installExtension({
          profileId: newProfile.id,
          sourcePath: ext.sourcePath,
          name: ext.name,
        });
      } catch {
        // ignore
      }
    }
  }

  // Import storage files if present (preferences, cookies, localStorage, etc.)
  if (archiveData.storageFiles && Object.keys(archiveData.storageFiles).length > 0) {
    restoreStorageFiles(newProfile.id, archiveData.storageFiles);
  }

  logActivity('PROFILE', 'SUCCESS', 'Import Profile', `Imported profile archive into "${profileName}"`, newProfile.id, profileName);

  return getProfileById(newProfile.id)!;
}

/**
 * Formats all cookies of a profile into standard Netscape HTTP Cookie file format (.txt)
 */
export function exportNetscapeCookies(profileId: string): string {
  const profile = getProfileById(profileId);
  if (!profile) throw new Error(`Profile ${profileId} not found`);

  const cookies = getCookies({ profileId });
  const lines: string[] = [
    '# Netscape HTTP Cookie File',
    '# http://curl.haxx.se/rfc/cookie_spec.html',
    '# This file was generated by MAHI BROWSER',
    `# Profile: ${profile.name} (Exported at ${new Date().toISOString()})`,
    '',
  ];

  for (const c of cookies) {
    const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = c.path || '/';
    const isSecure = c.secure ? 'TRUE' : 'FALSE';
    const expiry = c.expires ? Math.floor(new Date(c.expires).getTime() / 1000) : 0;
    lines.push(`${domain}\t${includeSubdomains}\t${path}\t${isSecure}\t${expiry}\t${c.name}\t${c.value}`);
  }

  logActivity('COOKIES', 'SUCCESS', 'Export Netscape Cookies', `Exported ${cookies.length} Netscape cookies for "${profile.name}"`, profile.id, profile.name);
  return lines.join('\n');
}

/**
 * Exports multiple profiles into a single compressed .mahi-backup archive
 */
export function exportBulkProfilesToArchive(options: BulkExportOptions): { success: boolean; filePath: string; profileCount: number } {
  const archives: MahiProfileArchiveData[] = [];

  for (const pid of options.profileIds) {
    const profile = getProfileById(pid);
    if (!profile) continue;

    const data: MahiProfileArchiveData = {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      profile,
    };

    if (options.includeCookies) {
      data.cookies = getCookies({ profileId: profile.id });
    }
    if (options.includeHistory) {
      data.history = getHistory({ profileId: profile.id });
    }
    if (options.includeExtensions) {
      data.extensions = getExtensions(profile.id);
    }
    archives.push(data);
  }

  const jsonStr = JSON.stringify({
    magic: 'MAHI_BULK_BACKUP',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profilesCount: archives.length,
    profiles: archives,
  });

  let fileStructure: RawArchiveFileStructure;
  if (options.password && options.password.trim().length > 0) {
    const salt = crypto.randomBytes(16);
    const derivedKey = deriveKeyFromPassword(options.password, salt);
    const encryptedPayload = encryptData(jsonStr, derivedKey);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: true,
      saltHex: salt.toString('hex'),
      payload: encryptedPayload,
    };
  } else {
    const encryptedPayload = encryptData(jsonStr);
    fileStructure = {
      magic: 'MAHI_PROFILE_ARCHIVE',
      version: '1.0',
      isEncrypted: false,
      payload: encryptedPayload,
    };
  }

  const targetPath = options.targetFilePath || path.join(getDefaultExportDir(), `MAHI_Backup_${Date.now()}.mahi-backup`);
  const parentDir = path.dirname(targetPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(fileStructure, null, 2), 'utf8');
  logActivity('PROFILE', 'SUCCESS', 'Bulk Export', `Exported ${archives.length} profiles to backup archive`, undefined, 'Bulk Archive');

  return { success: true, filePath: targetPath, profileCount: archives.length };
}

/**
 * Imports profiles from external platforms (Dolphin Anty, AdsPower, GoLogin, Generic JSON)
 */
export function importCrossPlatformProfiles(dto: CrossPlatformImportDTO): CrossPlatformImportResult {
  const { platform, jsonData, targetFolder = 'Imported' } = dto;
  const importedProfiles: Profile[] = [];
  const errors: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch (err: any) {
    return { success: false, importedCount: 0, profiles: [], errors: [`Invalid JSON: ${err.message}`] };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const name = item.name || item.title || item.profile_name || `Imported-${platform}-${i + 1}`;
      const userAgent = item.userAgent || item.user_agent || item.ua || undefined;
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [platform.toLowerCase()];
      const cookies = item.cookies || item.cookie || [];

      // Create defaults
      const settings = getDefaultProfileSettings();
      if (userAgent) {
        settings.browser.userAgent = userAgent;
      }

      if (item.proxy) {
        // Map proxy if present
        const pHost = item.proxy.host || item.proxy.ip || item.proxy.server;
        const pPort = parseInt(String(item.proxy.port), 10);
        if (pHost && !isNaN(pPort)) {
          try {
            const createdProxy = createProxy({
              name: `${name} Proxy`,
              host: pHost,
              port: pPort,
              protocol: (item.proxy.type || item.proxy.protocol || 'http').toLowerCase() as any,
              username: item.proxy.username || item.proxy.login,
              password: item.proxy.password || item.proxy.pass,
            });
            settings.network.directConnection = false;
            settings.network.proxyId = createdProxy.id;
          } catch {}
        }
      }

      const newProfile = createProfile({
        name,
        folder: targetFolder,
        tags,
        notes: `Imported from ${platform} on ${new Date().toLocaleDateString()}`,
        settings,
      });

      if (cookies && (Array.isArray(cookies) || typeof cookies === 'string')) {
        const cookieStr = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
        try {
          importCookies(newProfile.id, cookieStr);
        } catch {}
      }

      importedProfiles.push(newProfile);
    } catch (itemErr: any) {
      errors.push(`Item ${i + 1} (${item.name || 'unnamed'}): ${itemErr.message}`);
    }
  }

  logActivity('PROFILE', importedProfiles.length > 0 ? 'SUCCESS' : 'ERROR', 'Cross-Platform Import', `Imported ${importedProfiles.length} profiles from ${platform}`, undefined, platform);

  return {
    success: importedProfiles.length > 0,
    importedCount: importedProfiles.length,
    profiles: importedProfiles,
    errors: errors.length > 0 ? errors : undefined,
  };
}

