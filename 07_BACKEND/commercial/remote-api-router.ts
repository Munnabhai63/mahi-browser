/**
 * MAHI Browser — Remote Cloud API Router
 * Phase 6 Architecture
 *
 * Handles all remote cloud endpoints (/api/v1/remote/* and /v1/* aliases):
 * - Unified Authentication (API Keys + JWT)
 * - Dual-Gate Scope & Workspace RBAC Enforcement
 * - Rate Limiting & Audit Logging
 * - Idempotency Cache
 * - RESTful Profile, Workspace, Proxy, Automation & Webhook Endpoints
 * - Honest Device/Offline Profile Launch Model
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  RemoteApiService,
  checkRateLimitAsync,
  getCachedIdempotentResponse,
  saveIdempotentResponse,
} from '../services/remote-api-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { rejectIfEmergencyFrozen } from '../services/kill-switch-service.js';
import { verifyAccessToken, getCentralUserById, getCentralUserByIdAsync } from '../../05_AUTH/central-auth-service.js';
import { verifyPostgresOrSqliteUserAndSessionAsync } from './routes/router-shared.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { getUserDevices } from './commercial-device-service.js';
import { isTrustedOrigin } from '../server/cloud-gateway.js';
import {
  readBoundedText,
  parseBoundedJson,
  getErrorStatusCode,
  BoundedBodyOptions,
} from '../utils/http-security.js';
import {
  getProfiles,
  createProfile,
  getProfileById,
  updateProfile,
  deleteProfile,
} from '../../02_BROWSER/services/profile-service.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getTeamWorkspace,
  getWorkspaceMembers,
  inviteWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
  shareProfileToWorkspace,
  revokeProfileShare,
  listWorkspaceProfiles,
} from '../services/team-workspace-service.js';
import { ProxyProviderService } from '../services/proxy-provider-service.js';
import {
  getWorkflows,
  getWorkflowById,
  getWorkflowLogs,
  saveWorkflow,
  deleteWorkflow,
  stopWorkflowRun,
  getWorkflowRunStatus,
} from '../../09_AUTOMATION/automation-engine.js';
import { automationScheduler } from '../../09_AUTOMATION/automation-scheduler.js';
import { WARMING_TEMPLATES } from '../../09_AUTOMATION/cookie-warmer-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  cloudBrowserControlPlane,
  sessionGateway,
  sessionScheduler,
  resourceLimiter,
} from '../cloud-browser/index.js';
import { mobileCompanionService } from '../services/mobile-companion-service.js';
import { paymentService } from './payment-service.js';
import { checkCapability, canCreateProfile } from './commercial-entitlement-service.js';
import { FeatureCapability } from '../../10_CONFIG/shared/types/commercial.js';
import {
  RemoteAuthContext,
  RemoteApiScope,
  RemoteApiResponse,
  CreateRemoteApiKeyDTO,
  CreateWebhookEndpointDTO,
} from '../../10_CONFIG/shared/types/remote-api.js';
import { TeamPermission, TeamRole } from '../../10_CONFIG/shared/types/workspace.js';

// ============================================================================
// HTTP HELPERS & PARSING
// ============================================================================

export function parseRawBody(req: http.IncomingMessage, options: BoundedBodyOptions = {}): Promise<string> {
  return readBoundedText(req, options);
}

export function parseBody(req: http.IncomingMessage, options: BoundedBodyOptions = {}): Promise<any> {
  return parseBoundedJson(req, options);
}

export function sendRemoteJSON(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  statusCode: number,
  payload: {
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string; details?: unknown };
    meta?: Record<string, unknown>;
  },
  requestId: string,
  rateLimitInfo?: { limit: number; remaining: number; resetSeconds: number }
): void {
  const origin = (req.headers.origin as string) || '';
  const existingOrigin = typeof res?.getHeader === 'function' ? res.getHeader('Access-Control-Allow-Origin') : undefined;
  let allowOrigin: string | undefined;
  if (existingOrigin) {
    allowOrigin = String(existingOrigin);
  } else if (origin && isTrustedOrigin(origin)) {
    allowOrigin = origin;
  }

  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, Idempotency-Key, X-Request-Id, X-Admin-Secret, x-mahi-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (rateLimitInfo) {
    headers['X-RateLimit-Limit'] = rateLimitInfo.limit;
    headers['X-RateLimit-Remaining'] = rateLimitInfo.remaining;
    headers['X-RateLimit-Reset'] = rateLimitInfo.resetSeconds;
  }

  res.writeHead(statusCode, headers);

  const formattedResponse: RemoteApiResponse = {
    success: payload.success,
    data: payload.data,
    meta: {
      requestId,
      ...payload.meta,
    },
  };

  if (payload.error) {
    formattedResponse.error = {
      code: payload.error.code,
      message: payload.error.message,
      requestId,
      details: payload.error.details,
    };
  }

  res.end(JSON.stringify(formattedResponse));
}

// ============================================================================
// AUTHENTICATION RESOLUTION
// ============================================================================

export async function resolveRemoteAuthAsync(req: http.IncomingMessage): Promise<RemoteAuthContext | null> {
  const remoteService = RemoteApiService.getInstance();

  // 1. Check X-API-Key header or Bearer mahi_live_...
  const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';

  let candidateApiKey = '';
  if (apiKeyHeader) {
    candidateApiKey = apiKeyHeader.trim();
  } else if (authHeader.startsWith('Bearer mahi_')) {
    candidateApiKey = authHeader.substring(7).trim();
  }

  if (candidateApiKey) {
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      const keyHash = crypto.createHash('sha256').update(candidateApiKey).digest('hex');
      const keyRecord = await repo.findRemoteApiKeyByHash(keyHash);
      if (!keyRecord || keyRecord.status !== 'ACTIVE') return null;
      if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) return null;

      const user = await repo.findAuthUserById(keyRecord.user_id);
      if (!user || user.status !== 'ACTIVE') return null;

      let scopes: RemoteApiScope[] = [];
      try {
        scopes = typeof keyRecord.scopes_json === 'string' ? JSON.parse(keyRecord.scopes_json) : (keyRecord.scopes_json || []);
      } catch {
        scopes = ['profiles:read'];
      }

      await repo.updateRemoteApiKeyLastUsed(keyRecord.id);

      return {
        authType: 'API_KEY',
        userId: user.id,
        email: user.email,
        userRole: user.role as any,
        apiKeyId: keyRecord.id,
        apiKeyPrefix: keyRecord.key_prefix,
        apiKeyScopes: scopes,
        workspaceId: keyRecord.workspace_id || undefined,
      };
    }

    const keyAuth = remoteService.authenticateApiKey(candidateApiKey);
    if (!keyAuth) return null;

    return {
      authType: 'API_KEY',
      userId: keyAuth.user.id,
      email: keyAuth.user.email,
      userRole: keyAuth.user.role as any,
      apiKeyId: keyAuth.keyRecord.id,
      apiKeyPrefix: keyAuth.keyRecord.keyPrefix,
      apiKeyScopes: keyAuth.keyRecord.scopes,
      workspaceId: keyAuth.keyRecord.workspaceId || undefined,
      workspaceRole: keyAuth.workspaceRole,
    };
  }

  // 2. Check Central Auth Bearer JWT
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyAccessToken(token);
    if (!payload) return null;

    const user = await getCentralUserByIdAsync(payload.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    const sessionCheck = await verifyPostgresOrSqliteUserAndSessionAsync(payload.userId, payload.sessionId);
    if (!sessionCheck.active) return null;

    return {
      authType: 'JWT',
      userId: user.id,
      email: user.email,
      userRole: user.role as any,
      sessionId: payload.sessionId,
    };
  }

  return null;
}

export function resolveRemoteAuth(req: http.IncomingMessage): RemoteAuthContext | null {
  const remoteService = RemoteApiService.getInstance();

  // 1. Check X-API-Key header or Bearer mahi_live_...
  const apiKeyHeader = (req.headers['x-api-key'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';

  let candidateApiKey = '';
  if (apiKeyHeader) {
    candidateApiKey = apiKeyHeader.trim();
  } else if (authHeader.startsWith('Bearer mahi_')) {
    candidateApiKey = authHeader.substring(7).trim();
  }

  if (candidateApiKey) {
    const keyAuth = remoteService.authenticateApiKey(candidateApiKey);
    if (!keyAuth) return null;

    return {
      authType: 'API_KEY',
      userId: keyAuth.user.id,
      email: keyAuth.user.email,
      userRole: keyAuth.user.role as any,
      apiKeyId: keyAuth.keyRecord.id,
      apiKeyPrefix: keyAuth.keyRecord.keyPrefix,
      apiKeyScopes: keyAuth.keyRecord.scopes,
      workspaceId: keyAuth.keyRecord.workspaceId || undefined,
      workspaceRole: keyAuth.workspaceRole,
    };
  }

  // 2. Check Central Auth Bearer JWT
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyAccessToken(token);
    if (!payload) return null;

    const user = getCentralUserById(payload.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    return {
      authType: 'JWT',
      userId: user.id,
      email: user.email,
      userRole: user.role as any,
      sessionId: payload.sessionId,
    };
  }

  return null;
}

// ============================================================================
// REMOTE API ROUTE DISPATCHER
// ============================================================================

export async function handleRemoteApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const urlStr = req.url || '/';
  const parsedUrl = new URL(urlStr, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();
  return handleRemoteApiRoutes(req, res, pathname, method, parsedUrl);
}

export async function handleRemoteApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Normalize path aliases: allow /v1/*, /api/v1/remote/*, /api/v1/webhooks/*, /api/v1/cloud-browser/*
  let normalizedPath = pathname;
  if (pathname.startsWith('/v1/')) {
    normalizedPath = `/api/v1/remote/${pathname.substring(4)}`;
  } else if (pathname.startsWith('/api/v1/webhooks')) {
    normalizedPath = `/api/v1/remote/webhooks${pathname.substring(16)}`;
  } else if (pathname.startsWith('/api/v1/cloud-browser')) {
    normalizedPath = `/api/v1/remote/cloud-browser${pathname.substring(21)}`;
  } else if (pathname.startsWith('/api/v1/billing')) {
    normalizedPath = `/api/v1/remote/billing${pathname.substring(15)}`;
  }

  if (!normalizedPath.startsWith('/api/v1/remote/')) {
    return false;
  }

  const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomUUID()}`;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    const origin = (req.headers.origin as string) || '';
    const corsHeaders: Record<string, string> = {
      'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, Idempotency-Key, X-Request-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
    if (origin) {
      if (!isTrustedOrigin(origin)) {
        res.writeHead(403, { Vary: 'Origin' });
        res.end();
        return true;
      }
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }
    res.writeHead(204, corsHeaders);
    res.end();
    return true;
  }

  // Public Endpoint: Commercial Plan Catalog (/api/v1/remote/billing/plans)
  if (normalizedPath === '/api/v1/remote/billing/plans' && method === 'GET') {
    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          plans: paymentService.getPlanCatalog(),
        },
      },
      requestId
    );
    return true;
  }

  // Public Endpoint: Cryptographic Payment Webhooks (/api/v1/remote/billing/webhook)
  if (
    (normalizedPath === '/api/v1/remote/billing/webhook' ||
      normalizedPath.startsWith('/api/v1/remote/billing/webhook/')) &&
    method === 'POST'
  ) {
    try {
      const rawBody = await parseRawBody(req);
      const signature = (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature'] ||
        req.headers['stripe-signature'] ||
        req.headers['x-razorpay-signature'] ||
        req.headers['x-simulation-signature'] ||
        req.headers['x-signature'] ||
        ''
      ) as string;

      let provider: any = 'simulation';
      if (req.headers['stripe-signature']) {
        provider = 'stripe';
      } else if (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature']
      ) {
        provider = 'youpi_pg';
      } else if (req.headers['x-razorpay-signature']) {
        provider = 'razorpay';
      } else if (parsedUrl.searchParams.get('provider')) {
        provider = parsedUrl.searchParams.get('provider');
      } else if (normalizedPath.endsWith('/youpi') || normalizedPath.endsWith('/youpi_pg')) {
        provider = 'youpi_pg';
      }

      const result = await paymentService.handleWebhook(provider, rawBody, signature);
      sendRemoteJSON(req, res, 200, { success: true, data: result }, requestId);
      return true;
    } catch (err: any) {
      const isSig = err.message && err.message.includes('INVALID_WEBHOOK_SIGNATURE');
      const isTamper = err.message && err.message.includes('AMOUNT_TAMPERING_DETECTED');
      const status = getErrorStatusCode(err, isSig || isTamper ? 400 : 500);
      sendRemoteJSON(
        req,
        res,
        status,
        {
          success: false,
          error: {
            code: isSig ? 'INVALID_SIGNATURE' : isTamper ? 'AMOUNT_TAMPERED' : 'WEBHOOK_FAILED',
            message: err.message || 'Webhook processing failed',
          },
        },
        requestId
      );
      return true;
    }
  }

  // Extract Authentication
  const auth = await resolveRemoteAuthAsync(req);
  if (!auth) {
    sendRemoteJSON(
      req,
      res,
      401,
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication credentials. Provide a valid X-API-Key or Bearer token.',
        },
      },
      requestId
    );
    return true;
  }

  // Rate Limiting
  const rateLimitKey = auth.apiKeyId ? `key:${auth.apiKeyId}` : `usr:${auth.userId}`;
  const rateLimit = await checkRateLimitAsync(rateLimitKey);
  if (!rateLimit.allowed) {
    RemoteApiService.getInstance().logAudit(
      auth.apiKeyId || 'jwt',
      auth.userId,
      'RATE_LIMITED',
      undefined,
      'Rate limit exceeded'
    );
    sendRemoteJSON(
      req,
      res,
      429,
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'API rate limit exceeded. Please wait before making further requests.',
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  // Idempotency check for mutations
  const idempotencyKey = (req.headers['idempotency-key'] as string) || '';
  if (idempotencyKey && (method === 'POST' || method === 'PUT')) {
    const cached = getCachedIdempotentResponse(idempotencyKey, auth.userId);
    if (cached) {
      sendRemoteJSON(req, res, cached.statusCode, cached.response as any, requestId, rateLimit);
      return true;
    }
  }

  const remoteService = RemoteApiService.getInstance();
  const webhookService = WebhookService.getInstance();
  const route = normalizedPath.substring('/api/v1/remote/'.length);

  // Helper for dual-gate scope + RBAC enforcement
  const requireAccess = (
    scope: RemoteApiScope,
    permission?: TeamPermission,
    workspaceId?: string
  ): boolean => {
    const access = remoteService.evaluateAccess(auth, scope, permission, workspaceId);
    if (!access.allowed) {
      sendRemoteJSON(
        req,
        res,
        403,
        {
          success: false,
          error: {
            code: access.code || 'FORBIDDEN',
            message: access.message || 'Access forbidden.',
          },
        },
        requestId,
        rateLimit
      );
      return false;
    }
    return true;
  };

  // Helper for plan-based feature entitlement enforcement
  const requireFeature = (capability: FeatureCapability): boolean => {
    const check = checkCapability(auth.userId, capability);
    if (!check.allowed) {
      sendRemoteJSON(
        req,
        res,
        403,
        {
          success: false,
          error: {
            code: 'FEATURE_NOT_INCLUDED',
            message: check.reason || `Feature "${capability}" is not included in current plan.`,
            details: {
              capability,
              requiredTier: check.requiredTier,
              planName: check.planName,
              featureName: check.featureName,
            },
          },
        },
        requestId,
        rateLimit
      );
      return false;
    }
    return true;
  };

  try {
    // ========================================================================
    // 1. API KEYS MANAGEMENT (/api/v1/remote/api-keys)
    // ========================================================================
    if (route === 'api-keys' && method === 'GET') {
      const workspaceId = parsedUrl.searchParams.get('workspaceId') || undefined;
      if (isPostgresConfigured()) {
        const repo = getCentralRepository();
        const rawKeys = await repo.listRemoteApiKeys(auth.userId);
        const filtered = workspaceId ? rawKeys.filter((k: any) => k.workspace_id === workspaceId) : rawKeys;
        const keys = filtered.map((k: any) => ({
          id: k.id,
          userId: k.user_id,
          workspaceId: k.workspace_id || null,
          name: k.name,
          keyPrefix: k.key_prefix,
          scopes: typeof k.scopes_json === 'string' ? JSON.parse(k.scopes_json) : (k.scopes_json || []),
          status: k.status,
          rateLimitPerMin: k.rate_limit_per_min,
          requestsCountMonth: k.requests_count_month,
          lastUsedAt: k.last_used_at || null,
          createdAt: k.created_at,
          expiresAt: k.expires_at || null,
        }));
        sendRemoteJSON(req, res, 200, { success: true, data: keys }, requestId, rateLimit);
        return true;
      }
      const keys = remoteService.listApiKeys(auth.userId, workspaceId);
      sendRemoteJSON(req, res, 200, { success: true, data: keys }, requestId, rateLimit);
      return true;
    }

    if (route === 'api-keys' && method === 'POST') {
      const body = await parseBody(req);
      if (isPostgresConfigured()) {
        const repo = getCentralRepository();
        const dto = body as CreateRemoteApiKeyDTO;
        const trimmedName = (dto.name || '').trim();
        if (!trimmedName) throw new Error('API key name is required');
        const entropy = crypto.randomBytes(24).toString('hex');
        const rawSecretKey = `mahi_live_${entropy}`;
        const keyPrefix = rawSecretKey.substring(0, 14);
        const keyHash = crypto.createHash('sha256').update(rawSecretKey).digest('hex');
        const id = `key_${crypto.randomUUID()}`;
        const now = new Date();
        let expiresAt: string | null = null;
        if (dto.expiresInDays && dto.expiresInDays > 0) {
          expiresAt = new Date(now.getTime() + dto.expiresInDays * 86400000).toISOString();
        }
        const scopes = dto.scopes && dto.scopes.length > 0 ? dto.scopes : ['profiles:read'];
        const rateLimitVal = dto.rateLimitPerMin && dto.rateLimitPerMin > 0 ? dto.rateLimitPerMin : 120;

        await repo.createRemoteApiKey({
          id,
          user_id: auth.userId,
          workspace_id: dto.workspaceId || null,
          name: trimmedName,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          scopes_json: JSON.stringify(scopes),
          status: 'ACTIVE',
          rate_limit_per_min: rateLimitVal,
          requests_count_month: 0,
          created_at: now.toISOString(),
          expires_at: expiresAt,
        });

        const responsePayload = {
          success: true,
          data: {
            apiKey: {
              id,
              userId: auth.userId,
              workspaceId: dto.workspaceId || null,
              name: trimmedName,
              keyPrefix,
              scopes,
              status: 'ACTIVE',
              rateLimitPerMin: rateLimitVal,
              requestsCountMonth: 0,
              createdAt: now.toISOString(),
              expiresAt,
            },
            secretKey: rawSecretKey,
            note: 'Save this secret key securely now. It will never be shown again.',
          },
        };
        if (idempotencyKey) {
          saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
        }
        sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
        return true;
      }
      const created = remoteService.createApiKey(auth.userId, body as CreateRemoteApiKeyDTO);
      const responsePayload = {
        success: true,
        data: {
          apiKey: created.keyRecord,
          secretKey: created.secretKey, // Returned ONLY once
          note: 'Save this secret key securely now. It will never be shown again.',
        },
      };
      if (idempotencyKey) {
        saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
      }
      sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
      return true;
    }

    const keyRevokeMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)$/);
    if (keyRevokeMatch && method === 'DELETE') {
      const keyId = keyRevokeMatch[1];
      if (isPostgresConfigured()) {
        const repo = getCentralRepository();
        const success = await repo.revokeRemoteApiKey(keyId, auth.userId);
        if (!success) {
          sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } }, requestId, rateLimit);
          return true;
        }
        sendRemoteJSON(req, res, 200, { success: true, data: { revoked: true, keyId } }, requestId, rateLimit);
        return true;
      }
      const success = remoteService.revokeApiKey(keyId, auth.userId);
      if (!success) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } }, requestId, rateLimit);
        return true;
      }
      sendRemoteJSON(req, res, 200, { success: true, data: { revoked: true, keyId } }, requestId, rateLimit);
      return true;
    }

    const keyRotateMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)\/rotate$/);
    if (keyRotateMatch && method === 'POST') {
      const keyId = keyRotateMatch[1];
      const rotated = remoteService.rotateApiKey(keyId, auth.userId);
      sendRemoteJSON(
        req,
        res,
        200,
        {
          success: true,
          data: {
            apiKey: rotated.keyRecord,
            newSecretKey: rotated.newSecretKey,
          },
        },
        requestId,
        rateLimit
      );
      return true;
    }

    const keyAuditMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)\/audits$/);
    if (keyAuditMatch && method === 'GET') {
      const keyId = keyAuditMatch[1];
      const audits = remoteService.getAuditLogs(keyId, auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: audits }, requestId, rateLimit);
      return true;
    }

    // ========================================================================
    // 2. REMOTE PROFILES (/api/v1/remote/profiles)
    // ========================================================================
    if (route === 'profiles' && method === 'GET') {
      if (!requireAccess('profiles:read')) return true;

      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 100);
      const folder = parsedUrl.searchParams.get('folder') || undefined;
      const status = parsedUrl.searchParams.get('status') || undefined;

      const allProfiles = getProfiles({
        ownerId: auth.userId,
        folder,
        status: status as any,
      });

      const total = allProfiles.length;
      const startIndex = (page - 1) * limit;
      const paged = allProfiles.slice(startIndex, startIndex + limit);

      // Sanitize: do not expose internal file paths or raw disk credentials
      const sanitized = paged.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        folder: p.folder,
        status: p.status,
        tags: p.tags,
        pinned: p.pinned,
        lastUsedAt: p.lastUsedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      sendRemoteJSON(
        req,
        res,
        200,
        {
          success: true,
          data: sanitized,
          meta: { page, limit, total, hasMore: startIndex + limit < total },
        },
        requestId,
        rateLimit
      );
      return true;
    }

    if (route === 'profiles' && method === 'POST') {
      if (!requireAccess('profiles:write')) return true;

      const limitCheck = canCreateProfile(auth.userId);
      if (!limitCheck.allowed) {
        sendRemoteJSON(
          req,
          res,
          403,
          { success: false, error: { code: 'PROFILE_LIMIT_REACHED', message: limitCheck.message || 'Profile limit reached for current plan.' } },
          requestId,
          rateLimit
        );
        return true;
      }

      const body = await parseBody(req);
      if (!body.name || typeof body.name !== 'string') {
        sendRemoteJSON(
          req,
          res,
          400,
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Profile name is required' } },
          requestId,
          rateLimit
        );
        return true;
      }

      const created = createProfile({
        name: body.name.trim(),
        description: body.description || '',
        folder: body.folder || 'General',
        notes: body.notes || '',
        ownerId: auth.userId,
        tags: body.tags || [],
      });

      // Dispatch webhook event
      webhookService.dispatchEvent('profile.created', { profileId: created.id, name: created.name }, {
        userId: auth.userId,
        actor: { userId: auth.userId, email: auth.email },
      });

      const responsePayload = {
        success: true,
        data: {
          id: created.id,
          name: created.name,
          folder: created.folder,
          status: created.status,
          createdAt: created.createdAt,
        },
      };

      if (idempotencyKey) {
        saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
      }

      sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
      return true;
    }

    const profileIdMatch = route.match(/^profiles\/([a-zA-Z0-9_-]+)$/);
    if (profileIdMatch && method === 'GET') {
      if (!requireAccess('profiles:read')) return true;

      const profile = getProfileById(profileIdMatch[1], auth.userId);
      // IDOR Isolation: must belong strictly to authenticated user
      if (!profile || profile.ownerId !== auth.userId) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
        return true;
      }

      sendRemoteJSON(
        req,
        res,
        200,
        {
          success: true,
          data: {
            id: profile.id,
            name: profile.name,
            description: profile.description,
            folder: profile.folder,
            status: profile.status,
            tags: profile.tags,
            pinned: profile.pinned,
            lastUsedAt: profile.lastUsedAt,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          },
        },
        requestId,
        rateLimit
      );
      return true;
    }

    if (profileIdMatch && method === 'PUT') {
      if (!requireAccess('profiles:write')) return true;

      const profile = getProfileById(profileIdMatch[1], auth.userId);
      if (!profile || profile.ownerId !== auth.userId) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
        return true;
      }

      const body = await parseBody(req);
      const updated = updateProfile(profile.id, {
        name: body.name,
        notes: body.notes,
        folder: body.folder,
      }, auth.userId);

      webhookService.dispatchEvent('profile.updated', { profileId: profile.id, name: updated.name }, {
        userId: auth.userId,
        actor: { userId: auth.userId, email: auth.email },
      });

      sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
      return true;
    }

    if (profileIdMatch && method === 'DELETE') {
      if (!requireAccess('profiles:delete')) return true;

      const profile = getProfileById(profileIdMatch[1], auth.userId);
      if (!profile || profile.ownerId !== auth.userId) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
        return true;
      }

      deleteProfile(profile.id, auth.userId);

      webhookService.dispatchEvent('profile.deleted', { profileId: profile.id }, {
        userId: auth.userId,
        actor: { userId: auth.userId, email: auth.email },
      });

      sendRemoteJSON(req, res, 200, { success: true, data: { deleted: true, profileId: profile.id } }, requestId, rateLimit);
      return true;
    }

    // Honest Profile Run Model: Remote Profile Launch
    const profileLaunchMatch = route.match(/^profiles\/([a-zA-Z0-9_-]+)\/launch$/);
    if (profileLaunchMatch && method === 'POST') {
      if (!requireAccess('profiles:run')) return true;

      const profileId = profileLaunchMatch[1];
      const profile = getProfileById(profileId, auth.userId);
      if (!profile || profile.ownerId !== auth.userId) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
        return true;
      }

      // Check registered online desktop devices
      const devices = getUserDevices(auth.userId).filter((d) => d.status === 'ACTIVE');
      if (devices.length === 0) {
        sendRemoteJSON(
          req,
          res,
          409,
          {
            success: false,
            error: {
              code: 'DEVICE_REQUIRED',
              message:
                'Remote profile launch requires an active, registered desktop client device. No online desktop agent was detected for this account.',
            },
            data: {
              launched: false,
              profileId,
              status: 'DEVICE_REQUIRED',
              suggestedAction: 'Please launch MAHI Browser on your desktop and sign into your account.',
            },
          },
          requestId,
          rateLimit
        );
        return true;
      }

      // Queue command for active desktop device
      const primaryDevice = devices[0];
      sendRemoteJSON(
        req,
        res,
        202,
        {
          success: true,
          data: {
            launched: false,
            profileId,
            status: 'QUEUED',
            deviceId: primaryDevice.deviceId,
            deviceName: primaryDevice.deviceName,
            message: `Launch command queued for connected desktop device "${primaryDevice.deviceName}".`,
          },
        },
        requestId,
        rateLimit
      );
      return true;
    }

    // ========================================================================
    // 3. REMOTE WORKSPACES (/api/v1/remote/workspaces)
    // ========================================================================
    if (route === 'workspaces' && method === 'GET') {
      if (!requireAccess('workspace:read')) return true;

      const workspaces = listUserTeamWorkspaces(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: workspaces }, requestId, rateLimit);
      return true;
    }

    if (route === 'workspaces' && method === 'POST') {
      if (!requireAccess('workspace:manage')) return true;
      if (!requireFeature('workspace.team')) return true;

      const body = await parseBody(req);
      if (!body.name) {
        sendRemoteJSON(req, res, 400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Workspace name is required' } }, requestId, rateLimit);
        return true;
      }

      const created = createTeamWorkspace(auth.userId, {
        name: body.name,
        description: body.description,
      });

      sendRemoteJSON(req, res, 201, { success: true, data: created }, requestId, rateLimit);
      return true;
    }

    const wsMembersMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members$/);
    if (wsMembersMatch && method === 'GET') {
      const wsId = wsMembersMatch[1];
      if (!requireAccess('workspace:read', 'WORKSPACE_VIEW', wsId)) return true;

      const members = getWorkspaceMembers(auth.userId, wsId);
      sendRemoteJSON(req, res, 200, { success: true, data: members }, requestId, rateLimit);
      return true;
    }

    const wsInviteMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
    if (wsInviteMatch && method === 'POST') {
      const wsId = wsInviteMatch[1];
      if (!requireAccess('workspace:manage', 'MEMBER_INVITE', wsId)) return true;

      const body = await parseBody(req);
      if (!body.email) {
        sendRemoteJSON(req, res, 400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invitee email is required' } }, requestId, rateLimit);
        return true;
      }

      const invitation = await inviteWorkspaceMember(
        auth.userId,
        wsId,
        body.email,
        body.role || 'MEMBER'
      );

      webhookService.dispatchEvent('workspace.member.invited', { workspaceId: wsId, email: body.email }, {
        userId: auth.userId,
        workspaceId: wsId,
      });

      sendRemoteJSON(req, res, 201, { success: true, data: invitation }, requestId, rateLimit);
      return true;
    }

    const wsMemberRoleMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
    if (wsMemberRoleMatch && method === 'PUT') {
      const wsId = wsMemberRoleMatch[1];
      const targetUserId = wsMemberRoleMatch[2];
      if (!requireAccess('workspace:manage', 'MEMBER_ROLE_CHANGE', wsId)) return true;

      const body = await parseBody(req);
      const updated = updateMemberRole(auth.userId, wsId, targetUserId, body.role);
      sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
      return true;
    }

    const wsMemberRemoveMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
    if (wsMemberRemoveMatch && method === 'DELETE') {
      const wsId = wsMemberRemoveMatch[1];
      const targetUserId = wsMemberRemoveMatch[2];
      if (!requireAccess('workspace:manage', 'MEMBER_REMOVE', wsId)) return true;

      const removed = removeWorkspaceMember(auth.userId, wsId, targetUserId);
      webhookService.dispatchEvent('workspace.member.removed', { workspaceId: wsId, targetUserId }, {
        userId: auth.userId,
        workspaceId: wsId,
      });
      sendRemoteJSON(req, res, 200, { success: true, data: { removed, targetUserId } }, requestId, rateLimit);
      return true;
    }

    const wsProfilesMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
    if (wsProfilesMatch && method === 'GET') {
      const wsId = wsProfilesMatch[1];
      if (!requireAccess('workspace:read', 'WORKSPACE_VIEW', wsId)) return true;

      const sharedProfiles = listWorkspaceProfiles(auth.userId, wsId);
      sendRemoteJSON(req, res, 200, { success: true, data: sharedProfiles }, requestId, rateLimit);
      return true;
    }

    const wsShareMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
    if (wsShareMatch && method === 'POST') {
      const wsId = wsShareMatch[1];
      if (!requireAccess('workspace:manage', 'PROFILE_SHARE', wsId)) return true;

      const body = await parseBody(req);
      const shareRecord = shareProfileToWorkspace(auth.userId, wsId, {
        cloudProfileId: body.profileId || body.cloudProfileId,
        permissionLevel: body.permissionLevel || 'RUN',
        encryptedKeyEnvelope: body.encryptedKeyEnvelope,
      });
      sendRemoteJSON(req, res, 201, { success: true, data: shareRecord }, requestId, rateLimit);
      return true;
    }

    // ========================================================================
    // 4. REMOTE PROXIES (/api/v1/remote/proxies)
    // ========================================================================
    if (route === 'proxies/catalog' && method === 'GET') {
      if (!requireAccess('proxy:read')) return true;

      const proxyService = ProxyProviderService.getInstance();
      const catalog = proxyService.getCatalog({
        networkType: (parsedUrl.searchParams.get('networkType') as any) || undefined,
        country: parsedUrl.searchParams.get('country') || undefined,
      });

      sendRemoteJSON(req, res, 200, { success: true, data: catalog }, requestId, rateLimit);
      return true;
    }

    if (route === 'proxies/generate' && method === 'POST') {
      if (!requireAccess('proxy:create')) return true;

      const body = await parseBody(req);
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

      const body = await parseBody(req);
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

      const body = await parseBody(req);
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
      const params: any[] = [];
      if (workflowIdFilter) {
        runsQuery += ' AND workflow_id = ?';
        params.push(workflowIdFilter);
      }
      runsQuery += ' ORDER BY started_at DESC LIMIT 50';

      const rows = db.prepare(runsQuery).all(...params) as any[];
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

      const body = await parseBody(req);
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
      // Clean secret fields from output
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

      const body = await parseBody(req);
      const allowHttp = Boolean(body.allowHttp); // for testing
      const { endpoint, secret } = webhookService.createEndpoint(
        auth.userId,
        body as CreateWebhookEndpointDTO,
        { allowHttp }
      );

      const responsePayload = {
        success: true,
        data: {
          id: endpoint.id,
          url: endpoint.url,
          events: endpoint.events,
          status: endpoint.status,
          secret, // Returned ONLY once
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

      const body = await parseBody(req).catch(() => ({}));
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

    // ========================================================================
    // PHASE 10: REAL CLOUD BROWSER ENDPOINTS
    // ========================================================================

    // POST cloud-browser/sessions (Start cloud session)
    if (route === 'cloud-browser/sessions' && method === 'POST') {
      if (!requireAccess('profiles:run')) return true;
      if (!requireFeature('cloud.browser')) return true;

      const body = await parseBody(req);
      if (!body.profileId) {
        sendRemoteJSON(req, res, 400, {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'profileId is required.' },
        }, requestId, rateLimit);
        return true;
      }

      try {
        const sessionResult = await cloudBrowserControlPlane.requestSession(auth.userId, {
          profileId: body.profileId,
          workspaceId: auth.workspaceId || body.workspaceId,
          regionId: body.regionId,
          resourceClass: body.resourceClass,
          maxDurationSeconds: body.maxDurationSeconds,
          idleTimeoutSeconds: body.idleTimeoutSeconds,
          startupUrl: body.startupUrl,
        });

        sendRemoteJSON(req, res, 201, { success: true, data: sessionResult }, requestId, rateLimit);
      } catch (err: any) {
        const isQuota = err.message.includes('QUOTA_EXCEEDED');
        const isLocked = err.message.includes('PROFILE_LOCKED');
        const isAccess = err.message.includes('ACCESS_DENIED');
        const statusCode = isQuota ? 403 : isLocked ? 409 : isAccess ? 403 : 500;
        sendRemoteJSON(req, res, statusCode, {
          success: false,
          error: { code: isLocked ? 'PROFILE_LOCKED' : isQuota ? 'QUOTA_EXCEEDED' : 'LAUNCH_FAILED', message: err.message },
        }, requestId, rateLimit);
      }
      return true;
    }

    // GET cloud-browser/sessions (List sessions)
    if (route === 'cloud-browser/sessions' && method === 'GET') {
      if (!requireAccess('profiles:read')) return true;

      const sessions = cloudBrowserControlPlane.listSessions(auth.userId, auth.workspaceId);
      sendRemoteJSON(req, res, 200, { success: true, data: sessions }, requestId, rateLimit);
      return true;
    }

    // GET cloud-browser/regions (List deployment regions)
    if (route === 'cloud-browser/regions' && method === 'GET') {
      const regions = sessionScheduler.getRegions();
      sendRemoteJSON(req, res, 200, { success: true, data: regions }, requestId, rateLimit);
      return true;
    }

    // GET cloud-browser/usage (User usage summary)
    if (route === 'cloud-browser/usage' && method === 'GET') {
      const usage = resourceLimiter.getUserUsageSummary(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: usage }, requestId, rateLimit);
      return true;
    }

    // GET cloud-browser/sessions/:id (Get session)
    const cbGetMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)$/);
    if (cbGetMatch && method === 'GET') {
      if (!requireAccess('profiles:read')) return true;

      const session = cloudBrowserControlPlane.getSession(cbGetMatch[1]);
      if (!session || (session.userId !== auth.userId && (!auth.workspaceId || session.workspaceId !== auth.workspaceId))) {
        sendRemoteJSON(req, res, 404, {
          success: false,
          error: { code: 'NOT_FOUND', message: `Cloud session ${cbGetMatch[1]} not found.` },
        }, requestId, rateLimit);
        return true;
      }

      sendRemoteJSON(req, res, 200, { success: true, data: session }, requestId, rateLimit);
      return true;
    }

    // POST cloud-browser/sessions/:id/stop (Stop session)
    const cbStopMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/stop$/);
    if (cbStopMatch && method === 'POST') {
      if (!requireAccess('profiles:run')) return true;

      try {
        const body = await parseBody(req).catch(() => ({}));
        const stopResult = await cloudBrowserControlPlane.stopSession(cbStopMatch[1], auth.userId, body.reason || 'USER_REQUESTED');
        sendRemoteJSON(req, res, 200, { success: true, data: stopResult }, requestId, rateLimit);
      } catch (err: any) {
        sendRemoteJSON(req, res, 400, {
          success: false,
          error: { code: 'STOP_FAILED', message: err.message },
        }, requestId, rateLimit);
      }
      return true;
    }

    // POST cloud-browser/sessions/:id/reconnect-token (Generate reconnect token)
    const cbReconnectMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/reconnect-token$/);
    if (cbReconnectMatch && method === 'POST') {
      if (!requireAccess('profiles:run')) return true;

      try {
        const token = cloudBrowserControlPlane.generateReconnectToken(cbReconnectMatch[1], auth.userId);
        sendRemoteJSON(req, res, 200, {
          success: true,
          data: {
            sessionId: cbReconnectMatch[1],
            streamToken: token,
            streamGatewayUrl: `/api/v1/remote/cloud-browser/sessions/${cbReconnectMatch[1]}/stream`,
          },
        }, requestId, rateLimit);
      } catch (err: any) {
        sendRemoteJSON(req, res, 400, {
          success: false,
          error: { code: 'RECONNECT_FAILED', message: err.message },
        }, requestId, rateLimit);
      }
      return true;
    }

    // GET cloud-browser/sessions/:id/stream (Live Screencast Stream via Server-Sent Events)
    const cbStreamMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/stream$/);
    if (cbStreamMatch && method === 'GET') {
      const sessionId = cbStreamMatch[1];
      const token = parsedUrl.searchParams.get('token');

      // Verify token authenticity
      const authorized = token
        ? sessionGateway.verifyStreamToken(token, sessionId, auth.userId)
        : auth.userId && requireAccess('profiles:run');

      if (!authorized) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED_STREAM', message: 'Invalid or expired stream token.' } }));
        return true;
      }

      // Establish SSE stream
      const sseOrigin = (req.headers.origin as string) || '';
      const sseHeaders: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Vary': 'Origin',
      };
      if (sseOrigin && isTrustedOrigin(sseOrigin)) {
        sseHeaders['Access-Control-Allow-Origin'] = sseOrigin;
        sseHeaders['Access-Control-Allow-Credentials'] = 'true';
      }
      res.writeHead(200, sseHeaders);

      res.write(': stream-connected\n\n');

      const subscriberId = crypto.randomUUID();
      let unsubscribe: (() => void) | undefined;

      try {
        unsubscribe = sessionGateway.subscribeClient({
          id: subscriberId,
          userId: auth.userId,
          sessionId,
          send: (msg) => {
            try {
              res.write(`data: ${JSON.stringify(msg)}\n\n`);
            } catch {}
          },
          close: () => {
            try {
              res.end();
            } catch {}
          },
        });
      } catch (subErr: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: subErr.message })}\n\n`);
        res.end();
        return true;
      }

      req.on('close', () => {
        if (unsubscribe) unsubscribe();
      });

      return true;
    }

    // POST cloud-browser/sessions/:id/input (Interactive input action)
    const cbInputMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/input$/);
    if (cbInputMatch && method === 'POST') {
      const sessionId = cbInputMatch[1];
      const token = parsedUrl.searchParams.get('token') || (req.headers['x-stream-token'] as string);

      const authorized = token
        ? sessionGateway.verifyStreamToken(token, sessionId, auth.userId)
        : auth.userId && requireAccess('profiles:run');

      if (!authorized) {
        sendRemoteJSON(req, res, 403, {
          success: false,
          error: { code: 'UNAUTHORIZED_INPUT', message: 'Valid stream token required for input dispatch.' },
        }, requestId, rateLimit);
        return true;
      }

      const body = await parseBody(req);
      if (!body.action || !body.action.type) {
        sendRemoteJSON(req, res, 400, {
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Action object with type is required.' },
        }, requestId, rateLimit);
        return true;
      }

      sessionGateway.dispatchAction(sessionId, body.action);
      resourceLimiter.touchActivity(sessionId);

      sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
      return true;
    }

    // ========================================================================
    // PHASE 11: ANDROID MOBILE COMPANION ENDPOINTS
    // ========================================================================

    // POST mobile/device-token (Register or update device push token)
    if (route === 'mobile/device-token' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.deviceId || !body.pushToken) {
        sendRemoteJSON(req, res, 400, {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'deviceId and pushToken are required.' },
        }, requestId, rateLimit);
        return true;
      }

      const record = mobileCompanionService.registerDeviceToken(auth.userId, {
        deviceId: body.deviceId,
        pushToken: body.pushToken,
        deviceModel: body.deviceModel,
        osVersion: body.osVersion,
        appVersion: body.appVersion,
      });

      sendRemoteJSON(req, res, 200, { success: true, data: record }, requestId, rateLimit);
      return true;
    }

    // DELETE mobile/device-token/:deviceId (Revoke device push token)
    const dtDeleteMatch = route.match(/^mobile\/device-token\/([a-zA-Z0-9_-]+)$/);
    if (dtDeleteMatch && method === 'DELETE') {
      mobileCompanionService.revokeDeviceToken(auth.userId, dtDeleteMatch[1]);
      sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
      return true;
    }

    // GET mobile/notifications (List user notifications)
    if (route === 'mobile/notifications' && method === 'GET') {
      const unreadOnly = parsedUrl.searchParams.get('unread') === 'true';
      const notifications = mobileCompanionService.getUserNotifications(auth.userId, 50, unreadOnly);
      sendRemoteJSON(req, res, 200, { success: true, data: notifications }, requestId, rateLimit);
      return true;
    }

    // PUT mobile/notifications/:id/read (Mark notification read)
    const notifReadMatch = route.match(/^mobile\/notifications\/([a-zA-Z0-9_-]+)\/read$/);
    if (notifReadMatch && method === 'PUT') {
      mobileCompanionService.markNotificationRead(auth.userId, notifReadMatch[1]);
      sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
      return true;
    }

    // GET mobile/notifications/preferences (Get user notification preferences)
    if (route === 'mobile/notifications/preferences' && method === 'GET') {
      const prefs = mobileCompanionService.getNotificationPreferences(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: prefs }, requestId, rateLimit);
      return true;
    }

    // PUT mobile/notifications/preferences (Update notification preferences)
    if (route === 'mobile/notifications/preferences' && method === 'PUT') {
      const body = await parseBody(req);
      const updated = mobileCompanionService.updateNotificationPreferences(auth.userId, body);
      sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
      return true;
    }

    // ========================================================================
    // 12. COMMERCIAL BILLING & SUBSCRIPTIONS (/api/v1/remote/billing/*)
    // ========================================================================
    // POST billing/checkout (Create checkout session)
    if (route === 'billing/checkout' && method === 'POST') {
      if (await rejectIfEmergencyFrozen(res, 'remote_billing_checkout')) return true;
      const body = await parseBody(req);
      const session = await paymentService.createCheckoutSession(
        {
          userId: auth.userId,
          planId: body.planId,
          billingCycle: body.billingCycle || 'MONTHLY',
          successUrl: body.successUrl,
          cancelUrl: body.cancelUrl,
          idempotencyKey: idempotencyKey || body.idempotencyKey,
        },
        body.provider
      );

      const responsePayload = { success: true, data: session };
      if (idempotencyKey) {
        saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
      }
      sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
      return true;
    }

    // GET billing/subscription (Get current user active subscription)
    if (route === 'billing/subscription' && method === 'GET') {
      const sub = paymentService.getUserSubscription(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: { subscription: sub } }, requestId, rateLimit);
      return true;
    }

    // GET billing/invoices (List user billing invoices with IDOR protection)
    if (route === 'billing/invoices' && method === 'GET') {
      const invoices = paymentService.getUserInvoices(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: { invoices } }, requestId, rateLimit);
      return true;
    }

    // POST billing/cancel (Cancel active user subscription)
    if (route === 'billing/cancel' && method === 'POST') {
      const cancelled = paymentService.cancelSubscription(auth.userId);
      sendRemoteJSON(req, res, 200, { success: true, data: { cancelled } }, requestId, rateLimit);
      return true;
    }

    // Default 404 for unhandled remote route
    sendRemoteJSON(
      req,
      res,
      404,
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Remote endpoint ${method} /api/v1/remote/${route} not found.`,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  } catch (err: any) {
    const status = getErrorStatusCode(err, 500);
    sendRemoteJSON(
      req,
      res,
      status,
      {
        success: false,
        error: {
          code: err?.code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected server error occurred.',
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }
}
