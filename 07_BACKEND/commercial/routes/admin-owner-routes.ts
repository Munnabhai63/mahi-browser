import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { sendJSON, parseBody, checkAdminAuthAsync, resolveTrustedClientIp } from './router-shared.js';
import { CommercialRole } from '../../../10_CONFIG/shared/types/commercial.js';
import { sendSafeError, validateStrictBody } from '../../utils/app-error.js';
import {
  SupportChatSchema,
  AdminDemoStatusSchema,
  AdminSupportStatusSchema,
  AdminSupportReplySchema,
  AdminUserStatusSchema,
  AdminUserPlanSchema,
  AdminBoostQuotaSchema,
  AdminFeatureOverridesSchema,
  AdminCreatePlanSchema,
  AdminUpdatePlanSchema,
  AdminPricingDraftSchema,
  AdminPricingPublishSchema,
  AdminActionSecretOnlySchema,
  AdminRevokeLicenseSchema,
  AdminExtendLicenseSchema,
  AdminPublishVersionSchema,
  AdminPaymentDecisionSchema,
  OwnerVerifySchema,
  OwnerGrantSchema,
  OwnerPlanMutationSchema,
  OwnerUserMutationSchema,
  OwnerKillSwitchSchema,
} from '../validation/commercial-schemas.js';
import {
  adminGetDashboardSummary,
  adminListUsers,
  adminTermsCompliance,
  adminListPlans,
  adminListLicenses,
  adminListDevices,
  adminListAuditLogs,
  adminListVersions,
  adminListPayments,
  adminFunnelMetrics,
  adminListSupportTickets,
  adminListDemoRequests,
} from '../admin-data-service.js';
import {
  adminSetUserStatus,
  adminSetUserPlan,
  adminBoostQuota,
  adminSetFeatureOverrides,
  adminResetUserDevices,
} from '../admin-actions.js';
import {
  getCommercialPlans,
  createCommercialPlan,
  updateCommercialPlan,
} from '../commercial-plan-service.js';
import {
  getAllPricingVersions,
  getActivePricingVersion,
  createPricingDraft,
  updatePricingDraft,
  previewPricingChanges,
  publishPricingVersion,
  rollbackPricing,
  getAdminRevenueSummary,
  getProviderSyncStatus,
  buildPlanCatalog,
} from '../pricing-admin-service.js';
import {
  createLicense,
  getLicenses,
  revokeLicense,
  extendLicense,
  deactivateDevice,
  calculateExpiryDate,
  generateLicenseKey,
} from '../../../04_LICENSING/license-engine.js';
import { LicenseDurationType } from '../../../10_CONFIG/shared/types/license.js';
import { getCommercialAuditLogs, logCommercialAudit } from '../commercial-audit-service.js';
import { getSoftwareVersions, publishSoftwareVersion } from '../commercial-version-service.js';
import { getDemoRequests, updateDemoRequestStatus, DemoRequestStatus } from '../demo-service.js';
import {
  handleSupportChatMessage,
  getSupportTickets,
  updateSupportTicketStatus,
  replySupportTicket,
  getSupportTicketMetrics,
} from '../support-ticket-service.js';
import { getFunnelMetrics } from '../funnel-service.js';
import {
  isOwnerConfigured,
  verifyOwnerTotp,
  createOwnerSessionAsync,
  isOwnerSessionAsync,
  revokeOwnerSessionAsync,
  checkOwnerVerifyRateLimitAsync,
  recordFailedOwnerVerifyAttemptAsync,
  recordSuccessfulOwnerVerifyAttemptAsync,
} from '../../services/owner-totp-service.js';
import {
  getEmergencyKillSwitchStateAsync,
  setEmergencyKillSwitchAsync,
  rejectIfEmergencyFrozen,
} from '../../services/kill-switch-service.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { getCentralRepository, isPostgresConfigured } from '../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { getCentralUserByIdAsync, getCentralUserByEmailAsync } from '../../../05_AUTH/central-auth-service.js';
import {
  getUserById,
  getUserByEmail,
  updateUserStatus,
  updateUserPlan,
  boostUserQuota,
  setUserFeatureOverrides,
} from '../commercial-auth-service.js';
import { paymentService, resolveCommercialPlan } from '../payment-service.js';
import { revokeCommercialDevice, resetAllUserDevices, getAllCommercialDevices } from '../commercial-device-service.js';

