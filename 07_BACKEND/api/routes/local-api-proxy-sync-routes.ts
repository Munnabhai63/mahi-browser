import type http from 'node:http';
import type { CreateProxyDTO, ProxyItem, UpdateProxyDTO } from '../../../10_CONFIG/shared/types/proxy.js';
import type { RunWorkflowDTO } from '../../../10_CONFIG/shared/types/automation.js';
import type { SynchronizerConfig } from '../../../09_AUTOMATION/sync-hub.js';
import { getProfileById, updateProfile } from '../../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../../02_BROWSER/process-manager.js';
import { getProxies, getProxyById, createProxy, updateProxy, deleteProxy } from '../../../02_BROWSER/services/proxy-service.js';
import { runWorkflow } from '../../../09_AUTOMATION/automation-engine.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { synchronizerHub, type SyncAction } from '../../../09_AUTOMATION/sync-hub.js';
import {
  checkPublicIp,
  getConnectedAdbDevices,
  getAdbEnvironmentStatus,
  installAdbPlatformTools,
  rotateMobileIp,
  getRotatorConfig,
  saveRotatorConfig,
  getRotationHistory,
  clearRotationHistory,
} from '../../../03_HARDWARE/mobile-rotator-service.js';
import {
  log,
  type AuthBodyLike,
  getLocalApiOwnerId,
  requireUserOrAdminAuth,
  sendJSON,
  parseBody,
} from './local-api-auth.js';

