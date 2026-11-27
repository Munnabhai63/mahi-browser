import dns from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import net from 'node:net';

export type ProxyDnsLookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<LookupAddress[]>;

export class ProxySecurityError extends Error {
  constructor(
    public readonly errorCode: 'INVALID_CONFIG' | 'SSRF_BLOCKED' | 'DNS_RESOLUTION_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ProxySecurityError';
  }
}

export interface SafeProxyTargetResolution {
  host: string;
  resolvedIp: string;
  family: 4 | 6;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
];

function stripBracketsAndZone(raw: string): string {
  let clean = raw.trim().toLowerCase();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }
  const zoneIdx = clean.indexOf('%');
  if (zoneIdx !== -1) {
    clean = clean.slice(0, zoneIdx);
  }
  return clean;
}

function isBlockedIPv4Octets(octets: [number, number, number, number]): boolean {
  const [a, b, c] = octets;
  if (a === 0) return true; // 0.0.0.0/8 ("this host on this network")
  if (a === 10) return true; // 10.0.0.0/8 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved & broadcast
  return false;
}

function parseIPv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    nums.push(n);
  }
  return nums as [number, number, number, number];
}

function expandIPv6Hextets(ip: string): number[] | null {
  const zoneClean = ip.split('%')[0].toLowerCase();
  const doubleColonParts = zoneClean.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const tokens = part.split(':');
    const out: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok) return null;
      if (tok.includes('.')) {
        if (i !== tokens.length - 1) return null;
        const ipv4 = parseIPv4Octets(tok);
        if (!ipv4) return null;
        out.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(tok)) return null;
        out.push(parseInt(tok, 16));
      }
    }
    return out;
  };

  if (doubleColonParts.length === 1) {
    const groups = parseGroups(doubleColonParts[0]);
    return groups && groups.length === 8 ? groups : null;
  }

  const head = parseGroups(doubleColonParts[0]);
  const tail = parseGroups(doubleColonParts[1]);
  if (!head || !tail) return null;
  const missing = 8 - (head.length + tail.length);
  if (missing < 1) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

function extractEmbeddedIPv4(hA: number, hB: number): [number, number, number, number] {
  return [(hA >> 8) & 0xff, hA & 0xff, (hB >> 8) & 0xff, hB & 0xff];
}

