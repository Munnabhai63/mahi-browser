import { describe, it, expect } from 'vitest';
import { assertCanCreateProfile, getPlanLimitsInfo, hasValidLicense } from '../../08_SECURITY/freemium-guard.js';
import { FREE_PROFILE_LIMIT, PRO_PROFILE_LIMIT } from '../../10_CONFIG/freemium-limits.js';

describe('Freemium Guard & Profile Limits', () => {
  it('should export correct limits (15 free, 100 pro)', () => {
    expect(FREE_PROFILE_LIMIT).toBe(15);
    expect(PRO_PROFILE_LIMIT).toBe(100);
  });

  it('should return valid plan limits info', () => {
    const info = getPlanLimitsInfo();
    expect(info).toHaveProperty('isPro');
    expect(info).toHaveProperty('currentCount');
    expect(info).toHaveProperty('maxProfiles');
    expect(typeof info.isPro).toBe('boolean');
    if (info.isPro) {
      expect(info.maxProfiles).toBe(100);
    } else {
      expect(info.maxProfiles).toBe(15);
    }
  });

  it('should enforce limits properly via assertCanCreateProfile', () => {
    if (!hasValidLicense()) {
      expect(() => {
        assertCanCreateProfile(16);
      }).toThrow('Free plan limit reached (15 profiles). Activate a license (₹599/year) to create up to 100 profiles.');
    }
  });
});
