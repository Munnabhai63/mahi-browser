import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { initSqlEngine, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  WARMING_SITES,
  getWarmingSiteQueue,
  countProfileCookies,
  warmProfile,
  warmBulkProfiles,
} from '../../09_AUTOMATION/cookie-warmer-service.js';
import { createProfile, deleteProfile, getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 4: Smart Cookie Warmer & Auto-Farmer Bot', () => {
  let testProfileId: string;
  let testProfileId2: string;
  const testDbDir = path.resolve('.mahi_data', 'test-warmer-isolated');
  const testDbPath = path.join(testDbDir, 'warmer_test.sqlite');

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


  beforeEach(() => {
    const p1 = createProfile({
      name: 'Warmer-Test-1',
      folder: 'Farming',
      tags: ['Fresh'],
      settings: getDefaultProfileSettings(),
    });
    testProfileId = p1.id;

    const p2 = createProfile({
      name: 'Warmer-Test-2',
      folder: 'Farming',
      tags: ['Fresh'],
      settings: getDefaultProfileSettings(),
    });
    testProfileId2 = p2.id;
  });

  afterEach(() => {
    try {
      if (testProfileId) deleteProfile(testProfileId);
      if (testProfileId2) deleteProfile(testProfileId2);
    } catch {}
  });

  it('should have a rich, valid repository of authoritative farming domains', () => {
    expect(WARMING_SITES.length).toBeGreaterThanOrEqual(20);
    for (const site of WARMING_SITES) {
      expect(site.url).toMatch(/^https?:\/\//);
      expect(site.name.length).toBeGreaterThan(2);
      expect(site.weight).toBeGreaterThan(0);
      expect(['Search', 'News', 'Tech', 'Social', 'Commerce', 'Reference']).toContain(site.category);
    }
  });

  it('should generate balanced site queues based on requested count and category filters', () => {
    const quickQueue = getWarmingSiteQueue(5);
    expect(quickQueue.length).toBe(5);

    const standardQueue = getWarmingSiteQueue(12);
    expect(standardQueue.length).toBe(12);

    const techOnly = getWarmingSiteQueue(4, ['Tech']);
    expect(techOnly.length).toBe(4);
    for (const s of techOnly) {
      expect(s.category).toBe('Tech');
    }
  });

  it.skipIf(!process.env.MAHI_E2E)('should warm a single profile, add Warmed tag, and record audit notes', async () => {
    const res = await warmProfile(testProfileId, { mode: 'quick' });

    expect(res.success).toBe(true);
    expect(res.profileId).toBe(testProfileId);
    expect(res.visitedSitesCount).toBe(5);
    expect(res.visitedUrls.length).toBe(5);
    expect(res.farmedCookiesCount).toBeGreaterThan(0);

    const updated = getProfileById(testProfileId);
    expect(updated).toBeDefined();
    expect(updated?.tags).toContain('Warmed');
    expect(updated?.notes).toContain('Auto-Warmed');
  });

  it.skipIf(!process.env.MAHI_E2E)('should handle Deep Ageing mode (25 authoritative sites)', async () => {
    const res = await warmProfile(testProfileId, { mode: 'deep' });

    expect(res.success).toBe(true);
    expect(res.mode).toBe('deep');
    expect(res.visitedSitesCount).toBeGreaterThanOrEqual(20);
    expect(res.farmedCookiesCount).toBeGreaterThanOrEqual(30);
  });

  it.skipIf(!process.env.MAHI_E2E)('should execute bulk warming across multiple profiles in batch', async () => {
    const res = await warmBulkProfiles([testProfileId, testProfileId2], { mode: 'quick' });

    expect(res.successCount).toBe(2);
    expect(res.failureCount).toBe(0);
    expect(res.results.length).toBe(2);

    const p1 = getProfileById(testProfileId);
    const p2 = getProfileById(testProfileId2);

    expect(p1?.tags).toContain('Warmed');
    expect(p2?.tags).toContain('Warmed');
  });
});
