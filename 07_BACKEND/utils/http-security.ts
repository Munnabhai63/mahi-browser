import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';

export const DEFAULT_MAX_JSON_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
export const DEFAULT_MAX_RAW_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_MAX_UPLOAD_BODY_BYTES = 250 * 1024 * 1024; // 250 MB
export const DEFAULT_BODY_TIMEOUT_MS = 30_000;

export class PayloadTooLargeError extends Error {
  readonly statusCode = 413;
  readonly code = 'PAYLOAD_TOO_LARGE';
  constructor(maxBytes: number) {
    super(`Request body exceeded maximum allowed limit of ${maxBytes} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

export class RequestTimeoutError extends Error {
  readonly statusCode = 408;
  readonly code = 'REQUEST_TIMEOUT';
  constructor(timeoutMs: number) {
    super(`Request body read timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

export class InvalidJsonError extends Error {
  readonly statusCode = 400;
  readonly code = 'INVALID_JSON';
  constructor(message = 'Invalid JSON payload') {
    super(message);
    this.name = 'InvalidJsonError';
  }
}

export interface BoundedBodyOptions {
  maxBytes?: number;
  timeoutMs?: number;
  invalidJsonMessage?: string;
}

export function normalizeIp(raw?: string | null): string {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (!ip) return '';

  // Strip [ipv6]:port or [ipv6]
  if (ip.startsWith('[')) {
    const closeIdx = ip.indexOf(']');
    if (closeIdx > 0) {
      ip = ip.slice(1, closeIdx);
    }
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'));
  }

  // Strip IPv6 zone ID (e.g. fe80::1%eth0)
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx > 0) {
    ip = ip.slice(0, zoneIdx);
  }

  if (ip.toLowerCase().startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (net.isIPv4(mapped)) {
      ip = mapped;
    }
  }
  return ip;
}

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1';
}

function parseValidHeaderIp(headerVal: string | string[] | undefined): string[] {
  if (!headerVal) return [];
  const raw = Array.isArray(headerVal) ? headerVal.join(',') : headerVal;
  return raw
    .split(',')
    .map((part) => normalizeIp(part))
    .filter((candidate) => candidate.length > 0 && net.isIP(candidate) !== 0);
}

/**
 * Resolves the client IP safely.
 * Never trusts x-forwarded-for / x-real-ip unless TRUST_PROXY or TRUSTED_PROXY_IPS
 * explicitly marks the direct socket peer as a trusted reverse proxy.
 */
export function resolveTrustedClientIp(req: http.IncomingMessage): string {
  const socketIp = normalizeIp(req.socket?.remoteAddress) || '127.0.0.1';
  const trustedIpsEnv = (process.env.TRUSTED_PROXY_IPS || '').trim();
  const trustProxyEnv = (process.env.TRUST_PROXY || '').trim().toLowerCase();

  if (trustedIpsEnv) {
    const trustedSet = new Set(
      trustedIpsEnv
        .split(',')
        .map((entry) => {
          const clean = entry.trim().toLowerCase();
          return clean === 'loopback' ? 'loopback' : normalizeIp(clean);
        })
        .filter(Boolean)
    );
    const peerIsTrusted =
      trustedSet.has(socketIp) || (trustedSet.has('loopback') && isLoopbackIp(socketIp));
    if (!peerIsTrusted) {
      return socketIp;
    }
    const forwardedChain = parseValidHeaderIp(req.headers?.['x-forwarded-for']);
    for (let i = forwardedChain.length - 1; i >= 0; i--) {
      const candidate = forwardedChain[i];
      const isTrustedHop =
        trustedSet.has(candidate) || (trustedSet.has('loopback') && isLoopbackIp(candidate));
      if (!isTrustedHop) {
        return candidate;
      }
    }
    const realIps = parseValidHeaderIp(req.headers?.['x-real-ip']);
    if (realIps.length > 0) {
      return realIps[0];
    }
    return forwardedChain[0] || socketIp;
  }

  if (trustProxyEnv === 'loopback') {
    if (!isLoopbackIp(socketIp)) {
      return socketIp;
    }
    const forwardedChain = parseValidHeaderIp(req.headers?.['x-forwarded-for']);
    for (let i = forwardedChain.length - 1; i >= 0; i--) {
      if (!isLoopbackIp(forwardedChain[i])) {
        return forwardedChain[i];
      }
    }
    const realIps = parseValidHeaderIp(req.headers?.['x-real-ip']);
    if (realIps.length > 0 && !isLoopbackIp(realIps[0])) {
      return realIps[0];
    }
    return socketIp;
  }

  const parsedHops =
    trustProxyEnv === 'true' || trustProxyEnv === '1'
      ? 1
      : /^\d+$/.test(trustProxyEnv)
      ? parseInt(trustProxyEnv, 10)
      : 0;

  if (parsedHops > 0) {
    const forwardedChain = parseValidHeaderIp(req.headers?.['x-forwarded-for']);
    if (forwardedChain.length > 0) {
      // Walk from the right according to configured proxy hop depth so client-prepended
      // XFF entries cannot spoof rate limits.
      const idx = Math.max(0, forwardedChain.length - parsedHops);
      return forwardedChain[idx];
    }
    const realIps = parseValidHeaderIp(req.headers?.['x-real-ip']);
    if (realIps.length > 0) {
      return realIps[0];
    }
  }

  return socketIp;
}

/**
 * Reads an HTTP request body as a Buffer while enforcing a strict maximum byte size
 * and idle read timeout to prevent memory exhaustion / slowloris DoS.
 */
export function readBoundedBuffer(
  req: http.IncomingMessage,
  options: BoundedBodyOptions = {}
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RAW_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_BODY_TIMEOUT_MS;

  if ((req as any).rawBuffer !== undefined && Buffer.isBuffer((req as any).rawBuffer)) {
    const preBuffered = (req as any).rawBuffer as Buffer;
    if (preBuffered.length > maxBytes) {
      return Promise.reject(new PayloadTooLargeError(maxBytes));
    }
    return Promise.resolve(preBuffered);
  }
  if ((req as any).body !== undefined && (req as any).body !== null) {
    const preBody = (req as any).body;
    const preBuf = Buffer.isBuffer(preBody)
      ? preBody
      : Buffer.from(typeof preBody === 'string' ? preBody : JSON.stringify(preBody), 'utf8');
    if (preBuf.length > maxBytes) {
      return Promise.reject(new PayloadTooLargeError(maxBytes));
    }
    return Promise.resolve(preBuf);
  }
  if ((req as any).readableEnded || (req as any)._readableState?.ended) {
    return Promise.resolve(Buffer.alloc(0));
  }

  const contentLengthHeader = req.headers?.['content-length'];
  if (typeof contentLengthHeader === 'string' && contentLengthHeader.trim()) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      if (typeof (req as any).pause === 'function') {
        (req as any).pause();
      }
      return Promise.reject(new PayloadTooLargeError(maxBytes));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const removeListener = (event: string, fn: (...args: any[]) => void) => {
      if (typeof (req as any).off === 'function') {
        (req as any).off(event, fn);
      } else if (typeof (req as any).removeListener === 'function') {
        (req as any).removeListener(event, fn);
      }
    };

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      removeListener('data', onData);
      removeListener('end', onEnd);
      removeListener('error', onError);
      removeListener('aborted', onAborted);
    };

