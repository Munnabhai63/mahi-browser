import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
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

  beforeAll(async () => {
    await initSqlEngine();
    await initializeDatabase();
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

  it('should warm a single profile, add Warmed tag, and record audit notes', async () => {
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

  it('should handle Deep Ageing mode (25 authoritative sites)', async () => {
    const res = await warmProfile(testProfileId, { mode: 'deep' });

    expect(res.success).toBe(true);
    expect(res.mode).toBe('deep');
    expect(res.visitedSitesCount).toBeGreaterThanOrEqual(20);
    expect(res.farmedCookiesCount).toBeGreaterThanOrEqual(30);
  });

  it('should execute bulk warming across multiple profiles in batch', async () => {
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