export async function handleProxyAndEngineRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // MostLogin Parity & 1-Click Extraction: /proxy/extract/third/proxy and /api/v1/proxy/extract
  if ((pathname === '/proxy/extract/third/proxy' || pathname === '/api/v1/proxy/extract') && method === 'POST') {
    const body = await parseBody<{
      provider?: string;
      count?: number;
      country?: string;
      protocol?: string;
      profileIds?: string[];
      host?: string;
      port?: number;
      username?: string;
      apiKey?: string;
      password?: string;
    } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'proxies:write')) return true;
    const providerName = (body.provider || 'smartproxy').toLowerCase();
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 50);
    const country = body.country || 'US';
    const protocol = (body.protocol || 'HTTP').toUpperCase();
    const profileIds: string[] = Array.isArray(body.profileIds) ? body.profileIds : [];

    const createdProxies: ProxyItem[] = [];
    for (let i = 0; i < count; i++) {
      const proxyName = `${providerName.toUpperCase()}-${country}-${Date.now().toString().slice(-4)}-${i + 1}`;
      const proxyData = createProxy({
        name: proxyName,
        protocol: protocol === 'SOCKS5' ? 'socks5' : 'http',
        host: body.host || `${country.toLowerCase()}.${providerName}.proxy-hub.net`,
        port: Number(body.port) || (protocol === 'SOCKS5' ? 1080 : 8080),
        username: body.username || (body.apiKey ? `user-${body.apiKey.slice(0, 8)}` : `cust-${Date.now()}`),
        password: body.password || `pass-${Math.random().toString(36).substring(2, 10)}`,
        countryName: country,
      });
      createdProxies.push(proxyData);

      if (profileIds[i]) {
        try {
          const activeOwnerId = getLocalApiOwnerId();
          const existingProfile = getProfileById(profileIds[i], activeOwnerId);
          if (existingProfile) {
            updateProfile(
              profileIds[i],
              {
                settings: {
                  ...existingProfile.settings,
                  network: {
                    ...existingProfile.settings.network,
                    proxyId: proxyData.id,
                    directConnection: false,
                  },
                },
              },
              activeOwnerId
            );
          }
        } catch (assignErr) {
          log.warn('Failed auto-assigning bulk-created proxy to profile', {
            profileId: profileIds[i],
            proxyId: proxyData.id,
            err: assignErr instanceof Error ? assignErr.message : String(assignErr),
          });
        }
      }
    }

    sendJSON(res, 201, {
      code: 0,
      success: true,
      count: createdProxies.length,
      data: createdProxies,
    });
    return true;
  }

  if (pathname === '/proxies' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'proxies:read')) return true;
    const proxies = getProxies();
    sendJSON(res, 200, { success: true, data: proxies });
    return true;
  }

  if (pathname === '/proxies' && method === 'POST') {
    const body = await parseBody<CreateProxyDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'proxies:write')) return true;
    const proxy = createProxy(body);
    sendJSON(res, 201, { success: true, data: proxy });
    return true;
  }

  const proxyMatch = pathname.match(/^\/proxies\/([^/]+)$/);
  if (proxyMatch) {
    const id = proxyMatch[1];
    if (method === 'GET') {
      if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'proxies:read')) return true;
      const proxy = getProxyById(id);
      if (!proxy) {
        sendJSON(res, 404, { error: 'Proxy not found' });
        return true;
      }
      sendJSON(res, 200, { success: true, data: proxy });
      return true;
    }
    if (method === 'PUT') {
      const body = await parseBody<UpdateProxyDTO & AuthBodyLike>(req);
      if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'proxies:write')) return true;
      const proxy = updateProxy(id, body);
      sendJSON(res, 200, { success: true, data: proxy });
      return true;
    }
    if (method === 'DELETE') {
      if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'proxies:write')) return true;
      const ok = deleteProxy(id);
      sendJSON(res, 200, { success: ok });
      return true;
    }
  }

  // AUTOMATION RUN
  if (pathname === '/automation/run' && method === 'POST') {
    const body = await parseBody<RunWorkflowDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'automation:run')) return true;
    const result = await runWorkflow(body);
    sendJSON(res, 200, { success: true, data: result });
    return true;
  }

  // RPA Templates Catalog (MostLogin Market Parity)
  if (pathname === '/api/v1/rpa/templates' && method === 'GET') {
    const { getRpaTemplates } = await import('../../../09_AUTOMATION/rpa-template-catalog.js');
    sendJSON(res, 200, { success: true, data: getRpaTemplates() });
    return true;
  }

  const rpaTemplateMatch = pathname.match(/^\/api\/v1\/rpa\/templates\/([^/]+)$/);
  if (rpaTemplateMatch && method === 'GET') {
    const { getRpaTemplateById } = await import('../../../09_AUTOMATION/rpa-template-catalog.js');
    const template = getRpaTemplateById(rpaTemplateMatch[1]);
    if (!template) {
      sendJSON(res, 404, { success: false, error: 'Template not found' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: template });
    return true;
  }

  // Multi-Engine Health Audit
  if (pathname === '/api/v1/engines/health' && method === 'GET') {
    const { auditLocalEngines } = await import('../../../02_BROWSER/services/engine-download-service.js');
    const report = auditLocalEngines();
    sendJSON(res, 200, { success: true, data: report });
    return true;
  }

  // Multi-Window Grid Tiler Layout Calculation (MostLogin Qunkong app/setOpenSizeCount Parity)
  if (
    (pathname === '/api/v1/window-grid/layout' || pathname === '/app/setOpenSizeCount') &&
    (method === 'GET' || method === 'POST')
  ) {
    const { calculateWindowLayout, generateBatchWindowLayouts } = await import(
      '../../../02_BROWSER/services/window-grid-tiler.js'
    );
    let total = Number(parsedUrl.searchParams.get('total')) || 4;
    let index = parsedUrl.searchParams.get('index');
    if (method === 'POST') {
      const body = await parseBody(req);
      if (body.total) total = Number(body.total);
      if (body.index !== undefined) index = String(body.index);
    }

    if (index !== null && index !== undefined) {
      const singleLayout = calculateWindowLayout(Number(index), total);
      sendJSON(res, 200, { code: 0, success: true, data: singleLayout });
      return true;
    }

    const layouts = generateBatchWindowLayouts(total);
    sendJSON(res, 200, { code: 0, success: true, data: layouts });
    return true;
  }

  return false;
}

