import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { CURRENT_TERMS_VERSION } from '../../10_CONFIG/shared/types/commercial.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  authenticateWithGoogleClaims,
  GoogleClaims,
} from '../../07_BACKEND/commercial/google-oauth-service.js';

describe('Terms & Privacy Policy Consent Enforcement Suite (Block F)', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-terms-consent');
  const testDbPath = path.join(testDbDir, 'terms_consent_test.sqlite');
  let server: http.Server;
  let serverPort = 0;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-terms-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-terms-client-secret-12345';
    process.env.GOOGLE_REDIRECT_URI = 'https://mahibrowser.com/api/v1/auth/google/callback';

    await initSqlEngine();
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  async function postRegister(payload: any) {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // ---------------------------------------------------------------------------
  // 1. Valid registration with terms acceptance
  // ---------------------------------------------------------------------------
  it('1. Registration with acceptedTerms: true succeeds and records accepted_terms=1 and terms_version in DB', async () => {
    const email = `consent_valid_${Date.now()}@test.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Consent User',
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);

    const db = getDatabase();
    const commUser = db.prepare('SELECT id, accepted_terms, terms_version FROM commercial_users WHERE email = ?').get(email) as any;
    expect(commUser).toBeDefined();
    expect(commUser.accepted_terms).toBe(1);
    expect(commUser.terms_version).toBe('2026-11-19');

    const authUser = db.prepare('SELECT id, accepted_terms, terms_version FROM auth_users WHERE email = ?').get(email) as any;
    expect(authUser).toBeDefined();
    expect(authUser.accepted_terms).toBe(1);
    expect(authUser.terms_version).toBe('2026-11-19');
  });

  // ---------------------------------------------------------------------------
  // 2. Registration without acceptedTerms is rejected
  // ---------------------------------------------------------------------------
  it('2. Registration without acceptedTerms returns HTTP 400 with TERMS_NOT_ACCEPTED', async () => {
    const email = `consent_missing_${Date.now()}@test.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'No Consent User',
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.error.code).toBe('TERMS_NOT_ACCEPTED');
    expect(res.data.error.message).toContain('Terms of Service');

    const db = getDatabase();
    const commUser = db.prepare('SELECT id FROM commercial_users WHERE email = ?').get(email);
    expect(commUser).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 3. Registration with non-boolean truthy acceptedTerms is rejected
  // ---------------------------------------------------------------------------
  it('3. Registration with acceptedTerms: "yes" or non-boolean is rejected with HTTP 400', async () => {
    const email = `consent_invalid_type_${Date.now()}@test.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Invalid Type User',
      acceptedTerms: 'yes',
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.error.code).toBe('TERMS_NOT_ACCEPTED');
  });

  // ---------------------------------------------------------------------------
  // 4. Terms version defaults to CURRENT_TERMS_VERSION
  // ---------------------------------------------------------------------------
  it('4. Terms version defaults to CURRENT_TERMS_VERSION when not explicitly supplied', async () => {
    const email = `consent_default_ver_${Date.now()}@test.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Default Version User',
      acceptedTerms: true,
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);

    const db = getDatabase();
    const commUser = db.prepare('SELECT accepted_terms, terms_version FROM commercial_users WHERE email = ?').get(email) as any;
    expect(commUser).toBeDefined();
    expect(commUser.accepted_terms).toBe(1);
    expect(commUser.terms_version).toBe(CURRENT_TERMS_VERSION);
    expect(CURRENT_TERMS_VERSION).toBe('2026-11-19');
  });

  // ---------------------------------------------------------------------------
  // 5. Google OAuth state creation stores accepted_terms and terms_version
  // ---------------------------------------------------------------------------
  it('5. Google OAuth state generation stores accepted_terms and terms_version into oauth_states', () => {
    const auth = generateOAuthAuthorization({
      intent: 'trial',
      planId: 'pro',
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    });

    expect(auth.state).toBeDefined();

    const db = getDatabase();
    const stateRow = db.prepare('SELECT state, accepted_terms, terms_version FROM oauth_states WHERE state = ?').get(auth.state) as any;
    expect(stateRow).toBeDefined();
    expect(stateRow.accepted_terms).toBe(1);
    expect(stateRow.terms_version).toBe('2026-11-19');

    const consumed = validateAndConsumeOAuthState(auth.state);
    expect(consumed).not.toBeNull();
    expect(consumed?.acceptedTerms).toBe(true);
    expect(consumed?.termsVersion).toBe('2026-11-19');
  });

  // ---------------------------------------------------------------------------
  // 6. Google OAuth user creation persists accepted_terms when state has them
  // ---------------------------------------------------------------------------
  it('6. Google OAuth user creation persists accepted_terms=1 and terms_version when state has them', () => {
    const email = `google_consent_${Date.now()}@gmail.com`;
    const sub = `sub_google_${Date.now()}`;
    const claims: GoogleClaims = {
      sub,
      email,
      email_verified: true,
      name: 'Google Consenting User',
    };

    const stateRecord = {
      state: 'mock_state_1',
      nonce: 'mock_nonce_1',
      provider: 'google',
      intent: 'trial',
      planId: 'professional_50',
      billingCycle: 'annual',
      returnUrl: '/download',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    };

    const result = authenticateWithGoogleClaims(claims, stateRecord);
    expect(result.success).toBe(true);
    expect(result.isNewAccount).toBe(true);

    const db = getDatabase();
    const commUser = db.prepare('SELECT accepted_terms, terms_version FROM commercial_users WHERE email = ?').get(email) as any;
    expect(commUser).toBeDefined();
    expect(commUser.accepted_terms).toBe(1);
    expect(commUser.terms_version).toBe('2026-11-19');

    const authUser = db.prepare('SELECT accepted_terms, terms_version FROM auth_users WHERE email = ?').get(email) as any;
    expect(authUser).toBeDefined();
    expect(authUser.accepted_terms).toBe(1);
    expect(authUser.terms_version).toBe('2026-11-19');
  });

  // ---------------------------------------------------------------------------
  // 7. Google OAuth user creation leaves accepted_terms as NULL when state does not have them
  // ---------------------------------------------------------------------------
  it('7. Google OAuth user creation leaves accepted_terms as NULL when state does not have them (no false fabrication)', () => {
    const email = `google_noconsent_${Date.now()}@gmail.com`;
    const sub = `sub_google_${Date.now()}`;
    const claims: GoogleClaims = {
      sub,
      email,
      email_verified: true,
      name: 'Google Unrecorded User',
    };

    const stateRecord = {
      state: 'mock_state_2',
      nonce: 'mock_nonce_2',
      provider: 'google',
      intent: 'trial',
      planId: 'professional_50',
      billingCycle: 'annual',
      returnUrl: '/download',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
      // acceptedTerms intentionally omitted / undefined
    };

    const result = authenticateWithGoogleClaims(claims, stateRecord);
    expect(result.success).toBe(true);
    expect(result.isNewAccount).toBe(true);

    const db = getDatabase();
    const commUser = db.prepare('SELECT accepted_terms, terms_version FROM commercial_users WHERE email = ?').get(email) as any;
    expect(commUser).toBeDefined();
    expect(commUser.accepted_terms).toBeNull();
    expect(commUser.terms_version).toBeNull();

    const authUser = db.prepare('SELECT accepted_terms, terms_version FROM auth_users WHERE email = ?').get(email) as any;
    expect(authUser).toBeDefined();
    expect(authUser.accepted_terms).toBeNull();
    expect(authUser.terms_version).toBeNull();
  });
});
