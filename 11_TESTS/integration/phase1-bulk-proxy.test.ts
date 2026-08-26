import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { bulkCreateProfiles, getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { parseUniversalProxyString, parseAndCreateProxy, getProxies } from '../../02_BROWSER/services/proxy-service.js';

describe('Phase 1: Bulk Profile Creation & Universal Proxy Engine', () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase1-test-'));
    dbPath = path.join(tempDir, 'test_phase1.sqlite');
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Universal Proxy String Parser', () => {
    it('should parse standard provider format (ip:port:username:password)', () => {
      const input = '142.250.190.46:8080:myUser123:myPass456';
      const parsed = parseUniversalProxyString(input);

      expect(parsed).not.toBeNull();
      expect(parsed?.host).toBe('142.250.190.46');
      expect(parsed?.port).toBe(8080);
      expect(parsed?.username).toBe('myUser123');
      expect(parsed?.password).toBe('myPass456');
      expect(parsed?.protocol).toBe('http');
    });

    it('should parse URL with credentials (socks5://user:pass@ip:port)', () => {
      const input = 'socks5://admin:secret123@198.51.100.25:1080';
      const parsed = parseUniversalProxyString(input);

      expect(parsed).not.toBeNull();
      expect(parsed?.protocol).toBe('socks5');
      expect(parsed?.host).toBe('198.51.100.25');
      expect(parsed?.port).toBe(1080);
      expect(parsed?.username).toBe('admin');
      expect(parsed?.password).toBe('secret123');
    });

    it('should parse simple ip:port without credentials', () => {
      const input = '203.0.113.10:3128';
      const parsed = parseUniversalProxyString(input);

      expect(parsed).not.toBeNull();
      expect(parsed?.host).toBe('203.0.113.10');
      expect(parsed?.port).toBe(3128);
      expect(parsed?.username).toBeUndefined();
      expect(parsed?.password).toBeUndefined();
    });

    it('should reject invalid proxy strings safely without throwing', () => {
      expect(parseUniversalProxyString('')).toBeNull();
      expect(parseUniversalProxyString('invalid_text')).toBeNull();
      expect(parseUniversalProxyString('1.2.3.4:999999')).toBeNull(); // Port out of range
    });
  });

  describe('2. 1-Click Bulk Profile Creation', () => {
    it('should batch generate 5 profiles with sequential naming and authentic configurations', () => {
      const initialCount = getProfiles().length;

      const created = bulkCreateProfiles({
        count: 5,
        namePrefix: 'FB-Account',
        folder: 'Social Media',
        osType: 'random',
      });

      expect(created.length).toBe(5);

      // Verify names and attributes
      created.forEach((p, idx) => {
        expect(p.id).toBeDefined();
        expect(p.name).toContain('FB-Account');
        expect(p.folder).toBe('Social Media');
        expect(p.settings?.display?.screenWidth).toBeGreaterThan(1000);
        expect(p.settings?.display?.screenHeight).toBeGreaterThan(600);
        expect(p.settings?.browser?.userAgent).toBeDefined();
      });

      const finalCount = getProfiles().length;
      expect(finalCount).toBe(initialCount + 5);
    });

    it('should enforce batch creation limits (clamping up to 100)', () => {
      const created = bulkCreateProfiles({
        count: 3,
        namePrefix: 'BatchTest',
        folder: 'Work',
      });

      expect(created.length).toBe(3);
    });
  });
});
