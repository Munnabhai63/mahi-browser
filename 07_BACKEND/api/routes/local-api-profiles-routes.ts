import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { CreateProfileDTO, ProfileFilterOptions } from '../../../10_CONFIG/shared/types/profile.js';
import type {
  BulkAssignProxiesDTO,
  BulkCreateProfileDTO,
  BulkUpdateProfilesDTO,
} from '../../../02_BROWSER/services/profile-service.js';
import { getErrorStatusCode } from '../../utils/http-security.js';
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
  cloneProfile,
  getProfileStoragePath,
} from '../../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../../02_BROWSER/launcher.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { assertCanCreateProfile } from '../../../08_SECURITY/freemium-guard.js';
import { CreateProfileDTOSchema } from '../../../10_CONFIG/shared/validation/schemas.js';
import {
  type AuthBodyLike,
  getLocalApiOwnerId,
  requireUserOrAdminAuth,
  sendJSON,
  parseBody,
  resolveCdpWebSocketEndpoint,
  toErrMsg,
} from './local-api-auth.js';

export async function handleStartAutomationRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Local Developer CDP WebSocket Bridge: POST /api/v1/profiles/:id/start-automation
  const startAutomationMatch = pathname.match(/^\/api\/v1\/profiles\/([^/]+)\/start-automation$/);
  if (!startAutomationMatch || method !== 'POST') {
    return false;
  }

  const body = await parseBody(req);
  if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
  const id = decodeURIComponent(startAutomationMatch[1]);
  const activeOwnerId = getLocalApiOwnerId();
  const p = getProfileById(id, activeOwnerId);
  if (!p) {
    sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
    return true;
  }
  const alreadyRunning = processManager.isRunning(id);
  const result = alreadyRunning
    ? { success: true, pid: processManager.getActivePid(id) }
    : await processManager.startProfile(id, { mode: 'automation' });
  if (!result.success) {
    sendJSON(res, 500, { success: false, error: result.error || 'Failed to start automation profile' });
    return true;
  }
  const debugPort = processManager.getDebugPort(id) ?? getProfileDebugPort(id);
  const timeoutMs =
    typeof body?.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
      ? Math.min(Math.max(body.timeoutMs, 50), 15000)
      : 2500;
  const cdp = await resolveCdpWebSocketEndpoint(debugPort, { timeoutMs });
  sendJSON(res, 200, {
    success: true,
    profileId: id,
    pid: result.pid,
    alreadyRunning,
    debugPort,
    httpEndpoint: cdp.httpEndpoint,
    wsEndpoint: cdp.wsEndpoint,
  });
  return true;
}

export async function handleV2ProfilesRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // 7. Profiles V2 Endpoints
  if (pathname === '/api/v2/profiles' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read')) return true;
    const activeOwnerId = getLocalApiOwnerId();
    sendJSON(res, 200, { success: true, data: getProfiles({ ownerId: activeOwnerId }) });
    return true;
  }
  if (pathname === '/api/v2/profiles' && method === 'POST') {
    try {
      const body = await parseBody<CreateProfileDTO & AuthBodyLike>(req);
      if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
      const activeOwnerId = getLocalApiOwnerId();
      assertCanCreateProfile(1, activeOwnerId);
      const profile = createProfile({ ...body, ownerId: activeOwnerId });
      sendJSON(res, 201, { success: true, data: profile });
    } catch (err: unknown) {
      sendJSON(res, getErrorStatusCode(err, 400), { success: false, error: toErrMsg(err) });
    }
    return true;
  }
  const profileV2Action = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)\/(start|stop|clone)$/);
  if (profileV2Action && method === 'POST') {
    const body = await parseBody<{ name?: string } & AuthBodyLike>(req);
    const action = profileV2Action[2];
    const requiredScope = action === 'clone' ? 'profiles:write' : 'profiles:launch';
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, requiredScope)) return true;
    const profileId = profileV2Action[1];
    const activeOwnerId = getLocalApiOwnerId();
    const existing = getProfileById(profileId, activeOwnerId);
    if (!existing) {
      sendJSON(res, 404, { success: false, error: 'Profile not found or access denied.' });
      return true;
    }
    if (action === 'start') {
      const result = await processManager.startProfile(profileId);
      const activeDebugPort = processManager.getDebugPort(profileId);
      const cdpPort = activeDebugPort ?? (processManager.isRunning(profileId) ? undefined : getProfileDebugPort(profileId));
      if (cdpPort) {
        const cdp = result.success
          ? await resolveCdpWebSocketEndpoint(cdpPort, { timeoutMs: 250 })
          : {
              httpEndpoint: `http://127.0.0.1:${cdpPort}`,
              wsEndpoint: `ws://127.0.0.1:${cdpPort}/devtools/browser`,
            };
        sendJSON(res, result.success ? 200 : 500, {
          ...result,
          cdpPort,
          debugPort: cdpPort,
          httpEndpoint: cdp.httpEndpoint,
          wsEndpoint: cdp.wsEndpoint,
        });
      } else {
        sendJSON(res, result.success ? 200 : 500, {
          ...result,
          cdpDisabled: true,
        });
      }
      return true;
    }
    if (action === 'stop') {
      const result = await processManager.stopProfile(profileId);
      sendJSON(res, result.success ? 200 : 500, result);
      return true;
    }
    if (action === 'clone') {
      try {
        assertCanCreateProfile(1, activeOwnerId);
        const cloned = cloneProfile(profileId, body.name || undefined, activeOwnerId);
        sendJSON(res, 201, { success: true, data: cloned });
      } catch (err: unknown) {
        sendJSON(res, 400, { success: false, error: toErrMsg(err) });
      }
      return true;
    }
  }

  return false;
}

