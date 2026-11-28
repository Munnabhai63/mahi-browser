import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from '../../08_SECURITY/electron-bridge.js';
import type { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { deriveLocaleFromGeo } from '../../10_CONFIG/shared/constants/defaults.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import {
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  isProductionChromiumInstalled,
  getProductionChromiumExecutablePath,
  getBundledEngineExecutablePath,
  hasNativeStealthEngine,
} from '../managed-engine.js';
import { CURRENT_ENGINE_DISTRIBUTION } from '../../10_CONFIG/engine-config.js';
import { getProxyById, getDecryptedProxyCredentials, testAndSaveProxyStatus } from '../services/proxy-service.js';
import { getExtensions } from '../services/extension-service.js';
import { createProxyTunnel, type ProxyTunnelHandle } from '../proxy-tunnel.js';
import { injectNativeStealthPreferences } from '../stealth-native-preferences.js';
import { resolveMultiCoreExecutablePath } from '../services/multi-core-resolver.js';
import { buildVideoCaptureFlags } from '../services/video-capture-service.js';
import {
  log,
  debugLog,
  pushUniqueFlag,
  resolveEffectiveWebrtcPolicy,
  applyStrictWebrtcArgs,
  type TimezoneMismatchWarning,
  type LaunchedProcessInfo,
} from './launcher-shared.js';
import {
  cleanupStaleLocks,
  hasExistingSession,
  prepareSessionPersistence,
  buildSanitizedLaunchArgs,
} from './chromium-args-builder.js';
import {
  allocateEphemeralDebugPort,
  readAllowCdpDebugPortSettingSafe,
  applyCdpOverrides,
} from './cdp-attach-helper.js';
import { ensureProfileStealthExtension } from './extension-loader.js';
import { launchCamoufoxProfile } from './camoufox-launcher.js';

/**
 * Launches an isolated browser instance with full error handling and step-by-step logging.
 */
