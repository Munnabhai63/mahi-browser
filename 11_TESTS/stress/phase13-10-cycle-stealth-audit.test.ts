import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, updateProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { auditProfileFingerprint, autoFixProfileFingerprint } from '../../03_HARDWARE/diagnostics-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 13: 10-Cycle Fingerprint Audit & Auto-Fix Stress Suite', { timeout: 30000 }, () => {
  let tempDir: string;
  let testProfiles: { id: string; name: string }[] = [];

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase13-stress-'));
    const testDbPath = path.join(tempDir, 'stress_phase13.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    for (let i = 1; i <= 10; i++) {
      const p = createProfile({
        name: `Stress Profile ${i}`,
        settings: getDefaultProfileSettings(),
      });
      testProfiles.push({ id: p.id, name: p.name });
    }
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  for (let cycle = 1; cycle <= 10; cycle++) {
    it(`Cycle ${cycle}/10: Audit, degrade, leak-check, and auto-fix profile`, () => {
      const p = testProfiles[cycle - 1];

      // 1. Initial Baseline Audit
      const initialReport = auditProfileFingerprint(p.id);
      expect(initialReport.overallScore).toBeGreaterThanOrEqual(90);

      // 2. Inject intentional vulnerabilities
      updateProfile(p.id, {
        settings: {
          ...getDefaultProfileSettings(),
          fingerprint: {
            ...getDefaultProfileSettings().fingerprint,
            canvas: cycle % 2 === 0 ? 'off' : 'block',
            webgl: 'off',
            audio: 'off',
            webrtc: 'off',
            hardwareConcurrency: 2,
            deviceMemory: 2,
          },
          network: {
            proxyId: `proxy-${cycle}`,
            directConnection: false,
          },
        },
      });

      // 3. Verify vulnerability is caught
      const leakReport = auditProfileFingerprint(p.id);
      expect(leakReport.overallScore).toBeLessThan(80);
      expect(leakReport.stealthGrade).toBe('RISK');

      // 4. Auto-Fix
      const fixedReport = autoFixProfileFingerprint(p.id);
      expect(fixedReport.overallScore).toBe(100);
      expect(fixedReport.stealthGrade).toBe('ULTRA');
      expect(fixedReport.failCount).toBe(0);
      expect(fixedReport.warnCount).toBe(0);
      expect(fixedReport.passedCount).toBe(9);
    });
  }
});
