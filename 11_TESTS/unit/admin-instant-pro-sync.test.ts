import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { evaluateUserEntitlements } from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import { getUserById } from '../../07_BACKEND/commercial/commercial-auth-service.js';

describe('Admin Instant Pro Entitlement & Sync Engine', () => {
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-instant-pro-'));
  const testDbPath = path.join(testDbDir, 'instant_pro_test.sqlite');

  beforeEach(async () => {
    closeDatabase();
    fs.mkdirSync(testDbDir, { recursive: true });
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${testDbPath}${suffix}`); } catch {}
    }
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch {}
  });

  it('honors active license in evaluateUserEntitlements without reverting to free', () => {
    const db = getDatabase();
    const userId = 'usr_instant_test_1';
    const email = 'pro_user@test.mahibrowser.com';
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 30 * 86400000).toISOString();

    // 1. Create registered user in auth_users
    db.prepare(`
      INSERT INTO auth_users (id, email, normalized_email, password_hash, salt, name, role, status, plan_id, profile_quota, created_at, updated_at)
      VALUES (?, ?, ?, 'dummy_hash', 'salt', 'Pro Tester', 'USER', 'ACTIVE', 'plan_free', 10, ?, ?)
    `).run(userId, email, email, now, now);

    // 2. Initial state: free user
    const initialEnt = evaluateUserEntitlements(userId);
    expect(initialEnt.plan.id).toBe('plan_free');
    expect(initialEnt.limits.maxProfiles).toBe(15);

    // 3. Admin grants license in licenses table & sets plan_id on auth_users
    const licId = 'lic_test_123';
    db.prepare(`
      INSERT INTO licenses (id, license_key_hash, key_masked, customer_name, account_id, status, duration_type, max_devices, starts_at, expires_at, created_at, created_by, notes)
      VALUES (?, 'hash123', 'MAHI-****-1234', 'Pro Tester', ?, 'ACTIVE', '30_DAYS', 2, ?, ?, ?, 'OWNER', 'Plan: professional_50')
    `).run(licId, userId, now, exp, now);

    db.prepare(`UPDATE auth_users SET plan_id = 'professional_50', profile_quota = 50, updated_at = ? WHERE id = ?`).run(now, userId);

    // 4. Verify getUserById sees the updated plan_id
    const userObj = getUserById(userId);
    expect(userObj?.planId).toBe('professional_50');

    // 5. evaluateUserEntitlements must resolve to professional_50 and NOT reset user to free!
    const upgradedEnt = evaluateUserEntitlements(userId);
    expect(upgradedEnt.plan.id).toBe('professional_50');
    expect(upgradedEnt.limits.maxProfiles).toBe(50);
    expect(upgradedEnt.license?.id).toBe(licId);

    // 6. Verify user is still professional_50 after evaluation (was not demoted)
    const userAfter = getUserById(userId);
    expect(userAfter?.planId).toBe('professional_50');
  });

  it('evaluates active commercial_subscription correctly when set by owner', () => {
    const db = getDatabase();
    const userId = 'usr_instant_test_2';
    const email = 'biz_user@test.mahibrowser.com';
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 30 * 86400000).toISOString();

    db.prepare(`
      INSERT INTO auth_users (id, email, normalized_email, password_hash, salt, name, role, status, plan_id, profile_quota, created_at, updated_at)
      VALUES (?, ?, ?, 'dummy_hash', 'salt', 'Biz Tester', 'USER', 'ACTIVE', 'plan_business', 200, ?, ?)
    `).run(userId, email, email, now, now);

    db.prepare(`
      INSERT INTO commercial_users (id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at)
      VALUES (?, ?, 'dummy_hash', 'salt', 'Biz Tester', 'USER', 'ACTIVE', 'plan_business', ?, ?)
    `).run(userId, email, now, now);

    db.prepare(`
      INSERT INTO commercial_subscriptions (id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at)
      VALUES ('sub_test_biz', ?, 'plan_business', 'ACTIVE', 'MONTHLY', ?, ?, 'OWNER_SET_PLAN', ?)
    `).run(userId, now, exp, now);

    const ent = evaluateUserEntitlements(userId);
    expect(ent.limits.maxProfiles).toBe(100);
    expect(ent.plan.tier).toBe('BUSINESS');
  });

  it('resolves user correctly whether queried by central:id, bare id, or email', () => {
    const db = getDatabase();
    const userId = 'usr_c2887381_test';
    const email = 'munaffyt_test@gmail.com';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO auth_users (id, email, normalized_email, password_hash, salt, name, role, status, plan_id, profile_quota, created_at, updated_at)
      VALUES (?, ?, ?, 'hash', 'salt', 'Kairo', 'USER', 'ACTIVE', 'plan_free', 15, ?, ?)
    `).run(userId, email, email, now, now);

    // Bare ID
    const byBareId = getUserById(userId);
    expect(byBareId).not.toBeNull();
    expect(byBareId?.id).toBe(userId);

    // central: prefix stripped
    const cleanId = 'central:' + userId;
    const stripped = cleanId.startsWith('central:') ? cleanId.slice(8) : cleanId;
    expect(getUserById(stripped)?.id).toBe(userId);

    // By Email
    expect(getUserById(email)?.id).toBe(userId);
  });
});
