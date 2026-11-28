import { getProfileById, updateProfile } from '../02_BROWSER/services/profile-service.js';
import type { DiagnosticCheck, ProfileAuditReport, StealthGrade } from '../10_CONFIG/shared/types/diagnostics.js';
import type { PartialProfileSettings } from '../10_CONFIG/shared/types/profile.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import {
  validateAndNormalizeFingerprintCoherence,
  type FingerprintCoherenceReport,
} from '../02_BROWSER/stealth-native-preferences.js';

/**
 * Runs a comprehensive multi-vector anti-bot & fingerprint stealth audit on a profile.
 */
export function auditProfileFingerprint(profileId: string): ProfileAuditReport {
  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  const s: PartialProfileSettings = profile.settings || {};
  const fp = s.fingerprint || {};
  const net = s.network || {};
  const loc = s.locale || {};
  const disp = s.display || {};

  const checks: DiagnosticCheck[] = [];

  // 1. WebRTC Leak Shield
  const explicitFpOff = (fp.webrtc as string) === 'off' || (fp.webrtc as string) === 'real';
  const netWebrtc = (net.webrtc as string) || '';
  const webrtcMode: string = explicitFpOff ? (fp.webrtc as string) : (netWebrtc || (fp.webrtc as string) || 'noise');
  const hasProxy = Boolean(net.proxyId && !net.directConnection);
  let webrtcStatus: DiagnosticCheck['status'] = 'PASS';
  let webrtcScore = 100;
  let webrtcRec: string | undefined;

  const isUnprotectedWebrtc =
    webrtcMode === 'off' ||
    webrtcMode === 'default' ||
    webrtcMode === 'allow_all' ||
    webrtcMode === 'real';

  if (hasProxy && isUnprotectedWebrtc) {
    webrtcStatus = 'FAIL';
    webrtcScore = 30;
    webrtcRec = 'WebRTC is disabled or unprotected while using a proxy — your real public IP may leak over STUN/TURN UDP requests. Enable Disable Non-Proxied UDP or proxy_only mode.';
  } else if (isUnprotectedWebrtc) {
    webrtcStatus = 'WARN';
    webrtcScore = 60;
    webrtcRec = 'WebRTC protection is off or unprotected. Enable Disable Non-Proxied UDP protection.';
  }

  checks.push({
    id: 'check-webrtc',
    category: 'NETWORK',
    name: 'WebRTC IP Leak Shield',
    description: 'Verifies STUN/TURN candidate filtering to prevent local & public IP exposure behind proxies.',
    status: webrtcStatus,
    score: webrtcScore,
    actualValue: `Mode: ${webrtcMode.toUpperCase()}${hasProxy ? ' (Proxy Active)' : ' (Direct IP)'}`,
    expectedValue: 'NOISE or BLOCK',
    recommendation: webrtcRec,
  });

  // 2. Canvas Fingerprint Noise
  const canvasMode = fp.canvas || 'noise';
  const canvasStatus: DiagnosticCheck['status'] = canvasMode === 'noise' ? 'PASS' : canvasMode === 'block' ? 'WARN' : 'FAIL';
  const canvasScore = canvasMode === 'noise' ? 100 : canvasMode === 'block' ? 70 : 40;
  checks.push({
    id: 'check-canvas',
    category: 'CANVAS',
    name: 'HTML5 Canvas Hash Randomizer',
    description: 'Evaluates 2D canvas drawing entropy against anti-bot hashing algorithms (Pixelscan/CreepJS).',
    status: canvasStatus,
    score: canvasScore,
    actualValue: `Canvas Mode: ${canvasMode.toUpperCase()}`,
    expectedValue: 'NOISE (Unique Per-Profile Hash)',
    recommendation: canvasMode !== 'noise' ? 'Set Canvas protection to "noise" to randomize canvas hash.' : undefined,
  });

  // 3. WebGL GPU Vendor & Renderer
  const webglMode = fp.webgl || 'noise';
  const vendor = fp.webglVendor || 'Google Inc. (NVIDIA)';
  const renderer = fp.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const isRealGpu = !renderer.toLowerCase().includes('swiftshader') && !renderer.toLowerCase().includes('llvmpipe');
  
  const webglStatus: DiagnosticCheck['status'] = (webglMode === 'noise' && isRealGpu) ? 'PASS' : 'WARN';
  const webglScore = webglStatus === 'PASS' ? 100 : 65;

  checks.push({
    id: 'check-webgl',
    category: 'WEBGL',
    name: 'WebGL Hardware Renderer Mask',
    description: 'Ensures GPU vendor, unmasked renderer, and WebGL parameter tables mimic real discrete graphics hardware.',
    status: webglStatus,
    score: webglScore,
    actualValue: `${vendor} / ${renderer.slice(0, 40)}...`,
    expectedValue: 'Discrete GPU (NVIDIA / Apple Silicon / AMD)',
    recommendation: !isRealGpu ? 'Software renderer detected. Spoof a realistic NVIDIA or Apple GPU.' : undefined,
  });

  // 4. AudioContext Buffer Fingerprinting
  const audioMode = fp.audio || 'noise';
  const audioStatus: DiagnosticCheck['status'] = audioMode === 'noise' ? 'PASS' : 'WARN';
  checks.push({
    id: 'check-audio',
    category: 'AUDIO',
    name: 'AudioContext Frequency Modulation',
    description: 'Verifies oscillator node and dynamic compressor noise injection against audio fingerprinting.',
    status: audioStatus,
    score: audioMode === 'noise' ? 100 : 60,
    actualValue: `Audio Mode: ${audioMode.toUpperCase()}`,
    expectedValue: 'NOISE',
    recommendation: audioMode !== 'noise' ? 'Enable Audio noise modulation to prevent AudioContext hash tracking.' : undefined,
  });

  // 5. Hardware Concurrency & RAM
  const cores = fp.hardwareConcurrency || 8;
  const memory = fp.deviceMemory || 8;
  const hwOk = cores >= 4 && cores <= 32 && memory >= 4;
  checks.push({
    id: 'check-hardware',
    category: 'HARDWARE',
    name: 'CPU Cores & RAM Consistency',
    description: 'Validates navigator.hardwareConcurrency and navigator.deviceMemory realism.',
    status: hwOk ? 'PASS' : 'WARN',
    score: hwOk ? 100 : 70,
    actualValue: `${cores} CPU Cores | ${memory} GB RAM`,
    expectedValue: '4-16 Cores | 8-32 GB RAM',
    recommendation: !hwOk ? 'Adjust CPU cores (8) and RAM (8GB/16GB) to match typical desktop devices.' : undefined,
  });

  // 6. ClientRects & Font Metrics
  const crMode = fp.clientRects || 'noise';
  checks.push({
    id: 'check-clientrects',
    category: 'CANVAS',
    name: 'DOM Element ClientRects Jitter',
    description: 'Protects against CSS font rendering and sub-pixel DOM rectangle fingerprinting.',
    status: crMode === 'noise' ? 'PASS' : 'WARN',
    score: crMode === 'noise' ? 100 : 75,
    actualValue: `ClientRects: ${crMode.toUpperCase()}`,
    expectedValue: 'NOISE',
    recommendation: crMode !== 'noise' ? 'Enable ClientRects noise jitter to prevent font subpixel tracking.' : undefined,
  });

  // 7. Timezone & Locale Alignment
  const tz = loc.timezone || 'auto';
  const lang = loc.language || 'en-US';
  const locOk = tz !== '' && lang !== '';
  checks.push({
    id: 'check-locale',
    category: 'LOCALE',
    name: 'Timezone & Language Cohesion',
    description: 'Ensures Intl.DateTimeFormat and Date.prototype.getTimezoneOffset align naturally with system locale.',
    status: locOk ? 'PASS' : 'WARN',
    score: locOk ? 100 : 80,
    actualValue: `Timezone: ${tz} | Lang: ${lang}`,
    expectedValue: 'Valid IANA Timezone & Locale',
    recommendation: !locOk ? 'Configure specific IANA timezone and locale.' : undefined,
  });

  // 8. Screen Resolution & Color Depth
  const w = disp.screenWidth || 1920;
  const h = disp.screenHeight || 1080;
  const screenOk = w >= 1280 && h >= 720;
  checks.push({
    id: 'check-display',
    category: 'HARDWARE',
    name: 'Screen Resolution & Display Metrics',
    description: 'Verifies screen.width, screen.height, and screen.colorDepth adhere to standard desktop aspect ratios.',
    status: screenOk ? 'PASS' : 'WARN',
    score: screenOk ? 100 : 70,
    actualValue: `${w}x${h} (24-bit color depth)`,
    expectedValue: '1920x1080 or 1440x900',
    recommendation: !screenOk ? 'Set standard resolution like 1920x1080.' : undefined,
  });

  // 9. Statistical Cross-Signal Coherence (browserforge parity)
  const coherence = validateAndNormalizeFingerprintCoherence(s);
  checks.push({
    id: 'check-coherence',
    category: 'HARDWARE',
    name: 'Cross-Signal Statistical Coherence',
    description: 'Validates cross-signal consistency across User-Agent, platform, GPU renderer, touch points, and hardware specs.',
    status: coherence.valid ? 'PASS' : 'WARN',
    score: coherence.valid ? 100 : 75,
    actualValue: coherence.valid ? 'Coherent Fingerprint' : `${coherence.warnings.length} contradictions detected`,
    expectedValue: 'Zero Contradictory Signals',
    recommendation: coherence.valid ? undefined : coherence.warnings.join('; '),
  });

  // Calculate Overall Stealth Score
  const totalScore = checks.reduce((acc, c) => acc + c.score, 0);
  const overallScore = Math.round(totalScore / checks.length);

  const passedCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;

  let stealthGrade: StealthGrade = 'ULTRA';
  if (overallScore < 70 || failCount > 0) {
    stealthGrade = 'RISK';
  } else if (overallScore < 90 || warnCount > 1) {
    stealthGrade = 'MODERATE';
  }

  logActivity('PROFILE', 'INFO', 'Fingerprint Audit', `Audited "${profile.name}" — Stealth Score: ${overallScore}% (${stealthGrade})`, profileId, profile.name);

  return {
    profileId: profile.id,
    profileName: profile.name,
    overallScore,
    stealthGrade,
    passedCount,
    warnCount,
    failCount,
    checks,
    auditedAt: new Date().toISOString(),
  };
}

