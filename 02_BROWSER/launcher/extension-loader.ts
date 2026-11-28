import fs from 'node:fs';
import path from 'node:path';
import {
  getDeterministicGreaseTriplet,
  getDeterministicWebglLimits,
} from '../../10_CONFIG/shared/utils/fingerprint-coherence.js';
import { CHROMIUM_PRODUCTION_VERSION } from '../../10_CONFIG/engine-config.js';
import {
  log,
  type LauncherFingerprintSettings,
  type LauncherProfileSettings,
  type StealthScriptContext,
  resolveEffectiveWebrtcPolicy,
} from './launcher-shared.js';
import { getProfileDebugPort } from './cdp-attach-helper.js';
import {
  buildStealthCoreScript,
  buildBackgroundWorkerScript,
  buildContentScript,
} from './stealth-script-builder.js';

function resolveStealthContext(
  profileId: string,
  profileName: string,
  settings?: LauncherProfileSettings | null,
  explicitDebugPort?: number
): StealthScriptContext {
  const safeProfileName = profileName || profileId || 'Profile 1';
  const numMatch = safeProfileName.match(/\d+/);
  const badgeNumber = numMatch ? numMatch[0] : '1';

  // Detect platform and device metadata from settings, fingerprint and User-Agent
  const ua = settings?.browser?.userAgent || '';
  const fp: LauncherFingerprintSettings = settings?.fingerprint || {};
  const isMobile = Boolean(ua.includes('Android') || ua.includes('Mobile') || settings?.mobile?.enable);
  const isMac = !isMobile && ua.includes('Macintosh');
  const isLinux = !isMobile && !isMac && (ua.includes('Linux') || ua.includes('X11'));
  const isMacArm =
    isMac && Boolean(fp.isM1 || fp.architecture === 'arm64' || ua.includes('arm64') || ua.includes('aarch64'));

  let mobileModel = 'Pixel 8';
  let mobileOsVersion = '14.0.0';
  if (isMobile) {
    const match = ua.match(/Android\s+([0-9.]+)(?:;\s*([^;)]+))?/i);
    if (match) {
      if (match[1]) {
        const parts = match[1].split('.');
        mobileOsVersion =
          parts.length === 1 ? `${parts[0]}.0.0` : parts.length === 2 ? `${parts[0]}.${parts[1]}.0` : match[1];
      }
      if (match[2]) {
        const rawModel = match[2].replace(/\s*Build\/.*$/i, '').trim();
        if (rawModel) {
          mobileModel = rawModel;
        }
      }
    }
  }

  const clientHintsPlatform = isMobile ? 'Android' : isMac ? 'macOS' : isLinux ? 'Linux' : 'Windows';
  const clientHintsModel = isMobile ? mobileModel : '';
  const clientHintsPlatformVersion = isMobile ? mobileOsVersion : isMac ? '14.5.0' : isLinux ? '6.5.0' : '15.0.0';
  const clientHintsArch = isMobile ? 'arm' : isMac ? (isMacArm ? 'arm' : 'x86') : isLinux ? 'x86_64' : 'x86';
  const chromeVerMatch = ua.match(/Chrome\/([0-9.]+)/i);
  const chromeFullVer = chromeVerMatch ? chromeVerMatch[1] : CHROMIUM_PRODUCTION_VERSION;
  const chromeMajorVer = chromeFullVer.split('.')[0] || '138';

  const rawLangs = settings?.locale?.languagesList || settings?.locale?.languages || settings?.locale?.language;
  const languagesList: string[] = Array.isArray(rawLangs)
    ? rawLangs
    : typeof rawLangs === 'string' && rawLangs.trim().length > 0
      ? rawLangs
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ['en-US', 'en'];
  const acceptLanguageHeader = languagesList
    .map((l: string, idx: number) => (idx === 0 ? l : `${l};q=${Math.max(0.1, 1 - idx * 0.1).toFixed(1)}`))
    .join(', ');

  const profileDebugPort = explicitDebugPort !== undefined ? explicitDebugPort : getProfileDebugPort(profileId);
  const isCamoufox = settings?.browser?.engine === 'camoufox';
  const isEdge = settings?.browser?.engine === 'edge';
  const targetBrandName = isEdge ? 'Microsoft Edge' : 'Google Chrome';

  const storedSalt = fp?.fingerprintSeed ?? fp?.noiseSeed ?? fp?.seed ?? '';
  const rawSeedInput = storedSalt
    ? `${String(profileId || 'default')}:${String(storedSalt)}`
    : String(profileId || 'default');

  const { greaseBrand, greaseVersion } = getDeterministicGreaseTriplet(rawSeedInput);
  const glLimits = getDeterministicWebglLimits(rawSeedInput, isMobile);

  const defaultOsFonts = isMobile
    ? ['Roboto', 'Noto Sans', 'Droid Sans']
    : isMac
      ? [
          'Arial',
          'Avenir',
          'Avenir Next',
          'Courier New',
          'Geneva',
          'Georgia',
          'Helvetica',
          'Helvetica Neue',
          'Lucida Grande',
          'Menlo',
          'Monaco',
          'SF Pro',
          'Times New Roman',
          'Verdana',
        ]
      : isLinux
        ? [
            'DejaVu Sans',
            'DejaVu Serif',
            'DejaVu Sans Mono',
            'Liberation Sans',
            'Liberation Serif',
            'Liberation Mono',
            'Ubuntu',
            'FreeSans',
            'FreeSerif',
          ]
        : [
            'Arial',
            'Calibri',
            'Cambria',
            'Consolas',
            'Courier New',
            'Georgia',
            'Lucida Console',
            'MS Sans Serif',
            'Segoe UI',
            'Tahoma',
            'Times New Roman',
            'Trebuchet MS',
            'Verdana',
          ];
  const allowedFonts: string[] =
    Array.isArray(fp.fonts) && fp.fonts.length > 0
      ? fp.fonts.map((f: unknown) => String(f)).filter(Boolean)
      : defaultOsFonts;

  const hasCustomNonLegacyGrease = Boolean(
    fp.clientHints?.brands &&
      Array.isArray(fp.clientHints.brands) &&
      fp.clientHints.brands.length > 0 &&
      !fp.clientHints.brands.some((b) => b?.brand === 'Not/A)Brand' && String(b?.version) === '8')
  );

  const effectiveBrands =
    hasCustomNonLegacyGrease && fp.clientHints?.brands
      ? fp.clientHints.brands.map((b) => ({
          brand: String(b.brand),
          version:
            b.brand === 'Chromium' || b.brand === 'Google Chrome' || b.brand === 'Microsoft Edge'
              ? chromeMajorVer
              : String(b.version),
        }))
      : [
          { brand: greaseBrand, version: greaseVersion },
          { brand: 'Chromium', version: chromeMajorVer },
          { brand: targetBrandName, version: chromeMajorVer },
        ];

  const effectiveFullVersionList =
    hasCustomNonLegacyGrease &&
    Array.isArray(fp.clientHints?.fullVersionList) &&
    fp.clientHints.fullVersionList.length > 0
      ? fp.clientHints.fullVersionList.map((b) => ({
          brand: String(b.brand),
          version:
            b.brand === 'Chromium' || b.brand === 'Google Chrome' || b.brand === 'Microsoft Edge'
              ? chromeFullVer
              : String(b.version),
        }))
      : effectiveBrands.map((b: { brand: string; version: string }) => ({
          brand: b.brand,
          version:
            b.brand === 'Chromium' || b.brand === 'Google Chrome' || b.brand === 'Microsoft Edge'
              ? chromeFullVer
              : `${b.version}.0.0.0`,
        }));

  const gpuSpoofOn = Boolean(fp?.webglVendor && fp?.webglRenderer);
  return {
    profileId,
    profileName,
    badgeNumber,
    rawSeedInput,
    profileDebugPort,
    isMobile,
    isMac,
    isLinux,
    isMacArm,
    isCamoufox,
    chromeMajorVer,
    chromeFullVer,
    effectiveBrands,
    effectiveFullVersionList,
    allowedFonts,
    glLimits,
    osVoiceProfile: isMobile ? 'android' : isMac ? 'macos' : isLinux ? 'linux' : 'windows',
    targetScreenWidth: settings?.display?.screenWidth || (isMobile ? 412 : 1920),
    targetScreenHeight: settings?.display?.screenHeight || (isMobile ? 915 : 1080),
    displayDpr: settings?.display?.deviceScaleFactor || (isMobile ? 2.625 : 1),
    targetColorDepth: settings?.display?.colorDepth || 24,
    clientHintsPlatform,
    clientHintsModel,
    clientHintsPlatformVersion,
    clientHintsArch,
    targetTimezone: settings?.locale?.timezone || '',
    hardwareConcurrency:
      fp.hardwareConcurrency || (isMobile ? 8 : isMac ? (isMacArm ? 12 : 8) : isLinux ? 8 : 16),
    deviceMemory: fp.deviceMemory || (isMobile ? 8 : isLinux ? 8 : 16),
    platformStr: isMobile ? 'Linux armv8l' : isMac ? 'MacIntel' : isLinux ? 'Linux x86_64' : 'Win32',
    maxTouchPoints: fp.maxTouchPoints !== undefined ? fp.maxTouchPoints : isMobile ? 5 : 0,
    userAgent: ua,
    languagesList,
    acceptLanguageHeader,
    canvasMode: fp.canvas || 'noise',
    audioMode: fp.audio || 'noise',
    webglMode: fp.webgl || 'noise',
    clientRectsMode: fp.clientRects || 'noise',
    gpuSpoofOn,
    gpuVendor: gpuSpoofOn ? (fp.webglVendor as string) : '',
    gpuRenderer: gpuSpoofOn ? (fp.webglRenderer as string) : '',
    webrtcOpt: resolveEffectiveWebrtcPolicy(settings),
    showProfileBadge: settings?.browser?.showProfileBadge === true || settings?.showProfileBadge === true,
  };
}

