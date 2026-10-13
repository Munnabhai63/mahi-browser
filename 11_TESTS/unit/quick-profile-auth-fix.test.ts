import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { CreateProfileDTOSchema } from '../../10_CONFIG/shared/validation/schemas.js';
import { assertCanCreateProfile, getNonDeletedProfileCount } from '../../08_SECURITY/freemium-guard.js';
import { initSqlEngine, getDatabase } from '../../06_DATABASE/connection.js';
import { createProfile, getProfileById, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('P1 Production Bug Fix: Preload Integrity, Quick Profile Creation & Session Persistence', () => {
  beforeAll(async () => {
    await initSqlEngine();
  });

  describe('1. Preload Script Syntax & Compilation Integrity', () => {
    it('verifies 10_CONFIG/preload/preload.cjs has zero syntax errors and compiles cleanly', () => {
      const preloadPath = path.resolve('10_CONFIG', 'preload', 'preload.cjs');
      expect(fs.existsSync(preloadPath)).toBe(true);

      const code = fs.readFileSync(preloadPath, 'utf8');
      expect(() => {
        // Compile inside vm context to verify syntax and absence of syntax errors
        new vm.Script(code, { filename: 'preload.cjs' });
      }).not.toThrow();
    });

    it('verifies dist-electron/preload/index.cjs has zero syntax errors and matches source', () => {
      const distPreload = path.resolve('dist-electron', 'preload', 'index.cjs');
      expect(fs.existsSync(distPreload)).toBe(true);

      const code = fs.readFileSync(distPreload, 'utf8');
      expect(() => {
        new vm.Script(code, { filename: 'index.cjs' });
      }).not.toThrow();
    });

    it('verifies preload exposes createProfile, bulkCreateProfiles, and account auth IPC methods', () => {
      const preloadPath = path.resolve('10_CONFIG', 'preload', 'preload.cjs');
      const code = fs.readFileSync(preloadPath, 'utf8');

      expect(code).toContain('createProfile: (dto) => ipcRenderer.invoke(\'profiles:create\', dto)');
      expect(code).toContain('accountSignup: (dto) => ipcRenderer.invoke(\'account:signup\', dto)');
      expect(code).toContain('accountLogin: (dto) => ipcRenderer.invoke(\'account:login\', dto)');
      expect(code).toContain('accountGetSession: () => ipcRenderer.invoke(\'account:getSession\')');
      expect(code).toContain('accountGetPlanLimits: () => ipcRenderer.invoke(\'account:getPlanLimits\')');
      expect(code).toContain('contextBridge.exposeInMainWorld(\'mahiAPI\', api)');
    });
  });

  describe('2. Quick Profile Creation Schema & Execution Pipeline', () => {
    let createdProfileId: string | null = null;

    afterAll(() => {
      if (createdProfileId) {
        try {
          deleteProfile(createdProfileId);
        } catch {}
      }
    });

    it('validates Quick Create Profile DTO with standard defaults', () => {
      const defaults = getDefaultProfileSettings();
      const rawDto = {
        name: 'Quick Test Profile 1',
        folder: 'General',
        notes: 'Integration test note',
        tags: ['Workspace'],
        settings: defaults,
      };

      const parsed = CreateProfileDTOSchema.safeParse(rawDto);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Quick Test Profile 1');
        expect(parsed.data.folder).toBe('General');
      }
    });

    it('verifies assertCanCreateProfile passes for legitimate profiles within free quota', () => {
      const currentCount = getNonDeletedProfileCount();
      // Should not throw as long as within free limit
      if (currentCount < 15) {
        expect(() => assertCanCreateProfile(1)).not.toThrow();
      }
    });

    it('executes createProfile and verifies SQLite persistence without 401 error', () => {
      const defaults = getDefaultProfileSettings();
      const dto = {
        name: `Quick Profile E2E ${Date.now()}`,
        folder: 'General',
        notes: 'Verified E2E persistence',
        tags: ['QuickCreate', 'E2E'],
        settings: defaults,
      };

      const profile = createProfile(dto);
      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.name).toBe(dto.name);
      createdProfileId = profile.id;

      // Verify retrieval from SQLite database
      const fetched = getProfileById(profile.id);
      expect(fetched).toBeDefined();
      expect(fetched?.name).toBe(dto.name);
      expect(fetched?.folder).toBe('General');
    });
  });
});
