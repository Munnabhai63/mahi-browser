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
import { saveWorkflow, runWorkflow } from '../../09_AUTOMATION/automation-engine.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 14: Automated Captcha Solver Engine Suite', () => {
  let tempDir: string;
  let profileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase14-'));
    const testDbPath = path.join(tempDir, 'test_phase14.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Captcha Test Profile',
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

  it('should retrieve default captcha config and save updated settings', () => {
    const initialConfig = getCaptchaConfig();
    expect(initialConfig).toBeDefined();
    expect(initialConfig.enabled).toBe(false);
    expect(initialConfig.provider).toBe('2captcha');

    const updated = saveCaptchaConfig({
      enabled: true,
      provider: 'capmonster',
      apiKey: 'test_capmonster_api_key_123',
      autoSolveInBrowser: true,
      autoSolveInRpa: true,
      timeoutSeconds: 45,
    });
    expect(updated).toBe(true);

    const savedConfig = getCaptchaConfig();
    expect(savedConfig.enabled).toBe(true);
    expect(savedConfig.provider).toBe('capmonster');
    expect(savedConfig.apiKey).toBe('test_capmonster_api_key_123');
    expect(savedConfig.timeoutSeconds).toBe(45);
  });

  it('should validate empty API keys gracefully on balance check', async () => {
    const emptyRes = await checkCaptchaBalance('2captcha', '');
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.error).toContain('empty');
  });

  it('should fail with meaningful error when solving without API key', async () => {
    saveCaptchaConfig({ apiKey: '' });

    const solveRes = await solveCaptcha({
      type: 'turnstile',
      websiteUrl: 'https://challenges.cloudflare.com',
      websiteKey: '0x4AAAAAAADnPIDROrmt1Wwj',
    });

    expect(solveRes.success).toBe(false);
    expect(solveRes.error).toContain('not configured');
  });

  it('should execute SOLVE_CAPTCHA action block inside RPA workflow without throwing errors', async () => {
    const wf = saveWorkflow({
      name: 'Captcha RPA Test Workflow',
      steps: [
        {
          id: 'step-url',
          order: 0,
          type: 'OPEN_URL',
          target: 'about:blank',
          timeoutMs: 10000,
        },
        {
          id: 'step-captcha',
          order: 1,
          type: 'SOLVE_CAPTCHA',
          target: 'turnstile',
          value: '0x4AAAAAAADnPIDROrmt1Wwj',
          timeoutMs: 5000,
        },
        {
          id: 'step-close',
          order: 2,
          type: 'CLOSE_BROWSER',
        },
      ],
    });

    const execution = await runWorkflow({
      workflowId: wf.id,
      profileId,
    });

    expect(execution).toBeDefined();
    expect(execution.status).toBe('SUCCESS');
    expect(execution.stepLogs.length).toBe(3);
    expect(execution.stepLogs[1].status).toBe('SUCCESS');
  }, 30000);
});