    const resetTimer = () => {
      if (timer) {
        clearTimeout(timer);
      }
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          if (typeof (req as any).pause === 'function') {
            (req as any).pause();
          }
          reject(new RequestTimeoutError(timeoutMs));
        }, timeoutMs);
        timer.unref?.();
      }
    };

    const onData = (chunk: Buffer | string) => {
      if (settled) return;
      const bufChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
      totalBytes += bufChunk.length;
      if (totalBytes > maxBytes) {
        settled = true;
        cleanup();
        chunks.length = 0;
        if (typeof (req as any).pause === 'function') {
          (req as any).pause();
        }
        reject(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(bufChunk);
      resetTimer();
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, totalBytes));
    };

    const onError = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAborted = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Request aborted by client'));
    };

    resetTimer();
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

export async function readBoundedText(
  req: http.IncomingMessage,
  options: BoundedBodyOptions = {}
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
  if ((req as any).body !== undefined && typeof (req as any).body === 'string') {
    if (Buffer.byteLength((req as any).body, 'utf8') > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }
    return (req as any).body;
  }
  const buf = await readBoundedBuffer(req, { ...options, maxBytes });
  return buf.toString('utf8');
}

export async function parseBoundedJson(
  req: http.IncomingMessage,
  options: BoundedBodyOptions = {}
): Promise<any> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
  if (
    (req as any).body !== undefined &&
    (req as any).body !== null &&
    typeof (req as any).body === 'object' &&
    !Buffer.isBuffer((req as any).body)
  ) {
    return (req as any).body;
  }
  const raw = await readBoundedText(req, { ...options, maxBytes });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidJsonError(options.invalidJsonMessage || 'Invalid JSON payload');
  }
}

export function getErrorStatusCode(err: unknown, fallback = 500): number {
  if (err && typeof err === 'object' && typeof (err as any).statusCode === 'number') {
    const code = (err as any).statusCode;
    if (code >= 400 && code < 600) {
      return code;
    }
  }
  return fallback;
}

/**
 * Redacts query/fragment auth parameters, Bearer headers, and JWT strings before logging
 * or exposing diagnostics bundles.
 */
export function redactSensitiveTokens(input: string): string {
  if (!input) return input;
  return input
    .replace(
      /([?&](?:handoff|code|token|access_token|accessToken|id_token|refresh_token|ticket|apiKey|api_key|adminSecret|admin_secret|secret)=)([^&\s#'"<>]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /(#(?:token|accessToken|access_token|id_token|refresh_token)=)([^&\s'"<>]+)/gi,
      '$1[REDACTED]'
    )
    .replace(/\b(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi, '$1[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]');
}

/**
 * Compares two secrets/PINs in constant time without length-based exceptions.
 */
export function constantTimeEqualStrings(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  const digestsMatch = crypto.timingSafeEqual(digestA, digestB);
  return digestsMatch && Buffer.byteLength(a, 'utf8') === Buffer.byteLength(b, 'utf8');
}
