import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import {
  parseNetscapeCookies,
  importCookies,
  getCookies,
  exportCookies,
  deleteCookie,
  deleteAllCookies,
} from '../../02_BROWSER/services/cookie-service.js';
import {
  getHistory,
  deleteHistoryItem,
  clearHistory,
} from '../../02_BROWSER/services/history-service.js';

describe('Cookie & History Services', () => {
  let profileId = '';
  let testDbDir = '';

  beforeAll(async () => {
    testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-cookie-history-'));
    setCustomDatabasePath(path.join(testDbDir, 'test_mahi_cookies.sqlite'));
    await initializeDatabase();

    const p = createProfile({ name: 'Cookie Test Profile' });
    profileId = p.id;
  });

  afterAll(() => {
    closeDatabase();
    if (testDbDir) {
      try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('should parse Netscape cookie file content', () => {
    const netscapeSample = `# Netscape HTTP Cookie File
.google.com\tTRUE\t/\tTRUE\t1750000000\tSID\tABC123XYZ
# HttpOnly_.github.com\tTRUE\t/\tTRUE\t1750000000\tuser_session\tSECRET_TOKEN_999
`;
    const parsed = parseNetscapeCookies(netscapeSample, profileId);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].domain).toBe('.google.com');
    expect(parsed[0].name).toBe('SID');
    expect(parsed[0].httpOnly).toBe(false);

    expect(parsed[1].domain).toBe('.github.com');
    expect(parsed[1].name).toBe('user_session');
    expect(parsed[1].httpOnly).toBe(true);
  });

  it('should import cookies from JSON', () => {
    const jsonCookies = JSON.stringify([
      { domain: '.youtube.com', name: 'VISITOR_INFO', value: 'v123', path: '/', secure: true, httpOnly: true },
      { domain: '.amazon.com', name: 'session-id', value: 'amz987', path: '/', secure: true, httpOnly: false },
    ]);

    const result = importCookies(profileId, jsonCookies);
    expect(result.importedCount).toBe(2);

    const stored = getCookies({ profileId });
    expect(stored.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter and export cookies in Netscape and JSON formats', () => {
    const jsonExport = exportCookies({ profileId, format: 'json', includeSensitive: true });
    expect(JSON.parse(jsonExport)).toBeInstanceOf(Array);

    const netscapeExport = exportCookies({ profileId, format: 'netscape', includeSensitive: true });
    expect(netscapeExport).toContain('# Netscape HTTP Cookie File');
    expect(netscapeExport).toContain('.youtube.com');
  });

  it('should delete a cookie and clear all cookies', () => {
    const cookies = getCookies({ profileId });
    expect(cookies.length).toBeGreaterThan(0);

    const firstId = cookies[0].id;
    deleteCookie(profileId, firstId);

    const afterOne = getCookies({ profileId });
    expect(afterOne.find((c) => c.id === firstId)).toBeUndefined();

    deleteAllCookies(profileId);
    const afterAll = getCookies({ profileId });
    expect(afterAll).toHaveLength(0);
  });
});
