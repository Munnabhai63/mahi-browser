import crypto from 'node:crypto';
import { saveIdempotentResponse } from '../../../services/remote-api-service.js';
import { ProxyProviderService } from '../../../services/proxy-provider-service.js';
import {
  getWorkflows,
  getWorkflowById,
  getWorkflowLogs,
  saveWorkflow,
  deleteWorkflow,
  stopWorkflowRun,
} from '../../../../09_AUTOMATION/automation-engine.js';
import { automationScheduler } from '../../../../09_AUTOMATION/automation-scheduler.js';
import { WARMING_TEMPLATES } from '../../../../09_AUTOMATION/cookie-warmer-service.js';
import { getDatabase } from '../../../../06_DATABASE/connection.js';
import type {
  AutomationStep,
  WorkflowExecutionPolicy,
  WorkflowVariable,
} from '../../../../10_CONFIG/shared/types/automation.js';
import type { ProxyNetworkType, ProxySessionType } from '../../../../10_CONFIG/shared/types/proxy-provider.js';
import type { CreateWebhookEndpointDTO } from '../../../../10_CONFIG/shared/types/remote-api.js';
import { parseBody, sendRemoteJSON, type RemoteRouteContext } from './remote-shared.js';

/** Handles remote proxy, automation RPA/scheduling, and outbound webhook routes. */
export async function handleRemoteAutomationAndProxyRoutes(ctx: RemoteRouteContext): Promise<boolean> {
  const {
    req,
    res,
    method,
    parsedUrl,
    requestId,
    rateLimit,
    auth,
    route,
    idempotencyKey,
    webhookService,
    requireAccess,
    requireFeature,
  } = ctx;

  // ========================================================================
  // 4. REMOTE PROXIES (/api/v1/remote/proxies)
  // ========================================================================
  if (route === 'proxies/catalog' && method === 'GET') {
    if (!requireAccess('proxy:read')) return true;

    const proxyService = ProxyProviderService.getInstance();
    const catalog = await proxyService.getCatalog({
      networkType: (parsedUrl.searchParams.get('networkType') as ProxyNetworkType | null) || undefined,
      country: parsedUrl.searchParams.get('country') || undefined,
    });

    sendRemoteJSON(req, res, 200, { success: true, data: catalog }, requestId, rateLimit);
    return true;
  }

  if (route === 'proxies/generate' && method === 'POST') {
    if (!requireAccess('proxy:create')) return true;

    const body = await parseBody<{
      providerId?: string;
      networkType: ProxyNetworkType;
      country: string;
      region?: string;
      city?: string;
      sessionType?: ProxySessionType;
      ttlMinutes?: number;
      workspaceId?: string;
      profileId?: string;
    }>(req);
    const proxyService = ProxyProviderService.getInstance();
    const planTier = auth.userRole === 'SUPER_ADMIN' || auth.userRole === 'ADMIN' ? 'ENTERPRISE' : 'PRO';
    const sessionResult = await proxyService.generateSession(
      {
        providerId: body.providerId,
        networkType: body.networkType,
        country: body.country,
        region: body.region,
        city: body.city,
        sessionType: body.sessionType || 'ROTATING',
        ttlMinutes: body.ttlMinutes,
        workspaceId: body.workspaceId,
        profileId: body.profileId,
      },
      { userId: auth.userId, email: auth.email, planTier }
    );

    webhookService.dispatchEvent('proxy.created', {
      sessionId: sessionResult.session.id,
      country: sessionResult.session.country,
      networkType: sessionResult.session.networkType,
    }, { userId: auth.userId });

    const responsePayload = { success: true, data: sessionResult };
    if (idempotencyKey) {
      saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
    }

    sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
    return true;
  }

  const proxyRotateMatch = route.match(/^proxies\/([a-zA-Z0-9_-]+)\/rotate$/);
  if (proxyRotateMatch && method === 'POST') {
    if (!requireAccess('proxy:rotate')) return true;

    const proxyService = ProxyProviderService.getInstance();
    const rotated = await proxyService.rotateSession(
      proxyRotateMatch[1],
      { userId: auth.userId }
    );

    webhookService.dispatchEvent('proxy.rotated', {
      sessionId: rotated.sessionId,
      newIp: rotated.newIp,
    }, { userId: auth.userId });

    sendRemoteJSON(req, res, 200, { success: true, data: rotated }, requestId, rateLimit);
    return true;
  }

  if (route === 'proxies/usage' && method === 'GET') {
    if (!requireAccess('proxy:read')) return true;

    const proxyService = ProxyProviderService.getInstance();
    const usage = await proxyService.getUsage(undefined, { userId: auth.userId });
    sendRemoteJSON(req, res, 200, { success: true, data: usage }, requestId, rateLimit);
    return true;
  }

  // ========================================================================
  // 5. REMOTE AUTOMATION RPA (/api/v1/remote/automation)
  // ========================================================================
  if (route === 'automation/workflows' && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    const workflows = getWorkflows();
    sendRemoteJSON(req, res, 200, { success: true, data: workflows }, requestId, rateLimit);
    return true;
  }

  if (route === 'automation/workflows' && method === 'POST') {
    if (!requireAccess('automation:write')) return true;
    if (!requireFeature('automation.rpa')) return true;

    const body = await parseBody<{
      id?: string;
      name: string;
      description?: string;
      workspaceId?: string;
      steps: AutomationStep[];
      variables?: WorkflowVariable[];
      executionPolicy?: WorkflowExecutionPolicy;
      tags?: string[];
    }>(req);
    if (!body.name || !Array.isArray(body.steps)) {
      sendRemoteJSON(req, res, 400, { success: false, error: { code: 'INVALID_WORKFLOW', message: 'Workflow name and steps array are required' } }, requestId, rateLimit);
      return true;
    }

    const created = saveWorkflow({
      id: body.id,
      name: body.name,
      description: body.description,
      workspaceId: body.workspaceId || auth.workspaceId,
      steps: body.steps,
      variables: body.variables || [],
      executionPolicy: body.executionPolicy,
      tags: body.tags || [],
    });

    sendRemoteJSON(req, res, 201, { success: true, data: created }, requestId, rateLimit);
    return true;
  }

  const workflowGetMatch = route.match(/^automation\/workflows\/([a-zA-Z0-9_-]+)$/);
  if (workflowGetMatch && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    const wf = getWorkflowById(workflowGetMatch[1]);
    if (!wf) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Workflow not found' } }, requestId, rateLimit);
      return true;
    }
    sendRemoteJSON(req, res, 200, { success: true, data: wf }, requestId, rateLimit);
    return true;
  }

  if (workflowGetMatch && method === 'DELETE') {
    if (!requireAccess('automation:write')) return true;

    const deleted = deleteWorkflow(workflowGetMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true, data: { deleted, workflowId: workflowGetMatch[1] } }, requestId, rateLimit);
    return true;
  }

  const workflowRunMatch = route.match(/^automation\/workflows\/([a-zA-Z0-9_-]+)\/run$/);
  if (workflowRunMatch && method === 'POST') {
    if (!requireAccess('automation:run')) return true;

    const workflowId = workflowRunMatch[1];
    const wf = getWorkflowById(workflowId);
    if (!wf) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Workflow not found' } }, requestId, rateLimit);
      return true;
    }

    const body = await parseBody<{ profileId?: string }>(req);
    const runId = `run_${crypto.randomUUID()}`;
    webhookService.dispatchEvent('automation.started', { runId, workflowId }, { userId: auth.userId });

    sendRemoteJSON(
      req,
      res,
      202,
      {
        success: true,
        data: {
          runId,
          workflowId,
          profileId: body.profileId || wf.defaultProfileId,
          status: 'QUEUED',
          message: 'RPA workflow queued for execution.',
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  if (route === 'automation/runs' && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    const db = getDatabase();
    const workflowIdFilter = parsedUrl.searchParams.get('workflowId');
    let runsQuery = 'SELECT * FROM automation_runs WHERE 1=1';
    const params: string[] = [];
    if (workflowIdFilter) {
      runsQuery += ' AND workflow_id = ?';
      params.push(workflowIdFilter);
    }
    runsQuery += ' ORDER BY started_at DESC LIMIT 50';

    interface AutomationRunRow {
      id: string;
      workflow_id: string;
      profile_id: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      summary: string | null;
    }

    const rows = db.prepare(runsQuery).all<AutomationRunRow>(...params);
    const runs = rows.map((r) => ({
      id: r.id,
      workflowId: r.workflow_id,
      profileId: r.profile_id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      durationMs: r.duration_ms,
      summary: r.summary,
    }));

    sendRemoteJSON(req, res, 200, { success: true, data: runs }, requestId, rateLimit);
    return true;
  }

  const workflowLogsMatch = route.match(/^automation\/runs\/([a-zA-Z0-9_-]+)$/);
  if (workflowLogsMatch && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    const logs = getWorkflowLogs(workflowLogsMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true, data: logs }, requestId, rateLimit);
    return true;
  }

  const workflowStopMatch = route.match(/^automation\/runs\/([a-zA-Z0-9_-]+)\/stop$/);
  if (workflowStopMatch && method === 'POST') {
    if (!requireAccess('automation:run')) return true;

    const stopped = stopWorkflowRun(workflowStopMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true, data: { stopped, runId: workflowStopMatch[1] } }, requestId, rateLimit);
    return true;
  }

  if (route === 'automation/schedules' && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    const schedules = automationScheduler.listSchedules({
      workspaceId: parsedUrl.searchParams.get('workspaceId') || undefined,
      workflowId: parsedUrl.searchParams.get('workflowId') || undefined,
    });
    sendRemoteJSON(req, res, 200, { success: true, data: schedules }, requestId, rateLimit);
    return true;
  }

  if (route === 'automation/schedules' && method === 'POST') {
    if (!requireAccess('automation:write')) return true;
    if (!requireFeature('automation.scheduler')) return true;

    const body = await parseBody<Parameters<typeof automationScheduler.createSchedule>[0]>(req);
    if (!body.workflowId || !body.scheduleType || !body.nextRunAt) {
      sendRemoteJSON(req, res, 400, { success: false, error: { code: 'INVALID_SCHEDULE', message: 'workflowId, scheduleType, and nextRunAt are required' } }, requestId, rateLimit);
      return true;
    }

    const schedule = automationScheduler.createSchedule({
      workflowId: body.workflowId,
      profileId: body.profileId,
      profileIds: body.profileIds,
      workspaceId: body.workspaceId || auth.workspaceId,
      scheduleType: body.scheduleType,
      cronExpression: body.cronExpression,
      timezone: body.timezone || 'UTC',
      nextRunAt: body.nextRunAt,
    });

    sendRemoteJSON(req, res, 201, { success: true, data: schedule }, requestId, rateLimit);
    return true;
  }

  const scheduleDeleteMatch = route.match(/^automation\/schedules\/([a-zA-Z0-9_-]+)$/);
  if (scheduleDeleteMatch && method === 'DELETE') {
    if (!requireAccess('automation:write')) return true;

    const deleted = automationScheduler.deleteSchedule(scheduleDeleteMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true, data: { deleted, scheduleId: scheduleDeleteMatch[1] } }, requestId, rateLimit);
    return true;
  }

  if (route === 'automation/templates' && method === 'GET') {
    if (!requireAccess('automation:read')) return true;

    sendRemoteJSON(req, res, 200, { success: true, data: WARMING_TEMPLATES }, requestId, rateLimit);
    return true;
  }

  // ========================================================================
  // 6. OUTBOUND WEBHOOKS MANAGEMENT (/api/v1/remote/webhooks)
  // ========================================================================
  if (route === 'webhooks' && method === 'GET') {
    if (!requireAccess('webhooks:read')) return true;

    const workspaceId = parsedUrl.searchParams.get('workspaceId') || undefined;
    const endpoints = webhookService.listEndpoints(auth.userId, workspaceId);
    const sanitized = endpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      description: ep.description,
      events: ep.events,
      status: ep.status,
      failureCount: ep.failureCount,
      lastDeliveryAt: ep.lastDeliveryAt,
      createdAt: ep.createdAt,
    }));

    sendRemoteJSON(req, res, 200, { success: true, data: sanitized }, requestId, rateLimit);
    return true;
  }

  if (route === 'webhooks' && method === 'POST') {
    if (!requireAccess('webhooks:manage')) return true;

    const body = await parseBody<CreateWebhookEndpointDTO & { allowHttp?: boolean }>(req);
    const allowHttp = Boolean(body.allowHttp);
    const { endpoint, secret } = webhookService.createEndpoint(
      auth.userId,
      body,
      { allowHttp }
    );

    const responsePayload = {
      success: true,
      data: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        status: endpoint.status,
        secret,
        note: 'Store this signing secret safely. It will not be shown again.',
      },
    };

    if (idempotencyKey) {
      saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
    }

    sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
    return true;
  }

  const whIdMatch = route.match(/^webhooks\/([a-zA-Z0-9_-]+)$/);
  if (whIdMatch && method === 'GET') {
    if (!requireAccess('webhooks:read')) return true;

    const ep = webhookService.getEndpoint(whIdMatch[1], auth.userId);
    if (!ep) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } }, requestId, rateLimit);
      return true;
    }

    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          id: ep.id,
          url: ep.url,
          description: ep.description,
          events: ep.events,
          status: ep.status,
          failureCount: ep.failureCount,
          lastDeliveryAt: ep.lastDeliveryAt,
          createdAt: ep.createdAt,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  if (whIdMatch && method === 'DELETE') {
    if (!requireAccess('webhooks:manage')) return true;

    const deleted = webhookService.deleteEndpoint(whIdMatch[1], auth.userId);
    if (!deleted) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } }, requestId, rateLimit);
      return true;
    }

    sendRemoteJSON(req, res, 200, { success: true, data: { revoked: true, endpointId: whIdMatch[1] } }, requestId, rateLimit);
    return true;
  }

  const whRotateMatch = route.match(/^webhooks\/([a-zA-Z0-9_-]+)\/rotate-secret$/);
  if (whRotateMatch && method === 'POST') {
    if (!requireAccess('webhooks:manage')) return true;

    const rotated = webhookService.rotateSecret(whRotateMatch[1], auth.userId);
    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          endpointId: rotated.endpoint.id,
          newSecret: rotated.newSecret,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  const whTestMatch = route.match(/^webhooks\/([a-zA-Z0-9_-]+)\/test$/);
  if (whTestMatch && method === 'POST') {
    if (!requireAccess('webhooks:manage')) return true;

    const body = await parseBody<{ allowHttp?: boolean }>(req).catch(() => ({ allowHttp: false }));
    const allowHttp = Boolean(body.allowHttp);
    const delivery = await webhookService.sendTestWebhook(whTestMatch[1], auth.userId, allowHttp);

    sendRemoteJSON(
      req,
      res,
      delivery.success ? 200 : 502,
      {
        success: delivery.success,
        data: {
          deliveryId: delivery.id,
          statusCode: delivery.statusCode,
          success: delivery.success,
          attemptCount: delivery.attemptCount,
          durationMs: delivery.durationMs,
          errorMessage: delivery.errorMessage,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  const whDeliveriesMatch = route.match(/^webhooks\/([a-zA-Z0-9_-]+)\/deliveries$/);
  if (whDeliveriesMatch && method === 'GET') {
    if (!requireAccess('webhooks:read')) return true;

    const deliveries = webhookService.getDeliveries(whDeliveriesMatch[1], auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: deliveries }, requestId, rateLimit);
    return true;
  }

  return false;
}
