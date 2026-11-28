import type http from 'node:http';
import { z } from 'zod';
import {
  InvalidJsonError,
  PayloadTooLargeError,
  RequestTimeoutError,
  getErrorStatusCode,
  redactSensitiveTokens,
} from './http-security.js';
import { createLogger } from './logger.js';
const log = createLogger('app-error');

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'REQUEST_TIMEOUT'
  | 'LOCKED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_GATEWAY'
  | 'INTERNAL_ERROR';

const CODE_TO_STATUS: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  REQUEST_TIMEOUT: 408,
  LOCKED: 423,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  BAD_GATEWAY: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode?: number,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? CODE_TO_STATUS[code] ?? 500;
    this.fieldErrors = fieldErrors;
  }
}

const INTERNAL_ERROR_LEAK_PATTERNS: RegExp[] = [
  /SQLITE_/i,
  /no such (?:table|column|index|function):/i,
  /FOREIGN KEY constraint failed/i,
  /UNIQUE constraint failed/i,
  /CHECK constraint failed/i,
  /PrismaClient/i,
  /\bP\d{4}\b/,
  /relation\s+"[^"]+"\s+does not exist/i,
  /column\s+"[^"]+"\s+(?:does not exist|of relation)/i,
  /syntax error at or near/i,
  /\b(?:ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EACCES|ENOENT|EPERM|EADDRINUSE)\b/,
  /\b(?:TypeError|ReferenceError|RangeError|EvalError|URIError):/,
  /Cannot (?:read|set|delete|destructure) propert(?:y|ies)/i,
  /is not a function/i,
  /is not iterable/i,
  /(?:^|\n)\s*at\s+[A-Za-z0-9_.$<>[\]]+\s*\(/,
  /[A-Za-z]:\\[^\s]+/,
  /\/(?:Users|home|var|usr|opt|etc|srv)\/[^\s]+/,
  /node_modules/i,
  /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i,
];

const SAFE_DOMAIN_ERROR_PATTERNS: RegExp[] = [
  /^(?:UTR_ALREADY_EXISTS|TX_HASH_ALREADY_EXISTS|INVALID_UTR|INVALID_TX_HASH|INVALID_WEBHOOK_SIGNATURE|PLAN_NOT_FOUND|GOOGLE_OAUTH_NOT_CONFIGURED|GOOGLE_ID_TOKEN_INVALID|GOOGLE_ID_TOKEN_EXPIRED|GOOGLE_EMAIL_NOT_VERIFIED|OAUTH_CODE_EXCHANGE_REJECTED|NO_LICENSE|TERMS_NOT_ACCEPTED|TRIAL_ALREADY_USED|NO_TRIAL_PLAN_CONFIGURED)/,
  /^Unknown webhook provider\b/i,
  /^Selected plan\b/i,
  /^Free tier does not require/i,
  /^Payment (?:record|provider|is not pending|gateway)/i,
  /^Pricing version\b/i,
  /^No active pricing version\b/i,
  /exceeds maximum \d+MB limit/i,
  /^Cloud storage quota exceeded/i,
  /^Forbidden:/,
  /^(?:Workspace|Profile|Invitation|Target user|License|User|Session|Checksum|Cloud profile)\b/i,
  /^Access denied\b/i,
  /already been accepted/i,
  /device mismatch/i,
  /belong to authenticated user/i,
  /Invalid\s+(?:role|JSON|payload|object key|code|token|status|pricing|plan|UTR|email|request)/i,
  /\b(?:is required|not found|already exists|does not exist|cannot be empty)\.?$/i,
];

export function isInternalErrorLeak(message: string): boolean {
  if (!message) return false;
  return INTERNAL_ERROR_LEAK_PATTERNS.some((pattern) => pattern.test(message));
}

