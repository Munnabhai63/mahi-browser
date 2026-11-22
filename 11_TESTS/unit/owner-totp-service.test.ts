import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  base32Decode,
  totpGenerate,
  totpVerify,
  isOwnerConfigured,
  verifyOwnerTotp,
  createOwnerSession,
  isOwnerSession,
  revokeOwnerSession,
  clearAllOwnerSessions,
  checkOwnerVerifyRateLimit,
  recordFailedOwnerVerifyAttempt,
  recordSuccessfulOwnerVerifyAttempt,
  clearOwnerVerifyRateLimits,
  OWNER_SESSION_TTL_MS,
} from '../../07_BACKEND/services/owner-totp-service.js';

describe('Owner TOTP Service Suite (RFC 6238 & Session Security)', () => {
  const originalEnv = process.env.MAHI_OWNER_TOTP_SECRET;

  beforeEach(() => {
    clearAllOwnerSessions();
    clearOwnerVerifyRateLimits();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MAHI_OWNER_TOTP_SECRET = originalEnv;
    } else {
      delete process.env.MAHI_OWNER_TOTP_SECRET;
    }
  });

  describe('RFC 4648 Base32 Decoding', () => {
    it('decodes standard RFC 6238 20-byte test secret correctly', () => {
      const base32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      const buf = base32Decode(base32);
      expect(buf.toString('ascii')).toBe('12345678901234567890');
      expect(buf.length).toBe(20);
    });

    it('tolerates spaces, dashes, lowercase, and padding', () => {
      const formatted = 'gezd-gnbv-gy3t-qojq gez-dgnb-vgy3-tqojq===';
      const buf = base32Decode(formatted);
      expect(buf.toString('ascii')).toBe('12345678901234567890');
    });

    it('throws on invalid base32 characters', () => {
      expect(() => base32Decode('INVALID_CHAR_89!')).toThrow(/Invalid Base32 character/);
    });
  });

  describe('RFC 6238 TOTP Generation Test Vectors (HMAC-SHA1, 6 digits)', () => {
    const secretBuf = Buffer.from('12345678901234567890', 'ascii');

    it('matches RFC 6238 Appendix B test vector at counter 1 (T=59s)', () => {
      expect(totpGenerate(secretBuf, 1)).toBe('287082');
    });

    it('matches RFC 6238 Appendix B test vector at counter 37037036 (T=1111111109s)', () => {
      expect(totpGenerate(secretBuf, 37037036)).toBe('081804');
    });

    it('matches RFC 6238 Appendix B test vector at counter 37037037 (T=1111111111s)', () => {
      expect(totpGenerate(secretBuf, 37037037)).toBe('050471');
    });

    it('matches RFC 6238 Appendix B test vector at counter 41152263 (T=1234567890s)', () => {
      expect(totpGenerate(secretBuf, 41152263)).toBe('005924');
    });

    it('matches RFC 6238 Appendix B test vector at counter 66666666 (T=2000000000s)', () => {
      expect(totpGenerate(secretBuf, 66666666)).toBe('279037');
    });
  });

  describe('TOTP Verification & Window Tolerance', () => {
    const secretBuf = Buffer.from('12345678901234567890', 'ascii');
    const nowMs = 1234567890 * 1000; // Counter 41152263 -> '005924'
    const currentCode = '005924';
    const prevCode = totpGenerate(secretBuf, 41152262);
    const nextCode = totpGenerate(secretBuf, 41152264);
    const twoStepsAgo = totpGenerate(secretBuf, 41152261);
    const twoStepsAhead = totpGenerate(secretBuf, 41152265);

    it('accepts current code', () => {
      expect(totpVerify(secretBuf, currentCode, 1, nowMs)).toBe(true);
    });

    it('accepts previous step code (window = 1)', () => {
      expect(totpVerify(secretBuf, prevCode, 1, nowMs)).toBe(true);
    });

    it('accepts next step code (window = 1)', () => {
      expect(totpVerify(secretBuf, nextCode, 1, nowMs)).toBe(true);
    });

    it('rejects codes outside +-1 window', () => {
      expect(totpVerify(secretBuf, twoStepsAgo, 1, nowMs)).toBe(false);
      expect(totpVerify(secretBuf, twoStepsAhead, 1, nowMs)).toBe(false);
    });

    it('rejects invalid formatting and bogus codes', () => {
      expect(totpVerify(secretBuf, '12345', 1, nowMs)).toBe(false);
      expect(totpVerify(secretBuf, '1234567', 1, nowMs)).toBe(false);
      expect(totpVerify(secretBuf, 'abcdef', 1, nowMs)).toBe(false);
      expect(totpVerify(secretBuf, '999999', 1, nowMs)).toBe(false);
    });
  });

  describe('isOwnerConfigured & verifyOwnerTotp', () => {
    it('returns false and fails closed when MAHI_OWNER_TOTP_SECRET is unset', () => {
      delete process.env.MAHI_OWNER_TOTP_SECRET;
      expect(isOwnerConfigured()).toBe(false);
      expect(verifyOwnerTotp('005924')).toBe(false);
    });

    it('returns false when MAHI_OWNER_TOTP_SECRET is invalid base32', () => {
      process.env.MAHI_OWNER_TOTP_SECRET = '!!!SHORT_INVALID!!!';
      expect(isOwnerConfigured()).toBe(false);
      expect(verifyOwnerTotp('005924')).toBe(false);
    });

    it('returns true and verifies code when MAHI_OWNER_TOTP_SECRET is valid', () => {
      process.env.MAHI_OWNER_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
      expect(isOwnerConfigured()).toBe(true);
      const nowMs = 1234567890 * 1000;
      expect(verifyOwnerTotp('005924', nowMs)).toBe(true);
      expect(verifyOwnerTotp('999999', nowMs)).toBe(false);
    });
  });

  describe('Session Manager (30-Minute In-Memory TTL)', () => {
    it('creates, validates, and revokes sessions', () => {
      const now = 1000000;
      const token = createOwnerSession(now);
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex

      expect(isOwnerSession(token, now)).toBe(true);
      expect(isOwnerSession(token, now + 15 * 60 * 1000)).toBe(true);

      // Past 30-min TTL
      expect(isOwnerSession(token, now + OWNER_SESSION_TTL_MS + 1)).toBe(false);

      // Unknown or undefined tokens
      expect(isOwnerSession(undefined)).toBe(false);
      expect(isOwnerSession(null as any)).toBe(false);
      expect(isOwnerSession('non-existent-token')).toBe(false);
    });

    it('explicitly revokes active session', () => {
      const now = 2000000;
      const token = createOwnerSession(now);
      expect(isOwnerSession(token, now)).toBe(true);

      revokeOwnerSession(token);
      expect(isOwnerSession(token, now)).toBe(false);
    });
  });

  describe('Rate Limiter for Owner Verify (Max 5 Failed Attempts / 10 Minutes)', () => {
    const testIp = '192.168.1.100';

    it('allows attempts initially and blocks after 5 failures', () => {
      const now = 5000000;
      expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(true);

      for (let i = 0; i < 4; i++) {
        recordFailedOwnerVerifyAttempt(testIp, now);
        expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(true);
      }

      // 5th failed attempt
      recordFailedOwnerVerifyAttempt(testIp, now);
      expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(false);

      // 6th attempt remains blocked
      expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(false);

      // After 10 minute window passes, resets
      const tenMinsLater = now + 10 * 60 * 1000 + 100;
      expect(checkOwnerVerifyRateLimit(testIp, tenMinsLater)).toBe(true);
    });

    it('clears failed attempts upon successful verification', () => {
      const now = 6000000;
      recordFailedOwnerVerifyAttempt(testIp, now);
      recordFailedOwnerVerifyAttempt(testIp, now);
      expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(true);

      recordSuccessfulOwnerVerifyAttempt(testIp);
      // Can now do 5 more failed attempts without blocking
      for (let i = 0; i < 4; i++) {
        recordFailedOwnerVerifyAttempt(testIp, now);
        expect(checkOwnerVerifyRateLimit(testIp, now)).toBe(true);
      }
    });
  });
});
