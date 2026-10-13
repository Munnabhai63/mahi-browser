import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { createProfile, getProfileById, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { assertCanCreateProfile, getNonDeletedProfileCount } from '../../08_SECURITY/freemium-guard.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { processManager } from '../../02_BROWSER/process-manager.js';

describe('REAL E2E ACCEPTANCE: Quick Profile Creation, SQLite Persistence & Chromium Launch', () => {
  let createdProfileId: string | null = null;

  beforeAll(async () => {
    await initSqlEngine();
  });

  afterAll(async () => {
    if (createdProfileId) {
      if (processManager.isRunning(createdProfileId)) {
        await processManager.stopProfile(createdProfileId);
      }
      try {
        deleteProfile(createdProfileId);
      } catch {}
    }
  });

  it('verifies entitlement quota assertCanCreateProfile passes', () => {
    const count = getNonDeletedProfileCount();
    expect(() => assertCanCreateProfile(1)).not.toThrow();
  });

  it('creates profile with standard quick create settings and persists in SQLite', () => {
    const defaults = getDefaultProfileSettings();
    const profileName = `P1_Real_Acceptance_${Date.now()}`;
    const profile = createProfile({
      name: profileName,
      folder: 'General',
      notes: 'Real E2E Acceptance Verification',
      tags: ['E2E_Verified', 'QuickCreate'],
      settings: {
        ...defaults,
        network: {
          ...defaults.network,
          proxyId: undefined,
        },
      },
    });

    expect(profile).toBeDefined();
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe(profileName);
    createdProfileId = profile.id;

    const fetched = getProfileById(profile.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe(profileName);
    expect(fetched?.folder).toBe('General');
  });

  it('launches real production Chromium, verifies running state, and stops cleanly', async () => {
    expect(createdProfileId).toBeDefined();
    if (!createdProfileId) return;

    // Launch Chromium
    const startRes = await processManager.startProfile(createdProfileId);
    expect(startRes.success).toBe(true);
    expect(startRes.pid).toBeGreaterThan(0);

    // Verify running state
    expect(processManager.isRunning(createdProfileId)).toBe(true);

    // Stop profile
    const stopRes = await processManager.stopProfile(createdProfileId);
    expect(stopRes.success).toBe(true);

    // Verify profile persists after stop
    const postStop = getProfileById(createdProfileId);
    expect(postStop).toBeDefined();
    expect(postStop?.id).toBe(createdProfileId);
  }, 30000);
});
