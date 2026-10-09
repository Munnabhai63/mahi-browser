import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  authenticateWithGoogleClaims,
  normalizePlanId,
  isGoogleOAuthConfigured,
  getGoogleOAuthConfig,
  GoogleClaims,
} from '../../07_BACKEND/commercial/google-oauth-service.js';
import { getUserById } from '../../07_BACKEND/commercial/commercial-auth-service.js';

describe('Phase 19: Google OAuth SSO, Central Auth & Intent Continuity Suite', () => {
  const tempDir = path.resolve('.mahi_data', 'test-google-oauth');
  const dbPath = path.join(tempDir, 'google_oauth_test.sqlite');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    setCustomDatabasePath(dbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // =========================================================================
  // 1. OAUTH START & INTENT PRESERVATION
  // =========================================================================
  describe('OAuth Start & State Management', () => {
    it('generates secure state, nonce, and preserves Professional 50 trial intent in SQLite', () => {
      const auth = generateOAuthAuthorization({
        intent: 'trial',
        planId: 'professional_50',
        billingCycle: 'annual',
        returnUrl: '/download',
      });

      expect(auth.state).toBeDefined();
      expect(auth.state.length).toBe(64); // 32 bytes hex
      expect(auth.nonce).toBeDefined();
      expect(auth.nonce.length).toBe(32); // 16 bytes hex
      expect(auth.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(auth.authUrl).toContain('scope=openid%20email%20profile');
      expect(auth.authUrl).toContain(`state=${auth.state}`);
      expect(auth.authUrl).toContain(`nonce=${auth.nonce}`);

      // Verify stored state record in oauth_states table
      const db = getDatabase();
      const stateRow = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(auth.state) as any;
      expect(stateRow).toBeDefined();
      expect(stateRow.intent).toBe('trial');
      expect(stateRow.plan_id).toBe('professional_50');
      expect(stateRow.billing_cycle).toBe('annual');
      expect(stateRow.return_url).toBe('/download');
    });

    it('atomically validates and consumes state (anti-CSRF and anti-replay)', () => {
      const auth = generateOAuthAuthorization({
        intent: 'trial',
        planId: 'professional_100',
        billingCycle: 'monthly',
        returnUrl: '/onboarding',
      });

      // First consumption succeeds
      const consumed = validateAndConsumeOAuthState(auth.state);
      expect(consumed).not.toBeNull();
      expect(consumed?.planId).toBe('professional_100');
      expect(consumed?.intent).toBe('trial');

      // Second consumption fails (already deleted)
      const replayed = validateAndConsumeOAuthState(auth.state);
      expect(replayed).toBeNull();
    });

    it('rejects invalid or non-existent OAuth states', () => {
      const result = validateAndConsumeOAuthState('completely_fake_state_token');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 2. NEW GOOGLE USER REGISTRATION & TRIAL ACTIVATION
  // =========================================================================
  describe('New Google User Registration', () => {
    it('creates new unified account with verified email, name, avatar, and activates Professional 50 7-day trial', () => {
      const googleSub = 'google_sub_1092837465';
      const email = 'alex.founder@gmail.com';
      const claims: GoogleClaims = {
        sub: googleSub,
        email,
        email_verified: true,
        name: 'Alex Founder',
        picture: 'https://lh3.googleusercontent.com/a/alex_avatar.png',
      };

      const stateRecord = {
        state: 'valid_state_1',
        nonce: 'nonce_1',
        provider: 'google',
        intent: 'trial',
        planId: 'professional_50',
        billingCycle: 'annual',
        returnUrl: '/download',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const res = authenticateWithGoogleClaims(claims, stateRecord, '192.168.1.50');

      expect(res.success).toBe(true);
      expect(res.isNewAccount).toBe(true);
      expect(res.isLinked).toBe(false);
      expect(res.token).toBeDefined();
      expect(res.user.email).toBe(email);
      expect(res.user.name).toBe('Alex Founder');
      expect(res.user.googleSub).toBe(googleSub);
      expect(res.user.avatarUrl).toBe('https://lh3.googleusercontent.com/a/alex_avatar.png');
      expect(res.user.planId).toBe('professional_50');
      expect(res.trialActive).toBe(true);
      expect(res.user.is_trial).toBe(true);

      // Verify DB persistence
      const db = getDatabase();
      const dbUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(res.user.id) as any;
      expect(dbUser).toBeDefined();
      expect(dbUser.auth_provider).toBe('GOOGLE');
      expect(dbUser.google_sub).toBe(googleSub);
      expect(dbUser.avatar_url).toBe('https://lh3.googleusercontent.com/a/alex_avatar.png');
      expect(dbUser.trial_used).toBe(1);

      // Verify trial subscription record
      const sub = db.prepare('SELECT * FROM commercial_subscriptions WHERE user_id = ?').get(res.user.id) as any;
      expect(sub).toBeDefined();
      expect(sub.status).toBe('ACTIVE');
      expect(sub.billing_cycle).toBe('TRIAL');
    });

    it('rejects Google claims where email_verified is false', () => {
      const claims: GoogleClaims = {
        sub: 'google_sub_unverified',
        email: 'unverified@gmail.com',
        email_verified: false,
        name: 'Unverified User',
      };

      const res = authenticateWithGoogleClaims(claims, null);
      expect(res.success).toBe(false);
      expect(res.error).toContain('GOOGLE_EMAIL_NOT_VERIFIED');
    });
  });

  // =========================================================================
  // 3. ACCOUNT LINKING (EXISTING EMAIL USER LOGS IN VIA GOOGLE)
  // =========================================================================
  describe('Account Linking & Duplicate Prevention', () => {
    it('safely links Google identity to existing email account without creating duplicate user', () => {
      const db = getDatabase();
      const existingEmail = 'sara.designer@mahibrowser.com';
      const existingUserId = 'usr_sara_pre_existing';

      // Pre-create user via email/password
      db.prepare(`
        INSERT INTO commercial_users (
          id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at
        ) VALUES (?, ?, 'hash', 'salt', 'Sara Designer', 'USER', 'ACTIVE', 'plan_free', datetime('now'), datetime('now'))
      `).run(existingUserId, existingEmail);

      const claims: GoogleClaims = {
        sub: 'google_sub_sara_998877',
        email: existingEmail,
        email_verified: true,
        name: 'Sara D.',
        picture: 'https://lh3.googleusercontent.com/a/sara_google_pic.jpg',
      };

      const res = authenticateWithGoogleClaims(claims, null);

      expect(res.success).toBe(true);
      expect(res.isNewAccount).toBe(false);
      expect(res.isLinked).toBe(true);
      expect(res.user.id).toBe(existingUserId);
      expect(res.user.email).toBe(existingEmail);

      // Ensure no duplicate accounts were created
      const count = db.prepare('SELECT COUNT(*) as cnt FROM commercial_users WHERE email = ?').get(existingEmail) as any;
      expect(count.cnt).toBe(1);

      // Verify Google identity was linked
      const updatedUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(existingUserId) as any;
      expect(updatedUser.google_sub).toBe('google_sub_sara_998877');
      expect(updatedUser.avatar_url).toBe('https://lh3.googleusercontent.com/a/sara_google_pic.jpg');
    });

    it('logs existing Google user directly into their account on repeat visits', () => {
      const claims: GoogleClaims = {
        sub: 'google_sub_sara_998877',
        email: 'sara.designer@mahibrowser.com',
        email_verified: true,
      };

      const res = authenticateWithGoogleClaims(claims, null);
      expect(res.success).toBe(true);
      expect(res.isNewAccount).toBe(false);
      expect(res.isLinked).toBe(false);
      expect(res.user.id).toBe('usr_sara_pre_existing');
    });
  });

  // =========================================================================
  // 4. PLAN INTENT PRESERVATION & TRIAL ELIGIBILITY
  // =========================================================================
  describe('Plan Intent Preservation & Trial Eligibility', () => {
    it('preserves Professional 100 plan intent across Google signup', () => {
      const claims: GoogleClaims = {
        sub: 'google_sub_pro100_user',
        email: 'pro100@company.org',
        email_verified: true,
        name: 'Enterprise Lead',
      };

      const stateRecord = {
        state: 'state_pro100',
        nonce: 'nonce_pro100',
        provider: 'google',
        intent: 'trial',
        planId: 'professional_100',
        billingCycle: 'annual',
        returnUrl: '/download',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const res = authenticateWithGoogleClaims(claims, stateRecord);
      expect(res.success).toBe(true);
      expect(res.user.planId).toBe('professional_100');
      expect(res.trialActive).toBe(true);
    });

    it('handles paid plan intent without trial by preserving pending plan parameters', () => {
      const claims: GoogleClaims = {
        sub: 'google_sub_paid_user',
        email: 'paid.direct@company.org',
        email_verified: true,
      };

      const stateRecord = {
        state: 'state_paid',
        nonce: 'nonce_paid',
        provider: 'google',
        intent: 'paid',
        planId: 'professional_50',
        billingCycle: 'annual',
        returnUrl: '/checkout',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const res = authenticateWithGoogleClaims(claims, stateRecord);
      expect(res.success).toBe(true);
      expect(res.returnUrl).toBe('/checkout');

      const db = getDatabase();
      const user = db.prepare('SELECT pending_plan_id, pending_billing_cycle FROM commercial_users WHERE id = ?').get(res.user.id) as any;
      expect(user.pending_plan_id).toBe('professional_50');
      expect(user.pending_billing_cycle).toBe('annual');
    });
  });

  // =========================================================================
  // 5. SECURITY & CLIENT SECRET ABSENCE
  // =========================================================================
  describe('Credential Security & Configuration', () => {
    it('ensures google client secret is never exposed in client auth parameters', () => {
      const auth = generateOAuthAuthorization({ intent: 'trial' });
      expect(JSON.stringify(auth)).not.toContain('client_secret');
      expect(auth.authUrl).not.toContain('client_secret');
    });

    it('reports Google OAuth configuration status accurately', () => {
      const configured = isGoogleOAuthConfigured();
      expect(typeof configured).toBe('boolean');
    });
  });
});
