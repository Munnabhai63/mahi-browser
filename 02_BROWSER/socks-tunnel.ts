import net from 'node:net';
import http from 'node:http';
import stream from 'node:stream';

export interface Socks5ConnectOptions {
  proxyHost: string;
  proxyPort: number;
  targetHost: string;
  targetPort: number;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export class Socks5Error extends Error {
  constructor(
    public readonly errorCode:
      | 'CONNECTION_REFUSED'
      | 'DNS_FAILURE'
      | 'TIMEOUT'
      | 'AUTHENTICATION_FAILED'
      | 'PROXY_REJECTED'
      | 'CONNECTION_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'Socks5Error';
  }
}

/**
 * Encodes target host & port into RFC 1928 ATYP + DST.ADDR + DST.PORT bytes.
 * Hostnames use ATYP=0x03 so DNS resolution occurs on the SOCKS5 server (no local DNS leak).
 */
export function buildSocks5TargetAddress(targetHost: string, targetPort: number): Buffer {
  const cleanHost = targetHost.replace(/^\[|\]$/g, '').trim();
  const ipVersion = net.isIP(cleanHost);
  const portBuf = Buffer.allocUnsafe(2);
  portBuf.writeUInt16BE(targetPort & 0xffff, 0);

  if (ipVersion === 4) {
    const octets = cleanHost.split('.').map((n) => parseInt(n, 10) & 0xff);
    return Buffer.concat([Buffer.from([0x01, ...octets]), portBuf]);
  }

  if (ipVersion === 6) {
    const addrBytes = parseIPv6ToBuffer(cleanHost);
    return Buffer.concat([Buffer.from([0x04]), addrBytes, portBuf]);
  }

  const hostBuf = Buffer.from(cleanHost, 'utf8');
  if (hostBuf.length > 255) {
    throw new Socks5Error('PROXY_REJECTED', `SOCKS5 domain name exceeds 255 bytes: ${cleanHost}`);
  }
  return Buffer.concat([Buffer.from([0x03, hostBuf.length]), hostBuf, portBuf]);
}

function parseIPv6ToBuffer(ip: string): Buffer {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = Math.max(0, 8 - headParts.length - tailParts.length);
  const groups = [
    ...headParts,
    ...Array.from({ length: missing }, () => '0'),
    ...tailParts,
  ].slice(0, 8);

  const out = Buffer.alloc(16);
  for (let i = 0; i < groups.length; i++) {
    out.writeUInt16BE(parseInt(groups[i] || '0', 16) & 0xffff, i * 2);
  }
  return out;
}

/**
 * Calculates total expected byte length of a SOCKS5 CONNECT reply frame if complete, else null.
 */
function getSocks5ReplyFrameLength(buf: Buffer): number | null {
  if (buf.length < 4) return null;
  const atyp = buf[3];
  if (atyp === 0x01) return 10; // VER REP RSV ATYP + 4 IPv4 + 2 PORT
  if (atyp === 0x04) return 22; // VER REP RSV ATYP + 16 IPv6 + 2 PORT
  if (atyp === 0x03) {
    if (buf.length < 5) return null;
    return 5 + buf[4] + 2;
  }
  // Fallback when proxy sends non-standard minimal 4+2=6 or short error header on failure
  if (buf[1] !== 0x00 && buf.length >= 4) return buf.length;
  return null;
}

/**
 * Connects to an upstream SOCKS5 proxy, performs RFC 1928 method negotiation,
 * optional RFC 1929 username/password authentication, and issues CONNECT.
 * Returns the connected socket ready for TLS/HTTP payload streaming plus any
 * trailing bytes received right after the CONNECT reply frame.
 */
export function openSocks5TunnelSocket(
  options: Socks5ConnectOptions
): Promise<{ socket: net.Socket; initialData: Buffer }> {
  const {
    proxyHost,
    proxyPort,
    targetHost,
    targetPort,
    username,
    password,
    timeoutMs = 10000,
  } = options;

  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyHost);
    let settled = false;
    let stage: 'GREETING' | 'AUTH' | 'CONNECT' = 'GREETING';
    let buffer: Buffer = Buffer.alloc(0);

    const fail = (err: Socks5Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeListener('data', onData);
      try {
        socket.destroy();
      } catch {}
      reject(err);
    };