async function requireAdminAccess(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body?: any,
  options?: { hideUnauthenticated?: boolean; forbiddenMessage?: string }
): Promise<{ ok: true; actor: { id: string; name: string; role: CommercialRole } } | { ok: false }> {
  const authRes = await checkAdminAuthAsync(req, body);
  if (authRes.isAdmin) {
    return { ok: true, actor: authRes.actor };
  }
  if (authRes.isNonStaff || options?.hideUnauthenticated) {
    sendJSON(res, 404, { success: false, error: 'Not found.' });
    return { ok: false };
  }
  sendJSON(res, 403, {
    success: false,
    error: options?.forbiddenMessage || 'Forbidden. Admin privileges required.',
  });
  return { ok: false };
}

export async function handleAdminOwnerRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/api/v1/commercial/admin/demo-requests' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const statusFilter = parsedUrl.searchParams.get('status') as DemoRequestStatus | undefined;
    const { items: leads } = await adminListDemoRequests({ status: statusFilter });
    sendJSON(res, 200, { success: true, data: leads });
    return true;
  }

  // Admin: Update Demo Request Status
  const demoStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/demo-requests\/([a-zA-Z0-9_-]+)\/status$/);
  if (demoStatusMatch && method === 'PUT') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const demoId = demoStatusMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminDemoStatusSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const result = updateDemoRequestStatus(demoId, body.status as any, body.adminNotes, adminGate.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: AI Support Assistant & Payment Escalation Chat Route
  if (
    (routePath === '/api/v1/commercial/support/chat' || routePath === '/api/v1/support/chat') &&
    method === 'POST'
  ) {
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(SupportChatSchema, rawBody, res);
    if (!parsed.ok) return true;
    const result = await handleSupportChatMessage(parsed.data as any);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: Admin: List Support Tickets
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

  // Phase 20: Admin: Update Support Ticket Status
  const ticketStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/status$/);
  if (ticketStatusMatch && method === 'PUT') {
    const adminGate = await requireAdminAccess(req, res, undefined, { forbiddenMessage: 'Admin authorization required' });
    if (!adminGate.ok) return true;
    const ticketId = ticketStatusMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminSupportStatusSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const result = updateSupportTicketStatus(ticketId, body.status as any, body.adminNotes, adminGate.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: Admin: Reply to Support Ticket
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
    const result = replySupportTicket(ticketId, body.reply.trim(), (body.status || 'RESOLVED') as any, body.adminNotes, adminGate.actor.name);
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

  // -------------------------------------------------------------
  // 7. ADMIN USER MANAGEMENT (Protected)
  // -------------------------------------------------------------
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

  // Terms Acceptance & Legal Compliance Summary
  if (pathname === '/api/v1/admin/terms-compliance' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;

    const data = await adminTermsCompliance();
    sendJSON(res, 200, {
      success: true,
      data,
    });
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
    const body = parsed.data as any;
    const prisma = isPostgresConfigured();
    if (prisma) {
      const r = await adminSetUserStatus(userId, body.status, actor, body.reason);
      if (r.centralGone) {
        sendJSON(res, 409, {
          success: false,
          error: 'mirror_missing_commercial_record',
          message:
            r.message ||
            'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.',
        });
        return true;
      }
      sendJSON(res, r.ok ? 200 : 404, { success: r.ok });
      return true;
    }
    const ok = updateUserStatus(userId, body.status, actor, body.reason);
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
    const prisma = isPostgresConfigured();
    if (prisma) {
      const r = await adminSetUserPlan(userId, body.planId, actor);
      if (r.centralGone) {
        sendJSON(res, 409, {
          success: false,
          error: 'mirror_missing_commercial_record',
          message:
            r.message ||
            'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.',
        });
        return true;
      }
      sendJSON(res, r.ok ? 200 : 404, { success: r.ok });
      return true;
    }
    const ok = updateUserPlan(userId, body.planId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // Phase 23: Admin Quota Booster (GoLogin Parity)
  const userBoostMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/boost$/);
  if (userBoostMatch && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userBoostMatch[1];
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AdminBoostQuotaSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data as any;
    const prisma = isPostgresConfigured();
    if (prisma) {
      const r = await adminBoostQuota(userId, body.type, body.amount, actor);
      if (r.centralGone) {
        sendJSON(res, 409, {
          success: false,
          error: 'mirror_missing_commercial_record',
          message:
            r.message ||
            'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.',
        });
        return true;
      }
      sendJSON(res, r.success ? 200 : 400, r);
      return true;
    }
    const result = boostUserQuota(userId, body.type, body.amount, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: Admin Enterprise Feature Overrides (MostLogin Parity)
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
    const prisma = isPostgresConfigured();
    if (prisma) {
      const r = await adminSetFeatureOverrides(userId, normalizedOverrides, actor);
      if (r.centralGone) {
        sendJSON(res, 409, {
          success: false,
          error: 'mirror_missing_commercial_record',
          message:
            r.message ||
            'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.',
        });
        return true;
      }
      sendJSON(res, r.success ? 200 : 400, r);
      return true;
    }
    const result = setUserFeatureOverrides(userId, normalizedOverrides, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: 1-Click HWID & Machine Unbind (GoLogin Parity)
  const userResetDevicesMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_:-]+)\/reset-devices$/);
  if (userResetDevicesMatch && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { actor } = adminGate;
    const userId = userResetDevicesMatch[1];
    const prisma = isPostgresConfigured();
    if (prisma) {
      const r = await adminResetUserDevices(userId, actor);
      if (r.centralGone) {
        sendJSON(res, 409, {
          success: false,
          error: 'mirror_missing_commercial_record',
          message:
            r.message ||
            'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.',
        });
        return true;
      }
      sendJSON(res, 200, { success: true, unbindCount: r.unbindCount });
      return true;
    }
    const result = resetAllUserDevices(userId, actor);
    sendJSON(res, 200, { success: true, unbindCount: result.unbindCount });
    return true;
  }

  // -------------------------------------------------------------
  // 8. ADMIN PLANS MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/plans' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const { items: plans } = await adminListPlans(true);
    sendJSON(res, 200, { success: true, data: plans });
    return true;
  }

  if (pathname === '/api/v1/admin/plans' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminCreatePlanSchema, rawBody, res);
    if (!parsed.ok) return true;
    const newPlan = createCommercialPlan(parsed.data as any, adminGate.actor);
    sendJSON(res, 201, { success: true, data: newPlan });
    return true;
  }

  const planIdMatch = pathname.match(/^\/api\/v1\/admin\/plans\/([a-zA-Z0-9_-]+)$/);
  if (planIdMatch && method === 'PUT') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminUpdatePlanSchema, rawBody, res);
    if (!parsed.ok) return true;
    const planId = planIdMatch[1];
    const updated = updateCommercialPlan(planId, parsed.data as any, adminGate.actor);
    sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    return true;
  }

  // -------------------------------------------------------------
  // 8B. ADMIN PRICING VERSIONING & CATALOG (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/pricing/catalog' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 500 });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/versions' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    sendJSON(res, 200, { success: true, data: getAllPricingVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/active' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    sendJSON(res, 200, { success: true, data: getActivePricingVersion() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/draft' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPricingDraftSchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const draft = createPricingDraft(parsed.data as any, adminGate.actor.id, adminGate.actor.name);
      sendJSON(res, 201, { success: true, data: draft });
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const pricingDraftUpdateMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/draft\/(\d+)$/);
  if (pricingDraftUpdateMatch && method === 'PUT') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPricingDraftSchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const version = parseInt(pricingDraftUpdateMatch[1], 10);
      const updated = updatePricingDraft(version, parsed.data as any, adminGate.actor.id, adminGate.actor.name);
      sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const pricingPreviewMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/preview\/(\d+)$/);
  if (pricingPreviewMatch && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    try {
      const version = parseInt(pricingPreviewMatch[1], 10);
      const preview = previewPricingChanges(version);
      sendJSON(res, 200, { success: true, data: preview });
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 404 });
    }
    return true;
  }

  const pricingPublishMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/publish\/(\d+)$/);
  if (pricingPublishMatch && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPricingPublishSchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const version = parseInt(pricingPublishMatch[1], 10);
      const resPublish = publishPricingVersion(version, adminGate.actor.id, adminGate.actor.name);
      sendJSON(res, resPublish.success ? 200 : 400, resPublish);
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const pricingRollbackMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/rollback\/(\d+)$/);
  if (pricingRollbackMatch && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminActionSecretOnlySchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const version = parseInt(pricingRollbackMatch[1], 10);
      const rolledBack = rollbackPricing(version, adminGate.actor.id, adminGate.actor.name);
      sendJSON(res, rolledBack.success ? 200 : 400, rolledBack);
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/revenue-summary' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    sendJSON(res, 200, { success: true, data: getAdminRevenueSummary() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/provider-sync-status' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    sendJSON(res, 200, { success: true, data: getProviderSyncStatus() });
    return true;
  }

  // -------------------------------------------------------------
  // 9. ADMIN LICENSE MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/licenses' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const { items: licenses } = await adminListLicenses({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: licenses });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses' && method === 'POST') {
    const body = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, body);
    if (!adminGate.ok) return true;
    sendJSON(res, 403, {
      success: false,
      error: 'License minting is disabled in the app. Contact support.',
    });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/revoke' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminRevokeLicenseSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    try {
      const ok = await revokeLicense(body.licenseId, body.reason);
      sendJSON(res, ok ? 200 : 404, { success: ok });
      return true;
    } catch (e: any) {
      console.error('[LicenseEngine][CRITICAL] admin license op failed', e?.message || e);
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
      return true;
    }
  }

  if (pathname === '/api/v1/admin/licenses/extend' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminExtendLicenseSchema, rawBody, res);
    if (!parsed.ok) return true;
    try {
      const record = await extendLicense(parsed.data);
      sendJSON(res, record ? 200 : 404, { success: Boolean(record), data: record });
      return true;
    } catch (e: any) {
      console.error('[LicenseEngine][CRITICAL] admin license op failed', e?.message || e);
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
      return true;
    }
  }

  // -------------------------------------------------------------
  // 10. ADMIN DEVICE FLEET MANAGEMENT (Protected)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 11. ADMIN AUDIT LOGS (Protected)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 12. ADMIN SOFTWARE VERSIONS (Protected)
  // -------------------------------------------------------------
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
    const version = publishSoftwareVersion(parsed.data, adminGate.actor);
    sendJSON(res, 201, { success: true, data: version });
    return true;
  }

  // -------------------------------------------------------------
  // 12.1 ADMIN PAYMENTS & MANUAL UPI APPROVAL (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/payments' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res);
    if (!adminGate.ok) return true;
    const status = parsedUrl.searchParams.get('status') || undefined;
    const { items: payments } = await adminListPayments({ status });
    sendJSON(res, 200, { success: true, data: payments, payments });
    return true;
  }

  const paymentApproveMatch = pathname.match(/^\/api\/v1\/admin\/payments\/([a-zA-Z0-9_-]+)\/approve$/);
  if (paymentApproveMatch && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPaymentDecisionSchema, rawBody, res);
    if (!parsed.ok) return true;
    const paymentId = paymentApproveMatch[1];
    try {
      const result = await paymentService.approveManualPayment(paymentId, adminGate.actor);
      sendJSON(res, 200, {
        success: true,
        payment_id: paymentId,
        status: 'SUCCEEDED',
        message: 'Payment approved successfully.',
        data: result,
      });
      return true;
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
      return true;
    }
  }

  const paymentRejectMatch = pathname.match(/^\/api\/v1\/admin\/payments\/([a-zA-Z0-9_-]+)\/reject$/);
  if (paymentRejectMatch && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody);
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(AdminPaymentDecisionSchema, rawBody, res);
    if (!parsed.ok) return true;
    const paymentId = paymentRejectMatch[1];
    const reason = parsed.data.reason || 'Payment rejected by administrator';
    try {
      const result = await paymentService.rejectManualPayment(paymentId, adminGate.actor, reason);
      sendJSON(res, 200, {
        success: true,
        payment_id: paymentId,
        status: result.status || 'REJECTED',
        message: 'Payment rejected successfully.',
        reason,
        data: result,
      });
      return true;
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 400 });
      return true;
    }
  }

  // -------------------------------------------------------------
  function getOwnerSessionCookie(req: http.IncomingMessage): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)owner_session=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function recordOwnerActionAudit(params: {
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, any>;
    ip: string;
  }): Promise<void> {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const now = new Date().toISOString();
    const detailsStr = JSON.stringify(params.details);

    if (prisma && typeof (prisma as any).commercial_audit_logs?.create === 'function') {
      try {
        await prisma.commercial_audit_logs.create({
          data: {
            id: crypto.randomUUID(),
            actor_id: 'OWNER',
            actor_name: 'OWNER',
            actor_role: 'OWNER',
            action: params.action,
            target_type: params.targetType,
            target_id: params.targetId,
            details: detailsStr,
            ip_address: params.ip,
            result: 'SUCCESS',
            created_at: now,
          },
        });
        return;
      } catch (err: any) {
        console.warn('[OwnerService] Postgres audit log write failed (warn-only):', err?.message);
      }
    }

    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO commercial_audit_logs (
          id, actor_id, actor_name, actor_role, action, target_type, target_id, details, ip_address, result, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        'OWNER',
        'OWNER',
        'OWNER',
        params.action,
        params.targetType,
        params.targetId,
        detailsStr,
        params.ip,
        'SUCCESS',
        now
      );
    } catch (err: any) {
      console.warn('[OwnerService] SQLite audit log write failed (warn-only):', err?.message);
    }
  }

  async function resolveTargetUser(rawIdOrEmail: string): Promise<any | null> {
    if (!rawIdOrEmail) return null;
    let clean = String(rawIdOrEmail).trim();
    if (clean.startsWith('central:')) {
      clean = clean.slice('central:'.length).trim();
    }
    // 1. Try by ID in central auth
    try {
      const byId = await getCentralUserByIdAsync(clean);
      if (byId) return byId;
    } catch {}

    // 2. Try by Email in central auth
    try {
      const byEmail = await getCentralUserByEmailAsync(clean);
      if (byEmail) return byEmail;
    } catch {}

    // 3. Fallback to local commercial users
    try {
      const comm = getUserById(clean) || getUserByEmail(clean);
      if (comm) return comm;
    } catch {}

    return null;
  }

  if (pathname === '/api/v1/admin/owner/verify' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerVerifySchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const clientIp = resolveTrustedClientIp(req);
    if (!(await checkOwnerVerifyRateLimitAsync(clientIp))) {
      sendJSON(res, 429, { success: false, error: 'Too many failed verification attempts. Please try again later.' });
      return true;
    }
    const code = body?.code !== undefined && body?.code !== null ? String(body.code).trim() : '';
    if (!code || !verifyOwnerTotp(code)) {
      await recordFailedOwnerVerifyAttemptAsync(clientIp);
      sendJSON(res, 401, { success: false, error: 'Invalid or expired code' });
      return true;
    }

    await recordSuccessfulOwnerVerifyAttemptAsync(clientIp);
    const sessionToken = await createOwnerSessionAsync();
    res.setHeader('Set-Cookie', `owner_session=${sessionToken}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=1800`);
    sendJSON(res, 200, { success: true });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/logout' && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res, undefined, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const cookieToken = getOwnerSessionCookie(req);
    if (cookieToken) {
      await revokeOwnerSessionAsync(cookieToken);
    }
    res.setHeader('Set-Cookie', 'owner_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0');
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/v1/admin/owner/kill-switch' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }
    const state = await getEmergencyKillSwitchStateAsync();
    sendJSON(res, 200, { success: true, ...state });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/kill-switch' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerKillSwitchSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const state = await setEmergencyKillSwitchAsync({
      enabled: body.enabled,
      reason: body.reason,
      updatedBy: adminGate.actor.id || adminGate.actor.name || 'OWNER',
    });

    await recordOwnerActionAudit({
      action: body.enabled ? 'OWNER_KILL_SWITCH_ENABLED' : 'OWNER_KILL_SWITCH_DISABLED',
      targetType: 'SYSTEM',
      targetId: 'emergency_kill_switch',
      details: {
        enabled: state.enabled,
        dbEnabled: state.dbEnabled,
        envOverride: state.envOverride,
        reason: body.reason,
        ip: clientIp,
      },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, ...state });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/grant' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerGrantSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    if (await rejectIfEmergencyFrozen(res, 'owner_license_grant')) return true;

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for grant:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const planId = body?.planId ? String(body.planId).trim() : '';
    const targetPlan = resolveCommercialPlan(planId);
    if (!targetPlan) {
      sendJSON(res, 400, { success: false, error: 'PLAN_NOT_FOUND' });
      return true;
    }

    const durationType = (body?.durationType || '30_DAYS') as LicenseDurationType;
    const now = new Date().toISOString();
    const expiresAt = calculateExpiryDate(durationType, now, body?.customExpiresAt);
    const maxDevices = targetPlan.limits?.maxDevices && targetPlan.limits.maxDevices > 0 ? targetPlan.limits.maxDevices : 1;
    const customerName = (targetUser.name || targetUser.email || userId).trim();
    const notes = `Admin-granted | Plan: ${targetPlan.id}${body?.reason ? ' | Reason: ' + body.reason : ''}`;

    const { rawKey, keyHash, keyMasked } = generateLicenseKey();
    const licenseId = crypto.randomUUID();

    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && ['licenses', 'auth_users'].every((m) => !!(prisma as any)[m]);

    let planSyncFailed = false;

    if (prisma && pgReady) {
      try {
        await prisma.licenses.create({
          data: {
            id: licenseId,
            license_key_hash: keyHash,
            key_masked: keyMasked,
            customer_name: customerName,
            account_id: userId,
            status: 'ACTIVE',
            duration_type: durationType,
            max_devices: maxDevices,
            starts_at: now,
            expires_at: expiresAt,
            created_at: now,
            created_by: 'OWNER',
            revoked_at: null,
            last_validation_at: null,
            notes,
          },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] Postgres license create failed:', err?.message || err);
        sendJSON(res, 500, { success: false, error: 'Failed to create license in database' });
        return true;
      }

      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: {
            plan_id: targetPlan.id,
            profile_quota: targetPlan.limits?.maxProfiles,
            updated_at: now,
          },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG plan sync error', err?.message);
        planSyncFailed = true;
      }

      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { plan_id: targetPlan.id, updated_at: now },
            });
          } else {
            await prisma.commercial_users.create({
              data: {
                id: userId,
                email: targetUser.email,
                password_hash: targetUser.passwordHash || 'OAUTH_MIRROR',
                salt: targetUser.salt || 'OAUTH_MIRROR',
                name: targetUser.name || targetUser.email.split('@')[0],
                role: targetUser.role || 'USER',
                status: targetUser.status || 'ACTIVE',
                plan_id: targetPlan.id,
                created_at: now,
                updated_at: now,
                last_login_at: now,
              },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users plan sync skipped/warn:', err?.message);
      }

      try {
        if (typeof (prisma as any).commercial_subscriptions?.create === 'function') {
          const subId = `sub_${crypto.randomUUID()}`;
          const bCycle = durationType === '1_YEAR' ? 'ANNUAL' : 'MONTHLY';
          await (prisma as any).commercial_subscriptions.create({
            data: {
              id: subId,
              user_id: userId,
              plan_id: targetPlan.id,
              license_id: licenseId,
              status: 'ACTIVE',
              billing_cycle: bCycle,
              starts_at: now,
              expires_at: expiresAt,
              payment_provider: 'OWNER_GRANT',
              created_at: now,
            },
          });
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_subscriptions grant sync skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare(`
          INSERT INTO licenses (
            id, license_key_hash, key_masked, customer_name, account_id,
            status, duration_type, max_devices, starts_at, expires_at,
            created_at, created_by, revoked_at, last_validation_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          licenseId,
          keyHash,
          keyMasked,
          customerName,
          userId,
          'ACTIVE',
          durationType,
          maxDevices,
          now,
          expiresAt,
          now,
          'OWNER',
          null,
          null,
          notes
        );

        try {
          const authRow = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(userId);
          if (authRow) {
            db.prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(
              targetPlan.id,
              now,
              userId
            );
          }
          db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(
            targetPlan.id,
            now,
            userId
          );
        } catch (e: any) {
          console.error('[OwnerService][CRITICAL] SQLite plan sync error', e?.message);
          planSyncFailed = true;
        }

        try {
          const subId = `sub_${crypto.randomUUID()}`;
          const bCycle = durationType === '1_YEAR' ? 'ANNUAL' : 'MONTHLY';
          db.prepare(`
            INSERT INTO commercial_subscriptions (
              id, user_id, plan_id, license_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
            ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 'OWNER_GRANT', ?)
          `).run(subId, userId, targetPlan.id, licenseId, bCycle, now, expiresAt, now);
        } catch (e: any) {
          console.warn('[OwnerService] SQLite subscription grant sync warn:', e?.message);
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite license create failed:', err?.message || err);
        sendJSON(res, 500, { success: false, error: 'Failed to create license' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_GRANT_PREMIUM',
      targetType: 'LICENSE',
      targetId: licenseId,
      details: { target: userId, planId: targetPlan.id, licenseId, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, licenseId, keyMasked, rawKey, planSyncFailed });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/remove' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for remove:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const reason = body?.reason || 'Revoked by owner';
    let revokedCount = 0;

    try {
      if (body?.licenseId) {
        const ok = await revokeLicense(String(body.licenseId).trim(), reason);
        if (ok) revokedCount++;
      } else {
        const prisma = isPostgresConfigured() ? getPrismaClient() : null;
        const pgReady = prisma && !!(prisma as any).licenses;
        if (prisma && pgReady) {
          const userLicenses = await prisma.licenses.findMany({
            where: {
              account_id: userId,
              status: { in: ['ACTIVE', 'NOT_ACTIVATED', 'EXPIRED'] },
            },
            select: { id: true },
          });
          for (const lic of userLicenses) {
            const ok = await revokeLicense(lic.id, reason);
            if (ok) revokedCount++;
          }
        } else {
          const db = getDatabase();
          const userLicenses = db.prepare(
            "SELECT id FROM licenses WHERE account_id = ? AND status IN ('ACTIVE', 'NOT_ACTIVATED', 'EXPIRED')"
          ).all(userId) as any[];
          for (const lic of userLicenses) {
            const ok = await revokeLicense(lic.id, reason);
            if (ok) revokedCount++;
          }
        }
      }
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] License revoke error during remove:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Failed to revoke licenses' });
      return true;
    }

    const now = new Date().toISOString();
    let planSyncFailed = false;
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { plan_id: 'plan_free', updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG plan reset error', err?.message);
        planSyncFailed = true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { plan_id: 'plan_free', updated_at: now },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users plan reset skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run('plan_free', now, userId);
      } catch (e: any) {
        planSyncFailed = true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_REMOVE_PREMIUM',
      targetType: body?.licenseId ? 'LICENSE' : 'USER',
      targetId: body?.licenseId ? String(body.licenseId) : userId,
      details: { target: userId, licenseId: body?.licenseId, revokedCount, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, revokedCount, planSyncFailed });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/set-plan' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerPlanMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for set-plan:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const planId = body?.planId ? String(body.planId).trim() : '';
    const targetPlan = resolveCommercialPlan(planId);
    if (!targetPlan) {
      sendJSON(res, 400, { success: false, error: 'PLAN_NOT_FOUND' });
      return true;
    }

    const fromPlan = targetUser.plan_id || 'unknown';
    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: {
            plan_id: targetPlan.id,
            profile_quota: targetPlan.limits?.maxProfiles,
            updated_at: now,
          },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG set-plan error', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update plan in database' });
        return true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { plan_id: targetPlan.id, updated_at: now },
            });
          } else {
            await prisma.commercial_users.create({
              data: {
                id: userId,
                email: targetUser.email,
                password_hash: targetUser.passwordHash || 'OAUTH_MIRROR',
                salt: targetUser.salt || 'OAUTH_MIRROR',
                name: targetUser.name || targetUser.email.split('@')[0],
                role: targetUser.role || 'USER',
                status: targetUser.status || 'ACTIVE',
                plan_id: targetPlan.id,
                created_at: now,
                updated_at: now,
                last_login_at: now,
              },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users set-plan skipped/warn:', err?.message);
      }

      try {
        if (targetPlan.id !== 'plan_free' && targetPlan.id !== 'free') {
          if (typeof (prisma as any).commercial_subscriptions?.create === 'function') {
            const subId = `sub_${crypto.randomUUID()}`;
            const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await (prisma as any).commercial_subscriptions.create({
              data: {
                id: subId,
                user_id: userId,
                plan_id: targetPlan.id,
                status: 'ACTIVE',
                billing_cycle: 'MONTHLY',
                starts_at: now,
                expires_at: expDate,
                payment_provider: 'OWNER_SET_PLAN',
                created_at: now,
              },
            });
          }
        } else {
          if (typeof (prisma as any).commercial_subscriptions?.updateMany === 'function') {
            await (prisma as any).commercial_subscriptions.updateMany({
              where: { user_id: userId, status: 'ACTIVE' },
              data: { status: 'CANCELLED' },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_subscriptions set-plan sync skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(
          targetPlan.id,
          now,
          userId
        );
        try {
          db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(
            targetPlan.id,
            now,
            userId
          );
          if (targetPlan.id !== 'plan_free' && targetPlan.id !== 'free') {
            const subId = `sub_${crypto.randomUUID()}`;
            const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`
              INSERT INTO commercial_subscriptions (
                id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
              ) VALUES (?, ?, ?, 'ACTIVE', 'MONTHLY', ?, ?, 'OWNER_SET_PLAN', ?)
            `).run(subId, userId, targetPlan.id, now, expDate, now);
          } else {
            db.prepare("UPDATE commercial_subscriptions SET status = 'CANCELLED' WHERE user_id = ? AND status = 'ACTIVE'").run(userId);
          }
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite set-plan error', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update plan' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_PLAN_CHANGED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, from: fromPlan, to: targetPlan.id, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, from: fromPlan, to: targetPlan.id });
    return true;
  }

  if ((pathname === '/api/v1/admin/owner/suspend' || pathname === '/api/v1/admin/owner/resume') && method === 'POST') {
    const isSuspend = pathname.endsWith('/suspend');
    const newStatus = isSuspend ? 'SUSPENDED' : 'ACTIVE';
    const auditAction = isSuspend ? 'OWNER_USER_SUSPENDED' : 'OWNER_USER_RESUMED';

    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for status change:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { status: newStatus, updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update user status in database' });
        return true;
      }

      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { status: newStatus, updated_at: now },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users status update skipped/warn:', err?.message);
      }

      if (isSuspend) {
        try {
          const userLicenses = await prisma.licenses.findMany({
            where: { account_id: userId },
            select: { id: true },
          });
          const licIds = userLicenses.map((l: any) => l.id);
          if (licIds.length > 0 && typeof (prisma as any).license_devices?.updateMany === 'function') {
            await prisma.license_devices.updateMany({
              where: { license_id: { in: licIds }, status: 'ACTIVE' },
              data: { status: 'DEACTIVATED' },
            });
          }
        } catch (err: any) {
          console.warn('[OwnerService] license_devices deactivation skipped/warn:', err?.message);
        }
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, userId);
        } catch {}

        if (isSuspend) {
          try {
            db.prepare(`
              UPDATE license_devices SET status = 'DEACTIVATED'
              WHERE status = 'ACTIVE' AND license_id IN (SELECT id FROM licenses WHERE account_id = ?)
            `).run(userId);
          } catch {}
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update user status' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: auditAction,
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: newStatus, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, status: newStatus });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/ban' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for ban:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const now = new Date().toISOString();
    const reason = body?.reason || 'User banned by owner';
    let revokedCount = 0;

    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { status: 'BANNED', updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG ban status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to ban user in database' });
        return true;
      }

      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { status: 'BANNED', updated_at: now },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users ban status update skipped/warn:', err?.message);
      }

      try {
        const userLicenses = await prisma.licenses.findMany({
          where: { account_id: userId, status: { in: ['ACTIVE', 'NOT_ACTIVATED', 'EXPIRED'] } },
          select: { id: true },
        });
        for (const lic of userLicenses) {
          const ok = await revokeLicense(lic.id, reason);
          if (ok) revokedCount++;
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] Mass license revoke failed on ban:', err?.message);
      }

      try {
        const allUserLicenses = await prisma.licenses.findMany({
          where: { account_id: userId },
          select: { id: true },
        });
        const licIds = allUserLicenses.map((l: any) => l.id);
        if (licIds.length > 0 && typeof (prisma as any).license_devices?.updateMany === 'function') {
          await prisma.license_devices.updateMany({
            where: { license_id: { in: licIds }, status: 'ACTIVE' },
            data: { status: 'DEACTIVATED' },
          });
        }
      } catch (err: any) {
        console.warn('[OwnerService] license_devices deactivation skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run('BANNED', now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run('BANNED', now, userId);
        } catch {}

        const userLicenses = db.prepare(
          "SELECT id FROM licenses WHERE account_id = ? AND status IN ('ACTIVE', 'NOT_ACTIVATED', 'EXPIRED')"
        ).all(userId) as any[];
        for (const lic of userLicenses) {
          const ok = await revokeLicense(lic.id, reason);
          if (ok) revokedCount++;
        }

        try {
          db.prepare(`
            UPDATE license_devices SET status = 'DEACTIVATED'
            WHERE status = 'ACTIVE' AND license_id IN (SELECT id FROM licenses WHERE account_id = ?)
          `).run(userId);
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite ban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to ban user' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_USER_BANNED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: 'BANNED', revokedCount, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, status: 'BANNED', revokedCount });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/unban' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const cookieToken = getOwnerSessionCookie(req);
    if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
      sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
      return true;
    }

    const clientIp = resolveTrustedClientIp(req);
    const rawTarget = body?.userId ? String(body.userId).trim() : '';
    if (!rawTarget) {
      sendJSON(res, 400, { success: false, error: 'userId is required' });
      return true;
    }

    let targetUser: any = null;
    try {
      targetUser = await resolveTargetUser(rawTarget);
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] User lookup error for unban:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
      return true;
    }
    if (!targetUser) {
      sendJSON(res, 404, { success: false, error: 'User not found' });
      return true;
    }
    const userId = targetUser.id;

    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { status: 'ACTIVE', updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG unban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to unban user in database' });
        return true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({
              where: { id: userId },
              data: { status: 'ACTIVE', updated_at: now },
            });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users unban status update skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run('ACTIVE', now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run('ACTIVE', now, userId);
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite unban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to unban user' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_USER_UNBANNED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: 'ACTIVE', reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, {
      success: true,
      status: 'ACTIVE',
      note: 'Account unbanned. Existing licenses remain revoked; re-grant is required if access is desired.',
    });
    return true;
  }

  return false;
}
