import http from 'node:http';
import { verifyAccessToken, getCentralUserById, JWTPayload, AuthUser } from './central-auth-service.js';

export interface AuthenticatedRequest extends http.IncomingMessage {
  user?: AuthUser & { sessionId: string };
  jwtPayload?: JWTPayload;
}

export function extractBearerToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}

/**
 * Validates the JWT access token and resolves the active user.
 * Returns the resolved user or null if unauthorized.
 */
export function authenticateRequest(req: http.IncomingMessage): (AuthUser & { sessionId: string }) | null {
  const token = extractBearerToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = getCentralUserById(payload.userId);
  if (!user) return null;

  if (user.status === 'SUSPENDED' || user.status === 'DISABLED') {
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
