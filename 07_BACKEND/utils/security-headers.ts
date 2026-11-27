import type http from 'node:http';
import type { FastifyReply } from 'fastify';

export const API_SECURITY_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export const ADMIN_HTML_CSP =
  "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; upgrade-insecure-requests;";

export const PORTAL_HTML_CSP =
  "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'self'; upgrade-insecure-requests;";

export const PERMISSIONS_POLICY_HEADER =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

export const COOP_HEADER = 'same-origin';

export function buildHtmlSecurityHeaders(html: string): Record<string, string> {
  const usesExternalPortalAssets =
    html.includes('cdn.tailwindcss.com') || html.includes('fonts.googleapis.com');

  return {
    'Content-Security-Policy': usesExternalPortalAssets ? PORTAL_HTML_CSP : ADMIN_HTML_CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
    'Cross-Origin-Opener-Policy': COOP_HEADER,
    'Cache-Control': 'no-store, max-age=0',
  };
}

export function applyFastifySecurityHeaders(reply: FastifyReply, urlPath: string): void {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '0');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', PERMISSIONS_POLICY_HEADER);
  reply.header('Cross-Origin-Opener-Policy', COOP_HEADER);
  reply.header('X-Gateway-Engine', 'Fastify-Node22');

  const contentType = String(reply.getHeader('content-type') || '').toLowerCase();
  if (!reply.hasHeader('content-security-policy')) {
    if (contentType.includes('text/html')) {
      reply.header('Content-Security-Policy', ADMIN_HTML_CSP);
    } else {
      reply.header('Content-Security-Policy', API_SECURITY_CSP);
    }
  }

  const isCacheableStatic =
    urlPath.startsWith('/download') ||
    urlPath.startsWith('/releases') ||
    contentType.startsWith('image/');
  if (!isCacheableStatic && !reply.hasHeader('cache-control')) {
    reply.header('Cache-Control', 'no-store, max-age=0');
  }
}

export function applyNodeSecurityHeaders(res: http.ServerResponse, urlPath: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY_HEADER);
  res.setHeader('Cross-Origin-Opener-Policy', COOP_HEADER);
  res.setHeader('X-Gateway-Engine', 'Fastify-Node22');

  const isApiPath =
    urlPath.startsWith('/api/') ||
    urlPath.startsWith('/v1/') ||
    urlPath.startsWith('/v2/') ||
    urlPath.startsWith('/me/') ||
    urlPath.startsWith('/health');

  if (isApiPath && !res.hasHeader('Content-Security-Policy')) {
    res.setHeader('Content-Security-Policy', API_SECURITY_CSP);
  }
  const isCacheableStatic =
    urlPath.startsWith('/download') || urlPath.startsWith('/releases');
  if (!isCacheableStatic && !res.hasHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  }
}
