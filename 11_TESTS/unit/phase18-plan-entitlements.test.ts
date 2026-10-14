import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  resolveCapabilitiesForCanonicalPlan,
  legacyPlanIdToCanonical,
  CANONICAL_PLAN_CATALOG,
} from '../../07_BACKEND/commercial/canonical-plan-catalog.js';
import {
  assertCapability,
  assertCanCreateProfile,
  getPlanLimitsInfo,
  isUserBusiness,
  isUserPro,
} from '../../08_SECURITY/freemium-guard.js';
import {
  isPaidPlan,
  isBusinessPlan,
  getAccountPlanLimits,
  writeCachedStatus,
  clearCachedStatus,
  saveEncryptedSession,
  clearEncryptedSession,
  CachedAccountStatus,
  AccountSession,
} from '../../08_SECURITY/account-service.js';
import { evaluateUserEntitlements } from '../../07_BACKEND/commercial/commercial-entitlement-service.js';

describe('PHASE 18 — Complete Plan-Based Feature Entitlements & Automatic Unlock System', () => {
  const dummyHwid = 'MAHI-TEST-HWID-001';

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(() => {
    clearCachedStatus();
    clearEncryptedSession();
  });

  afterEach(() => {
    clearCachedStatus();
    clearEncryptedSession();
  });

  describe('1. Canonical Plan Catalog Resolution & Aliases', () => {
    it('should correctly map all short and legacy plan IDs to canonical IDs', () => {
      expect(legacyPlanIdToCanonical('free')).toBe('free');
      expect(legacyPlanIdToCanonical('starter')).toBe('professional_10');
      expect(legacyPlanIdToCanonical('pro_25')).toBe('professional_25');
      expect(legacyPlanIdToCanonical('pro')).toBe('professional_100');
      expect(legacyPlanIdToCanonical('trial')).toBe('professional_100');
      expect(legacyPlanIdToCanonical('team')).toBe('business_growth');
      expect(legacyPlanIdToCanonical('business')).toBe('business_growth');
      expect(legacyPlanIdToCanonical('business_scale')).toBe('business_scale');
      expect(legacyPlanIdToCanonical('enterprise')).toBe('business_enterprise');
    });

    it('should resolve FREE tier capabilities (basic profiles & custom proxy only)', () => {
      const caps = resolveCapabilitiesForCanonicalPlan('free');
      expect(caps['profile.basic']).toBe(true);
      expect(caps['proxy.custom']).toBe(true);
      expect(caps['cloud.sync']).toBe(false);
      expect(caps['automation.rpa']).toBe(false);
      expect(caps['workspace.team']).toBe(false);
      expect(caps['api.remote']).toBe(false);
    });

    it('should resolve PRO tier capabilities (automation, sync, NO team workspace)', () => {
      const caps = resolveCapabilitiesForCanonicalPlan('pro');
      expect(caps['profile.basic']).toBe(true);
      expect(caps['proxy.custom']).toBe(true);
      expect(caps['cloud.sync']).toBe(true);
      expect(caps['automation.rpa']).toBe(true);
      expect(caps['automation.cookieWarmer']).toBe(true);
      expect(caps['automation.synchronizer']).toBe(true);
      expect(caps['advanced.fingerprint']).toBe(true);
      // Critical check: PRO must NOT unlock workspace.team
      expect(caps['workspace.team']).toBe(false);
    });

    it('should resolve BUSINESS tier capabilities (all PRO features + workspace.team)', () => {
      const caps = resolveCapabilitiesForCanonicalPlan('business');
      expect(caps['profile.basic']).toBe(true);
      expect(caps['proxy.custom']).toBe(true);
      expect(caps['cloud.sync']).toBe(true);
      expect(caps['automation.rpa']).toBe(true);
      expect(caps['automation.cookieWarmer']).toBe(true);
      expect(caps['automation.synchronizer']).toBe(true);
      // Critical check: BUSINESS MUST unlock workspace.team
      expect(caps['workspace.team']).toBe(true);
    });
  });

  describe('2. Account Service Plan & Tier Recognition', () => {
    it('should identify paid vs free plans accurately', () => {
      expect(isPaidPlan('free')).toBe(false);
      expect(isPaidPlan('unknown')).toBe(false);
      expect(isPaidPlan('')).toBe(false);
      expect(isPaidPlan(null)).toBe(false);

      expect(isPaidPlan('pro')).toBe(true);
      expect(isPaidPlan('trial')).toBe(true);
      expect(isPaidPlan('starter')).toBe(true);
      expect(isPaidPlan('pro_25')).toBe(true);
      expect(isPaidPlan('business')).toBe(true);
      expect(isPaidPlan('team')).toBe(true);
      expect(isPaidPlan('enterprise')).toBe(true);
    });

    it('should distinguish BUSINESS plans from individual PRO plans', () => {
      expect(isBusinessPlan('free')).toBe(false);
      expect(isBusinessPlan('pro')).toBe(false);
      expect(isBusinessPlan('trial')).toBe(false);
      expect(isBusinessPlan('pro_50')).toBe(false);

      expect(isBusinessPlan('business')).toBe(true);
      expect(isBusinessPlan('business_growth')).toBe(true);
      expect(isBusinessPlan('team')).toBe(true);
      expect(isBusinessPlan('team_50')).toBe(true);
      expect(isBusinessPlan('enterprise')).toBe(true);
    });

    it('should return correct tier and limits for FREE user', () => {
      const limits = getAccountPlanLimits();
      expect(limits.isPro).toBe(false);
      expect(limits.plan).toBe('free');
      expect(limits.tier).toBe('FREE');
      expect(limits.maxProfiles).toBe(15);
    });

    it('should return correct tier and limits for PRO user', () => {
      const mockSession: AccountSession = {
        token: 'test_token_pro',
        account_id: 'usr_pro_001',
        email: 'pro@user.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);

      const mockStatus: CachedAccountStatus = {
        account_id: 'usr_pro_001',
        hwid: dummyHwid,
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      };
      writeCachedStatus(mockStatus);

      const limits = getAccountPlanLimits();
      expect(limits.isPro).toBe(true);
      expect(limits.plan).toBe('pro');
      expect(limits.tier).toBe('PRO');
      expect(limits.maxProfiles).toBe(100);
      expect(isUserBusiness()).toBe(false);
      expect(isUserPro()).toBe(true);
    });

    it('should return correct tier and limits for BUSINESS user', () => {
      const mockSession: AccountSession = {
        token: 'test_token_biz',
        account_id: 'usr_biz_001',
        email: 'biz@agency.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);

      const mockStatus: CachedAccountStatus = {
        account_id: 'usr_biz_001',
        hwid: dummyHwid,
        plan: 'business',
        profile_limit: 200,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      };
      writeCachedStatus(mockStatus);

      const limits = getAccountPlanLimits();
      expect(limits.isPro).toBe(true);
      expect(limits.plan).toBe('business');
      expect(limits.tier).toBe('BUSINESS');
      expect(limits.maxProfiles).toBe(200);
      expect(isUserBusiness()).toBe(true);
      expect(isUserPro()).toBe(true);
    });
  });

  describe('3. Backend Capability Assertions & Security Enforcement', () => {
    it('should allow basic capabilities for all users', () => {
      expect(() => assertCapability('profile.basic')).not.toThrow();
      expect(() => assertCapability('proxy.custom')).not.toThrow();
    });

    it('should block PRO features for FREE users with PRO upgrade message', () => {
      expect(() => assertCapability('automation.rpa')).toThrow(/requires MAHI PRO or Business plan/);
      try {
        assertCapability('automation.rpa');
      } catch (err: any) {
        expect(err.code).toBe('FEATURE_NOT_INCLUDED');
        expect(err.requiredPlan).toBe('PRO');
      }
    });

    it('should allow PRO features for PRO users, but strictly block BUSINESS-only features', () => {
      const mockSession: AccountSession = {
        token: 'test_token_pro',
        account_id: 'usr_pro_002',
        email: 'pro2@user.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);
      writeCachedStatus({
        account_id: 'usr_pro_002',
        hwid: dummyHwid,
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      });

      // PRO features allowed
      expect(() => assertCapability('automation.rpa')).not.toThrow();
      expect(() => assertCapability('automation.cookieWarmer')).not.toThrow();
      expect(() => assertCapability('cloud.sync')).not.toThrow();

      // BUSINESS feature strictly blocked!
      expect(() => assertCapability('workspace.team')).toThrow(/requires a MAHI BUSINESS subscription/);
      try {
        assertCapability('workspace.team');
      } catch (err: any) {
        expect(err.code).toBe('FEATURE_NOT_INCLUDED');
        expect(err.requiredPlan).toBe('BUSINESS');
      }
    });

    it('should allow ALL features including workspace.team for BUSINESS users', () => {
      const mockSession: AccountSession = {
        token: 'test_token_biz',
        account_id: 'usr_biz_002',
        email: 'team@agency.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);
      writeCachedStatus({
        account_id: 'usr_biz_002',
        hwid: dummyHwid,
        plan: 'business',
        profile_limit: 200,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      });

      // All features allowed
      expect(() => assertCapability('automation.rpa')).not.toThrow();
      expect(() => assertCapability('cloud.sync')).not.toThrow();
      expect(() => assertCapability('workspace.team')).not.toThrow();
    });
  });

  describe('4. evaluateUserEntitlements Central Resolution', () => {
    it('should evaluate PRO account entitlements without falling back to free', () => {
      const mockSession: AccountSession = {
        token: 'test_token_pro',
        account_id: 'usr_pro_eval',
        email: 'pro_eval@mahi.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);
      writeCachedStatus({
        account_id: 'usr_pro_eval',
        hwid: dummyHwid,
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      });

      const entitlements = evaluateUserEntitlements('usr_pro_eval');
      expect(entitlements.allowed).toBe(true);
      expect(entitlements.plan.tier).toBe('PRO');
      expect(entitlements.limits.maxProfiles).toBe(100);
      expect(entitlements.capabilities['automation.rpa']).toBe(true);
      expect(entitlements.capabilities['workspace.team']).toBe(false);
    });

    it('should evaluate BUSINESS account entitlements and unlock workspace.team', () => {
      const mockSession: AccountSession = {
        token: 'test_token_biz',
        account_id: 'usr_biz_eval',
        email: 'biz_eval@mahi.com',
        hwid: dummyHwid,
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);
      writeCachedStatus({
        account_id: 'usr_biz_eval',
        hwid: dummyHwid,
        plan: 'business',
        profile_limit: 200,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 365).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      });

      const entitlements = evaluateUserEntitlements('usr_biz_eval');
      expect(entitlements.allowed).toBe(true);
      expect(entitlements.plan.tier).toBe('BUSINESS');
      expect(entitlements.limits.maxProfiles).toBe(200);
      expect(entitlements.capabilities['automation.rpa']).toBe(true);
      expect(entitlements.capabilities['workspace.team']).toBe(true);
    });
  });
});
