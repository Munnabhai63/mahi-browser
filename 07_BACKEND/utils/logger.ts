import { AsyncLocalStorage } from 'node:async_hooks';
import { redactSensitiveTokens } from './http-security.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  module?: string;
  requestId?: string;
  [key: string]: unknown;
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  const parent = logContextStorage.getStore() || {};
  return logContextStorage.run({ ...parent, ...context }, fn);
}

export function getActiveLogContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(context: LogContext): Logger;
}

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN =
  /^(?:password|passwd|passphrase|secret|totpSecret|totp|token|accessToken|access_token|refreshToken|refresh_token|idToken|id_token|apiKey|api_key|authorization|cookie|cookies|set-cookie|setCookie|privateKey|private_key|masterKey|master_key|syncKey|sync_key|secretKey|secret_key|credential|credentials|databaseUrl|database_url|redisUrl|redis_url|passwordHash|password_hash|refreshTokenHash|refresh_token_hash|tokenHash|token_hash|ownerSession)$/i;

const SENSITIVE_KEY_SUBSTRING_PATTERN =
  /(?:password|passwd|passphrase|secret|private_?key|master_?key|sync_?key|api_?key|authorization|set-?cookie|token_?hash|refresh_?token|access_?token|id_?token)/i;

function isSensitiveKey(key: string): boolean {
  if (!key) return false;
  if (SENSITIVE_KEY_PATTERN.test(key)) return true;
  if (/^(?:has|is|use|enable|allow|max|min|count|length|expires|expiry|ttl)/i.test(key)) {
    return false;
  }
  return SENSITIVE_KEY_SUBSTRING_PATTERN.test(key);
}

/**
 * Redacts credentials, tokens, Authorization headers, cookies, connection URLs,
 * and private keys from free-form log strings.
 */
export function redactLogMessage(input: string): string {
  if (!input) return input;
  return redactSensitiveTokens(input)
    .replace(
      /\b(Authorization|Cookie|Set-Cookie|X-Admin-Secret|X-Master-Secret|X-Merchant-Key)\s*:\s*([^\r\n]+)/gi,
      '$1: [REDACTED]'
    )
    .replace(
      /\b(password|passwd|passphrase|secret|client_secret|refresh_token|access_token|id_token|api_key|apikey|private_key|token|totp|jwt)\s*[=:]\s*(['"]?)([^\s'",;)]+)\2/gi,
      '$1=[REDACTED]'
    )
    .replace(/(otpauth:\/\/[^\s'"]*?[?&]secret=)([^&\s'"]+)/gi, '$1[REDACTED]')
    .replace(/\b((?:postgres|postgresql|mysql|redis|rediss):\/\/[^:/\s@]+:)([^@\s]+)@/gi, '$1[REDACTED]@')
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');
}

/**
 * Deeply clones and redacts structured metadata objects and Errors before logging.
 */
export function redactLogValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactLogMessage(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';

  if (value instanceof Error) {
    const out: Record<string, unknown> = {
      name: value.name,
      message: redactLogMessage(value.message || ''),
    };
    const anyErr = value as unknown as Record<string, unknown>;
    if (anyErr.code !== undefined) out.code = anyErr.code;
    if (anyErr.statusCode !== undefined) out.statusCode = anyErr.statusCode;
    return out;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (typeof value !== 'object') {
    return redactLogMessage(String(value));
  }

  if (seen.has(value)) return '[Circular]';
  if (depth >= 6) return '[MaxDepth]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, entryVal] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key) && typeof entryVal !== 'boolean' && typeof entryVal !== 'number') {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactLogValue(entryVal, seen, depth + 1);
    }
  }
  return out;
}

export function getMinLogLevel(): LogLevel {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const configured = (process.env.MAHI_LOG_LEVEL || process.env.LOG_LEVEL || '').trim().toLowerCase();
      if (configured === 'debug' || configured === 'info' || configured === 'warn' || configured === 'error') {
        return configured;
      }
      if (process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
        return 'debug';
      }
    }
  } catch {
    // Non-Node runtimes default cleanly to info
  }
  return 'info';
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    !(val instanceof Error) &&
    !(typeof Buffer !== 'undefined' && Buffer.isBuffer(val))
  );
}

function formatLogEntry(
  level: LogLevel,
  baseContext: LogContext,
  message: string,
  args: unknown[]
): string {
  const activeCtx = logContextStorage.getStore();
  const effectiveContext: LogContext = activeCtx
    ? { ...activeCtx, ...baseContext, ...(baseContext.requestId ? { requestId: baseContext.requestId } : {}) }
    : baseContext;

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
  };

  if (effectiveContext.module) {
    entry.module = effectiveContext.module;
  }
  if (effectiveContext.requestId) {
    entry.requestId = effectiveContext.requestId;
  }

  for (const [k, v] of Object.entries(effectiveContext)) {
    if (k !== 'module' && k !== 'requestId' && v !== undefined) {
      entry[k] = isSensitiveKey(k) && typeof v !== 'boolean' && typeof v !== 'number'
        ? '[REDACTED]'
        : redactLogValue(v);
    }
  }

  const extraStrings: string[] = [];
  const metaParts: unknown[] = [];

  for (const arg of args) {
    if (arg === undefined) continue;
    if (typeof arg === 'string') {
      extraStrings.push(arg);
    } else if (arg instanceof Error) {
      metaParts.push({ error: redactLogValue(arg) });
    } else if (isPlainRecord(arg)) {
      metaParts.push(redactLogValue(arg));
    } else {
      metaParts.push(redactLogValue(arg));
    }
  }

  const combinedMsg = [message, ...extraStrings].filter((s) => s.length > 0).join(' ');
  entry.message = redactLogMessage(combinedMsg);

  if (metaParts.length === 1 && isPlainRecord(metaParts[0])) {
    Object.assign(entry, metaParts[0]);
  } else if (metaParts.length > 0) {
    entry.details = metaParts;
  }

  return JSON.stringify(entry);
}

function shouldEmit(level: LogLevel): boolean {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[getMinLogLevel()];
}

export function createLogger(moduleOrContext: string | LogContext = 'app'): Logger {
  const baseContext: LogContext =
    typeof moduleOrContext === 'string' ? { module: moduleOrContext } : { ...moduleOrContext };

  const emit = (level: LogLevel, message: string, args: unknown[]): void => {
    if (!shouldEmit(level)) return;
    const serialized = formatLogEntry(level, baseContext, message, args);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  };

  return {
    debug(message: string, ...args: unknown[]) {
      emit('debug', message, args);
    },
    info(message: string, ...args: unknown[]) {
      emit('info', message, args);
    },
    warn(message: string, ...args: unknown[]) {
      emit('warn', message, args);
    },
    error(message: string, ...args: unknown[]) {
      emit('error', message, args);
    },
    child(context: LogContext): Logger {
      return createLogger({ ...baseContext, ...context });
    },
  };
}

export const logger = createLogger('mahi');
