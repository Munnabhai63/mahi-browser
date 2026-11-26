import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import stream from 'node:stream';
import { bridgeConnectOverSocks5, forwardHttpRequestOverSocks5 } from './socks-tunnel.js';

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else console.log(msg);
}

export interface ProxyTunnelOptions {
  upstreamHost: string;
  upstreamPort: number;
  upstreamProtocol?: string;
  username?: string;
  password?: string;
  profileId: string;
}

export interface ProxyTunnelHandle {
  port: number;
  close: () => void;
}

/**
 * Fast connectivity check to upstream proxy.
 * Returns latency ms or throws on timeout/error.
 */
export function checkUpstreamReachability(
  host: string,
  port: number,
  protocol = 'http',
  timeoutMs = 7000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        try { socket.destroy(); } catch {}
        reject(new Error(`Proxy ${host}:${port} did not respond within ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    const onConnected = () => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        try { socket.destroy(); } catch {}
        resolve(latency);
      }
    };

    let socket: net.Socket;
    if (protocol === 'https') {
      socket = tls.connect({
        host,
        port,
        rejectUnauthorized: false,
        servername: host,
      }, onConnected);
    } else {
      socket = net.connect(port, host, onConnected);
    }

    socket.on('error', (err) => {
      if (!isDone) {
        isDone = true;
        clearTimeout(timer);
        try { socket.destroy(); } catch {}
        reject(new Error(`Cannot connect to proxy ${host}:${port} — ${err.message}`));
      }
    });
  });
}

/**
 * Creates a zero-latency local forward proxy tunnel on 127.0.0.1
 * that automatically injects Proxy-Authorization credentials to the upstream proxy.
 *
 * Architecture:
 *   Chrome → http://127.0.0.1:${localPort} → upstream proxy (with auth headers) → target website
 *
 * This completely eliminates the native Chromium Sign-in popup with 100% reliability
 * while ensuring HTTPS CONNECT tunnels to Google / websites work with maximum throughput.
 */
export async function createProxyTunnel(options: ProxyTunnelOptions): Promise<ProxyTunnelHandle> {
  const { upstreamHost, upstreamPort, upstreamProtocol = 'http', username, password, profileId } = options;
  const protoLower = upstreamProtocol.toLowerCase();
  const isHttpsUpstream = protoLower === 'https';
  const isSocksUpstream = protoLower === 'socks5' || protoLower === 'socks4';

  const authHeader = username && password
    ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    : null;

  debugLog(`[ProxyTunnel] Initializing authenticating tunnel for profile "${profileId}" -> ${upstreamProtocol}://${upstreamHost}:${upstreamPort}`);

  const activeSockets = new Set<stream.Duplex | net.Socket>();
  const SOCKET_TIMEOUT = 25000;

  const createUpstreamConnection = (onConnect: () => void): net.Socket => {
    if (isHttpsUpstream) {
      const tlsOpts: tls.ConnectionOptions = {
        host: upstreamHost,
        port: upstreamPort,
        rejectUnauthorized: false,
      };
      if (!net.isIP(upstreamHost)) {
        tlsOpts.servername = upstreamHost;
      }
      return tls.connect(tlsOpts, onConnect);
    } else {
      return net.connect(upstreamPort, upstreamHost, onConnect);
    }
  };

  const server = http.createServer((clientReq, clientRes) => {
    if (isSocksUpstream) {
      void forwardHttpRequestOverSocks5({
        clientReq,
        clientRes,
        proxyHost: upstreamHost,
        proxyPort: upstreamPort,
        username,
        password,
        socketTimeoutMs: SOCKET_TIMEOUT,
        log: debugLog,
      });
      return;
    }

    // Plain HTTP Request Forwarding
    const headers = { ...clientReq.headers };
    if (authHeader) {
      headers['proxy-authorization'] = authHeader;
    }

    const proxyReq = http.request({
      host: upstreamHost,
      port: upstreamPort,
      method: clientReq.method,
      path: clientReq.url,
      headers,
      timeout: SOCKET_TIMEOUT,
    }, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (err) => {
      debugLog(`[ProxyTunnel HTTP ERROR] ${err.message}`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end('Proxy Tunnel Error: ' + err.message);
      }
    });

    clientReq.pipe(proxyReq);
  });

  // HTTPS CONNECT Tunnel Handling
  server.on('connect', (req, clientSocket: stream.Duplex, head) => {
    activeSockets.add(clientSocket);
    if ('setTimeout' in clientSocket && typeof (clientSocket as any).setTimeout === 'function') {
      (clientSocket as any).setTimeout(SOCKET_TIMEOUT);
    }

    if (isSocksUpstream) {
      void bridgeConnectOverSocks5({
        reqUrl: req.url || '',
        clientSocket,
        head,
        proxyHost: upstreamHost,
        proxyPort: upstreamPort,
        username,
        password,
        activeSockets,
        socketTimeoutMs: SOCKET_TIMEOUT,
        log: debugLog,
      });
      return;
    }

    let isEstablished = false;
    let upstreamSocket: net.Socket;

    const cleanupSockets = (reason?: string) => {
      if (reason) debugLog(`[ProxyTunnel CONNECT] Cleanup (${reason})`);
      activeSockets.delete(clientSocket);
      if (upstreamSocket) activeSockets.delete(upstreamSocket);
      try { clientSocket.destroy(); } catch {}
      if (upstreamSocket) {
        try { upstreamSocket.destroy(); } catch {}
      }
    };

    upstreamSocket = createUpstreamConnection(() => {
      activeSockets.add(upstreamSocket);
      upstreamSocket.setTimeout(SOCKET_TIMEOUT);

      // Build CONNECT request to upstream proxy with Proxy-Authorization
      let connectReq = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n`;
      if (authHeader) {
        connectReq += `Proxy-Authorization: ${authHeader}\r\n`;
      }
      connectReq += `User-Agent: Mozilla/5.0\r\nProxy-Connection: Keep-Alive\r\n\r\n`;

      upstreamSocket.write(connectReq);

      let headerBuffer = '';
      const onUpstreamData = (chunk: Buffer) => {
        if (isEstablished) {
          clientSocket.write(chunk);
          return;
        }

        headerBuffer += chunk.toString('utf-8');
        const endOfHeaders = headerBuffer.indexOf('\r\n\r\n') !== -1
          ? headerBuffer.indexOf('\r\n\r\n')
          : headerBuffer.indexOf('\n\n');

        if (endOfHeaders !== -1) {
          const delimiterLength = headerBuffer.indexOf('\r\n\r\n') !== -1 ? 4 : 2;
          isEstablished = true;
          upstreamSocket.removeListener('data', onUpstreamData);

          const statusLine = headerBuffer.split('\r\n')[0] || headerBuffer.split('\n')[0] || '';

          if (statusLine.includes('200')) {
            // Tell Chrome the tunnel is ready
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

            // Send any remaining bytes received from upstream
            const remaining = chunk.subarray(Buffer.byteLength(headerBuffer.slice(0, endOfHeaders + delimiterLength), 'utf-8'));
            if (remaining.length > 0) {
              clientSocket.write(remaining);
            }

            // Forward initial head data from Chrome if any
            if (head && head.length > 0) {
              upstreamSocket.write(head);
            }

            // Transparent full-duplex stream
            clientSocket.pipe(upstreamSocket);
            upstreamSocket.pipe(clientSocket);
          } else {
            debugLog(`[ProxyTunnel] Upstream rejected CONNECT with: ${statusLine}`);
            clientSocket.write(`HTTP/1.1 502 Bad Gateway\r\n\r\nProxy CONNECT Rejected: ${statusLine}`);
            cleanupSockets(`Upstream rejected CONNECT: ${statusLine}`);
          }
        }
      };

      upstreamSocket.on('data', onUpstreamData);
    });

    upstreamSocket.on('error', (err) => {
      debugLog(`[ProxyTunnel CONNECT Upstream ERROR] ${err.message}`);
      try {
        clientSocket.write(`HTTP/1.1 502 Bad Gateway\r\n\r\nProxy Error: ${err.message}`);
      } catch {}
      cleanupSockets(err.message);
    });

    upstreamSocket.on('timeout', () => {
      cleanupSockets('Upstream socket timeout');
    });

    clientSocket.on('error', (err) => cleanupSockets(`Client error: ${err.message}`));
    clientSocket.on('close', () => cleanupSockets());
    clientSocket.on('timeout', () => cleanupSockets('Client socket timeout'));
  });

  // Start local server on a free port bound to localhost only
  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      } else {
        reject(new Error('Could not bind proxy tunnel to 127.0.0.1'));
      }
    });
    server.on('error', reject);
  });

  debugLog(`[ProxyTunnel] Local Authenticating Proxy active on http://127.0.0.1:${port} -> ${upstreamProtocol}://${upstreamHost}:${upstreamPort}`);

  return {
    port,
    close: () => {
      debugLog(`[ProxyTunnel] Shutting down tunnel on port ${port} for profile "${profileId}"...`);
      for (const s of activeSockets) {
        try { s.destroy(); } catch {}
      }
      activeSockets.clear();
      server.close();
    },
  };
}
