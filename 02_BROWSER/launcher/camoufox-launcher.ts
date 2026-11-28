import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { resolveExecutablePath } from '../detector.js';
import { getProxyById, getDecryptedProxyCredentials, testAndSaveProxyStatus } from '../services/proxy-service.js';
import { createProxyTunnel, type ProxyTunnelHandle } from '../proxy-tunnel.js';
import { ensureCamoufoxInstalled } from '../services/engine-download-service.js';
import {
  log,
  debugLog,
  type LaunchedProcessInfo,
  type LauncherFingerprintSettings,
  type LauncherProfileSettings,
} from './launcher-shared.js';
import { cleanupStaleLocks } from './chromium-args-builder.js';

/**
 * Dedicated launch branch for Camoufox (C++ Patched Firefox) profiles.
 * Suppresses all Chromium-specific flags and applies clean Firefox CLI flags and
 * chunked CAMOU_CONFIG_* environment variables for deep anti-detect spoofing.
 */
export async function launchCamoufoxProfile(
  profile: Profile,
  _launchOptions?: { mode?: 'normal' | 'automation' }
): Promise<LaunchedProcessInfo> {
  debugLog(`=======================================================`);
  debugLog(`[Camoufox Launcher] Starting launch sequence for profile: "${profile.name}" (ID: ${profile.id})`);

  let proxyTunnel: ProxyTunnelHandle | undefined;

  try {
    let executablePath: string;
    try {
      executablePath = resolveExecutablePath('camoufox', profile.customExecutablePath);
    } catch {
      debugLog(`[Camoufox Launcher] Camoufox not found locally, provisioning on-demand...`);
      executablePath = await ensureCamoufoxInstalled({
        onProgress: (receivedBytes, totalBytes) => {
          const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
          debugLog(`[Camoufox Provisioner] Downloading: ${receivedBytes}/${totalBytes} (${pct}%)`);
        },
      });
    }
    debugLog(`[Camoufox Launcher] Executable resolved: "${executablePath}"`);

    const storageDir = path.resolve(profile.storagePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    } else {
      cleanupStaleLocks(storageDir);
    }

    const settings: LauncherProfileSettings = profile.settings || {};
    const fp: LauncherFingerprintSettings = settings.fingerprint || {};
    const disp: Partial<NonNullable<LauncherProfileSettings['display']>> = settings.display || {};
    const loc: Partial<NonNullable<LauncherProfileSettings['locale']>> = settings.locale || {};

    // Build clean Firefox CLI arguments
    const args: string[] = ['-profile', storageDir, '-no-remote', '-new-instance'];

    // Proxy and WebRTC configuration
    let resolvedPublicIp: string | undefined;
    const firefoxPrefs: Record<string, string | number | boolean> = {};

    if (!settings?.network?.directConnection && settings?.network?.proxyId) {
      const proxy = getProxyById(settings.network.proxyId);
      if (proxy) {
        try {
          debugLog(`[Camoufox Launcher] Testing proxy health for ${proxy.host}:${proxy.port}...`);
          const healthResult = await testAndSaveProxyStatus(proxy.id);
          if (healthResult?.ip && !healthResult.ip.startsWith('127.') && healthResult.ip !== '0.0.0.0') {
            resolvedPublicIp = healthResult.ip;
          }
        } catch (healthErr: unknown) {
          debugLog(
            `[Camoufox Launcher] Proxy health check note: ${healthErr instanceof Error ? healthErr.message : String(healthErr)}`
          );
        }

        const credentials = getDecryptedProxyCredentials(proxy.id);
        if (credentials?.username && credentials?.password) {
          proxyTunnel = await createProxyTunnel({
            upstreamHost: proxy.host,
            upstreamPort: proxy.port,
            upstreamProtocol: proxy.protocol,
            username: credentials.username,
            password: credentials.password,
            profileId: profile.id,
          });

          // Local tunnel is an HTTP proxy
          firefoxPrefs['network.proxy.type'] = 1;
          firefoxPrefs['network.proxy.http'] = '127.0.0.1';
          firefoxPrefs['network.proxy.http_port'] = proxyTunnel.port;
          firefoxPrefs['network.proxy.ssl'] = '127.0.0.1';
          firefoxPrefs['network.proxy.ssl_port'] = proxyTunnel.port;
          firefoxPrefs['network.proxy.no_proxies_on'] = 'localhost, 127.0.0.1';
        } else {
          // Direct unauthenticated proxy
          firefoxPrefs['network.proxy.type'] = 1;
          firefoxPrefs['network.proxy.no_proxies_on'] = 'localhost, 127.0.0.1';
          const isSocks = proxy.protocol === 'socks4' || proxy.protocol === 'socks5';
          if (isSocks) {
            firefoxPrefs['network.proxy.socks'] = proxy.host;
            firefoxPrefs['network.proxy.socks_port'] = proxy.port;
            firefoxPrefs['network.proxy.socks_version'] = proxy.protocol === 'socks4' ? 4 : 5;
            firefoxPrefs['network.proxy.socks_remote_dns'] = true;
          } else {
            firefoxPrefs['network.proxy.http'] = proxy.host;
            firefoxPrefs['network.proxy.http_port'] = proxy.port;
            firefoxPrefs['network.proxy.ssl'] = proxy.host;
            firefoxPrefs['network.proxy.ssl_port'] = proxy.port;
          }
        }
      } else {
        firefoxPrefs['network.proxy.type'] = 0;
      }
    } else {
      // Direct connection
      firefoxPrefs['network.proxy.type'] = 0;
    }

    // WebRTC policy (enforce proxy-only / disable UDP host candidates whenever masked, altered, proxy_only, or behind proxy)
    const webrtcOpt: string = String(settings?.network?.webrtc || 'default');
    if (webrtcOpt === 'disabled') {
      firefoxPrefs['media.peerconnection.enabled'] = false;
    } else if (
      webrtcOpt === 'proxy_only' ||
      webrtcOpt === 'masked' ||
      webrtcOpt === 'altered' ||
      webrtcOpt === 'disable_non_proxied_udp' ||
      webrtcOpt === 'default_public_interface_only' ||
      webrtcOpt === 'public_interface_only' ||
      webrtcOpt === 'noise' ||
      (webrtcOpt !== 'real' && webrtcOpt !== 'allow_all' && firefoxPrefs['network.proxy.type'] === 1)
    ) {
      firefoxPrefs['media.peerconnection.ice.proxy_only_if_behind_proxy'] = true;
      firefoxPrefs['media.peerconnection.ice.default_address_only'] = true;
      firefoxPrefs['media.peerconnection.ice.no_host'] = true;
    }

    // Synchronize Firefox user.js prefs in profile storage
    const userJsPath = path.join(storageDir, 'user.js');
    let existingUserJs = '';
    if (fs.existsSync(userJsPath)) {
      try {
        existingUserJs = fs.readFileSync(userJsPath, 'utf8');
      } catch (err) {
        log.warn('Failed reading existing Camoufox user.js preferences', {
          userJsPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const MAHI_BLOCK_START = '// --- MAHI CAMOUFOX NETWORK CONFIG START ---';
    const MAHI_BLOCK_END = '// --- MAHI CAMOUFOX NETWORK CONFIG END ---';
    const blockRegex = new RegExp(`${MAHI_BLOCK_START}[\\s\\S]*?${MAHI_BLOCK_END}\\n?`, 'g');
    const cleanedUserJs = existingUserJs.replace(blockRegex, '').trim();

    const prefLines: string[] = [MAHI_BLOCK_START];
    for (const [key, val] of Object.entries(firefoxPrefs)) {
      const serializedVal = typeof val === 'string' ? JSON.stringify(val) : String(val);
      prefLines.push(`user_pref("${key}", ${serializedVal});`);
    }
    prefLines.push(MAHI_BLOCK_END);
    const finalUserJs = cleanedUserJs ? `${cleanedUserJs}\n\n${prefLines.join('\n')}\n` : `${prefLines.join('\n')}\n`;
    fs.writeFileSync(userJsPath, finalUserJs, 'utf8');

    // Startup URL
    const startupUrl = settings?.browser?.startupUrl?.trim() || 'about:blank';
    args.push(startupUrl);

    // Resolve ISO 3166-1 alpha-2 region code and base language
    const rawLang = loc.language || 'en-US';
    const langParts = rawLang.split(/[-_]/);
    const baseLang = langParts[0].toLowerCase() || 'en';
    let regionCode = langParts.length > 1 ? langParts[1].toUpperCase() : '';
    if (regionCode?.length !== 2) {
      const tzToRegion: Record<string, string> = {
        'America/New_York': 'US',
        'America/Chicago': 'US',
        'America/Los_Angeles': 'US',
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Madrid': 'ES',
        'Europe/Rome': 'IT',
        'Europe/Moscow': 'RU',
        'Asia/Tokyo': 'JP',
        'Asia/Shanghai': 'CN',
        'Asia/Kolkata': 'IN',
        'Asia/Dubai': 'AE',
        'Asia/Singapore': 'SG',
        'Australia/Sydney': 'AU',
        'America/Sao_Paulo': 'BR',
        'America/Toronto': 'CA',
      };
      regionCode = (loc.timezone && tzToRegion[loc.timezone]) || 'US';
    }

    // Build Camoufox JSON configuration (exact keys validated against camoufox@0.5.9)
    const camouConfigObj: Record<string, string | number> = {
      'navigator.userAgent':
        settings?.browser?.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'navigator.platform': fp.platform || 'Win32',
      'navigator.hardwareConcurrency': fp.hardwareConcurrency || 8,
      'screen.width': disp.screenWidth || 1920,
      'screen.height': disp.screenHeight || 1080,
      'webGl:vendor': fp.webglVendor || 'Google Inc. (NVIDIA)',
      'webGl:renderer': fp.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      timezone: loc.timezone || 'America/New_York',
      'locale:language': baseLang,
      'locale:region': regionCode,
    };

    if (resolvedPublicIp) {
      camouConfigObj['webrtc:ipv4'] = resolvedPublicIp;
    }

    // Serialize and chunk Camoufox configuration payload into CAMOU_CONFIG_1, CAMOU_CONFIG_2, ...
    const camouJson = JSON.stringify(camouConfigObj);
    const CHUNK_SIZE = 1800;
    const chunkedEnv: Record<string, string> = {};
    for (let i = 0; i < camouJson.length; i += CHUNK_SIZE) {
      const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
      chunkedEnv[`CAMOU_CONFIG_${chunkIdx}`] = camouJson.substring(i, i + CHUNK_SIZE);
    }

    // Chunk preferences into CAMOU_PREFS_1, CAMOU_PREFS_2, ...
    const prefsJson = JSON.stringify(firefoxPrefs);
    const chunkedPrefsEnv: Record<string, string> = {};
    for (let i = 0; i < prefsJson.length; i += CHUNK_SIZE) {
      const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
      chunkedPrefsEnv[`CAMOU_PREFS_${chunkIdx}`] = prefsJson.substring(i, i + CHUNK_SIZE);
    }

    const camouEnv: Record<string, string | undefined> = {
      ...process.env,
      ...chunkedEnv,
      ...chunkedPrefsEnv,
    };

    const child = spawn(executablePath, args, {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
      env: camouEnv,
    });

    if (!child.pid) {
      if (proxyTunnel) proxyTunnel.close();
      throw new Error(`Failed to spawn Camoufox process — no PID returned from OS.`);
    }

    try {
      child.unref();
    } catch (unrefErr) {
      log.debug('Non-fatal child.unref error for Camoufox process', {
        pid: child.pid,
        err: unrefErr instanceof Error ? unrefErr.message : String(unrefErr),
      });
    }

    debugLog(`[Camoufox Launcher] Spawned successfully with PID: ${child.pid}`);
    debugLog(`=======================================================`);

    return {
      process: child,
      pid: child.pid,
      profileId: profile.id,
      startedAt: new Date().toISOString(),
      executablePath,
      storageDir,
      proxyTunnel,
    };
  } catch (err: unknown) {
    if (proxyTunnel) {
      try {
        proxyTunnel.close();
      } catch (tunnelErr) {
        log.debug('Error closing Camoufox proxy tunnel on launch failure', {
          profileId: profile.id,
          err: tunnelErr instanceof Error ? tunnelErr.message : String(tunnelErr),
        });
      }
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    debugLog(`[Camoufox Launcher CRITICAL ERROR] Failed to launch profile "${profile.name}": ${errorMsg}`);
    debugLog(`=======================================================`);
    throw err instanceof Error ? err : new Error(errorMsg);
  }
}
