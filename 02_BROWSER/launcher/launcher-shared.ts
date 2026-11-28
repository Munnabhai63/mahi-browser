import type { ChildProcess } from 'node:child_process';
import type { ProfileSettings } from '../../10_CONFIG/shared/types/profile.js';
import type { ProxyTunnelHandle } from '../proxy-tunnel.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';

export const log = createLogger('launcher');

export type LauncherFingerprintSettings = Partial<ProfileSettings['fingerprint']> & {
  fingerprintSeed?: string | number;
  noiseSeed?: string | number;
  seed?: string | number;
};

export type LauncherProfileSettings = Partial<ProfileSettings> & {
  showProfileBadge?: boolean;
  browser?: Partial<ProfileSettings['browser']> & { showProfileBadge?: boolean };
  locale?: Partial<ProfileSettings['locale']> & { languages?: string | string[] };
  fingerprint?: LauncherFingerprintSettings;
};

export interface TimezoneMismatchWarning {
  profileId: string;
  profileName: string;
  profileTimezone: string;
  proxyTimezone: string;
  suggestedLanguage?: string;
  suggestedLanguagesList?: string[];
}

export interface LaunchedProcessInfo {
  process: ChildProcess;
  pid: number;
  profileId: string;
  startedAt: string;
  executablePath: string;
  storageDir: string;
  proxyTunnel?: ProxyTunnelHandle;
  debugPort?: number;
  timezoneMismatch?: TimezoneMismatchWarning;
}

export interface WebglLimitsConfig {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxVertexUniformVectors: number;
  maxVaryingVectors: number;
  maxVertexAttribs: number;
}

export interface StealthScriptContext {
  profileId: string;
  profileName: string;
  badgeNumber: string;
  rawSeedInput: string;
  profileDebugPort: number;
  isMobile: boolean;
  isMac: boolean;
  isLinux: boolean;
  isMacArm: boolean;
  isCamoufox: boolean;
  chromeMajorVer: string;
  chromeFullVer: string;
  effectiveBrands: Array<{ brand: string; version: string }>;
  effectiveFullVersionList: Array<{ brand: string; version: string }>;
  allowedFonts: string[];
  glLimits: WebglLimitsConfig;
  osVoiceProfile: 'android' | 'macos' | 'linux' | 'windows';
  targetScreenWidth: number;
  targetScreenHeight: number;
  displayDpr: number;
  targetColorDepth: number;
  clientHintsPlatform: string;
  clientHintsModel: string;
  clientHintsPlatformVersion: string;
  clientHintsArch: string;
  targetTimezone: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  platformStr: string;
  maxTouchPoints: number;
  userAgent: string;
  languagesList: string[];
  acceptLanguageHeader: string;
  canvasMode: string;
  audioMode: string;
  webglMode: string;
  clientRectsMode: string;
  gpuSpoofOn: boolean;
  gpuVendor: string;
  gpuRenderer: string;
  webrtcOpt: 'disable_non_proxied_udp' | 'default_public_interface_only' | 'allow_all';
  showProfileBadge: boolean;
}

export function debugLog(msg: string): void {
  const fn = (globalThis as typeof globalThis & { __mahiDebugLog?: (message: string) => void }).__mahiDebugLog;
  if (fn) fn(msg);
  else log.info(msg);
}

/**
 * Stable 32-bit FNV-1a hash for deterministic per-profile seed derivation.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 0x12345678;
}

/**
 * Deterministic Mulberry32 PRNG returning floats in [0, 1).
 */
export function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a deterministic 32-bit seed from profileId + optional stored salt.
 */
export function deriveProfileStealthSeed(
  profileId: string,
  fingerprintSettings?: LauncherFingerprintSettings | null
): number {
  const storedSalt =
    fingerprintSettings?.fingerprintSeed ?? fingerprintSettings?.noiseSeed ?? fingerprintSettings?.seed ?? '';
  const rawSeedInput = storedSalt
    ? `${String(profileId || 'default')}:${String(storedSalt)}`
    : String(profileId || 'default');
  return fnv1a32(rawSeedInput);
}

export function pushUniqueFlag(args: string[], flag: string): void {
  if (!args.includes(flag)) {
    args.push(flag);
  }
}

/**
 * Resolves effective runtime WebRTC handling policy without mutating stored profile settings.
 * - Explicit 'allow_all' (and legacy explicit 'real' without proxy) keeps default unprotected WebRTC.
 * - Legacy 'default', 'noise', undefined, null, or active proxy all enforce 'disable_non_proxied_udp'.
 */
export function resolveEffectiveWebrtcPolicy(
  settings?: LauncherProfileSettings | null
): 'disable_non_proxied_udp' | 'default_public_interface_only' | 'allow_all' {
  const rawNetwork = settings?.network?.webrtc as string | undefined;
  const hasActiveProxy = Boolean(
    settings?.network &&
      settings.network.directConnection === false &&
      settings.network.proxyId
  );

  if (rawNetwork === 'allow_all') {
    return 'allow_all';
  }
  if (rawNetwork === 'real' && !hasActiveProxy) {
    return 'allow_all';
  }
  if (
    rawNetwork === 'default_public_interface_only' ||
    rawNetwork === 'public_interface_only'
  ) {
    return 'default_public_interface_only';
  }
  return 'disable_non_proxied_udp';
}

export function applyStrictWebrtcArgs(
  args: string[],
  policy: 'disable_non_proxied_udp' | 'default_public_interface_only'
): void {
  for (let i = args.length - 1; i >= 0; i--) {
    if (
      args[i] === '--force-webrtc-ip-handling-policy' ||
      args[i].startsWith('--force-webrtc-ip-handling-policy=') ||
      args[i].startsWith('--webrtc-ip-handling-policy=')
    ) {
      args.splice(i, 1);
    }
  }
  pushUniqueFlag(args, `--force-webrtc-ip-handling-policy=${policy}`);
  pushUniqueFlag(args, '--enforce-webrtc-ip-permission-check');
}
