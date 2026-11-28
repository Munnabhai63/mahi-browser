import net from 'node:net';
import tls from 'node:tls';
import { CreateProxyDTO, ProxyTestResult } from '../../10_CONFIG/shared/types/proxy.js';
import { openSocks5TunnelSocket, Socks5Error } from '../socks-tunnel.js';
import {
  ProxySecurityError,
  ProxyDnsLookupFn,
  isBlockedIpAddress,
  assertSafeProxyTargetSyntax,
  assertSafeProxyTargetRuntime,
} from './proxy-security.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
const log = createLogger('proxy-test-service');

export {
  ProxySecurityError,
  isBlockedIpAddress,
  assertSafeProxyTargetSyntax,
  assertSafeProxyTargetRuntime,
};

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else log.info(msg);
}

/**
 * Sanitize proxy config for logging (masks password)
 */
export function sanitizeProxyLog(dto: Partial<CreateProxyDTO>): string {
  const proto = dto.protocol || 'http';
  const host = dto.host || '';
  const port = dto.port || '';
  const user = dto.username ? `${dto.username}:******@` : '';
  return `${proto}://${user}${host}:${port}`;
}

export interface GeoLocationDetails {
  ip: string;
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  asn?: string;
  org?: string;
}

/**
 * Resolves Geolocation details for a given IP or hostname
 */