export function isSafeDomainErrorMessage(message: string): boolean {
  if (!message || message.length > 300) return false;
  if (isInternalErrorLeak(message)) return false;
  return SAFE_DOMAIN_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function statusToDefaultCode(statusCode: number): AppErrorCode {
  if (statusCode === 400) return 'VALIDATION_ERROR';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 408) return 'REQUEST_TIMEOUT';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 413) return 'PAYLOAD_TOO_LARGE';
  if (statusCode === 423) return 'LOCKED';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 502) return 'BAD_GATEWAY';
  if (statusCode === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

export interface SafeErrorPayload {
  statusCode: number;
  code: AppErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export function toSafeErrorResponse(
  err: unknown,
  options?: {
    fallbackStatus?: number;
    fallbackMessage?: string;
    code?: AppErrorCode;
  }
): SafeErrorPayload {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: redactSensitiveTokens(err.message),
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
    };
  }

  if (err instanceof PayloadTooLargeError) {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds maximum allowed size.',
    };
  }

  if (err instanceof RequestTimeoutError) {
    return {
      statusCode: 408,
      code: 'REQUEST_TIMEOUT',
      message: 'Request timed out while reading body.',
    };
  }

  if (err instanceof InvalidJsonError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON payload.',
    };
  }

  const errObj = (err && typeof err === 'object' ? err : null) as {
    message?: unknown;
    name?: unknown;
    statusCode?: unknown;
  } | null;
  const rawMessage = typeof errObj?.message === 'string' ? errObj.message.trim() : '';

  if (errObj?.name === 'PaymentGatewayNotConfiguredError') {
    const safeMsg =
      rawMessage && !isInternalErrorLeak(rawMessage)
        ? redactSensitiveTokens(rawMessage)
        : 'Payment gateway is not configured on this server.';
    return {
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: safeMsg,
    };
  }

  const parsedStatus =
    err instanceof Error && typeof errObj?.statusCode === 'number'
      ? getErrorStatusCode(err)
      : options?.fallbackStatus ?? 500;
  const effectiveStatus = parsedStatus >= 400 && parsedStatus <= 599 ? parsedStatus : options?.fallbackStatus ?? 500;

  if (rawMessage && isSafeDomainErrorMessage(rawMessage)) {
    const statusForDomain =
      effectiveStatus >= 500 && options?.fallbackStatus === undefined ? 400 : effectiveStatus;
    return {
      statusCode: statusForDomain,
      code: options?.code ?? statusToDefaultCode(statusForDomain),
      message: redactSensitiveTokens(rawMessage),
    };
  }

  // Never leak raw internal error details (DB errors, filesystem paths, stack traces) to HTTP clients.
  log.error('[API][SafeError] Masked internal exception:', redactSensitiveTokens(rawMessage || String(err)));

  const fallbackStatus = effectiveStatus;
  const defaultMsg =
    options?.fallbackMessage ??
    (fallbackStatus >= 500
      ? 'Internal server error.'
      : fallbackStatus === 404
        ? 'Requested resource not found.'
        : fallbackStatus === 403
          ? 'Access denied.'
          : 'Invalid request.');

  return {
    statusCode: fallbackStatus,
    code: options?.code ?? statusToDefaultCode(fallbackStatus),
    message: defaultMsg,
  };
}

export function sendSafeError(
  res: http.ServerResponse,
  err: unknown,
  options?: {
    fallbackStatus?: number;
    fallbackMessage?: string;
    code?: AppErrorCode;
  }
): SafeErrorPayload {
  const safe = toSafeErrorResponse(err, options);
  if (!res.headersSent) {
    res.writeHead(safe.statusCode, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: safe.message,
        code: safe.code,
        ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}),
      })
    );
  }
  return safe;
}

export function validateStrictBody<T extends z.ZodTypeAny>(
  schema: T,
  rawBody: unknown,
  res?: http.ServerResponse
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; error: string; fieldErrors: Record<string, string[]> } {
  const normalized = rawBody === undefined || rawBody === null ? {} : rawBody;
  const parsed = schema.safeParse(normalized);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const flattened = z.flattenError(parsed.error);
  const fieldErrors: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(v) && v.length > 0) {
      fieldErrors[k] = v.map(String);
    }
  }
  if (flattened.formErrors.length > 0) {
    fieldErrors._form = flattened.formErrors;
  }

  const firstIssue = parsed.error.issues[0];
  let errorMessage = 'Invalid request payload.';
  if (firstIssue) {
    if (firstIssue.code === 'unrecognized_keys' && 'keys' in firstIssue && Array.isArray(firstIssue.keys)) {
      errorMessage = `Unexpected field(s): ${firstIssue.keys.join(', ')}`;
    } else if (firstIssue.path.length > 0) {
      errorMessage = `${firstIssue.path.join('.')}: ${firstIssue.message}`;
    } else {
      errorMessage = firstIssue.message || 'Invalid request payload.';
    }
  }

  if (res && !res.headersSent) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
        fieldErrors,
      })
    );
  }

  return { ok: false, error: errorMessage, fieldErrors };
}
