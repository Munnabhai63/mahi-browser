import type http from 'node:http';
import { verifyAccessToken, getCentralUserById, type JWTPayload, type AuthUser } from './central-auth-service.js';
import { verifySqliteUserAndSession } from '../07_BACKEND/commercial/routes/router-shared.js';

export interface AuthenticatedRequest extends http.IncomingMessage {
  user?: AuthUser & { sessionId: string };
  jwtPayload?: JWTPayload;
}

export function extractBearerToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}

/**
 * Validates the JWT access token and resolves the active user + session status.
 * Returns the resolved user or null if unauthorized, banned/suspended, or session revoked.
 */
export function authenticateRequest(req: http.IncomingMessage): (AuthUser & { sessionId: string }) | null {
  const token = extractBearerToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = getCentralUserById(payload.userId);
  if (!user) return null;

  const status = String(user.status || '').toUpperCase();
  if (status === 'BANNED' || status === 'SUSPENDED' || status === 'DISABLED') {
    return null;
  }

  const sessionCheck = verifySqliteUserAndSession(payload.userId, payload.sessionId);
  if (!sessionCheck.active) {
    return null;
  }

  const authenticated = {
    ...user,
    sessionId: payload.sessionId,
  };

  (req as AuthenticatedRequest).user = authenticated;
  (req as AuthenticatedRequest).jwtPayload = payload;

  return authenticated;
}