export function isBlockedIpAddress(rawIp: string): boolean {
  if (!rawIp || typeof rawIp !== 'string') return true;
  const ip = stripBracketsAndZone(rawIp);
  const version = net.isIP(ip);
  if (version === 0) return true;

  if (version === 4) {
    const octets = parseIPv4Octets(ip);
    return !octets || isBlockedIPv4Octets(octets);
  }

  const h = expandIPv6Hextets(ip);
  if (!h) return true;

  const allZeroPrefix = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0;
  // :: (unspecified) and ::1 (loopback)
  if (allZeroPrefix && h[6] === 0 && (h[7] === 0 || h[7] === 1)) {
    return true;
  }
  // ::/96 IPv4-compatible
  if (allZeroPrefix) {
    return isBlockedIPv4Octets(extractEmbeddedIPv4(h[6], h[7]));
  }
  // ::ffff:0:0/96 IPv4-mapped IPv6
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff) {
    return isBlockedIPv4Octets(extractEmbeddedIPv4(h[6], h[7]));
  }
  // 64:ff9b::/96 NAT64 well-known prefix
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return isBlockedIPv4Octets(extractEmbeddedIPv4(h[6], h[7]));
  }
  // 64:ff9b:1::/48 NAT64 local-use
  if (h[0] === 0x0064 && h[1] === 0xff9b && h[2] === 0x0001) {
    return true;
  }
  // 2002::/16 6to4 embedded IPv4
  if (h[0] === 0x2002) {
    return isBlockedIPv4Octets(extractEmbeddedIPv4(h[1], h[2]));
  }
  // fc00::/7 ULA private IPv6
  if ((h[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local IPv6
  if ((h[0] & 0xffc0) === 0xfe80) return true;
  // ff00::/8 multicast
  if ((h[0] & 0xff00) === 0xff00) return true;
  // 0100::/64 discard-only
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true;
  // 2001:db8::/32 documentation
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true;

  return false;
}

function isObfuscatedNumericIp(host: string): boolean {
  // Pure decimal/hex integer IP (e.g., 2130706433 or 0x7f000001)
  if (/^(?:\d+|0x[0-9a-f]+)$/i.test(host)) return true;
  // Dotted octal/hex octets (e.g., 0177.0.0.1 or 0x7f.0.0.1)
  const parts = host.split('.');
  if (parts.length >= 2 && parts.length <= 4) {
    const allNumericLike = parts.every((p) => /^(?:\d+|0x[0-9a-f]+)$/i.test(p));
    if (allNumericLike) {
      const hasNonCanonicalOctet = parts.some((p) => /^0x/i.test(p) || (p.length > 1 && p.startsWith('0')));
      if (hasNonCanonicalOctet || parts.length < 4) return true;
    }
  }
  return false;
}

export function assertSafeProxyTargetSyntax(
  rawHost: string,
  options?: { allowPrivateTargets?: boolean }
): string {
  if (!rawHost || typeof rawHost !== 'string') {
    throw new ProxySecurityError('INVALID_CONFIG', 'Proxy host is required');
  }
  const trimmed = rawHost.trim();
  if (!trimmed || /[\s\x00-\x1f\x7f@/\\?#]/.test(trimmed)) {
    throw new ProxySecurityError('INVALID_CONFIG', 'Proxy host contains invalid characters');
  }

  // Strip surrounding IPv6 square brackets if present
  const withoutBrackets =
    trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;

  if (!options?.allowPrivateTargets && withoutBrackets.includes('%')) {
    throw new ProxySecurityError('SSRF_BLOCKED', 'Link-local zone identifiers are not permitted');
  }

  const normalized = withoutBrackets.replace(/\.+$/, '').toLowerCase();
  if (!normalized || normalized.length > 253) {
    throw new ProxySecurityError('INVALID_CONFIG', 'Invalid proxy hostname length');
  }

  if (options?.allowPrivateTargets) {
    return normalized;
  }

  if (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    throw new ProxySecurityError('SSRF_BLOCKED', `Blocked internal proxy hostname: ${normalized}`);
  }

  if (isObfuscatedNumericIp(normalized)) {
    throw new ProxySecurityError('SSRF_BLOCKED', 'Non-canonical numeric IP targets are not permitted');
  }

  const ipFamily = net.isIP(normalized);
  if (ipFamily !== 0) {
    if (isBlockedIpAddress(normalized)) {
      throw new ProxySecurityError('SSRF_BLOCKED', `Blocked private or reserved proxy IP: ${normalized}`);
    }
    return normalized;
  }

  // Hostname label validation
  const labels = normalized.split('.');
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9-]+$/i.test(label) ||
        label.startsWith('-') ||
        label.endsWith('-')
    )
  ) {
    throw new ProxySecurityError('INVALID_CONFIG', `Invalid proxy hostname format: ${normalized}`);
  }

  return normalized;
}

export async function assertSafeProxyTargetRuntime(
  rawHost: string,
  options?: { allowPrivateTargets?: boolean; lookupFn?: ProxyDnsLookupFn }
): Promise<SafeProxyTargetResolution> {
  const cleanHost = assertSafeProxyTargetSyntax(rawHost, options);
  const ipFamily = net.isIP(cleanHost);

  if (ipFamily !== 0) {
    return {
      host: cleanHost,
      resolvedIp: cleanHost,
      family: ipFamily === 6 ? 6 : 4,
    };
  }

  if (options?.allowPrivateTargets) {
    return {
      host: cleanHost,
      resolvedIp: cleanHost,
      family: 4,
    };
  }

  const lookupFn = options?.lookupFn ?? dns.lookup;
  let records: LookupAddress[];
  try {
    const resolved = await lookupFn(cleanHost, { all: true, verbatim: true });
    records = Array.isArray(resolved) ? resolved : [resolved];
  } catch (err: any) {
    throw new ProxySecurityError(
      'DNS_RESOLUTION_FAILED',
      `Failed to resolve proxy hostname: ${err?.code || 'ENOTFOUND'}`
    );
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new ProxySecurityError('DNS_RESOLUTION_FAILED', 'Proxy hostname returned no DNS records');
  }

  for (const record of records) {
    if (!record?.address || isBlockedIpAddress(record.address)) {
      throw new ProxySecurityError(
        'SSRF_BLOCKED',
        `Proxy hostname resolved to blocked internal/reserved IP (${record?.address || 'unknown'})`
      );
    }
  }

  const primary = records[0];
  return {
    host: cleanHost,
    resolvedIp: primary.address,
    family: primary.family === 6 ? 6 : 4,
  };
}
