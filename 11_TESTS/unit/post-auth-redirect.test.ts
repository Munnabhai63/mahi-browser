import { describe, it, expect } from 'vitest';
import {
  isSafeInternalUrl,
  resolvePostAuthRedirect,
} from '../../07_BACKEND/commercial/google-oauth-service.js';

describe('Post-Auth Redirect Resolver & URL Safety', () => {
  describe('isSafeInternalUrl', () => {
    it('accepts valid internal allowlisted relative paths', () => {
      expect(isSafeInternalUrl('/dashboard')).toBe(true);
      expect(isSafeInternalUrl('/download')).toBe(true);
      expect(isSafeInternalUrl('/pricing')).toBe(true);
      expect(isSafeInternalUrl('/pricing?plan=team_50')).toBe(true);
      expect(isSafeInternalUrl('/book-demo')).toBe(true);
      expect(isSafeInternalUrl('/account')).toBe(true);
      expect(isSafeInternalUrl('/checkout?plan=professional_50')).toBe(true);
      expect(isSafeInternalUrl('/')).toBe(true);
      expect(isSafeInternalUrl('/dashboard?onboarding=trial')).toBe(true);
    });

    it('rejects external absolute URLs', () => {
      expect(isSafeInternalUrl('https://evil.com')).toBe(false);
      expect(isSafeInternalUrl('http://attacker.org/steal')).toBe(false);
      expect(isSafeInternalUrl('ftp://example.com')).toBe(false);
    });

    it('accepts trusted absolute HTTPS origins for allowlisted paths', () => {
      expect(isSafeInternalUrl('https://app.mahibrowser.com/overview')).toBe(true);
      expect(isSafeInternalUrl('https://mahibrowser.com/download')).toBe(true);
      expect(isSafeInternalUrl('https://www.mahibrowser.com/pricing')).toBe(true);
      expect(isSafeInternalUrl('https://app.mahibrowser.com/dashboard')).toBe(true);
    });

    it('rejects untrusted domains, insecure http, and unapproved absolute paths', () => {
      expect(isSafeInternalUrl('https://evil.com/overview')).toBe(false);
      expect(isSafeInternalUrl('http://app.mahibrowser.com/overview')).toBe(false);
      expect(isSafeInternalUrl('https://app.mahibrowser.com/etc/passwd')).toBe(false);
      expect(isSafeInternalUrl('https://app.mahibrowser.com/overview/../../../evil')).toBe(false);
    });

    it('rejects protocol-relative and backslash bypass attempts', () => {
      expect(isSafeInternalUrl('//evil.com')).toBe(false);
      expect(isSafeInternalUrl('/\\evil.com')).toBe(false);
      expect(isSafeInternalUrl('///evil.com')).toBe(false);
      expect(isSafeInternalUrl('/evil.com/..//something')).toBe(false);
    });

    it('rejects javascript: and data: URIs', () => {
      expect(isSafeInternalUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeInternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects non-allowlisted unapproved routes', () => {
      expect(isSafeInternalUrl('/etc/passwd')).toBe(false);
      expect(isSafeInternalUrl('/admin-secret-dump')).toBe(false);
      expect(isSafeInternalUrl('/unknown-arbitrary-page')).toBe(false);
    });
    it('uses process.env.JWT_SECRET and ADMIN_BOOTSTRAP_TOKEN in non-electron environments', async () => {
      const { getJwtSecret, getMasterAdminSecret } = await import('../../08_SECURITY/install-secrets.js');
      const origJwt = process.env.JWT_SECRET;
      const origAdmin = process.env.ADMIN_BOOTSTRAP_TOKEN;
      try {
        process.env.JWT_SECRET = 'custom_jwt_secret_for_production_gateway';
        process.env.ADMIN_BOOTSTRAP_TOKEN = 'custom_admin_bootstrap_token_for_gateway';
        expect(getJwtSecret()).toBe('custom_jwt_secret_for_production_gateway');
        expect(getMasterAdminSecret()).toBe('custom_admin_bootstrap_token_for_gateway');
      } finally {
        if (origJwt !== undefined) process.env.JWT_SECRET = origJwt;
        else delete process.env.JWT_SECRET;
        if (origAdmin !== undefined) process.env.ADMIN_BOOTSTRAP_TOKEN = origAdmin;
        else delete process.env.ADMIN_BOOTSTRAP_TOKEN;
      }
    });
  });

  describe('resolvePostAuthRedirect - Intent-Aware Routing Matrix', () => {
    // CASE 1: Normal Login
    it('Case 1: User clicks normal Login -> lands on /dashboard', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'login',
        returnUrl: '',
      });
      expect(dest).toBe('/dashboard');
    });

    it('Case 1b: User clicks normal Login with no intent specified -> defaults to /dashboard', () => {
      const dest = resolvePostAuthRedirect({});
      expect(dest).toBe('/dashboard');
    });

    // CASE 2: Normal Signup
    it('Case 2: User clicks Sign Up normally -> lands on /dashboard', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'signup',
        returnUrl: '',
      });
      expect(dest).toBe('/dashboard');
    });

    // CASE 3: Start 7-Day Trial
    it('Case 3: User clicks Start 7-Day Trial -> lands on /dashboard?onboarding=trial&plan=professional_50', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'trial',
        planId: 'professional_50',
        billingCycle: 'annual',
      });
      expect(dest).toBe('/dashboard?onboarding=trial&plan=professional_50');
    });

    it('Case 3b: User clicks Start 7-Day Trial without specific plan -> lands on /dashboard?onboarding=trial', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'trial',
      });
      expect(dest).toBe('/dashboard?onboarding=trial');
    });

    // CASE 4: Explicit Download CTA
    it('Case 4: User clicks explicit Download CTA -> preserves /download', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'download',
        returnUrl: '/download',
      });
      expect(dest).toBe('/download');
    });

    it('Case 4b: Explicit returnUrl=/download is preserved even with login intent', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'login',
        returnUrl: '/download',
      });
      expect(dest).toBe('/download');
    });

    // CASE 5: Pricing Plan CTA
    it('Case 5: User clicks Pricing Plan CTA -> preserves plan & billing in pricing/checkout', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'paid',
        planId: 'team_100',
        billingCycle: 'annual',
      });
      expect(dest).toBe('/pricing?plan=team_100&billing=annual');
    });

    // CASE 6: Book Demo
    it('Case 6: User clicks Book Demo -> lands on /book-demo', () => {
      const dest = resolvePostAuthRedirect({
        intent: 'demo',
      });
      expect(dest).toBe('/book-demo');
    });

    // Security: Malicious returnUrl falling back to safe canonical destination
    it('Sanitizes malicious returnUrl and falls back to safe intent destination', () => {
      const destTrial = resolvePostAuthRedirect({
        intent: 'trial',
        planId: 'professional_50',
        returnUrl: 'https://evil.com/phishing',
      });
      expect(destTrial).toBe('/dashboard?onboarding=trial&plan=professional_50');

      const destLogin = resolvePostAuthRedirect({
        intent: 'login',
        returnUrl: '//attacker.com',
      });
      expect(destLogin).toBe('/dashboard');
    });
  });
});