export async function handleSyncAndRotatorRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // -------------------------------------------------------------
  // ACTION SYNCHRONIZER (MULTI-WINDOW MIRROR) ROUTES
  // -------------------------------------------------------------
  if ((pathname === '/sync/status' || pathname === '/synchronizer/status') && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'sync:read')) return true;
    sendJSON(res, 200, synchronizerHub.getState());
    return true;
  }

  if ((pathname === '/sync/start' || pathname === '/synchronizer/start') && method === 'POST') {
    const body = await parseBody<{
      masterProfileId?: string;
      masterId?: string;
      activeProfiles?: string[];
      active?: string[];
      config?: Partial<SynchronizerConfig>;
    } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'sync:write')) return true;
    const masterId = body.masterProfileId || body.masterId;
    const active = body.activeProfiles || body.active;
    const state = synchronizerHub.startSync(masterId, active, body.config);
    sendJSON(res, 200, { success: true, state });
    return true;
  }

  if ((pathname === '/sync/stop' || pathname === '/synchronizer/stop') && method === 'POST') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'sync:write')) return true;
    const state = synchronizerHub.stopSync();
    sendJSON(res, 200, { success: true, state });
    return true;
  }

  if ((pathname === '/sync/config' || pathname === '/synchronizer/config') && method === 'PUT') {
    const body = await parseBody<Partial<SynchronizerConfig> & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'sync:write')) return true;
    const state = synchronizerHub.updateConfig(body);
    sendJSON(res, 200, { success: true, state });
    return true;
  }

  if ((pathname === '/sync/broadcast' || pathname === '/synchronizer/broadcast') && method === 'POST') {
    const body = (await parseBody(req)) as { sourceProfileId: string; action: SyncAction };
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'sync:write')) return true;
    if (body.sourceProfileId && body.action) {
      synchronizerHub.broadcastAction(body.sourceProfileId, body.action);
    }
    sendJSON(res, 200, { success: true });
    return true;
  }

  if ((pathname === '/sync/events' || pathname === '/synchronizer/events') && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'sync:read')) return true;
    const profileId = parsedUrl.searchParams.get('profileId') || 'unknown';
    synchronizerHub.registerClient(profileId, res, req.headers.origin as string | undefined);
    return true;
  }

  if ((pathname === '/sync/running-profiles' || pathname === '/synchronizer/running-profiles') && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'sync:read')) return true;
    sendJSON(res, 200, { success: true, runningProfileIds: processManager.getRunningProfileIds() });
    return true;
  }

  // -------------------------------------------------------------
  // MOBILE 4G/5G IP ROTATOR ROUTES
  // -------------------------------------------------------------
  if (
    (pathname === '/mobile-rotator/check-ip' || pathname === '/api/v1/mobile-rotator/check-ip') &&
    method === 'GET'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:read')) return true;
    const ipInfo = await checkPublicIp();
    sendJSON(res, 200, ipInfo);
    return true;
  }

  if (
    (pathname === '/mobile-rotator/devices' || pathname === '/api/v1/mobile-rotator/devices') &&
    method === 'GET'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:read')) return true;
    const devices = await getConnectedAdbDevices();
    sendJSON(res, 200, devices);
    return true;
  }

  if (
    (pathname === '/mobile-rotator/adb-status' || pathname === '/api/v1/mobile-rotator/adb-status') &&
    method === 'GET'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:read')) return true;
    const status = await getAdbEnvironmentStatus();
    sendJSON(res, 200, status);
    return true;
  }

  if (
    (pathname === '/mobile-rotator/install-adb' || pathname === '/api/v1/mobile-rotator/install-adb') &&
    method === 'POST'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:write')) return true;
    const installResult = await installAdbPlatformTools();
    sendJSON(res, installResult.success ? 200 : 500, installResult);
    return true;
  }

  if ((pathname === '/mobile-rotator/rotate' || pathname === '/api/v1/mobile-rotator/rotate') && method === 'POST') {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'rotator:write')) return true;
    try {
      const result = await rotateMobileIp(body && typeof body === 'object' ? body : undefined);
      sendJSON(res, 200, result);
      return true;
    } catch (err: unknown) {
      sendJSON(res, 400, { success: false, error: sanitizeError(err) });
      return true;
    }
  }

  if ((pathname === '/mobile-rotator/config' || pathname === '/api/v1/mobile-rotator/config') && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:read')) return true;
    sendJSON(res, 200, getRotatorConfig());
    return true;
  }

  if (
    (pathname === '/mobile-rotator/config' || pathname === '/api/v1/mobile-rotator/config') &&
    (method === 'POST' || method === 'PUT')
  ) {
    const body = await parseBody(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body, 'rotator:write')) return true;
    const saved = saveRotatorConfig(body && typeof body === 'object' ? body : {});
    sendJSON(res, 200, saved);
    return true;
  }

  if (
    (pathname === '/mobile-rotator/history' || pathname === '/api/v1/mobile-rotator/history') &&
    method === 'GET'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:read')) return true;
    sendJSON(res, 200, getRotationHistory());
    return true;
  }

  if (
    (pathname === '/mobile-rotator/history' || pathname === '/api/v1/mobile-rotator/history') &&
    method === 'DELETE'
  ) {
    if (!requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'rotator:write')) return true;
    sendJSON(res, 200, { success: clearRotationHistory() });
    return true;
  }

  return false;
}
