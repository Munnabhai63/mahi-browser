import type http from 'node:http';
import type { URL } from 'node:url';
import { handleAuthCredentialRoutes } from './auth-credentials-routes.js';
import { handleAuthOAuthAndHandoffRoutes } from './auth-oauth-handoff-routes.js';
import { handleAuthSessionAndProfileRoutes } from './auth-session-profile-routes.js';

export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (await handleAuthCredentialRoutes(req, res, method, routePath, clientIp)) {
    return true;
  }
  if (await handleAuthOAuthAndHandoffRoutes(req, res, method, parsedUrl, routePath, clientIp)) {
    return true;
  }
  if (await handleAuthSessionAndProfileRoutes(req, res, method, routePath, clientIp)) {
    return true;
  }
  return false;
}
