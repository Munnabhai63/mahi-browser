import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  registerUser,
  loginUser,
  signToken,
  verifyToken,
  getUserById,
  getAllUsers,
  updateUserStatus,
  updateUserPlan,
  boostUserQuota,
  setUserFeatureOverrides,
} from './commercial-auth-service.js';
import {
  registerCentralUser,
  verifyEmailToken,
  resendEmailVerification,
  loginCentralUser,
  refreshAccessToken,
  logoutSession,
  listUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  requestPasswordReset,
  resetPasswordWithToken,
  getCentralUserById,
  getCentralUserByEmail,
  verifyAccessToken,
  getCentralUserByIdAsync,
  getCentralUserByEmailAsync,
  logoutSessionAsync,
  listUserSessionsAsync,
  revokeUserSessionAsync,
  revokeAllUserSessionsAsync,
} from '../../05_AUTH/central-auth-service.js';
import {
  getCommercialPlans,
  getCommercialPlanById,
  createCommercialPlan,
  updateCommercialPlan,
} from './commercial-plan-service.js';
import {
  buildPlanCatalog,
  getAllPricingVersions,
  getActivePricingVersion,
  createPricingDraft,
  updatePricingDraft,
  previewPricingChanges,
  publishPricingVersion,
  rollbackPricing,
  getAdminRevenueSummary,
  getProviderSyncStatus,
  initializePricingTables,
} from './pricing-admin-service.js';
import {
  evaluateUserEntitlements,
  activateCommercialLicenseForUser,
  activateUserTrial,
  getUserTrialStatus,
} from './commercial-entitlement-service.js';
import {
  createDemoRequest,
  getDemoRequests,
  updateDemoRequestStatus,
  DemoRequestStatus,
} from './demo-service.js';
import {
  handleSupportChatMessage,
  getSupportTickets,
  updateSupportTicketStatus,
  replySupportTicket,
  getSupportTicketMetrics,
} from './support-ticket-service.js';
import {
  recordFunnelEvent,
  getFunnelMetrics,
} from './funnel-service.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  authenticateWithGoogleClaims,
  authenticateWithGoogleClaimsAsync,
  getGoogleOAuthConfig,
  normalizePlanId,
  GoogleClaims,
  OAuthStateRecord,
} from './google-oauth-service.js';
import {
  getUserDevices,
  getAllCommercialDevices,
  revokeCommercialDevice,
  resetAllUserDevices,
  registerOrUpdateDevice,
} from './commercial-device-service.js';
import { CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  paymentService,
  PaymentProviderType,
  PaymentGatewayNotConfiguredError,
  verifyRazorpayPaymentSignature,
} from './payment-service.js';
import {
  getCommercialAuditLogs,
  logCommercialAudit,
} from './commercial-audit-service.js';
import {
  getSoftwareVersions,
  publishSoftwareVersion,
  checkVersionCompatibility,
} from './commercial-version-service.js';
import {
  createLicense,
  getLicenses,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';

import {
  getUserSyncUsage,
  listUserCloudProfiles,
  getCloudProfile,
  createUploadSession,
  finalizeUploadSession,
  createDownloadSession,
  deleteCloudProfile,
  acquireProfileLock,
  renewProfileLock,
  releaseProfileLock,
  getProfileLockStatus,
  acquireProfileLockAsync,
  renewProfileLockAsync,
  releaseProfileLockAsync,
  getProfileLockStatusAsync,
  listUserCloudProfilesAsync,
  getCloudProfileAsync,
} from '../services/cloud-profile-service.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getTeamWorkspace,
  updateTeamWorkspace,
  deleteTeamWorkspace,
  transferWorkspaceOwnership,
  getWorkspaceMembers,
  updateMemberRole,
  removeWorkspaceMember,
  inviteWorkspaceMember,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  shareProfileToWorkspace,
  revokeProfileShare,
  listWorkspaceProfiles,
  getWorkspaceAuditLogs,
  getWorkspaceKeyEnvelope,
  setWorkspaceKeyEnvelope,
} from '../services/team-workspace-service.js';
import { getStorageProvider, LocalStorageProvider } from '../../08_SECURITY/storage-provider.js';
import { handleRemoteApiRoutes } from './remote-api-router.js';
import { isTrustedOrigin } from '../server/cloud-gateway.js';

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
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

