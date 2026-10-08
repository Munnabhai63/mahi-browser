import { describe, it, expect, beforeAll } from 'vitest';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  checkPublicIp,
  getConnectedAdbDevices,
  getRotatorConfig,
  saveRotatorConfig,
  rotateViaWebhook,
} from '../../03_HARDWARE/mobile-rotator-service.js';

describe('Phase 5: Mobile 4G/5G Hotspot IP Rotator Engine', () => {
  beforeAll(async () => {
    await initSqlEngine();
    await initializeDatabase();
  });

  it('should query public IP and return structured IP info', async () => {
    const ipInfo = await checkPublicIp();
    expect(ipInfo).toBeDefined();
    expect(typeof ipInfo.ip).toBe('string');
    expect(ipInfo.ip.length).toBeGreaterThan(0);
  });

  it('should save and retrieve mobile rotator configuration from database', () => {
    const initialConfig = getRotatorConfig();
    expect(initialConfig).toBeDefined();
    expect(initialConfig.airplaneDelayMs).toBeGreaterThanOrEqual(1000);

    const updated = saveRotatorConfig({
      method: 'webhook',
      webhookUrl: 'https://api.iproxy.online/rotate/test-token',
      airplaneDelayMs: 3000,
      autoRotateOnProfileStart: true,
    });

    expect(updated.method).toBe('webhook');
    expect(updated.webhookUrl).toBe('https://api.iproxy.online/rotate/test-token');
    expect(updated.airplaneDelayMs).toBe(3000);
    expect(updated.autoRotateOnProfileStart).toBe(true);

    const reloaded = getRotatorConfig();
    expect(reloaded.method).toBe('webhook');
    expect(reloaded.autoRotateOnProfileStart).toBe(true);
  });

  it('should handle ADB device discovery gracefully without crashing', async () => {
    const devices = await getConnectedAdbDevices();
    expect(Array.isArray(devices)).toBe(true);
  });

  it('should reject invalid webhook rotation URLs with clean error', async () => {
    await expect(rotateViaWebhook('invalid-url')).rejects.toThrow('Invalid webhook rotation URL');
  });
});
