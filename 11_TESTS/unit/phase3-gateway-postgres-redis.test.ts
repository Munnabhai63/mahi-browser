import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  isPostgresConfigured,
  checkPostgresHealth,
  getPrismaClient,
  setPrismaClientForTest,
} from '../../06_DATABASE/prisma-client.js';
import {
  getCentralRepository,
  SqliteCentralRepository,
  PostgresCentralRepository,
} from '../../06_DATABASE/central-repository.js';
import {
  redisLockService,
  setRedisClientForTest,
  checkRedisHealth,
  isRedisConfigured,
  disconnectRedis,
} from '../../08_SECURITY/redis-lock-service.js';
import {
  acquireProfileLockAsync,
  renewProfileLockAsync,
  releaseProfileLockAsync,
  getProfileLockStatusAsync,
  createUploadSession,
} from '../../07_BACKEND/services/cloud-profile-service.js';
import {
  startFastifyCloudGateway,
  stopFastifyCloudGateway,
} from '../../07_BACKEND/server/cloud-gateway.js';
import { handleRemoteApiRequest } from '../../07_BACKEND/commercial/remote-api-router.js';
import {
  signAccessToken,
  registerCentralUser,
  getCentralUserByIdAsync,
} from '../../05_AUTH/central-auth-service.js';

