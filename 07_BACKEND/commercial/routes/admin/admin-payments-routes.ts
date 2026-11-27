import { sendJSON, parseBody } from '../router-shared.js';
import { sendSafeError, validateStrictBody } from '../../../utils/app-error.js';
import {
  AdminCreatePlanSchema,
  AdminUpdatePlanSchema,
  AdminPricingDraftSchema,
  AdminPricingPublishSchema,
  AdminActionSecretOnlySchema,
  AdminRevokeLicenseSchema,
  AdminExtendLicenseSchema,
  AdminPaymentDecisionSchema,
} from '../../validation/commercial-schemas.js';
import {
  adminListPlans,
  adminListLicenses,
  adminListPayments,
} from '../../admin-data-service.js';
import {
  createCommercialPlan,
  updateCommercialPlan,
} from '../../commercial-plan-service.js';
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
} from '../../pricing-admin-service.js';
import { revokeLicense, extendLicense } from '../../../../04_LICENSING/license-engine.js';
import { paymentService } from '../../payment-service.js';
import { AdminRouteContext, requireAdminAccess } from './admin-shared.js';

/** Handles admin plans, pricing versions, licenses, and manual payment approval routes. */
export async function handleAdminPaymentRoutes(ctx: AdminRouteContext): Promise<boolean> {
  const { req, res, pathname, method, parsedUrl } = ctx;

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

  return false;
}
