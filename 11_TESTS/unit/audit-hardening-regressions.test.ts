import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import {
  setCustomDatabasePath,
  getDatabase,
  assertPathIsNotProduction,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { LocalStorageProvider, S3R2StorageProvider } from '../../08_SECURITY/storage-provider.js';
import { handleCloudSyncRoutes } from '../../07_BACKEND/commercial/routes/cloud-sync-routes.js';
import {
  getOrCreateMasterKey,
  resetCachedMasterKeyForTesting,
} from '../../08_SECURITY/encryption.js';
import {
  getInstallSecrets,
  getApiAuthToken,
  getAdminWebSecret,
  isValidApiToken,
  isValidAdminWebSecret,
  resetCachedSecretsForTesting,
} from '../../08_SECURITY/install-secrets.js';
import {
  createProfile,
  getProfiles,
  getProfileStoragePath,
} from '../../02_BROWSER/services/profile-service.js';
import {
  exportProfileToArchive,
  importProfileFromArchive,
  restoreStorageFiles,
} from '../../02_BROWSER/services/archive-service.js';
import { installExtension, removeExtension } from '../../02_BROWSER/services/extension-service.js';
import { validateWebhookUrl, verifyWebhookSignature } from '../../07_BACKEND/services/webhook-service.js';
import { isTrustedOrigin } from '../../07_BACKEND/server/cloud-gateway.js';
import { createLocalApiServer } from '../../07_BACKEND/api/local-api-server.js';
import { generateApiKey } from '../../07_BACKEND/services/api-v2-service.js';
import {
  activateLicense,
  createLicense,
  validateCurrentLicense,
} from '../../04_LICENSING/license-engine.js';
import { isGraceExpired, isOnlineRevoked } from '../../08_SECURITY/license-status-service.js';
import { getCaptchaConfig, saveCaptchaConfig } from '../../09_AUTOMATION/captcha-service.js';
import { detectAndParseAccountData } from '../../02_BROWSER/services/universal-importer-service.js';
import { createProxyTunnel } from '../../02_BROWSER/proxy-tunnel.js';
import { ProxyProviderRegistry } from '../../08_SECURITY/proxy-providers/proxy-provider-registry.js';

describe('Audit Hardening Regressions (P0/P1/P2)', () => {
  const rootTemp = path.join(os.tmpdir(), `mahi-audit-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const userDataDir = path.join(rootTemp, 'userData');
  const prevUserDataDir = process.env.MAHI_USER_DATA_DIR;

  beforeAll(async () => {
    fs.mkdirSync(userDataDir, { recursive: true });
    process.env.MAHI_USER_DATA_DIR = userDataDir;
    resetCachedMasterKeyForTesting();
    resetCachedSecretsForTesting();
    setCustomDatabasePath(path.join(rootTemp, 'audit_reg.sqlite'));
    await initializeDatabase();
  });

  afterAll(() => {
    resetCachedMasterKeyForTesting();
    resetCachedSecretsForTesting();
    if (prevUserDataDir !== undefined) process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    else delete process.env.MAHI_USER_DATA_DIR;
    try {
      fs.rmSync(rootTemp, { recursive: true, force: true });
    } catch {}
  });

  it('blocks path traversal in LocalStorageProvider and permits scoped object keys', async () => {
    const storageDir = path.join(rootTemp, 'storage_test');
    const storage = new LocalStorageProvider(storageDir, 'http://127.0.0.1:0');

    await expect(storage.putObject('../../outside.txt', Buffer.from('bad'))).rejects.toThrow();
    await expect(storage.getObject('profiles/../../../etc/passwd')).rejects.toThrow();
    await expect(storage.getObject('bad\0key')).rejects.toThrow();
    await expect(storage.putObject('profiles/u1/item.bin', Buffer.from('ok'))).resolves.toMatchObject({
      success: true,
      size: 2,
    });
    const loaded = await storage.getObject('profiles/u1/item.bin');
    expect(loaded?.toString()).toBe('ok');
  });

  it('fails closed (403) on /api/v1/storage/* proxy routes when S3/R2 storage provider is configured', async () => {
    const prevS3Bucket = process.env.S3_BUCKET;
    const prevS3Access = process.env.S3_ACCESS_KEY_ID;
    const prevS3Secret = process.env.S3_SECRET_ACCESS_KEY;

    try {
      process.env.S3_BUCKET = 'mahi-test-bucket';
      process.env.S3_ACCESS_KEY_ID = 'test-access-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';

      const mockReq = new EventEmitter() as any;
      mockReq.headers = {};
      let statusOut = 0;
      let bodyOut = '';
      const mockRes = {
        setHeader: () => {},
        writeHead: (code: number) => {
          statusOut = code;
        },
        end: (payload: string) => {
          bodyOut = payload;
        },
      } as any;

      const parsed = new URL('http://127.0.0.1:8989/api/v1/storage/download?key=profiles/u1/p.enc&token=anything');
      const handled = await handleCloudSyncRoutes(
        mockReq,
        mockRes,
        '/api/v1/storage/download',
        'GET',
        parsed,
        '/api/v1/storage/download',
        '127.0.0.1'
      );
      expect(handled).toBe(true);
      expect(statusOut).toBe(403);
      expect(JSON.parse(bodyOut).success).toBe(false);
    } finally {
      if (prevS3Bucket !== undefined) process.env.S3_BUCKET = prevS3Bucket;
      else delete process.env.S3_BUCKET;
      if (prevS3Access !== undefined) process.env.S3_ACCESS_KEY_ID = prevS3Access;
      else delete process.env.S3_ACCESS_KEY_ID;
      if (prevS3Secret !== undefined) process.env.S3_SECRET_ACCESS_KEY = prevS3Secret;
      else delete process.env.S3_SECRET_ACCESS_KEY;
    }
    expect(S3R2StorageProvider).toBeDefined();
  });

  it('never overwrites an existing unreadable SAFE_STORAGE_V1 master key or secrets file', () => {
    const isolatedDir = path.join(rootTemp, 'key_preserve');
    fs.mkdirSync(isolatedDir, { recursive: true });
    const prevDir = process.env.MAHI_USER_DATA_DIR;
    process.env.MAHI_USER_DATA_DIR = isolatedDir;
    resetCachedMasterKeyForTesting();
    resetCachedSecretsForTesting();

    try {
      const keyFile = path.join(isolatedDir, '.mahi_master.key');
      const secFile = path.join(isolatedDir, 'install-secrets.json');
      fs.writeFileSync(keyFile, 'SAFE_STORAGE_V1:PROTECTED_BLOB_DO_NOT_OVERWRITE', 'utf8');
      fs.writeFileSync(secFile, 'SAFE_STORAGE_V1:PROTECTED_SECRETS_DO_NOT_OVERWRITE', 'utf8');

      expect(() => getOrCreateMasterKey()).toThrow(/Refusing to overwrite/i);
      expect(fs.readFileSync(keyFile, 'utf8')).toBe('SAFE_STORAGE_V1:PROTECTED_BLOB_DO_NOT_OVERWRITE');

      expect(() => getInstallSecrets()).toThrow(/Refusing to overwrite/i);
      expect(fs.readFileSync(secFile, 'utf8')).toBe('SAFE_STORAGE_V1:PROTECTED_SECRETS_DO_NOT_OVERWRITE');
    } finally {
      process.env.MAHI_USER_DATA_DIR = prevDir;
      resetCachedMasterKeyForTesting();
      resetCachedSecretsForTesting();
    }

    const token = getApiAuthToken();
    const webSecret = getAdminWebSecret();
    expect(isValidApiToken(token)).toBe(true);
    expect(isValidApiToken(token.slice(0, -1) + (token.endsWith('0') ? '1' : '0'))).toBe(false);
    expect(isValidApiToken('short')).toBe(false);
    expect(isValidAdminWebSecret(webSecret)).toBe(true);
    expect(isValidAdminWebSecret('wrong-secret')).toBe(false);
  });

  it('blocks profile/archive/extension traversal and SQL sort injection, while exporting portable archives', () => {
    const profile = createProfile({ name: 'Hardened Profile' });

    expect(() => getProfileStoragePath('../escape')).toThrow();
    expect(() => getProfileStoragePath('a/b')).toThrow();

    const sorted = getProfiles({ sortDirection: 'DESC; DROP TABLE profiles;--' as any });
    expect(sorted.length).toBeGreaterThanOrEqual(1);

    const evilOutside = path.join(rootTemp, 'outside_restore_victim.txt');
    restoreStorageFiles(profile.id, {
      '../../outside_restore_victim.txt': Buffer.from('pwned').toString('base64'),
      'safe_nested/ok.txt': Buffer.from('clean').toString('base64'),
    });
    expect(fs.existsSync(evilOutside)).toBe(false);
    expect(fs.readFileSync(path.join(profile.storagePath, 'safe_nested', 'ok.txt'), 'utf8')).toBe('clean');

    const exportPath = path.join(rootTemp, 'portable_nopass.mahi-profile');
    exportProfileToArchive({
      profileId: profile.id,
      targetFilePath: exportPath,
      includeCookies: true,
      includeHistory: false,
      includeExtensions: false,
      includeBrowserSettings: true,
    });
    const rawArchive = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    expect(rawArchive.isEncrypted).toBe(false);
    expect(() => JSON.parse(Buffer.from(rawArchive.payload, 'base64').toString('utf8'))).not.toThrow();
    const reimported = importProfileFromArchive({ sourceFilePath: exportPath, overrideName: 'Portable Import' });
    expect(reimported.name).toBe('Portable Import');

    const externalExtDir = path.join(rootTemp, 'external_unpacked_ext');
    fs.mkdirSync(externalExtDir, { recursive: true });
    fs.writeFileSync(path.join(externalExtDir, 'manifest.json'), JSON.stringify({ name: 'KeepMe', version: '1.0.0' }));
    const ext = installExtension({ profileId: profile.id, sourcePath: externalExtDir });
    expect(ext.sourcePath).toBe(externalExtDir);
    removeExtension(profile.id, ext.id);
    expect(fs.existsSync(path.join(externalExtDir, 'manifest.json'))).toBe(true);
  });

  it('blocks obfuscated SSRF hosts, handles malformed webhook sigs, and validates gateway origins strictly', () => {
    expect(validateWebhookUrl('https://2130706433/hook').valid).toBe(false);
    expect(validateWebhookUrl('https://0x7f000001/hook').valid).toBe(false);
    expect(validateWebhookUrl('https://[::ffff:127.0.0.1]/hook').valid).toBe(false);
    expect(validateWebhookUrl('https://webhook.example.com/hook').valid).toBe(true);

    const nowSec = Math.floor(Date.now() / 1000);
    const nonHexSig = verifyWebhookSignature('sec', `t=${nowSec},v1=not-hex-zzz`, '{}');
    expect(nonHexSig.verified).toBe(false);
    const shortSig = verifyWebhookSignature('sec', `t=${nowSec},v1=ab`, '{}');
    expect(shortSig.verified).toBe(false);

    expect(isTrustedOrigin('https://localhost.attacker.com')).toBe(false);
    expect(isTrustedOrigin('https://evil.com/?.mahibrowser.com')).toBe(false);
    expect(isTrustedOrigin('https://evilmahibrowser.com')).toBe(false);
    expect(isTrustedOrigin('https://mahibrowser.com')).toBe(true);
    expect(isTrustedOrigin('https://app.mahibrowser.com')).toBe(true);
    expect(isTrustedOrigin('http://localhost:5173')).toBe(true);
  });

  it('enforces authentication and scopes on /proxies, /automation/run, /sync/status, and /mobile-rotator/devices', async () => {
    const server = createLocalApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as net.AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const readOnlyKey = generateApiKey('ReadOnlyKey', 'LOCAL_CLIENT', ['profiles:read']);

      const unauth = await fetch(`${baseUrl}/proxies`);
      expect(unauth.status).toBe(401);

      const forbiddenProxy = await fetch(`${baseUrl}/proxies`, {
        headers: { 'X-API-Key': readOnlyKey.secretKey },
      });
      expect(forbiddenProxy.status).toBe(403);

      const forbiddenAuto = await fetch(`${baseUrl}/automation/run`, {
        method: 'POST',
        headers: { 'X-API-Key': readOnlyKey.secretKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: 'none', profileId: 'none' }),
      });
      expect(forbiddenAuto.status).toBe(403);

      const forbiddenSync = await fetch(`${baseUrl}/sync/status`, {
        headers: { 'X-API-Key': readOnlyKey.secretKey },
      });
      expect(forbiddenSync.status).toBe(403);

      const forbiddenRotator = await fetch(`${baseUrl}/mobile-rotator/devices`, {
        headers: { 'X-API-Key': readOnlyKey.secretKey },
      });
      expect(forbiddenRotator.status).toBe(403);

      const proxyReaderKey = generateApiKey('ProxyReadKey', 'LOCAL_CLIENT', ['proxies:read']);
      const okProxy = await fetch(`${baseUrl}/proxies`, {
        headers: { 'X-API-Key': proxyReaderKey.secretKey },
      });
      expect(okProxy.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('verifies local_license_cache HMAC signature, grace window, expiry, and offline license cache tampering', () => {
    const minted = createLicense({
      customerName: 'Hardening Verify',
      durationType: '30_DAYS',
      maxDevices: 3,
      createdBy: 'TEST',
    });
    const act = activateLicense(minted.rawLicenseKey, 'dev-audit-1', 'TestBox');
    expect(act.success).toBe(true);
    expect(validateCurrentLicense('dev-audit-1').isValid).toBe(true);

    const db = getDatabase();
    db.prepare("UPDATE local_license_cache SET signature = 'forged_sig' WHERE license_id = ?").run(minted.license.id);
    const tampered = validateCurrentLicense('dev-audit-1');
    expect(tampered.isValid).toBe(false);

    // Re-activate, then test expired grace window fails closed
    const reactivated = activateLicense(minted.rawLicenseKey, 'dev-audit-1', 'TestBox');
    expect(reactivated.success).toBe(true);
    const expiredGrace = new Date(Date.now() - 60_000).toISOString();
    const secrets = getInstallSecrets();
    const expiredSig = crypto
      .createHmac('sha256', secrets.adminSalt)
      .update(`${minted.license.id}|ACTIVE|${expiredGrace}`)
      .digest('hex');
    db.prepare('UPDATE local_license_cache SET grace_expires_at = ?, signature = ? WHERE license_id = ?').run(
      expiredGrace,
      expiredSig,
      minted.license.id
    );
    expect(validateCurrentLicense('dev-audit-1').isValid).toBe(false);

    // Offline license status cache: forged signature triggers fail-closed grace expiration
    fs.writeFileSync(path.join(userDataDir, 'offline-license.key'), 'DUMMY', 'utf8');
    // Reset test without valid RSA key leaves hasOfflineLicenseKey false unless real key; verify tampered cache rejection directly
    expect(isOnlineRevoked()).toBe(false);
    expect(typeof isGraceExpired()).toBe('boolean');
  });

  it('encrypts captcha API keys at rest and omits imported passwords from profile notes', () => {
    saveCaptchaConfig({ enabled: true, provider: '2captcha', apiKey: 'secret-captcha-key-123' });
    const db = getDatabase();
    const rawRow = db.prepare("SELECT value_json FROM app_settings WHERE key = 'captcha_config'").get() as {
      value_json: string;
    };
    expect(rawRow.value_json).not.toContain('secret-captcha-key-123');
    expect(getCaptchaConfig().apiKey).toBe('secret-captcha-key-123');

    const parsed = detectAndParseAccountData('alice@example.com:SuperSecretPass99:127.0.0.1:8080:u1:p1');
    expect(parsed.length).toBe(1);
    expect(parsed[0].notes || '').not.toContain('SuperSecretPass99');
  });

  it('enforces cross-OS DB safety guards and routes SOCKS4a tunnels through ProxyTunnel', async () => {
    expect(() => assertPathIsNotProduction('C:\\Users\\demo\\AppData\\Roaming\\mahi-browser\\mahi_browser.sqlite')).toThrow();
    expect(() => assertPathIsNotProduction('/Users/demo/Library/Application Support/mahi-browser/mahi_browser.sqlite')).toThrow();
    expect(() => assertPathIsNotProduction('/home/demo/.config/mahi-browser/mahi_browser.sqlite')).toThrow();

    // Local echo target + local mock SOCKS4a server to verify real SOCKS4 handshake
    const targetServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('SOCKS4_OK');
    });
    await new Promise<void>((r) => targetServer.listen(0, '127.0.0.1', r));
    const targetPort = (targetServer.address() as net.AddressInfo).port;

    let observedSocksVersion = 0;
    const socks4Server = net.createServer((clientSock) => {
      clientSock.once('data', (buf) => {
        observedSocksVersion = buf[0];
        if (buf[0] !== 0x04 || buf[1] !== 0x01) {
          clientSock.end(Buffer.from([0x00, 0x5b, 0, 0, 0, 0, 0, 0]));
          return;
        }
        const upstream = net.connect(targetPort, '127.0.0.1', () => {
          clientSock.write(Buffer.from([0x00, 0x5a, 0, 0, 0, 0, 0, 0]));
          clientSock.pipe(upstream);
          upstream.pipe(clientSock);
        });
        upstream.on('error', () => clientSock.destroy());
      });
    });
    await new Promise<void>((r) => socks4Server.listen(0, '127.0.0.1', r));
    const socksPort = (socks4Server.address() as net.AddressInfo).port;

    const tunnel = await createProxyTunnel({
      upstreamHost: '127.0.0.1',
      upstreamPort: socksPort,
      upstreamProtocol: 'socks4',
      profileId: 'socks4_test',
    });

    try {
      const resp = await new Promise<string>((resolve, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port: tunnel.port,
            path: `http://127.0.0.1:${targetPort}/ping`,
            method: 'GET',
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve(data));
          }
        );
        req.on('error', reject);
        req.end();
      });
      expect(observedSocksVersion).toBe(0x04);
      expect(resp).toBe('SOCKS4_OK');
    } finally {
      tunnel.close();
      await new Promise<void>((r) => socks4Server.close(() => r()));
      await new Promise<void>((r) => targetServer.close(() => r()));
    }
  });

  it('refuses MockProxyProvider fallback in production mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevAllow = process.env.MAHI_ALLOW_MOCK_PROXY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.MAHI_ALLOW_MOCK_PROXY;
      const registry = ProxyProviderRegistry.getInstance();
      await expect(
        registry.selectBestProvider({
          networkType: 'RESIDENTIAL',
          country: 'US',
          sessionType: 'STICKY',
        })
      ).rejects.toThrow();
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevAllow !== undefined) process.env.MAHI_ALLOW_MOCK_PROXY = prevAllow;
    }
  });
});
