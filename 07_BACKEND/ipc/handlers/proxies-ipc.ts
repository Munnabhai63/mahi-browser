import { ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import {
  createProxy,
  deleteProxy,
  getProxies,
  getProxyById,
  parseAndCreateProxy,
  updateProxy,
} from '../../../02_BROWSER/services/proxy-service.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { CreateProxyDTOSchema, UpdateProxyDTOSchema } from '../../../10_CONFIG/shared/validation/schemas.js';
import { proxyProviderService } from '../../services/proxy-provider-service.js';
import type { ProxiesTestInput } from './ipc-shared.js';

export function registerProxyIpcHandlers(
  onTestProxy: (dto: ProxiesTestInput) => Promise<unknown>
): void {
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

  ipcMain.handle('proxies:test', async (_event, dto) => onTestProxy(dto));

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
}
