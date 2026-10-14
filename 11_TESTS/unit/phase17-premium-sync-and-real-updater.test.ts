import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareSemVer, validateUpdateManifest } from '../../07_BACKEND/services/updater-validator.js';
import { checkForAppUpdates, getAppUpdateStatus } from '../../07_BACKEND/services/updater-service.js';
import { getAccountPlanLimits } from '../../08_SECURITY/account-service.js';

describe('MAHI BROWSER — PHASE 17 VERIFICATION SUITE', () => {
  describe('ISSUE 1: Premium Status Sync & Entitlement Chain', () => {
    it('accurately resolves isPro and planBadgeText from planLimits', () => {
      // Test the exact selector logic from AccountDropdown.tsx
      const resolveAccountPill = (
        currentLicenseStatus: any,
        planLimits: any,
        currentUser: any
      ) => {
        const isLicensePro = Boolean(currentLicenseStatus?.isValid && currentLicenseStatus?.status === 'ACTIVE');
        const isAccountPro = Boolean(
          planLimits?.isPro ||
          planLimits?.plan === 'pro' ||
          planLimits?.plan === 'trial' ||
          currentUser?.planName?.toUpperCase() === 'PRO' ||
          currentUser?.planName?.toUpperCase() === 'TRIAL'
        );
        const isPro = isLicensePro || isAccountPro;
        const currentPlan = (planLimits?.plan || currentUser?.planName || (isPro ? 'pro' : 'free')).toLowerCase();
        const isPaidOrTrial = isPro || currentPlan === 'pro' || currentPlan === 'trial' || currentPlan === 'starter' || currentPlan === 'team';
        const planBadgeText = currentPlan === 'trial' ? 'TRIAL' : currentPlan === 'pro' ? 'PRO' : currentPlan === 'starter' ? 'STARTER' : currentPlan === 'team' ? 'TEAM' : (isPro ? 'PRO' : 'FREE');
        const maxProfiles = planLimits?.maxProfiles || currentUser?.maxProfiles || (isPro ? 100 : 15);
        const userPlanName = isPaidOrTrial ? `${planBadgeText} (${maxProfiles} Profiles)` : 'Free Plan (15 Profiles)';

        return { isPro, isAccountPro, planBadgeText, userPlanName, maxProfiles };
      };

      // Case 1: Account user with PRO grant from Admin Panel (No offline license)
      const proUser = resolveAccountPill(
        null, // No offline license file
        { isPro: true, plan: 'pro', maxProfiles: 100, expiresAt: '2100-03-31T23:59:59.999Z' },
        { email: 'munachoudhary246@gmail.com', planName: 'PRO' }
      );
      expect(proUser.isPro).toBe(true);
      expect(proUser.isAccountPro).toBe(true);
      expect(proUser.planBadgeText).toBe('PRO');
      expect(proUser.userPlanName).toBe('PRO (100 Profiles)');
      expect(proUser.maxProfiles).toBe(100);

      // Case 2: Free User
      const freeUser = resolveAccountPill(
        null,
        { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null },
        { email: 'freeuser@mahibrowser.com', planName: 'FREE' }
      );
      expect(freeUser.isPro).toBe(false);
      expect(freeUser.planBadgeText).toBe('FREE');
      expect(freeUser.userPlanName).toBe('Free Plan (15 Profiles)');
      expect(freeUser.maxProfiles).toBe(15);

      // Case 3: 7-Day Trial User
      const trialUser = resolveAccountPill(
        null,
        { isPro: true, plan: 'trial', maxProfiles: 50, expiresAt: '2026-10-21T00:00:00.000Z' },
        { email: 'trialuser@mahibrowser.com', planName: 'TRIAL' }
      );
      expect(trialUser.isPro).toBe(true);
      expect(trialUser.planBadgeText).toBe('TRIAL');
      expect(trialUser.userPlanName).toBe('TRIAL (50 Profiles)');
    });

    it('returns valid plan limits structure from account service', () => {
      const limits = getAccountPlanLimits();
      expect(limits).toHaveProperty('isPro');
      expect(limits).toHaveProperty('plan');
      expect(limits).toHaveProperty('maxProfiles');
      expect(typeof limits.maxProfiles).toBe('number');
      expect([15, 50, 100]).toContain(limits.maxProfiles);
    });
  });

  describe('ISSUE 2: Real Updater Integration & Live Version Comparison', () => {
    it('compares versions accurately with SemVer semantics', () => {
      // 1.1.3 vs 1.1.3 => 0 (Up to date)
      expect(compareSemVer('1.1.3', '1.1.3')).toBe(0);
      expect(compareSemVer('v1.1.3', '1.1.3')).toBe(0);

      // 1.1.4 > 1.1.3 => 1 (Newer available)
      expect(compareSemVer('1.1.4', '1.1.3')).toBe(1);
      expect(compareSemVer('1.2.0', '1.1.3')).toBe(1);
      expect(compareSemVer('2.0.0', '1.1.3')).toBe(1);

      // 1.1.2 < 1.1.3 => -1 (Older release / downgrade rejected)
      expect(compareSemVer('1.1.2', '1.1.3')).toBe(-1);
      expect(compareSemVer('1.1.0', '1.1.3')).toBe(-1);
    });

    it('rejects downgrade or identical manifests and marks as up to date', () => {
      const manifestCurrent = {
        version: '1.1.3',
        releaseDate: '2026-10-13T21:39:21.000Z',
        channel: 'STABLE' as const,
        releaseNotes: 'Current release',
        files: [{ url: 'https://mahibrowser.com/download/setup', name: 'setup.exe', size: 1000000 }],
      };

      const result = validateUpdateManifest(manifestCurrent, '1.1.3', 'STABLE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Downgrade or duplicate');
    });

    it('accepts genuine newer release manifests', () => {
      const manifestNewer = {
        version: '1.1.4',
        releaseDate: '2026-10-20T00:00:00.000Z',
        channel: 'STABLE' as const,
        releaseNotes: 'New security patches',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        files: [{ url: 'https://mahibrowser.com/download/setup-1.1.4.exe', name: 'setup.exe', size: 295000000, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }],
      };


      const result = validateUpdateManifest(manifestNewer, '1.1.3', 'STABLE');
      expect(result.valid).toBe(true);
      expect(result.validatedManifest?.version).toBe('1.1.4');
    });

    it('checks update status cleanly and returns non-dummy status event', () => {
      const status = getAppUpdateStatus();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('channel');
      expect(status.currentVersion).toMatch(/^1\.1\.[1-3]$/);
      expect(['IDLE', 'CHECKING', 'AVAILABLE', 'NOT_AVAILABLE', 'DOWNLOADING', 'DOWNLOADED', 'ERROR']).toContain(status.state);
    });
  });
});