function buildDnrRules(ctx: StealthScriptContext) {
  const secChUaHeader = ctx.effectiveBrands
    .map((b: { brand: string; version: string }) => `"${b.brand}";v="${b.version}"`)
    .join(', ');
  const secChUaFullVersionHeader = ctx.effectiveFullVersionList
    .map((b: { brand: string; version: string }) => `"${b.brand}";v="${b.version}"`)
    .join(', ');
  const clientHintsMobile = ctx.isMobile ? '?1' : '?0';

  const dnrRequestHeaders = ctx.isCamoufox
    ? [{ header: 'accept-language', operation: 'set', value: ctx.acceptLanguageHeader }]
    : [
        { header: 'sec-ch-ua', operation: 'set', value: secChUaHeader },
        { header: 'sec-ch-ua-full-version-list', operation: 'set', value: secChUaFullVersionHeader },
        { header: 'sec-ch-ua-platform', operation: 'set', value: `"${ctx.clientHintsPlatform}"` },
        { header: 'sec-ch-ua-mobile', operation: 'set', value: clientHintsMobile },
        { header: 'sec-ch-ua-model', operation: 'set', value: `"${ctx.clientHintsModel}"` },
        { header: 'sec-ch-ua-platform-version', operation: 'set', value: `"${ctx.clientHintsPlatformVersion}"` },
        { header: 'sec-ch-ua-arch', operation: 'set', value: `"${ctx.clientHintsArch}"` },
        { header: 'sec-ch-ua-bitness', operation: 'set', value: '"64"' },
        { header: 'accept-language', operation: 'set', value: ctx.acceptLanguageHeader },
      ];

  // Declarative Net Request rules to spoof HTTP request headers and block CDP port leakage
  return [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: dnrRequestHeaders,
      },
      condition: {
        urlFilter: '*',
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other',
        ],
      },
    },
    {
      id: 2,
      priority: 2,
      action: {
        type: 'block',
      },
      condition: {
        urlFilter: '||127.0.0.1:9222',
        resourceTypes: ['xmlhttprequest', 'websocket', 'script', 'image', 'sub_frame', 'other'],
      },
    },
    ...(ctx.profileDebugPort > 0
      ? [
          {
            id: 3,
            priority: 2,
            action: {
              type: 'block',
            },
            condition: {
              urlFilter: `||127.0.0.1:${ctx.profileDebugPort}`,
              resourceTypes: ['xmlhttprequest', 'websocket', 'script', 'image', 'sub_frame', 'other'],
            },
          },
          {
            id: 4,
            priority: 2,
            action: {
              type: 'block',
            },
            condition: {
              urlFilter: `||localhost:${ctx.profileDebugPort}`,
              resourceTypes: ['xmlhttprequest', 'websocket', 'script', 'image', 'sub_frame', 'other'],
            },
          },
        ]
      : []),
  ];
}

