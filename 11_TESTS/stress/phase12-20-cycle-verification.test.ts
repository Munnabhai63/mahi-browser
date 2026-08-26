import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, deleteProfile, cloneProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';
import {
  getExtensions,
  installExtension,
  toggleExtension,
  removeExtension,
} from '../../02_BROWSER/services/extension-service.js';
import { exportCookies, importCookies } from '../../02_BROWSER/services/cookie-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('20-Cycle Deep Verification & Functional Audit', () => {
  let tempDir: string;
  let sampleExtPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-20cycle-'));
    const testDbPath = path.join(tempDir, 'test_20cycle.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create sample extension
    sampleExtPath = path.join(tempDir, 'cycle-ext');
    fs.mkdirSync(sampleExtPath, { recursive: true });
    fs.writeFileSync(
      path.join(sampleExtPath, 'manifest.json'),
      JSON.stringify({
        name: 'Anti-Detect Shield',
        version: '2.0.0',
        manifest_version: 3,
      }),
      'utf8'
    );
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  for (let cycle = 1; cycle <= 20; cycle++) {
    it(`Cycle ${cycle}/20: Profile CRUD, Extension Management, Cookie Export and Import Pipeline`, async () => {
      // 1. Create Profile
      const prof = createProfile({
        name: `Cycle-Profile-${cycle}`,
        folder: 'General',
        settings: getDefaultProfileSettings(),
      });
      expect(prof).toBeDefined();

      // 2. Install Unpacked Extension
      const ext = await installExtension({
        profileId: prof.id,
        name: 'Anti-Detect Shield',
        version: '2.0.0',
        source: 'unpacked',
        location: sampleExtPath,
      });
      expect(ext.name).toBe('Anti-Detect Shield');

      // 3. Import Cookies
      const cookiePayload = JSON.stringify([
        {
          name: `session_${cycle}`,
          value: `val_${cycle}_secure_token`,
          domain: '.google.com',
          path: '/',
          secure: true,
        },
      ]);
      const impRes = await importCookies(prof.id, cookiePayload);
      expect(impRes.importedCount).toBe(1);

      // 4. Export Netscape Cookies
      const netscape = await exportCookies({
        profileId: prof.id,
        format: 'netscape',
      });
      expect(netscape).toContain('.google.com');
      expect(netscape).toContain(`session_${cycle}`);

      // 5. Clone Profile
      const cloned = cloneProfile(prof.id, `Cloned-Cycle-${cycle}`);
      expect(cloned.name).toBe(`Cloned-Cycle-${cycle}`);

      // 6. Cleanup
      deleteProfile(prof.id);
      deleteProfile(cloned.id);
    });
  }
});
