import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  detectAndParseAccountData,
  parseNetscapeCookies,
  parseJsonCookies,
  executeBulkImport,
} from '../../02_BROWSER/services/universal-importer-service.js';
import { getProfileById, getProfileStoragePath } from '../../02_BROWSER/services/profile-service.js';
import { getProxyById } from '../../02_BROWSER/services/proxy-service.js';

describe('Phase 6: Universal Multi-Account Bulk Importer & Cookie Packager', () => {
  beforeAll(async () => {
    await initSqlEngine();
    await initializeDatabase();
  });

  it('should parse colon-delimited account string with embedded proxies', () => {
    const raw = `
      acc1@gmail.com:Secret123:157.240.1.1:8080:proxyuser:proxypass
      acc2@gmail.com:Secret456:157.240.1.2:3128:usr2:pwd2
      ProfileOnly:192.168.1.100:8080
    `;

    const parsed = detectAndParseAccountData(raw);
    expect(parsed.length).toBe(3);

    expect(parsed[0].name).toBe('acc1@gmail.com');
    expect(parsed[0].usernameOrEmail).toBe('acc1@gmail.com');
    expect(parsed[0].password).toBe('Secret123');
    expect(parsed[0].proxy).toBeDefined();
    expect(parsed[0].proxy?.host).toBe('157.240.1.1');
    expect(parsed[0].proxy?.port).toBe(8080);
    expect(parsed[0].proxy?.username).toBe('proxyuser');
    expect(parsed[0].proxy?.password).toBe('proxypass');

    expect(parsed[1].name).toBe('acc2@gmail.com');
    expect(parsed[1].proxy?.port).toBe(3128);

    expect(parsed[2].name).toBe('ProfileOnly');
    expect(parsed[2].proxy?.host).toBe('192.168.1.100');
  });

  it('should parse CSV formatted account string with headers', () => {
    const csvRaw = `
name,proxy,notes
Facebook-Farm-1,http://157.240.1.1:8080:usr:pwd,Warmed Account 1
Twitter-Farm-2,socks5://157.240.1.2:1080,Warmed Twitter 2
    `.trim();

    const parsed = detectAndParseAccountData(csvRaw);
    expect(parsed.length).toBe(2);

    expect(parsed[0].name).toBe('Facebook-Farm-1');
    expect(parsed[0].proxy?.host).toBe('157.240.1.1');
    expect(parsed[0].proxy?.username).toBe('usr');
    expect(parsed[0].notes).toBe('Warmed Account 1');

    expect(parsed[1].name).toBe('Twitter-Farm-2');
    expect(parsed[1].proxy?.protocol).toBe('socks5');
    expect(parsed[1].proxy?.port).toBe(1080);
  });

  it('should parse standard Netscape format cookie files', () => {
    const netscapeRaw = `
# Netscape HTTP Cookie File
.google.com\tTRUE\t/\tTRUE\t1787600000\t_ga\tGA1.2.123456789.1700000000
#HttpOnly_.amazon.com\tTRUE\t/\tTRUE\t1787600000\tsession-id\tabc-1234-xyz
    `.trim();

    const cookies = parseNetscapeCookies(netscapeRaw);
    expect(cookies.length).toBe(2);

    expect(cookies[0].name).toBe('_ga');
    expect(cookies[0].domain).toBe('.google.com');
    expect(cookies[0].secure).toBe(true);
    expect(cookies[0].httpOnly).toBe(false);

    expect(cookies[1].name).toBe('session-id');
    expect(cookies[1].domain).toBe('.amazon.com');
    expect(cookies[1].httpOnly).toBe(true);
  });

  it('should execute full batch import with fingerprints, proxies, and cookie injection', async () => {
    const raw = `
      Batch-User-1:Pass1:157.240.1.10:8080:puser1:ppass1
      Batch-User-2:Pass2:157.240.1.11:8080:puser2:ppass2
    `;

    const parsed = detectAndParseAccountData(raw);
    expect(parsed.length).toBe(2);

    // Attach sample cookie to first account
    parsed[0].cookies = [
      { id: '1', profileId: '', domain: '.google.com', name: '_ga', value: 'GA1.1.999', path: '/', httpOnly: false, secure: true },
    ];

    const result = await executeBulkImport(parsed, {
      folder: 'Imported-Testing',
      os: 'windows',
      browserEngine: 'chrome',
      tags: ['Test-Batch'],
    });

    expect(result.success).toBe(true);
    expect(result.totalImported).toBe(2);
    expect(result.createdProfileIds.length).toBe(2);

    // Verify first created profile
    const p1 = getProfileById(result.createdProfileIds[0]);
    expect(p1).toBeDefined();
    expect(p1?.name).toBe('Batch-User-1');
    expect(p1?.folder).toBe('Imported-Testing');
    expect(p1?.tags).toContain('Test-Batch');
    expect(p1?.settings.browser.engine).toBe('chrome');
    expect(p1?.settings.browser.userAgent).toBeDefined();

    // Verify proxy was bound
    expect(p1?.settings.network.proxyId).toBeDefined();
    const proxy1 = getProxyById(p1!.settings.network.proxyId!);
    expect(proxy1).toBeDefined();
    expect(proxy1?.host).toBe('157.240.1.10');


    // Verify cookies file was written to disk
    const storageDir = getProfileStoragePath(p1!.id);
    const cookiesFile = path.join(storageDir, 'mahi_cookies.json');
    expect(fs.existsSync(cookiesFile)).toBe(true);
    const cookiesData = JSON.parse(fs.readFileSync(cookiesFile, 'utf8'));
    expect(cookiesData.length).toBe(1);
    expect(cookiesData[0].name).toBe('_ga');
  });
});
