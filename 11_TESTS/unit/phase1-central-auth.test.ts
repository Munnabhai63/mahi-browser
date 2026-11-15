import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import {
  registerCentralUser,
  verifyEmailToken,
  resendEmailVerification,
  loginCentralUser,
  refreshCentralSession,
  revokeUserSession,
  revokeAllUserSessions,
  listUserSessions,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyAccessToken,
  hashPasswordSecure,
  verifyPasswordSecure,
} from '../../05_AUTH/central-auth-service.js';
import { DevelopmentEmailProvider } from '../../05_AUTH/email-service.js';
import { assertCanCreateProfile, getPlanLimitsInfo } from '../../08_SECURITY/freemium-guard.js';
import { clearEncryptedSession, clearCachedStatus } from '../../08_SECURITY/account-service.js';
import { setActiveUserId } from '../../07_BACKEND/commercial/session-context.js';

describe('PHASE 1: Central Account & Authentication Service', () => {
  const testDbDir = path.join(process.cwd(), '.test_phase1_auth');
  const testDbPath = path.join(testDbDir, 'phase1_auth.sqlite');

  beforeEach(async () => {
    try { fs.mkdirSync(testDbDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
    DevelopmentEmailProvider.clear();
    clearEncryptedSession();
    clearCachedStatus();
    setActiveUserId(null);
  });

  afterAll(() => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.rmdirSync(testDbDir); } catch {}
  });

  describe('1. Password Hashing Security', () => {
    it('should generate distinct salts and hashes for the same password', () => {
      const hash1 = hashPasswordSecure('SuperSecret123!');
      const hash2 = hashPasswordSecure('SuperSecret123!');

      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith('pbkdf2_sha256$')).toBe(true);
      expect(verifyPasswordSecure('SuperSecret123!', hash1)).toBe(true);
      expect(verifyPasswordSecure('SuperSecret123!', hash2)).toBe(true);
      expect(verifyPasswordSecure('WrongPassword', hash1)).toBe(false);
    });

    it('should securely verify passwords in constant-time format', () => {
      const hash = hashPasswordSecure('MahiSecured2026$');
      expect(verifyPasswordSecure('MahiSecured2026$', hash)).toBe(true);
      expect(verifyPasswordSecure('mahisecured2026$', hash)).toBe(false);
      expect(verifyPasswordSecure('', hash)).toBe(false);
    });
  });

  describe('2. User Registration & Email Normalization', () => {
    it('should register a new central user, normalize email, and issue verification token', async () => {
      const res = await registerCentralUser({
        email: '  BetaTester@MahiBrowser.COM ',
        password: 'Password123!',
      });

      expect(res.success).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.email).toBe('betatester@mahibrowser.com');
      expect(res.user?.status).toBe('PENDING_VERIFICATION');
      expect(res.user?.emailVerified).toBe(false);

      // Verify email was dispatched to in-memory provider
      const email = DevelopmentEmailProvider.getLastEmailFor('betatester@mahibrowser.com');
      expect(email).toBeDefined();
      expect(email?.subject).toContain('Verify your MAHI Browser Account');

      // Verify DB persistence & password hash safety
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(res.user!.id) as any;
      expect(row.normalized_email).toBe('betatester@mahibrowser.com');
      expect(row.password_hash).not.toContain('Password123!');
      expect(row.password_hash.length).toBe(64);
      expect(row.salt).toBeDefined();
    });

    it('should reject registration if email is invalid or password is too short', async () => {
      const invalidEmail = await registerCentralUser({
        email: 'invalid-email',
        password: 'ValidPassword123!',
      });
      expect(invalidEmail.success).toBe(false);
      expect(invalidEmail.error).toContain('valid email address');

      const shortPass = await registerCentralUser({
        email: 'valid@example.com',
        password: 'short',
      });
      expect(shortPass.success).toBe(false);
      expect(shortPass.error).toContain('at least 8 characters');
    });

    it('should reject duplicate registration with identical normalized email', async () => {
      await registerCentralUser({
        email: 'unique@mahibrowser.com',
        password: 'Password123!',
      });

      const duplicate = await registerCentralUser({
        email: 'UNIQUE@mahibrowser.com',
        password: 'AnotherPassword456!',
      });

      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toContain('already exists');
    });
  });

  describe('3. Email Verification Flow', () => {
    it('should verify email and activate user account with single-use token', async () => {
      const regRes = await registerCentralUser({
        email: 'verify-test@mahibrowser.com',
        password: 'Password123!',
      });

      const email = DevelopmentEmailProvider.getLastEmailFor('verify-test@mahibrowser.com');
      expect(email).toBeDefined();
      const token = email!.token;
      expect(token).toBeDefined();

      const verifyRes = await verifyEmailToken(token!);
      expect(verifyRes.success).toBe(true);

      const db = getDatabase();
      const user = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(regRes.user!.id) as any;
      expect(user.email_verified).toBe(1);
      expect(user.status).toBe('ACTIVE');

      // Replay attack prevention: single use token
      const replayRes = await verifyEmailToken(token!);
      expect(replayRes.success).toBe(false);
      expect(replayRes.error).toContain('already been used');
    });

    it('should support resending email verification with a fresh token', async () => {
      await registerCentralUser({
        email: 'resend-test@mahibrowser.com',
        password: 'Password123!',
      });

      const firstEmail = DevelopmentEmailProvider.getLastEmailFor('resend-test@mahibrowser.com');
      const firstToken = firstEmail!.token;

      const resendRes = await resendEmailVerification('resend-test@mahibrowser.com');
      expect(resendRes.success).toBe(true);

      const secondEmail = DevelopmentEmailProvider.getLastEmailFor('resend-test@mahibrowser.com');
      const secondToken = secondEmail!.token;

      expect(secondToken).toBeDefined();
      expect(secondToken).not.toBe(firstToken);

      // Verify with the fresh token
      const verifyRes = await verifyEmailToken(secondToken!);
      expect(verifyRes.success).toBe(true);
    });
  });

  describe('4. Login & Rate Limiting Throttling', () => {
    it('should authenticate valid user and issue access and rotating refresh tokens', async () => {
      await registerCentralUser({
        email: 'login-success@mahibrowser.com',
        password: 'StrongSecretPassword!',
      });

      const loginRes = await loginCentralUser({
        email: 'LOGIN-SUCCESS@mahibrowser.com',
        password: 'StrongSecretPassword!',
        deviceName: 'Office PC',
        platform: 'windows',
        ipAddress: '127.0.0.1',
      });

      expect(loginRes.success).toBe(true);
      expect(loginRes.tokens).toBeDefined();
      expect(loginRes.tokens?.accessToken).toBeDefined();
      expect(loginRes.tokens?.refreshToken).toBeDefined();
      expect(loginRes.user?.email).toBe('login-success@mahibrowser.com');

      // Verify JWT Access token
      const decoded = verifyAccessToken(loginRes.tokens!.accessToken);
      expect(decoded).toBeDefined();
      expect(decoded?.email).toBe('login-success@mahibrowser.com');
    });

    it('should return generic error for invalid password without leaking account details', async () => {
      await registerCentralUser({
        email: 'user-auth@mahibrowser.com',
        password: 'RealPassword123!',
      });

      const wrongPass = await loginCentralUser({
        email: 'user-auth@mahibrowser.com',
        password: 'WrongPassword!',
      });

      expect(wrongPass.success).toBe(false);
      expect(wrongPass.error).toBe('Invalid email or password.');

      const nonExistent = await loginCentralUser({
        email: 'nonexistent@mahibrowser.com',
        password: 'AnyPassword!',
      });

      expect(nonExistent.success).toBe(false);
      expect(nonExistent.error).toBe('Invalid email or password.');
    });

    it('should throttle consecutive failed login attempts (Rate Limiting)', async () => {
      const email = 'bruteforce@mahibrowser.com';
      await registerCentralUser({
        email,
        password: 'RealPassword123!',
      });

      // Attempt 5 incorrect logins
      for (let i = 0; i < 5; i++) {
        const attempt = await loginCentralUser({ email, password: `WrongAttempt${i}` });
        expect(attempt.success).toBe(false);
      }

      // 6th attempt should be blocked by rate limiter
      const throttled = await loginCentralUser({ email, password: 'RealPassword123!' });
      expect(throttled.success).toBe(false);
      expect(throttled.error).toContain('Too many failed login attempts');
    });

    it('should enforce account status (SUSPENDED / DISABLED)', async () => {
      const reg = await registerCentralUser({
        email: 'suspended@mahibrowser.com',
        password: 'ValidPassword123!',
      });

      // Suspend user in DB
      const db = getDatabase();
      db.prepare("UPDATE auth_users SET status = 'SUSPENDED' WHERE id = ?").run(reg.user!.id);

      const login = await loginCentralUser({
        email: 'suspended@mahibrowser.com',
        password: 'ValidPassword123!',
      });

      expect(login.success).toBe(false);
      expect(login.error).toContain('suspended');
    });
  });

  describe('5. Session Lifecycle & Refresh Token Rotation', () => {
    it('should rotate refresh token and revoke old token on refresh', async () => {
      await registerCentralUser({
        email: 'refresh-flow@mahibrowser.com',
        password: 'Password123!',
      });

      const login = await loginCentralUser({
        email: 'refresh-flow@mahibrowser.com',
        password: 'Password123!',
      });

      const oldRefreshToken = login.tokens!.refreshToken;

      // Refresh session
      const refreshRes = await refreshCentralSession(oldRefreshToken);
      expect(refreshRes.success).toBe(true);
      expect(refreshRes.tokens).toBeDefined();
      expect(refreshRes.tokens!.refreshToken).not.toBe(oldRefreshToken);

      // Old refresh token must be revoked (Replay attack detection)
      const replayRes = await refreshCentralSession(oldRefreshToken);
      expect(replayRes.success).toBe(false);
      expect(replayRes.error).toContain('Invalid or revoked');
    });

    it('should list active sessions and allow device-specific revocation', async () => {
      const reg = await registerCentralUser({
        email: 'multi-device@mahibrowser.com',
        password: 'Password123!',
      });

      // Login from Device 1
      const dev1 = await loginCentralUser({
        email: 'multi-device@mahibrowser.com',
        password: 'Password123!',
        deviceName: 'Laptop-Work',
        platform: 'windows',
      });

      // Login from Device 2
      const dev2 = await loginCentralUser({
        email: 'multi-device@mahibrowser.com',
        password: 'Password123!',
        deviceName: 'Desktop-Home',
        platform: 'windows',
      });

      // List sessions for device 1 (includes initial registration session + dev1 + dev2)
      const sessions = listUserSessions(reg.user!.id, dev1.session!.id);
      expect(sessions.length).toBe(3);

      const current = sessions.find((s) => s.is_current === true);
      expect(current?.device_name).toBe('Laptop-Work');

      const remote = sessions.find((s) => s.is_current === false);
      expect(remote?.device_name).toBe('Desktop-Home');

      // Revoke Device 2
      const revokeRes = revokeUserSession(remote!.id, reg.user!.id);
      expect(revokeRes.success).toBe(true);

      // Verify Device 2 refresh fails
      const dev2Refresh = await refreshCentralSession(dev2.tokens!.refreshToken);
      expect(dev2Refresh.success).toBe(false);

      // Device 1 remains valid
      const dev1Refresh = await refreshCentralSession(dev1.tokens!.refreshToken);
      expect(dev1Refresh.success).toBe(true);
    });

    it('should revoke all sessions on demand', async () => {
      const reg = await registerCentralUser({
        email: 'revoke-all@mahibrowser.com',
        password: 'Password123!',
      });

      const s1 = await loginCentralUser({ email: reg.user!.email, password: 'Password123!' });
      const s2 = await loginCentralUser({ email: reg.user!.email, password: 'Password123!' });

      revokeAllUserSessions(reg.user!.id);

      expect((await refreshCentralSession(s1.tokens!.refreshToken)).success).toBe(false);
      expect((await refreshCentralSession(s2.tokens!.refreshToken)).success).toBe(false);
    });
  });

  describe('6. Forgot & Reset Password Security', () => {
    it('should generate secure single-use reset token and reset password', async () => {
      await registerCentralUser({
        email: 'reset-flow@mahibrowser.com',
        password: 'OriginalPassword123!',
      });

      // Request reset
      const forgotRes = await requestPasswordReset('reset-flow@mahibrowser.com');
      expect(forgotRes.success).toBe(true);

      const email = DevelopmentEmailProvider.getLastEmailFor('reset-flow@mahibrowser.com');
      expect(email).toBeDefined();
      const resetToken = email!.token;
      expect(resetToken).toBeDefined();

      // Reset password
      const resetRes = await resetPasswordWithToken(resetToken!, 'BrandNewPassword456!');
      expect(resetRes.success).toBe(true);

      // Old password should now fail
      const oldLogin = await loginCentralUser({
        email: 'reset-flow@mahibrowser.com',
        password: 'OriginalPassword123!',
      });
      expect(oldLogin.success).toBe(false);

      // New password succeeds
      const newLogin = await loginCentralUser({
        email: 'reset-flow@mahibrowser.com',
        password: 'BrandNewPassword456!',
      });
      expect(newLogin.success).toBe(true);

      // Token cannot be reused
      const replayReset = await resetPasswordWithToken(resetToken!, 'AnotherPassword789!');
      expect(replayReset.success).toBe(false);
    });
  });

  describe('7. Offline Coexistence & Entitlement Safeguards', () => {
    it('should ensure local freemium guard works without central auth dependency', () => {
      // Offline Freemium Guard continues to enforce 15 free profile quota independently
      const limits = getPlanLimitsInfo();
      expect(limits.maxProfiles).toBe(15);
      expect(limits.isPro).toBe(false);

      // User with 0 profiles can create
      expect(() => assertCanCreateProfile(0)).not.toThrow();

      // User attempting to exceed 15 profiles is guarded
      expect(() => assertCanCreateProfile(16)).toThrowError(/limit reached/);
    });
  });
});
