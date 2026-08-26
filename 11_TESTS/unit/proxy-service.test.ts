import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProxy,
  getProxies,
  getProxyById,
  updateProxy,
  deleteProxy,
  getDecryptedProxyCredentials,
  testProxyConnection,
} from '../../02_BROWSER/services/proxy-service.js';

describe('Proxy Service & Credential Encryption', () => {
  beforeAll(async () => {
    const testDbDir = path.join(process.cwd(), '.test_data');
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    setCustomDatabasePath(path.join(testDbDir, `test_mahi_proxies_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`));
    await initializeDatabase();
  });

  it('should create a proxy and store its password encrypted at rest', () => {
    const proxy = createProxy({
      name: 'US East Residential',
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080,
      username: 'agent_user',
      password: 'MySecretPassword99#',
      countryRegion: 'United States',
    });

    expect(proxy).toBeDefined();
    expect(proxy.id).toBeDefined();
    expect(proxy.name).toBe('US East Residential');
    expect(proxy.hasPassword).toBe(true);
    expect(proxy.password).toBeUndefined(); // Never returned plain in ProxyItem

    // Check decrypted credentials
    const creds = getDecryptedProxyCredentials(proxy.id);
    expect(creds?.username).toBe('agent_user');
    expect(creds?.password).toBe('MySecretPassword99#');
  });

  it('should update proxy configuration and re-encrypt new password', () => {
    const all = getProxies();
    const target = all[0];

    const updated = updateProxy(target.id, {
      name: 'US East Residential (Updated)',
      port: 9090,
      password: 'NewChangedSecretPass!',
    });

    expect(updated.name).toBe('US East Residential (Updated)');
    expect(updated.port).toBe(9090);

    const creds = getDecryptedProxyCredentials(target.id);
    expect(creds?.password).toBe('NewChangedSecretPass!');
  });

  it('should perform TCP latency check', async () => {
    // Test loopback connection or failure handling
    const result = await testProxyConnection({
      host: '127.0.0.1',
      port: 65534, // Unlikely to be listening
    });

    expect(result).toBeDefined();
    expect(typeof result.latencyMs).toBe('number');
  });

  it('should delete a proxy', () => {
    const proxy = createProxy({
      name: 'Temp Proxy',
      protocol: 'socks5',
      host: '10.0.0.1',
      port: 1080,
    });

    const deleted = deleteProxy(proxy.id);
    expect(deleted).toBe(true);
    expect(getProxyById(proxy.id)).toBeNull();
  });
});
