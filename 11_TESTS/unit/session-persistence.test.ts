import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { prepareSessionPersistence, hasExistingSession, markCleanExit, ensureProfileTitleExtension } from '../../02_BROWSER/launcher.js';

describe('Browser Session Persistence & Profile Identity', () => {
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = path.join(os.tmpdir(), `mahi-session-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempStorageDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should initialize Default/Preferences with restore_on_startup = 1 and exit_type = Normal', () => {
    prepareSessionPersistence(tempStorageDir, 'Profile 7', 'https://www.google.com');

    const prefsPath = path.join(tempStorageDir, 'Default', 'Preferences');
    expect(fs.existsSync(prefsPath)).toBe(true);

    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    expect(prefs.session?.restore_on_startup).toBe(1); // RESTORE_LAST_SESSION
    expect(prefs.profile?.exit_type).toBe('Normal');
    expect(prefs.profile?.exited_cleanly).toBe(true);
    expect(prefs.session?.startup_urls).toEqual(['https://www.google.com']);
  });

  it('should generate profile title branding extension with exact profile name', () => {
    const extDir = ensureProfileTitleExtension(tempStorageDir, 'Profile 12');
    expect(fs.existsSync(extDir)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('Profile 12');
    expect(manifest.action.default_title).toBe('Profile 12');

    const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
    expect(contentJs).toContain('Profile 12');
  });



  it('should detect when no previous session exists vs when session files exist', () => {
    expect(hasExistingSession(tempStorageDir)).toBe(false);

    // Create session files
    const sessionsDir = path.join(tempStorageDir, 'Default', 'Sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, 'Session_1338123456789'), 'session-binary-data');
    fs.writeFileSync(path.join(sessionsDir, 'Tabs_1338123456789'), 'tabs-binary-data');

    expect(hasExistingSession(tempStorageDir)).toBe(true);
  });

  it('should mark clean exit state in Preferences upon browser stop', () => {
    prepareSessionPersistence(tempStorageDir, 'Profile 3');

    // Simulate crash state
    const prefsPath = path.join(tempStorageDir, 'Default', 'Preferences');
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    prefs.profile.exit_type = 'Crashed';
    prefs.profile.exited_cleanly = false;
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');

    // Call markCleanExit
    markCleanExit(tempStorageDir, 'Profile 3');

    const updatedPrefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
    expect(updatedPrefs.profile?.exit_type).toBe('Normal');
    expect(updatedPrefs.profile?.exited_cleanly).toBe(true);
    expect(updatedPrefs.session?.restore_on_startup).toBe(1);
  });
});
