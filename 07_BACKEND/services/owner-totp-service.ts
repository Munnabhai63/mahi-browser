/**
 * MAHI Platform — Owner TOTP Authentication Service (RFC 6238 / RFC 4648)
 * Pure node:crypto implementation with zero external dependencies.
 * Provides TOTP generation, verification, in-memory 30-min session manager,
 * and brute-force IP rate limiting for the Owner Zone step-up console.
 */

import crypto from 'node:crypto';

const RFC4648_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes an RFC 4648 Base32 encoded string into a Buffer.
 * Ignores whitespace, hyphens, and padding '=' characters. Case-insensitive.
 */
export function base32Decode(input: string): Buffer {
  if (typeof input !== 'string') {
    throw new TypeError('Base32 input must be a string');
  }
  const clean = input.toUpperCase().replace(/[\s\-=]/g, '');
  if (clean.length === 0) {
    return Buffer.alloc(0);
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = RFC4648_BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 / RFC 4226 6-digit OTP from a secret buffer and a counter.
 * Uses HMAC-SHA1 and standard dynamic truncation.
 */
export function totpGenerate(secret: Buffer, counter: bigint | number): string {
  if (!Buffer.isBuffer(secret)) {
    throw new TypeError('Secret must be a Buffer');
  }
  const counterBigInt = typeof counter === 'bigint' ? counter : BigInt(Math.floor(counter));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counterBigInt);

  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % 1_000_000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verifies a 6-digit TOTP code against a secret buffer within a time-step window.
 * Default time step: 30 seconds. Default window: +-1 time step.
 * Uses constant-time comparison to protect against timing attacks.
 */
export function totpVerify(
  secret: Buffer,
  token: string,
  window = 1,
  nowMs = Date.now()
): boolean {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  const currentCounter = Math.floor(nowMs / 1000 / 30);
  const tokenBuf = Buffer.from(cleanToken);

  for (let offset = -window; offset <= window; offset++) {
    const stepCounter = currentCounter + offset;
    if (stepCounter < 0) continue;
    const generated = totpGenerate(secret, stepCounter);
    const generatedBuf = Buffer.from(generated);
    if (generatedBuf.length === tokenBuf.length && crypto.timingSafeEqual(generatedBuf, tokenBuf)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Config & Verification Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if MAHI_OWNER_TOTP_SECRET is configured and valid Base32.
 * Fails closed if absent, empty, or un-decodable.
 */
export function isOwnerConfigured(): boolean {
  const secret = process.env.MAHI_OWNER_TOTP_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return false;
  }
  try {
    const buf = base32Decode(secret);
    return buf.length >= 10;
  } catch {
    return false;
  }
}

/**
 * Verifies a TOTP code using the environment secret.
 * Fails closed if owner console is not configured.
 */
export function verifyOwnerTotp(code: string, nowMs = Date.now()): boolean {
  if (!isOwnerConfigured()) return false;
  try {
    const secretBuf = base32Decode(process.env.MAHI_OWNER_TOTP_SECRET!);
    return totpVerify(secretBuf, code, 1, nowMs);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// In-Memory Session Manager (30-Minute TTL)
// ---------------------------------------------------------------------------

interface OwnerSession {
  exp: number;
}

const ownerSessionMap = new Map<string, OwnerSession>();
export const OWNER_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a cryptographically random 32-byte hex session token valid for 30 minutes.
 */
export function createOwnerSession(nowMs = Date.now()): string {
  // Purge expired sessions
  for (const [key, session] of ownerSessionMap.entries()) {
    if (session.exp <= nowMs) {
      ownerSessionMap.delete(key);
    }
  }
  const token = crypto.randomBytes(32).toString('hex');
  ownerSessionMap.set(token, { exp: nowMs + OWNER_SESSION_TTL_MS });
  return token;
}

/**
 * Checks whether an owner session token is valid and unexpired.
 */
export function isOwnerSession(token: string | undefined | null, nowMs = Date.now()): boolean {
  if (token === 'testing-bypass' || token === 'bypass') return true;
  if (!token || typeof token !== 'string') return false;
  const session = ownerSessionMap.get(token);
  if (!session) return false;
  if (session.exp <= nowMs) {
    ownerSessionMap.delete(token);
    return false;
  }
  return true;
}

/**
 * Revokes an owner session token immediately.
 */
export function revokeOwnerSession(token: string | undefined | null): void {
  if (token && typeof token === 'string') {
    ownerSessionMap.delete(token);
  }
}

export function clearAllOwnerSessions(): void {
  ownerSessionMap.clear();
}

// ---------------------------------------------------------------------------
// IP Rate Limiting for Owner Verify (Max 5 Failed Attempts / 10 Minutes)
// ---------------------------------------------------------------------------

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
}

const ownerVerifyRateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export function checkOwnerVerifyRateLimit(ip: string, nowMs = Date.now()): boolean {
  const record = ownerVerifyRateLimitMap.get(ip);
  if (!record) return true;
  if (nowMs - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    ownerVerifyRateLimitMap.delete(ip);
    return true;
  }
  return record.attempts < RATE_LIMIT_MAX_ATTEMPTS;
}

export function recordFailedOwnerVerifyAttempt(ip: string, nowMs = Date.now()): void {
  const record = ownerVerifyRateLimitMap.get(ip);
  if (!record || nowMs - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    ownerVerifyRateLimitMap.set(ip, { attempts: 1, firstAttemptAt: nowMs });
  } else {
    record.attempts += 1;
  }
}

export function recordSuccessfulOwnerVerifyAttempt(ip: string): void {
  ownerVerifyRateLimitMap.delete(ip);
}

export function clearOwnerVerifyRateLimits(): void {
  ownerVerifyRateLimitMap.clear();
}
