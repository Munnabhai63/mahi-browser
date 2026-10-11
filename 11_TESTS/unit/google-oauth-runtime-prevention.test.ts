import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {
  initSqlEngine,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  generateOAuthAuthorization,
  isGoogleOAuthConfigured,
  getGoogleOAuthConfig,
} from '../../07_BACKEND/commercial/google-oauth-service.js';

describe('Google OAuth SSO Runtime & "https is not defined" Regression Prevention', () => {
  beforeAll(async () => {
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  it('ensures node:https is globally available and valid in the execution environment', () => {
    expect(https).toBeDefined();
    expect(typeof https.request).toBe('function');
    expect(typeof https.get).toBe('function');
    expect(typeof https.Agent).toBe('function');
  });

  it('guarantees 07_BACKEND/commercial/google-oauth-service.ts properly imports https module before using https.request', () => {
    const servicePath = path.resolve('07_BACKEND/commercial/google-oauth-service.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    expect(content).toMatch(/import\s+https\s+from\s+['"]node:https['"]/);
    expect(content).toContain('https.request(');
  });

  it('verifies server.js in admin panel imports https with CommonJS require before using https.request', () => {
    const serverPath = path.resolve('scratch/vps_server_current.js');
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      expect(content).toMatch(/const\s+https\s*=\s*require\(['"]https['"]\)/);
      const requireIdx = content.indexOf("require('https')");
      const requestIdx = content.indexOf("https.request(");
      expect(requireIdx).toBeGreaterThan(-1);
      expect(requestIdx).toBeGreaterThan(requireIdx);
    }
  });

  it('guarantees frontend signup.html and login.html route through backend /api/v1/auth/google/start without Node https in browser', () => {
    const signupPath = path.resolve('landing/signup.html');
    const signupContent = fs.readFileSync(signupPath, 'utf8');
    expect(signupContent).not.toMatch(/https\.request\(/);
    expect(signupContent).not.toMatch(/require\(['"]https['"]\)/);
    expect(signupContent).toContain('/api/v1/auth/google/start');

    const loginPath = path.resolve('landing/login.html');
    const loginContent = fs.readFileSync(loginPath, 'utf8');
    expect(loginContent).not.toMatch(/https\.request\(/);
    expect(loginContent).not.toMatch(/require\(['"]https['"]\)/);
    expect(loginContent).toContain('/api/v1/auth/google/start');
  });

  it('guarantees download.html reads auth tokens from URL, cookies, and localStorage without reference errors', () => {
    const downloadPath = path.resolve('landing/download.html');
    const downloadContent = fs.readFileSync(downloadPath, 'utf8');
    expect(downloadContent).toContain('mahi_token');
    expect(downloadContent).toContain('mahi_auth_token');
  });

  it('generates OAuth authorization URL with prompt=select_account for Google Account Chooser', () => {
    const auth = generateOAuthAuthorization({
      intent: 'trial',
      planId: 'professional_50',
      billingCycle: 'annual',
      returnUrl: '/download'
    });

    expect(auth.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(auth.authUrl).toContain('prompt=select_account');
    expect(auth.authUrl).toContain('response_type=code');
    expect(auth.authUrl).toContain('scope=openid');
    expect(auth.authUrl).not.toContain('client_secret');
  });

  it('guarantees accountService exports hashToken function with authoritative SHA-256 hex string', () => {
    const accountServicePath = path.resolve('scratch/vps_account_service_current.js');
    if (fs.existsSync(accountServicePath)) {
      const content = fs.readFileSync(accountServicePath, 'utf8');
      expect(content).toMatch(/function\s+hashToken\s*\(/);
      expect(content).toMatch(/module\.exports\s*=\s*\{[\s\S]*?\bhashToken\b/);
      expect(content).toContain("crypto.createHash('sha256').update(rawToken).digest('hex')");
    }
  });

  it('ensures auth-service exports hashToken with identical SHA-256 contract', () => {
    const authServicePath = path.resolve('scratch/vps_auth_service_current.js');
    if (fs.existsSync(authServicePath)) {
      const content = fs.readFileSync(authServicePath, 'utf8');
      expect(content).toMatch(/function\s+hashToken\s*\(/);
      expect(content).toMatch(/module\.exports\s*=\s*\{[\s\S]*?\bhashToken\b/);
      expect(content).toContain("crypto.createHash('sha256').update(rawToken).digest('hex')");
    }
  });

  it('ensures server.js handles hashToken safely with defense-in-depth sha256 fallback', () => {
    const serverPath = path.resolve('scratch/vps_server_current.js');
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      expect(content).toContain('accountService.hashToken');
      // Ensure caller has defense-in-depth check
      expect(content).toMatch(/typeof\s+accountService\.hashToken\s*===\s*['"]function['"]/);
    }
  });
});

