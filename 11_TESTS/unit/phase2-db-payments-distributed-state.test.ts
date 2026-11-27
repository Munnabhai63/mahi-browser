import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  setCustomDatabasePath,
  closeDatabase,
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { parsePgPoolConfig } from '../../06_DATABASE/pool-config.js';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { setRedisClientForTest } from '../../08_SECURITY/redis-lock-service.js';
import { clearDistributedStateNamespaceAsync } from '../../08_SECURITY/distributed-state-service.js';
import {
  paymentService,
  StripePaymentAdapter,
  YoupiPgPaymentAdapter,
} from '../../07_BACKEND/commercial/payment-service.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  signAccessToken,
  checkLoginRateLimitAsync,
  recordLoginFailureAsync,
  clearLoginAttemptsAsync,
} from '../../05_AUTH/central-auth-service.js';
import {
  checkAuthRateLimitAsync,
  resetAuthRateLimitAsyncForTesting,
} from '../../07_BACKEND/commercial/routes/router-shared.js';
import {
  base32Decode,
  totpGenerate,
  createOwnerSessionAsync,
  isOwnerSessionAsync,
  revokeOwnerSessionAsync,
  clearAllOwnerSessionsAsync,
  checkOwnerVerifyRateLimitAsync,
  recordFailedOwnerVerifyAttemptAsync,
  recordSuccessfulOwnerVerifyAttemptAsync,
  clearOwnerVerifyRateLimitsAsync,
} from '../../07_BACKEND/services/owner-totp-service.js';
import {
  checkRateLimitAsync,
  resetRateLimitsAsync,
} from '../../07_BACKEND/services/remote-api-service.js';
import {
  getEmergencyKillSwitchStateAsync,
  setEmergencyKillSwitchAsync,
  resetKillSwitchForTesting,
} from '../../07_BACKEND/services/kill-switch-service.js';

const TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function seedUser(params: {
  id: string;
  email: string;
  role: string;
  status?: string;
  sessionId?: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT OR REPLACE INTO auth_users
     (id, email, normalized_email, password_hash, salt, name, role, status, email_verified, plan_id, profile_quota, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 'salt', 'Phase2 User', ?, ?, 1, 'free', 15, ?, ?)`
  ).run(params.id, params.email, params.email.toLowerCase(), params.role, params.status ?? 'ACTIVE', now, now);

  db.prepare(
    `INSERT OR REPLACE INTO commercial_users
     (id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at)
     VALUES (?, ?, 'hash', 'salt', 'Phase2 User', ?, ?, 'free', ?, ?)`
  ).run(params.id, params.email, params.role, params.status ?? 'ACTIVE', now, now);

  if (params.sessionId) {
    db.prepare(
      `INSERT OR REPLACE INTO auth_sessions
       (id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, 'dev_p2', 'Phase2 Device', 'win32', '127.0.0.1', 0, ?, ?, ?)`
    ).run(
      params.sessionId,
      params.id,
      `rt_${params.sessionId}_${Date.now()}`,
      now,
      now,
      expiresAt
    );
  }
}

function createAtomicMockRedis() {
  const kv = new Map<string, { value: string; expiresAt: number | null }>();

  const getValidEntry = (key: string) => {
    const entry = kv.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      kv.delete(key);
      return null;
    }
    return entry;
  };

  return {
    kv,
    ping: async () => 'PONG',
    set: async (key: string, value: string, exFlag?: string, ttlSec?: number) => {
      const expiresAt =
        exFlag?.toUpperCase() === 'EX' && typeof ttlSec === 'number'
          ? Date.now() + ttlSec * 1000
          : null;
      kv.set(key, { value: String(value), expiresAt });
      return 'OK';
    },
    get: async (key: string) => {
      const entry = getValidEntry(key);
      return entry ? entry.value : null;
    },
    del: async (key: string) => {
      return kv.delete(key) ? 1 : 0;
    },
    incr: async (key: string) => {
      const entry = getValidEntry(key);
      const next = (entry ? Number(entry.value) || 0 : 0) + 1;
      kv.set(key, { value: String(next), expiresAt: entry ? entry.expiresAt : null });
      return next;
    },
    pexpire: async (key: string, ms: number) => {
      const entry = getValidEntry(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + ms;
      return 1;
    },
    pttl: async (key: string) => {
      const entry = getValidEntry(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.max(1, entry.expiresAt - Date.now());
    },
    ttl: async (key: string) => {
      const entry = getValidEntry(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },
    eval: async (_script: string, _numKeys: number, key: string, windowMsRaw: string) => {
      const windowMs = Math.max(1000, Number.parseInt(String(windowMsRaw), 10) || 60_000);
      const existing = getValidEntry(key);
      const now = Date.now();
      const nextCount = (existing ? Number(existing.value) || 0 : 0) + 1;
      const expiresAt =
        !existing || nextCount === 1 || existing.expiresAt === null ? now + windowMs : existing.expiresAt;
      kv.set(key, { value: String(nextCount), expiresAt });
      return [nextCount, Math.max(1, expiresAt - now)];
    },
    quit: async () => 'OK',
  };
}

function createMockPgBillingPrisma() {
  const users = new Map<string, any>();
  const payments = new Map<string, any>();
  const subscriptions = new Map<string, any>();
  const invoices = new Map<string, any>();
  const webhookEvents = new Map<string, any>();
  const licenses = new Map<string, any>();
  let txChain = Promise.resolve();

  const prisma: any = {
    _stores: {
      users,
      payments,
      subscriptions,
      invoices,
      webhookEvents,
      licenses,
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const run = txChain.then(() => fn(prisma));
      txChain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('INSERT INTO commercial_webhook_events')) {
        const [id, provider, eventType, payloadJson, status, createdAt] = values;
        if (webhookEvents.has(id)) {
          return [];
        }
        webhookEvents.set(id, {
          id,
          provider,
          event_type: eventType,
          payload_json: payloadJson,
          status,
          created_at: createdAt,
        });
        return [{ id }];
      }
      if (sql.includes('UPDATE commercial_payments') && sql.includes('PENDING_VERIFICATION')) {
        const [newStatus, reviewerId, now, id] = values;
        const p = payments.get(id);
        if (!p || p.status !== 'PENDING_VERIFICATION') {
          return [];
        }
        p.status = newStatus;
        p.reviewed_by = reviewerId;
        p.reviewed_at = now;
        p.updated_at = now;
        return [{ id }];
      }
      if (sql.includes('FROM commercial_payments')) {
        if (sql.includes('external_order_id = ? AND status =')) {
          const [orderId] = values;
          for (const p of payments.values()) {
            if (p.external_order_id === orderId && p.status === 'PENDING') {
              return [{ ...p }];
            }
          }
          return [];
        }
        if (sql.includes('WHERE external_payment_id = ? OR external_order_id = ? OR id = ?')) {
          const key = values[0];
          for (const p of payments.values()) {
            if (p.external_payment_id === key || p.external_order_id === key || p.id === key) {
              return [{ ...p }];
            }
          }
          return [];
        }
        if (sql.includes('WHERE id = ? OR external_payment_id = ?')) {
          const key = values[0];
          for (const p of payments.values()) {
            if (p.id === key || p.external_payment_id === key) {
              return [{ ...p }];
            }
          }
          return [];
        }
        if (sql.includes('WHERE external_payment_id = ?')) {
          const extId = values[0];
          for (const p of payments.values()) {
            if (p.external_payment_id === extId) {
              return [{ ...p }];
            }
          }
          return [];
        }
        const [targetId] = values;
        const p = payments.get(targetId);
        return p ? [{ ...p }] : [];
      }
      if (sql.includes('SELECT id, status FROM licenses')) {
        const [id] = values;
        const l = licenses.get(id);
        return l ? [{ id: l.id, status: l.status }] : [];
      }
      if (sql.includes('SELECT id, user_id, plan_id FROM commercial_subscriptions')) {
        const [subId] = values;
        const s = subscriptions.get(subId);
        return s ? [{ id: s.id, user_id: s.user_id, plan_id: s.plan_id }] : [];
      }
      return [];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
      const sql = strings.join('?');
      if (sql.includes('UPDATE commercial_webhook_events SET status =')) {
        const [status, id] = values;
        const evt = webhookEvents.get(id);
        if (evt) evt.status = status;
        return evt ? 1 : 0;
      }
      return 0;
    },
    auth_users: {
      findFirst: async ({ where }: any) => {
        if (where?.id) return users.get(where.id) || null;
        return null;
      },
      findUnique: async ({ where }: any) => {
        if (where?.id) return users.get(where.id) || null;
        return null;
      },
      update: async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (u) Object.assign(u, data);
        return u || null;
      },
    },
    commercial_webhook_events: {
      findFirst: async ({ where }: any) => {
        if (where?.id) return webhookEvents.get(where.id) || null;
        return null;
      },
      findUnique: async ({ where }: any) => {
        if (where?.id) return webhookEvents.get(where.id) || null;
        return null;
      },
      create: async ({ data }: any) => {
        if (webhookEvents.has(data.id)) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        webhookEvents.set(data.id, { ...data });
        return { ...data };
      },
      update: async ({ where, data }: any) => {
        const evt = webhookEvents.get(where.id);
        if (evt) Object.assign(evt, data);
        return evt ? { ...evt } : null;
      },
    },
    commercial_users: {
      findFirst: async ({ where }: any) => {
        if (where?.id) return users.get(where.id) || null;
        return null;
      },
      update: async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (u) Object.assign(u, data);
        return u || null;
      },
    },
    commercial_payments: {
      findFirst: async ({ where }: any) => {
        for (const p of payments.values()) {
          if (where?.id && p.id !== where.id) continue;
          if (where?.external_payment_id && p.external_payment_id !== where.external_payment_id) continue;
          if (where?.external_order_id && p.external_order_id !== where.external_order_id) continue;
          if (where?.user_id && p.user_id !== where.user_id) continue;
          if (where?.utr && p.utr !== where.utr) continue;
          if (where?.OR) {
            const matched = where.OR.some((cond: any) =>
              Object.entries(cond).every(([k, v]) => p[k] === v)
            );
            if (!matched) continue;
          }
          return { ...p };
        }
        return null;
      },
      create: async ({ data }: any) => {
        for (const existing of payments.values()) {
          if (data.external_payment_id && existing.external_payment_id === data.external_payment_id) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
        }
        payments.set(data.id, { ...data });
        return { ...data };
      },
      update: async ({ where, data }: any) => {
        const p = payments.get(where.id);
        if (!p) throw new Error('Payment not found');
        Object.assign(p, data);
        return { ...p };
      },
      findMany: async ({ where }: any) => {
        return Array.from(payments.values()).filter((p) => !where?.user_id || p.user_id === where.user_id);
      },
    },
    commercial_subscriptions: {
      findFirst: async ({ where }: any) => {
        for (const s of subscriptions.values()) {
          if (where?.user_id && s.user_id !== where.user_id) continue;
          if (where?.status && s.status !== where.status) continue;
          return { ...s };
        }
        return null;
      },
      create: async ({ data }: any) => {
        subscriptions.set(data.id, { ...data });
        return { ...data };
      },
      update: async ({ where, data }: any) => {
        const s = subscriptions.get(where.id);
        if (s) Object.assign(s, data);
        return s ? { ...s } : null;
      },
    },
    commercial_billing_invoices: {
      findFirst: async ({ where }: any) => {
        for (const inv of invoices.values()) {
          if (where?.payment_id && inv.payment_id !== where.payment_id) continue;
          return { ...inv };
        }
        return null;
      },
      create: async ({ data }: any) => {
        invoices.set(data.id, { ...data });
        return { ...data };
      },
    },
    licenses: {
      findFirst: async ({ where }: any) => {
        for (const l of licenses.values()) {
          if (where?.account_id && l.account_id !== where.account_id) continue;
          if (where?.notes?.contains && !String(l.notes || '').includes(where.notes.contains)) continue;
          return { ...l };
        }
        return null;
      },
      create: async ({ data }: any) => {
        licenses.set(data.id, { ...data });
        return { ...data };
      },
    },
  };

  return prisma;
}

describe('Phase 2: DB Pool/TLS, Transactional Billing, Distributed State & TOTP Kill Switch', () => {
  let tempDir: string;
  let server: http.Server;
  let baseUrl: string;

  const origTotpSecret = process.env.MAHI_OWNER_TOTP_SECRET;
  const origDatabaseUrl = process.env.DATABASE_URL;
  const origRedisUrl = process.env.REDIS_URL;
  const origYoupiWebhookSecret = process.env.YOUPI_PG_WEBHOOK_SECRET;
  const origKillSwitch = process.env.EMERGENCY_KILL_SWITCH;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-test-'));
    setCustomDatabasePath(path.join(tempDir, 'phase2.sqlite'));
    await initializeDatabase();

    process.env.MAHI_OWNER_TOTP_SECRET = TEST_TOTP_SECRET;

    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Not found' }));
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err?.message || 'Internal error' }));
        }
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (origTotpSecret === undefined) delete process.env.MAHI_OWNER_TOTP_SECRET;
    else process.env.MAHI_OWNER_TOTP_SECRET = origTotpSecret;

    if (origDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = origDatabaseUrl;

    if (origRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = origRedisUrl;

    if (origYoupiWebhookSecret === undefined) delete process.env.YOUPI_PG_WEBHOOK_SECRET;
    else process.env.YOUPI_PG_WEBHOOK_SECRET = origYoupiWebhookSecret;

    if (origKillSwitch === undefined) delete process.env.EMERGENCY_KILL_SWITCH;
    else process.env.EMERGENCY_KILL_SWITCH = origKillSwitch;

    setPrismaClientForTest(null);
    setRedisClientForTest(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.EMERGENCY_KILL_SWITCH;
    setPrismaClientForTest(null);
    setRedisClientForTest(null);

    await resetKillSwitchForTesting();
    await clearAllOwnerSessionsAsync();
    await clearOwnerVerifyRateLimitsAsync();
    await resetAuthRateLimitAsyncForTesting();
    await resetRateLimitsAsync();
    await clearDistributedStateNamespaceAsync('login_lock');

    const db = getDatabase();
    db.prepare('DELETE FROM commercial_webhook_events').run();
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();
    db.prepare('DELETE FROM licenses').run();
  });

  afterEach(async () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.EMERGENCY_KILL_SWITCH;
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_POOL_IDLE_TIMEOUT_MS;
    delete process.env.DB_POOL_CONNECTION_TIMEOUT_MS;
    delete process.env.DB_KEEPALIVE;
    delete process.env.DB_SSL_CA;
    delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
    setPrismaClientForTest(null);
    setRedisClientForTest(null);
    await resetKillSwitchForTesting();
  });

  // =========================================================================
  // 2A: PostgreSQL Pool & TLS Config
  // =========================================================================
  describe('2A — PostgreSQL Pool & TLS Configuration', () => {
    it('builds hardened defaults and honors pool tuning env variables', () => {
      const defaults = parsePgPoolConfig('postgres://user:pass@localhost:5432/mahi');
      expect(defaults.max).toBe(10);
      expect(defaults.idleTimeoutMillis).toBe(60_000);
      expect(defaults.connectionTimeoutMillis).toBe(15_000);
      expect(defaults.keepAlive).toBe(true);
      expect(defaults.keepAliveInitialDelayMillis).toBe(10_000);
      expect(defaults.allowExitOnIdle).toBe(true);

      process.env.DB_POOL_MAX = '24';
      process.env.DB_POOL_IDLE_TIMEOUT_MS = '45000';
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS = '9000';
      process.env.DB_KEEPALIVE = 'false';

      const tuned = parsePgPoolConfig('postgres://user:pass@localhost:5432/mahi');
      expect(tuned.max).toBe(24);
      expect(tuned.idleTimeoutMillis).toBe(45_000);
      expect(tuned.connectionTimeoutMillis).toBe(9000);
      expect(tuned.keepAlive).toBe(false);
      expect(tuned.keepAliveInitialDelayMillis).toBeUndefined();
    });

    it('configures inline/file DB_SSL_CA and strips conflicting sslmode', () => {
      process.env.DB_SSL_CA = '-----BEGIN CERTIFICATE-----\\nTEST_CERT\\n-----END CERTIFICATE-----';
      const inlineSsl = parsePgPoolConfig('postgresql://u:p@db.host:5432/app?sslmode=verify-full');
      expect(inlineSsl.connectionString).not.toContain('sslmode=');
      expect(inlineSsl.ssl).toEqual({
        ca: '-----BEGIN CERTIFICATE-----\nTEST_CERT\n-----END CERTIFICATE-----',
        rejectUnauthorized: true,
      });

      const caFilePath = path.join(tempDir, 'rds-ca.pem');
      fs.writeFileSync(caFilePath, '-----BEGIN CERTIFICATE-----\nFILE_CERT\n-----END CERTIFICATE-----', 'utf8');
      process.env.DB_SSL_CA = caFilePath;
      const fileSsl = parsePgPoolConfig('postgresql://u:p@db.host:5432/app?sslmode=require');
      expect(fileSsl.ssl).toEqual({
        ca: '-----BEGIN CERTIFICATE-----\nFILE_CERT\n-----END CERTIFICATE-----',
        rejectUnauthorized: true,
      });

      delete process.env.DB_SSL_CA;
      const disabledSsl = parsePgPoolConfig('postgresql://u:p@127.0.0.1:5432/app?sslmode=disable');
      expect(disabledSsl.ssl).toBe(false);
    });
  });

  // =========================================================================
  // 2B: Transactional Billing & Webhook Idempotency
  // =========================================================================
  describe('2B — Transactional Billing & Webhook Idempotency', () => {
    it('derives deterministic SHA-256 fallback event IDs instead of Date.now() when upstream omits event id', async () => {
      const youpi = new YoupiPgPaymentAdapter();
      const stripe = new StripePaymentAdapter();
      const rawBody = JSON.stringify({
        type: 'payment.succeeded',
        externalPaymentId: 'pay_det_001',
        metadata: { userId: 'u_det', planId: 'pro', billingCycle: 'MONTHLY' },
      });

      const y1 = youpi.parseWebhookPayload(rawBody);
      const s1 = stripe.parseWebhookPayload(rawBody);
      await new Promise((r) => setTimeout(r, 15));
      const y2 = youpi.parseWebhookPayload(rawBody);
      const s2 = stripe.parseWebhookPayload(rawBody);

      expect(y1.id).toMatch(/^evt_youpi_[a-f0-9]{32}$/);
      expect(y1.id).toBe(y2.id);
      expect(s1.id).toMatch(/^evt_stripe_[a-f0-9]{32}$/);
      expect(s1.id).toBe(s2.id);
    });

    it('prevents duplicate subscriptions/licenses on concurrent identical webhooks in SQLite and PostgreSQL', async () => {
      const userId = 'usr_p2_webhook_race';
      seedUser({ id: userId, email: 'whrace@example.com', role: 'USER', sessionId: 'sess_whrace' });

      const testSecret = 'phase2_youpi_secret_xyz';
      process.env.YOUPI_PG_WEBHOOK_SECRET = testSecret;

      const payloadWithoutEventId = {
        type: 'payment.succeeded',
        provider: 'youpi_pg',
        amount: 5999,
        amountPaise: 599900,
        currency: 'INR',
        externalPaymentId: 'ext_youpi_race_001',
        metadata: { userId, planId: 'pro', billingCycle: 'MONTHLY' },
      };
      const rawBody = JSON.stringify(payloadWithoutEventId);
      const sig = crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');

      // 1. Concurrent SQLite execution
      const sqliteResults = await Promise.all([
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
      ]);
      expect(sqliteResults.every((r) => r.success)).toBe(true);
      expect(sqliteResults[0].eventId).toBe(sqliteResults[1].eventId);

      const db = getDatabase();
      const sqliteEvents = (db.prepare('SELECT COUNT(*) as c FROM commercial_webhook_events').get() as any).c;
      const sqliteSubs = (db.prepare('SELECT COUNT(*) as c FROM commercial_subscriptions WHERE user_id = ?').get(userId) as any).c;
      const sqliteInvs = (db.prepare('SELECT COUNT(*) as c FROM commercial_billing_invoices WHERE user_id = ?').get(userId) as any).c;
      const sqliteLics = (db.prepare('SELECT COUNT(*) as c FROM licenses WHERE account_id = ?').get(userId) as any).c;
      expect(sqliteEvents).toBe(1);
      expect(sqliteSubs).toBe(1);
      expect(sqliteInvs).toBe(1);
      expect(sqliteLics).toBe(1);

      // 2. Concurrent PostgreSQL $transaction execution
      const mockPg = createMockPgBillingPrisma();
      mockPg._stores.users.set(userId, { id: userId, email: 'whrace@example.com', plan_id: 'free', status: 'ACTIVE' });
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mahi_test';
      setPrismaClientForTest(mockPg);

      const pgResults = await Promise.all([
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
        paymentService.handleWebhook('youpi_pg', rawBody, sig),
      ]);
      expect(pgResults.every((r) => r.success)).toBe(true);
      expect(mockPg._stores.webhookEvents.size).toBe(1);
      expect(mockPg._stores.subscriptions.size).toBe(1);
      expect(mockPg._stores.invoices.size).toBe(1);
      expect(mockPg._stores.licenses.size).toBe(1);
      expect(mockPg._stores.users.get(userId).plan_id).toBe('professional_100');
    });

    it('prevents double-approval race conditions in approveManualPayment across SQLite and PostgreSQL', async () => {
      const userId = 'usr_p2_manual_race';
      seedUser({ id: userId, email: 'manualrace@example.com', role: 'USER', sessionId: 'sess_manualrace' });

      const submitted = await paymentService.submitManualUpiPayment({
        userId,
        planId: 'pro',
        billingCycle: 'MONTHLY',
        utr: 'UTR9988776655',
      });

      const [r1, r2] = await Promise.allSettled([
        paymentService.approveManualPayment(submitted.paymentId, { id: 'adm_1', name: 'Admin 1' }),
        paymentService.approveManualPayment(submitted.paymentId, { id: 'adm_2', name: 'Admin 2' }),
      ]);

      const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
      const rejected = [r1, r2].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(String(rejected[0].reason?.message || rejected[0].reason)).toContain('not pending verification');

      const db = getDatabase();
      const sqliteLics = (db.prepare('SELECT COUNT(*) as c FROM licenses WHERE account_id = ?').get(userId) as any).c;
      const sqliteInvs = (db.prepare('SELECT COUNT(*) as c FROM commercial_billing_invoices WHERE user_id = ?').get(userId) as any).c;
      expect(sqliteLics).toBe(1);
      expect(sqliteInvs).toBe(1);

      // Repeat with PostgreSQL conditional WHERE status='PENDING_VERIFICATION' lock
      const mockPg = createMockPgBillingPrisma();
      mockPg._stores.users.set(userId, { id: userId, email: 'manualrace@example.com', plan_id: 'free', status: 'ACTIVE' });
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mahi_test';
      setPrismaClientForTest(mockPg);

      const pgSub = await paymentService.submitManualUpiPayment({
        userId,
        planId: 'pro',
        billingCycle: 'MONTHLY',
        utr: 'UTR1122334455',
      });

      const [pgR1, pgR2] = await Promise.allSettled([
        paymentService.approveManualPayment(pgSub.paymentId, { id: 'adm_1', name: 'Admin 1' }),
        paymentService.approveManualPayment(pgSub.paymentId, { id: 'adm_2', name: 'Admin 2' }),
      ]);
      const pgFulfilled = [pgR1, pgR2].filter((r) => r.status === 'fulfilled');
      const pgRejected = [pgR1, pgR2].filter((r) => r.status === 'rejected');
      expect(pgFulfilled).toHaveLength(1);
      expect(pgRejected).toHaveLength(1);
      expect(mockPg._stores.subscriptions.size).toBe(1);
      expect(mockPg._stores.invoices.size).toBe(1);
      expect(mockPg._stores.licenses.size).toBe(1);
    });

    it('fails fast without falling back to SQLite in strict production Postgres mode if commercial models are missing', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origVitest = process.env.VITEST;
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mahi_prod';
      setPrismaClientForTest({} as any);

      try {
        await expect(
          paymentService.submitManualUpiPayment({
            userId: 'usr_prod_fail',
            planId: 'pro',
            utr: 'UTRPRODFAIL999',
          })
        ).rejects.toThrow(/PG_UNAVAILABLE/);
      } finally {
        process.env.NODE_ENV = origNodeEnv;
        if (origVitest !== undefined) process.env.VITEST = origVitest;
      }
    });
  });

  // =========================================================================
  // 2C: Distributed Redis Rate Limits & Owner Sessions
  // =========================================================================
  describe('2C — Distributed Redis Rate Limits & Owner Sessions', () => {
    it('shares auth, login lockout, remote API rate limits, and owner sessions over Redis', async () => {
      const mockRedis = createAtomicMockRedis();
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      setRedisClientForTest(mockRedis);

      // 1. Auth rate limit (10 attempts in Lua Redis counter)
      for (let i = 0; i < 10; i++) {
        const res = await checkAuthRateLimitAsync('::ffff:198.51.100.25', 'login');
        expect(res.allowed).toBe(true);
      }
      const blockedAuth = await checkAuthRateLimitAsync('198.51.100.25', 'login');
      expect(blockedAuth.allowed).toBe(false);
      expect(blockedAuth.retryAfterSeconds).toBeGreaterThan(0);

      // 2. Central login brute-force lockout stored in Redis
      const loginKey = '198.51.100.25:victim@example.com';
      expect((await checkLoginRateLimitAsync(loginKey)).allowed).toBe(true);
      for (let i = 0; i < 5; i++) {
        await recordLoginFailureAsync(loginKey);
      }
      const locked = await checkLoginRateLimitAsync(loginKey);
      expect(locked.allowed).toBe(false);
      expect(locked.remainingMs).toBeGreaterThan(0);
      await clearLoginAttemptsAsync(loginKey);
      expect((await checkLoginRateLimitAsync(loginKey)).allowed).toBe(true);

      // 3. Owner TOTP session & verify brute-force limit stored in Redis
      const ownerToken = await createOwnerSessionAsync();
      expect(await isOwnerSessionAsync(ownerToken)).toBe(true);
      await revokeOwnerSessionAsync(ownerToken);
      expect(await isOwnerSessionAsync(ownerToken)).toBe(false);

      // Simulate replica-side remote revocation directly in Redis
      const ownerToken2 = await createOwnerSessionAsync();
      expect(await isOwnerSessionAsync(ownerToken2)).toBe(true);
      mockRedis.kv.delete(`mahi:dist:owner_sess:${ownerToken2}`);
      expect(await isOwnerSessionAsync(ownerToken2)).toBe(false);

      for (let i = 0; i < 5; i++) {
        await recordFailedOwnerVerifyAttemptAsync('::ffff:203.0.113.9');
      }
      expect(await checkOwnerVerifyRateLimitAsync('203.0.113.9')).toBe(false);
      await recordSuccessfulOwnerVerifyAttemptAsync('203.0.113.9');
      expect(await checkOwnerVerifyRateLimitAsync('203.0.113.9')).toBe(true);

      // 4. Remote API per-key rate limit stored in Redis
      for (let i = 0; i < 3; i++) {
        expect((await checkRateLimitAsync('key:rk_phase2', 3)).allowed).toBe(true);
      }
      expect((await checkRateLimitAsync('key:rk_phase2', 3)).allowed).toBe(false);
    });
  });

  // =========================================================================
  // 2D: TOTP-Gated Emergency Kill Switch
  // =========================================================================
  describe('2D — TOTP-Gated Emergency Kill Switch', () => {
    it('requires Owner TOTP verification, returns 503 on checkouts/minting/sync when active, and supports env override', async () => {
      const adminId = 'usr_p2_owner';
      const adminSess = 'sess_p2_owner';
      const userId = 'usr_p2_customer';
      seedUser({ id: adminId, email: 'owner_p2@example.com', role: 'SUPER_ADMIN', sessionId: adminSess });
      seedUser({ id: userId, email: 'cust_p2@example.com', role: 'USER', sessionId: 'sess_p2_customer' });

      const adminJwt = signAccessToken({
        userId: adminId,
        email: 'owner_p2@example.com',
        role: 'SUPER_ADMIN',
        planId: 'free',
        profileQuota: 15,
        sessionId: adminSess,
      });

      const userJwt = signAccessToken({
        userId,
        email: 'cust_p2@example.com',
        role: 'USER',
        planId: 'free',
        profileQuota: 15,
        sessionId: 'sess_p2_customer',
      });

      // 1. Non-staff user sees hidden 404 on kill-switch routes (GET & POST)
      const nonStaffGetRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` },
      });
      expect(nonStaffGetRes.status).toBe(404);

      const nonStaffRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userJwt}`,
        },
        body: JSON.stringify({ enabled: true, reason: 'unauthorized' }),
      });
      expect(nonStaffRes.status).toBe(404);

      // 2. Staff without TOTP cookie sees 403 on GET & POST
      const noTotpGetRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminJwt}`,
          Cookie: 'owner_session=testing-bypass',
        },
      });
      expect(noTotpGetRes.status).toBe(403);

      const noTotpRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
          Cookie: 'owner_session=testing-bypass',
        },
        body: JSON.stringify({ enabled: true, reason: 'missing totp' }),
      });
      expect(noTotpRes.status).toBe(403);

      // 3. Verify live TOTP and obtain real owner_session cookie
      const counter = BigInt(Math.floor(Date.now() / 30_000));
      const totpCode = totpGenerate(base32Decode(TEST_TOTP_SECRET), counter);
      const verifyRes = await fetch(`${baseUrl}/api/v1/admin/owner/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
        },
        body: JSON.stringify({ code: totpCode }),
      });
      expect(verifyRes.status).toBe(200);
      const ownerCookie = verifyRes.headers.get('set-cookie')?.match(/owner_session=([^;]+)/)?.[1];
      expect(ownerCookie).toBeTruthy();

      // 4. Enable Kill Switch with verified TOTP session
      const enableRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
          Cookie: `owner_session=${ownerCookie}`,
        },
        body: JSON.stringify({ enabled: true, reason: 'Emergency billing incident drill' }),
      });
      expect(enableRes.status).toBe(200);
      const enableJson = (await enableRes.json()) as any;
      expect(enableJson.enabled).toBe(true);
      expect(enableJson.dbEnabled).toBe(true);

      // 5. All checkout, payment, license minting/activation, trial, webhook, and cloud sync endpoints return 503
      const frozenRequests: Array<Promise<Response>> = [
        fetch(`${baseUrl}/api/v1/billing/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
          body: JSON.stringify({ planId: 'pro', provider: 'youpi_pg' }),
        }),
        fetch(`${baseUrl}/v1/account/payments/upi/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
          body: JSON.stringify({ utr: 'UTR999111222', planId: 'pro' }),
        }),
        fetch(`${baseUrl}/api/v1/entitlements/activate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
          body: JSON.stringify({ licenseKey: 'MAHI-TEST-1234-5678' }),
        }),
        fetch(`${baseUrl}/api/v1/auth/trial/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
          body: JSON.stringify({ planId: 'pro' }),
        }),
        fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminJwt}`,
            Cookie: `owner_session=${ownerCookie}`,
          },
          body: JSON.stringify({ userId, planId: 'pro' }),
        }),
        fetch(`${baseUrl}/api/v1/sync/list`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${userJwt}` },
        }),
        fetch(`${baseUrl}/api/v1/sync/upload-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
          body: JSON.stringify({}),
        }),
      ];

      const responses = await Promise.all(frozenRequests);
      for (const r of responses) {
        expect(r.status).toBe(503);
        const body = (await r.json()) as any;
        expect(body.success).toBe(false);
        expect(body.code).toBe('SERVICE_UNAVAILABLE');
      }

      // Valid signed webhook must also return 503 during kill switch
      process.env.YOUPI_PG_WEBHOOK_SECRET = 'killswitch_wh_sec';
      const whBody = JSON.stringify({
        type: 'payment.succeeded',
        externalPaymentId: 'ext_ks_001',
        metadata: { userId, planId: 'pro' },
      });
      const whSig = crypto.createHmac('sha256', 'killswitch_wh_sec').update(whBody).digest('hex');
      const whRes = await fetch(`${baseUrl}/api/v1/billing/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-youpi-signature': whSig },
        body: whBody,
      });
      expect(whRes.status).toBe(503);

      // 6. Disable Kill Switch via Owner TOTP -> normal non-503 behavior resumes
      const disableRes = await fetch(`${baseUrl}/api/v1/admin/owner/kill-switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
          Cookie: `owner_session=${ownerCookie}`,
        },
        body: JSON.stringify({ enabled: false, reason: 'Incident resolved' }),
      });
      expect(disableRes.status).toBe(200);
      expect(((await disableRes.json()) as any).enabled).toBe(false);

      const syncAfterDisable = await fetch(`${baseUrl}/api/v1/sync/list`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` },
      });
      expect(syncAfterDisable.status).not.toBe(503);

      // 7. EMERGENCY_KILL_SWITCH env override forces freeze even when DB flag is false
      process.env.EMERGENCY_KILL_SWITCH = 'true';
      const stateViaEnv = await getEmergencyKillSwitchStateAsync();
      expect(stateViaEnv.enabled).toBe(true);
      expect(stateViaEnv.source).toBe('env');
      expect(stateViaEnv.envOverride).toBe(true);

      const syncBlockedByEnv = await fetch(`${baseUrl}/api/v1/sync/list`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userJwt}` },
      });
      expect(syncBlockedByEnv.status).toBe(503);

      // Direct service helper respect
      await setEmergencyKillSwitchAsync({ enabled: false, updatedBy: 'TEST' });
      expect((await getEmergencyKillSwitchStateAsync()).enabled).toBe(true);
      delete process.env.EMERGENCY_KILL_SWITCH;
      expect((await getEmergencyKillSwitchStateAsync()).enabled).toBe(false);
    });
  });
});
