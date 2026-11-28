import { ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import {
  exportBulkProfilesToArchive,
  exportProfileToArchive,
  importCrossPlatformProfiles,
  importProfileFromArchive,
  previewProfileArchive,
} from '../../../02_BROWSER/services/archive-service.js';
import {
  deleteAllCookies,
  deleteCookie,
  exportCookies,
  getCookies,
  importCookies,
} from '../../../02_BROWSER/services/cookie-service.js';
import {
  getExtensions,
  installExtension,
  installFromWebStoreUrl,
  removeExtension,
  toggleExtension,
} from '../../../02_BROWSER/services/extension-service.js';
import { clearHistory, deleteHistoryItem, getHistory } from '../../../02_BROWSER/services/history-service.js';
import { getProfileById } from '../../../02_BROWSER/services/profile-service.js';
import { assertCanCreateProfile } from '../../../08_SECURITY/freemium-guard.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { getActiveOwnerId } from './ipc-shared.js';

export function registerBrowserDataIpcHandlers(): void {
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

  // ARCHIVE (IMPORT/EXPORT) — archive:exportNetscape remains in register-handlers facade
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
}
