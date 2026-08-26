import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
  cloneProfile,
} from '../../02_BROWSER/services/profile-service.js';

describe('Profile Service & Storage Isolation', () => {
  beforeAll(async () => {
    const testDbDir = path.join(process.cwd(), '.test_data');
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    setCustomDatabasePath(path.join(testDbDir, `test_mahi_profiles_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`));
    await initializeDatabase();
  });

  it('should create a new browser profile with independent storage path', () => {
    const profile = createProfile({
      name: 'QA Test Profile 01',
      description: 'Test workspace',
      folder: 'Testing',
      tags: ['QA', 'Automated'],
      notes: 'Initial test run',
    });

    expect(profile).toBeDefined();
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe('QA Test Profile 01');
    expect(profile.tags).toContain('QA');
    expect(profile.status).toBe('STOPPED');
    expect(profile.storagePath).toBeDefined();
    expect(fs.existsSync(profile.storagePath)).toBe(true);
  });

  it('should retrieve profiles with filters', () => {
    const all = getProfiles();
    expect(all.length).toBeGreaterThan(0);

    const filtered = getProfiles({ folder: 'Testing' });
    expect(filtered.every((p) => p.folder === 'Testing')).toBe(true);

    const searchRes = getProfiles({ searchQuery: 'QA Test' });
    expect(searchRes.length).toBeGreaterThan(0);
  });

  it('should update profile configuration', () => {
    const all = getProfiles();
    const target = all[0];

    const updated = updateProfile(target.id, {
      name: 'QA Test Profile 01 Updated',
      notes: 'Updated notes content',
      pinned: true,
    });

    expect(updated.name).toBe('QA Test Profile 01 Updated');
    expect(updated.notes).toBe('Updated notes content');
    expect(updated.pinned).toBe(true);
  });

  it('should clone profile with decoupled storage directory and new ID', () => {
    const all = getProfiles();
    const source = all[0];

    const cloned = cloneProfile({
      sourceProfileId: source.id,
      newName: 'Cloned Profile Alpha',
      copyCookies: true,
      copyHistory: false,
      copyExtensions: true,
      copyBrowserSettings: true,
    });

    expect(cloned.id).not.toBe(source.id);
    expect(cloned.name).toBe('Cloned Profile Alpha');
    expect(cloned.storagePath).not.toBe(source.storagePath);
    expect(fs.existsSync(cloned.storagePath)).toBe(true);
  });

  it('should delete profile and clean up its filesystem directory', () => {
    const profile = createProfile({ name: 'To Be Deleted' });
    const storagePath = profile.storagePath;
    expect(fs.existsSync(storagePath)).toBe(true);

    const deleted = deleteProfile(profile.id);
    expect(deleted).toBe(true);

    const check = getProfileById(profile.id);
    expect(check).toBeNull();
    expect(fs.existsSync(storagePath)).toBe(false);
  });
});
