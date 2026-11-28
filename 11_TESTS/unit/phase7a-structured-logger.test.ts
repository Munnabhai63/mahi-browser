import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, redactLogMessage, redactLogValue, runWithLogContext } from '../../07_BACKEND/utils/logger.js';

describe('Sub-Step 7A: Structured Logger & Automatic Redaction', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const origLogLevel = process.env.MAHI_LOG_LEVEL;

  beforeEach(() => {
    delete process.env.MAHI_LOG_LEVEL;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origLogLevel === undefined) {
      delete process.env.MAHI_LOG_LEVEL;
    } else {
      process.env.MAHI_LOG_LEVEL = origLogLevel;
    }
  });

  it('redacts tokens, secrets, passwords, authorization headers, cookies, DB URLs, and private keys from strings', () => {
    const raw =
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signatureVal123 ' +
      'Cookie: owner_session=abc123; mahi_session=xyz789 ' +
      'password=SuperSecretPass! client_secret=shh_secret ' +
      'postgres://admin:RealDbPass99@db.example.com:5432/postgres ' +
      'otpauth://totp/MAHI:owner?secret=JBSWY3DPEHPK3PXP&issuer=MAHI ' +
      'https://app.mahibrowser.com/auth?token=tok_abc_123';

    const sanitized = redactLogMessage(raw);
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('xyz789');
    expect(sanitized).not.toContain('SuperSecretPass!');
    expect(sanitized).not.toContain('shh_secret');
    expect(sanitized).not.toContain('RealDbPass99');
    expect(sanitized).not.toContain('JBSWY3DPEHPK3PXP');
    expect(sanitized).not.toContain('tok_abc_123');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('deep-redacts sensitive keys in objects, errors, and handles circular structures cleanly', () => {
    const cyclic: Record<string, unknown> = {
      userEmail: 'operator@mahibrowser.com',
      password: 'MySecretPassword',
      apiKey: 'sk_live_123456',
      hasToken: true,
      nested: {
        authorization: 'Bearer secret_jwt_token',
        cookie: 'mahi_refresh=refresh123',
        syncKey: 'sync_encryption_secret',
        safeCount: 3,
      },
    };
    cyclic.self = cyclic;

    const redacted = redactLogValue(cyclic) as Record<string, any>;
    expect(redacted.userEmail).toBe('operator@mahibrowser.com');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.hasToken).toBe(true);
    expect(redacted.nested.authorization).toBe('[REDACTED]');
    expect(redacted.nested.cookie).toBe('[REDACTED]');
    expect(redacted.nested.syncKey).toBe('[REDACTED]');
    expect(redacted.nested.safeCount).toBe(3);
    expect(redacted.self).toBe('[Circular]');
  });

  it('emits JSON structured logs with module, requestId, child context, and AsyncLocalStorage request propagation', () => {
    const log = createLogger('auth-routes');
    log.info('User authenticated', { userId: 'usr_123', token: 'raw_jwt_should_not_appear' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsedInfo = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(parsedInfo.level).toBe('info');
    expect(parsedInfo.module).toBe('auth-routes');
    expect(parsedInfo.userId).toBe('usr_123');
    expect(parsedInfo.token).toBe('[REDACTED]');
    expect(parsedInfo.timestamp).toBeTruthy();

    const child = log.child({ requestId: 'req_abc_42' });
    child.warn('Slow database query');
    const parsedWarn = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(parsedWarn.level).toBe('warn');
    expect(parsedWarn.module).toBe('auth-routes');
    expect(parsedWarn.requestId).toBe('req_abc_42');

    runWithLogContext({ requestId: 'req_als_999' }, () => {
      log.error('Unhandled gateway failure', new Error('Failed with token=leak_token_value'));
    });
    const parsedErr = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(parsedErr.level).toBe('error');
    expect(parsedErr.requestId).toBe('req_als_999');
    expect(JSON.stringify(parsedErr)).not.toContain('leak_token_value');
  });

  it('respects MAHI_LOG_LEVEL threshold filtering', () => {
    process.env.MAHI_LOG_LEVEL = 'error';
    const log = createLogger('gateway');
    log.debug('Debug suppressed');
    log.info('Info suppressed');
    log.warn('Warn suppressed');
    log.error('Error emitted');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
