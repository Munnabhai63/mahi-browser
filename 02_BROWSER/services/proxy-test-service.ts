import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import { CreateProxyDTO, ProxyTestResult } from '../../10_CONFIG/shared/types/proxy.js';

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else console.log(msg);
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
  const cleanTarget = target.trim().replace(/^https?:\/\//i, '').split(':')[0];
  if (!cleanTarget) return null;

  // 1. Try ip-api.com
  try {
    const res = await fetch(`http://ip-api.com/json/${cleanTarget}?fields=status,country,countryCode,regionName,city,timezone,isp,as,org,query`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && data.status === 'success') {
        return {
          ip: data.query || cleanTarget,
          country: data.country || 'United States',
          countryCode: (data.countryCode || 'US').toUpperCase(),
          region: data.regionName || undefined,
          city: data.city || undefined,
          timezone: data.timezone || undefined,
          isp: data.isp || undefined,
          asn: data.as || undefined,
          org: data.org || undefined,
        };
      }
    }
  } catch {}

  // 2. Fallback to freeipapi.com
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${cleanTarget}`, {
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
  } catch {}

  // 3. Fallback to ipapi.co
  try {
    const res = await fetch(`https://ipapi.co/${cleanTarget}/json/`, {
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
  } catch {}

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
  timeoutMs = 7000
): Promise<{ success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let isResolved = false;
    const authHeader = username && password
      ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      : null;

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { rawSocket.destroy(); } catch {}
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
        try { rawSocket.destroy(); } catch {}
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
                rejectUnauthorized: false,
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
                } catch {}
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
        host,
        port,
        rejectUnauthorized: false,
      };
      if (!net.isIP(host)) {
        tlsOpts.servername = host;
      }
      rawSocket = tls.connect(tlsOpts, onConnectEstablished);
    } else {
      rawSocket = net.connect(port, host, onConnectEstablished);
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
 * Performs native RFC 1928 SOCKS5 handshake through the proxy to verify internet connectivity.
 */
function testSocks5ThroughProxy(
  host: string,
  port: number,
  username?: string,
  password?: string,
  timeoutMs = 7000
): Promise<{ success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }> {
  const startTime = Date.now();
  return new Promise((resolve) => {
    let isResolved = false;
    const socket = net.connect(port, host);

    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { socket.destroy(); } catch {}
        resolve({
          success: false,
          latencyMs: Date.now() - startTime,
          errorCode: 'TIMEOUT',
          error: `SOCKS5 proxy connection timed out after ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    const finish = (result: { success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string }) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        try { socket.destroy(); } catch {}
        resolve(result);
      }
    };

    socket.on('error', (err: any) => {
      let code = 'CONNECTION_FAILED';
      let msg = err.message || 'Connection failed';
      if (err.code === 'ECONNREFUSED') {
        code = 'CONNECTION_REFUSED';
        msg = `SOCKS5 proxy server refused connection at ${host}:${port}`;
      } else if (err.code === 'ENOTFOUND') {
        code = 'DNS_FAILURE';
        msg = `Could not resolve SOCKS5 proxy hostname: ${host}`;
      }
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        errorCode: code,
        error: msg,
      });
    });

    socket.on('connect', () => {
      // Step 1: Version negotiation
      if (username && password) {
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
      } else {
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      }

      let state: 'AUTH_METHOD' | 'AUTH_SUBNEG' | 'CONNECT_RESP' = 'AUTH_METHOD';
      socket.on('data', (data: Buffer) => {
        if (state === 'AUTH_METHOD') {
          if (data.length < 2 || data[0] !== 0x05) {
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'PROXY_REJECTED',
              error: 'Invalid SOCKS5 version in server response',
            });
            return;
          }
          const method = data[1];
          if (method === 0xff) {
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'AUTHENTICATION_FAILED',
              error: 'SOCKS5 authentication method rejected by server',
            });
            return;
          }
          if (method === 0x02 && username && password) {
            state = 'AUTH_SUBNEG';
            const uBuf = Buffer.from(username, 'utf8');
            const pBuf = Buffer.from(password, 'utf8');
            const authPacket = Buffer.concat([
              Buffer.from([0x01, uBuf.length]),
              uBuf,
              Buffer.from([pBuf.length]),
              pBuf,
            ]);
            socket.write(authPacket);
            return;
          }
          sendConnect();
        } else if (state === 'AUTH_SUBNEG') {
          if (data.length < 2 || data[1] !== 0x00) {
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'AUTHENTICATION_FAILED',
              error: 'SOCKS5 credentials rejected by proxy',
            });
            return;
          }
          sendConnect();
        } else if (state === 'CONNECT_RESP') {
          if (data.length >= 2 && data[1] === 0x00) {
            finish({
              success: true,
              latencyMs: Date.now() - startTime,
            });
          } else {
            const errByte = data.length >= 2 ? data[1] : 0x01;
            finish({
              success: false,
              latencyMs: Date.now() - startTime,
              errorCode: 'PROXY_REJECTED',
              error: `SOCKS5 CONNECT failed with status code 0x${errByte.toString(16)}`,
            });
          }
        }
      });

      function sendConnect() {
        state = 'CONNECT_RESP';
        // Connect to api.ipify.org:443 via domain name (ATYP = 0x03)
        const targetDomain = Buffer.from('api.ipify.org', 'utf8');
        const connectPacket = Buffer.concat([
          Buffer.from([0x05, 0x01, 0x00, 0x03, targetDomain.length]),
          targetDomain,
          Buffer.from([0x01, 0xbb]), // port 443 (0x01bb)
        ]);
        socket.write(connectPacket);
      }
    });
  });
}

/**
 * Master Proxy Testing & Geolocation Service
 */
export async function testProxy(dto: Partial<CreateProxyDTO>): Promise<ProxyTestResult> {
  const host = dto.host?.trim();
  const port = Number(dto.port);
  const protocol = (dto.protocol || 'http').toLowerCase();

  debugLog(`[ProxyTestService] Starting validation for: ${sanitizeProxyLog(dto)}`);

  // 1. Validation
  if (!host) {
    return { success: false, latencyMs: 0, errorCode: 'INVALID_CONFIG', errorMessage: 'Proxy host is required' };
  }
  if (!port || isNaN(port) || port < 1 || port > 65535) {
    return { success: false, latencyMs: 0, errorCode: 'INVALID_CONFIG', errorMessage: 'Valid port (1-65535) is required' };
  }

  // 2. Perform End-to-End Handshake Test based on Protocol
  let testResult: { success: boolean; latencyMs: number; publicIp?: string; error?: string; errorCode?: string };

  if (protocol === 'socks5' || protocol === 'socks4') {
    debugLog(`[ProxyTestService] Testing SOCKS5 handshake through ${protocol}://${host}:${port}...`);
    testResult = await testSocks5ThroughProxy(host, port, dto.username, dto.password, 7000);
  } else {
    debugLog(`[ProxyTestService] Testing HTTPS CONNECT through ${protocol}://${host}:${port}...`);
    testResult = await testHttpsConnectThroughProxy(host, port, protocol, dto.username, dto.password, 7000);

    // If initial protocol failed, try alternate protocol (e.g. if configured as http, try https, or vice versa)
    if (!testResult.success && testResult.errorCode !== 'AUTHENTICATION_FAILED') {
      const altProtocol = protocol === 'https' ? 'http' : 'https';
      debugLog(`[ProxyTestService] Retrying with alternate protocol (${altProtocol})...`);
      const altResult = await testHttpsConnectThroughProxy(host, port, altProtocol, dto.username, dto.password, 4000);
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
