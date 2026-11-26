import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initSqlEngine, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  detectAndParseAccountData,
  detectCompetitorFormat,
  executeBulkImport,
} from '../../02_BROWSER/services/universal-importer-service.js';
import { getProfileById } from '../../02_BROWSER/services/profile-service.js';
import {
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  getSyncConfig,
  setSyncConfig,
  isLegacyWeakPassphraseActive,
} from '../../08_SECURITY/cloud-sync-service.js';

describe('Layer 4: Competitor Importers & Opt-In Sync Key Derivation v2', () => {
  const tempDirs: string[] = [];
  const prevUserDataDir = process.env.MAHI_USER_DATA_DIR;

  beforeAll(async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer4-'));
    tempDirs.push(tmp);
    process.env.MAHI_USER_DATA_DIR = tmp;
    setCustomDatabasePath(path.join(tmp, 'test_layer4.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterEach(() => {
    if (prevUserDataDir === undefined) delete process.env.MAHI_USER_DATA_DIR;
    else process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
  });

  it('Task 4.1: Auto-detects and imports GoLogin, AdsPower, and Dolphin{anty} exports accurately', async () => {
    const goLoginExport = JSON.stringify({
      profiles: [
        {
          name: 'GL-Shop-US',
          navigator: { userAgent: 'Mozilla/5.0 Chrome/158.0.0.0', language: 'en-US', resolution: '1920x1080' },
          proxy: { mode: 'socks5', host: '198.51.100.10', port: 1080, username: 'gluser', password: 'glpass' },
          timezone: { id: 'America/New_York' },
          cookies: [{ name: 'sid', value: 'abc', domain: '.example.com' }],
          folders: ['Ecom'],
        },
      ],
    });
    expect(detectCompetitorFormat(goLoginExport)).toBe('gologin');
    const glParsed = detectAndParseAccountData(goLoginExport);
    expect(glParsed).toHaveLength(1);
    expect(glParsed[0]).toMatchObject({
      name: 'GL-Shop-US',
      sourceFormat: 'gologin',
      timezone: 'America/New_York',
      screenWidth: 1920,
      screenHeight: 1080,
      proxy: { protocol: 'socks5', host: '198.51.100.10', port: 1080, username: 'gluser', password: 'glpass' },
    });

    const adsPowerExport = JSON.stringify({
      data: {
        list: [
          {
            user_id: 'ap_001',
            name: 'AP-AdAccount-DE',
            remark: 'BM active',
            user_proxy_config: {
              proxy_type: 'http',
              proxy_host: '198.51.100.20',
              proxy_port: '8080',
              proxy_user: 'apusr',
              proxy_password: 'appwd',
            },
            fingerprint_config: { ua: 'Mozilla/5.0 Chrome/158.0.0.0', timezone: 'Europe/Berlin', language: ['de-DE'] },
            cookie: JSON.stringify([{ name: 'c_user', value: '999', domain: '.facebook.com' }]),
          },
        ],
      },
    });
    expect(detectCompetitorFormat(adsPowerExport)).toBe('adspower');
    const apParsed = detectAndParseAccountData(adsPowerExport);
    expect(apParsed[0]).toMatchObject({
      name: 'AP-AdAccount-DE',
      sourceFormat: 'adspower',
      timezone: 'Europe/Berlin',
      language: 'de-DE',
      notes: 'BM active',
    });
    expect(apParsed[0].cookies).toHaveLength(1);

    const dolphinExport = JSON.stringify({
      data: [
        {
          name: 'Dolphin-FR-1',
          browserType: 'anty',
          useragent: { value: 'Mozilla/5.0 Chrome/158.0.0.0' },
          proxy: { type: 'https', host: '198.51.100.30', port: 8443, login: 'dusr', password: 'dpwd' },
          timezone: { value: 'Europe/Paris' },
          tags: ['FR', 'TikTok'],
        },
      ],
    });
    expect(detectCompetitorFormat(dolphinExport)).toBe('dolphin');
    const dlParsed = detectAndParseAccountData(dolphinExport);
    expect(dlParsed[0]).toMatchObject({
      name: 'Dolphin-FR-1',
      sourceFormat: 'dolphin',
      timezone: 'Europe/Paris',
      proxy: { protocol: 'https', host: '198.51.100.30', port: 8443, username: 'dusr', password: 'dpwd' },
    });

    const batchRes = await executeBulkImport([...glParsed, ...apParsed, ...dlParsed], { folder: 'Migrated' });
    expect(batchRes.success).toBe(true);
    expect(batchRes.totalImported).toBe(3);

    const importedGl = getProfileById(batchRes.createdProfileIds[0]);
    expect(importedGl?.settings.locale.timezone).toBe('America/New_York');
    expect(importedGl?.settings.display.screenWidth).toBe(1920);
  });

  it('Task 4.2: Preserves legacy v1 backup decryption while supporting random-salt v2 envelope encryption and config state', () => {
    const payload = Buffer.from('sensitive-profile-tar-payload');

    // Legacy v1 encrypted with default passphrase still decrypts seamlessly
    const legacyV1 = encryptProfileArchive(payload, 'mahi-cloud-sync', { keyVersion: 1 });
    expect(JSON.parse(legacyV1.encryptedDataKey).v).toBeUndefined();
    const decLegacy = decryptProfileArchive({
      ciphertext: legacyV1.ciphertext,
      expectedChecksum: legacyV1.checksumSha256,
      encryptedDataKey: legacyV1.encryptedDataKey,
      iv: legacyV1.iv,
      authTag: legacyV1.authTag,
      userMasterKey: 'mahi-cloud-sync',
    });
    expect(decLegacy.equals(payload)).toBe(true);

    // Strengthened v2 uses unique random per-backup salts and auto-decrypts
    const v2A = encryptProfileArchive(payload, 'custom-strong-passphrase-2026', { keyVersion: 2 });
    const v2B = encryptProfileArchive(payload, 'custom-strong-passphrase-2026', { keyVersion: 2 });
    const metaA = JSON.parse(v2A.encryptedDataKey);
    const metaB = JSON.parse(v2B.encryptedDataKey);
    expect(metaA.v).toBe(2);
    expect(typeof metaA.s).toBe('string');
    expect(metaA.s).not.toBe(metaB.s);

    const decV2 = decryptProfileArchive({
      ciphertext: v2A.ciphertext,
      expectedChecksum: v2A.checksumSha256,
      encryptedDataKey: v2A.encryptedDataKey,
      iv: v2A.iv,
      authTag: v2A.authTag,
      userMasterKey: 'custom-strong-passphrase-2026',
    });
    expect(decV2.equals(payload)).toBe(true);

    const tmpSyncDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer4-sync-cfg-'));
    tempDirs.push(tmpSyncDir);
    process.env.MAHI_USER_DATA_DIR = tmpSyncDir;

    const initialCfg = getSyncConfig();
    expect(initialCfg.keyDerivationVersion).toBe(1);
    expect(isLegacyWeakPassphraseActive(initialCfg)).toBe(true);

    const upgraded = setSyncConfig({ syncPassphrase: 'custom-strong-passphrase-2026', keyDerivationVersion: 2 });
    expect(upgraded.keyDerivationVersion).toBe(2);
    expect(isLegacyWeakPassphraseActive(upgraded)).toBe(false);

    closeDatabase();
  });
});
