import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import {
  setActiveUserId,
  getActiveUserId,
  clearActiveSession,
} from '../../07_BACKEND/commercial/session-context.js';
import {
  saveEncryptedSession,
  getAccountSession,
  clearEncryptedSession,
} from '../../08_SECURITY/account-service.js';
import {
  signToken,
  verifyToken,
  registerUser,
} from '../../07_BACKEND/commercial/commercial-auth-service.js';
import { getJwtSecret } from '../../08_SECURITY/install-secrets.js';
import {
  checkAuthRateLimit,
  resetAuthRateLimitForTesting,
} from '../../07_BACKEND/commercial/commercial-api-router.js';
import { getCommercialPlans } from '../../07_BACKEND/commercial/commercial-plan-service.js';
import {
  registerOrUpdateDevice,
  getUserDevices,
} from '../../07_BACKEND/commercial/commercial-device-service.js';
import {
  logCommercialAudit,
  getCommercialAuditLogs,
} from '../../07_BACKEND/commercial/commercial-audit-service.js';

describe('Task 3: Commercial Auth Split-Brain, Session Persistence & Rate Limiting', () => {
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-comm-auth-session-'));
  const testDbPath = path.join(testDbDir, 'commercial_auth_test.sqlite');

  beforeAll(async () => {
    fs.mkdirSync(testDbDir, { recursive: true });
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    resetAuthRateLimitForTesting();
    clearActiveSession();
  });

  afterEach(() => {
    resetAuthRateLimitForTesting();
    clearActiveSession();
  });

  describe('Session Context & Disk Synchronization (Split-Brain Prevention)', () => {
    it('should set and get active user in memory', () => {
      setActiveUserId('usr_test_123');
      expect(getActiveUserId()).toBe('usr_test_123');
    });

    it('should fall back to encrypted disk session when memory state is uninitialized', () => {
      const testAccountId = `acc_${crypto.randomUUID()}`;
      saveEncryptedSession({
        token: 'test_token',
        account_id: testAccountId,
        email: 'saved@company.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      // Clear only in-memory pointer
      setActiveUserId(null);

      // getActiveUserId should auto-restore from disk session
      expect(getActiveUserId()).toBe(testAccountId);
    });

    it('should clear both memory state and encrypted disk session on logout', () => {
      const testAccountId = `acc_${crypto.randomUUID()}`;
      saveEncryptedSession({
        token: 'test_token',
        account_id: testAccountId,
        email: 'logout_test@company.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      setActiveUserId(testAccountId);
      expect(getActiveUserId()).toBe(testAccountId);

      // Logout
      clearActiveSession();

      expect(getActiveUserId()).toBeNull();
      expect(getAccountSession()).toBeNull();
    });
  });

  describe('Insecure Legacy JWT Secret Elimination', () => {
    it('should verify valid tokens signed with dynamic installation secret', () => {
      const token = signToken({
        userId: 'usr_dyn_secret',
        email: 'dyn@company.com',
        role: 'PRO',
      });

      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('usr_dyn_secret');
      expect(payload?.email).toBe('dyn@company.com');
      expect(payload?.role).toBe('PRO');
    });

    it('should reject tokens forged using insecure legacy static secret', () => {
      // Craft a token using legacy secret 'mahi_commercial_jwt_secret_2026_x893k'
      const legacySecret = 'mahi_commercial_jwt_secret_2026_x893k';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const body = Buffer.from(
        JSON.stringify({
          userId: 'usr_attacker',
          email: 'attacker@evil.com',
          role: 'ADMIN',
          exp,
        })
      ).toString('base64url');
      const signature = crypto.createHmac('sha256', legacySecret).update(`${header}.${body}`).digest('base64url');
      const forgedToken = `${header}.${body}.${signature}`;

      // Verification MUST return null (legacy backdoor closed)
      const result = verifyToken(forgedToken);
      expect(result).toBeNull();
    });
  });

  describe('Password Validation Standardization', () => {
    it('should reject passwords under 8 characters with a clear error', () => {
      const res = registerUser({
        email: 'shortpass@example.com',
        password: '12345',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Password must be at least 8 characters long.');
    });

    it('should reject passwords that are 6-7 characters long', () => {
      const res = registerUser({
        email: 'sixchars@example.com',
        password: '123456',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Password must be at least 8 characters long.');
    });

    it('should accept passwords with 8 or more characters', () => {
      const testEmail = `valid_pass_${Date.now()}@example.com`;
      const res = registerUser({
        email: testEmail,
        password: 'ValidPassword123!',
      });

      expect(res.success).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.email).toBe(testEmail);
    });
  });

  describe('Public Auth Rate Limiter', () => {
    it('should allow initial requests within limit', () => {
      const clientIp = '192.168.1.100';
      const check = checkAuthRateLimit(clientIp, 'test-login');
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(9);
    });

    it('should block after 10 requests from the same IP', () => {
      const clientIp = '10.0.0.55';
      for (let i = 0; i < 10; i++) {
        const check = checkAuthRateLimit(clientIp, 'test-action');
        expect(check.allowed).toBe(true);
      }

      // 11th request must be blocked
      const blocked = checkAuthRateLimit(clientIp, 'test-action');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should allow again after resetting rate limiter store', () => {
      const clientIp = '10.0.0.99';
      for (let i = 0; i < 11; i++) {
        checkAuthRateLimit(clientIp, 'test-reset');
      }

      expect(checkAuthRateLimit(clientIp, 'test-reset').allowed).toBe(false);

      resetAuthRateLimitForTesting();
      expect(checkAuthRateLimit(clientIp, 'test-reset').allowed).toBe(true);
    });
  });

  describe('Database Schema & Self-Healing Guards', () => {
    it('should successfully seed commercial plans with updated_at', () => {
      const plans = getCommercialPlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);
      for (const plan of plans) {
        expect(plan.id).toBeDefined();
        expect(plan.name).toBeDefined();
        expect(plan.tier).toBeDefined();
      }
    });

    it('should register and retrieve commercial devices with status and created_at', () => {
      const userRes = registerUser({
        email: `dev_owner_${Date.now()}@example.com`,
        password: 'ValidPassword123!',
      });
      expect(userRes.success).toBe(true);
      const testUserId = userRes.user!.id;

      const devRes = registerOrUpdateDevice({
        userId: testUserId,
        deviceId: `hwid_${crypto.randomUUID()}`,
        deviceName: 'Vitest Test Laptop',
      });

      expect(devRes.success).toBe(true);
      expect(devRes.device).toBeDefined();
      expect(devRes.device?.status).toBe('ACTIVE');

      const devices = getUserDevices(testUserId);
      expect(devices.length).toBe(1);
      expect(devices[0].deviceName).toBe('Vitest Test Laptop');
      expect(devices[0].status).toBe('ACTIVE');
    });

    it('should record and query commercial audit logs without table errors', () => {
      const log = logCommercialAudit({
        actorId: 'usr_audit_tester',
        actorName: 'Audit Tester',
        actorRole: 'ADMIN',
        action: 'TASK3_AUDIT_VERIFY',
        targetType: 'TEST',
        details: 'Testing audit logs schema integrity',
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe('TASK3_AUDIT_VERIFY');

      const { logs, total } = getCommercialAuditLogs({ action: 'TASK3_AUDIT_VERIFY' });
      expect(total).toBeGreaterThanOrEqual(1);
      expect(logs.some((l) => l.id === log.id)).toBe(true);
    });
  });
});
