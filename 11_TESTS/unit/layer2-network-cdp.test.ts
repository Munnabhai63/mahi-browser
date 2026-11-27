import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createProxyTunnel } from '../../02_BROWSER/proxy-tunnel.js';
import { buildSocks5TargetAddress } from '../../02_BROWSER/socks-tunnel.js';
import { testProxy } from '../../02_BROWSER/services/proxy-test-service.js';
import {
  allocateEphemeralDebugPort,
  buildSanitizedLaunchArgs,
} from '../../02_BROWSER/launcher.js';
import { DEFAULT_APP_SETTINGS } from '../../10_CONFIG/shared/constants/defaults.js';

interface MockSocks5Server {
  port: number;
  observedAuth: Array<{ username: string; password: string }>;
  observedConnectTargets: Array<{ host: string; port: number }>;
  close: () => Promise<void>;
}

async function startMockSocks5Server(opts: {
  expectedUser: string;
  expectedPass: string;
  rejectAuth?: boolean;
}): Promise<MockSocks5Server> {
  const observedAuth: Array<{ username: string; password: string }> = [];
  const observedConnectTargets: Array<{ host: string; port: number }> = [];
  const activeSockets = new Set<net.Socket>();

  // Local HTTP target behind the mock SOCKS5 server
  const backendServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: req.url, via: 'mock-socks5' }));
  });
  await new Promise<void>((r) => backendServer.listen(0, '127.0.0.1', () => r()));
  const backendPort = (backendServer.address() as net.AddressInfo).port;

  const socksServer = net.createServer((client) => {
    activeSockets.add(client);
    client.on('close', () => activeSockets.delete(client));

    let state: 'GREETING' | 'AUTH' | 'CONNECT' | 'RELAY' = 'GREETING';
    let upstream: net.Socket | null = null;

    client.on('data', (chunk) => {
      if (state === 'RELAY' && upstream) {
        upstream.write(chunk);
        return;
      }

      if (state === 'GREETING') {
        // Expect 0x05 + nmethods + methods containing 0x02 (username/password)
        if (chunk[0] !== 0x05) {
          client.destroy();
          return;
        }
        const methods = Array.from(chunk.subarray(2, 2 + chunk[1]));
        if (methods.includes(0x02)) {
          state = 'AUTH';
          client.write(Buffer.from([0x05, 0x02]));
        } else {
          client.write(Buffer.from([0x05, 0xff]));
          client.end();
        }
        return;
      }

      if (state === 'AUTH') {
        const uLen = chunk[1];
        const username = chunk.subarray(2, 2 + uLen).toString('utf8');
        const pLen = chunk[2 + uLen];
        const password = chunk.subarray(3 + uLen, 3 + uLen + pLen).toString('utf8');
        observedAuth.push({ username, password });

        if (opts.rejectAuth || username !== opts.expectedUser || password !== opts.expectedPass) {
          client.write(Buffer.from([0x01, 0x01]));
          client.end();
          return;
        }
        state = 'CONNECT';
        client.write(Buffer.from([0x05, 0x00]));
        return;
      }

      if (state === 'CONNECT') {
        const atyp = chunk[3];
        let targetHost = '';
        let portOffset = 0;
        if (atyp === 0x01) {
          targetHost = `${chunk[4]}.${chunk[5]}.${chunk[6]}.${chunk[7]}`;
          portOffset = 8;
        } else if (atyp === 0x03) {
          const dLen = chunk[4];
          targetHost = chunk.subarray(5, 5 + dLen).toString('utf8');
          portOffset = 5 + dLen;
        }
        const targetPort = chunk.readUInt16BE(portOffset);
        observedConnectTargets.push({ host: targetHost, port: targetPort });

        const connectPort = targetHost === 'api.ipify.org' ? backendPort : targetPort;
        upstream = net.connect(connectPort, '127.0.0.1', () => {
          state = 'RELAY';
          client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
          upstream!.pipe(client);
        });
        upstream.on('error', () => {
          try {
            client.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            client.end();
          } catch {}
        });
      }
    });
  });

  await new Promise<void>((r) => socksServer.listen(0, '127.0.0.1', () => r()));
  const socksPort = (socksServer.address() as net.AddressInfo).port;

  return {
    port: socksPort,
    observedAuth,
    observedConnectTargets,
    close: async () => {
      for (const s of activeSockets) {
        try { s.destroy(); } catch {}
      }
      await new Promise<void>((r) => socksServer.close(() => r()));
      await new Promise<void>((r) => backendServer.close(() => r()));
    },
  };
}

