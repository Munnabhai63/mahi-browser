import type http from 'node:http';
import type { URL } from 'node:url';
import type { AdminRouteContext } from './admin/admin-shared.js';
import { handleAdminUserManagementRoutes } from './admin/admin-users-routes.js';
import { handleAdminPaymentRoutes } from './admin/admin-payments-routes.js';
import { handleOwnerConsoleRoutes } from './admin/owner-console-routes.js';

/** Coordinates admin user/fleet, billing/license, and Owner console route modules. */
export async function handleAdminOwnerRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  const ctx: AdminRouteContext = { req, res, pathname, method, parsedUrl, routePath, clientIp };
  if (await handleAdminUserManagementRoutes(ctx)) return true;
  if (await handleAdminPaymentRoutes(ctx)) return true;
  if (await handleOwnerConsoleRoutes(ctx)) return true;
  return false;
}
