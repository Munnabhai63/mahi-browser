import fs from 'node:fs';
import path from 'node:path';
import {
  log,
  debugLog,
  type LauncherProfileSettings,
  resolveEffectiveWebrtcPolicy,
  applyStrictWebrtcArgs,
} from './launcher-shared.js';

/**
 * Remove stale lock files left by previous crashed Chromium sessions
 */
export function cleanupStaleLocks(storageDir: string): void {
  const lockFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'parent.lock',
    'DevToolsActivePort',
  ];

  for (const lockFile of lockFiles) {
    const lockPath = path.join(storageDir, lockFile);
    try {
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true, recursive: true });
        debugLog(`[Launcher Step 3/7] Cleaned up stale lock file: ${lockFile}`);
      }
    } catch (err) {
      debugLog(`[Launcher Step 3/7] Warning: Could not remove lock file ${lockFile}: ${err}`);
    }
  }
}

/**
 * Checks if a profile storage directory has saved session data (tabs, windows, history).
 */
export function hasExistingSession(storageDir: string): boolean {
  try {
    const defaultDir = path.join(storageDir, 'Default');
    if (!fs.existsSync(defaultDir)) return false;

    const sessionsDir = path.join(defaultDir, 'Sessions');
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir);
      if (files.some((f) => (f.startsWith('Session_') || f.startsWith('Tabs_')) && !f.endsWith('-journal'))) {
        return true;
      }
    }

    const currentSession = path.join(defaultDir, 'Current Session');
    if (fs.existsSync(currentSession)) {
      if (fs.statSync(currentSession).size > 0) return true;
    }

    const historyFile = path.join(defaultDir, 'History');
    if (fs.existsSync(historyFile) && fs.statSync(historyFile).size > 0) {
      return true;
    }
  } catch (err) {
    log.debug('Session presence probe failed cleanly', {
      storageDir,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return false;
}

/**
 * Ensures Chromium profile preferences and baseline marker files are configured
 * for a clean, production-ready browsing launch experience:
 * - Suppresses first-run onboarding, welcome page, and what's new prompts
 * - Suppresses default browser checks and infobars
 * - Suppresses Chrome sign-in promos and sync onboarding
 * - Suppresses Privacy Sandbox intro dialogs
 * - Suppresses metrics and crash report opt-ins
 * - Configures clean session persistence and normal exit recovery
 * - Preserves existing user cookies, sessions, history, and extensions safely.
 */
export function prepareCleanProfilePreferences(
  storageDir: string,
  profileName?: string,
  startupUrl?: string
): void {
  try {
    // 1. First Run marker file suppression:
    // Chromium checks for the existence of "First Run" in the user data dir.
    // Creating this sentinel file tells Chromium the first run flow has already completed.
    const firstRunSentinel = path.join(storageDir, 'First Run');
    if (!fs.existsSync(firstRunSentinel)) {
      try {
        fs.writeFileSync(firstRunSentinel, '', 'utf8');
      } catch (err) {
        log.warn('Failed writing Chromium First Run sentinel file', {
          firstRunSentinel,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. Prepare Local State (browser-wide preferences)
    const localStatePath = path.join(storageDir, 'Local State');
    interface ChromiumLocalStateDoc {
      browser?: {
        has_seen_welcome_page?: boolean;
        enabled_labs_experiments?: unknown[];
        [key: string]: unknown;
      };
      metrics?: {
        reporting_enabled?: boolean;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
    let localState: ChromiumLocalStateDoc = {};
    if (fs.existsSync(localStatePath)) {
      try {
        localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as ChromiumLocalStateDoc;
      } catch {
        localState = {};
      }
    }
    if (!localState.browser || typeof localState.browser !== 'object') {
      localState.browser = {};
    }
    localState.browser.has_seen_welcome_page = true;
    localState.browser.enabled_labs_experiments = localState.browser.enabled_labs_experiments || [];

    if (!localState.metrics || typeof localState.metrics !== 'object') {
      localState.metrics = {};
    }
    localState.metrics.reporting_enabled = false;

    try {
      fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2), 'utf8');
    } catch (lsErr) {
      debugLog(`[Launcher] Note: Could not write Local State: ${lsErr}`);
    }

    // 3. Prepare Default/Preferences (profile-specific preferences)
    const defaultDir = path.join(storageDir, 'Default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    const prefsPath = path.join(defaultDir, 'Preferences');
    interface ChromiumBaselinePrefsDoc {
      browser?: {
        has_seen_welcome_page?: boolean;
        check_default_browser?: boolean;
        default_browser_infobar_last_declined?: number;
        show_update_promotion_info_bar?: boolean;
        clear_data?: { time_period?: number; [key: string]: unknown };
        [key: string]: unknown;
      };
      distribution?: Record<string, unknown>;
      signin?: { allowed?: boolean; [key: string]: unknown };
      sync_promo?: { show_on_first_run_allowed?: boolean; user_skipped?: boolean; [key: string]: unknown };
      privacy_sandbox?: {
        m1?: Record<string, unknown>;
        page_learn_more_clicked?: boolean;
        [key: string]: unknown;
      };
      session?: { restore_on_startup?: number; startup_urls?: string[]; [key: string]: unknown };
      profile?: { exit_type?: string; exited_cleanly?: boolean; name?: string; [key: string]: unknown };
      [key: string]: unknown;
    }
    let prefs: ChromiumBaselinePrefsDoc = {};
    if (fs.existsSync(prefsPath)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')) as ChromiumBaselinePrefsDoc;
      } catch {
        prefs = {};
      }
    }

    // Browser level: first-run & default browser prompts
    if (!prefs.browser || typeof prefs.browser !== 'object') {
      prefs.browser = {};
    }
    prefs.browser.has_seen_welcome_page = true;
    prefs.browser.check_default_browser = false;
    // Chromium checks this timestamp to decide whether to re-prompt
    prefs.browser.default_browser_infobar_last_declined =
      prefs.browser.default_browser_infobar_last_declined || 13350000000000000;
    prefs.browser.show_update_promotion_info_bar = false;
    prefs.browser.clear_data = prefs.browser.clear_data || { time_period: 0 };

    // Distribution level: installer/welcome suppressions
    if (!prefs.distribution || typeof prefs.distribution !== 'object') {
      prefs.distribution = {};
    }
    prefs.distribution.import_bookmarks = false;
    prefs.distribution.import_history = false;
    prefs.distribution.import_search_engine = false;
    prefs.distribution.make_chrome_default_for_user = false;
    prefs.distribution.skip_first_run_ui = true;
    prefs.distribution.suppress_first_run_bubble = true;
    prefs.distribution.suppress_first_run_default_browser_prompt = true;

    // Signin & Sync promo suppression
    if (!prefs.signin || typeof prefs.signin !== 'object') {
      prefs.signin = {};
    }
    prefs.signin.allowed = false;

    if (!prefs.sync_promo || typeof prefs.sync_promo !== 'object') {
      prefs.sync_promo = {};
    }
    prefs.sync_promo.show_on_first_run_allowed = false;
    prefs.sync_promo.user_skipped = true;

    // Privacy Sandbox intro suppression
    if (!prefs.privacy_sandbox || typeof prefs.privacy_sandbox !== 'object') {
      prefs.privacy_sandbox = {};
    }
    if (!prefs.privacy_sandbox.m1 || typeof prefs.privacy_sandbox.m1 !== 'object') {
      prefs.privacy_sandbox.m1 = {};
    }
    prefs.privacy_sandbox.m1.consent_decision_made = true;
    prefs.privacy_sandbox.m1.notice_acknowledged = true;
    prefs.privacy_sandbox.m1.row_notice_acknowledged = true;
    prefs.privacy_sandbox.page_learn_more_clicked = true;

    // Session persistence & clean exit
    if (!prefs.session || typeof prefs.session !== 'object') {
      prefs.session = {};
    }
    prefs.session.restore_on_startup = 1; // 1 = RESTORE_LAST_SESSION
    if (
      startupUrl &&
      (!prefs.session.startup_urls || !Array.isArray(prefs.session.startup_urls) || prefs.session.startup_urls.length === 0)
    ) {
      prefs.session.startup_urls = [startupUrl];
    }

    if (!prefs.profile || typeof prefs.profile !== 'object') {
      prefs.profile = {};
    }
    prefs.profile.exit_type = 'Normal';
    prefs.profile.exited_cleanly = true;
    if (profileName && !prefs.profile.name) {
      prefs.profile.name = profileName;
    }

    // Write back safely without corrupting any other existing preferences
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    debugLog(`[Launcher] Configured clean profile baseline preferences for: ${storageDir}`);
  } catch (err) {
    debugLog(`[Launcher] Warning: Failed to configure clean profile preferences: ${err}`);
  }
}

/**
 * Ensures Chromium profile preferences are properly configured for full session persistence
 * ("Continue where you left off") and clean exit recovery.
 */
export function prepareSessionPersistence(storageDir: string, profileName?: string, startupUrl?: string): void {
  prepareCleanProfilePreferences(storageDir, profileName, startupUrl);
}

/**
 * Marks profile as exited cleanly when browser stops.
 */
export function markCleanExit(storageDir: string, _profileName?: string): void {
  try {
    const prefsPath = path.join(storageDir, 'Default', 'Preferences');
    if (fs.existsSync(prefsPath)) {
      const raw = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(raw);
      if (!prefs.profile || typeof prefs.profile !== 'object') {
        prefs.profile = {};
      }
      prefs.profile.exit_type = 'Normal';
      prefs.profile.exited_cleanly = true;

      if (!prefs.session || typeof prefs.session !== 'object') {
        prefs.session = {};
      }
      prefs.session.restore_on_startup = 1;

      fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
      debugLog(`[Launcher] Clean exit state marked in Preferences for: ${storageDir}`);
    }
  } catch (err) {
    debugLog(`[Launcher] Note during markCleanExit: ${err}`);
  }
}

/**
 * Options for generating sanitized launch arguments.
 */
export interface SanitizedLaunchArgsOptions {
  storageDir: string;
  debugPort?: number;
  loadExtensionsArg?: string;
  settings?: LauncherProfileSettings | null;
  mode?: 'normal' | 'automation';
  isNativeStealth?: boolean;
  allowCdpDebugPort?: boolean;
}

/**
 * Builds clean, audited Chromium launch arguments for production browsing.
 * - Suppresses first-run screens, welcome prompts, and default browser banners
 * - Suppresses search engine choice dialogs and sync promos
 * - Enables session restore and normal exit recovery
 * - Enforces WebRTC IP handling and proxy isolation
 * - Ensures normal user browsing NEVER carries test automation switches (--enable-automation)
 *   and NEVER opens a predictable localhost CDP debugging port unless automation mode or explicit opt-in is active
 */
export function buildSanitizedLaunchArgs(options: SanitizedLaunchArgsOptions): string[] {
  const {
    storageDir,
    debugPort,
    loadExtensionsArg,
    settings,
    mode = 'normal',
    isNativeStealth = false,
    allowCdpDebugPort = false,
  } = options;

  const args: string[] = [`--user-data-dir=${storageDir}`, '--new-window'];

  const shouldExposeCdp =
    (mode === 'automation' || allowCdpDebugPort === true) && typeof debugPort === 'number' && debugPort > 0;
  if (shouldExposeCdp) {
    args.push(`--remote-debugging-port=${debugPort}`);
    args.push('--remote-debugging-address=127.0.0.1');
  }

  if (loadExtensionsArg) {
    const cleanedExts = Array.from(
      new Set(
        loadExtensionsArg
          .split(',')
          .map((p) => p.trim().replace(/[/\\]+$/, ''))
          .filter(Boolean)
      )
    ).join(',');

    if (cleanedExts) {
      args.push(`--load-extension=${cleanedExts}`);
      // DO NOT add --disable-extensions-except: it disables the extension system and
      // triggers Chromium's IDS_EXTENSION_INSTALL_NOT_ENABLED ("Installation is not enabled")
      // on Chrome Web Store installs and disables user-installed extensions on restart.
    }
  }

  // Baseline Clean Production Arguments
  args.push(
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    '--restore-last-session',
    '--hide-crash-restore-bubble',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--no-service-autorun',
    '--suppress-message-center-popups',
    '--disable-infobars',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=Translate,OptimizationHints,MediaRouter,ExtensionDeveloperModeWarning,PrivacySandboxSettings4,ChromeForTestingDisclaimer,HttpsFirstMode,HttpsUpgrades'
  );

  // In Normal User Mode, NEVER add test automation switches.
  // In Automation Mode, inject rebrowser-patches CDP isolation switch ONLY when running native stealth engine.
  if (mode === 'automation' && isNativeStealth) {
    args.push('--mahi-cdp-isolated');
  }

  // Native Font Masking Mode (--font-masking-mode=1|2|3)
  const isMobileUa = Boolean(
    settings?.browser?.userAgent?.includes('Android') ||
      settings?.browser?.userAgent?.includes('Mobile') ||
      settings?.mobile?.enable
  );

  // Window Dimensions
  let w = settings?.display?.screenWidth || 1280;
  let h = settings?.display?.screenHeight || 800;
  if (isMobileUa) {
    // Elegant phone window dimensions for desktop usage
    w = 460;
    h = 920;
  } else {
    w = Math.max(400, Number(w) || 1280);
    h = Math.max(400, Number(h) || 800);
  }
  const hasWindowSizeArg = settings?.browser?.additionalArgs?.some((arg: string) => arg.startsWith('--window-size='));
  if (!hasWindowSizeArg) {
    args.push(`--window-size=${w},${h}`);
  }

  // User Agent
  if (settings?.browser?.userAgent) {
    args.push(`--user-agent=${settings.browser.userAgent}`);
  }

  // Language / Locale
  if (settings?.locale?.language) {
    args.push(`--lang=${settings.locale.language}`);
  }

  // Native Timezone Override (--tz)
  if (settings?.locale?.timezone) {
    args.push(`--tz=${settings.locale.timezone}`);
  }

  args.push(`--font-masking-mode=${isMobileUa ? 1 : 2}`);
  if (isMobileUa) {
    args.push('--enable-features=TouchEvents,MobileViewport');
  }
  args.push('--password-store=basic');

  // WebRTC Leak Prevention (Strict IPv6 & UDP Leak Guard; never mutate stored settings)
  const effectiveWebrtc = resolveEffectiveWebrtcPolicy(settings);
  if (effectiveWebrtc === 'disable_non_proxied_udp' || effectiveWebrtc === 'default_public_interface_only') {
    applyStrictWebrtcArgs(args, effectiveWebrtc);
  }

  // Hardware Acceleration
  if (settings?.browser?.hardwareAcceleration === false) {
    args.push('--disable-gpu');
  }

  return args;
}