describe('Layer 2: SOCKS5 Authenticated Tunnel & CDP Debug Port Hardening', () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop()!;
      await fn();
    }
  });

  it('Task 2.1: Routes authenticated SOCKS5 HTTP and CONNECT traffic through createProxyTunnel with RFC 1929 auth and remote ATYP=0x03 DNS', async () => {
    const mockSocks = await startMockSocks5Server({
      expectedUser: 'mahi_user',
      expectedPass: 'mahi_pass_123',
    });
    cleanups.push(() => mockSocks.close());

    // Standalone echo target reachable via SOCKS5 CONNECT
    const targetServer = net.createServer((sock) => {
      sock.once('data', (d) => sock.end(`ECHO:${d.toString('utf8')}`));
    });
    await new Promise<void>((r) => targetServer.listen(0, '127.0.0.1', () => r()));
    cleanups.push(() => new Promise<void>((r) => targetServer.close(() => r())));
    const targetPort = (targetServer.address() as net.AddressInfo).port;

    const tunnel = await createProxyTunnel({
      upstreamHost: '127.0.0.1',
      upstreamPort: mockSocks.port,
      upstreamProtocol: 'socks5',
      username: 'mahi_user',
      password: 'mahi_pass_123',
      profileId: 'prof-socks5-test',
    });
    cleanups.push(() => tunnel.close());

    // Exercise HTTP CONNECT over the local tunnel (Chrome HTTPS flow)
    const response = await new Promise<string>((resolve, reject) => {
      const sock = net.connect(tunnel.port, '127.0.0.1', () => {
        sock.write(`CONNECT 127.0.0.1:${targetPort} HTTP/1.1\r\nHost: 127.0.0.1:${targetPort}\r\n\r\n`);
      });
      let acc = '';
      let upgraded = false;
      sock.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        if (!upgraded && text.includes('200 Connection Established')) {
          upgraded = true;
          sock.write('PING_SOCKS5');
          return;
        }
        if (upgraded) acc += text;
      });
      sock.on('end', () => resolve(acc));
      sock.on('error', reject);
    });

    expect(response).toBe('ECHO:PING_SOCKS5');
    expect(mockSocks.observedAuth).toEqual([{ username: 'mahi_user', password: 'mahi_pass_123' }]);
    expect(mockSocks.observedConnectTargets).toContainEqual({ host: '127.0.0.1', port: targetPort });

    // Domain encoding must use ATYP=0x03 so proxy handles DNS (no local DNS leak)
    const domainFrame = buildSocks5TargetAddress('example.com', 443);
    expect(domainFrame[0]).toBe(0x03);
    expect(domainFrame[1]).toBe('example.com'.length);
    expect(domainFrame.readUInt16BE(domainFrame.length - 2)).toBe(443);
  });

  it('Task 2.1: Rejects bad SOCKS5 credentials accurately in testProxy', async () => {
    const mockSocks = await startMockSocks5Server({
      expectedUser: 'good',
      expectedPass: 'pass',
    });
    cleanups.push(() => mockSocks.close());

    const badRes = await testProxy(
      {
        host: '127.0.0.1',
        port: mockSocks.port,
        protocol: 'socks5',
        username: 'good',
        password: 'wrong',
      },
      { allowPrivateTargets: true }
    );
    expect(badRes.success).toBe(false);
    expect(badRes.errorCode).toBe('AUTHENTICATION_FAILED');
  });

  it('Task 2.2: Normal mode omits --remote-debugging-port by default, whereas automation / allowCdpDebugPort opens ephemeral loopback CDP port', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer2-cdp-'));
    cleanups.push(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    });

    expect(DEFAULT_APP_SETTINGS.security.allowCdpDebugPort).toBe(false);

    const normalArgs = buildSanitizedLaunchArgs({
      storageDir: tmpDir,
      debugPort: 36000,
      mode: 'normal',
      allowCdpDebugPort: false,
    });
    expect(normalArgs.some((a) => a.startsWith('--remote-debugging-port='))).toBe(false);

    const optInPort = await allocateEphemeralDebugPort();
    expect(optInPort).toBeGreaterThan(1024);

    const optInArgs = buildSanitizedLaunchArgs({
      storageDir: tmpDir,
      debugPort: optInPort,
      mode: 'normal',
      allowCdpDebugPort: true,
    });
    expect(optInArgs).toContain(`--remote-debugging-port=${optInPort}`);
    expect(optInArgs).toContain('--remote-debugging-address=127.0.0.1');

    const autoArgs = buildSanitizedLaunchArgs({
      storageDir: tmpDir,
      debugPort: optInPort,
      mode: 'automation',
    });
    expect(autoArgs).toContain(`--remote-debugging-port=${optInPort}`);
    expect(autoArgs).toContain('--remote-debugging-address=127.0.0.1');
  });
});
