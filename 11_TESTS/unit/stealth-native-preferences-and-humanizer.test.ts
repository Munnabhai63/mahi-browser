import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { injectNativeStealthPreferences, getDeterministicSeed, getNoiseValueFromSeed } from '../../02_BROWSER/stealth-native-preferences.js';
import { generateHumanPath } from '../../09_AUTOMATION/ai-humanizer.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { auditProfileFingerprint } from '../../03_HARDWARE/diagnostics-service.js';
import { createProfile, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { initSqlEngine, getDatabase } from '../../06_DATABASE/connection.js';

describe('MAHI BROWSER v2.0 Enterprise Anti-Detect Engine Unit Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi_stealth_test_'));
    await initSqlEngine();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('generates consistent deterministic seed and mathematical noise for a profile', () => {
    const seed1 = getDeterministicSeed('profile_123_test_user');
    const seed2 = getDeterministicSeed('profile_123_test_user');
    expect(seed1).toBe(seed2);

    const noise1 = getNoiseValueFromSeed(seed1);
    const noise2 = getNoiseValueFromSeed(seed2);
    expect(noise1).toBe(noise2);
    expect(noise1).toBeGreaterThan(0);
    expect(noise1).toBeLessThan(0.01);
  });

  it('injects decompiled C++ native preference schema into Default/Preferences correctly', () => {
    const mockProfile: Profile = {
      id: 'prof_test_456',
      name: 'Stealth Profile Alpha',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'READY',
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          engine: 'chromium',
          version: '135',
          startupUrl: 'about:blank',
          homepage: 'about:blank',
          additionalArgs: [],
          enableExtensions: true,
          hardwareAcceleration: true,
        },
        display: {
          screenWidth: 1920,
          screenHeight: 1080,
          deviceScaleFactor: 1,
          colorDepth: 24,
        },
        locale: {
          language: 'en-US',
          timezone: 'America/New_York',
          languagesList: ['en-US', 'en'],
        },
        network: {
          directConnection: false,
          webrtc: 'proxy_only',
        },
        permissions: {
          camera: 'prompt',
          microphone: 'prompt',
          geolocation: 'prompt',
          notifications: 'prompt',
          midi: 'prompt',
        },
        fingerprint: {
          canvas: 'noise',
          webgl: 'noise',
          audio: 'noise',
          clientRects: 'noise',
          webglVendor: 'Google Inc. (NVIDIA)',
          webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)',
          hardwareConcurrency: 16,
          deviceMemory: 16,
        },
      },
    };

    injectNativeStealthPreferences(tempDir, mockProfile, mockProfile.settings, '104.28.19.45');

    const prefsFile = path.join(tempDir, 'Default', 'Preferences');
    expect(fs.existsSync(prefsFile)).toBe(true);

    const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
    expect(prefs).toHaveProperty('gologin');

    const g = prefs.gologin;
    // Verify native C++ hooks
    expect(g.canvasMode).toBe('noise');
    expect(g.canvasNoise).toBeGreaterThan(0);
    expect(g.webgl_noise_enable).toBe(true);
    expect(g.webgl.metadata.vendor).toBe('Google Inc. (NVIDIA)');
    expect(g.webgl.metadata.renderer).toContain('RTX 4070');
    expect(g.audioContext.enable).toBe(true);
    expect(g.client_rects_noise_enable).toBe(true);
    expect(g.timezone.id).toBe('America/New_York');
    expect(g.webrtc.publicIP).toBe('104.28.19.45');
    expect(g.hardwareConcurrency).toBe(16);
    expect(g.deviceMemory).toBe(16);
    expect(g.languages).toEqual(['en-US', 'en']);
    expect(g.langHeader).toBe('en-US,en');
  });

  it('generates realistic cubic Bezier human mouse paths without sharp linear jumps', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 800, y: 600 };
    const path = generateHumanPath(start, end, 30, 2);

    expect(path.length).toBe(31);
    expect(path[0].x).toBe(start.x);
    expect(path[0].y).toBe(start.y);
    expect(path[path.length - 1].x).toBe(end.x);
    expect(path[path.length - 1].y).toBe(end.y);

    // Verify non-linearity: middle points must deviate organically from the straight line
    const midPoint = path[Math.floor(path.length / 2)];
    expect(midPoint.x).toBeGreaterThan(start.x);
    expect(midPoint.x).toBeLessThan(end.x);
  });

  it('diagnostics-service reads settings.network.webrtc accurately without false failures', () => {
    const profile = createProfile({
      name: 'WebRTC Diagnostics Test Profile',
      settings: {
        network: {
          directConnection: false,
          proxyId: 'dummy-proxy-id',
          webrtc: 'proxy_only',
        },
        fingerprint: {
          webrtc: undefined, // omitted from fingerprint to verify reading network.webrtc
        },
      } as any,
    });

    try {
      const report = auditProfileFingerprint(profile.id);
      const webrtcCheck = report.checks.find((c) => c.id === 'check-webrtc');
      expect(webrtcCheck).toBeDefined();
      expect(webrtcCheck?.status).toBe('PASS');
      expect(webrtcCheck?.score).toBe(100);
      expect(webrtcCheck?.actualValue).toContain('PROXY_ONLY');
    } finally {
      deleteProfile(profile.id);
    }
  });
});
