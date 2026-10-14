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
  createProfileFromStarter,
} from '../../02_BROWSER/services/starter-profiles-service.js';
import { getProfileById, deleteProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';

describe('MAHI BROWSER — Starter Templates Comprehensive Runtime Acceptance Matrix', () => {
  const tempDir = path.resolve('.mahi_data', 'test-phase17-runtime-matrix');
  const dbPath = path.join(tempDir, 'runtime_matrix.sqlite');
  const createdProfileIds: string[] = [];

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setCustomDatabasePath(dbPath);
    initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  afterEach(async () => {
    for (const id of createdProfileIds) {
      try {
        await deleteProfile(id);
      } catch {}
    }
    createdProfileIds.length = 0;
  });

  // Acceptance Criteria: 6 Templates Individual Verification Matrix
  const templatesToTest = [
    {
      id: 'starter_personal',
      name: 'Personal Browsing',
      expectedFolder: 'Personal',
      expectedStartupUrl: 'https://duckduckgo.com',
      expectedCanvasNoise: true,
    },
    {
      id: 'starter_social',
      name: 'Social Media Profile',
      expectedFolder: 'Social Media',
      expectedStartupUrl: 'https://twitter.com',
      expectedCanvasNoise: true,
    },
    {
      id: 'starter_ecommerce',
      name: 'E-Commerce Store Profile',
      expectedFolder: 'E-Commerce',
      expectedStartupUrl: 'https://www.google.com',
      expectedCanvasNoise: true,
    },
    {
      id: 'starter_work',
      name: 'Business & Work Profile',
      expectedFolder: 'Work',
      expectedStartupUrl: 'https://google.com',
      expectedCanvasNoise: true,
    },
    {
      id: 'starter_automation',
      name: 'Automation Example Profile',
      expectedFolder: 'Automation',
      expectedStartupUrl: 'https://example.com',
      expectedCanvasNoise: true,
    },
    {
      id: 'starter_sandbox',
      name: 'Sandbox & Test Profile',
      expectedFolder: 'Sandbox',
      expectedStartupUrl: 'https://example.com',
      expectedCanvasNoise: true,
    },
  ];

  for (const tpl of templatesToTest) {
    it(`Matrix Acceptance [${tpl.name}]: verifies complete creation, isolation, and persistence lifecycle`, async () => {
      // 1. Template exists and configuration is selected
      const template = getStarterTemplateById(tpl.id);
      expect(template).not.toBeNull();
      expect(template!.name).toBe(tpl.name);

      // 2. Creation process executes
      const profile = await createProfileFromStarter(tpl.id, {
        name: `${tpl.name} - Verification Run`,
      });

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.name).toBe(`${tpl.name} - Verification Run`);
      expect(profile.folder).toBe(tpl.expectedFolder);
      createdProfileIds.push(profile.id);

      // 3. Exactly one persistent SQLite row is created
      const db = getDatabase();
      const countRow = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE id = ?').get(profile.id) as any;
      expect(countRow.count).toBe(1);

      // 4. Profile appears in getProfiles() list
      const allProfiles = getProfiles();
      const inList = allProfiles.find((p) => p.id === profile.id);
      expect(inList).toBeDefined();
      expect(inList!.name).toBe(`${tpl.name} - Verification Run`);

      // 5. Storage folder exists on disk
      expect(fs.existsSync(profile.storagePath)).toBe(true);

      // 6. Settings and fingerprint emulation are preserved
      const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get(profile.id) as any;
      expect(settingsRow).toBeDefined();
      const settings = JSON.parse(settingsRow.settings_json);
      expect(settings.browser?.startupUrl).toBe(tpl.expectedStartupUrl);
      if (tpl.expectedCanvasNoise) {
        expect(settings.fingerprint?.canvasNoise).toBe(true);
      }
    });
  }

  describe('Rapid Click & Sequential Creation Resilience', () => {
    it('handles multiple sequential profile creations without collision or data leakage', async () => {
      const p1 = await createProfileFromStarter('starter_personal', { name: 'Batch Profile 1' });
      const p2 = await createProfileFromStarter('starter_personal', { name: 'Batch Profile 2' });
      const p3 = await createProfileFromStarter('starter_personal', { name: 'Batch Profile 3' });

      createdProfileIds.push(p1.id, p2.id, p3.id);

      expect(p1.id).not.toBe(p2.id);
      expect(p2.id).not.toBe(p3.id);
      expect(p1.storagePath).not.toBe(p2.storagePath);

      expect(getProfileById(p1.id)?.name).toBe('Batch Profile 1');
      expect(getProfileById(p2.id)?.name).toBe('Batch Profile 2');
      expect(getProfileById(p3.id)?.name).toBe('Batch Profile 3');
    });
  });
});