export async function resolveGeoLocation(target: string): Promise<GeoLocationDetails | null> {
  const raw = target.trim().replace(/^https?:\/\//i, '');
  const cleanTarget = net.isIP(raw) !== 0 ? raw : raw.split('/')[0].split(':')[0];
  if (!cleanTarget) return null;
  try {
    assertSafeProxyTargetSyntax(cleanTarget);
  } catch {
    return null;
  }

  // 1. Try freeipapi.com (HTTPS)
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(cleanTarget)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.countryCode) {
        return {
          ip: data.ipAddress || cleanTarget,
          country: data.countryName || 'United States',
          countryCode: data.countryCode.toUpperCase(),
          region: data.regionName || undefined,
          city: data.cityName || undefined,
          timezone: data.timeZone || undefined,
        };
      }
    }
  } catch (err) {
    log.debug('GeoIP primary provider (freeipapi) lookup fell back', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Fallback to ipapi.co (HTTPS)
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(cleanTarget)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.country_code) {
        return {
          ip: data.ip || cleanTarget,
          country: data.country_name || 'United States',
          countryCode: data.country_code.toUpperCase(),
          region: data.region || undefined,
          city: data.city || undefined,
          timezone: data.timezone || undefined,
          isp: data.org || undefined,
          asn: data.asn || undefined,
        };
      }
    }
  } catch (err) {
    log.debug('GeoIP secondary provider (ipapi.co) lookup fell back', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Fallback to ipwho.is (HTTPS)
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(cleanTarget)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.success !== false && data.country_code) {
        return {
          ip: data.ip || cleanTarget,
          country: data.country || 'United States',
          countryCode: String(data.country_code).toUpperCase(),
          region: data.region || undefined,
          city: data.city || undefined,
          timezone: data.timezone?.id || undefined,
          isp: data.connection?.isp || undefined,
          asn: data.connection?.asn ? `AS${data.connection.asn}` : undefined,
          org: data.connection?.org || undefined,
        };
      }
    }
  } catch (err) {
    log.debug('GeoIP tertiary provider (ipwho.is) lookup fell back', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

/**
 * Performs true end-to-end HTTPS CONNECT through the proxy to verify real internet connectivity
 * and retrieves the actual public exit IP that websites will see.
 */
function testHttpsConnectThroughProxy(
  host: string,
  port: number,
  protocol = 'http',
  username?: string,
  password?: string,
  timeoutMs = 7000,
  connectHost?: string
): Promise<{ success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }> {
  const startTime = Date.now();
  const targetAddress = connectHost || host;

  return new Promise((resolve) => {
    let isResolved = false;
    const authHeader = username && password
      ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      : null;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try {
          rawSocket.destroy();
        } catch (err) {
          log.debug('Proxy HTTPS test timeout socket destroy skipped', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
        resolve({
          success: false,
          latencyMs: Date.now() - startTime,
          errorCode: 'TIMEOUT',
          error: `Proxy connection timed out after ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    const finish = (result: { success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        try {
          rawSocket.destroy();
        } catch (err) {
          log.debug('Proxy HTTPS test finish socket destroy skipped', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
        resolve(result);
      }
    };

    let rawSocket: net.Socket;

    const onConnectEstablished = () => {
      // Send CONNECT to api.ipify.org:443
      let connectReq = `CONNECT api.ipify.org:443 HTTP/1.1\r\nHost: api.ipify.org:443\r\n`;
      if (authHeader) {
        connectReq += `Proxy-Authorization: ${authHeader}\r\n`;
      }
      connectReq += `User-Agent: Mozilla/5.0\r\nProxy-Connection: Keep-Alive\r\n\r\n`;

      rawSocket.write(connectReq);

      let headerBuffer = '';
      const onData = (chunk: Buffer) => {
        headerBuffer += chunk.toString('utf-8');
        const endOfHeaders = headerBuffer.indexOf('\r\n\r\n') !== -1
          ? headerBuffer.indexOf('\r\n\r\n')
          : headerBuffer.indexOf('\n\n');

        if (endOfHeaders !== -1) {
          rawSocket.removeListener('data', onData);
          const statusLine = headerBuffer.split('\r\n')[0] || headerBuffer.split('\n')[0] || '';

          if (statusLine.includes('407')) {
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'AUTHENTICATION_FAILED',
              error: 'Proxy authentication rejected (HTTP 407). Check username and password.',
            });
            return;
          }

          if (statusLine.includes('200')) {
            // Tunnel is established! Upgrade socket to TLS to read public IP from api.ipify.org
            try {
              const tlsSocket = tls.connect({
                socket: rawSocket,
                servername: 'api.ipify.org',
                rejectUnauthorized: true,
              }, () => {
                tlsSocket.write(`GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`);
              });

              let body = '';
              tlsSocket.on('data', (d) => { body += d.toString('utf-8'); });
              tlsSocket.on('end', () => {
                const latency = Date.now() - startTime;
                try {
                  const jsonStart = body.indexOf('{');
                  if (jsonStart !== -1) {
                    const parsed = JSON.parse(body.slice(jsonStart));
                    finish({
                      success: true,
                      latencyMs: latency,
                      publicIp: parsed.ip || undefined,
                    });
                    return;
                  }
                } catch (parseErr) {
                  log.debug('HTTP proxy public IP JSON parse fell back', {
                    err: parseErr instanceof Error ? parseErr.message : String(parseErr),
                  });
                }
                finish({ success: true, latencyMs: latency });
              });

              tlsSocket.on('error', (tlsErr) => {
                // If TLS failed but CONNECT succeeded, proxy is still alive
                finish({ success: true, latencyMs: Date.now() - startTime });
              });
            } catch {
              finish({ success: true, latencyMs: Date.now() - startTime });
            }
          } else {
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'PROXY_REJECTED',
              error: `Proxy rejected HTTPS CONNECT with status: ${statusLine}`,
            });
          }
        }
      };

      rawSocket.on('data', onData);
    };

    if (protocol === 'https') {
      const tlsOpts: tls.ConnectionOptions = {
        host: targetAddress,
        port,
        rejectUnauthorized: process.env.MAHI_ALLOW_SELF_SIGNED_PROXY !== '1',
      };
      if (!net.isIP(host)) {
        tlsOpts.servername = host;
      }
      rawSocket = tls.connect(tlsOpts, onConnectEstablished);
    } else {
      rawSocket = net.connect(port, targetAddress, onConnectEstablished);
    }

    rawSocket.on('error', (err: any) => {
      let code = 'CONNECTION_FAILED';
      let msg = err.message || 'Connection failed';
      if (err.code === 'ECONNREFUSED') {
        code = 'CONNECTION_REFUSED';
        msg = `Proxy server refused connection at ${host}:${port}`;
      } else if (err.code === 'ENOTFOUND') {
        code = 'DNS_FAILURE';
        msg = `Could not resolve proxy hostname: ${host}`;
      }
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        errorCode: code,
        error: msg,
      });
    });
  });
}

/**
 * Performs native RFC 1928 / RFC 1929 SOCKS5 handshake through the proxy, then
 * upgrades to TLS to retrieve the real public exit IP visible to websites.
 */
async function testSocks5ThroughProxy(
  host: string,
  port: number,
  username?: string,
  password?: string,
  timeoutMs = 7000,
  connectHost?: string
): Promise<{ success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }> {
  const startTime = Date.now();
  const targetAddress = connectHost || host;
  try {
    const { socket, initialData } = await openSocks5TunnelSocket({
      proxyHost: targetAddress,
      proxyPort: port,
      targetHost: 'api.ipify.org',
      targetPort: 443,
      username,
      password,
      timeoutMs,
    });
    if (initialData.length > 0) {
      socket.unshift(initialData);
    }

    return await new Promise((resolve) => {
      let settled = false;
      const done = (res: { success: boolean; latencyMs: number; publicIp?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(tlsTimer);
        try {
          tlsSocket.destroy();
        } catch (err) {
          log.debug('SOCKS5 test TLS socket destroy skipped', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
        try {
          socket.destroy();
        } catch (err) {
          log.debug('SOCKS5 test raw socket destroy skipped', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
        resolve(res);
      };

      const tlsTimer = setTimeout(() => {
        // SOCKS5 CONNECT succeeded; return success even if exit IP lookup stalled
        done({ success: true, latencyMs: Date.now() - startTime });
      }, Math.min(3500, timeoutMs));

      let tlsSocket: tls.TLSSocket;
      try {
        tlsSocket = tls.connect(
          {
            socket,
            servername: 'api.ipify.org',
            rejectUnauthorized: process.env.MAHI_ALLOW_SELF_SIGNED_PROXY !== '1',
          },
          () => {
            tlsSocket.write(
              'GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n'
            );
          }
        );
      } catch (tlsErr) {
        clearTimeout(tlsTimer);
        try {
          socket.destroy();
        } catch (destroyErr) {
          log.debug('SOCKS5 test fallback socket destroy skipped', {
            err: destroyErr instanceof Error ? destroyErr.message : String(destroyErr),
          });
        }
        log.debug('SOCKS5 test TLS upgrade skipped; CONNECT already succeeded', {
          err: tlsErr instanceof Error ? tlsErr.message : String(tlsErr),
        });
        resolve({ success: true, latencyMs: Date.now() - startTime });
        return;
      }

      let body = '';
      tlsSocket.on('data', (d: Buffer) => {
        body += d.toString('utf-8');
      });
      tlsSocket.on('end', () => {
        const latency = Date.now() - startTime;
        try {
          const jsonStart = body.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(body.slice(jsonStart));
            done({
              success: true,
              latencyMs: latency,
              publicIp: parsed.ip || undefined,
            });
            return;
          }
        } catch (parseErr) {
          log.debug('SOCKS5 proxy public IP JSON parse fell back', {
            err: parseErr instanceof Error ? parseErr.message : String(parseErr),
          });
        }
        done({ success: true, latencyMs: latency });
      });
      tlsSocket.on('error', () => {
        // CONNECT succeeded; proxy is reachable even if local test endpoint closed TLS
        done({ success: true, latencyMs: Date.now() - startTime });
      });
    });
  } catch (err: any) {
    if (err instanceof Socks5Error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        errorCode: err.errorCode,
        error: err.message,
      };
    }
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      errorCode: 'CONNECTION_FAILED',
      error: err?.message || 'SOCKS5 connection failed',
    };
  }
}

/**
 * Master Proxy Testing & Geolocation Service
 */
export async function testProxy(
  dto: Partial<CreateProxyDTO>,
  options?: { allowPrivateTargets?: boolean; lookupFn?: ProxyDnsLookupFn }
): Promise<ProxyTestResult> {
  const host = dto.host?.trim();
  const port = Number(dto.port);
  const protocol = (dto.protocol || 'http').toLowerCase();

  debugLog(`[ProxyTestService] Starting validation for: ${sanitizeProxyLog(dto)}`);

  // 1. Validation & SSRF protection (blocks loopback, RFC1918, cloud metadata, and DNS rebinding)
  if (!host) {
    return { success: false, latencyMs: 0, errorCode: 'INVALID_CONFIG', errorMessage: 'Proxy host is required' };
  }
  if (!port || isNaN(port) || port < 1 || port > 65535) {
    return { success: false, latencyMs: 0, errorCode: 'INVALID_CONFIG', errorMessage: 'Valid port (1-65535) is required' };
  }

  let connectHost = host;
  try {
    const resolvedTarget = await assertSafeProxyTargetRuntime(host, options);
    connectHost = resolvedTarget.resolvedIp;
  } catch (err: any) {
    const errorCode = err instanceof ProxySecurityError ? err.errorCode : 'SSRF_BLOCKED';
    return {
      success: false,
      latencyMs: 0,
      errorCode,
      errorMessage: err?.message || 'Blocked unsafe proxy target',
    };
  }

  // 2. Perform End-to-End Handshake Test based on Protocol (connecting to validated IP)
  let testResult: { success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string };

  if (protocol === 'socks5' || protocol === 'socks4') {
    debugLog(`[ProxyTestService] Testing SOCKS5 handshake through ${protocol}://${host}:${port}...`);
    testResult = await testSocks5ThroughProxy(host, port, dto.username, dto.password, 7000, connectHost);
  } else {
    debugLog(`[ProxyTestService] Testing HTTPS CONNECT through ${protocol}://${host}:${port}...`);
    testResult = await testHttpsConnectThroughProxy(host, port, protocol, dto.username, dto.password, 7000, connectHost);

    // If initial protocol failed, try alternate protocol (e.g. if configured as http, try https, or vice versa)
    if (!testResult.success && testResult.errorCode !== 'AUTHENTICATION_FAILED') {
      const altProtocol = protocol === 'https' ? 'http' : 'https';
      debugLog(`[ProxyTestService] Retrying with alternate protocol (${altProtocol})...`);
      const altResult = await testHttpsConnectThroughProxy(host, port, altProtocol, dto.username, dto.password, 4000, connectHost);
      if (altResult.success) {
        testResult = altResult;
      }
    }
  }

  if (!testResult.success) {
    debugLog(`[ProxyTestService] Test failed: ${testResult.error} (${testResult.errorCode})`);
    return {
      success: false,
      latencyMs: testResult.latencyMs,
      errorCode: testResult.errorCode,
      errorMessage: testResult.error,
    };
  }

  debugLog(`[ProxyTestService] Connection verified (${testResult.latencyMs}ms, Exit IP: ${testResult.publicIp || 'unknown'}). Resolving location...`);

  // 3. Resolve Geolocation for the actual public exit IP
  const targetIp = testResult.publicIp || host;
  const geo = await resolveGeoLocation(targetIp);

  const countryCode = geo?.countryCode || 'US';
  const country = geo?.country || 'United States';

  debugLog(`[ProxyTestService] Resolved Location: ${countryCode} - ${country} (Exit IP: ${geo?.ip || targetIp})`);

  return {
    success: true,
    latencyMs: testResult.latencyMs,
    ip: geo?.ip || testResult.publicIp || host,
    countryCode,
    country,
    region: geo?.region,
    city: geo?.city,
    timezone: geo?.timezone,
    isp: geo?.isp,
    asn: geo?.asn,
    org: geo?.org,
  };
}
