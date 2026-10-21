import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSanitizedLaunchArgs } from '../../02_BROWSER/launcher.js';
import {
  getExtensions,
  installExtension,
  removeExtension,
  toggleExtension,
  resolveLocalizedText,
} from '../../02_BROWSER/services/extension-service.js';
import { getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';

describe('Safe Extension Installation & Lifecycle Suite', () => {
  const tempDir = path.resolve('.mahi_data', 'test_extensions_safe');
  const profileId1 = 'test-prof-ext-1';
  const profileId2 = 'test-prof-ext-2';
  const storage1 = path.join(tempDir, profileId1);
  const storage2 = path.join(tempDir, profileId2);

  beforeEach(async () => {
    await initSqlEngine();
    const db = getDatabase();

    fs.mkdirSync(storage1, { recursive: true });
    fs.mkdirSync(storage2, { recursive: true });

    // Seed dummy profiles in SQLite
    db.prepare('DELETE FROM extensions WHERE profile_id IN (?, ?)').run(profileId1, profileId2);
    db.prepare('DELETE FROM profiles WHERE id IN (?, ?)').run(profileId1, profileId2);

    db.prepare(`
      INSERT INTO profiles (id, name, status, storage_path, created_at, updated_at)
      VALUES (?, ?, 'STOPPED', ?, ?, ?)
    `).run(profileId1, 'Profile Alpha', storage1, new Date().toISOString(), new Date().toISOString());

    db.prepare(`
      INSERT INTO profiles (id, name, status, storage_path, created_at, updated_at)
      VALUES (?, ?, 'STOPPED', ?, ?, ?)
    `).run(profileId2, 'Profile Beta', storage2, new Date().toISOString(), new Date().toISOString());
  });

  afterEach(() => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM extensions WHERE profile_id IN (?, ?)').run(profileId1, profileId2);
      db.prepare('DELETE FROM profiles WHERE id IN (?, ?)').run(profileId1, profileId2);
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('guarantees launch args do NOT contain --disable-extensions-except (fixes "Installation is not enabled")', () => {
    const dummyExtPath = path.join(storage1, 'my_stealth_extension');
    const args = buildSanitizedLaunchArgs({
      storageDir: storage1,
      debugPort: 34567,
      loadExtensionsArg: dummyExtPath,
      settings: {
        browser: {
          enableExtensions: true,
        },
      },
      mode: 'normal',
    });

    // CRITICAL: --disable-extensions-except MUST NOT be present
    const hasDisableExcept = args.some((a) => a.includes('--disable-extensions-except'));
    expect(hasDisableExcept).toBe(false);

    // CRITICAL: --load-extension MUST be present to load stealth and unpacked extensions
    const loadArg = args.find((a) => a.startsWith('--load-extension='));
    expect(loadArg).toBeDefined();
    expect(loadArg).toContain(dummyExtPath);

    // Baseline switches must be preserved
    expect(args).toContain('--no-first-run');
    expect(args).toContain('--no-default-browser-check');
  });

  it('resolves localized extension names from _locales when manifest has __MSG_appName__', () => {
    const extDir = path.join(tempDir, 'mock_localized_ext');
    const localesDir = path.join(extDir, '_locales', 'en');
    fs.mkdirSync(localesDir, { recursive: true });

    fs.writeFileSync(
      path.join(localesDir, 'messages.json'),
      JSON.stringify({
        appName: { message: 'Urban VPN Proxy' },
        appDesc: { message: 'Free, secure, and fast VPN' },
      })
    );

    const resolvedName = resolveLocalizedText(extDir, '__MSG_appName__');
    expect(resolvedName).toBe('Urban VPN Proxy');

    const resolvedDesc = resolveLocalizedText(extDir, '__MSG_appDesc__');
    expect(resolvedDesc).toBe('Free, secure, and fast VPN');

    const rawName = resolveLocalizedText(extDir, 'Literal Extension Name');
    expect(rawName).toBe('Literal Extension Name');
  });

  it('synchronizes extensions installed natively inside Chromium Default/Extensions directory', () => {
    const chromeExtDir = path.join(storage1, 'Default', 'Extensions', 'eppiocemhmnlbhjplcgkofciiegomcon', '5.14.4_0');
    fs.mkdirSync(chromeExtDir, { recursive: true });

    fs.writeFileSync(
      path.join(chromeExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'Urban VPN Proxy',
        version: '5.14.4',
        description: 'Free VPN extension for Chrome',
        manifest_version: 3,
        icons: {
          '128': 'icon128.png',
        },
      })
    );

    // Call getExtensions for profileId1
    const exts = getExtensions(profileId1);
    expect(exts.length).toBe(1);
    expect(exts[0].name).toBe('Urban VPN Proxy');
    expect(exts[0].version).toBe('5.14.4');
    expect(exts[0].sourceType).toBe('webstore');
    expect(exts[0].enabled).toBe(true);

    // Verify it was persisted to SQLite
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM extensions WHERE profile_id = ?').get(profileId1) as any;
    expect(row).toBeDefined();
    expect(row.name).toBe('Urban VPN Proxy');
    expect(row.extension_id).toBe('eppiocemhmnlbhjplcgkofciiegomcon');
  });

  it('maintains strict extension isolation between independent profiles', () => {
    // Install extension to Profile 1
    const ext1Dir = path.join(storage1, 'ext_one');
    fs.mkdirSync(ext1Dir, { recursive: true });
    fs.writeFileSync(
      path.join(ext1Dir, 'manifest.json'),
      JSON.stringify({ name: 'Profile 1 Only Extension', version: '1.0.0' })
    );

    installExtension({
      profileId: profileId1,
      sourcePath: ext1Dir,
      name: 'Profile 1 Only Extension',
    });

    const extsProf1 = getExtensions(profileId1);
    const extsProf2 = getExtensions(profileId2);

    expect(extsProf1.length).toBe(1);
    expect(extsProf1[0].name).toBe('Profile 1 Only Extension');

    // Profile 2 must have zero extensions (strict isolation)
    expect(extsProf2.length).toBe(0);
  });

  it('safely toggles and removes extensions and cleans up disk files', () => {
    const extDir = path.join(storage1, 'ext_to_remove');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(
      path.join(extDir, 'manifest.json'),
      JSON.stringify({ name: 'Deletable Ext', version: '2.0.0' })
    );

    const installed = installExtension({
      profileId: profileId1,
      sourcePath: extDir,
      name: 'Deletable Ext',
    });

    expect(fs.existsSync(extDir)).toBe(true);

    // Toggle
    toggleExtension(profileId1, installed.id, false);
    let list = getExtensions(profileId1);
    expect(list.find((e) => e.id === installed.id)?.enabled).toBe(false);

    // Remove
    removeExtension(profileId1, installed.id);
    list = getExtensions(profileId1);
    expect(list.length).toBe(0);
    expect(fs.existsSync(extDir)).toBe(false);
  });

  it('guarantees removeExtension only deletes the target extension and NEVER deletes Default or Extensions parent directories', () => {
    const extBase = path.join(storage1, 'Default', 'Extensions');
    const ext1 = path.join(extBase, 'ext_target', '1.0.0');
    const ext2 = path.join(extBase, 'ext_sibling', '1.0.0');
    fs.mkdirSync(ext1, { recursive: true });
    fs.mkdirSync(ext2, { recursive: true });

    fs.writeFileSync(path.join(ext1, 'manifest.json'), JSON.stringify({ name: 'Target Ext', version: '1.0.0' }));
    fs.writeFileSync(path.join(ext2, 'manifest.json'), JSON.stringify({ name: 'Sibling Ext', version: '1.0.0' }));

    const exts = getExtensions(profileId1);
    expect(exts.length).toBe(2);

    const targetExt = exts.find(e => e.name === 'Target Ext')!;
    const siblingExt = exts.find(e => e.name === 'Sibling Ext')!;

    // Remove target extension
    removeExtension(profileId1, targetExt.id);

    // Assert target extension directory is gone
    expect(fs.existsSync(path.join(extBase, 'ext_target'))).toBe(false);

    // CRITICAL: Sibling extension must still exist
    expect(fs.existsSync(path.join(extBase, 'ext_sibling'))).toBe(true);

    // CRITICAL: Parent Default and Extensions directories must still exist
    expect(fs.existsSync(extBase)).toBe(true);
    expect(fs.existsSync(path.join(storage1, 'Default'))).toBe(true);

    const remaining = getExtensions(profileId1);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(siblingExt.id);
  });
});
