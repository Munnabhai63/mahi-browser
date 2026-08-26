import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  getCaptchaConfig,
  saveCaptchaConfig,
  checkCaptchaBalance,
  solveCaptcha,
} from '../../09_AUTOMATION/captcha-service.js';
import { CaptchaProvider } from '../../10_CONFIG/shared/types/captcha.js';

describe('Phase 14: 10-Cycle Captcha Solver Stress & Reliability Suite', () => {
  let tempDir: string;
  const providers: CaptchaProvider[] = ['2captcha', 'capmonster', 'anticaptcha', 'ezcaptcha'];

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase14-stress-'));
    const testDbPath = path.join(tempDir, 'stress_phase14.sqlite');
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

  for (let cycle = 1; cycle <= 10; cycle++) {
    it(`Cycle ${cycle}/10: Provider switching, config persistence, and balance validation`, async () => {
      const prov = providers[(cycle - 1) % providers.length];
      const apiKey = `stress_api_key_${prov}_cycle_${cycle}`;

      // 1. Save Config
      saveCaptchaConfig({
        enabled: cycle % 2 === 0,
        provider: prov,
        apiKey,
        autoSolveInBrowser: true,
        autoSolveInRpa: true,
        timeoutSeconds: 30 + cycle,
      });

      // 2. Verify Persistence
      const saved = getCaptchaConfig();
      expect(saved.provider).toBe(prov);
      expect(saved.apiKey).toBe(apiKey);
      expect(saved.timeoutSeconds).toBe(30 + cycle);

      // 3. Balance validation with empty key check
      const emptyCheck = await checkCaptchaBalance(prov, '');
      expect(emptyCheck.success).toBe(false);

      // 4. Missing key error handling
      saveCaptchaConfig({ apiKey: '' });
      const solveRes = await solveCaptcha({
        type: 'turnstile',
        websiteUrl: 'https://example.com',
        websiteKey: 'dummy-key',
      });
      expect(solveRes.success).toBe(false);
      expect(solveRes.error).toContain('not configured');
    });
  }
});
