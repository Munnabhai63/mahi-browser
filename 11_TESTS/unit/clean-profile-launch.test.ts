import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  prepareCleanProfilePreferences,
  buildSanitizedLaunchArgs,
  ensureProfileStealthExtension,
  prepareSessionPersistence,
} from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings, generateConsistentEnvironmentSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { CURRENT_ENGINE_DISTRIBUTION } from '../../10_CONFIG/engine-config.js';

describe('Clean Profile Launch Experience & Suppressions', () => {
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = path.join(
      os.tmpdir(),
      `mahi-clean-launch-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    fs.mkdirSync(tempStorageDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('creates the First Run sentinel file to suppress Chromium first-run dialogs', () => {
    prepareCleanProfilePreferences(tempStorageDir, 'Test Profile', 'about:blank');

    const firstRunPath = path.join(tempStorageDir, 'First Run');
    expect(fs.existsSync(firstRunPath)).toBe(true);
  });

  it('initializes Local State with metrics reporting disabled and welcome page acknowledged', () => {
    prepareCleanProfilePreferences(tempStorageDir, 'Test Profile', 'about:blank');

    const localStatePath = path.join(tempStorageDir, 'Local State');
    expect(fs.existsSync(localStatePath)).toBe(true);

    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    expect(localState.browser?.has_seen_welcome_page).toBe(true);
    expect(localState.metrics?.reporting_enabled).toBe(false);
  });

  it('pre-seeds Default/Preferences with complete first-run, promo, and default browser suppressions', () => {
    prepareCleanProfilePreferences(tempStorageDir, 'Alpha Profile', 'about:blank');

    const prefsPath = path.join(tempStorageDir, 'Default', 'Preferences');
    expect(fs.existsSync(prefsPath)).toBe(true);

    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));

    // Browser level
    expect(prefs.browser?.has_seen_welcome_page).toBe(true);
    expect(prefs.browser?.check_default_browser).toBe(false);
    expect(prefs.browser?.show_update_promotion_info_bar).toBe(false);
    expect(prefs.browser?.default_browser_infobar_last_declined).toBeGreaterThan(0);

    // Distribution / First Run level
    expect(prefs.distribution?.skip_first_run_ui).toBe(true);
    expect(prefs.distribution?.suppress_first_run_bubble).toBe(true);
    expect(prefs.distribution?.suppress_first_run_default_browser_prompt).toBe(true);
    expect(prefs.distribution?.make_chrome_default_for_user).toBe(false);

    // Signin & Sync promo level
    expect(prefs.signin?.allowed).toBe(false);
    expect(prefs.sync_promo?.show_on_first_run_allowed).toBe(false);
    expect(prefs.sync_promo?.user_skipped).toBe(true);

    // Privacy Sandbox level
    expect(prefs.privacy_sandbox?.m1?.consent_decision_made).toBe(true);
    expect(prefs.privacy_sandbox?.m1?.notice_acknowledged).toBe(true);
    expect(prefs.privacy_sandbox?.m1?.row_notice_acknowledged).toBe(true);

    // Session & profile level
    expect(prefs.session?.restore_on_startup).toBe(1);
    expect(prefs.session?.startup_urls).toEqual(['about:blank']);
    expect(prefs.profile?.exit_type).toBe('Normal');
    expect(prefs.profile?.exited_cleanly).toBe(true);
    expect(prefs.profile?.name).toBe('Alpha Profile');
  });

  it('non-destructively migrates existing profiles without modifying cookies or existing user settings', () => {
    const defaultDir = path.join(tempStorageDir, 'Default');
    fs.mkdirSync(defaultDir, { recursive: true });

    // Existing pre-existing preferences with user data
    const existingPrefs = {
      profile: {
        name: 'Existing Work Profile',
        custom_user_setting: 'keep_this_intact',
      },
      extensions: {
        pinned_extensions: ['extension_abc'],
      },
      custom_cookie_jar_state: {
        total_cookies: 42,
      },
    };
    fs.writeFileSync(path.join(defaultDir, 'Preferences'), JSON.stringify(existingPrefs, null, 2), 'utf8');

    // Run clean profile configuration
    prepareCleanProfilePreferences(tempStorageDir, 'Existing Work Profile');

    const updated = JSON.parse(fs.readFileSync(path.join(defaultDir, 'Preferences'), 'utf8'));

    // Existing keys preserved
    expect(updated.profile.custom_user_setting).toBe('keep_this_intact');
    expect(updated.extensions.pinned_extensions).toEqual(['extension_abc']);
    expect(updated.custom_cookie_jar_state.total_cookies).toBe(42);

    // Clean baseline keys added
    expect(updated.browser?.check_default_browser).toBe(false);
    expect(updated.distribution?.skip_first_run_ui).toBe(true);
    expect(updated.signin?.allowed).toBe(false);
    expect(updated.profile?.exited_cleanly).toBe(true);
  });

  it('buildSanitizedLaunchArgs includes required clean flags and avoids automation switches in normal mode', () => {
    const args = buildSanitizedLaunchArgs({
      storageDir: tempStorageDir,
      debugPort: 9222,
      loadExtensionsArg: 'C:/fake/ext',
      settings: {
        display: { screenWidth: 1920, screenHeight: 1080 },
        browser: { userAgent: 'Mozilla/5.0 TestUA' },
      },
      mode: 'normal',
    });

    // Contains mandatory clean flags
    expect(args).toContain('--no-first-run');
    expect(args).toContain('--no-default-browser-check');
    expect(args).toContain('--disable-search-engine-choice-screen');
    expect(args).toContain('--disable-infobars');
    expect(args).toContain('--disable-component-update');
    expect(args).toContain('--disable-domain-reliability');
    expect(args).toContain('--suppress-message-center-popups');

    // Normal mode must NEVER pass automation banners or unsafe flags
    expect(args).not.toContain('--enable-automation');
    expect(args).not.toContain('--test-type');
  });

  it('defaults profile settings to about:blank to prevent startup promotional navigation', () => {
    const defaultSettings = getDefaultProfileSettings();
    expect(defaultSettings.browser.startupUrl).toBe('about:blank');
    expect(defaultSettings.browser.homepage).toBe('about:blank');

    const consistentSettings = generateConsistentEnvironmentSettings();
    expect(consistentSettings.browser.startupUrl).toBe('about:blank');
    expect(consistentSettings.browser.homepage).toBe('about:blank');
  });

  it('suppresses in-page profile pill badge by default in stealth extension', () => {
    const extDir = ensureProfileStealthExtension(tempStorageDir, 'profile_1', 'Clean User Profile');
    const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

    // Title branding is preserved for window/tab identification
    expect(contentJs).toContain('updateTitle');
    expect(contentJs).toContain('Clean User Profile');

    // In-page pill is gated by enableInPageBadge which evaluates to false by default
    expect(contentJs).toContain('var enableInPageBadge = false;');
  });

  it('validates CURRENT_ENGINE_DISTRIBUTION policy', () => {
    expect(['CHROMIUM_PRODUCTION', 'MANAGED_CFT']).toContain(CURRENT_ENGINE_DISTRIBUTION);
  });
});
