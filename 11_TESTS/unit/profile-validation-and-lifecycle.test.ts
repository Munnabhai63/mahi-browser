import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import {
  ProfileSettingsSchema,
  CreateProfileDTOSchema,
  UpdateProfileDTOSchema,
} from '../../10_CONFIG/shared/validation/schemas.js';
import {
  createProfile,
  getProfileById,
  softDeleteProfile,
  restoreProfile,
  deleteProfile,
} from '../../02_BROWSER/services/profile-service.js';
import { setCustomDatabasePath, closeDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Task R4: Profile Validation & Lifecycle Suite', () => {
  const testDir = path.resolve('.mahi_data', 'test_profile_validation_lifecycle');
  const dbPath = path.join(testDir, 'lifecycle_test.sqlite');

  beforeAll(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('1. Profile Settings Zod Schemas', () => {
    it('validates fingerprint, mobile, and fakeVideoCapture in ProfileSettingsSchema', () => {
      const validSettings = {
        browser: {
          engine: 'chromium' as const,
          userAgent: 'Mozilla/5.0 Chrome/130.0.0.0',
        },
        fingerprint: {
          canvas: 'noise',
          webgl: 'noise',
          audio: 'noise',
          clientRects: 'noise',
          hardwareConcurrency: 8,
          deviceMemory: 16,
          canvasNoise: true,
          audioContextNoise: true,
          fonts: ['Arial', 'Helvetica'],
        },
        display: {
          screenWidth: 1920,
          screenHeight: 1080,
          deviceScaleFactor: 1,
          colorDepth: 24,
        },
        locale: {
          language: 'en-US',
          timezone: 'America/New_York',
          languagesList: ['en-US', 'en'],
        },
        network: {
          directConnection: true,
          webrtc: 'default' as const,
        },
        permissions: {
          camera: 'prompt' as const,
          microphone: 'prompt' as const,
          geolocation: 'prompt' as const,
          notifications: 'prompt' as const,
          midi: 'prompt' as const,
        },
        fakeVideoCapture: {
          enable: true,
          filePath: 'C:\\media\\fake-webcam.y4m',
        },
        mobile: {
          enable: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
        },
      };

      const parsed = ProfileSettingsSchema.safeParse(validSettings);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.fingerprint?.canvas).toBe('noise');
        expect(parsed.data.mobile?.enable).toBe(true);
        expect(parsed.data.fakeVideoCapture?.filePath).toBe('C:\\media\\fake-webcam.y4m');
      }
    });

    it('accepts partial settings in CreateProfileDTOSchema and UpdateProfileDTOSchema', () => {
      const createDto = {
        name: 'Mobile Profile 1',
        settings: {
          mobile: {
            enable: true,
            width: 412,
            height: 915,
          },
          fakeVideoCapture: {
            enable: true,
          },
        },
      };

      const createParsed = CreateProfileDTOSchema.safeParse(createDto);
      expect(createParsed.success).toBe(true);

      const updateDto = {
        settings: {
          fingerprint: {
            hardwareConcurrency: 16,
          },
        },
      };

      const updateParsed = UpdateProfileDTOSchema.safeParse(updateDto);
      expect(updateParsed.success).toBe(true);
    });
  });

  describe('2. Soft-Delete Filtering in getProfileById', () => {
    let createdProfileId = '';

    beforeEach(() => {
      const profile = createProfile({
        name: 'Soft Delete Target',
        folder: 'General',
      });
      createdProfileId = profile.id;
    });

    afterEach(() => {
      try {
        deleteProfile(createdProfileId);
      } catch {}
    });

    it('returns active profile when deleted_at is null', () => {
      const p = getProfileById(createdProfileId);
      expect(p).not.toBeNull();
      expect(p?.id).toBe(createdProfileId);
    });

    it('filters out soft-deleted profiles by default, returns them with includeDeleted: true', () => {
      // Soft-delete the profile
      const deleted = softDeleteProfile(createdProfileId);
      expect(deleted).toBe(true);

      // Default call should now return null
      const activeQuery = getProfileById(createdProfileId);
      expect(activeQuery).toBeNull();

      // Explicit includeDeleted: true returns the soft-deleted record
      const deletedQuery = getProfileById(createdProfileId, undefined, { includeDeleted: true });
      expect(deletedQuery).not.toBeNull();
      expect(deletedQuery?.id).toBe(createdProfileId);

      // Restore profile from Trash Bin
      const restored = restoreProfile(createdProfileId);
      expect(restored).not.toBeNull();

      // Now visible again to default queries
      const restoredQuery = getProfileById(createdProfileId);
      expect(restoredQuery).not.toBeNull();
      expect(restoredQuery?.id).toBe(createdProfileId);
    });
  });

  describe('3. ProcessManager Lifecycle, Double-Close Latch & Mutex', () => {
    it('manages startingProfile lock to prevent concurrent launch race conditions', async () => {
      const { processManager } = await import('../../02_BROWSER/process-manager.js');

      // Create a test profile in DB
      const prof = createProfile({ name: 'Race Test Profile' });

      // Mock launchBrowser to artificially delay
      const launcherModule = await import('../../02_BROWSER/launcher.js');
      const fakeProcess = new EventEmitter() as any;
      fakeProcess.pid = 99991;

      const launchSpy = vi.spyOn(launcherModule, 'launchBrowser').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return {
          process: fakeProcess,
          pid: 99991,
          storageDir: prof.storagePath,
        };
      });

      // Launch twice simultaneously
      const p1 = processManager.startProfile(prof.id);
      const p2 = processManager.startProfile(prof.id);

      const [res1, res2] = await Promise.all([p1, p2]);

      // Exactly one succeeds, the other is rejected by mutex
      const succeeded = [res1, res2].filter((r) => r.success);
      const failed = [res1, res2].filter((r) => !r.success);

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toContain('already starting');

      // Clean up running process
      fakeProcess.emit('exit', 0, null);
      launchSpy.mockRestore();
      deleteProfile(prof.id);
    });

    it('reports abnormal non-zero process exits as ERROR status', async () => {
      const { processManager } = await import('../../02_BROWSER/process-manager.js');
      const prof = createProfile({ name: 'Crash Test Profile' });

      const launcherModule = await import('../../02_BROWSER/launcher.js');
      const fakeProcess = new EventEmitter() as any;
      fakeProcess.pid = 99992;

      vi.spyOn(launcherModule, 'launchBrowser').mockResolvedValue({
        process: fakeProcess,
        pid: 99992,
        storageDir: prof.storagePath,
      });

      const events: any[] = [];
      const unsub = processManager.onStatusChange((evt) => {
        if (evt.profileId === prof.id) events.push(evt);
      });

      await processManager.startProfile(prof.id);
      expect(processManager.isRunning(prof.id)).toBe(true);

      // Simulate an abnormal crash exit (code 139 = SIGSEGV)
      fakeProcess.emit('exit', 139, null);

      expect(processManager.isRunning(prof.id)).toBe(false);

      // Verify status listener received ERROR
      const errorEvent = events.find((e) => e.status === 'ERROR');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toContain('139');

      unsub();
      deleteProfile(prof.id);
    });

    it('handles multiple close events gracefully via double-close latch', async () => {
      const { processManager } = await import('../../02_BROWSER/process-manager.js');
      const prof = createProfile({ name: 'Double Close Profile' });

      const launcherModule = await import('../../02_BROWSER/launcher.js');
      const fakeProcess = new EventEmitter() as any;
      fakeProcess.pid = 99993;

      vi.spyOn(launcherModule, 'launchBrowser').mockResolvedValue({
        process: fakeProcess,
        pid: 99993,
        storageDir: prof.storagePath,
      });

      let stoppedCount = 0;
      const unsub = processManager.onStatusChange((evt) => {
        if (evt.profileId === prof.id && evt.status === 'STOPPED') stoppedCount++;
      });

      await processManager.startProfile(prof.id);

      // Trigger exit and error concurrently
      fakeProcess.emit('exit', 0, null);
      fakeProcess.emit('exit', 0, null);
      fakeProcess.emit('error', new Error('Late socket hangup'));

      // Double-close latch must ensure STOPPED / teardown runs only once
      expect(stoppedCount).toBe(1);

      unsub();
      deleteProfile(prof.id);
    });
  });
});
