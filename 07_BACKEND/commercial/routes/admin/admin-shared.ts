import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { sendJSON, checkAdminAuthAsync, resolveTrustedClientIp } from '../router-shared.js';
import { CommercialRole } from '../../../../10_CONFIG/shared/types/commercial.js';
import { isOwnerConfigured, isOwnerSessionAsync } from '../../../services/owner-totp-service.js';
import { getDatabase } from '../../../../06_DATABASE/connection.js';
import { isPostgresConfigured } from '../../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../../06_DATABASE/prisma-client.js';
import { getCentralUserByIdAsync, getCentralUserByEmailAsync } from '../../../../05_AUTH/central-auth-service.js';
import { getUserById, getUserByEmail } from '../../commercial-auth-service.js';
import { createLogger } from '../../../utils/logger.js';
const log = createLogger('admin-shared');

export interface AdminRouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  pathname: string;
  method: string;
  parsedUrl: URL;
  routePath: string;
  clientIp: string;
}

export type AdminActor = { id: string; name: string; role: CommercialRole };

export const MIRROR_MISSING_COMMERCIAL_MSG =
  'This account exists only in the central auth registry (mirror-missing). A commercial record is required before plan/quota/override/device changes. Ask the user to sign in once to create it, then retry.';

/** Verifies admin privileges and writes uniform 403/404 responses on failure. */
export async function requireAdminAccess(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body?: any,
  options?: { hideUnauthenticated?: boolean; forbiddenMessage?: string }
): Promise<{ ok: true; actor: AdminActor } | { ok: false }> {
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

/** Sends standardized 409 error when a central user lacks a commercial record. */
export function sendMirrorMissingResponse(res: http.ServerResponse, message?: string): boolean {
  sendJSON(res, 409, {
    success: false,
    error: 'mirror_missing_commercial_record',
    message: message || MIRROR_MISSING_COMMERCIAL_MSG,
  });
  return true;
}

/** Extracts the URL-decoded `owner_session` cookie token from request headers. */
export function getOwnerSessionCookie(req: http.IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)owner_session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Validates owner configuration and active TOTP session cookie. */
export async function requireOwnerSession(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  if (!isOwnerConfigured()) {
    sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
    return false;
  }
  const cookieToken = getOwnerSessionCookie(req);
  if (!cookieToken || !(await isOwnerSessionAsync(cookieToken))) {
    sendJSON(res, 403, { success: false, error: 'Owner session required. Please verify TOTP.' });
    return false;
  }
  return true;
}

/** Persists a best-effort audit record for Owner console mutations. */
export async function recordOwnerActionAudit(params: {
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
      log.warn('[OwnerService] Postgres audit log write failed (warn-only):', err?.message);
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
    log.warn('[OwnerService] SQLite audit log write failed (warn-only):', err?.message);
  }
}

/** Resolves a user by ID or email across central auth and commercial records. */
export async function resolveTargetUser(rawIdOrEmail: string): Promise<any | null> {
  if (!rawIdOrEmail) return null;
  let clean = String(rawIdOrEmail).trim();
  if (clean.startsWith('central:')) {
    clean = clean.slice('central:'.length).trim();
  }
  try {
    const byId = await getCentralUserByIdAsync(clean);
    if (byId) return byId;
  } catch (err) {
    log.debug('Central user lookup by ID failed in admin resolver', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const byEmail = await getCentralUserByEmailAsync(clean);
    if (byEmail) return byEmail;
  } catch (err) {
    log.debug('Central user lookup by email failed in admin resolver', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const comm = getUserById(clean) || getUserByEmail(clean);
    if (comm) return comm;
  } catch (err) {
    log.debug('SQLite commercial user lookup failed in admin resolver', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

/** Validates userId input and resolves the target user with standard HTTP errors. */
export async function resolveOwnerTargetOrRespond(
  res: http.ServerResponse,
  rawUserId: unknown,
  opLabel: string
): Promise<{ ok: true; user: any; userId: string } | { ok: false }> {
  const rawTarget = rawUserId ? String(rawUserId).trim() : '';
  if (!rawTarget) {
    sendJSON(res, 400, { success: false, error: 'userId is required' });
    return { ok: false };
  }

  let targetUser: any = null;
  try {
    targetUser = await resolveTargetUser(rawTarget);
  } catch (err: any) {
    log.error(`[OwnerService][CRITICAL] User lookup error for ${opLabel}:`, err?.message || err);
    sendJSON(res, 500, { success: false, error: 'Database error looking up user' });
    return { ok: false };
  }
  if (!targetUser) {
    sendJSON(res, 404, { success: false, error: 'User not found' });
    return { ok: false };
  }
  return { ok: true, user: targetUser, userId: targetUser.id };
}

export { resolveTrustedClientIp };
