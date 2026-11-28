import { sendJSON, parseBody } from '../router-shared.js';
import { sendSafeError, validateStrictBody } from '../../../utils/app-error.js';
import {
  SupportChatSchema,
  AdminDemoStatusSchema,
  AdminSupportStatusSchema,
  AdminSupportReplySchema,
  AdminUserStatusSchema,
  AdminUserPlanSchema,
  AdminBoostQuotaSchema,
  AdminFeatureOverridesSchema,
  AdminPublishVersionSchema,
} from '../../validation/commercial-schemas.js';
import {
  adminGetDashboardSummary,
  adminListUsers,
  adminTermsCompliance,
  adminListDevices,
  adminListAuditLogs,
  adminListVersions,
  adminFunnelMetrics,
  adminListSupportTickets,
  adminListDemoRequests,
} from '../../admin-data-service.js';
import {
  adminSetUserStatus,
  adminSetUserPlan,
  adminBoostQuota,
  adminSetFeatureOverrides,
  adminResetUserDevices,
} from '../../admin-actions.js';
import { publishSoftwareVersion } from '../../commercial-version-service.js';
import { updateDemoRequestStatus, type DemoRequestStatus } from '../../demo-service.js';
import {
  handleSupportChatMessage,
  updateSupportTicketStatus,
  replySupportTicket,
  type SupportTicket,
} from '../../support-ticket-service.js';
import type { CommercialUserStatus } from '../../../../10_CONFIG/shared/types/commercial.js';
import { isPostgresConfigured } from '../../../../06_DATABASE/central-repository.js';
import {
  updateUserStatus,
  updateUserPlan,
  boostUserQuota,
  setUserFeatureOverrides,
} from '../../commercial-auth-service.js';
import { revokeCommercialDevice, resetAllUserDevices } from '../../commercial-device-service.js';
import { type AdminRouteContext, requireAdminAccess } from './admin-shared.js';

