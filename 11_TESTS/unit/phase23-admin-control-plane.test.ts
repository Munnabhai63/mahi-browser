import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import http from 'node:http';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  registerUser,
  getUserById,
  boostUserQuota,
  setUserFeatureOverrides,
  signToken,
} from '../../07_BACKEND/commercial/commercial-auth-service.js';
import {
  evaluateUserEntitlements,
} from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import {
  registerOrUpdateDevice,
  resetAllUserDevices,
} from '../../07_BACKEND/commercial/commercial-device-service.js';
import {
  handleSupportChatMessage,
  getSupportTickets,
  getSupportTicketMetrics,
  replySupportTicket,
  updateSupportTicketStatus,
} from '../../07_BACKEND/commercial/support-ticket-service.js';
import {
  handleCommercialAPIRequest,
} from '../../07_BACKEND/commercial/commercial-api-router.js';

describe('PHASE 23 — Admin Panel & Operations Control Plane (GoLogin & MostLogin Parity)', () => {
  const adminActor = {
    id: 'admin_test_1',
    name: 'Super Admin',
    role: 'SUPER_ADMIN' as const,
  };

  let testUserId: string;
  const testEmail = `operator_${Date.now()}@example.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const reg = registerUser({
      email: testEmail,
      password: 'SecurePassword123!',
      name: 'Operations Test User',
    });
    expect(reg.success).toBe(true);
    testUserId = reg.user!.id;
  });

  describe('1. GoLogin-Style Instant Quota Boosters', () => {
    it('boosts profiles quota (+10 profiles) immediately without changing user plan', () => {
      const initialUser = getUserById(testUserId);
      const initialBonus = initialUser?.bonusProfiles || 0;

      const boostRes = boostUserQuota(testUserId, 'PROFILES', 10, adminActor);
      expect(boostRes.success).toBe(true);
      expect(boostRes.bonusProfiles).toBe(initialBonus + 10);

      const refreshed = getUserById(testUserId);
      expect(refreshed?.bonusProfiles).toBe(initialBonus + 10);
    });

    it('boosts proxy data quota (+5 GB) immediately in bytes', () => {
      const boostRes = boostUserQuota(testUserId, 'PROXY_GB', 5, adminActor);
      expect(boostRes.success).toBe(true);
      expect(boostRes.bonusProxyBytes).toBe(5 * 1024 * 1024 * 1024);

      const refreshed = getUserById(testUserId);
      expect(refreshed?.bonusProxyBytes).toBe(5 * 1024 * 1024 * 1024);
    });

    it('entitlement evaluator factors bonus profiles directly into maxProfiles limit', () => {
      const entitlements = evaluateUserEntitlements(testUserId);
      expect(entitlements.allowed).toBe(true);
      // Free plan default is 15 profiles; with +10 booster it should be 25
      expect(entitlements.limits.maxProfiles).toBe(entitlements.plan.limits.maxProfiles + 10);
    });
  });

  describe('2. MostLogin-Style Enterprise Feature Overrides', () => {
    it('toggles enterprise capabilities per user account regardless of tier', () => {
      const initialEntitlements = evaluateUserEntitlements(testUserId);
      // On free plan, synchronizer and multi-core are false by default
      expect(initialEntitlements.capabilities?.['automation.synchronizer']).toBe(false);
      expect(initialEntitlements.capabilities?.['stealth.multiCore']).toBe(false);

      // Admin activates enterprise overrides
      const overrideRes = setUserFeatureOverrides(
        testUserId,
        {
          qunkong: true,
          multiCore: true,
          apiDaemon: true,
          rpa: true,
        },
        adminActor
      );
      expect(overrideRes.success).toBe(true);
      expect(overrideRes.overrides?.qunkong).toBe(true);

      // Entitlement engine must now grant the overridden capabilities
      const activeEntitlements = evaluateUserEntitlements(testUserId);
      expect(activeEntitlements.capabilities?.['automation.synchronizer']).toBe(true);
      expect(activeEntitlements.capabilities?.['stealth.multiCore']).toBe(true);
      expect(activeEntitlements.capabilities?.['api.localDaemon']).toBe(true);
      expect(activeEntitlements.capabilities?.['automation.rpa']).toBe(true);
    });
  });

  describe('3. GoLogin-Style 1-Click HWID & Machine Reset', () => {
    it('unbinds all active machines and hardware locks for a user', () => {
      // First clean up any existing devices for this user
      resetAllUserDevices(testUserId);

      // Register 2 distinct devices
      const d1 = registerOrUpdateDevice({
        userId: testUserId,
        deviceId: 'hwid_pc_alpha_' + Math.random().toString(36).slice(2),
        deviceName: 'Workstation Alpha',
        maxAllowedDevices: 5,
      });
      const d2 = registerOrUpdateDevice({
        userId: testUserId,
        deviceId: 'hwid_pc_beta_' + Math.random().toString(36).slice(2),
        deviceName: 'Workstation Beta',
        maxAllowedDevices: 5,
      });
      expect(d1.success).toBe(true);
      expect(d2.success).toBe(true);

      const unbindRes = resetAllUserDevices(testUserId, adminActor);
      expect(unbindRes.success).toBe(true);
      expect(unbindRes.unbindCount).toBe(2);

      const db = getDatabase();
      const devCount = (db.prepare('SELECT COUNT(*) as c FROM commercial_devices WHERE user_id = ?').get(testUserId) as any).c;
      expect(devCount).toBe(0);
    });
  });

  describe('4. Support Desk Ticket Management & Live Reply Inbox', () => {
    let ticketId: string;
    let ticketNumber: string;

    it('creates escalated payment ticket and records in support inbox', async () => {
      const chatRes = await handleSupportChatMessage({
        message: 'My credit card was charged twice for Pro plan ₹2,199. Please refund transaction #TXN9941.',
        userEmail: testEmail,
        userName: 'Customer In Need',
        source: 'landing_chat',
      });

      expect(chatRes.success).toBe(true);
      expect(chatRes.isPaymentEscalated).toBe(true);
      expect(chatRes.ticketNumber).toBeDefined();
      expect(chatRes.ticketId).toBeDefined();

      ticketId = chatRes.ticketId!;
      ticketNumber = chatRes.ticketNumber!;

      const tickets = getSupportTickets({ category: 'PAYMENT' });
      const found = tickets.find(t => t.id === ticketId);
      expect(found).toBeDefined();
      expect(found?.status).toBe('OPEN');
      expect(found?.isEscalated).toBe(true);
    });

    it('returns accurate support desk metrics (open, escalated, resolved counts)', () => {
      const metrics = getSupportTicketMetrics();
      expect(metrics.total).toBeGreaterThan(0);
      expect(metrics.open).toBeGreaterThan(0);
      expect(metrics.escalated).toBeGreaterThan(0);
    });

    it('allows admin to dispatch official reply and mark ticket resolved', () => {
      const replyRes = replySupportTicket(
        ticketId,
        'We verified the duplicate charge and initiated a ₹2,199 refund to your bank account.',
        'RESOLVED',
        'Refund processed via Payment Gateway Ref #RFD-1029',
        adminActor.name
      );

      expect(replyRes.success).toBe(true);
      expect(replyRes.data?.status).toBe('RESOLVED');
      expect(replyRes.data?.reply).toContain('We verified the duplicate charge');
      expect(replyRes.data?.adminNotes).toContain('RFD-1029');

      const tickets = getSupportTickets();
      const updated = tickets.find(t => t.id === ticketId);
      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.reply).toBeDefined();
    });
  });

  describe('5. HTTP Admin Router Endpoints Integration', () => {
    // Helper to mock incoming HTTP request and response
    function mockHttp(method: string, url: string, bodyObj?: any, headers: Record<string, string> = {}) {
      const rawBody = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : Buffer.alloc(0);
      const req = Object.assign(new http.IncomingMessage(null as any), {
        method,
        url,
        headers: {
          'content-type': 'application/json',
          'content-length': String(rawBody.length),
          ...headers,
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      });

      let resData = '';
      let statusCode = 200;
      const res = Object.assign(new http.ServerResponse(req), {
        writeHead: (code: number) => { statusCode = code; return res; },
        setHeader: () => res,
        end: (chunk?: any) => {
          if (chunk) resData += chunk.toString();
          return res;
        },
      });

      // Emit body data synchronously for parseBody
      process.nextTick(() => {
        if (rawBody.length > 0) req.emit('data', rawBody);
        req.emit('end');
      });

      return { req, res, getResult: () => ({ statusCode, json: resData ? JSON.parse(resData) : null }) };
    }

    const adminAuthHeader = {
      authorization: 'Bearer ' + signToken({ userId: 'admin_root', email: 'admin@mahibrowser.com', role: 'SUPER_ADMIN' }),
    };

    it('serves admin dashboard with openTickets and escalatedTickets', async () => {
      const { req, res, getResult } = mockHttp('GET', '/api/v1/admin/dashboard', undefined, adminAuthHeader);
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);
      const { statusCode, json } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.openTickets).toBeDefined();
      expect(json.data.escalatedTickets).toBeDefined();
    });

    it('rejects unauthenticated booster requests with 403', async () => {
      const { req, res, getResult } = mockHttp('POST', `/api/v1/admin/users/${testUserId}/boost`, {
        type: 'PROFILES',
        amount: 10,
      });
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);
      const { statusCode } = getResult();
      expect(statusCode).toBe(403);
    });

    it('executes booster request with valid admin secret header', async () => {
      const { req, res, getResult } = mockHttp('POST', `/api/v1/admin/users/${testUserId}/boost`, {
        type: 'PROFILES',
        amount: 5,
      }, adminAuthHeader);
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);
      const { statusCode, json } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(json.bonusProfiles).toBeDefined();
    });

    it('executes enterprise feature overrides via router', async () => {
      const { req, res, getResult } = mockHttp('PUT', `/api/v1/admin/users/${testUserId}/features`, {
        overrides: { qunkong: true },
      }, adminAuthHeader);
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);
      const { statusCode, json } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(json.overrides.qunkong).toBe(true);
    });

    it('executes 1-click device reset via router', async () => {
      const { req, res, getResult } = mockHttp('POST', `/api/v1/admin/users/${testUserId}/reset-devices`, {}, adminAuthHeader);
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);
      const { statusCode, json } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