/**
 * Creates or updates the MAHI Anti-Detect & Fingerprint Guard Extension in the profile directory.
 * Injects deterministic Canvas, WebGL, Audio noise, and removes all automation traces.
 */
export function ensureProfileStealthExtension(
  storageDir: string,
  profileId: string,
  profileName: string,
  settings?: LauncherProfileSettings | null,
  options?: { nativeStealthActive?: boolean; debugPort?: number } | boolean
): string {
  const isNativeStealth = typeof options === 'boolean' ? options : Boolean(options?.nativeStealthActive);
  const explicitDebugPort = typeof options === 'object' ? options?.debugPort : undefined;
  const extDir = path.join(storageDir, 'mahi_title_extension');
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  const ctx = resolveStealthContext(profileId, profileName, settings, explicitDebugPort);

  // Manifest V3 Extension with declarativeNetRequest Client Hints spoofing
  const manifest = {
    manifest_version: 3,
    name: `${profileName}`,
    version: '2.0.0',
    description: `MAHI BROWSER Anti-Detect & Stealth Guard`,
    permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'declarativeNetRequest'],
    host_permissions: ['<all_urls>', 'http://127.0.0.1:32123/*'],
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_title: `${profileName}`,
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'rules.json',
        },
      ],
    },
    content_scripts: isNativeStealth
      ? [
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content.js'],
            run_at: 'document_start',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
        ]
      : [
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['stealth-core.js'],
            run_at: 'document_start',
            world: 'MAIN',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content.js'],
            run_at: 'document_start',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
        ],
  };

  const dnrRules = buildDnrRules(ctx);
  const stealthCoreJs = buildStealthCoreScript(ctx);
  const backgroundJs = buildBackgroundWorkerScript(ctx);
  const contentJs = buildContentScript(ctx);

  fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(extDir, 'rules.json'), JSON.stringify(dnrRules, null, 2), 'utf8');
  if (!isNativeStealth) {
    fs.writeFileSync(path.join(extDir, 'stealth-core.js'), stealthCoreJs, 'utf8');
  } else {
    const oldStealthCore = path.join(extDir, 'stealth-core.js');
    if (fs.existsSync(oldStealthCore)) {
      try {
        fs.unlinkSync(oldStealthCore);
      } catch (err) {
        log.debug('Failed removing legacy stealth-core extension script', {
          oldStealthCore,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  fs.writeFileSync(path.join(extDir, 'background.js'), backgroundJs, 'utf8');
  fs.writeFileSync(path.join(extDir, 'content.js'), contentJs, 'utf8');
  return extDir;
}

export function ensureProfileTitleExtension(storageDir: string, profileName: string): string {
  return ensureProfileStealthExtension(storageDir, 'default_id', profileName);
}