/** Handles commercial leads/support, dashboard, user, device, audit, and version routes. */
export async function handleAdminUserManagementRoutes(ctx: AdminRouteContext): Promise<boolean> {
  const { req, res, pathname, method, parsedUrl, routePath } = ctx;

  if (routePath === '/api/v1/commercial/admin/demo-requests' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const statusFilter = parsedUrl.searchParams.get('status') as DemoRequestStatus | undefined;
    const { items: leads } = await adminListDemoRequests({ status: statusFilter });
    sendJSON(res, 200, { success: true, data: leads });
    return true;
  }

  const demoStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/demo-requests\/([a-zA-Z0-9_-]+)\/status$/);
  if (demoStatusMatch && method === 'PUT') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const demoId = demoStatusMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminDemoStatusSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const result = updateDemoRequestStatus(demoId, body.status as DemoRequestStatus, body.adminNotes, adminGate.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (
    (routePath === '/api/v1/commercial/support/chat' || routePath === '/api/v1/support/chat') &&
    method === 'POST'
  ) {
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(SupportChatSchema, rawBody, res);
    if (!parsed.ok) return true;
    const result = await handleSupportChatMessage({
      ...parsed.data,
      message: parsed.data.message || '',
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/commercial/admin/support-tickets' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const status = parsedUrl.searchParams.get('status') || undefined;
    const category = parsedUrl.searchParams.get('category') || undefined;
    const escalatedOnly = parsedUrl.searchParams.get('escalatedOnly') === 'true';
    const { items: tickets } = await adminListSupportTickets({ status, category, escalatedOnly });
    sendJSON(res, 200, { success: true, data: tickets });
    return true;
  }

  const ticketStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/status$/);
  if (ticketStatusMatch && method === 'PUT') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const ticketId = ticketStatusMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminSupportStatusSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const result = updateSupportTicketStatus(ticketId, body.status as SupportTicket['status'], body.adminNotes, adminGate.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  const ticketReplyMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/reply$/);
  if (ticketReplyMatch && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const ticketId = ticketReplyMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminSupportReplySchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!body.reply || typeof body.reply !== 'string' || !body.reply.trim()) {
      sendJSON(res, 400, { success: false, error: 'Reply text is required.' });
      return true;
    }
    const result = replySupportTicket(
      ticketId,
      body.reply.trim(),
      (body.status || 'RESOLVED') as SupportTicket['status'],
      body.adminNotes,
      adminGate.actor.name
    );
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/commercial/admin/funnel-metrics' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const metrics = await adminFunnelMetrics();
    sendJSON(res, 200, { success: true, data: metrics });
    return true;
  }

  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;

    const stats = await adminGetDashboardSummary();
    sendJSON(res, 200, { success: true, data: stats });
    return true;
  }

  if (pathname === '/api/v1/admin/users' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const status = parsedUrl.searchParams.get('status') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const result = await adminListUsers({ status, role, searchQuery: search, limit, offset });
    sendJSON(res, 200, { success: true, data: result.users, users: result.users, total: result.total, source: result.source });
    return true;
  }

  if (pathname === '/api/v1/admin/terms-compliance' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;

    const data = await adminTermsCompliance();
    sendJSON(res, 200, { success: true, data });
    return true;
  }

  const userStatusMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/status$/);
  if (userStatusMatch && (method === 'PUT' || method === 'POST')) {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userStatusMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminUserStatusSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const nextStatus = body.status as CommercialUserStatus;
    if (isPostgresConfigured()) {
      const r = await adminSetUserStatus(userId, nextStatus, actor, body.reason);
      sendJSON(res, r.ok ? 200 : 404, { success: r.ok });
      return true;
    }
    const ok = updateUserStatus(userId, nextStatus, actor, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  const userPlanMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/plan$/);
  if (userPlanMatch && (method === 'PUT' || method === 'POST')) {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userPlanMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminUserPlanSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (isPostgresConfigured()) {
      const r = await adminSetUserPlan(userId, body.planId, actor);
      sendJSON(res, r.ok ? 200 : 404, { success: r.ok });
      return true;
    }
    const ok = updateUserPlan(userId, body.planId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  const userBoostMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/boost$/);
  if (userBoostMatch && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userBoostMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminBoostQuotaSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const boostType = body.type as 'PROFILES' | 'PROXY_GB';
    if (isPostgresConfigured()) {
      const r = await adminBoostQuota(userId, boostType, body.amount, actor);
      sendJSON(res, r.success ? 200 : 400, r);
      return true;
    }
    const result = boostUserQuota(userId, boostType, body.amount, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  const userFeaturesMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/features$/);
  if (userFeaturesMatch && (method === 'PUT' || method === 'POST')) {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userFeaturesMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminFeatureOverridesSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const normalizedOverrides: Record<string, boolean> = Object.fromEntries(
      Object.entries(body.overrides || {}).map(([k, v]) => [k, Boolean(v)])
    );
    if (isPostgresConfigured()) {
      const r = await adminSetFeatureOverrides(userId, normalizedOverrides, actor);
      sendJSON(res, r.success ? 200 : 400, r);
      return true;
    }
    const result = setUserFeatureOverrides(userId, normalizedOverrides, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  const userResetDevicesMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/reset-devices$/);
  if (userResetDevicesMatch && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userResetDevicesMatch[1];
    if (isPostgresConfigured()) {
      const r = await adminResetUserDevices(userId, actor);
      sendJSON(res, 200, { success: true, unbindCount: r.unbindCount });
      return true;
    }
    const result = resetAllUserDevices(userId, actor);
    sendJSON(res, 200, { success: true, unbindCount: result.unbindCount });
    return true;
  }

  if (pathname === '/api/v1/admin/devices' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const { items: devices } = await adminListDevices({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  const deviceRevokeMatch = pathname.match(/^\/api\/v1\/admin\/devices\/([a-zA-Z0-9_-]+)$/);
  if (deviceRevokeMatch && method === 'DELETE') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const deviceId = deviceRevokeMatch[1];
    const ok = revokeCommercialDevice(deviceId, adminGate.actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const action = parsedUrl.searchParams.get('action') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const resultStatus = parsedUrl.searchParams.get('result') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const logs = await adminListAuditLogs({
      action,
      actorRole: role,
      result: resultStatus,
      searchQuery: search,
      limit,
      offset,
    });
    sendJSON(res, 200, { success: true, data: logs.items, total: logs.total });
    return true;
  }

  if (pathname === '/api/v1/admin/versions' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { items: versions } = await adminListVersions();
    sendJSON(res, 200, { success: true, data: versions });
    return true;
  }

  if (pathname === '/api/v1/admin/versions' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPublishVersionSchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const version = publishSoftwareVersion(parsed.data, adminGate.actor);
      sendJSON(res, 201, { success: true, data: version });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  return false;
}
