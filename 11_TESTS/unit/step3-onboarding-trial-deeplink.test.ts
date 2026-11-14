/**
 * MAHI Browser — Step 3 Mission Test Suite
 * Covers:
 * 1. Zero-Token Single-Use Web Handoff Protocol (Anti-Replay & Expiration)
 * 2. 7-Day Free Trial Auto-Activation & Entitlement Evaluation
 * 3. Guest Profile (SYSTEM_OWNER) Detection, Safe Claim & Plan Quota Enforcement
 * 4. Landing Pages Token Synchronization & Protocol URL Security
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { handleCommercialApiRoutes, webHandoffSessions, _resetWebHandoffSessions } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import {
  activateUserTrial,
  getUserTrialStatus,
  evaluateUserEntitlements,
} from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import {
  claimLegacyProfiles,
  getUnassignedLegacyProfiles,
  createProfile,
} from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { FREE_PROFILE_LIMIT } from '../../10_CONFIG/freemium-limits.js';

describe('STEP 3 MISSION — Onboarding, 7-Day Trial, Secure Handoff & Guest Claim', () => {
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    _resetWebHandoffSessions();
    const db = getDatabase();

    // Clean test records
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();

    // User A (Free signup)
    const userAEmail = `step3_usera_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resA = await registerCentralUser({
      email: userAEmail,
      password: 'UserAStrongPass123!',
      name: 'Step3 User A',
    });
    userAId = resA.user!.id;
    userAToken = resA.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userAId);

    // User B (Separate account)
    const userBEmail = `step3_userb_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resB = await registerCentralUser({
      email: userBEmail,
      password: 'UserBStrongPass123!',
      name: 'Step3 User B',
    });
    userBId = resB.user!.id;
    userBToken = resB.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userBId);
  });

  // Mock Request/Response Helper for commercial router
  function createMockReqRes(method: string, url: string, headers: Record<string, string>, body?: any) {
    let statusCode = 200;
    let responseBody = '';
    const normalizedHeaders: Record<string, string> = {
      host: 'api.mahibrowser.com',
      'content-type': 'application/json',
    };
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }
    const req: any = {
      method,
      url,
      headers: normalizedHeaders,
      on: (event: string, cb: any) => {
        if (event === 'data' && body) {
          cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
        }
        if (event === 'end') {
          cb();
        }
      },
    };

    const res: any = {
      writeHead: (code: number) => {
        statusCode = code;
      },
      setHeader: () => {},
      end: (data: string) => {
        responseBody = data;
      },
    };

    return {
      req,
      res,
      getResponse: () => ({
        status: statusCode,
        body: responseBody ? JSON.parse(responseBody) : {},
      }),
    };
  }

  async function invokeRoute(method: string, pathUrl: string, headers: Record<string, string> = {}, body?: any) {
    const urlObj = new URL(`https://api.mahibrowser.com${pathUrl}`);
    const { req, res, getResponse } = createMockReqRes(method, pathUrl, headers, body);
    const handled = await handleCommercialApiRoutes(req, res, urlObj.pathname, method, urlObj);
    return { handled, ...getResponse() };
  }

  // =========================================================================
  // SUB-SUITE 1: ZERO-TOKEN SINGLE-USE WEB-TO-DESKTOP HANDOFF PROTOCOL
  // =========================================================================
  describe('1. Zero-Token Single-Use Web Handoff Protocol', () => {
    it('rejects POST /api/v1/auth/web-handoff without authorization (401)', async () => {
      const res = await invokeRoute('POST', '/api/v1/auth/web-handoff', {});
      expect(res.handled).toBe(true);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('generates a single-use handoffCode without raw JWT in protocolUrl', async () => {
      const res = await invokeRoute('POST', '/api/v1/auth/web-handoff', {
        Authorization: `Bearer ${userAToken}`,
      });
      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.handoffCode).toMatch(/^mb_web_[0-9a-f]{48}$/);
      expect(res.body.expiresInSeconds).toBe(120);

      // Verify protocol URL does NOT embed raw JWT token
      expect(res.body.protocolUrl).toContain(`handoff=${res.body.handoffCode}`);
      expect(res.body.protocolUrl).not.toContain(userAToken);
    });

    it('exchanges handoffCode for user session token exactly once (anti-replay)', async () => {
      // 1. Generate code
      const handoffRes = await invokeRoute('POST', '/api/v1/auth/web-handoff', {
        Authorization: `Bearer ${userAToken}`,
      });
      const code = handoffRes.body.handoffCode;
      expect(code).toBeDefined();

      // 2. First exchange succeeds
      const exchRes1 = await invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, {
        handoffCode: code,
      });
      expect(exchRes1.handled).toBe(true);
      expect(exchRes1.status).toBe(200);
      expect(exchRes1.body.success).toBe(true);
      expect(exchRes1.body.token).toBe(userAToken);
      expect(exchRes1.body.user.id).toBe(userAId);

      // 3. Second exchange fails immediately with 403 (replay protection)
      const exchRes2 = await invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, {
        handoffCode: code,
      });
      expect(exchRes2.handled).toBe(true);
      expect(exchRes2.status).toBe(403);
      expect(exchRes2.body.success).toBe(false);
    });

    it('rejects expired or invalid handoff codes with 403', async () => {
      // Non-existent code
      const resInvalid = await invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, {
        handoffCode: 'mb_web_non_existent_code_1234567890',
      });
      expect(resInvalid.status).toBe(403);

      // Expired code
      const handoffRes = await invokeRoute('POST', '/api/v1/auth/web-handoff', {
        Authorization: `Bearer ${userAToken}`,
      });
      const code = handoffRes.body.handoffCode;
      const session = webHandoffSessions.get(code)!;
      session.expiresAt = Date.now() - 5000; // Expired 5 seconds ago

      const resExpired = await invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, {
        handoffCode: code,
      });
      expect(resExpired.status).toBe(403);
    });
  });

  // =========================================================================
  // SUB-SUITE 2: 7-DAY TRIAL LIFECYCLE & ENTITLEMENTS
  // =========================================================================
  describe('2. 7-Day Trial Lifecycle & Entitlements', () => {
    it('user registered on free tier has trial eligibility but inactive trial', async () => {
      const status = getUserTrialStatus(userAId);
      expect(status.isTrialActive).toBe(false);
      expect(status.isEligibleForTrial).toBe(true);

      const ent = evaluateUserEntitlements(userAId);
      expect(ent.isTrialActive).toBe(false);
      expect(ent.planId).toBe('free');
      expect(ent.maxProfiles).toBe(FREE_PROFILE_LIMIT);
    });

    it('activates 7-day trial and upgrades entitlements to trial_50 (50 profiles)', async () => {
      const actRes = await invokeRoute('POST', '/api/v1/auth/trial/activate', {
        Authorization: `Bearer ${userAToken}`,
      });
      expect(actRes.handled).toBe(true);
      expect(actRes.status).toBe(200);
      expect(actRes.body.success).toBe(true);
      expect(actRes.body.isTrialActive).toBe(true);

      const status = getUserTrialStatus(userAId);
      expect(status.isTrialActive).toBe(true);
      expect(status.daysRemaining).toBeGreaterThanOrEqual(6);
      expect(status.daysRemaining).toBeLessThanOrEqual(7);

      const ent = evaluateUserEntitlements(userAId);
      expect(ent.isTrialActive).toBe(true);
      expect(ent.planId).toBe('trial_50');
      expect(ent.maxProfiles).toBeGreaterThanOrEqual(50);
    });

    it('enforces single-use trial and rejects duplicate activation with TRIAL_ALREADY_USED', async () => {
      // First activation succeeds
      const act1 = activateUserTrial(userBId, 'professional_50');
      expect(act1.success).toBe(true);

      // Second activation rejected
      const act2 = activateUserTrial(userBId, 'professional_50');
      expect(act2.success).toBe(false);
      expect(act2.error).toBe('TRIAL_ALREADY_USED');

      // Via API endpoint
      const apiRes = await invokeRoute('POST', '/api/v1/auth/trial/activate', {
        Authorization: `Bearer ${userBToken}`,
      });
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.error).toBe('TRIAL_ALREADY_USED');
    });

    it('expired trial falls back to free tier cleanly', async () => {
      // Activate trial then backdate expiration
      activateUserTrial(userAId, 'professional_50');
      const db = getDatabase();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE commercial_users SET trial_expires_at = ? WHERE id = ?').run(pastDate, userAId);
      db.prepare('UPDATE commercial_subscriptions SET expires_at = ? WHERE user_id = ?').run(pastDate, userAId);

      const status = getUserTrialStatus(userAId);
      expect(status.isTrialActive).toBe(false);
      expect(status.isEligibleForTrial).toBe(false); // Used, no longer eligible

      const ent = evaluateUserEntitlements(userAId);
      expect(ent.isTrialActive).toBe(false);
      expect(ent.planId).toBe('free');
      expect(ent.maxProfiles).toBe(FREE_PROFILE_LIMIT);
    });

    it('GET /api/v1/auth/me returns profileQuota matching entitlements.maxProfiles', async () => {
      activateUserTrial(userAId, 'professional_50');
      const meRes = await invokeRoute('GET', '/api/v1/auth/me', {
        Authorization: `Bearer ${userAToken}`,
      });
      expect(meRes.handled).toBe(true);
      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.trialStatus.isTrialActive).toBe(true);
      expect(meRes.body.entitlements.maxProfiles).toBeGreaterThanOrEqual(50);
      expect(meRes.body.user.profileQuota).toBe(meRes.body.entitlements.maxProfiles);
    });
  });

  // =========================================================================
  // SUB-SUITE 3: GUEST PROFILE (SYSTEM_OWNER) DETECTION & CLAIM
  // =========================================================================
  describe('3. Guest Profile Detection, Confirmation & Quota Enforcement', () => {
    it('detects unassigned SYSTEM_OWNER / LOCAL_CLIENT profiles', () => {
      const db = getDatabase();
      const testGuestId1 = `guest_prof_${Date.now()}_1`;
      const testGuestId2 = `guest_prof_${Date.now()}_2`;

      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES (?, 'Guest Work 1', 'SYSTEM_OWNER', 'READY', '/tmp/storage1', datetime('now'), datetime('now')),
               (?, 'Guest Work 2', 'LOCAL_CLIENT', 'READY', '/tmp/storage2', datetime('now'), datetime('now'))
      `).run(testGuestId1, testGuestId2);

      const unassigned = getUnassignedLegacyProfiles();
      const foundIds = unassigned.map(p => p.id);
      expect(foundIds).toContain(testGuestId1);
      expect(foundIds).toContain(testGuestId2);
    });

    it('rejects claiming without user explicit confirmation', () => {
      const db = getDatabase();
      const guestId = `guest_prof_${Date.now()}_noconfirm`;
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES (?, 'Unconfirmed Profile', 'SYSTEM_OWNER', 'READY', '/tmp/storage-noconfirm', datetime('now'), datetime('now'))
      `).run(guestId);

      const claimResult = claimLegacyProfiles(userAId, [guestId], { userConfirmed: false });
      expect(claimResult.success).toBe(false);
      expect(claimResult.claimedCount).toBe(0);
      expect(claimResult.error).toContain('confirmation required');

      // Owner should still be SYSTEM_OWNER
      const row = db.prepare('SELECT owner_id FROM profiles WHERE id = ?').get(guestId) as any;
      expect(row.owner_id).toBe('SYSTEM_OWNER');
    });

    it('successfully transfers ownership when userConfirmed is true', () => {
      const db = getDatabase();
      const guestId = `guest_prof_${Date.now()}_confirmed`;
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES (?, 'Confirmed Profile', 'SYSTEM_OWNER', 'READY', '/tmp/storage-confirmed', datetime('now'), datetime('now'))
      `).run(guestId);

      const claimResult = claimLegacyProfiles(userAId, [guestId], { userConfirmed: true });
      expect(claimResult.success).toBe(true);
      expect(claimResult.claimedCount).toBe(1);
      expect(claimResult.claimedIds).toContain(guestId);

      // Verify DB owner changed
      const row = db.prepare('SELECT owner_id FROM profiles WHERE id = ?').get(guestId) as any;
      expect(row.owner_id).toBe(userAId);
    });

    it('enforces plan limits when claiming profiles beyond account capacity', () => {
      const db = getDatabase();
      // User A on free tier has limit 15. Create 15 owned profiles to saturate quota.
      for (let i = 0; i < 15; i++) {
        const pId = `prof_saturate_${Date.now()}_${i}`;
        db.prepare(`
          INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
          VALUES (?, ?, ?, 'READY', '/tmp/storage-saturate', datetime('now'), datetime('now'))
        `).run(pId, `Saturated Prof ${i}`, userAId);
      }

      // Create an unassigned guest profile
      const excessGuestId = `guest_prof_${Date.now()}_excess`;
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES (?, 'Excess Profile', 'SYSTEM_OWNER', 'READY', '/tmp/storage-excess', datetime('now'), datetime('now'))
      `).run(excessGuestId);

      // Attempt to claim when quota is 0 available slots
      const claimResult = claimLegacyProfiles(userAId, [excessGuestId], { userConfirmed: true });
      expect(claimResult.claimedCount).toBe(0);
      expect(claimResult.skippedIds).toContain(excessGuestId);
      expect(claimResult.quotaExceeded).toBe(true);

      // Verify profile remained SYSTEM_OWNER
      const row = db.prepare('SELECT owner_id FROM profiles WHERE id = ?').get(excessGuestId) as any;
      expect(row.owner_id).toBe('SYSTEM_OWNER');
    });
  });

  // =========================================================================
  // SUB-SUITE 4: LANDING HTML & TOKEN KEY CONSISTENCY
  // =========================================================================
  describe('4. Landing HTML & Token Key Consistency', () => {
    const signupHtml = fs.readFileSync(path.join(process.cwd(), 'landing', 'signup.html'), 'utf8');
    const loginHtml = fs.readFileSync(path.join(process.cwd(), 'landing', 'login.html'), 'utf8');
    const downloadHtml = fs.readFileSync(path.join(process.cwd(), 'landing', 'download.html'), 'utf8');

    it('signup.html persists both mahi_auth_token and mahi_access_token', () => {
      expect(signupHtml).toContain("localStorage.setItem('mahi_auth_token'");
      expect(signupHtml).toContain("localStorage.setItem('mahi_access_token'");
    });

    it('login.html persists both mahi_auth_token and mahi_access_token', () => {
      expect(loginHtml).toContain("localStorage.setItem('mahi_auth_token'");
      expect(loginHtml).toContain("localStorage.setItem('mahi_access_token'");
    });

    it('download.html reads both tokens and removes both on logout', () => {
      expect(downloadHtml).toContain("localStorage.getItem('mahi_auth_token') || localStorage.getItem('mahi_access_token')");
      expect(downloadHtml).toContain("localStorage.removeItem('mahi_auth_token')");
      expect(downloadHtml).toContain("localStorage.removeItem('mahi_access_token')");
    });

    it('download.html deep-link button uses /api/v1/auth/web-handoff instead of embedding raw JWT in static href', () => {
      // Must NOT set static href containing raw JWT
      expect(downloadHtml).not.toContain("deepLinkBtn.href = `mahi://auth?token=");
      expect(downloadHtml).not.toContain('deepLinkBtn.href = "mahi://auth?token=');
      // Must request web handoff endpoint
      expect(downloadHtml).toContain('/api/v1/auth/web-handoff');
      expect(downloadHtml).toContain('mahi://auth?handoff=');
    });
  });
});
