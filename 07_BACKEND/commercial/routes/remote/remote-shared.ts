import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { RemoteApiService } from '../../../services/remote-api-service.js';
import { WebhookService } from '../../../services/webhook-service.js';
import { verifyAccessToken, getCentralUserById, getCentralUserByIdAsync } from '../../../../05_AUTH/central-auth-service.js';
import { verifyPostgresOrSqliteUserAndSessionAsync } from '../router-shared.js';
import { isPostgresConfigured, getCentralRepository } from '../../../../06_DATABASE/central-repository.js';
import {
  readBoundedText,
  parseBoundedJson,
  BoundedBodyOptions,
  isTrustedOrigin,
} from '../../../utils/http-security.js';
import { checkCapability } from '../../commercial-entitlement-service.js';
import { FeatureCapability } from '../../../../10_CONFIG/shared/types/commercial.js';
import {
  RemoteAuthContext,
  RemoteApiScope,
  RemoteApiResponse,
} from '../../../../10_CONFIG/shared/types/remote-api.js';
import { TeamPermission } from '../../../../10_CONFIG/shared/types/workspace.js';

export interface RemoteRateLimitInfo {
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RemoteRouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  method: string;
  parsedUrl: URL;
  requestId: string;
  rateLimit: RemoteRateLimitInfo;
  auth: RemoteAuthContext;
  route: string;
  idempotencyKey: string;
  remoteService: RemoteApiService;
  webhookService: WebhookService;
  requireAccess: (scope: RemoteApiScope, permission?: TeamPermission, workspaceId?: string) => boolean;
  requireFeature: (capability: FeatureCapability) => boolean;
}

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
  rateLimitInfo?: RemoteRateLimitInfo
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

export async function resolveRemoteAuthAsync(req: http.IncomingMessage): Promise<RemoteAuthContext | null> {
  const remoteService = RemoteApiService.getInstance();
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

/** Handles CORS preflight checks using `isTrustedOrigin`. */
export function handleRemoteCorsPreflight(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
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

/** Builds dual-gate scope/RBAC and feature-entitlement enforcement helpers. */
export function makeAccessGuards(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  auth: RemoteAuthContext,
  requestId: string,
  rateLimit: RemoteRateLimitInfo,
  remoteService: RemoteApiService
): Pick<RemoteRouteContext, 'requireAccess' | 'requireFeature'> {
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

  return { requireAccess, requireFeature };
}
