import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import {
  getWritableUserDataDir,
  getWritableSubdir,
  getBundledResourcePath,
  getLandingBaseDir,
  isAppPackaged,
} from '../../07_BACKEND/utils/runtime-paths.js';
import { getDatabase, initializeDatabase, closeDatabase, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase as initSchema } from '../../06_DATABASE/schema.js';
import {
  pruneWebHandoffSessions,
  _resetWebHandoffSessions,
  webHandoffSessions,
  handleCommercialApiRoutes,
} from '../../07_BACKEND/commercial/commercial-api-router.js';
import { evaluateUserEntitlements, checkCapability } from '../../07_BACKEND/commercial/commercial-entitlement-service.js';

describe('Step 7: Packaged Desktop App Hardening & Writable Paths', () => {
  const originalEnv = { ...process.env };
  const testDir = path.join(os.tmpdir(), `mahi-step7-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('resolves custom MAHI_USER_DATA_DIR override when set', () => {
    const custom = path.join(testDir, 'custom-data');
    process.env.MAHI_USER_DATA_DIR = custom;
    const resolved = getWritableUserDataDir();
    expect(resolved).toBe(path.resolve(custom));
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it('guarantees writable subdirectories exist inside userDataDir', () => {
    process.env.MAHI_USER_DATA_DIR = path.join(testDir, 'custom-data');
    const cloudWorkersDir = getWritableSubdir('cloud-workers');
    expect(cloudWorkersDir).toContain('cloud-workers');
    expect(fs.existsSync(cloudWorkersDir)).toBe(true);
  });

  it('resolves bundled landing directory and resources cleanly', () => {
    const landingDir = getLandingBaseDir();
    expect(typeof landingDir).toBe('string');
    expect(landingDir.length).toBeGreaterThan(0);

    const iconPath = getBundledResourcePath('13_ASSETS', 'resources', 'icon.png');
    // In repo checkout, icon should be resolvable
    if (iconPath) {
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  it('electron-builder.json includes landing and retains electron-updater', () => {
    const builderJsonPath = path.resolve(process.cwd(), 'electron-builder.json');
    expect(fs.existsSync(builderJsonPath)).toBe(true);
    const builderConfig = JSON.parse(fs.readFileSync(builderJsonPath, 'utf8'));

    // Check extraResources includes landing and bundled ADB platform-tools
    const hasLanding = builderConfig.extraResources.some(
      (r: any) => (r.from === 'landing' && r.to === 'landing')
    );
    expect(hasLanding).toBe(true);

    const hasPlatformTools = builderConfig.extraResources.some(
      (r: any) => (r.from === '.mahi_data/platform-tools' && r.to === 'platform-tools')
    );
    expect(hasPlatformTools).toBe(true);

    // Verify electron-updater is NOT excluded in files
    const filesList = builderConfig.files || [];
    const updaterExcluded = filesList.some((pattern: string) => pattern.includes('electron-updater'));
    expect(updaterExcluded).toBe(false);
  });
});

describe('Step 7: Persistent SQLite web_handoff_sessions & Anti-Replay', () => {
  const testDbDir = path.join(os.tmpdir(), `mahi-step7-db-${Date.now()}`);
  const testDbPath = path.join(testDbDir, 'test_handoff.sqlite');

  beforeEach(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    setCustomDatabasePath(testDbPath);
    await initSchema();
    _resetWebHandoffSessions();
  });

  afterEach(() => {
    closeDatabase();
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  it('persists web handoff session to SQLite and survives in-memory map wipe', async () => {
    const db = getDatabase();
    const handoffCode = `mb_web_test_${Date.now()}`;
    const token = 'test-token-jwt-step7';
    const user = { id: 'usr_test_step7', email: 'step7@mahibrowser.com', planId: 'plan_pro' };
    const now = Date.now();
    const expiresAt = now + 120_000;

    // Simulate creation inserted into DB
    db.prepare(
      'INSERT INTO web_handoff_sessions (code, token, user_json, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(handoffCode, token, JSON.stringify(user), now, expiresAt);

    // Wipe in-memory map completely to simulate server restart
    webHandoffSessions.clear();
    expect(webHandoffSessions.has(handoffCode)).toBe(false);

    function createMockHttp(payload: any) {
      let statusCode = 200;
      let resData = '';
      const req = Object.assign(new EventEmitter(), {
        url: '/api/v1/auth/web-handoff/exchange',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const res = {
        writeHead: (code: number) => { statusCode = code; return res; },
        setHeader: () => res,
        end: (chunk?: any) => {
          if (chunk) resData += chunk.toString();
          return res;
        },
      };

      const raw = JSON.stringify(payload);
      process.nextTick(() => {
        req.emit('data', raw);
        req.emit('end');
      });

      return {
        req,
        res,
        getResult: () => ({ statusCode, json: resData ? JSON.parse(resData) : null }),
      };
    }

    // Simulate exchange request payload
    const { req, res, getResult } = createMockHttp({ handoffCode });
    const handled = await handleCommercialApiRoutes(
      req as any,
      res as any,
      '/api/v1/auth/web-handoff/exchange',
      'POST',
      new URL('http://127.0.0.1/api/v1/auth/web-handoff/exchange')
    );
    expect(handled).toBe(true);
    const result1 = getResult();
    expect(result1.statusCode).toBe(200);
    expect(result1.json.success).toBe(true);
    expect(result1.json.token).toBe(token);
    expect(result1.json.user.id).toBe('usr_test_step7');

    // Anti-replay: second exchange must fail with 403
    const { req: req2, res: res2, getResult: getResult2 } = createMockHttp({ handoffCode });
    await handleCommercialApiRoutes(
      req2 as any,
      res2 as any,
      '/api/v1/auth/web-handoff/exchange',
      'POST',
      new URL('http://127.0.0.1/api/v1/auth/web-handoff/exchange')
    );
    const result2 = getResult2();
    expect(result2.statusCode).toBe(403);
    expect(result2.json.success).toBe(false);
  });

  it('pruneWebHandoffSessions removes expired rows from SQLite', () => {
    const db = getDatabase();
    const expiredCode = `mb_web_expired_${Date.now()}`;
    const pastTime = Date.now() - 5000;
    db.prepare(
      'INSERT INTO web_handoff_sessions (code, token, user_json, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(expiredCode, 'tok', '{}', pastTime - 10000, pastTime);

    pruneWebHandoffSessions();

    const check = db.prepare('SELECT * FROM web_handoff_sessions WHERE code = ?').get(expiredCode);
    expect(check).toBeFalsy();
  });
});

describe('Step 7: Trial & Subscription Entitlement Hardening', () => {
  const testDbDir = path.join(os.tmpdir(), `mahi-step7-ent-db-${Date.now()}`);
  const testDbPath = path.join(testDbDir, 'test_ent.sqlite');

  beforeEach(async () => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    setCustomDatabasePath(testDbPath);
    await initSchema();
  });

  afterEach(() => {
    closeDatabase();
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  it('correctly recognizes active TRIAL subscription and grants trial plan limits', () => {
    const db = getDatabase();
    const userId = `usr_trial_${Date.now()}`;
    const futureTime = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    db.prepare(`
      INSERT INTO commercial_users (id, email, name, password_hash, salt, role, status, plan_id, trial_expires_at, signup_intent, created_at, updated_at)
      VALUES (?, 'trialuser@mahibrowser.com', 'Trial User', 'hash', 'salt123', 'USER', 'ACTIVE', 'plan_pro', ?, 'trial', datetime('now'), datetime('now'))
    `).run(userId, futureTime);

    db.prepare(`
      INSERT INTO commercial_subscriptions (id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, created_at)
      VALUES (?, ?, 'plan_pro', 'TRIAL', 'TRIAL', datetime('now'), ?, datetime('now'))
    `).run(`sub_trial_${Date.now()}`, userId, futureTime);

    const entitlements = evaluateUserEntitlements(userId);
    expect(entitlements.isTrialActive).toBe(true);
    expect(entitlements.plan.tier).not.toBe('FREE');
    expect(entitlements.subscription?.status).toBe('TRIAL');
  });

  it('downgrades expired subscription to plan_free and sets status to EXPIRED', () => {
    const db = getDatabase();
    const userId = `usr_exp_${Date.now()}`;
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const subId = `sub_exp_${Date.now()}`;

    db.prepare(`
      INSERT INTO commercial_users (id, email, name, password_hash, salt, role, status, plan_id, created_at, updated_at)
      VALUES (?, 'expuser@mahibrowser.com', 'Expired User', 'hash', 'salt123', 'USER', 'ACTIVE', 'plan_pro', datetime('now'), datetime('now'))
    `).run(userId);

    db.prepare(`
      INSERT INTO commercial_subscriptions (id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, created_at)
      VALUES (?, ?, 'plan_pro', 'ACTIVE', 'MONTHLY', datetime('now', '-2 months'), ?, datetime('now', '-2 months'))
    `).run(subId, userId, pastTime);

    const entitlements = evaluateUserEntitlements(userId);
    expect(entitlements.plan.tier).toBe('FREE');
    expect(entitlements.user.planId).toBe('plan_free');
    expect(entitlements.subscription?.status).toBe('EXPIRED');

    // Verify DB update persisted
    const updatedSub = db.prepare('SELECT status FROM commercial_subscriptions WHERE id = ?').get(subId) as any;
    expect(updatedSub.status).toBe('EXPIRED');

    const updatedUser = db.prepare('SELECT plan_id FROM commercial_users WHERE id = ?').get(userId) as any;
    expect(updatedUser.plan_id).toBe('plan_free');
  });

  it('checkCapability immediately returns allowed: false when Pro subscription or trial is expired', () => {
    const db = getDatabase();
    const userId = `usr_cap_exp_${Date.now()}`;
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const subId = `sub_cap_exp_${Date.now()}`;

    db.prepare(`
      INSERT INTO commercial_users (id, email, name, password_hash, salt, role, status, plan_id, created_at, updated_at)
      VALUES (?, 'capexp@mahibrowser.com', 'Cap Exp User', 'hash', 'salt123', 'USER', 'ACTIVE', 'plan_pro', datetime('now'), datetime('now'))
    `).run(userId);

    db.prepare(`
      INSERT INTO commercial_subscriptions (id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, created_at)
      VALUES (?, ?, 'plan_pro', 'ACTIVE', 'MONTHLY', datetime('now', '-2 months'), ?, datetime('now', '-2 months'))
    `).run(subId, userId, pastTime);

    // Pro capability check: e.g. team.sharing
    const result = checkCapability(userId, 'team.sharing');
    expect(result.allowed).toBe(false);
    expect(result.entitled).toBe(false);

    // Also check for an expired trial without subscription row
    const trialUserId = `usr_trial_exp_${Date.now()}`;
    db.prepare(`
      INSERT INTO commercial_users (id, email, name, password_hash, salt, role, status, plan_id, trial_expires_at, signup_intent, created_at, updated_at)
      VALUES (?, 'trialexp@mahibrowser.com', 'Trial Exp', 'hash', 'salt123', 'USER', 'ACTIVE', 'plan_pro', ?, 'trial', datetime('now'), datetime('now'))
    `).run(trialUserId, pastTime);

    const trialResult = checkCapability(trialUserId, 'team.sharing');
    expect(trialResult.allowed).toBe(false);
    expect(trialResult.entitled).toBe(false);
  });
});
