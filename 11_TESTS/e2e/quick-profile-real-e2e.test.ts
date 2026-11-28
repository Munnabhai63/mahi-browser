import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, getProfileById, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { assertCanCreateProfile, getNonDeletedProfileCount } from '../../08_SECURITY/freemium-guard.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { canRunRealBrowserTests } from '../setup/e2e-guards.js';

describe('REAL E2E ACCEPTANCE: Quick Profile Creation, SQLite Persistence & Chromium Launch', () => {
  let tempDir: string;
  let createdProfileId: string | null = null;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-quick-profile-e2e-'));
    await initSqlEngine();
    setCustomDatabasePath(path.join(tempDir, 'quick_profile_e2e.sqlite'));
    await initializeDatabase();
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
    try {
      await processManager.stopAll();
    } catch {}
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('verifies entitlement quota assertCanCreateProfile passes', () => {
    const count = getNonDeletedProfileCount();
    expect(count).toBeGreaterThanOrEqual(0);
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

  it.skipIf(!canRunRealBrowserTests())('launches real production Chromium, verifies running state, and stops cleanly', async () => {
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