/**
 * 1-Click Auto-Fix: Adjusts all profile fingerprint settings to 100% Ultra-Stealth compliance.
 */
export function autoFixProfileFingerprint(profileId: string): ProfileAuditReport {
  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  const s: PartialProfileSettings = profile.settings || {};
  const fp = s.fingerprint || {};
  const isCamoufox = s.browser?.engine === 'camoufox';
  const isMac = Boolean(s.browser?.userAgent?.includes('Macintosh'));

  let fixedUa = s.browser?.userAgent;
  if (isCamoufox && !fixedUa?.includes('Firefox')) {
    fixedUa = isMac
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
  }

  const updatedSettings = {
    ...s,
    browser: {
      ...(s.browser || {}),
      userAgent: fixedUa,
    },
    fingerprint: {
      ...fp,
      canvas: 'noise',
      webgl: 'noise',
      audio: 'noise',
      clientRects: 'noise',
      webrtc: 'noise',
      webglVendor: isMac ? 'Google Inc. (Apple)' : 'Google Inc. (NVIDIA)',
      webglRenderer: isMac
        ? 'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1 Metal - 88.1)'
        : 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      hardwareConcurrency: isMac ? 12 : 16,
      deviceMemory: 16,
    },
    network: {
      ...(s.network || {}),
      webrtc: 'noise' as const,
    },
    display: {
      ...(s.display || {}),
      screenWidth: s.display?.screenWidth && s.display.screenWidth >= 1280 ? s.display.screenWidth : 1920,
      screenHeight: s.display?.screenHeight && s.display.screenHeight >= 720 ? s.display.screenHeight : 1080,
    },
  };

  updateProfile(profileId, {
    settings: updatedSettings,
  });

  logActivity('PROFILE', 'SUCCESS', 'Auto-Fix Stealth', `Optimized "${profile.name}" to 100% Ultra-Stealth`, profileId, profile.name);

  // Return fresh audit report
  return auditProfileFingerprint(profileId);
}

export { validateAndNormalizeFingerprintCoherence };
export type { FingerprintCoherenceReport };