export async function handleLegacyProfilesRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // PROFILES ROUTES
  if (pathname === '/profiles' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read')) return true;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const status = (parsedUrl.searchParams.get('status') as ProfileFilterOptions['status']) || undefined;
    const profiles = getProfiles({ searchQuery: search, status, ownerId: getLocalApiOwnerId() });
    sendJSON(res, 200, { success: true, data: profiles });
    return true;
  }

  if (pathname === '/profiles' && method === 'POST') {
    try {
      const body = await parseBody<AuthBodyLike>(req);
      if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
      const activeOwnerId = getLocalApiOwnerId();
      assertCanCreateProfile(1, activeOwnerId);
      const validated = CreateProfileDTOSchema.parse(body);
      const result = createProfile({ ...validated, ownerId: activeOwnerId });
      sendJSON(res, 201, { success: true, data: result });
    } catch (err: unknown) {
      sendJSON(res, getErrorStatusCode(err, 400), { success: false, error: sanitizeError(err) });
    }
    return true;
  }

  if (pathname === '/profiles/bulk' && method === 'POST') {
    const body = await parseBody<BulkCreateProfileDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const activeOwnerId = getLocalApiOwnerId();
    assertCanCreateProfile(body?.count || 1, activeOwnerId);
    const result = bulkCreateProfiles({ ...body, ownerId: activeOwnerId });
    sendJSON(res, 201, { success: true, data: result });
    return true;
  }

  if (pathname === '/profiles/bulk-update' && method === 'POST') {
    const body = await parseBody<BulkUpdateProfilesDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const result = bulkUpdateProfiles(body, getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  if (pathname === '/profiles/bulk-delete' && method === 'POST') {
    const body = await parseBody<{ profileIds?: string[]; permanent?: boolean } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const profileIds: string[] = Array.isArray(body.profileIds) ? body.profileIds : [];
    for (const pid of profileIds) {
      if (processManager.isRunning(pid)) {
        await processManager.stopProfile(pid);
      }
    }
    const isPermanent = Boolean(parsedUrl.searchParams.get('permanent') === 'true' || body.permanent === true);
    const ownerId = getLocalApiOwnerId();
    if (isPermanent) {
      for (const pid of profileIds) {
        permanentDeleteProfile(pid, ownerId);
      }
      sendJSON(res, 200, { success: true, count: profileIds.length, permanent: true });
    } else {
      const result = bulkDeleteProfiles(profileIds, ownerId);
      sendJSON(res, 200, { success: true, data: result });
    }
    return true;
  }

  if (pathname === '/profiles/bulk-assign-proxies' && method === 'POST') {
    const body = await parseBody<BulkAssignProxiesDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const result = bulkAssignProxies(body, getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  if (pathname === '/profiles/quick-switch' && method === 'POST') {
    const body = await parseBody<{ number?: string; profileNumber?: string } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
    const num = parseInt(body.number || body.profileNumber || '1', 10);
    const result = await processManager.quickSwitchProfile(num);
    sendJSON(res, result.success ? 200 : 404, result);
    return true;
  }

  if (pathname === '/profiles/trash' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read')) return true;
    const trash = getTrashProfiles(getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: trash });
    return true;
  }

  if (pathname === '/profiles/trash/empty' && method === 'POST') {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const result = emptyTrash(getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  // Match /profiles/:id/restore
  const restoreMatch = pathname.match(/^\/profiles\/([^/]+)\/restore$/);
  if (restoreMatch && method === 'POST') {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const id = restoreMatch[1];
    const restored = restoreProfile(id, getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: restored });
    return true;
  }

  // Match /profiles/:id/permanent
  const permMatch = pathname.match(/^\/profiles\/([^/]+)\/permanent$/);
  if (permMatch && method === 'DELETE') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:write')) return true;
    const id = permMatch[1];
    const activeOwnerId = getLocalApiOwnerId();
    const existing = getProfileById(id, activeOwnerId);
    if (!existing) {
      sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
      return true;
    }
    if (processManager.isRunning(id)) {
      await processManager.stopProfile(id);
    }
    const ok = permanentDeleteProfile(id, activeOwnerId);
    sendJSON(res, 200, { success: ok });
    return true;
  }

  // Match /profiles/:id
  const profileMatch = pathname.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch) {
    const id = profileMatch[1];
    const activeOwnerId = getLocalApiOwnerId();
    if (method === 'GET') {
      if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read')) return true;
      const p = getProfileById(id, activeOwnerId);
      if (!p) {
        sendJSON(res, 404, { error: 'Profile not found or access denied' });
        return true;
      }
      sendJSON(res, 200, { success: true, data: p });
      return true;
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
      const p = updateProfile(id, body, activeOwnerId);
      sendJSON(res, 200, { success: true, data: p });
      return true;
    }
    if (method === 'DELETE') {
      if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:write')) return true;
      const p = getProfileById(id, activeOwnerId);
      if (!p) {
        sendJSON(res, 404, { error: 'Profile not found or access denied' });
        return true;
      }
      if (processManager.isRunning(id)) {
        await processManager.stopProfile(id);
      }
      const ok = softDeleteProfile(id, activeOwnerId);
      sendJSON(res, 200, { success: ok });
      return true;
    }
  }

  // /profiles/:id/start
  const startMatch = pathname.match(/^\/profiles\/([^/]+)\/start$/);
  if (startMatch && method === 'POST') {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
    const id = startMatch[1];
    const activeOwnerId = getLocalApiOwnerId();
    const p = getProfileById(id, activeOwnerId);
    if (!p) {
      sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
      return true;
    }
    const result = await processManager.startProfile(id);
    const cdpPort = processManager.getDebugPort(id) ?? (processManager.isRunning(id) ? undefined : getProfileDebugPort(id));
    if (cdpPort) {
      const cdp = result.success
        ? await resolveCdpWebSocketEndpoint(cdpPort, { timeoutMs: 250 })
        : {
            httpEndpoint: `http://127.0.0.1:${cdpPort}`,
            wsEndpoint: `ws://127.0.0.1:${cdpPort}/devtools/browser`,
          };
      sendJSON(res, result.success ? 200 : 500, {
        ...result,
        cdpPort,
        debugPort: cdpPort,
        httpEndpoint: cdp.httpEndpoint,
        wsEndpoint: cdp.wsEndpoint,
      });
      return true;
    }
    sendJSON(res, result.success ? 200 : 500, {
      ...result,
      cdpDisabled: true,
    });
    return true;
  }

  // MostLogin / GoLogin Compatibility Route: /api/v1/profile/start or /browser/start
  if ((pathname === '/api/v1/profile/start' || pathname === '/browser/start') && (method === 'GET' || method === 'POST')) {
    let id = parsedUrl.searchParams.get('profileId') || parsedUrl.searchParams.get('profile_id');
    let body: ({ profileId?: string; profile_id?: string; id?: string } & AuthBodyLike) | undefined;
    if (method === 'POST') {
      body = await parseBody<{ profileId?: string; profile_id?: string; id?: string } & AuthBodyLike>(req);
      if (!id) id = body?.profileId || body?.profile_id || body?.id || null;
    }
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
    if (!id) {
      sendJSON(res, 400, { code: 400, success: false, error: 'Missing profileId' });
      return true;
    }
    const activeOwnerId = getLocalApiOwnerId();
    const p = getProfileById(id, activeOwnerId);
    if (!p) {
      sendJSON(res, 404, { code: 404, success: false, error: 'Profile not found or access denied' });
      return true;
    }
    const result = await processManager.startProfile(id);
    const cdpPort = processManager.getDebugPort(id) ?? (processManager.isRunning(id) ? undefined : getProfileDebugPort(id));
    const cdp = cdpPort
      ? result.success
        ? await resolveCdpWebSocketEndpoint(cdpPort, { timeoutMs: 250 })
        : {
            httpEndpoint: `http://127.0.0.1:${cdpPort}`,
            wsEndpoint: `ws://127.0.0.1:${cdpPort}/devtools/browser`,
          }
      : undefined;
    sendJSON(res, result.success ? 200 : 500, {
      code: result.success ? 0 : 500,
      success: result.success,
      data: {
        profileId: id,
        pid: result.pid,
        ...(cdpPort && cdp
          ? {
              cdpPort,
              debugPort: cdpPort,
              httpEndpoint: cdp.httpEndpoint,
              wsEndpoint: cdp.wsEndpoint,
            }
          : { cdpDisabled: true }),
      },
      error: result.error,
    });
    return true;
  }

  // /profiles/:id/stop
  const stopMatch = pathname.match(/^\/profiles\/([^/]+)\/stop$/);
  if (stopMatch && method === 'POST') {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
    const id = stopMatch[1];
    const activeOwnerId = getLocalApiOwnerId();
    const p = getProfileById(id, activeOwnerId);
    if (!p) {
      sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
      return true;
    }
    const result = await processManager.stopProfile(id);
    sendJSON(res, result.success ? 200 : 500, result);
    return true;
  }

  // MostLogin / GoLogin Compatibility Route: /api/v1/profile/stop or /browser/stop
  if ((pathname === '/api/v1/profile/stop' || pathname === '/browser/stop') && (method === 'GET' || method === 'POST')) {
    let id = parsedUrl.searchParams.get('profileId') || parsedUrl.searchParams.get('profile_id');
    let body: ({ profileId?: string; profile_id?: string; id?: string } & AuthBodyLike) | undefined;
    if (method === 'POST') {
      body = await parseBody<{ profileId?: string; profile_id?: string; id?: string } & AuthBodyLike>(req);
      if (!id) id = body?.profileId || body?.profile_id || body?.id || null;
    }
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:launch')) return true;
    if (!id) {
      sendJSON(res, 400, { code: 400, success: false, error: 'Missing profileId' });
      return true;
    }
    const result = await processManager.stopProfile(id);
    sendJSON(res, result.success ? 200 : 500, {
      code: result.success ? 0 : 500,
      success: result.success,
      data: { profileId: id },
      error: result.error,
    });
    return true;
  }

  // /profiles/:id/clone
  const cloneMatch = pathname.match(/^\/profiles\/([^/]+)\/clone$/);
  if (cloneMatch && method === 'POST') {
    const body = await parseBody<{
      newName?: string;
      copyCookies?: boolean;
      copyHistory?: boolean;
      copyExtensions?: boolean;
      copyBrowserSettings?: boolean;
    } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write')) return true;
    const id = cloneMatch[1];
    const activeOwnerId = getLocalApiOwnerId();
    const existing = getProfileById(id, activeOwnerId);
    if (!existing) {
      sendJSON(res, 404, { success: false, error: 'Source profile not found or access denied' });
      return true;
    }
    assertCanCreateProfile(1, activeOwnerId);
    const p = cloneProfile(
      {
        sourceProfileId: id,
        newName: body.newName || 'Cloned Profile',
        copyCookies: Boolean(body.copyCookies ?? true),
        copyHistory: Boolean(body.copyHistory ?? false),
        copyExtensions: Boolean(body.copyExtensions ?? true),
        copyBrowserSettings: Boolean(body.copyBrowserSettings ?? true),
      },
      undefined,
      activeOwnerId
    );
    sendJSON(res, 201, { success: true, data: p });
    return true;
  }

  // /profiles/:id/warmer-queue
  const queueMatch = pathname.match(/^\/profiles\/([^/]+)\/warmer-queue$/);
  if (queueMatch && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read')) return true;
    const id = decodeURIComponent(queueMatch[1]);
    const activeOwnerId = getLocalApiOwnerId();
    const existing = getProfileById(id, activeOwnerId);
    if (!existing) {
      sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
      return true;
    }
    const storageDir = getProfileStoragePath(id);
    const qFile = path.join(storageDir, 'mahi_warmer_queue.json');
    try {
      const raw = await fs.promises.readFile(qFile, 'utf8');
      const data = JSON.parse(raw);
      await fs.promises.unlink(qFile); // Consume once
      sendJSON(res, 200, { success: true, sites: data.sites || [] });
      return true;
    } catch {
      sendJSON(res, 200, { success: false, sites: [] });
      return true;
    }
  }

  return false;
}
