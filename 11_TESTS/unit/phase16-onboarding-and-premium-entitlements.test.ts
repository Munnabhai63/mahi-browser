import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  getStarterTemplates,
  getStarterTemplateById,
  isUserNew,
  getRealUserProfileCount,
  createProfileFromStarter,
} from '../../02_BROWSER/services/starter-profiles-service.js';
import {
  checkCapability,
  assertEntitled,
  evaluateUserEntitlements,
  resolveCapabilitiesForPlan,
} from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import {
  getCommercialPlanById,
  DEFAULT_COMMERCIAL_PLANS,
} from '../../07_BACKEND/commercial/commercial-plan-service.js';
import { registerUser } from '../../07_BACKEND/commercial/commercial-auth-service.js';
import { assertCapability } from '../../08_SECURITY/freemium-guard.js';
import { getProfiles, deleteProfile } from '../../02_BROWSER/services/profile-service.js';

describe('Phase 16 — New User Clean Onboarding, Starter Profiles & Premium Entitlement System', () => {
  const tempDir = path.resolve('.mahi_data', 'test-onboarding-entitlements');
  const dbPath = path.join(tempDir, 'onboarding_entitlements_test.sqlite');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    setCustomDatabasePath(dbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // =========================================================================
  // 1. STARTER DEMO PROFILES CATALOG & ISOLATION
  // =========================================================================
  describe('Starter / Demo Profile Templates Model', () => {
    it('returns exactly 6 starter templates with distinct professional categories', () => {
      const templates = getStarterTemplates();
      expect(templates.length).toBe(6);

      const categories = templates.map((t) => t.category);
      expect(categories).toContain('PERSONAL');
      expect(categories).toContain('SOCIAL');
      expect(categories).toContain('E-COMMERCE');
      expect(categories).toContain('WORK');
      expect(categories).toContain('AUTOMATION');
      expect(categories).toContain('SANDBOX');
    });

    it('clearly marks all templates with subtle demo badges', () => {
      const templates = getStarterTemplates();
      templates.forEach((tpl) => {
        expect(['STARTER', 'DEMO', 'EXAMPLE']).toContain(tpl.badge);
      });
    });

    it('guarantees zero real credentials, zero cookies, zero passwords, and zero active sessions', () => {
      const templates = getStarterTemplates();
      templates.forEach((tpl) => {
        // Must have valid isolated default settings
        expect(tpl.defaultSettings).toBeDefined();
        // Zero plaintext credentials or fake login tokens
        expect((tpl as any).cookies).toBeUndefined();
        expect((tpl as any).password).toBeUndefined();
        expect((tpl as any).proxyCredentials).toBeUndefined();
        expect((tpl as any).sessionPath).toBeUndefined();
      });
    });

    it('fetches starter template by ID and returns null for non-existent IDs', () => {
      const personal = getStarterTemplateById('starter_personal');
      expect(personal).toBeDefined();
      expect(personal?.name).toBe('Personal Browsing');

      const nonExistent = getStarterTemplateById('starter_fake_does_not_exist');
      expect(nonExistent).toBeNull();
    });

    it('templates exist purely in memory and do not create database rows in profiles table', () => {
      const db = getDatabase();
      const allDbProfiles = db.prepare('SELECT id FROM profiles').all();
      expect(allDbProfiles.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. NEW USER VS EXISTING USER ONBOARDING DETECTION
  // =========================================================================
  describe('New User Clean State & Existing User Immunity', () => {
    const freshUserId = 'user_fresh_' + Date.now();
    const existingUserId = 'user_existing_' + Date.now();

    it('identifies a brand-new user with zero profiles as isUserNew = true', () => {
      const isNew = isUserNew(freshUserId);
      expect(isNew).toBe(true);
      expect(getRealUserProfileCount(freshUserId)).toBe(0);
    });

    it('clones a template into a user-owned profile and excludes templates from quota until cloned', async () => {
      const created = await createProfileFromStarter('starter_personal', {
        name: 'My Real Personal Profile',
        ownerId: freshUserId,
      });

      expect(created).toBeDefined();
      expect(created.name).toBe('My Real Personal Profile');
      expect(created.id).not.toBe('starter_personal');

      // Now the user has 1 real profile
      expect(getRealUserProfileCount(freshUserId)).toBe(1);
      expect(isUserNew(freshUserId)).toBe(false);

      // Clean up
      await deleteProfile(created.id);
    });

    it('never injects demo profiles into existing users with profiles', async () => {
      // Create a real profile for existing user
      const existingProfile = await createProfileFromStarter('starter_ecommerce', {
        name: 'Existing Merchant Store',
        ownerId: existingUserId,
      });

      expect(isUserNew(existingUserId)).toBe(false);
      expect(getRealUserProfileCount(existingUserId)).toBe(1);

      // Starter templates count remains 6 static in-memory templates
      expect(getStarterTemplates().length).toBe(6);

      // Clean up
      await deleteProfile(existingProfile.id);
    });
  });

  // =========================================================================
  // 3. CENTRAL PLAN CAPABILITY MATRIX
  // =========================================================================
  describe('Central Capability Matrix (FREE vs PRO vs BUSINESS vs ENTERPRISE)', () => {
    it('correctly maps FREE plan capabilities', () => {
      const freePlan = getCommercialPlanById('free');
      expect(freePlan).toBeDefined();

      const caps = resolveCapabilitiesForPlan(freePlan!);
      expect(caps['profile.basic']).toBe(true);
      expect(caps['proxy.custom']).toBe(true);

      // Premium features must be locked on Free
      expect(caps['cloud.sync']).toBe(false);
      expect(caps['cloud.browser']).toBe(false);
      expect(caps['proxy.builtin']).toBe(false);
      expect(caps['automation.rpa']).toBe(false);
      expect(caps['automation.scheduler']).toBe(false);
      expect(caps['automation.cookieWarmer']).toBe(false);
      expect(caps['automation.synchronizer']).toBe(false);
      expect(caps['workspace.team']).toBe(false);
      expect(caps['workspace.sharing']).toBe(false);
      expect(caps['api.remote']).toBe(false);
      expect(caps['api.webhooks']).toBe(false);
    });

    it('correctly maps PRO plan capabilities', () => {
      const proPlan = getCommercialPlanById('pro');
      expect(proPlan).toBeDefined();

      const caps = resolveCapabilitiesForPlan(proPlan!);
      expect(caps['profile.basic']).toBe(true);
      expect(caps['profile.multiple']).toBe(true);
      expect(caps['cloud.sync']).toBe(true);
      expect(caps['cloud.browser']).toBe(true);
      expect(caps['proxy.builtin']).toBe(true);
      expect(caps['automation.rpa']).toBe(true);
      expect(caps['automation.scheduler']).toBe(true);
      expect(caps['automation.cookieWarmer']).toBe(true);
      expect(caps['automation.synchronizer']).toBe(true);
      expect(caps['workspace.sharing']).toBe(true);
      expect(caps['api.remote']).toBe(true);

      // Multi-tenant team management is business-only
      expect(caps['workspace.team']).toBe(false);
    });

    it('correctly maps BUSINESS plan capabilities', () => {
      const bizPlan = getCommercialPlanById('business');
      expect(bizPlan).toBeDefined();

      const caps = resolveCapabilitiesForPlan(bizPlan!);
      expect(caps['profile.basic']).toBe(true);
      expect(caps['cloud.sync']).toBe(true);
      expect(caps['cloud.browser']).toBe(true);
      expect(caps['workspace.team']).toBe(true);
      expect(caps['workspace.sharing']).toBe(true);
      expect(caps['automation.multiProfile']).toBe(true);
      expect(caps['api.webhooks']).toBe(true);
    });
  });

  // =========================================================================
  // 4. ENTITLEMENT ENFORCEMENT & FEATURE GUARDS
  // =========================================================================
  describe('Authoritative Feature Guards & structured error handling', () => {
    let testFreeUser: string;

    beforeAll(() => {
      const reg = registerUser({
        email: `free_user_${Date.now()}@test.com`,
        password: 'Password123!',
        name: 'Test Free User',
      });
      testFreeUser = reg.user!.id;
    });

    it('allows basic profile capability for free users', async () => {
      const check = await checkCapability(testFreeUser, 'profile.basic');
      expect(check.entitled).toBe(true);
    });

    it('denies premium features and throws FEATURE_NOT_INCLUDED structured error', async () => {
      const check = await checkCapability(testFreeUser, 'cloud.browser');
      expect(check.entitled).toBe(false);
      expect(check.reason).toContain('requires');

      try {
        await assertEntitled(testFreeUser, 'cloud.browser');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('FEATURE_NOT_INCLUDED');
        expect(err.status).toBe(403);
        expect(err.requiredPlan).toBe('PRO');
      }
    });

    it('evaluates user entitlements including the full capabilities dictionary', async () => {
      const evalResult = await evaluateUserEntitlements(testFreeUser);
      expect(evalResult.allowed).toBe(true);
      expect(evalResult.capabilities).toBeDefined();
      expect(evalResult.capabilities['cloud.sync']).toBe(false);
      expect(evalResult.capabilities['profile.basic']).toBe(true);
    });

    it('assertCapability blocks desktop IPC actions when feature is not included in plan', () => {
      // In free mode without active license, premium capability fails
      expect(() => assertCapability('cloud.browser')).toThrow('FEATURE_NOT_INCLUDED');
      expect(() => assertCapability('automation.rpa')).toThrow('FEATURE_NOT_INCLUDED');
      expect(() => assertCapability('workspace.team')).toThrow('FEATURE_NOT_INCLUDED');

      // Allowed free capabilities succeed
      expect(() => assertCapability('profile.basic')).not.toThrow();
      expect(() => assertCapability('proxy.custom')).not.toThrow();
    });
  });
});
