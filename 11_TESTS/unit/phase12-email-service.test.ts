/**
 * MAHI Browser — Production Email Service & Domain Verification Unit Tests
 * Batch P0-B Verification Suite
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DevelopmentEmailProvider,
  ProductionSmtpEmailProvider,
  ProductionApiEmailProvider,
  EmailDomainHealthChecker,
  createProductionEmailProvider,
  getEmailProvider,
  setEmailProvider,
} from '../../05_AUTH/email-service.js';

describe('Batch P0-B — Production Email Service & Domain Security', () => {
  let devProvider: DevelopmentEmailProvider;

  beforeEach(() => {
    devProvider = new DevelopmentEmailProvider();
    setEmailProvider(devProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. DevelopmentEmailProvider & Safe Logging Policy', () => {
    it('sends all 5 transactional email types (verification, reset, security, invite, billing)', async () => {
      const email = 'user@mahibrowser.com';

      // 1. Verification
      const ok1 = await devProvider.sendVerificationEmail(email, 'secret_token_123', 'https://auth.mahibrowser.com/verify?token=123');
      expect(ok1).toBe(true);

      // 2. Password Reset
      const ok2 = await devProvider.sendPasswordResetEmail(email, 'reset_token_456', 'https://auth.mahibrowser.com/reset?token=456');
      expect(ok2).toBe(true);

      // 3. Security Alert
      const ok3 = await devProvider.sendSecurityAlert(email, 'NEW_DEVICE_LOGIN', 'New login from Chrome on Windows 11');
      expect(ok3).toBe(true);

      // 4. Workspace Invitation
      const ok4 = await devProvider.sendWorkspaceInvitationEmail(
        email,
        'invite_token_789',
        'Growth Team',
        'Lead Admin',
        'https://app.mahibrowser.com/invite/789'
      );
      expect(ok4).toBe(true);

      // 5. Billing Alert
      const ok5 = await devProvider.sendBillingAlert(email, 'INV-2026-001', '$29.00', 'PAID');
      expect(ok5).toBe(true);

      const allSent = devProvider.getSentEmails();
      expect(allSent.length).toBe(5);
    });

    it('strictly redacts tokens and secrets in log messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const sensitiveToken = 'super_secret_auth_token_99999999';

      await devProvider.sendVerificationEmail('safe@mahibrowser.com', sensitiveToken, 'https://verify.url');
      await devProvider.sendPasswordResetEmail('safe@mahibrowser.com', sensitiveToken, 'https://reset.url');

      const logs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logs).not.toContain(sensitiveToken);
      expect(logs).not.toContain(sensitiveToken.substring(0, 8));
      expect(logs).toContain('[REDACTED]');
    });
  });

  describe('2. Production SMTP Email Provider', () => {
    it('validates configuration and throws on missing credentials', () => {
      expect(() => {
        new ProductionSmtpEmailProvider({
          host: '',
          port: 587,
          user: '',
          pass: '',
          from: 'noreply@mahibrowser.com',
        });
      }).toThrow('SMTP_CONFIG_INVALID');
    });

    it('initializes valid SMTP provider and delivers messages', async () => {
      const smtp = new ProductionSmtpEmailProvider({
        host: 'smtp.mailgun.org',
        port: 587,
        user: 'postmaster@mahibrowser.com',
        pass: 'secure_smtp_password',
        from: 'MAHI Browser <noreply@mahibrowser.com>',
      });

      const res = await smtp.sendVerificationEmail('operator@agency.com', 'tok_1', 'https://verify.url');
      expect(res).toBe(true);

      const alertRes = await smtp.sendBillingAlert('operator@agency.com', 'INV-101', '$79.00', 'RENEWED');
      expect(alertRes).toBe(true);
    });
  });

  describe('3. Production REST API Provider (Resend / SendGrid)', () => {
    it('throws if API key is missing', () => {
      expect(() => {
        new ProductionApiEmailProvider({
          apiKey: '',
          from: 'noreply@mahibrowser.com',
        });
      }).toThrow('EMAIL_API_KEY_MISSING');
    });

    it('sends email over fetch with Bearer token authentication', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'msg_resend_12345' })),
      });
      globalThis.fetch = fetchMock;

      const apiProvider = new ProductionApiEmailProvider({
        apiKey: 're_test_live_key_998877',
        from: 'MAHI Browser <noreply@mahibrowser.com>',
      });

      const sent = await apiProvider.sendVerificationEmail('client@test.com', 'tok_abc', 'https://verify.com');
      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [endpoint, opts] = fetchMock.mock.calls[0];
      expect(endpoint).toBe('https://api.resend.com/emails');
      expect(opts.headers.Authorization).toBe('Bearer re_test_live_key_998877');
    });
  });

  describe('4. Domain Health & Authentication Checker (SPF / DKIM / DMARC)', () => {
    it('inspects domain authentication records and reports health status', async () => {
      const health = await EmailDomainHealthChecker.checkDomainHealth('mahibrowser.com');

      expect(health.domain).toBe('mahibrowser.com');
      expect(health.senderAddress).toBe('noreply@mahibrowser.com');
      expect(health.supportAddress).toBe('support@mahibrowser.com');
      expect(['VERIFIED', 'CONFIGURED', 'MISSING']).toContain(health.status);
    });
  });

  describe('5. Production Mode Hardening (No Silent Local Fallback)', () => {
    it('refuses silent fallback and throws in production mode if credentials unset', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevApiKey = process.env.RESEND_API_KEY;
      const prevHost = process.env.SMTP_HOST;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.RESEND_API_KEY;
        delete process.env.EMAIL_API_KEY;
        delete process.env.SMTP_HOST;

        expect(() => {
          createProductionEmailProvider();
        }).toThrow('PRODUCTION_EMAIL_UNCONFIGURED');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevApiKey) process.env.RESEND_API_KEY = prevApiKey;
        if (prevHost) process.env.SMTP_HOST = prevHost;
      }
    });

    it('resolves API provider when RESEND_API_KEY is configured', () => {
      const prevApiKey = process.env.RESEND_API_KEY;
      try {
        process.env.RESEND_API_KEY = 're_live_valid_key';
        const provider = createProductionEmailProvider();
        expect(provider instanceof ProductionApiEmailProvider).toBe(true);
      } finally {
        if (prevApiKey) process.env.RESEND_API_KEY = prevApiKey;
        else delete process.env.RESEND_API_KEY;
      }
    });
  });
});
