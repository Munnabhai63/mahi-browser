import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { getDatabase, initSqlEngine, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { proxyProviderService, UserContext } from '../../07_BACKEND/services/proxy-provider-service.js';
import { getProxyById, getDecryptedProxyCredentials } from '../../02_BROWSER/services/proxy-service.js';
import { createProfile, getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { createWorkspace, addWorkspaceMember } from '../../02_BROWSER/services/workspace-service.js';

describe('Phase 5: Commercial Proxy Provider Platform — Integration Tests', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-proxy-platform-isolated');
  const testDbPath = path.join(testDbDir, 'proxy_platform_test.sqlite');

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Database Migration v13 Validation', () => {
    it('should have applied migration v13 and created all Phase 5 tables', () => {
      const db = getDatabase();
      const migration = db.prepare('SELECT version FROM schema_migrations WHERE version = 13').get();
      expect(migration).toBeDefined();

      const providersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proxy_providers'").get();
      expect(providersTable).toBeDefined();

      const sessionsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proxy_provider_sessions'").get();
      expect(sessionsTable).toBeDefined();

      const usageTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proxy_usage_records'").get();
      expect(usageTable).toBeDefined();
    });
  });

  describe('2. Catalog Resolution & Provider Health', () => {
    it('should return available countries, network types, and provider statuses', async () => {
      const catalog = await proxyProviderService.getCatalog({ networkType: 'RESIDENTIAL' });
      expect(catalog.availableCountries.length).toBeGreaterThan(0);
      expect(catalog.supportedNetworkTypes).toContain('RESIDENTIAL');
      expect(catalog.supportedNetworkTypes).toContain('MOBILE');
      expect(catalog.supportedSessionTypes).toContain('STICKY');

      const usOption = catalog.availableCountries.find((c) => c.code === 'US');
      expect(usOption).toBeDefined();
      expect(usOption?.cities).toBeDefined();
    });

    it('should list all registered providers with live health metadata', async () => {
      const providers = await proxyProviderService.getProviders();
      expect(providers.length).toBeGreaterThanOrEqual(4);

      const mockInfo = providers.find((p) => p.id === 'mock');
      expect(mockInfo).toBeDefined();
      expect(mockInfo?.status).toBe('HEALTHY');
      expect(mockInfo?.isConfigured).toBe(true);
    });
  });

  describe('3. End-to-End Session Generation & Canonical Normalization', () => {
    it('should generate a residential proxy session, store encrypted credentials at rest, and persist canonical proxy', async () => {
      const userCtx: UserContext = {
        userId: 'usr_phase5_test_1',
        planTier: 'PRO',
        proxyAccess: true,
      };

      const result = await proxyProviderService.generateSession(
        {
          providerId: 'mock',
          networkType: 'RESIDENTIAL',
          country: 'US',
          city: 'New York',
          sessionType: 'STICKY',
          ttlMinutes: 30,
        },
        userCtx
      );

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.proxy).toBeDefined();

      // Verify canonical proxy item
      expect(result.proxy.host).toBe('127.0.0.1');
      expect(result.proxy.port).toBe(8080);
      expect(result.proxy.countryRegion).toBe('US');
      expect(result.proxy.city).toBe('New York');

      // Verify DB storage of canonical proxy
      const savedProxy = getProxyById(result.proxy.id);
      expect(savedProxy).toBeDefined();
      expect(savedProxy?.hasPassword).toBe(true);

      // Verify encrypted credential retrieval for browser launcher tunnel
      const decrypted = getDecryptedProxyCredentials(result.proxy.id);
      expect(decrypted).toBeDefined();
      expect(decrypted?.username).toBeDefined();
      expect(decrypted?.password).toBeDefined();

      // Verify session record in DB
      const sessionInDb = proxyProviderService.getSessionById(result.session.id);
      expect(sessionInDb).toBeDefined();
      expect(sessionInDb?.status).toBe('ACTIVE');
      expect(sessionInDb?.country).toBe('US');
      expect(sessionInDb?.ttlMinutes).toBe(30);
    });
  });

  describe('4. Direct Profile Assignment & Launcher Compatibility', () => {
    it('should automatically assign generated proxy to a profile and verify launcher mapping', async () => {
      const db = getDatabase();
      const profileId = crypto.randomUUID();
      const profileName = 'Phase5-Assigned-Profile';

      // Create test profile
      const newProfile = createProfile({
        name: profileName,
        browserEngine: '138.0.7204.183',
      });

      const userCtx: UserContext = {
        userId: 'usr_phase5_test_2',
        planTier: 'PRO',
        proxyAccess: true,
      };

      // Generate proxy and bind directly to profile
      const genResult = await proxyProviderService.generateSession(
        {
          providerId: 'mock',
          networkType: 'MOBILE',
          country: 'GB',
          sessionType: 'ROTATING',
          profileId: newProfile.id,
        },
        userCtx
      );

      // Verify profile record was updated with proxy_id
      const updatedProfile = getProfileById(newProfile.id);
      expect(updatedProfile?.settings?.network?.proxyId).toBe(genResult.proxy.id);

      // Verify profile_proxies junction table mapping
      const junctionRow = db.prepare('SELECT * FROM profile_proxies WHERE profile_id = ?').get(newProfile.id) as any;
      expect(junctionRow).toBeDefined();
      expect(junctionRow.proxy_id).toBe(genResult.proxy.id);
    });
  });

  describe('5. Session Rotation & Lifecycle', () => {
    it('should rotate session IP address, increment counter, and update canonical proxy', async () => {
      const userCtx: UserContext = {
        userId: 'usr_phase5_test_3',
        planTier: 'PRO',
        proxyAccess: true,
      };

      const gen = await proxyProviderService.generateSession(
        {
          providerId: 'mock',
          networkType: 'RESIDENTIAL',
          country: 'DE',
          sessionType: 'ROTATING',
        },
        userCtx
      );

      const initialIp = gen.proxy.ip;

      // Rotate session
      const rotResult = await proxyProviderService.rotateSession(gen.session.id, userCtx);
      expect(rotResult.success).toBe(true);
      expect(rotResult.rotationCount).toBe(1);
      expect(rotResult.newIp).toBeDefined();
      expect(rotResult.newIp).not.toBe(initialIp);

      // Verify updated session
      const reloadedSession = proxyProviderService.getSessionById(gen.session.id);
      expect(reloadedSession?.rotationCount).toBe(1);
    });

    it('should revoke session and clean up proxy from database', async () => {
      const userCtx: UserContext = {
        userId: 'usr_phase5_test_4',
        planTier: 'PRO',
        proxyAccess: true,
      };

      const gen = await proxyProviderService.generateSession(
        {
          providerId: 'mock',
          networkType: 'DATACENTER',
          country: 'IN',
          sessionType: 'STICKY',
        },
        userCtx
      );

      const releaseOk = await proxyProviderService.releaseSession(gen.session.id, userCtx);
      expect(releaseOk).toBe(true);

      const revokedSession = proxyProviderService.getSessionById(gen.session.id);
      expect(revokedSession?.status).toBe('REVOKED');

      // Canonical proxy removed
      const deletedProxy = getProxyById(gen.proxy.id);
      expect(deletedProxy).toBeNull();
    });
  });

  describe('6. Plan & Entitlement Enforcement', () => {
    it('should reject built-in proxy generation for Free tier accounts without proxy access', async () => {
      const freeUserCtx: UserContext = {
        userId: 'usr_free_account',
        planTier: 'FREE',
        proxyAccess: false,
      };

      await expect(
        proxyProviderService.generateSession(
          {
            providerId: 'mock',
            networkType: 'RESIDENTIAL',
            country: 'US',
            sessionType: 'STICKY',
          },
          freeUserCtx
        )
      ).rejects.toThrow(/subscription/i);
    });
  });

  describe('7. Cross-User IDOR Isolation & RBAC Security', () => {
    it('should prevent User B from rotating or releasing User A sessions', async () => {
      const userA: UserContext = {
        userId: 'usr_owner_A',
        planTier: 'PRO',
        proxyAccess: true,
      };

      const userB: UserContext = {
        userId: 'usr_attacker_B',
        planTier: 'PRO',
        proxyAccess: true,
      };

      const genA = await proxyProviderService.generateSession(
        {
          providerId: 'mock',
          networkType: 'RESIDENTIAL',
          country: 'US',
          sessionType: 'STICKY',
        },
        userA
      );

      // User B attempts to rotate User A's session
      await expect(
        proxyProviderService.rotateSession(genA.session.id, userB)
      ).rejects.toThrow(/Access denied/i);

      // User B attempts to release User A's session
      await expect(
        proxyProviderService.releaseSession(genA.session.id, userB)
      ).rejects.toThrow(/Access denied/i);
    });
  });
});