function parseBody(req: http.IncomingMessage): Promise<any> {
  if ((req as any).body !== undefined && typeof (req as any).body === 'object') {
    return Promise.resolve((req as any).body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function parseRawBuffer(req: http.IncomingMessage): Promise<Buffer> {
  if ((req as any).rawBuffer !== undefined && Buffer.isBuffer((req as any).rawBuffer)) {
    return Promise.resolve((req as any).rawBuffer);
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function getAuthUser(req: http.IncomingMessage): { userId: string; email: string; role: CommercialRole; sessionId?: string } | null {
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

function checkAdminAuth(req: http.IncomingMessage, body?: any): { isAdmin: boolean; actor: { id: string; name: string; role: CommercialRole } } {
  // 1. Check JWT role
  const user = getAuthUser(req);
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SUPPORT' || user.role === 'BILLING')) {
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

function signAccountStatus(canonical: string): string {
  if (process.env.MAHI_STATUS_PRIVATE_KEY) {
    try {
      const signer = crypto.createSign('SHA256');
      signer.update(canonical);
      return signer.sign(process.env.MAHI_STATUS_PRIVATE_KEY, 'base64');
    } catch {}
  }
  return '';
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
const WEB_HANDOFF_TTL_MS = 120_000; // 120 seconds
const MAX_WEB_HANDOFF_SESSIONS = 5000;

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
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 10;          // 10 attempts per window

interface AuthRateLimitEntry {
  attempts: number;
  resetAt: number;
}

const authRateLimitMap = new Map<string, AuthRateLimitEntry>();

export function checkAuthRateLimit(clientIp: string, action: string = 'auth'): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = `${clientIp}:${action}`;
  const now = Date.now();
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

export async function handleCommercialApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Support /api/v1/*, direct /auth/*, direct /v1/sync/*, and direct /v1/* routes
  const isApiV1 = pathname.startsWith('/api/v1/');
  const isDirectAuth = pathname.startsWith('/auth/');
  const isDirectSync = pathname.startsWith('/v1/sync/');
  const isDirectV1 = pathname.startsWith('/v1/');
  if (!isApiV1 && !isDirectAuth && !isDirectSync && !isDirectV1) {
    return false;
  }

  // Support direct /v1/account/* endpoints before remote API delegation
  if (pathname.startsWith('/v1/account/')) {
    // handled directly below in commercial router
  } else if (
    pathname.startsWith('/api/v1/remote/') ||
    pathname.startsWith('/api/v1/cloud-browser') ||
    pathname.startsWith('/api/v1/webhooks') ||
    pathname.startsWith('/v1/')
  ) {
    const handled = await handleRemoteApiRoutes(req, res, pathname, method, parsedUrl);
    if (handled) return true;
  }

  const routePath = isDirectAuth ? `/api/v1${pathname}` : isDirectSync ? `/api${pathname}` : pathname;

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';

  // -------------------------------------------------------------
  // 0. ACCOUNT CLIENT DESKTOP ENDPOINTS (/v1/account/*)
  // -------------------------------------------------------------
  if (routePath === '/v1/account/status' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid token required.' });
      return true;
    }
    const hwidParam = (parsedUrl.searchParams.get('hwid') || '').trim();
    const entitlements = evaluateUserEntitlements(auth.userId, hwidParam);
    const plan = entitlements?.plan?.id || entitlements?.planId || 'free';
    const profile_limit = entitlements?.maxProfiles || entitlements?.limits?.maxProfiles || 15;
    const sync_allowed = entitlements?.features?.['cloud.sync'] ?? (plan !== 'free' && plan !== 'plan_free');
    const expires_at = entitlements?.subscription?.expiresAt || null;
    const server_time = Date.now();
    const canonical = `${auth.userId}:${hwidParam}:${plan}:${profile_limit}:${sync_allowed ? 1 : 0}:${expires_at || ''}:${server_time}`;
    const sig = signAccountStatus(canonical);

    sendJSON(res, 200, {
      success: true,
      account_id: auth.userId,
      hwid: hwidParam,
      plan,
      profile_limit,
      sync_allowed,
      expires_at,
      server_time,
      sig,
    });
    return true;
  }

  if (routePath === '/v1/account/signup' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, name } = body;
    if (!email || !password) {
      sendJSON(res, 400, { success: false, error: 'Email and password required' });
      return true;
    }
    const result = await registerCentralUser({ email, password, name, ipAddress: clientIp });
    if (!result.success) {
      sendJSON(res, 400, { success: false, error: result.error });
      return true;
    }
    sendJSON(res, 201, {
      success: true,
      token: result.tokens?.accessToken,
      refreshToken: result.tokens?.refreshToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/v1/account/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, hwid } = body;
    if (!email || !password) {
      sendJSON(res, 400, { success: false, error: 'Email and password required' });
      return true;
    }
    const result = await loginCentralUser({ email, password, deviceId: hwid, ipAddress: clientIp });
    if (!result.success) {
      const isDeviceErr = !!result.error?.toLowerCase().includes('device');
      sendJSON(res, 401, { success: false, error: result.error, device_ok: !isDeviceErr });
      return true;
    }
    sendJSON(res, 200, {
      success: true,
      token: result.tokens?.accessToken,
      refreshToken: result.tokens?.refreshToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/v1/account/switch-device' && method === 'POST') {
    const body = await parseBody(req);
    const auth = getAuthUser(req);
    const token = body.token || (req.headers['x-mahi-token'] as string);
    const userId = auth?.userId || (token ? verifyAccessToken(token)?.userId : null);
    if (!userId) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized' });
      return true;
    }
    const hwid = body.hwid || '';
    if (hwid) {
      registerOrUpdateDevice({
        userId,
        deviceId: hwid,
        deviceName: body.deviceName || 'Windows Desktop',
        ipAddress: clientIp,
      });
    }
    sendJSON(res, 200, { success: true, message: 'Device rebound successfully' });
    return true;
  }

  if (routePath === '/v1/account/payment-info' && method === 'GET') {
    sendJSON(res, 200, {
      success: true,
      upi_id: CONTACT_CONFIG.UPI_ID,
      upi_account_holder: CONTACT_CONFIG.UPI_ACCOUNT_HOLDER,
      upi_qr_asset: CONTACT_CONFIG.UPI_QR_ASSET,
      price_inr: CONTACT_CONFIG.DEFAULT_PRICE_INR || 599,
      price_usd: 19,
      price_usdt: 0,
      usdt_address: '',
      usdt_network: '',
      usdt_enabled: false,
      whatsapp_number: CONTACT_CONFIG.WHATSAPP_NUMBER,
    });
    return true;
  }

  if ((routePath === '/v1/account/payments/upi/submit' || routePath === '/api/v1/account/payments/upi/submit') && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const utr = (body.utr || '').trim();
    if (!utr || utr.length < 6) {
      sendJSON(res, 400, { success: false, error: 'Invalid UTR: Transaction reference must be at least 6 characters.' });
      return true;
    }
    const planId = body.planId || body.plan_id || body.plan || 'professional_10';
    const billingCycle = ((body.billingCycle || body.billing_cycle || body.billing || 'MONTHLY') as string).toUpperCase() as 'MONTHLY' | 'ANNUAL';
    const proofAsset = body.proofAsset || body.proof_asset || body.receiptUrl || body.receipt_url;
    const extraMembers = body.extraMembers || body.extra_members;
    const extraProxyGb = body.extraProxyGb || body.extra_proxy_gb;

    try {
      const result = await paymentService.submitManualUpiPayment({
        userId: auth.userId,
        planId,
        billingCycle,
        utr,
        proofAsset,
        extraMembers: extraMembers ? Number(extraMembers) : undefined,
        extraProxyGb: extraProxyGb ? Number(extraProxyGb) : undefined,
      });

      sendJSON(res, 200, {
        success: true,
        payment_id: result.paymentId,
        status: result.status,
        utr: result.utr,
        amount_paise: result.amountPaise,
        message: 'Payment submitted successfully for verification.',
      });
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('UTR_ALREADY_EXISTS')) {
        sendJSON(res, 409, { success: false, error: err.message });
        return true;
      }
      sendJSON(res, 400, { success: false, error: err.message });
      return true;
    }
  }

  if ((routePath === '/v1/account/payments/status' || routePath === '/api/v1/account/payments/status') && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const payments = paymentService.getUserPaymentHistory(auth.userId);
    sendJSON(res, 200, { success: true, payments, data: payments });
    return true;
  }

  // -------------------------------------------------------------
  // 0.1 CENTRAL JWT BILLING & CHECKOUT ENDPOINTS
  // -------------------------------------------------------------
  if (routePath === '/api/v1/billing/gateways' && method === 'GET') {
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';
    const hasYoupi = Boolean(
      (process.env.YOUPI_PG_BASE_URL || process.env.BASE_PAYMENT_API_URL) &&
      (process.env.YOUPI_PG_API_KEY || process.env.YOUPI_PG_SECRET)
    );
    const gateways = [
      {
        id: 'youpi_pg',
        name: 'Instant UPI / Dynamic QR (0% Fee)',
        enabled: hasYoupi || isTest,
        currency: 'INR',
        isDirect: true,
        description: 'Instant 0% fee peer-to-bank settlement via GPay, PhonePe, Paytm & BHIM',
      },
      {
        id: 'stripe',
        name: 'Credit & Debit Cards (Global)',
        enabled: hasStripe || isTest,
        currency: 'USD',
        isDirect: false,
        description: 'International card processing powered by Stripe',
      },
      {
        id: 'upi_manual',
        name: 'Direct UPI Transfer (UTR)',
        enabled: true,
        currency: 'INR',
        isDirect: true,
        description: 'Direct bank transfer to Slice UPI ID with manual admin verification',
      },
    ];
    sendJSON(res, 200, { success: true, gateways });
    return true;
  }

  if (routePath === '/api/v1/billing/checkout' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const planId = body.planId || body.plan;
    if (!planId) {
      sendJSON(res, 400, { success: false, error: 'Missing required field: planId.' });
      return true;
    }
    const billingCycle = ((body.billingCycle || body.billing || 'MONTHLY') as string).toUpperCase() as 'MONTHLY' | 'ANNUAL';
    const provider = ((body.provider || 'youpi_pg') as string).toLowerCase() as PaymentProviderType;
    const currency = body.currency || (provider === 'stripe' ? 'USD' : 'INR');
    const extraMembers = Number(body.extraMembers || 0);
    const extraProxyGb = Number(body.extraProxyGb || 0);

    try {
      const session = await paymentService.createCheckoutSession({
        userId: auth.userId,
        planId,
        billingCycle,
        currency,
        extraMembers,
        extraProxyGb,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        idempotencyKey: body.idempotencyKey,
      }, provider);

      sendJSON(res, 200, {
        success: true,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        orderId: session.orderId,
        gatewayMeta: session.gatewayMeta,
        amountMinor: session.amountCents,
        currency: session.currency,
        provider: session.provider,
        planId: session.planId,
        billingCycle: session.billingCycle,
      });
      return true;
    } catch (err: any) {
      const status = err instanceof PaymentGatewayNotConfiguredError ? 503 : 400;
      sendJSON(res, status, { success: false, error: err.message });
      return true;
    }
  }

  if (routePath === '/api/v1/billing/verify-razorpay' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      sendJSON(res, 400, { success: false, error: 'Missing required Razorpay verification fields.' });
      return true;
    }

    const isVerified = verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isVerified) {
      sendJSON(res, 400, { success: false, error: 'Invalid Razorpay payment signature.' });
      return true;
    }

    const db = getDatabase();
    const pending = db.prepare('SELECT * FROM commercial_payments WHERE external_order_id = ? OR id = ?').get(razorpay_order_id, razorpay_order_id) as any;
    if (!pending) {
      sendJSON(res, 404, { success: false, error: 'Order not found.' });
      return true;
    }
    if (pending.user_id !== auth.userId) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Order belongs to another user.' });
      return true;
    }
    if (pending.status === 'SUCCEEDED') {
      const existingSub = paymentService.getUserSubscription(auth.userId);
      sendJSON(res, 200, {
        success: true,
        message: 'Payment already verified and subscription activated.',
        subscription: existingSub,
      });
      return true;
    }

    const planId = pending.plan_id;
    const billingCycle = (pending.billing_cycle || 'MONTHLY') as 'MONTHLY' | 'ANNUAL';
    const amountCents = pending.amount_cents;

    const result = await paymentService.activateSubscriptionFromPayment({
      userId: auth.userId,
      planId,
      billingCycle,
      amountCents,
      currency: pending.currency || 'INR',
      provider: 'razorpay',
      externalPaymentId: razorpay_payment_id,
      externalOrderId: razorpay_order_id,
    });

    sendJSON(res, 200, {
      success: true,
      message: 'Payment verified and subscription activated successfully.',
      subscription: result.subscription,
      invoice: result.invoice,
    });
    return true;
  }

  if (routePath === '/api/v1/billing/verify-youpi' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const paymentOrOrderId = body.paymentId || body.orderId || body.external_payment_id || body.externalOrderId;
    if (!paymentOrOrderId) {
      sendJSON(res, 400, { success: false, error: 'Missing required field: paymentId or orderId.' });
      return true;
    }

    try {
      const result = await paymentService.verifyYoupiPgOrder(paymentOrOrderId, auth.userId);
      const statusCode = result.status === 'FORBIDDEN' ? 403 : result.status === 'NOT_FOUND' ? 404 : result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
      return true;
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
      return true;
    }
  }

  const youpiStatusMatch = routePath.match(/^\/api\/v1\/billing\/youpi\/status\/([a-zA-Z0-9_.-]+)$/);
  if (youpiStatusMatch && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const orderId = youpiStatusMatch[1];
    try {
      const result = await paymentService.verifyYoupiPgOrder(orderId, auth.userId);
      const statusCode = result.status === 'FORBIDDEN' ? 403 : result.status === 'NOT_FOUND' ? 404 : result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
      return true;
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
      return true;
    }
  }

  if (
    (routePath === '/api/v1/billing/webhook' ||
      routePath === '/api/v1/billing/webhook/youpi' ||
      routePath === '/api/v1/billing/webhook/youpi_pg') &&
    method === 'POST'
  ) {
    try {
      const rawBody = (await parseRawBuffer(req)).toString('utf-8');
      const signature = (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature'] ||
        req.headers['stripe-signature'] ||
        req.headers['x-razorpay-signature'] ||
        req.headers['x-simulation-signature'] ||
        ''
      ) as string;

      let provider: PaymentProviderType = 'youpi_pg';
      if (req.headers['stripe-signature']) {
        provider = 'stripe';
      } else if (req.headers['x-razorpay-signature']) {
        provider = 'razorpay';
      } else if (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature']
      ) {
        provider = 'youpi_pg';
      } else if (parsedUrl.searchParams.get('provider')) {
        provider = parsedUrl.searchParams.get('provider') as any;
      }

      const result = await paymentService.handleWebhook(provider, rawBody, signature);
      sendJSON(res, 200, { success: true, data: result });
      return true;
    } catch (err: any) {
      const isSig = err.message && err.message.includes('INVALID_WEBHOOK_SIGNATURE');
      sendJSON(res, isSig ? 400 : 500, { success: false, error: err.message });
      return true;
    }
  }

  if (routePath === '/api/v1/billing/subscription' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const sub = paymentService.getUserSubscription(auth.userId);
    const entitlements = evaluateUserEntitlements(auth.userId);
    sendJSON(res, 200, {
      success: true,
      subscription: sub,
      entitlements,
    });
    return true;
  }

  if (routePath === '/api/v1/billing/invoices' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const invoices = paymentService.getUserInvoices(auth.userId);
    sendJSON(res, 200, { success: true, invoices });
    return true;
  }

  // -------------------------------------------------------------
  // 1. PUBLIC AUTHENTICATION & REGISTRATION
  // -------------------------------------------------------------
  if (routePath === '/api/v1/auth/register' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'register');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await registerCentralUser({
      email: body.email,
      password: body.password,
      name: body.name,
      ipAddress: clientIp,
    });
    if (!result.success) {
      const isDuplicate = typeof result.error === 'string' && result.error.includes('already exists');
      const statusCode = isDuplicate ? 409 : 400;
      sendJSON(res, statusCode, {
        success: false,
        error: {
          code: isDuplicate ? 'EMAIL_ALREADY_EXISTS' : 'REGISTRATION_FAILED',
          message: result.error || 'Registration failed',
        },
      });
      return true;
    }
    let commUserResult: any;
    try {
      commUserResult = registerUser({
        email: body.email,
        password: body.password,
        name: body.name,
        intent: body.intent,
        planId: body.planId || body.plan,
        billingCycle: body.billingCycle || body.billing,
      }, clientIp, result.user?.id);
    } catch {}

    const registeredUser = commUserResult?.user || result.user;
    const token = commUserResult?.token || result.tokens?.accessToken;
    const isTrial = registeredUser?.signupIntent === 'trial' || body.intent === 'trial';
    const trialExpiresAt = registeredUser?.trialExpiresAt;
    const planId = registeredUser?.planId || (isTrial ? 'professional_50' : 'plan_free');

    // Record privacy-safe conversion funnel event
    try {
      recordFunnelEvent({
        eventName: 'signup_completed',
        userId: registeredUser?.id,
        planId,
        billingCycle: body.billingCycle || body.billing,
        ipAddress: clientIp,
        metadata: { intent: body.intent },
      });
      if (isTrial) {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId: registeredUser?.id,
          planId,
          ipAddress: clientIp,
        });
      }
    } catch {}

    const registeredUserId = registeredUser?.id || result.user?.id;
    const trialStatus = registeredUserId ? getUserTrialStatus(registeredUserId) : { isTrialActive: isTrial, daysRemaining: isTrial ? 7 : 0, isEligibleForTrial: !isTrial };
    const entitlements = registeredUserId ? evaluateUserEntitlements(registeredUserId) : null;

    sendJSON(res, 201, {
      success: true,
      user: registeredUser,
      tokens: result.tokens,
      token,
      trialActive: isTrial,
      trialExpiresAt,
      trialStatus,
      entitlements,
      planId,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/verify-email' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'verify-email');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await verifyEmailToken(body.token, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/resend-verification' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'resend-verification');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await resendEmailVerification(body.email, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/login' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'login');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const centralRes = await loginCentralUser({
      email: body.email,
      password: body.password,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      ipAddress: clientIp,
    });

    if (centralRes.success && centralRes.user && centralRes.tokens) {
      const commUser = getUserById(centralRes.user.id);
      const isTrial = Boolean(commUser?.trialExpiresAt && new Date(commUser.trialExpiresAt).getTime() > Date.now());
      const entitlements = evaluateUserEntitlements(centralRes.user.id, body.deviceId, body.deviceName);
      sendJSON(res, 200, {
        success: true,
        token: centralRes.tokens.accessToken,
        tokens: centralRes.tokens,
        user: {
          ...centralRes.user,
          ...(commUser || {}),
          id: centralRes.user.id,
          is_trial: isTrial,
          trial_started_at: commUser?.trialStartedAt,
          trial_expires_at: commUser?.trialExpiresAt,
        },
        entitlements,
      });
      return true;
    }

    // Fallback to legacy commercial login only if not registered in central auth
    const centralUserExists = getCentralUserByEmail(body.email);
    if (!centralUserExists) {
      const legacyResult = loginUser(body, clientIp);
      if (legacyResult.success && legacyResult.user) {
        const entitlements = evaluateUserEntitlements(legacyResult.user.id, body.deviceId, body.deviceName);
        sendJSON(res, 200, {
          success: true,
          token: legacyResult.token,
          user: legacyResult.user,
          entitlements,
        });
        return true;
      }
    }

    sendJSON(res, centralRes.lockedRemainingMs ? 429 : 401, {
      success: false,
      error: centralRes.error || 'Invalid email or password.',
    });
    return true;
  }

  // ============================================================================
  // Google OAuth SSO Endpoints (Phase 19 & GoLogin Workflow Parity)
  // ============================================================================

  // 1. OAuth Start: Redirects browser to Google OAuth consent
  if (routePath === '/api/v1/auth/google/start' && method === 'GET') {
    const intent = parsedUrl.searchParams.get('intent') || 'trial';
    const planId = parsedUrl.searchParams.get('plan') || parsedUrl.searchParams.get('planId') || 'professional_50';
    const billingCycle = parsedUrl.searchParams.get('billing') || parsedUrl.searchParams.get('billingCycle') || 'annual';
    const returnUrl = parsedUrl.searchParams.get('returnUrl') || parsedUrl.searchParams.get('return_url') || '';
    const handoff = parsedUrl.searchParams.get('handoff') || '';
    const codeChallenge = parsedUrl.searchParams.get('code_challenge') || '';

    if (handoff) {
      desktopAuthTickets.set(handoff, {
        handoff,
        codeChallenge,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
    }

    const auth = generateOAuthAuthorization({
      intent,
      planId,
      billingCycle,
      returnUrl,
      handoff,
    });

    // Check if caller requested JSON response (e.g., API client or AJAX)
    const acceptsJson = req.headers.accept?.includes('application/json') || req.headers['x-requested-with'];
    if (acceptsJson) {
      sendJSON(res, 200, {
        success: true,
        authUrl: auth.authUrl,
        state: auth.state,
        configured: auth.configured,
      });
      return true;
    }

    // Direct browser navigation: 302 Redirect to Google Auth URL
    res.writeHead(302, {
      Location: auth.authUrl,
      'Access-Control-Allow-Origin': '*',
    });
    res.end();
    return true;
  }

  // 2. OAuth Callback: Validates state, exchanges code, links/creates user, creates session
  if (routePath === '/api/v1/auth/google/callback' && method === 'GET') {
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');
    const error = parsedUrl.searchParams.get('error');

    const websiteBase = (process.env.MAHI_WEBSITE_URL || '').replace(/\/+$/, '');

    // Handle user cancellation or OAuth error
    if (error || !state) {
      const stateRecord = state ? validateAndConsumeOAuthState(state) : null;
      const fallbackIntent = stateRecord?.intent || 'trial';
      const fallbackPlan = stateRecord?.planId || 'professional_50';
      const errorMsg = error === 'access_denied' ? 'cancelled' : (error || 'oauth_error');
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=${encodeURIComponent(errorMsg)}&intent=${encodeURIComponent(fallbackIntent)}&plan=${encodeURIComponent(fallbackPlan)}`,
      });
      res.end();
      return true;
    }

    // Validate and consume state (anti-CSRF & single-use)
    const stateRecord = validateAndConsumeOAuthState(state);
    if (!stateRecord) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=invalid_state`,
      });
      res.end();
      return true;
    }

    if (!code) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=missing_code`,
      });
      res.end();
      return true;
    }

    try {
      const redirectUri = getGoogleOAuthConfig().defaultRedirectUri;
      const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      const profile = await fetchGoogleProfile(tokens.accessToken);

      const authResult = await authenticateWithGoogleClaimsAsync(profile, stateRecord, clientIp);
      if (!authResult.success) {
        res.writeHead(302, {
          Location: `${websiteBase}/signup?error=${encodeURIComponent(authResult.error || 'auth_failed')}`,
        });
        res.end();
        return true;
      }

      // Check if this was a desktop login flow and update tickets with single-use authCode
      const handoffMatch = stateRecord.returnUrl?.match(/handoff=([^&]+)/);
      const handoffTicket = handoffMatch ? decodeURIComponent(handoffMatch[1]) : '';
      if (handoffTicket && desktopAuthTickets.has(handoffTicket)) {
        const ticketRec = desktopAuthTickets.get(handoffTicket)!;
        const authCode = 'mb_code_' + crypto.randomBytes(32).toString('hex');
        ticketRec.authCode = authCode;
        ticketRec.token = authResult.token;
        ticketRec.user = authResult.user;
        ticketRec.email = authResult.user.email;
        ticketRec.planId = authResult.user.planId;
        ticketRec.codeExpiresAt = Date.now() + 60 * 1000; // 60s TTL
        ticketRec.used = false;
      }

      // Establish session cookie and redirect to onboarding / desktop-success
      let targetUrl = authResult.returnUrl;
      const isDesktop = stateRecord.intent === 'desktop_login' || authResult.returnUrl.includes('/auth/desktop-success');

      if (!isDesktop) {
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}token=${encodeURIComponent(authResult.token || '')}&login=success`;
      } else {
        const ticketRec = handoffTicket ? desktopAuthTickets.get(handoffTicket) : null;
        const codeParam = ticketRec?.authCode ? `&code=${encodeURIComponent(ticketRec.authCode)}` : '';
        targetUrl = `/auth/desktop-success?handoff=${encodeURIComponent(handoffTicket)}${codeParam}&email=${encodeURIComponent(authResult.user.email)}&plan=${encodeURIComponent(authResult.user.planId || 'trial')}`;

        // CRITICAL SECURITY HARDENING: Never expose raw JWT session token in redirect URL, query strings or cookies!
        res.writeHead(302, {
          Location: targetUrl,
        });
        res.end();
        return true;
      }

      res.writeHead(302, {
        Location: targetUrl,
        'Set-Cookie': `mahi_token=${authResult.token}; Path=/; Max-Age=2592000; SameSite=Lax`,
      });
      res.end();
      return true;
    } catch (err: any) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=${encodeURIComponent(err.message || 'oauth_exchange_failed')}`,
      });
      res.end();
      return true;
    }
  }

  // 2.1 Desktop Auth Status Polling (Fallback for environments without custom protocol or loopback)
  if (routePath === '/api/v1/auth/desktop-status' && method === 'GET') {
    const ticket = parsedUrl.searchParams.get('ticket');
    if (!ticket) {
      sendJSON(res, 400, { success: false, error: 'Ticket parameter required' });
      return true;
    }
    const record = desktopAuthTickets.get(ticket);
    if (!record || record.expiresAt < Date.now()) {
      sendJSON(res, 200, { success: false, error: 'Ticket expired or not found', authenticated: false });
      return true;
    }
    // Return single-use code to polling client. Never expose raw token!
    if (record.authCode && !record.used && record.codeExpiresAt && record.codeExpiresAt > Date.now()) {
      sendJSON(res, 200, {
        success: true,
        authenticated: true,
        code: record.authCode,
        ticket: record.handoff,
        email: record.email,
        plan: record.planId,
      });
      return true;
    }
    sendJSON(res, 200, { success: true, authenticated: false });
    return true;
  }

  // 2.2 Secure PKCE Authorization Code Exchange (RFC 8252 Hardened)
  if (routePath === '/api/v1/auth/desktop-exchange' && method === 'POST') {
    let body: any = {};
    try {
      body = await parseBody(req);
    } catch {
      sendJSON(res, 400, { success: false, error: 'Invalid JSON payload' });
      return true;
    }
    const { ticket, code, code_verifier } = body;
    if (!ticket || !code || !code_verifier) {
      sendJSON(res, 400, { success: false, error: 'ticket, code, and code_verifier are required' });
      return true;
    }

    const record = desktopAuthTickets.get(ticket);
    if (!record) {
      sendJSON(res, 403, { success: false, error: 'Invalid or expired handoff ticket' });
      return true;
    }

    if (record.used) {
      desktopAuthTickets.delete(ticket);
      sendJSON(res, 403, { success: false, error: 'Authorization code already consumed (replay prevented)' });
      return true;
    }

    if (record.codeExpiresAt && record.codeExpiresAt < Date.now()) {
      desktopAuthTickets.delete(ticket);
      sendJSON(res, 403, { success: false, error: 'Authorization code expired' });
      return true;
    }

    if (record.authCode !== code) {
      sendJSON(res, 403, { success: false, error: 'Authorization code mismatch' });
      return true;
    }

    // Verify PKCE challenge if challenge was registered
    if (record.codeChallenge) {
      const hashHex = crypto.createHash('sha256').update(code_verifier).digest('hex');
      const hashBase64Url = crypto.createHash('sha256').update(code_verifier).digest('base64url');
      if (record.codeChallenge !== hashHex && record.codeChallenge !== hashBase64Url) {
        desktopAuthTickets.delete(ticket);
        sendJSON(res, 403, { success: false, error: 'PKCE code verification failed' });
        return true;
      }
    }

    // Mark used and consume single-use ticket immediately
    record.used = true;
    const issuedToken = record.token;
    const userProfile = record.user;
    desktopAuthTickets.delete(ticket);

    sendJSON(res, 200, {
      success: true,
      token: issuedToken,
      user: userProfile,
      message: 'Authentication completed successfully'
    });
    return true;
  }

  // 2.3 Desktop Loopback Handoff (Invoked by browser completion page to local daemon port 32123)
  if (routePath === '/api/v1/auth/desktop-handoff' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { ticket, code } = body;
      if (ticket && code) {
        const { exchangeDesktopAuthCode } = await import('../../08_SECURITY/account-service.js');
        const exchangeResult = await exchangeDesktopAuthCode(ticket, code);
        sendJSON(res, 200, {
          success: exchangeResult.success,
          message: exchangeResult.success ? 'Desktop authenticated via PKCE loopback' : exchangeResult.error
        });
        return true;
      }
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err?.message || 'Invalid payload' });
      return true;
    }
    sendJSON(res, 400, { success: false, error: 'ticket and code are required' });
    return true;
  }

  // 2.4 Branded Desktop Auth Completion Page (GoLogin UX Parity & Zero Token Exposure)
  if ((routePath === '/auth/desktop-success' || routePath === '/auth/success') && method === 'GET') {
    const code = parsedUrl.searchParams.get('code') || '';
    const email = parsedUrl.searchParams.get('email') || '';
    const plan = parsedUrl.searchParams.get('plan') || '';
    const handoff = parsedUrl.searchParams.get('handoff') || '';
    const html = getDesktopAuthSuccessHtml({ handoff, code, email, plan });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(html);
    return true;
  }

  // 2.5 Zero-Token Web-to-Desktop Handoff Endpoint (Single-Use, 120s TTL)
  if (routePath === '/api/v1/auth/web-handoff' && method === 'POST') {
    pruneWebHandoffSessions();
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const authHeader = (req.headers['authorization'] as string) || (req.headers['x-mahi-token'] ? `Bearer ${req.headers['x-mahi-token']}` : '');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const centralUser = await getCentralUserByIdAsync(auth.userId);
    const commUser = getUserById(auth.userId);
    const user = {
      ...(commUser || {}),
      ...(centralUser || {}),
      id: auth.userId,
      email: centralUser?.email || commUser?.email || auth.email,
      name: commUser?.name || centralUser?.name,
      planId: commUser?.planId || centralUser?.planId || 'plan_free',
    };

    if (webHandoffSessions.size >= MAX_WEB_HANDOFF_SESSIONS) {
      const oldestKey = webHandoffSessions.keys().next().value;
      if (oldestKey) webHandoffSessions.delete(oldestKey);
    }

    const handoffCode = `mb_web_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + WEB_HANDOFF_TTL_MS;
    const sessionObj: WebHandoffSession = {
      code: handoffCode,
      userId: auth.userId,
      token,
      user,
      createdAt: now,
      expiresAt,
      used: false,
    };
    webHandoffSessions.set(handoffCode, sessionObj);

    try {
      const db = getDatabase();
      db.prepare(
        'INSERT INTO web_handoff_sessions (code, token, user_json, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)'
      ).run(handoffCode, token, JSON.stringify(user), now, expiresAt);
    } catch (dbErr) {
      console.error('[WEB_HANDOFF] Failed to persist session to SQLite:', dbErr);
    }

    sendJSON(res, 200, {
      success: true,
      handoffCode,
      expiresInSeconds: 120,
      protocolUrl: `mahi://auth?handoff=${encodeURIComponent(handoffCode)}`,
    });
    return true;
  }

  // 2.6 Web-to-Desktop Handoff Code Exchange (Single-Use Anti-Replay)
  if (routePath === '/api/v1/auth/web-handoff/exchange' && method === 'POST') {
    pruneWebHandoffSessions();
    const body = await parseBody(req);
    const handoffCode = body?.handoffCode || body?.code;

    if (!handoffCode || typeof handoffCode !== 'string') {
      sendJSON(res, 400, { success: false, error: 'handoffCode is required.' });
      return true;
    }

    const now = Date.now();
    let token: string | null = null;
    let user: any = null;

    // Fast memory check (handles test mocks that update in-memory session.expiresAt)
    const memSession = webHandoffSessions.get(handoffCode);
    if (memSession && (memSession.used || memSession.expiresAt <= now)) {
      try {
        const db = getDatabase();
        db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(handoffCode);
      } catch {}
      webHandoffSessions.delete(handoffCode);
      sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
      return true;
    }

    // 1. Try atomic SQLite consumption first (Single-Use Anti-Replay)
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM web_handoff_sessions WHERE code = ?').get(handoffCode) as any;
      if (row) {
        if (row.used === 1 || row.expires_at <= now) {
          try { db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(handoffCode); } catch {}
          webHandoffSessions.delete(handoffCode);
          sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
          return true;
        }

        const updateRes = db.prepare(
          'UPDATE web_handoff_sessions SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?'
        ).run(handoffCode, now);

        if (updateRes.changes === 1) {
          token = row.token;
          try {
            user = JSON.parse(row.user_json);
          } catch {
            user = null;
          }
        } else {
          try { db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(handoffCode); } catch {}
          webHandoffSessions.delete(handoffCode);
          sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
          return true;
        }
      }
    } catch {}

    // 2. Fallback or sync with in-memory map
    if (!token) {
      const session = webHandoffSessions.get(handoffCode);
      if (!session || session.used || session.expiresAt <= now) {
        if (session) {
          webHandoffSessions.delete(handoffCode);
        }
        sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
        return true;
      }
      session.used = true;
      token = session.token;
      user = session.user;
    }

    // Always clear from in-memory map once consumed
    webHandoffSessions.delete(handoffCode);

    sendJSON(res, 200, {
      success: true,
      token,
      user,
    });
    return true;
  }

  // 3. Programmatic Google OAuth SSO Endpoint (Used by desktop, mobile, or direct API)
  if (routePath === '/api/v1/auth/google' && method === 'POST') {
    const body = await parseBody(req);
    const googleEmail = (body.email || '').trim().toLowerCase();
    if (!googleEmail || !googleEmail.includes('@')) {
      sendJSON(res, 400, { success: false, error: 'A valid email address is required.' });
      return true;
    }

    const claims: GoogleClaims = {
      sub: body.sub || `google_sub_${crypto.createHash('sha256').update(googleEmail).digest('hex').substring(0, 24)}`,
      email: googleEmail,
      email_verified: body.email_verified !== undefined ? Boolean(body.email_verified) : true,
      name: body.name || googleEmail.split('@')[0],
      picture: body.picture || body.avatarUrl,
    };

    const stateContext: OAuthStateRecord = {
      state: 'direct_post',
      nonce: 'direct_post',
      provider: 'google',
      intent: body.intent || 'trial',
      planId: normalizePlanId(body.planId),
      billingCycle: body.billingCycle || 'annual',
      returnUrl: body.returnUrl || '',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const authResult = await authenticateWithGoogleClaimsAsync(claims, stateContext, clientIp);
    if (!authResult.success) {
      sendJSON(res, 400, { success: false, error: authResult.error });
      return true;
    }

    const entitlements = evaluateUserEntitlements(authResult.user.id);
    const trialStatus = getUserTrialStatus(authResult.user.id);

    sendJSON(res, 200, {
      success: true,
      token: authResult.token,
      tokens: { accessToken: authResult.token },
      user: authResult.user,
      entitlements,
      trialStatus,
      trialActive: trialStatus.isTrialActive,
      trialExpiresAt: trialStatus.trialExpiresAt,
      isNewAccount: authResult.isNewAccount,
      isLinked: authResult.isLinked,
      planId: authResult.user.planId,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/refresh' && method === 'POST') {
    const body = await parseBody(req);
    const refreshToken = body.refreshToken || body.token;
    const result = await refreshAccessToken(refreshToken, clientIp);
    if (!result.success || !result.tokens) {
      sendJSON(res, 401, result);
      return true;
    }
    sendJSON(res, 200, {
      success: true,
      tokens: result.tokens,
      token: result.tokens.accessToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/logout' && method === 'POST') {
    const auth = getAuthUser(req);
    const body = await parseBody(req);
    const sessionId = body.sessionId || (auth as any)?.sessionId;
    if (sessionId) {
      logoutSession(sessionId, clientIp);
    }
    sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
    return true;
  }

  if (routePath === '/api/v1/auth/forgot-password' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'forgot-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await requestPasswordReset(body.email, clientIp);
    sendJSON(res, 200, result);
    return true;
  }

  if (routePath === '/api/v1/auth/reset-password' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'reset-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await resetPasswordWithToken({
      token: body.token,
      newPassword: body.newPassword || body.password,
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/sessions' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const currentSessionId = (auth as any).sessionId;
    const sessions = await listUserSessionsAsync(auth.userId, currentSessionId);
    sendJSON(res, 200, { success: true, data: sessions });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const success = await revokeUserSessionAsync(auth.userId, body.sessionId, clientIp);
    sendJSON(res, 200, { success });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke-all' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const currentSessionId = (auth as any).sessionId;
    const revokedCount = await revokeAllUserSessionsAsync(auth.userId, body.keepCurrent ? currentSessionId : undefined, clientIp);
    sendJSON(res, 200, { success: true, revokedCount });
    return true;
  }

  // -------------------------------------------------------------
  // 2. USER PROFILE & ENTITLEMENTS (Authenticated)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/auth/me' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid Bearer token required.' });
      return true;
    }
    // Look up in central users first, then legacy
    const centralUser = await getCentralUserByIdAsync(auth.userId);
    const commUser = getUserById(auth.userId);
    if (!centralUser && !commUser) {
      sendJSON(res, 404, { success: false, error: 'User not found.' });
      return true;
    }
    const trialStatus = getUserTrialStatus(auth.userId);
    const entitlements = evaluateUserEntitlements(auth.userId);
    const user = {
      ...(commUser || {}),
      ...(centralUser || {}),
      id: auth.userId,
      email: centralUser?.email || commUser?.email,
      name: commUser?.name || centralUser?.name,
      emailVerified: centralUser ? centralUser.emailVerified : true,
      status: centralUser?.status || commUser?.status || 'ACTIVE',
      planId: commUser?.planId || centralUser?.planId || 'plan_free',
      profileQuota: entitlements?.maxProfiles || centralUser?.profileQuota || 15,
    };
    sendJSON(res, 200, { success: true, user, trialStatus, entitlements });
    return true;
  }

  if (routePath === '/api/v1/auth/trial/activate' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const result = activateUserTrial(auth.userId, body.planId || 'professional_50');
    if (result.success) {
      try {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId: auth.userId,
          planId: result.planId,
          ipAddress: clientIp,
        });
      } catch {}
    }
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/trial/status' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const status = getUserTrialStatus(auth.userId);
    sendJSON(res, 200, { success: true, ...status });
    return true;
  }

  // Demo Request Lead Submission
  if (routePath === '/api/v1/commercial/demo-request' && method === 'POST') {
    const body = await parseBody(req);
    const result = createDemoRequest(body);
    sendJSON(res, result.success ? 201 : 400, result);
    return true;
  }

  // Admin: Get Demo Requests
  if (routePath === '/api/v1/commercial/admin/demo-requests' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const statusFilter = parsedUrl.searchParams.get('status') as DemoRequestStatus | undefined;
    const leads = getDemoRequests(statusFilter);
    sendJSON(res, 200, { success: true, data: leads });
    return true;
  }

  // Admin: Update Demo Request Status
  const demoStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/demo-requests\/([a-zA-Z0-9_-]+)\/status$/);
  if (demoStatusMatch && method === 'PUT') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const demoId = demoStatusMatch[1];
    const body = await parseBody(req);
    const result = updateDemoRequestStatus(demoId, body.status, body.adminNotes, adminAuth.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: AI Support Assistant & Payment Escalation Chat Route
  if (
    (routePath === '/api/v1/commercial/support/chat' || routePath === '/api/v1/support/chat') &&
    method === 'POST'
  ) {
    const body = await parseBody(req);
    const result = await handleSupportChatMessage(body);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: Admin: List Support Tickets
  if (routePath === '/api/v1/commercial/admin/support-tickets' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const category = parsedUrl.searchParams.get('category') || undefined;
    const escalatedOnly = parsedUrl.searchParams.get('escalatedOnly') === 'true';
    const tickets = getSupportTickets({ status, category, escalatedOnly });
    sendJSON(res, 200, { success: true, data: tickets });
    return true;
  }

  // Phase 20: Admin: Update Support Ticket Status
  const ticketStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/status$/);
  if (ticketStatusMatch && method === 'PUT') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const ticketId = ticketStatusMatch[1];
    const body = await parseBody(req);
    const result = updateSupportTicketStatus(ticketId, body.status, body.adminNotes, adminAuth.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: Admin: Reply to Support Ticket
  const ticketReplyMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/reply$/);
  if (ticketReplyMatch && method === 'POST') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const ticketId = ticketReplyMatch[1];
    const body = await parseBody(req);
    if (!body.reply || typeof body.reply !== 'string' || !body.reply.trim()) {
      sendJSON(res, 400, { success: false, error: 'Reply text is required.' });
      return true;
    }
    const result = replySupportTicket(ticketId, body.reply.trim(), body.status || 'RESOLVED', body.adminNotes, adminAuth.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Funnel Event Tracking
  if (routePath === '/api/v1/funnel/track' && method === 'POST') {
    const body = await parseBody(req);
    const result = recordFunnelEvent({
      ...body,
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Admin: Funnel Metrics Summary
  if (routePath === '/api/v1/commercial/admin/funnel-metrics' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const metrics = getFunnelMetrics();
    sendJSON(res, 200, { success: true, data: metrics });
    return true;
  }

  if (pathname === '/api/v1/entitlements/check' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const deviceId = parsedUrl.searchParams.get('deviceId') || undefined;
    const deviceName = parsedUrl.searchParams.get('deviceName') || undefined;
    const entitlements = evaluateUserEntitlements(auth.userId, deviceId, deviceName);
    sendJSON(res, 200, { success: true, data: entitlements });
    return true;
  }

  if (pathname === '/api/v1/entitlements/activate-key' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const result = activateCommercialLicenseForUser(auth.userId, body.licenseKey, body.deviceId, body.deviceName);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // -------------------------------------------------------------
  // 3. USER DEVICES (Authenticated)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/devices/my-devices' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const devices = getUserDevices(auth.userId);
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  if (pathname === '/api/v1/devices/revoke' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const ok = revokeCommercialDevice(body.deviceId, { id: auth.userId, name: auth.email, role: auth.role }, auth.userId);
    sendJSON(res, 200, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 4. PLANS & PRICING (Public)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/plans' && method === 'GET') {
    const plans = getCommercialPlans();
    sendJSON(res, 200, { success: true, data: plans });
    return true;
  }

  if ((pathname === '/api/v1/pricing/catalog' || pathname === '/api/v1/plans/catalog') && method === 'GET') {
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 5. SOFTWARE VERSIONS & COMPATIBILITY
  // -------------------------------------------------------------
  if (pathname === '/api/v1/updates/check' && method === 'GET') {
    const clientVersion = parsedUrl.searchParams.get('clientVersion') || '1.0.0';
    const status = checkVersionCompatibility(clientVersion);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 6. ADMIN DASHBOARD & FLEET METRICS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }

    const { users, total: totalUsers } = getAllUsers({ limit: 1000 });
    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
    const suspendedUsers = users.filter((u) => u.status === 'SUSPENDED').length;
    const bannedUsers = users.filter((u) => u.status === 'BANNED').length;

    const licenses = getLicenses();
    const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
    const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;

    const devices = getAllCommercialDevices();
    const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

    const plans = getCommercialPlans(true);
    const { logs: recentAuditLogs } = getCommercialAuditLogs({ limit: 10 });
    const ticketMetrics = getSupportTicketMetrics();

    const stats = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      activeLicenses,
      expiredLicenses,
      activeDevices,
      activeSubscriptions: activeUsers,
      totalPlans: plans.length,
      revenueEstMonthly: activeLicenses * 29,
      recentAuditLogs,
      openTickets: ticketMetrics.open,
      escalatedTickets: ticketMetrics.escalated,
    };

    sendJSON(res, 200, { success: true, data: stats });
    return true;
  }

  // -------------------------------------------------------------
  // 7. ADMIN USER MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/users' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const result = getAllUsers({ status, role, searchQuery: search, limit, offset });
    sendJSON(res, 200, { success: true, data: result.users, total: result.total });
    return true;
  }

  const userStatusMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/status$/);
  if (userStatusMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userStatusMatch[1];
    const body = await parseBody(req);
    const ok = updateUserStatus(userId, body.status, actor, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  const userPlanMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/plan$/);
  if (userPlanMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userPlanMatch[1];
    const body = await parseBody(req);
    const ok = updateUserPlan(userId, body.planId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // Phase 23: Admin Quota Booster (GoLogin Parity)
  const userBoostMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/boost$/);
  if (userBoostMatch && method === 'POST') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userBoostMatch[1];
    const body = await parseBody(req);
    const result = boostUserQuota(userId, body.type, body.amount, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: Admin Enterprise Feature Overrides (MostLogin Parity)
  const userFeaturesMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/features$/);
  if (userFeaturesMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userFeaturesMatch[1];
    const body = await parseBody(req);
    const result = setUserFeatureOverrides(userId, body.overrides || {}, actor);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 23: 1-Click HWID & Machine Unbind (GoLogin Parity)
  const userResetDevicesMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/reset-devices$/);
  if (userResetDevicesMatch && method === 'POST') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userResetDevicesMatch[1];
    const result = resetAllUserDevices(userId, actor);
    sendJSON(res, 200, { success: true, unbindCount: result.unbindCount });
    return true;
  }

  // -------------------------------------------------------------
  // 8. ADMIN PLANS MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/plans' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getCommercialPlans(true) });
    return true;
  }

  if (pathname === '/api/v1/admin/plans' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const newPlan = createCommercialPlan(body, actor);
    sendJSON(res, 201, { success: true, data: newPlan });
    return true;
  }

  const planIdMatch = pathname.match(/^\/api\/v1\/admin\/plans\/([a-zA-Z0-9_-]+)$/);
  if (planIdMatch && method === 'PUT') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const planId = planIdMatch[1];
    const updated = updateCommercialPlan(planId, body, actor);
    sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    return true;
  }

  // -------------------------------------------------------------
  // 8B. ADMIN PRICING VERSIONING & CATALOG (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/pricing/catalog' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/versions' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getAllPricingVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/active' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getActivePricingVersion() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/draft' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const draft = createPricingDraft(body, actor.id, actor.name);
      sendJSON(res, 201, { success: true, data: draft });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingDraftUpdateMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/draft\/(\d+)$/);
  if (pricingDraftUpdateMatch && method === 'PUT') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingDraftUpdateMatch[1], 10);
      const updated = updatePricingDraft(version, body, actor.id, actor.name);
      sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingPreviewMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/preview\/(\d+)$/);
  if (pricingPreviewMatch && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingPreviewMatch[1], 10);
      const preview = previewPricingChanges(version);
      sendJSON(res, 200, { success: true, data: preview });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  const pricingPublishMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/publish\/(\d+)$/);
  if (pricingPublishMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingPublishMatch[1], 10);
      const resPublish = publishPricingVersion(version, actor.id, actor.name);
      sendJSON(res, resPublish.success ? 200 : 400, resPublish);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingRollbackMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/rollback\/(\d+)$/);
  if (pricingRollbackMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingRollbackMatch[1], 10);
      const rolledBack = rollbackPricing(version, actor.id, actor.name);
      sendJSON(res, rolledBack.success ? 200 : 400, rolledBack);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/revenue-summary' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getAdminRevenueSummary() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/provider-sync-status' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getProviderSyncStatus() });
    return true;
  }

  // -------------------------------------------------------------
  // 9. ADMIN LICENSE MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/licenses' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const licenses = getLicenses({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: licenses });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 403, {
      success: false,
      error: 'License minting is disabled in the app. Contact support.',
    });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/revoke' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const ok = revokeLicense(body.licenseId, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/extend' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const record = extendLicense(body);
    sendJSON(res, record ? 200 : 404, { success: Boolean(record), data: record });
    return true;
  }

  // -------------------------------------------------------------
  // 10. ADMIN DEVICE FLEET MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/devices' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const devices = getAllCommercialDevices({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  const deviceRevokeMatch = pathname.match(/^\/api\/v1\/admin\/devices\/([a-zA-Z0-9_-]+)$/);
  if (deviceRevokeMatch && method === 'DELETE') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const deviceId = deviceRevokeMatch[1];
    const ok = revokeCommercialDevice(deviceId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 11. ADMIN AUDIT LOGS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const action = parsedUrl.searchParams.get('action') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const resultStatus = parsedUrl.searchParams.get('result') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const logs = getCommercialAuditLogs({
      action,
      actorRole: role,
      result: resultStatus,
      searchQuery: search,
      limit,
      offset,
    });
    sendJSON(res, 200, { success: true, data: logs.logs, total: logs.total });
    return true;
  }

  // -------------------------------------------------------------
  // 12. ADMIN SOFTWARE VERSIONS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/versions' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getSoftwareVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/versions' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const version = publishSoftwareVersion(body, actor);
    sendJSON(res, 201, { success: true, data: version });
    return true;
  }

  // -------------------------------------------------------------
  // 12.1 ADMIN PAYMENTS & MANUAL UPI APPROVAL (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/payments' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const payments = paymentService.listAdminPayments(status);
    sendJSON(res, 200, { success: true, data: payments, payments });
    return true;
  }

  const paymentApproveMatch = pathname.match(/^\/api\/v1\/admin\/payments\/([a-zA-Z0-9_-]+)\/approve$/);
  if (paymentApproveMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const paymentId = paymentApproveMatch[1];
    try {
      const result = await paymentService.approveManualPayment(paymentId, actor);
      sendJSON(res, 200, {
        success: true,
        payment_id: paymentId,
        status: 'SUCCEEDED',
        message: 'Payment approved successfully.',
        data: result,
      });
      return true;
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
      return true;
    }
  }

  const paymentRejectMatch = pathname.match(/^\/api\/v1\/admin\/payments\/([a-zA-Z0-9_-]+)\/reject$/);
  if (paymentRejectMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const paymentId = paymentRejectMatch[1];
    const reason = body?.reason || 'Payment rejected by administrator';
    try {
      const result = await paymentService.rejectManualPayment(paymentId, actor, reason);
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
      sendJSON(res, 400, { success: false, error: err.message });
      return true;
    }
  }

  // -------------------------------------------------------------
  // 13. STORAGE PROVIDER PRESIGNED ENDPOINTS (Local / S3 Fallback)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/storage/upload' && method === 'PUT') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (storage instanceof LocalStorageProvider) {
      const valid = storage.verifyToken(key, 'upload', expires, token);
      if (!valid) {
        sendJSON(res, 403, { success: false, error: 'Invalid or expired upload signature' });
        return true;
      }
    }

    try {
      const buffer = await parseRawBuffer(req);
      const putResult = await storage.putObject(key, buffer);
      sendJSON(res, 200, { success: true, size: putResult.size });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/storage/download' && method === 'GET') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (storage instanceof LocalStorageProvider) {
      const valid = storage.verifyToken(key, 'download', expires, token);
      if (!valid) {
        sendJSON(res, 403, { success: false, error: 'Invalid or expired download signature' });
        return true;
      }
    }

    try {
      const buffer = await storage.getObject(key);
      if (!buffer) {
        sendJSON(res, 404, { success: false, error: 'Object not found' });
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buffer);
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/storage/delete' && method === 'DELETE') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (storage instanceof LocalStorageProvider) {
      const valid = storage.verifyToken(key, 'delete', expires, token);
      if (!valid) {
        sendJSON(res, 403, { success: false, error: 'Invalid or expired signature' });
        return true;
      }
    }

    try {
      const deleted = await storage.deleteObject(key);
      sendJSON(res, deleted ? 200 : 404, { success: deleted });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 14. PHASE 2 CLOUD PROFILE SYNC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/sync/usage' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Login required for cloud sync.' });
      return true;
    }
    const usage = getUserSyncUsage(user.userId);
    sendJSON(res, 200, { success: true, ...usage });
    return true;
  }

  if (routePath === '/api/v1/sync/list' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profiles = await listUserCloudProfilesAsync(user.userId);
    sendJSON(res, 200, { success: true, profiles });
    return true;
  }

  const syncProfileDetailMatch = routePath.match(/^\/api\/v1\/sync\/profiles?\/([a-zA-Z0-9_-]+)$/);
  if (syncProfileDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profile = await getCloudProfileAsync(user.userId, syncProfileDetailMatch[1]);
    if (!profile) {
      sendJSON(res, 404, { success: false, error: 'Cloud profile not found' });
      return true;
    }
    sendJSON(res, 200, { success: true, profile });
    return true;
  }

  if (syncProfileDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      await deleteCloudProfile(user.userId, syncProfileDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/upload-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createUploadSession(user.userId, body);
      if (result.conflict) {
        sendJSON(res, 409, { success: false, ...result });
      } else {
        sendJSON(res, 200, { success: true, ...result });
      }
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/finalize-upload' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await finalizeUploadSession(
        user.userId,
        body.sessionId,
        body.profileName,
        body.localProfileId,
        body.deviceId,
        body.deviceName
      );
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/download-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createDownloadSession(user.userId, body.cloudProfileId, body.version);
      sendJSON(res, 200, { success: true, data: result });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/acquire' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await acquireProfileLockAsync(
        user.userId,
        body.cloudProfileId,
        body.deviceId,
        body.deviceName,
        body.ttlSeconds
      );
      sendJSON(res, result.acquired ? 200 : 423, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/renew' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await renewProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId, body.ttlSeconds);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/release' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await releaseProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/status' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profileId = parsedUrl.searchParams.get('cloudProfileId') || '';
    const status = await getProfileLockStatusAsync(user.userId, profileId);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 15. PHASE 3 TEAM WORKSPACES & RBAC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/workspaces' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Central login required.' });
      return true;
    }
    const workspaces = listUserTeamWorkspaces(user.userId);
    sendJSON(res, 200, { success: true, workspaces });
    return true;
  }

  if (routePath === '/api/v1/workspaces' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const ws = createTeamWorkspace(user.userId, body);
      sendJSON(res, 201, { success: true, workspace: ws });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/workspaces/invitations/accept' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = acceptWorkspaceInvitation(user.userId, body.token);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsDetailMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)$/);
  if (wsDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const ws = getTeamWorkspace(user.userId, wsDetailMatch[1]);
    if (!ws) {
      sendJSON(res, 404, { success: false, error: 'Workspace not found or access denied.' });
      return true;
    }
    sendJSON(res, 200, { success: true, workspace: ws });
    return true;
  }

  if (wsDetailMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const updated = updateTeamWorkspace(user.userId, wsDetailMatch[1], body);
      sendJSON(res, 200, { success: true, workspace: updated });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  if (wsDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      deleteTeamWorkspace(user.userId, wsDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsTransferMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/transfer-ownership$/);
  if (wsTransferMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      transferWorkspaceOwnership(user.userId, wsTransferMatch[1], body.newOwnerUserId);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsMembersMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members$/);
  if (wsMembersMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const members = getWorkspaceMembers(user.userId, wsMembersMatch[1]);
      sendJSON(res, 200, { success: true, members });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
  if (wsInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await inviteWorkspaceMember(user.userId, wsInviteMatch[1], body.email, body.role);
      sendJSON(res, 201, { success: true, invitation: result });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRoleMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
  if (wsRoleMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      updateMemberRole(user.userId, wsRoleMatch[1], wsRoleMatch[2], body.role);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRemoveMemberMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
  if (wsRemoveMemberMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      removeWorkspaceMember(user.userId, wsRemoveMemberMatch[1], wsRemoveMemberMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsListInvitesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations$/);
  if (wsListInvitesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const invitations = listWorkspaceInvitations(user.userId, wsListInvitesMatch[1]);
      sendJSON(res, 200, { success: true, invitations });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations\/([a-zA-Z0-9_-]+)\/revoke$/);
  if (wsRevokeInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeWorkspaceInvitation(user.userId, wsRevokeInviteMatch[1], wsRevokeInviteMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsProfilesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
  if (wsProfilesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const profiles = listWorkspaceProfiles(user.userId, wsProfilesMatch[1]);
      sendJSON(res, 200, { success: true, profiles });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
  if (wsShareMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const share = shareProfileToWorkspace(user.userId, wsShareMatch[1], body);
      sendJSON(res, 200, { success: true, share });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/([a-zA-Z0-9_-]+)\/share$/);
  if (wsRevokeShareMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeProfileShare(user.userId, wsRevokeShareMatch[1], wsRevokeShareMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsAuditMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/audit-logs$/);
  if (wsAuditMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const logs = getWorkspaceAuditLogs(user.userId, wsAuditMatch[1], limit);
      sendJSON(res, 200, { success: true, logs });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsKeyMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/key$/);
  if (wsKeyMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const envelope = getWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1]);
    sendJSON(res, 200, { success: true, keyEnvelope: envelope });
    return true;
  }

  if (wsKeyMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      setWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1], body.targetUserId, body.encryptedKey);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  sendJSON(res, 404, { success: false, error: `Endpoint ${method} ${pathname} not found.` });
  return true;
}

export async function handleCommercialAPIRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const host = req.headers.host || '127.0.0.1';
  const parsedUrl = new URL(req.url || '/', `http://${host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';
  return handleCommercialApiRoutes(req, res, pathname, method, parsedUrl);
}

