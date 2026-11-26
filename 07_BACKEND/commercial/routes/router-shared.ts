import http from 'node:http';
import crypto from 'node:crypto';
import { isTrustedOrigin } from '../../server/cloud-gateway.js';
import { verifyAccessToken } from '../../../05_AUTH/central-auth-service.js';
import { verifyToken } from '../commercial-auth-service.js';
import { verifyAdminAccess } from '../../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret } from '../../../08_SECURITY/install-secrets.js';
import { CommercialRole } from '../../../10_CONFIG/shared/types/commercial.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import {
  resolveTrustedClientIp,
  normalizeIp,
  readBoundedBuffer,
  parseBoundedJson,
  BoundedBodyOptions,
} from '../../utils/http-security.js';

export { resolveTrustedClientIp };

export function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const existingOrigin = typeof res?.getHeader === 'function' ? res.getHeader('Access-Control-Allow-Origin') : undefined;
  if (!existingOrigin && typeof res?.setHeader === 'function') {
    const req = (res as any).__req as http.IncomingMessage | undefined;
    const origin = (req?.headers?.origin as string) || '';
    if (origin && isTrustedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-API-Key, X-Admin-Secret, x-mahi-token, Idempotency-Key, X-Mahi-Signature, X-Request-Id'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(data));
}

export function parseBody(req: http.IncomingMessage, options: BoundedBodyOptions = {}): Promise<any> {
  return parseBoundedJson(req, options);
}

export function parseRawBuffer(req: http.IncomingMessage, options: BoundedBodyOptions = {}): Promise<Buffer> {
  return readBoundedBuffer(req, options);
}

export function getAuthUser(req: http.IncomingMessage): { userId: string; email: string; role: CommercialRole; sessionId?: string } | null {
  const authHeader = (req.headers['authorization'] as string) || (req.headers['x-mahi-token'] ? `Bearer ${req.headers['x-mahi-token']}` : '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const centralPayload = verifyAccessToken(token);
    if (centralPayload) {
      return {
        userId: centralPayload.userId,
        email: centralPayload.email,
        role: centralPayload.role as CommercialRole,
        sessionId: centralPayload.sessionId,
      };
    }
    return verifyToken(token);
  }
  return null;
}

export function checkAdminAuth(
  req: http.IncomingMessage,
  body?: any,
  options?: { allowedRoles?: CommercialRole[] }
): { isAdmin: boolean; actor: { id: string; name: string; role: CommercialRole } } {
  const allowedRoles = options?.allowedRoles ?? ['SUPER_ADMIN', 'ADMIN'];

  // 1. Check JWT role (strictly forbid SUPPORT / BILLING from admin mutations by default)
  const user = getAuthUser(req);
  if (user && allowedRoles.includes(user.role)) {
    return {
      isAdmin: true,
      actor: { id: user.userId, name: user.email, role: user.role },
    };
  }

  // 2. Check X-Admin-Secret header or body secret
  const headerSecret = req.headers['x-admin-secret'] as string;
  const secret = headerSecret || (body && body.adminSecret) || '';
  if (secret && (verifyAdminAccess(secret) || isValidAdminWebSecret(secret))) {
    return {
      isAdmin: true,
      actor: { id: 'admin', name: 'Master Administrator', role: 'SUPER_ADMIN' },
    };
  }

  return {
    isAdmin: false,
    actor: { id: 'unknown', name: 'Unauthorized', role: 'USER' },
  };
}

export function signAccountStatus(canonical: string): string {
  const privateKey = process.env.MAHI_STATUS_PRIVATE_KEY || process.env.RSA_PRIVATE_KEY;
  const isProdNonElectron = process.env.NODE_ENV === 'production' && !process.versions?.electron;
  if (!privateKey || !privateKey.trim()) {
    if (isProdNonElectron) {
      throw new Error('[AccountStatus] MAHI_STATUS_PRIVATE_KEY (or RSA_PRIVATE_KEY) is required in production.');
    }
    return '';
  }
  try {
    const formatted = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
    const signer = crypto.createSign('SHA256');
    signer.update(canonical);
    return signer.sign(formatted, 'base64');
  } catch (err: any) {
    if (isProdNonElectron) {
      throw new Error(`[AccountStatus] Failed to sign account status in production: ${err?.message || err}`);
    }
    console.warn('[AccountStatus] sign error:', err?.message);
    return '';
  }
}

// ============================================================================
// Desktop OAuth SSO Handoff Tickets & Completion Page (GoLogin Parity)
// ============================================================================
export interface DesktopAuthTicket {
  handoff: string;
  codeChallenge?: string;
  authCode?: string;
  token?: string;
  user?: any;
  email?: string;
  planId?: string;
  createdAt: number;
  expiresAt: number;
  codeExpiresAt?: number;
  used?: boolean;
}
export const desktopAuthTickets = new Map<string, DesktopAuthTicket>();

export interface WebHandoffSession {
  code: string;
  userId: string;
  token: string;
  user: any;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export const webHandoffSessions = new Map<string, WebHandoffSession>();
export const WEB_HANDOFF_TTL_MS = 120_000; // 120 seconds
export const MAX_WEB_HANDOFF_SESSIONS = 5000;

export function pruneWebHandoffSessions(): void {
  const now = Date.now();
  for (const [code, session] of webHandoffSessions.entries()) {
    if (session.expiresAt <= now || session.used) {
      webHandoffSessions.delete(code);
      try {
        const db = getDatabase();
        db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(code);
      } catch {}
    }
  }
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM web_handoff_sessions WHERE expires_at <= ? OR used = 1').run(now);
  } catch {}
}

export function _resetWebHandoffSessions(): void {
  webHandoffSessions.clear();
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM web_handoff_sessions').run();
  } catch {}
}

