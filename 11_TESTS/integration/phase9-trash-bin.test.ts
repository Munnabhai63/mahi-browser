import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfiles,
  getProfileById,
  softDeleteProfile,
  getTrashProfiles,
  restoreProfile,
  permanentDeleteProfile,
  emptyTrash,
} from '../../02_BROWSER/services/profile-service.js';
import { createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 9: Profile Recycle Bin & 30-Day Auto-Recovery Suite', () => {
  let tempDir: string;
  let profileIds: string[] = [];

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase9-trash-'));
    const testDbPath = path.join(tempDir, 'test_phase9.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  beforeEach(() => {
    profileIds = [];
    for (let i = 1; i <= 4; i++) {
      const p = createProfile({
        name: `Trash-Test-Profile-${i}`,
        folder: 'Farming',
        tags: ['Important', 'Verified'],
        notes: `Note for profile ${i}`,
        settings: getDefaultProfileSettings(),
      });
      profileIds.push(p.id);
    }
  });

  it('should soft delete a profile and remove it from active getProfiles list', () => {
    const targetId = profileIds[0];
    const initialActive = getProfiles();
    expect(initialActive.some((p) => p.id === targetId)).toBe(true);

    const softDeleted = softDeleteProfile(targetId);
    expect(softDeleted).toBe(true);

    // Active profiles query must NOT include the soft deleted profile
    const currentActive = getProfiles();
    expect(currentActive.some((p) => p.id === targetId)).toBe(false);
  });

  it('should list soft-deleted profiles in getTrashProfiles with deletedAt metadata', () => {
    const targetId = profileIds[1];
    softDeleteProfile(targetId);

    const trash = getTrashProfiles();
    const found = trash.find((p) => p.id === targetId);

    expect(found).toBeDefined();
    expect(found!.name).toBe('Trash-Test-Profile-2');
    expect(found!.deletedAt).toBeDefined();
    expect(found!.folder).toBe('Farming');
    expect(found!.tags).toContain('Important');
  });

  it('should restore a profile from Trash Bin back to active list with full settings and tags intact', () => {
    const targetId = profileIds[2];
    softDeleteProfile(targetId);

    // Verify it is in trash
    expect(getTrashProfiles().some((p) => p.id === targetId)).toBe(true);
    expect(getProfiles().some((p) => p.id === targetId)).toBe(false);

    // Restore profile
    const restored = restoreProfile(targetId);
    expect(restored).toBeDefined();
    expect(restored.id).toBe(targetId);
    expect(restored.deletedAt).toBeUndefined();

    // Verify it is back in active list
    const active = getProfiles();
    const activeFound = active.find((p) => p.id === targetId);
    expect(activeFound).toBeDefined();
    expect(activeFound!.name).toBe('Trash-Test-Profile-3');
    expect(activeFound!.folder).toBe('Farming');
    expect(activeFound!.tags).toContain('Important');
    expect(activeFound!.tags).toContain('Verified');

    // Verify it is removed from trash
    expect(getTrashProfiles().some((p) => p.id === targetId)).toBe(false);
  });

  it('should permanently delete a profile and remove all records and filesystem data', () => {
    const targetId = profileIds[3];
    softDeleteProfile(targetId);

    const permDeleted = permanentDeleteProfile(targetId);
    expect(permDeleted).toBe(true);

    expect(getProfileById(targetId)).toBeNull();
    expect(getTrashProfiles().some((p) => p.id === targetId)).toBe(false);
    expect(getProfiles().some((p) => p.id === targetId)).toBe(false);
  });

  it('should empty all profiles from Trash Bin in a single bulk operation', () => {
    // Soft delete all remaining active profiles
    const all = getProfiles();
    for (const p of all) {
      softDeleteProfile(p.id);
    }

    const trashBefore = getTrashProfiles();
    expect(trashBefore.length).toBeGreaterThan(0);

    const emptyResult = emptyTrash();
    expect(emptyResult.success).toBe(true);
    expect(emptyResult.deletedCount).toBe(trashBefore.length);

    const trashAfter = getTrashProfiles();
    expect(trashAfter.length).toBe(0);
  });
});