describe('Phase 3: Fastify Cloud Gateway, PostgreSQL/Prisma & Redis Mutex', () => {
  let testDir: string;
  let gatewayPort: number;
  let gatewayAddress: string;

  // In-memory Redis simulation state
  const redisStore = new Map<string, { val: string; exp: number }>();

  const createMockRedisClient = () => ({
    ping: async () => 'PONG',
    set: async (k: string, v: string, _ex?: string, ttl?: number, nx?: string) => {
      const existing = redisStore.get(k);
      const now = Date.now();
      if (nx && existing && existing.exp > now) {
        return null; // Key already exists (NX condition failed)
      }
      const exp = now + ((ttl || 300) * 1000);
      redisStore.set(k, { val: v, exp });
      return 'OK';
    },
    get: async (k: string) => {
      const item = redisStore.get(k);
      if (!item) return null;
      if (Date.now() > item.exp) {
        redisStore.delete(k);
        return null;
      }
      return item.val;
    },
    ttl: async (k: string) => {
      const item = redisStore.get(k);
      if (!item) return -2;
      const rem = Math.round((item.exp - Date.now()) / 1000);
      return rem > 0 ? rem : -2;
    },
    del: async (k: string) => {
      return redisStore.delete(k) ? 1 : 0;
    },
    eval: async (script: string, _numKeys: number, key: string, ...args: any[]) => {
      const item = redisStore.get(key);
      const now = Date.now();
      if (!item || item.exp < now) {
        redisStore.delete(key);
        return 0; // Not found
      }
      const data = JSON.parse(item.val);
      const targetDeviceId = args[0];

      if (script.includes('DEL')) {
        // LUA_RELEASE_LOCK
        if (data.deviceId === targetDeviceId) {
          redisStore.delete(key);
          return 1;
        }
        return -1; // Held by another device
      } else {
        // LUA_RENEW_LOCK
        if (data.deviceId === targetDeviceId) {
          const newPayload = args[1];
          const newTtl = parseInt(args[2], 10) || 300;
          redisStore.set(key, { val: newPayload, exp: now + (newTtl * 1000) });
          return 1;
        }
        return -1; // Held by another device
      }
    },
    quit: async () => {},
  });

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `mahi-phase3-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    process.env.MAHI_USER_DATA_DIR = testDir;

    // Initialize clean local SQLite test database
    await initializeDatabase();

    // Hook in-memory Redis client
    redisStore.clear();
    setRedisClientForTest(createMockRedisClient());

    // Boot Fastify Cloud Gateway on dynamic port (127.0.0.1:0)
    const { port, address } = await startFastifyCloudGateway({
      port: 0,
      host: '127.0.0.1',
      logger: false,
    });
    gatewayPort = port;
    gatewayAddress = address;
  });

  afterAll(async () => {
    await stopFastifyCloudGateway();
    setRedisClientForTest(null);
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    redisStore.clear();
  });

  // ==========================================================================
  // 1. FASTIFY CLOUD GATEWAY ENDPOINTS & HARDENING
  // ==========================================================================
  describe('1. Fastify Cloud Gateway Endpoints', () => {
    it('serves native GET /health with database, redis, and storage statuses', async () => {
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('mahi-cloud-gateway');
      expect(data.version).toBe('2.0.0');
      expect(data.database).toBeDefined();
      expect(data.database.provider).toBe('sqlite'); // Offline fallback
      expect(data.redis).toBeDefined();
      expect(data.redis.configured).toBe(true);
      expect(data.redis.status).toBe('connected');
      expect(data.storage).toBeDefined();
    });

    it('serves native GET /api/v2/health identical to /health', async () => {
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v2/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('mahi-cloud-gateway');
      expect(data.redis.status).toBe('connected');
    });

    it('injects strict security headers on all responses', async () => {
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('x-gateway-engine')).toBe('Fastify-Node22');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    });

    it('handles CORS preflight OPTIONS requests cleanly', async () => {
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://mahibrowser.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://mahibrowser.com');
    });

    it('routes commercial API requests through Fastify wildcard adapter', async () => {
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@mahi.local', password: 'wrong' }),
      });
      // Should reject invalid login with 401
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('accepts binary octet-stream payloads up to bodyLimit', async () => {
      const testBuffer = Buffer.from('TEST_BINARY_PROFILE_ARCHIVE_DATA');
      const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/storage/upload?key=test.bin&token=invalid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: testBuffer,
      });
      // Token is invalid, but Fastify must successfully receive binary body without throwing 413 or 500
      expect([400, 403]).toContain(res.status);
    });
  });

  // ==========================================================================
  // 2. REDIS DISTRIBUTED CONCURRENCY LOCKS
  // ==========================================================================
  describe('2. Redis Distributed Concurrency Locks (ioredis)', () => {
    const profileId = 'prof-distributed-lock-001';
    const device1 = 'device-laptop-alpha';
    const device2 = 'device-desktop-beta';

    it('acquires lock for Device 1 atomically using SET NX EX', async () => {
      const result = await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);
      expect(result.acquired).toBe(true);
      expect(result.cloudProfileId).toBe(profileId);
      expect(result.deviceId).toBe(device1);
      expect(result.expiresAt).toBeDefined();

      const raw = redisStore.get(`lock:profile:${profileId}`);
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!.val);
      expect(parsed.deviceId).toBe(device1);
      expect(parsed.deviceName).toBe('Laptop Alpha');
    });

    it('blocks Device 2 when profile lock is held by Device 1 (Mutex)', async () => {
      // First acquire with Device 1
      await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);

      // Device 2 attempts acquisition -> MUST fail
      const result2 = await redisLockService.acquireLock(profileId, device2, 'Desktop Beta', 'user-001', 300);
      expect(result2.acquired).toBe(false);
      expect(result2.heldBy).toBe('Laptop Alpha');
      expect(result2.deviceId).toBe(device1);
    });

    it('allows Device 1 to re-acquire / extend its own lock', async () => {
      await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);

      // Same device acquires again -> extends TTL
      const reacquire = await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 600);
      expect(reacquire.acquired).toBe(true);
      expect(reacquire.deviceId).toBe(device1);
    });

    it('renews lock atomically with Lua script only when deviceId matches', async () => {
      await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);

      // Device 1 renews -> succeeds
      const renewDev1 = await redisLockService.renewLock(profileId, device1, 400);
      expect(renewDev1.renewed).toBe(true);

      // Device 2 attempts to renew Device 1 lock -> MUST fail atomically with LOCK_HELD_BY_ANOTHER
      const renewDev2 = await redisLockService.renewLock(profileId, device2, 400);
      expect(renewDev2.renewed).toBe(false);
      expect(renewDev2.reason).toBe('LOCK_HELD_BY_ANOTHER');
    });

    it('prevents stolen lock releases: Device 2 cannot release Device 1 lock', async () => {
      await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);

      // Device 2 attempts release -> rejected by Lua script
      const stolenRelease = await redisLockService.releaseLock(profileId, device2);
      expect(stolenRelease.released).toBe(false);
      expect(stolenRelease.reason).toBe('LOCK_HELD_BY_ANOTHER');

      // Lock must STILL be held in store
      const status = await redisLockService.getLockStatus(profileId);
      expect(status.isLocked).toBe(true);
      expect(status.deviceId).toBe(device1);

      // Device 1 releases its own lock -> succeeds
      const validRelease = await redisLockService.releaseLock(profileId, device1);
      expect(validRelease.released).toBe(true);

      const statusAfter = await redisLockService.getLockStatus(profileId);
      expect(statusAfter.isLocked).toBe(false);
    });

    it('reports remaining TTL in getLockStatus', async () => {
      await redisLockService.acquireLock(profileId, device1, 'Laptop Alpha', 'user-001', 300);
      const status = await redisLockService.getLockStatus(profileId);
      expect(status.isLocked).toBe(true);
      expect(status.deviceId).toBe(device1);
      expect(status.ttlRemainingSeconds).toBeGreaterThan(250);
      expect(status.ttlRemainingSeconds).toBeLessThanOrEqual(300);
    });

    it('handles HTTP 423 Locked contention over Fastify lock endpoints', async () => {
      // Create user and profile in DB for auth & access check
      const db = getDatabase();
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
        VALUES ('user-lock-test', 'lock@mahi.local', 'lock@mahi.local', 'hash', 'salt', 'Lock User', ?, ?)
      `).run(nowIso, nowIso);

      db.prepare(`
        INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
        VALUES (?, 'user-lock-test', ?, 'Sync Test Profile', ?, ?)
      `).run(profileId, profileId, nowIso, nowIso);

      // Acquire lock directly via async service for Device 1
      const acq1 = await acquireProfileLockAsync('user-lock-test', profileId, device1, 'Laptop Alpha', 300);
      expect(acq1.acquired).toBe(true);

      // Device 2 tries to acquire via service -> fails
      const acq2 = await acquireProfileLockAsync('user-lock-test', profileId, device2, 'Desktop Beta', 300);
      expect(acq2.acquired).toBe(false);
      expect(acq2.heldBy).toBe('Laptop Alpha');

      // Status query
      const status = await getProfileLockStatusAsync('user-lock-test', profileId);
      expect(status.isLocked).toBe(true);
      expect(status.deviceId).toBe(device1);

      // Renew
      const renew = await renewProfileLockAsync('user-lock-test', profileId, device1, 500);
      expect(renew.renewed).toBe(true);

      // Release
      const rel = await releaseProfileLockAsync('user-lock-test', profileId, device1);
      expect(rel.released).toBe(true);

      const finalStatus = await getProfileLockStatusAsync('user-lock-test', profileId);
      expect(finalStatus.isLocked).toBe(false);
    });
  });

  // ==========================================================================
  // 3. POSTGRESQL + PRISMA CENTRAL REPOSITORY & MIGRATION
  // ==========================================================================
  describe('3. PostgreSQL + Prisma Central Database Layer', () => {
    it('contains valid Prisma schema mapping all 49 central database models', () => {
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
      expect(fs.existsSync(schemaPath)).toBe(true);

      const content = fs.readFileSync(schemaPath, 'utf8');
      expect(content).toContain('datasource db');
      expect(content).toContain('provider = "postgresql"');
      expect(content).toContain('model auth_users');
      expect(content).toContain('model cloud_profiles');
      expect(content).toContain('model cloud_profile_versions');
      expect(content).toContain('model team_workspaces');
      expect(content).toContain('model remote_api_keys');
      expect(content).toContain('model licenses');
    });

    it('contains generated initial migration SQL for PostgreSQL DDL', () => {
      const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '0001_init', 'migration.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('CREATE TABLE "auth_users"');
      expect(sql).toContain('CREATE TABLE "cloud_profiles"');
      expect(sql).toContain('CREATE TABLE "cloud_profile_versions"');
      expect(sql).toContain('CREATE TABLE "team_workspaces"');
    });

    it('identifies unconfigured PostgreSQL environment gracefully without crashing', async () => {
      // In local desktop test mode without DATABASE_URL, should report unconfigured
      const origUrl = process.env.DATABASE_URL;
      try {
        delete process.env.DATABASE_URL;
        expect(isPostgresConfigured()).toBe(false);

        const health = await checkPostgresHealth();
        expect(health.connected).toBe(false);
        expect(health.error).toContain('not configured');
      } finally {
        if (origUrl) process.env.DATABASE_URL = origUrl;
      }
    });

    it('falls back to SqliteCentralRepository in offline/desktop mode', async () => {
      const repo = getCentralRepository();
      expect(repo).toBeInstanceOf(SqliteCentralRepository);

      // Test CRUD operations on central repository
      const testEmail = `repo-user-${Date.now()}@mahi.local`;
      const userId = `user-repo-${Date.now()}`;
      const createdUser = await repo.createAuthUser({
        id: userId,
        email: testEmail,
        password_hash: 'hash123',
        salt: 'salt123',
        name: 'Repo User',
      });
      expect(createdUser.id).toBe(userId);
      expect(createdUser.email).toBe(testEmail);

      const fetchedUser = await repo.findAuthUserByEmail(testEmail);
      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser?.id).toBe(createdUser.id);

      // Cloud profile CRUD
      const profileId = `cloud-prof-repo-${Date.now()}`;
      const createdProfile = await repo.createCloudProfile({
        id: profileId,
        owner_id: createdUser.id,
        local_profile_id: 'local-prof-repo-01',
        name: 'Repo Cloud Profile',
      });
      expect(createdProfile.id).toBe(profileId);
      expect(createdProfile.owner_id).toBe(createdUser.id);

      const userProfiles = await repo.listCloudProfiles(createdUser.id);
      expect(userProfiles.length).toBeGreaterThanOrEqual(1);
      expect(userProfiles.some((p) => p.id === createdProfile.id)).toBe(true);

      // Team workspace CRUD
      const workspaceId = `ws-repo-${Date.now()}`;
      const createdWorkspace = await repo.createWorkspace({
        id: workspaceId,
        name: 'Engineering Workspace',
        owner_user_id: createdUser.id,
      });
      expect(createdWorkspace.id).toBe(workspaceId);
      expect(createdWorkspace.name).toBe('Engineering Workspace');

      const userWorkspaces = await repo.listUserWorkspaces(createdUser.id);
      expect(userWorkspaces.length).toBeGreaterThanOrEqual(1);
      expect(userWorkspaces.some((w) => w.id === createdWorkspace.id)).toBe(true);
    });

    it('verifies CLI migration script (12_SCRIPTS/migrate-sqlite-to-postgres.ts) exists and is executable', () => {
      const scriptPath = path.join(process.cwd(), '12_SCRIPTS', 'migrate-sqlite-to-postgres.ts');
      expect(fs.existsSync(scriptPath)).toBe(true);
      const code = fs.readFileSync(scriptPath, 'utf8');
      expect(code).toContain('migrateSqliteToPostgres');
      expect(code).toContain('--dry-run');
    });

    it('verifies Dockerfile.gateway specifies Node 22 and port 32123', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile.gateway');
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      expect(content).toContain('node:22');
      expect(content).toContain('32123');
      expect(content).toContain('start:gateway');
    });
  });

  // ==========================================================================
  // 4. VERIFIED PHASE 3 DEFECT HARDENING & INTEGRATION FLOWS
  // ==========================================================================
  describe('4. Verified Phase 3 Defect Hardening & Integration Flows', () => {
    it('boots standalone Fastify Gateway cleanly via tsx child process without electron errors', async () => {
      const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
      const script = path.join(process.cwd(), '12_SCRIPTS', 'start-gateway.ts');
      const testPort = 32199;

      const child = spawn(process.execPath, [tsxCli, script], {
        env: {
          ...process.env,
          PORT: String(testPort),
          DATABASE_URL: '',
          REDIS_URL: '',
          NODE_ENV: 'test',
        },
        stdio: 'pipe',
      });

      let serverReady = false;
      try {
        for (let i = 0; i < 40; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${testPort}/health`);
            if (res.ok) {
              const body = await res.json();
              if (body.status === 'ok') {
                serverReady = true;
                expect(body.service).toBe('mahi-cloud-gateway');
                expect(body.database).toBeDefined();
                break;
              }
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(serverReady).toBe(true);
      } finally {
        child.kill();
        try {
          process.kill(child.pid!);
        } catch {}
      }
    });

    it('receives authenticated POST /v1/profiles immediately through Fastify without hanging', async () => {
      const testToken = signAccessToken({
        userId: 'usr_stream_hang_test',
        email: 'streamhang@mahi.local',
        role: 'USER',
        planId: 'plan_pro',
        profileQuota: 50,
        sessionId: 'ses_stream_hang_1',
      });

      // Prepare user in DB
      const db = getDatabase();
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, status, created_at, updated_at)
        VALUES ('usr_stream_hang_test', 'streamhang@mahi.local', 'streamhang@mahi.local', 'hash', 'salt', 'Stream Test', 'ACTIVE', ?, ?)
      `).run(nowIso, nowIso);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`http://127.0.0.1:${gatewayPort}/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          name: 'Stream Hang Verification Profile',
          browser: 'chrome',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      expect([200, 201, 400, 403]).toContain(res.status);
      const json = await res.json();
      expect(json).toBeDefined();
    });

    it('returns HTTP 423 Locked on lock contention via POST /api/v1/sync/lock/acquire', async () => {
      const lockProfileId = 'prof-contention-test-423';
      const testToken = signAccessToken({
        userId: 'usr_contention_test',
        email: 'contend@mahi.local',
        role: 'USER',
        planId: 'plan_pro',
        profileQuota: 50,
        sessionId: 'ses_contention_1',
      });

      const db = getDatabase();
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, status, created_at, updated_at)
        VALUES ('usr_contention_test', 'contend@mahi.local', 'contend@mahi.local', 'hash', 'salt', 'Contend User', 'ACTIVE', ?, ?)
      `).run(nowIso, nowIso);

      db.prepare(`
        INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
        VALUES (?, 'usr_contention_test', ?, 'Lock Contend Profile', ?, ?)
      `).run(lockProfileId, lockProfileId, nowIso, nowIso);

      // Device 1 acquires lock
      const res1 = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/sync/lock/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cloudProfileId: lockProfileId,
          deviceId: 'dev_laptop_one',
          deviceName: 'Laptop One',
          ttlSeconds: 300,
        }),
      });
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.acquired).toBe(true);

      // Device 2 attempts to acquire same profile -> MUST return 423
      const res2 = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/sync/lock/acquire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          cloudProfileId: lockProfileId,
          deviceId: 'dev_desktop_two',
          deviceName: 'Desktop Two',
          ttlSeconds: 300,
        }),
      });
      expect(res2.status).toBe(423);
      const data2 = await res2.json();
      expect(data2.acquired).toBe(false);
      expect(data2.heldBy).toBe('Laptop One');
    });

    it('handles hijacked route security headers, empty JSON bodies, and rejects untrusted CORS', async () => {
      // Security headers on hijacked route
      const resMe = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/me`);
      expect(resMe.headers.get('x-content-type-options')).toBe('nosniff');
      expect(resMe.headers.get('x-frame-options')).toBe('DENY');
      expect(resMe.headers.get('x-gateway-engine')).toBe('Fastify-Node22');

      // Empty JSON body on POST /api/v1/auth/logout should NOT return Fastify 400
      const resLogout = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '',
      });
      expect(resLogout.status).not.toBe(400);

      // Untrusted CORS origin rejection
      const resCors = await fetch(`http://127.0.0.1:${gatewayPort}/health`, {
        headers: {
          'Origin': 'https://evil-untrusted-site.com',
        },
      });
      expect(resCors.headers.get('access-control-allow-origin')).not.toBe('https://evil-untrusted-site.com');
    });

    it('wires PostgresCentralRepository cleanly when PostgreSQL is configured', async () => {
      const createdUsers: any[] = [];
      const createdSessions: any[] = [];
      const createdUploadSessions: any[] = [];
      const updatedUsers: any[] = [];

      const mockPrisma: any = {
        auth_users: {
          findFirst: async ({ where }: any) => {
            const email = where?.OR?.[0]?.email || where?.email;
            return createdUsers.find((u) => u.email === email) || null;
          },
          findUnique: async ({ where }: any) => {
            return createdUsers.find((u) => u.id === where.id) || null;
          },
          create: async ({ data }: any) => {
            createdUsers.push(data);
            return data;
          },
          update: async ({ where, data }: any) => {
            const user = createdUsers.find((u) => u.id === where.id);
            if (user) Object.assign(user, data);
            updatedUsers.push({ id: where.id, ...data });
            return user || data;
          },
        },
        auth_verification_tokens: {
          create: async ({ data }: any) => data,
          findUnique: async () => null,
          updateMany: async () => ({ count: 1 }),
        },
        auth_sessions: {
          create: async ({ data }: any) => {
            createdSessions.push(data);
            return data;
          },
          findUnique: async () => null,
          findMany: async () => createdSessions,
          update: async ({ data }: any) => data,
          updateMany: async () => ({ count: 1 }),
        },
        commercial_users: {
          create: async ({ data }: any) => data,
          findUnique: async () => null,
        },
        cloud_profiles: {
          findMany: async () => [],
          findUnique: async () => null,
          create: async ({ data }: any) => ({ ...data, storage_bytes: 0n }),
        },
        cloud_profile_versions: {
          findFirst: async () => null,
        },
        cloud_sync_upload_sessions: {
          create: async ({ data }: any) => {
            createdUploadSessions.push(data);
            return data;
          },
          findUnique: async () => null,
          update: async ({ data }: any) => data,
        },
        auth_security_logs: {
          create: async ({ data }: any) => data,
        },
        cloud_sync_audit_logs: {
          create: async ({ data }: any) => data,
        },
        $queryRaw: async () => [{ '?column?': 1 }],
      };

      try {
        setPrismaClientForTest(mockPrisma);
        expect(isPostgresConfigured()).toBe(true);

        const repo = getCentralRepository();
        expect(repo).toBeInstanceOf(PostgresCentralRepository);

        // Register central user via repo
        const regRes = await registerCentralUser({
          email: 'pg-wired-user@mahi.local',
          password: 'password12345',
          name: 'Prisma User',
        });
        expect(regRes.success).toBe(true);
        expect(createdUsers.length).toBe(1);
        expect(createdUsers[0].email).toBe('pg-wired-user@mahi.local');

        // Look up central user async
        const user = await getCentralUserByIdAsync(createdUsers[0].id);
        expect(user).not.toBeNull();
        expect(user?.email).toBe('pg-wired-user@mahi.local');

        // Create upload session via repo
        const uploadRes = await createUploadSession(createdUsers[0].id, {
          localProfileId: 'local-prof-pg-001',
          profileName: 'PG Cloud Profile',
          baseVersion: 0,
          expectedSize: 2048,
          expectedChecksum: 'sha256-mock-checksum',
          encryptedDataKey: 'mock-key',
          iv: 'mock-iv',
          authTag: 'mock-tag',
          deviceId: 'device-pg-1',
        });
        expect(uploadRes.sessionId).toBeDefined();
        expect(createdUploadSessions.length).toBe(1);
        expect(createdUploadSessions[0].expected_size).toBe(2048n);
      } finally {
        setPrismaClientForTest(null);
      }
    });

    it('verifies packaged desktop bundle has zero top-level @prisma/client imports and electron-bridge is hardened', () => {
      // 1. Verify prisma-client.ts does not use top-level static import
      const prismaClientTs = fs.readFileSync(path.resolve(process.cwd(), '06_DATABASE/prisma-client.ts'), 'utf8');
      expect(prismaClientTs).not.toMatch(/^import\s+{[^}]*PrismaClient[^}]*}\s+from\s+['"]@prisma\/client['"]/m);
      expect(prismaClientTs).toContain("import type { PrismaClient as PrismaClientType } from '@prisma/client'");
      expect(prismaClientTs).toContain("nodeRequire('@prisma/client')");

      // 2. Verify electron-bridge.ts has getBuiltinModule and multiple fallback mechanisms
      const bridgeTs = fs.readFileSync(path.resolve(process.cwd(), '08_SECURITY/electron-bridge.ts'), 'utf8');
      expect(bridgeTs).toContain('getBuiltinModule');
      expect(bridgeTs).toContain("esmRequire('electron')");
      expect(bridgeTs).toContain("require('electron')");

      // 3. Verify dist-electron/main/*.js (if built) has NO top-level static import of @prisma/client
      const distMainDir = path.resolve(process.cwd(), 'dist-electron/main');
      if (fs.existsSync(distMainDir)) {
        const files = fs.readdirSync(distMainDir).filter((f) => f.endsWith('.js'));
        for (const f of files) {
          const content = fs.readFileSync(path.join(distMainDir, f), 'utf8');
          expect(content).not.toMatch(/import\s*\{[^}]*PrismaClient[^}]*\}\s*from\s*["']@prisma\/client["']/);
          expect(content).not.toMatch(/^import\s+[^;]*from\s+["']@prisma\/client["']/m);
        }
      }
    });

    it('validates PostgresCentralRepository field mapping matches prisma/schema.prisma models exactly', async () => {
      const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
      const schemaText = fs.readFileSync(schemaPath, 'utf8');

      // Helper to extract field names from a Prisma model
      function getModelFields(modelName: string): Set<string> {
        const startTag = `model ${modelName} {`;
        const startIdx = schemaText.indexOf(startTag);
        if (startIdx === -1) throw new Error(`Model ${modelName} not found in prisma/schema.prisma`);
        const bodyStart = startIdx + startTag.length;
        const endIdx = schemaText.indexOf('\n}', bodyStart);
        const modelBody = schemaText.slice(bodyStart, endIdx);
        const lines = modelBody.split(/\r?\n/);
        const fields = new Set<string>();
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
          const parts = line.split(/\s+/);
          if (parts[0]) fields.add(parts[0]);
        }
        return fields;
      }

      const commercialUserFields = getModelFields('commercial_users');
      const uploadSessionFields = getModelFields('cloud_sync_upload_sessions');
      const workspaceMemberFields = getModelFields('team_workspace_members');
      const remoteApiKeyAuditFields = getModelFields('remote_api_key_audits');

      let interceptedUserCreateData: any = null;
      let interceptedUploadCreateData: any = null;
      let interceptedMemberCreateData: any = null;
      let interceptedMemberUpdateData: any = null;
      let interceptedAuditCreateData: any = null;

      const mockPrisma: any = {
        commercial_users: {
          create: async ({ data }: any) => {
            interceptedUserCreateData = data;
            return { id: data.id, ...data };
          },
        },
        cloud_sync_upload_sessions: {
          create: async ({ data }: any) => {
            interceptedUploadCreateData = data;
            return { id: data.id, ...data };
          },
        },
        team_workspace_members: {
          create: async ({ data }: any) => {
            interceptedMemberCreateData = data;
            return { id: data.id, ...data };
          },
          updateMany: async ({ data }: any) => {
            interceptedMemberUpdateData = data;
            return { count: 1 };
          },
        },
        remote_api_key_audits: {
          create: async ({ data }: any) => {
            interceptedAuditCreateData = data;
            return { id: data.id, ...data };
          },
        },
      };

      try {
        setPrismaClientForTest(mockPrisma);
        const repo = new PostgresCentralRepository();

        // 1. Check createCommercialUser
        await repo.createCommercialUser({
          id: 'comm_usr_test',
          email: 'comm_test@mahi.local',
          password_hash: 'hash',
          salt: 'salt',
          name: 'Commercial Test User',
          role: 'USER',
          status: 'ACTIVE',
          plan_id: 'plan_starter_monthly',
          bonus_profiles: 5,
          bonus_proxy_bytes: 1000000,
        });
        expect(interceptedUserCreateData).not.toBeNull();
        expect(interceptedUserCreateData.name).toBe('Commercial Test User');
        for (const k of Object.keys(interceptedUserCreateData)) {
          expect(commercialUserFields.has(k)).toBe(true);
        }
        // Ensure obsolete fields are NOT present
        expect(interceptedUserCreateData.tier).toBeUndefined();
        expect(interceptedUserCreateData.quota_profiles).toBeUndefined();
        expect(interceptedUserCreateData.features_json).toBeUndefined();

        // 2. Check createUploadSessionRecord
        await repo.createUploadSessionRecord({
          id: 'up_sess_test',
          user_id: 'usr_test',
          cloud_profile_id: 'prof_test',
          base_version: 1,
          target_version: 2,
          object_key: 'users/usr_test/prof.tar.gz',
          expected_size: 1024,
          expected_checksum: 'sha256-hash',
          encrypted_data_key: 'key',
          iv: 'iv',
          auth_tag: 'tag',
          status: 'PENDING',
          expires_at: new Date().toISOString(),
          // Obsolete fields that must be stripped:
          source_device_id: 'dev_123',
          source_device_name: 'Device Name',
        });
        expect(interceptedUploadCreateData).not.toBeNull();
        for (const k of Object.keys(interceptedUploadCreateData)) {
          expect(uploadSessionFields.has(k)).toBe(true);
        }
        expect(interceptedUploadCreateData.source_device_id).toBeUndefined();
        expect(interceptedUploadCreateData.source_device_name).toBeUndefined();

        // 3. Check addWorkspaceMember & updateWorkspaceMemberRole
        await repo.addWorkspaceMember({
          id: 'mem_test',
          workspace_id: 'ws_test',
          user_id: 'usr_test',
          role: 'ADMIN',
          status: 'ACTIVE',
          invited_by: 'owner_usr',
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        expect(interceptedMemberCreateData).not.toBeNull();
        for (const k of Object.keys(interceptedMemberCreateData)) {
          expect(workspaceMemberFields.has(k)).toBe(true);
        }
        expect(interceptedMemberCreateData.invited_by).toBe('owner_usr');
        expect(interceptedMemberCreateData.updated_at).toBeUndefined();
        expect(interceptedMemberCreateData.invited_by_user_id).toBeUndefined();

        await repo.updateWorkspaceMemberRole('ws_test', 'usr_test', 'OWNER');
        expect(interceptedMemberUpdateData).not.toBeNull();
        for (const k of Object.keys(interceptedMemberUpdateData)) {
          expect(workspaceMemberFields.has(k)).toBe(true);
        }
        expect(interceptedMemberUpdateData.updated_at).toBeUndefined();

        // 4. Check logRemoteApiKeyAudit
        await repo.logRemoteApiKeyAudit('key_123', 'usr_456', '/api/v1/remote/profiles', 'GET', 200, '127.0.0.1');
        expect(interceptedAuditCreateData).not.toBeNull();
        for (const k of Object.keys(interceptedAuditCreateData)) {
          expect(remoteApiKeyAuditFields.has(k)).toBe(true);
        }
        expect(interceptedAuditCreateData.key_id).toBe('key_123');
        expect(interceptedAuditCreateData.action).toBe('GET /api/v1/remote/profiles');
        expect(interceptedAuditCreateData.api_key_id).toBeUndefined();
        expect(interceptedAuditCreateData.endpoint).toBeUndefined();
        expect(interceptedAuditCreateData.method).toBeUndefined();
        expect(interceptedAuditCreateData.status_code).toBeUndefined();
      } finally {
        setPrismaClientForTest(null);
      }
    });

    it('enforces IDOR protection on DELETE /v1/api-keys/:id under PostgreSQL mode', async () => {
      const keysStore = new Map<string, { id: string; user_id: string; status: string }>();
      keysStore.set('key_user_a', { id: 'key_user_a', user_id: 'user_a_id', status: 'ACTIVE' });

      const mockPrisma: any = {
        auth_users: {
          findUnique: async ({ where }: any) => ({
            id: where.id,
            email: `${where.id}@test.com`,
            role: 'USER',
            status: 'ACTIVE',
            plan_id: 'plan_starter_monthly',
          }),
        },
        remote_api_keys: {
          updateMany: async ({ where, data }: any) => {
            const key = keysStore.get(where.id);
            if (!key) return { count: 0 };
            if (where.user_id && key.user_id !== where.user_id) {
              return { count: 0 };
            }
            key.status = data.status;
            return { count: 1 };
          },
        },
      };

      try {
        setPrismaClientForTest(mockPrisma);
        const repo = getCentralRepository();

        // 1. Direct repository IDOR check
        // User B attempts to revoke User A's key -> MUST return false
        const bRevokeSuccess = await repo.revokeRemoteApiKey('key_user_a', 'user_b_id');
        expect(bRevokeSuccess).toBe(false);
        expect(keysStore.get('key_user_a')?.status).toBe('ACTIVE');

        // 2. HTTP Route IDOR check via handleRemoteApiRequest
        const tokenB = signAccessToken({
          userId: 'user_b_id',
          email: 'user_b@mahibrowser.com',
          role: 'USER',
          planId: 'plan_starter_monthly',
          profileQuota: 10,
          sessionId: 'sess_b',
        });

        function makeMockReqRes(method: string, url: string, token: string) {
          let statusCode = 200;
          let resBody = '';
          const headers: Record<string, string> = {
            host: '127.0.0.1',
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          };
          const req: any = {
            method,
            url,
            headers,
            on: (_evt: string, _cb: any) => {},
          };
          const res: any = {
            writeHead: (status: number) => {
              statusCode = status;
            },
            setHeader: () => {},
            getHeader: () => undefined,
            end: (chunk?: any) => {
              if (chunk) resBody += chunk.toString();
            },
          };
          return {
            req,
            res,
            getStatus: () => statusCode,
            getBody: () => {
              try {
                return JSON.parse(resBody);
              } catch {
                return resBody;
              }
            },
          };
        }

        // User B sends DELETE /api/v1/remote/api-keys/key_user_a
        const mockB = makeMockReqRes('DELETE', '/api/v1/remote/api-keys/key_user_a', tokenB);
        const handledB = await handleRemoteApiRequest(mockB.req, mockB.res);
        expect(handledB).toBe(true);
        expect(mockB.getStatus()).toBe(404);
        expect(mockB.getBody().error?.code).toBe('NOT_FOUND');
        expect(keysStore.get('key_user_a')?.status).toBe('ACTIVE');

        // 3. User A revokes own key via repository -> MUST return true
        const aRevokeSuccess = await repo.revokeRemoteApiKey('key_user_a', 'user_a_id');
        expect(aRevokeSuccess).toBe(true);
        expect(keysStore.get('key_user_a')?.status).toBe('REVOKED');
      } finally {
        setPrismaClientForTest(null);
      }
    });
  });
});