export function getDesktopAuthSuccessHtml(params: {
  handoff: string;
  code: string;
  email: string;
  plan?: string;
}): string {
  const { handoff, code, email, plan = 'trial' } = params;
  const safeEmail = (email || 'user@mahibrowser.com').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isPro = (plan || '').toLowerCase().includes('pro');
  const planLabel = isPro ? 'MAHI PRO • Unlimited Multi-Accounting' : 'Active 7-Day Trial • 50 Profiles';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAHI Browser — Signed In Successfully</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(16, 185, 129, 0.3);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 2.75rem 2.25rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.12);
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrap {
      width: 72px;
      height: 72px;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      box-shadow: 0 0 24px rgba(16, 185, 129, 0.25);
    }
    .icon-wrap svg {
      width: 36px;
      height: 36px;
    }
    h1 {
      font-size: 1.45rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    .user-pill {
      display: inline-block;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(51, 65, 85, 0.8);
      border-radius: 9999px;
      padding: 0.4rem 1rem;
      font-size: 0.8125rem;
      color: #38bdf8;
      font-weight: 600;
      margin: 0.75rem 0 0.5rem;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .plan-badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.25rem;
    }
    p.desc {
      color: #94a3b8;
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 2rem;
    }
    .btn-return {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 0.875rem 1.25rem;
      border-radius: 14px;
      transition: all 0.2s ease;
      box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.35);
      border: none;
      cursor: pointer;
    }
    .btn-return:hover {
      background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
      transform: translateY(-1px);
    }
    .status-text {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>Authentication Successful</h1>
    <div>
      <span class="user-pill">${safeEmail}</span>
    </div>
    <div>
      <span class="plan-badge">${planLabel}</span>
    </div>
    <p class="desc">
      Your account is authenticated and ready. MAHI Browser Desktop has been notified automatically.
    </p>

    <a href="mahibrowser://auth-callback?code=${encodeURIComponent(code)}&ticket=${encodeURIComponent(handoff)}" class="btn-return" id="openAppBtn">
      Open MAHI Browser Desktop
    </a>

    <!-- Backward-compatible link for tests and legacy protocol handler installations -->
    <a href="mahi://auth?code=${encodeURIComponent(code)}&ticket=${encodeURIComponent(handoff)}" style="display:none" id="fallbackMahiBtn">
      mahi://auth?code=${encodeURIComponent(code)}&ticket=${encodeURIComponent(handoff)}
    </a>

    <p class="status-text" id="statusMessage">
      Connecting to your desktop application...
    </p>
  </div>

  <script>
    const code = ${JSON.stringify(code)};
    const ticket = ${JSON.stringify(handoff)};
    const canonicalDeepLink = "mahibrowser://auth-callback?code=" + encodeURIComponent(code) + "&ticket=" + encodeURIComponent(ticket);
    const legacyDeepLink = "mahi://auth?code=" + encodeURIComponent(code) + "&ticket=" + encodeURIComponent(ticket);

    // 1. Send single-use authorization code to local daemon on port 32123 (CORS fetch)
    fetch("http://127.0.0.1:32123/api/v1/auth/desktop-handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: ticket, code: code })
    }).then(r => r.json()).then(data => {
      document.getElementById('statusMessage').textContent = "✓ Connected to MAHI Browser Desktop!";
      document.getElementById('statusMessage').style.color = "#10b981";
    }).catch(() => {
      // Local daemon might not be on port 32123 or blocked; deep link and status polling handle fallback cleanly
    });

    // 2. Launch custom protocol to focus running app
    setTimeout(() => {
      try {
        window.location.href = canonicalDeepLink;
      } catch (e) {
        try { window.location.href = legacyDeepLink; } catch (_) {}
      }
    }, 400);

    // 3. Auto-close tab if supported
    setTimeout(() => {
      try { window.close(); } catch (e) {}
    }, 4000);
  </script>
</body>
</html>`;
}

// ============================================================================
// RATE LIMITING FOR PUBLIC AUTH ENDPOINTS (Brute-Force & Stuffing Mitigation)
// ============================================================================
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
export const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;          // 10 attempts per window

export interface AuthRateLimitEntry {
  attempts: number;
  resetAt: number;
}

export const authRateLimitMap = new Map<string, AuthRateLimitEntry>();

export function checkAuthRateLimit(clientIp: string, action: string = 'auth'): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const normalizedIp = normalizeIp(clientIp) || '127.0.0.1';
  const key = `${normalizedIp}:${action}`;
  const now = Date.now();

  // Bound in-memory rate-limit map size by pruning expired entries when large
  if (authRateLimitMap.size > 2000) {
    for (const [k, v] of authRateLimitMap.entries()) {
      if (v.resetAt <= now) {
        authRateLimitMap.delete(k);
      }
    }
  }

  const entry = authRateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    authRateLimitMap.set(key, { attempts: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: AUTH_RATE_LIMIT_MAX_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }

  if (entry.attempts >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.attempts += 1;
  return { allowed: true, remaining: AUTH_RATE_LIMIT_MAX_ATTEMPTS - entry.attempts, retryAfterSeconds: 0 };
}

export function resetAuthRateLimitForTesting(): void {
  authRateLimitMap.clear();
}