    const timer = setTimeout(() => {
      fail(new Socks5Error('TIMEOUT', `SOCKS5 proxy connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        fail(new Socks5Error('CONNECTION_REFUSED', `SOCKS5 proxy server refused connection at ${proxyHost}:${proxyPort}`));
      } else if (err.code === 'ENOTFOUND') {
        fail(new Socks5Error('DNS_FAILURE', `Could not resolve SOCKS5 proxy hostname: ${proxyHost}`));
      } else {
        fail(new Socks5Error('CONNECTION_FAILED', err.message || 'SOCKS5 connection failed'));
      }
    });

    socket.on('close', () => {
      if (!settled) {
        fail(new Socks5Error('CONNECTION_FAILED', 'SOCKS5 proxy closed connection before handshake completed'));
      }
    });

    socket.on('connect', () => {
      const hasCreds = Boolean(username && username.length > 0);
      const greeting = hasCreds
        ? Buffer.from([0x05, 0x02, 0x00, 0x02])
        : Buffer.from([0x05, 0x01, 0x00]);
      socket.write(greeting);
    });

    const sendConnectRequest = () => {
      try {
        const addrBuf = buildSocks5TargetAddress(targetHost, targetPort);
        stage = 'CONNECT';
        socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00]), addrBuf]));
      } catch (err) {
        fail(err instanceof Socks5Error ? err : new Socks5Error('PROXY_REJECTED', String(err)));
      }
    };

    const onData = (chunk: Buffer) => {
      buffer = buffer.length > 0 ? Buffer.concat([buffer, chunk]) : chunk;

      while (!settled && buffer.length > 0) {
        if (stage === 'GREETING') {
          if (buffer.length < 2) return;
          const ver = buffer[0];
          const method = buffer[1];
          buffer = buffer.subarray(2);

          if (ver !== 0x05) {
            fail(new Socks5Error('PROXY_REJECTED', 'Invalid SOCKS5 version in server response'));
            return;
          }
          if (method === 0xff) {
            fail(new Socks5Error('AUTHENTICATION_FAILED', 'SOCKS5 authentication method rejected by server'));
            return;
          }
          if (method === 0x02) {
            const uBuf = Buffer.from(username || '', 'utf8');
            const pBuf = Buffer.from(password || '', 'utf8');
            if (uBuf.length > 255 || pBuf.length > 255) {
              fail(new Socks5Error('AUTHENTICATION_FAILED', 'SOCKS5 credentials exceed 255-byte RFC 1929 limit'));
              return;
            }
            stage = 'AUTH';
            socket.write(
              Buffer.concat([
                Buffer.from([0x01, uBuf.length]),
                uBuf,
                Buffer.from([pBuf.length]),
                pBuf,
              ])
            );
            continue;
          }
          sendConnectRequest();
          continue;
        }

        if (stage === 'AUTH') {
          if (buffer.length < 2) return;
          const status = buffer[1];
          buffer = buffer.subarray(2);
          if (status !== 0x00) {
            fail(new Socks5Error('AUTHENTICATION_FAILED', 'SOCKS5 credentials rejected by proxy'));
            return;
          }
          sendConnectRequest();
          continue;
        }

        if (stage === 'CONNECT') {
          const frameLen = getSocks5ReplyFrameLength(buffer);
          if (frameLen === null || buffer.length < frameLen) return;

          const ver = buffer[0];
          const rep = buffer[1];
          const trailing = buffer.subarray(frameLen);

          if (ver !== 0x05) {
            fail(new Socks5Error('PROXY_REJECTED', 'Invalid SOCKS5 CONNECT version response'));
            return;
          }
          if (rep !== 0x00) {
            fail(new Socks5Error('PROXY_REJECTED', `SOCKS5 CONNECT failed with status code 0x${rep.toString(16)}`));
            return;
          }

          settled = true;
          clearTimeout(timer);
          socket.removeListener('data', onData);
          resolve({ socket, initialData: trailing });
          return;
        }
      }
    };

    socket.on('data', onData);
  });
}

/**
 * Bridges an incoming HTTP CONNECT tunnel (`req.url = "host:port"`) over upstream SOCKS5.
 */
export async function bridgeConnectOverSocks5(params: {
  reqUrl: string;
  clientSocket: stream.Duplex;
  head: Buffer;
  proxyHost: string;
  proxyPort: number;
  username?: string;
  password?: string;
  activeSockets: Set<stream.Duplex | net.Socket>;
  socketTimeoutMs: number;
  log?: (msg: string) => void;
}): Promise<void> {
  const {
    reqUrl,
    clientSocket,
    head,
    proxyHost,
    proxyPort,
    username,
    password,
    activeSockets,
    socketTimeoutMs,
    log,
  } = params;

  const [targetHost, rawPort] = parseHostPort(reqUrl, 443);
  let upstreamSocket: net.Socket | undefined;

  const cleanup = (reason?: string) => {
    if (reason && log) log(`[ProxyTunnel SOCKS5 CONNECT] Cleanup (${reason})`);
    activeSockets.delete(clientSocket);
    if (upstreamSocket) activeSockets.delete(upstreamSocket);
    try { clientSocket.destroy(); } catch {}
    if (upstreamSocket) {
      try { upstreamSocket.destroy(); } catch {}
    }
  };

  clientSocket.on('error', (err) => cleanup(`Client error: ${err.message}`));
  clientSocket.on('close', () => cleanup());
  clientSocket.on('timeout', () => cleanup('Client socket timeout'));

  try {
    const conn = await openSocks5TunnelSocket({
      proxyHost,
      proxyPort,
      targetHost,
      targetPort: rawPort,
      username,
      password,
      timeoutMs: socketTimeoutMs,
    });
    upstreamSocket = conn.socket;
    activeSockets.add(upstreamSocket);
    upstreamSocket.setTimeout(socketTimeoutMs);

    upstreamSocket.on('error', (err) => cleanup(`Upstream error: ${err.message}`));
    upstreamSocket.on('close', () => cleanup());
    upstreamSocket.on('timeout', () => cleanup('Upstream timeout'));

    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (conn.initialData.length > 0) {
      clientSocket.write(conn.initialData);
    }
    if (head && head.length > 0) {
      upstreamSocket.write(head);
    }

    clientSocket.pipe(upstreamSocket);
    upstreamSocket.pipe(clientSocket);
  } catch (err: any) {
    if (log) log(`[ProxyTunnel SOCKS5 CONNECT ERROR] ${err?.message || err}`);
    try {
      clientSocket.write(`HTTP/1.1 502 Bad Gateway\r\n\r\nSOCKS5 Tunnel Error: ${err?.message || 'failed'}`);
    } catch {}
    cleanup(err?.message);
  }
}

/**
 * Forwards a plain HTTP request from Chrome over a SOCKS5 upstream proxy using Node's
 * custom socket agent so status codes, headers, and chunked bodies stream natively.
 */
export async function forwardHttpRequestOverSocks5(params: {
  clientReq: http.IncomingMessage;
  clientRes: http.ServerResponse;
  proxyHost: string;
  proxyPort: number;
  username?: string;
  password?: string;
  socketTimeoutMs: number;
  log?: (msg: string) => void;
}): Promise<void> {
  const { clientReq, clientRes, proxyHost, proxyPort, username, password, socketTimeoutMs, log } = params;

  try {
    const parsedUrl = new URL(clientReq.url || '/', `http://${clientReq.headers.host || 'localhost'}`);
    const targetHost = parsedUrl.hostname;
    const targetPort = Number(parsedUrl.port) || 80;

    const { socket, initialData } = await openSocks5TunnelSocket({
      proxyHost,
      proxyPort,
      targetHost,
      targetPort,
      username,
      password,
      timeoutMs: socketTimeoutMs,
    });
    if (initialData.length > 0) {
      socket.unshift(initialData);
    }

    const headers: Record<string, string | string[] | undefined> = { ...clientReq.headers };
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    headers.host = parsedUrl.host;

    const agent = new http.Agent({ keepAlive: false });
    (agent as any).createConnection = (_opts: any, cb: (err: Error | null, s?: net.Socket) => void) => {
      cb(null, socket);
      return socket;
    };

    const proxyReq = http.request(
      {
        agent,
        host: targetHost,
        port: targetPort,
        method: clientReq.method,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers,
        timeout: socketTimeoutMs,
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(clientRes);
      }
    );

    proxyReq.on('error', (err) => {
      if (log) log(`[ProxyTunnel SOCKS5 HTTP ERROR] ${err.message}`);
      try { socket.destroy(); } catch {}
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end('SOCKS5 Proxy Tunnel Error: ' + err.message);
      }
    });

    clientReq.pipe(proxyReq);
  } catch (err: any) {
    if (log) log(`[ProxyTunnel SOCKS5 HTTP ERROR] ${err?.message || err}`);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('SOCKS5 Proxy Tunnel Error: ' + (err?.message || 'failed'));
    }
  }
}

function parseHostPort(authority: string, defaultPort: number): [string, number] {
  const s = (authority || '').trim();
  if (s.startsWith('[')) {
    const endBracket = s.indexOf(']');
    if (endBracket !== -1) {
      const host = s.slice(1, endBracket);
      const portStr = s.slice(endBracket + 2);
      return [host, Number(portStr) || defaultPort];
    }
  }
  const lastColon = s.lastIndexOf(':');
  if (lastColon !== -1) {
    const host = s.slice(0, lastColon);
    const port = Number(s.slice(lastColon + 1));
    return [host, Number.isFinite(port) && port > 0 ? port : defaultPort];
  }
  return [s, defaultPort];
}
