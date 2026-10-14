import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
  STARTER_PROFILE_TEMPLATES,
} from '../../02_BROWSER/services/starter-profiles-service.js';
import { getProfileById, deleteProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';

describe('MAHI BROWSER — 6 Starter Templates Forensic Verification Suite', () => {
  const tempDir = path.resolve('.mahi_data', 'test-phase17-starter-templates');
  const dbPath = path.join(tempDir, 'starter_templates_test.sqlite');
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

  describe('1. Template Inventory & Schema Completeness', () => {
    it('returns exactly 6 pre-configured starter templates', () => {
      const templates = getStarterTemplates();
      expect(templates).toHaveLength(6);
    });

    it('contains all 6 expected template configurations with rich specs', () => {
      const expected = [
        { id: 'starter_personal', name: 'Personal Browsing', cat: 'PERSONAL' },
        { id: 'starter_social', name: 'Social Media Profile', cat: 'SOCIAL' },
        { id: 'starter_ecommerce', name: 'E-Commerce Store Profile', cat: 'E-COMMERCE' },
        { id: 'starter_work', name: 'Business & Work Profile', cat: 'WORK' },
        { id: 'starter_automation', name: 'Automation Example Profile', cat: 'AUTOMATION' },
        { id: 'starter_sandbox', name: 'Sandbox & Test Profile', cat: 'SANDBOX' },
      ];

      const templates = getStarterTemplates();
      for (const exp of expected) {
        const found = templates.find((t) => t.id === exp.id);
        expect(found, `Template ${exp.id} should exist`).toBeDefined();
        expect(found!.name).toBe(exp.name);
        expect(found!.category).toBe(exp.cat);
        expect(found!.fingerprintPreview).toBeDefined();
        expect(found!.browser).toBeDefined();
        expect(found!.os).toBeDefined();
      }
    });

    it('resolves templates by hyphenated and alias identifiers', () => {
      // Hyphenated variants
      expect(getStarterTemplateById('starter-personal')?.id).toBe('starter_personal');
      expect(getStarterTemplateById('starter-social')?.id).toBe('starter_social');
      expect(getStarterTemplateById('starter-ecommerce')?.id).toBe('starter_ecommerce');
      expect(getStarterTemplateById('starter-work')?.id).toBe('starter_work');
      expect(getStarterTemplateById('starter-automation')?.id).toBe('starter_automation');
      expect(getStarterTemplateById('starter-sandbox')?.id).toBe('starter_sandbox');

      // Business aliases
      expect(getStarterTemplateById('starter-business')?.id).toBe('starter_work');
      expect(getStarterTemplateById('starter_business')?.id).toBe('starter_work');

      // Case-insensitive / trimmed
      expect(getStarterTemplateById('  STARTER_PERSONAL  ')?.id).toBe('starter_personal');
    });
  });

  describe('2. Real Profile Creation Matrix for All 6 Templates', () => {
    const testUserId = 'test_template_user_' + Date.now();

    it('Template 1: creates and persists Personal Browsing profile', async () => {
      const profile = await createProfileFromStarter('starter_personal', {
        name: 'My Personal Browsing Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.name).toBe('My Personal Browsing Test');
      expect(profile.folder).toBe('Personal');
      createdProfileIds.push(profile.id);

      // Verify SQLite row exists
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile.id) as any;
      expect(row).toBeDefined();
      expect(row.name).toBe('My Personal Browsing Test');
      expect(row.deleted_at).toBeNull();

      // Verify fingerprint settings in profile_settings table
      const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get(profile.id) as any;
      expect(settingsRow).toBeDefined();
      const settings = JSON.parse(settingsRow.settings_json);
      expect(settings.fingerprint?.canvas).toBe('noise');
      expect(settings.fingerprint?.canvasNoise).toBe(true);
    });

    it('Template 2: creates and persists Social Media profile', async () => {
      const profile = await createProfileFromStarter('starter_social', {
        name: 'My Social Media Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('My Social Media Test');
      expect(profile.folder).toBe('Social Media');
      createdProfileIds.push(profile.id);

      const db = getDatabase();
      const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get(profile.id) as any;
      const settings = JSON.parse(settingsRow.settings_json);
      expect(settings.fingerprint?.webgl).toBe('noise');
      expect(settings.fingerprint?.clientRects).toBe('noise');
    });

    it('Template 3: creates and persists E-Commerce Store profile', async () => {
      const profile = await createProfileFromStarter('starter_ecommerce', {
        name: 'My E-Commerce Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('My E-Commerce Test');
      expect(profile.folder).toBe('E-Commerce');
      createdProfileIds.push(profile.id);

      const db = getDatabase();
      const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile.id) as any;
      expect(row).toBeDefined();
    });

    it('Template 4: creates and persists Business & Work profile via alias', async () => {
      // Test using starter-business alias
      const profile = await createProfileFromStarter('starter-business', {
        name: 'My Business Work Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('My Business Work Test');
      expect(profile.folder).toBe('Work');
      createdProfileIds.push(profile.id);

      const db = getDatabase();
      const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile.id) as any;
      expect(row).toBeDefined();
    });

    it('Template 5: creates and persists Automation Example profile', async () => {
      const profile = await createProfileFromStarter('starter_automation', {
        name: 'My Automation Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('My Automation Test');
      expect(profile.folder).toBe('Automation');
      createdProfileIds.push(profile.id);

      const db = getDatabase();
      const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get(profile.id) as any;
      const settings = JSON.parse(settingsRow.settings_json);
      expect(settings.browser?.additionalArgs).toContain('--remote-debugging-port=0');
    });

    it('Template 6: creates and persists Sandbox & Test profile', async () => {
      const profile = await createProfileFromStarter('starter_sandbox', {
        name: 'My Sandbox Test',
        ownerId: testUserId,
      });

      expect(profile).toBeDefined();
      expect(profile.name).toBe('My Sandbox Test');
      expect(profile.folder).toBe('Sandbox');
      createdProfileIds.push(profile.id);

      const db = getDatabase();
      const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get(profile.id) as any;
      const settings = JSON.parse(settingsRow.settings_json);
      expect(settings.network?.webrtc).toBe('disabled');
      expect(settings.permissions?.camera).toBe('block');
    });
  });

  describe('3. Persistence Across Database Queries & Storage Isolation', () => {
    it('persists created profiles and verifies getProfileById retrieves them', async () => {
      const profile = await createProfileFromStarter('starter_personal', {
        name: 'Persistent Isolation Check',
      });
      createdProfileIds.push(profile.id);

      // Fetch fresh from database
      const retrieved = getProfileById(profile.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(profile.id);
      expect(retrieved!.name).toBe('Persistent Isolation Check');
      expect(retrieved!.status).toBe('STOPPED');
      expect(retrieved!.storagePath).toBeDefined();
    });

    it('handles non-existent template ID with clear structured error', async () => {
      expect(() => createProfileFromStarter('invalid_nonexistent_template')).toThrow(
        /Starter template "invalid_nonexistent_template" not found/
      );
    });
  });
});
