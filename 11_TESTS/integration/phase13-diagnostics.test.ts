import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, updateProfile } from '../../02_BROWSER/services/profile-service.js';
import { auditProfileFingerprint, autoFixProfileFingerprint } from '../../03_HARDWARE/diagnostics-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 13: Real-Time Fingerprint Stealth & Leak Diagnostics Suite', () => {
  let tempDir: string;
  let profileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase13-'));
    const testDbPath = path.join(tempDir, 'test_phase13.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Diagnostics Test Profile',
      settings: getDefaultProfileSettings(),
    });
    profileId = prof.id;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should run a multi-vector audit and return structured report on default profile', () => {
    const report = auditProfileFingerprint(profileId);

    expect(report).toBeDefined();
    expect(report.profileId).toBe(profileId);
    expect(report.profileName).toBe('Diagnostics Test Profile');
    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.stealthGrade).toBe('ULTRA');
    expect(report.checks.length).toBe(9);

    const checkIds = report.checks.map((c) => c.id);
    expect(checkIds).toContain('check-webrtc');
    expect(checkIds).toContain('check-canvas');
    expect(checkIds).toContain('check-webgl');
    expect(checkIds).toContain('check-audio');
    expect(checkIds).toContain('check-hardware');
    expect(checkIds).toContain('check-clientrects');
    expect(checkIds).toContain('check-locale');
    expect(checkIds).toContain('check-display');
    expect(checkIds).toContain('check-coherence');
  });

  it('should detect anti-bot leak vulnerabilities when protections are disabled', () => {
    // Inject intentionally degraded/vulnerable settings
    updateProfile(profileId, {
      settings: {
        ...getDefaultProfileSettings(),
        fingerprint: {
          ...getDefaultProfileSettings().fingerprint,
          canvas: 'off',
          webgl: 'off',
          audio: 'off',
          webrtc: 'off',
          webglRenderer: 'SwiftShader LLVMpipe (Software)',
          hardwareConcurrency: 2,
          deviceMemory: 2,
        },
        network: {
          proxyId: 'test-proxy-id',
          directConnection: false,
        },
      },
    });

    const report = auditProfileFingerprint(profileId);
    expect(report.overallScore).toBeLessThan(75);
    expect(report.stealthGrade).toBe('RISK');
    expect(report.failCount).toBeGreaterThan(0);

    const webrtcCheck = report.checks.find((c) => c.id === 'check-webrtc');
    expect(webrtcCheck?.status).toBe('FAIL');
    expect(webrtcCheck?.recommendation).toBeDefined();

    const canvasCheck = report.checks.find((c) => c.id === 'check-canvas');
    expect(canvasCheck?.status).toBe('FAIL');

    const webglCheck = report.checks.find((c) => c.id === 'check-webgl');
    expect(webglCheck?.status).toBe('WARN');
  });

  it('should auto-fix all fingerprint vulnerabilities to 100% Ultra-Stealth compliance', () => {
    const fixedReport = autoFixProfileFingerprint(profileId);

    expect(fixedReport).toBeDefined();
    expect(fixedReport.overallScore).toBe(100);
    expect(fixedReport.stealthGrade).toBe('ULTRA');
    expect(fixedReport.failCount).toBe(0);
    expect(fixedReport.warnCount).toBe(0);
    expect(fixedReport.passedCount).toBe(9);

    // Verify all individual checks are PASS
    for (const check of fixedReport.checks) {
      expect(check.status).toBe('PASS');
      expect(check.score).toBe(100);
    }
  });
});