export async function launchBrowser(
  profile: Profile,
  launchOptions?: { mode?: 'normal' | 'automation'; allowCdpDebugPort?: boolean }
): Promise<LaunchedProcessInfo> {
  debugLog(`=======================================================`);
  debugLog(`[Launcher] Starting launch sequence for profile: "${profile.name}" (ID: ${profile.id})`);

  let proxyTunnel: ProxyTunnelHandle | undefined;

  // Dedicated isolated Camoufox launch branch
  if (profile.settings?.browser?.engine === 'camoufox') {
    return await launchCamoufoxProfile(profile, launchOptions);
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Resolve Browser Executable Path (Multi-Core Resolution & Managed Engine)
    // -------------------------------------------------------------
    const multiCore = resolveMultiCoreExecutablePath(
      profile.settings?.browser?.userAgent,
      profile.customExecutablePath,
      profile.settings?.browser?.engine
    );
    let executablePath: string = multiCore.executablePath;

    // Safeguard: Never spawn 3rd-party proprietary GoLogin Orbita binary which aborts with exit code 403
    if (executablePath?.toLowerCase().includes('.gologin')) {
      debugLog(
        `[Launcher Step 1/7 WARNING] Blocked proprietary GoLogin binary "${executablePath}". Switching to authoritative MAHI engine.`
      );
      executablePath = getBundledEngineExecutablePath() || getProductionChromiumExecutablePath();
    }

    debugLog(
      `[Launcher Step 1/7] Engine resolved via multi-core matcher (${multiCore.coreType}, matched=${multiCore.isExactVersionMatch}): "${executablePath}"`
    );

    if (!fs.existsSync(executablePath)) {
      if (CURRENT_ENGINE_DISTRIBUTION === 'CHROMIUM_PRODUCTION' && isProductionChromiumInstalled()) {
        executablePath = getProductionChromiumExecutablePath();
      } else if (isManagedEngineInstalled()) {
        executablePath = getManagedEngineExecutablePath();
      } else {
        const candidatePath = getProductionChromiumExecutablePath();
        if (fs.existsSync(candidatePath)) {
          executablePath = candidatePath;
        } else {
          const bundledCandidate = getBundledEngineExecutablePath();
          if (bundledCandidate && fs.existsSync(bundledCandidate)) {
            executablePath = bundledCandidate;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Step 2: Validate Executable Existence & Access
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 2/7] Verifying browser executable existence...`);
    if (!executablePath || !fs.existsSync(executablePath)) {
      const errMsg = `Browser executable not found at: "${executablePath || 'undefined'}". Please run Engine Repair in Settings or reinstall MAHI Browser.`;
      debugLog(`[Launcher Step 2/7 ERROR] ${errMsg}`);
      throw new Error(errMsg);
    }
    debugLog(`[Launcher Step 2/7] Executable verified successfully.`);

    // -------------------------------------------------------------
    // Step 3: Prepare Storage Directory & Session Persistence
    // -------------------------------------------------------------
    const storageDir = path.resolve(profile.storagePath);
    debugLog(`[Launcher Step 3/7] Preparing profile storage directory: "${storageDir}"...`);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      debugLog(`[Launcher Step 3/7] Created new storage directory.`);
    } else {
      debugLog(`[Launcher Step 3/7] Storage directory exists. Cleaning stale locks from previous sessions...`);
      cleanupStaleLocks(storageDir);
    }

    prepareSessionPersistence(storageDir, profile.name, profile.settings?.browser?.startupUrl);
    const isExistingSession = hasExistingSession(storageDir);
    debugLog(`[Launcher Step 3/7] Session Persistence: Existing session detected = ${isExistingSession}`);

    // -------------------------------------------------------------
    // Step 4: Resolve Runtime Geo-Synced Locale (No Stored Mutation) & Build Args
    // -------------------------------------------------------------
    const effectiveSettings = JSON.parse(JSON.stringify(profile.settings || {}));
    const cachedProxy =
      !effectiveSettings?.network?.directConnection && effectiveSettings?.network?.proxyId
        ? getProxyById(effectiveSettings.network.proxyId)
        : null;
    const cachedCredentials = cachedProxy ? getDecryptedProxyCredentials(cachedProxy.id) : null;
    let cachedHealthResult: {
      success: boolean;
      ip?: string;
      countryCode?: string;
      timezone?: string;
      latencyMs?: number;
      errorMessage?: string;
    } | null = null;
    let timezoneMismatchWarning: TimezoneMismatchWarning | undefined;

    if (cachedProxy) {
      try {
        debugLog(`[Launcher Step 4/7] Running proxy geo lookup for ${cachedProxy.host}:${cachedProxy.port}...`);
        cachedHealthResult = await testAndSaveProxyStatus(cachedProxy.id);
      } catch (geoErr: unknown) {
        debugLog(
          `[Launcher Step 4/7 WARNING] Proxy geo lookup failed: ${geoErr instanceof Error ? geoErr.message : String(geoErr)}`
        );
      }

      const geoCountry = cachedHealthResult?.countryCode || cachedProxy.countryRegion;
      const geoTimezone = cachedHealthResult?.timezone || cachedProxy.timezone;
      const derivedLocale = deriveLocaleFromGeo({ countryCode: geoCountry, timezone: geoTimezone });

      if (effectiveSettings?.locale?.autoSyncFromIp === true && derivedLocale) {
        effectiveSettings.locale = effectiveSettings.locale || {};
        effectiveSettings.locale.timezone = derivedLocale.timezone;
        effectiveSettings.locale.language = derivedLocale.language;
        effectiveSettings.locale.languagesList = derivedLocale.languagesList;
        debugLog(
          `[Launcher Step 4/7] Geo Locale Auto-Sync applied runtime timezone=${derivedLocale.timezone}, language=${derivedLocale.language} (stored JSON untouched).`
        );
        try {
          logActivity(
            'PROFILE',
            'INFO',
            'Geo Locale Auto-Sync',
            `Runtime locale synced to ${derivedLocale.timezone} (${derivedLocale.language}) for "${profile.name}".`,
            profile.id
          );
        } catch (auditErr) {
          log.debug('Skipped Geo Locale Auto-Sync audit write', {
            profileId: profile.id,
            err: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        }
      } else if (
        derivedLocale?.timezone &&
        effectiveSettings?.locale?.timezone &&
        derivedLocale.timezone !== effectiveSettings.locale.timezone
      ) {
        timezoneMismatchWarning = {
          profileId: profile.id,
          profileName: profile.name,
          profileTimezone: effectiveSettings.locale.timezone,
          proxyTimezone: derivedLocale.timezone,
          suggestedLanguage: derivedLocale.language,
          suggestedLanguagesList: derivedLocale.languagesList,
        };
        debugLog(
          `[Launcher Step 4/7 WARNING] Timezone mismatch for "${profile.name}": profile=${effectiveSettings.locale.timezone}, proxy=${derivedLocale.timezone}`
        );
        try {
          const wins = BrowserWindow?.getAllWindows?.() || [];
          for (const win of wins) {
            if (!win.isDestroyed()) {
              win.webContents.send('profile:timezoneMismatch', timezoneMismatchWarning);
            }
          }
        } catch (ipcErr) {
          log.debug('Skipped timezoneMismatch IPC notification', {
            profileId: profile.id,
            err: ipcErr instanceof Error ? ipcErr.message : String(ipcErr),
          });
        }
      }
    }

    const settings = effectiveSettings;
    // 100% Native C++ Stealth: Inject verified Orbita schema into Default/Preferences (Zero extension footprint)
    injectNativeStealthPreferences(storageDir, profile, settings);

    const exposeCdpPort =
      launchOptions?.mode === 'automation' ||
      Boolean(launchOptions?.allowCdpDebugPort ?? readAllowCdpDebugPortSettingSafe());
    const debugPort = exposeCdpPort ? await allocateEphemeralDebugPort() : 0;

    // Ensure the stealth extension (Client Hints, Canvas/WebGL Guard, Shortcuts) is loaded
    // When native C++ stealth engine is active via mahi-engine.json, omit stealth-core.js (zero double noise)
    const isNativeStealth = hasNativeStealthEngine(executablePath);
    const titleExtDir = ensureProfileStealthExtension(storageDir, profile.id, profile.name, settings, {
      nativeStealthActive: isNativeStealth,
      ...(debugPort > 0 ? { debugPort } : {}),
    });

    // Gather user-enabled extensions
    let profileExtensionPaths: string[] = [];
    try {
      const exts = getExtensions(profile.id);
      profileExtensionPaths = exts
        .filter((e) => e.enabled && e.sourcePath && fs.existsSync(e.sourcePath))
        .map((e) => e.sourcePath);
      debugLog(
        `[Launcher Step 4/7] Found ${profileExtensionPaths.length} enabled extensions for profile "${profile.name}".`
      );
    } catch (extErr: unknown) {
      debugLog(
        `[Launcher Step 4/7 WARNING] Failed to load profile extensions: ${extErr instanceof Error ? extErr.message : String(extErr)}`
      );
    }

    const allExtensionPaths = [titleExtDir, ...profileExtensionPaths];
    const validExtensionPaths = Array.from(
      new Set(
        allExtensionPaths
          .filter((p): p is string => Boolean(p && typeof p === 'string'))
          .map((p) => path.resolve(p.trim()).replace(/[/\\]+$/, ''))
          .filter((p) => fs.existsSync(p))
      )
    );
    const loadExtensionsArg = validExtensionPaths.join(',');

    const args = buildSanitizedLaunchArgs({
      storageDir,
      debugPort: debugPort > 0 ? debugPort : undefined,
      loadExtensionsArg,
      settings,
      mode: launchOptions?.mode || 'normal',
      isNativeStealth,
      allowCdpDebugPort: exposeCdpPort,
    });

    // Virtual Video Capture Injection (KYC Facial Verification Bypass)
    const videoCapture = buildVideoCaptureFlags(settings?.fakeVideoCapture);
    if (videoCapture.isValid && videoCapture.flags.length > 0) {
      args.push(...videoCapture.flags);
      debugLog(`[Launcher Step 4/7] Injected virtual camera stream from: ${videoCapture.resolvedPath}`);
    }

    // Native Font Masking Flags (GoLogin Parity)
    if (
      settings?.fingerprint?.fonts &&
      Array.isArray(settings.fingerprint.fonts) &&
      settings.fingerprint.fonts.length > 0
    ) {
      args.push('--font-masking-mode=1');
      args.push(`--font-masking-list=${settings.fingerprint.fonts.join(';')}`);
      debugLog(`[Launcher Step 4/7] Configured font masking list (${settings.fingerprint.fonts.length} fonts).`);
    }

    // Native C++ CDP Execution Isolation (rebrowser-patches parity - strictly for native stealth cores)
    if (isNativeStealth) {
      if (!args.includes('--mahi-cdp-isolated')) {
        args.push('--mahi-cdp-isolated');
      }
      debugLog(`[Launcher Step 4/7] Configured native CDP execution isolation (--mahi-cdp-isolated).`);
    }

    debugLog(`[Launcher Step 4/7] Built ${args.length} sanitized production launch arguments.`);

    // -------------------------------------------------------------
    // Step 5: Network & Proxy Configuration (Step 15 Direct Network Contract)
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 5/7] Configuring network and proxy settings...`);
    if (!settings?.network?.directConnection && settings?.network?.proxyId) {
      const proxy = cachedProxy || getProxyById(settings.network.proxyId);
      if (proxy) {
        const credentials = cachedCredentials ?? getDecryptedProxyCredentials(proxy.id);

        if (credentials?.username && credentials?.password) {
          if (cachedHealthResult?.success) {
            debugLog(
              `[Launcher Step 5/7] Proxy healthy (cached check). Actual IP: ${cachedHealthResult.ip || 'unknown'} | Country: ${cachedHealthResult.countryCode || 'unknown'} | Latency: ${cachedHealthResult.latencyMs}ms`
            );
          } else if (cachedHealthResult && !cachedHealthResult.success) {
            debugLog(
              `[Launcher Step 5/7 WARNING] Proxy health check failed: ${cachedHealthResult.errorMessage || 'Unknown error'}. Attempting tunnel anyway...`
            );
          }

          proxyTunnel = await createProxyTunnel({
            upstreamHost: proxy.host,
            upstreamPort: proxy.port,
            upstreamProtocol: proxy.protocol,
            username: credentials.username,
            password: credentials.password,
            profileId: profile.id,
          });

          args.push(`--proxy-server=http://127.0.0.1:${proxyTunnel.port}`);
          args.push('--proxy-bypass-list=<-loopback>');
          args.push(`--host-resolver-rules=MAP * 0.0.0.0 , EXCLUDE ${proxy.host}`);
          if (resolveEffectiveWebrtcPolicy(settings) !== 'allow_all') {
            applyStrictWebrtcArgs(args, 'disable_non_proxied_udp');
          }
          debugLog(
            `[Launcher Step 5/7] Authenticating Tunnel ready: 127.0.0.1:${proxyTunnel.port} -> ${proxy.host}:${proxy.port}`
          );
        } else {
          args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
          args.push('--proxy-bypass-list=<-loopback>');
          args.push(`--host-resolver-rules=MAP * 0.0.0.0 , EXCLUDE ${proxy.host}`);
          if (resolveEffectiveWebrtcPolicy(settings) !== 'allow_all') {
            applyStrictWebrtcArgs(args, 'disable_non_proxied_udp');
          }
          debugLog(`[Launcher Step 5/7] Direct Proxy Server: ${proxy.protocol}://${proxy.host}:${proxy.port}`);
        }
      } else {
        debugLog(
          `[Launcher Step 5/7] Proxy ID ${settings.network.proxyId} not found in database, enforcing direct connection.`
        );
        args.push('--no-proxy-server');
      }
    } else {
      // Step 15 Direct Network Contract: Profile with NO proxy must strictly enforce direct connection without WPAD
      args.push('--no-proxy-server');
      debugLog(`[Launcher Step 5/7] Direct connection contract enforced (--no-proxy-server).`);
    }

    // Custom Additional Arguments
    if (settings?.browser?.additionalArgs && Array.isArray(settings.browser.additionalArgs)) {
      for (const a of settings.browser.additionalArgs) {
        if (a.trim()) pushUniqueFlag(args, a.trim());
      }
    }

    // Startup URL or Warmer Queue URLs
    const qFile = path.join(storageDir, 'mahi_warmer_queue.json');
    if (fs.existsSync(qFile)) {
      try {
        const qData = JSON.parse(fs.readFileSync(qFile, 'utf8'));
        if (Array.isArray(qData.sites) && qData.sites.length > 0) {
          for (const sUrl of qData.sites) {
            args.push(sUrl);
          }
          debugLog(`[Launcher Step 5/7] Warming sequence active — opening ${qData.sites.length} authoritative tabs`);
        }
      } catch (qErr) {
        log.warn('Failed parsing mahi_warmer_queue.json', {
          qFile,
          err: qErr instanceof Error ? qErr.message : String(qErr),
        });
      }
    } else {
      const startupUrl = settings?.browser?.startupUrl?.trim() || 'about:blank';
      args.push(startupUrl);
      debugLog(`[Launcher Step 5/7] Opening startup URL: ${startupUrl}`);
    }

    // -------------------------------------------------------------
    // Step 6: Spawn Browser Process
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 6/7] Spawning browser executable: ${executablePath}`);
    debugLog(`[Launcher Step 6/7] Target: ${executablePath} | Args count: ${args.length}`);

    // Clean execution environment: Suppress Chromium API keys missing banner, propagate CDP isolation, and set POSIX/V8 TZ
    const browserEnv: Record<string, string | undefined> = {
      ...process.env,
      GOOGLE_API_KEY: 'no',
      GOOGLE_DEFAULT_CLIENT_ID: 'no',
      GOOGLE_DEFAULT_CLIENT_SECRET: 'no',
      ...(settings?.locale?.timezone ? { TZ: settings.locale.timezone } : {}),
      ...(isNativeStealth || args.includes('--mahi-cdp-isolated') ? { MAHI_CDP_ISOLATED: '1' } : {}),
    };

    const child = spawn(executablePath, args, {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
      env: browserEnv,
    });

    if (!child.pid) {
      if (proxyTunnel) proxyTunnel.close();
      throw new Error(`Failed to spawn browser process — no PID returned from OS.`);
    }

    debugLog(`[Launcher Step 6/7] Process spawned successfully with PID: ${child.pid}`);

    if (process.env.MAHI_TZ_DEBUG === '1') {
      debugLog(`[TZ DEBUG] env TZ = ${browserEnv.TZ}`);
      debugLog(`[TZ DEBUG] --tz arg present = ${args.some((a) => a.startsWith('--tz='))}`);
      debugLog(
        `[TZ DEBUG] args = ${args.filter((a) => a.startsWith('--tz=') || a.startsWith('--lang=') || a.startsWith('--user-agent=')).join(' | ')}`
      );
    }

    if (exposeCdpPort && debugPort > 0 && settings?.locale?.timezone) {
      const targetLocale =
        (Array.isArray(settings?.locale?.languagesList)
          ? settings.locale.languagesList[0]
          : settings?.locale?.language) || 'en-US';
      const ok = await applyCdpOverrides(debugPort, settings.locale.timezone, targetLocale);
      if (!ok) debugLog('[Launcher] CDP timezone override FAILED — JS fallback stays active');
    }

    // -------------------------------------------------------------
    // Step 7: Unref & Return Process Information
    // -------------------------------------------------------------
    try {
      child.unref();
    } catch (unrefErr) {
      debugLog(`[Launcher Step 7/7] Note: child.unref() threw: ${unrefErr}`);
    }

    debugLog(`[Launcher] Launch sequence completed successfully for "${profile.name}" (PID: ${child.pid}).`);
    debugLog(`=======================================================`);

    return {
      process: child,
      pid: child.pid,
      profileId: profile.id,
      startedAt: new Date().toISOString(),
      executablePath,
      storageDir,
      proxyTunnel,
      ...(exposeCdpPort && debugPort > 0 ? { debugPort } : {}),
      ...(timezoneMismatchWarning ? { timezoneMismatch: timezoneMismatchWarning } : {}),
    };
  } catch (err: unknown) {
    if (proxyTunnel) {
      try {
        proxyTunnel.close();
      } catch (tunnelErr) {
        log.debug('Error closing proxy tunnel during launch failure cleanup', {
          profileId: profile.id,
          err: tunnelErr instanceof Error ? tunnelErr.message : String(tunnelErr),
        });
      }
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    debugLog(`[Launcher CRITICAL ERROR] Failed to launch profile "${profile.name}": ${errorMsg}`);
    debugLog(`=======================================================`);
    throw err instanceof Error ? err : new Error(errorMsg);
  }
}
