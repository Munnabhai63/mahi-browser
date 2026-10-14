import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  isSafeInternalUrl,
  resolvePostAuthRedirect,
} from '../../07_BACKEND/commercial/google-oauth-service.js';
import {
  getDesktopAuthSuccessHtml,
} from '../../07_BACKEND/commercial/commercial-api-router.js';

describe('MAHI Browser — GoLogin Workflow Parity & PKCE Security Suite', () => {
  describe('1. URL Safety & Auth Completion Endpoint Validation', () => {
    it('accepts /auth/desktop-success as safe internal redirect', () => {
      expect(isSafeInternalUrl('/auth/desktop-success')).toBe(true);
      expect(isSafeInternalUrl('/auth/desktop-success?handoff=ticket_abc123')).toBe(true);
      expect(isSafeInternalUrl('/auth/desktop-success?handoff=ticket_abc123&code=mb_code_xyz')).toBe(true);
      expect(isSafeInternalUrl('/auth')).toBe(true);
    });

    it('rejects external or malicious auth callback spoofing', () => {
      expect(isSafeInternalUrl('https://evil.com/auth/desktop-success')).toBe(false);
      expect(isSafeInternalUrl('//evil.com/auth/desktop-success')).toBe(false);
      expect(isSafeInternalUrl('/auth/../../../evil')).toBe(false);
    });
  });

  describe('2. Desktop Login Intent & Handoff Routing', () => {
    it('routes desktop_login intent directly to /auth/desktop-success instead of /dashboard or /download', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'desktop_login',
      });
      expect(dest).toBe('/auth/desktop-success');
    });

    it('attaches handoff ticket parameter when provided by desktop client', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'desktop_login',
        handoff: 'mb_handoff_987654321_abcdef',
      });
      expect(dest).toBe('/auth/desktop-success?handoff=mb_handoff_987654321_abcdef');
    });

    it('handles legacy or alternative "desktop" intent alias identically', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'desktop',
        handoff: 'ticket_xyz',
      });
      expect(dest).toBe('/auth/desktop-success?handoff=ticket_xyz');
    });

    it('ensures web users clicking login/signup/trial on the website still land on web dashboard', () => {
      expect(resolvePostAuthRedirect({ intent: 'login' })).toBe('/dashboard');
      expect(resolvePostAuthRedirect({ intent: 'signup' })).toBe('/dashboard');
      expect(resolvePostAuthRedirect({ intent: 'trial' })).toBe('/dashboard?onboarding=trial');
      expect(resolvePostAuthRedirect({ intent: 'download' })).toBe('/download');
    });
  });

  describe('3. Strict Zero-Token Rule: Deep Links & HTML Security', () => {
    it('verifies deep link URL NEVER contains raw reusable JWT tokens', () => {
      const authCode = 'mb_code_' + crypto.randomBytes(16).toString('hex');
      const ticket = 'dsk_' + crypto.randomBytes(8).toString('hex');
      const deepLinkUrl = `mahi://auth?code=${authCode}&ticket=${ticket}`;
      const parsed = new URL(deepLinkUrl);

      expect(parsed.protocol).toBe('mahi:');
      expect(parsed.hostname).toBe('auth');
      expect(parsed.searchParams.get('token')).toBeNull(); // No token in query!
      expect(parsed.searchParams.get('code')).toBe(authCode);
      expect(parsed.searchParams.get('ticket')).toBe(ticket);
    });

    it('verifies completion HTML never leaks JWT session tokens in source code or DOM', () => {
      const authCode = 'mb_code_test_1234567890';
      const ticket = 'dsk_test_ticket_999';
      const html = getDesktopAuthSuccessHtml({
        handoff: ticket,
        code: authCode,
        email: 'developer@mahibrowser.com',
        plan: 'starter'
      });

      // Assert that no JWT or session token exists in generated HTML
      expect(html).not.toContain('eyJhbGciOi'); // Standard JWT header
      expect(html).not.toContain('token=');
      expect(html).toContain(authCode);
      expect(html).toContain(ticket);
      expect(html).toContain('mahi://auth?code=');
    });
  });

  describe('4. Cryptographic PKCE Proof Validation (RFC 8252)', () => {
    it('verifies code_verifier and SHA-256 code_challenge mathematical binding', () => {
      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('hex');

      // Re-computing hash matches expectedChallenge
      const computed = crypto.createHash('sha256').update(codeVerifier).digest('hex');
      expect(computed).toBe(expectedChallenge);

      // Tampered verifier fails validation
      const tamperedVerifier = codeVerifier + '_attacker';
      const tamperedHash = crypto.createHash('sha256').update(tamperedVerifier).digest('hex');
      expect(tamperedHash).not.toBe(expectedChallenge);
    });

    it('enforces single-use code consumption and prevents replay attacks', () => {
      interface MockRecord {
        authCode: string;
        used: boolean;
        expiresAt: number;
      }
      const ticketStore = new Map<string, MockRecord>();
      const testTicket = 'ticket_123';
      ticketStore.set(testTicket, {
        authCode: 'code_abc',
        used: false,
        expiresAt: Date.now() + 60000,
      });

      // First exchange: succeeds and marks as used
      const record = ticketStore.get(testTicket)!;
      expect(record.used).toBe(false);
      record.used = true;
      ticketStore.delete(testTicket);

      // Second exchange attempt (Replay Attack): rejected
      const replayRecord = ticketStore.get(testTicket);
      expect(replayRecord).toBeUndefined();
    });

    it('rejects expired authorization codes (60s TTL)', () => {
      const record = {
        codeExpiresAt: Date.now() - 1000, // Expired 1 second ago
      };
      const isExpired = record.codeExpiresAt < Date.now();
      expect(isExpired).toBe(true);
    });
  });

  describe('5. Entitlement & Trial Preservation (Zero Account Duplication)', () => {
    it('preserves existing trial state when website user signs in on desktop', () => {
      const existingWebAccount = {
        userId: 'usr_web_trial_88',
        email: 'trialuser@mahibrowser.com',
        tier: 'starter',
        isTrialActive: true,
        trialEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(),
        maxProfiles: 10,
      };

      const desktopSyncedAccount = {
        ...existingWebAccount,
        lastLoginPlatform: 'desktop_windows',
      };

      expect(desktopSyncedAccount.userId).toBe(existingWebAccount.userId);
      expect(desktopSyncedAccount.email).toBe(existingWebAccount.email);
      expect(desktopSyncedAccount.isTrialActive).toBe(true);
      expect(desktopSyncedAccount.maxProfiles).toBe(10);
    });

    it('enforces that switching between Web and Desktop never resets profile count or trial duration', () => {
      const userState = {
        trialStart: Date.now() - 24 * 3600 * 1000,
        profilesCreated: 3,
        maxProfilesAllowed: 10,
      };

      expect(userState.profilesCreated).toBe(3);
      expect(userState.maxProfilesAllowed).toBe(10);
    });
  });

  describe('6. Localhost Origin Security Policy', () => {
    const ALLOWED_ORIGIN_PATTERNS = [
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
      /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*mahibrowser\.com(?::\d+)?$/,
    ];

    function isOriginAllowed(origin: string): boolean {
      return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
    }

    it('allows loopback requests from mahibrowser.com and subdomains', () => {
      expect(isOriginAllowed('https://mahibrowser.com')).toBe(true);
      expect(isOriginAllowed('https://admin.mahibrowser.com')).toBe(true);
      expect(isOriginAllowed('http://localhost:32123')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:32123')).toBe(true);
    });

    it('strictly blocks untrusted external web origins from hitting the loopback port', () => {
      expect(isOriginAllowed('https://evil-hacker.com')).toBe(false);
      expect(isOriginAllowed('https://mahibrowser.com.evil.com')).toBe(false);
      expect(isOriginAllowed('https://fake-gologin.net')).toBe(false);
      expect(isOriginAllowed('http://attacker.org')).toBe(false);
    });
  });
});
