/**
 * MAHI Browser v2.0 — Enterprise Hybrid Stealth & Multi-Core Unit Tests
 * Verification of 117-key native preferences, multi-core resolver, and video capture bypass.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { injectNativeStealthPreferences, getDeterministicSeed, getNoiseValueFromSeed } from '../../02_BROWSER/stealth-native-preferences.js';
import { extractChromeMajorVersion, resolveMultiCoreExecutablePath } from '../../02_BROWSER/services/multi-core-resolver.js';
import { buildVideoCaptureFlags } from '../../02_BROWSER/services/video-capture-service.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';

describe('Phase 20 — Hybrid Enterprise Stealth & Multi-Core Engine', () => {
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-hybrid-stealth-test-'));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('1. 117-Key Native C++ Preference Injection (Orbita Parity)', () => {
    it('injects ClientRects, WebGPU, and AudioContext into Default/Preferences', () => {
      const mockProfile: Profile = {
        id: 'prof_test_enterprise_01',
        name: 'Enterprise Profile',
        storagePath: tempStorageDir,
        status: 'ready',
        ownerId: 'owner_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockSettings = {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
        fingerprint: {
          canvas: 'noise',
          audio: 'noise',
          webgl: 'noise',
          clientRects: 'noise',
          hardwareConcurrency: 16,
          deviceMemory: 16,
        },
        locale: {
          timezone: 'America/New_York',
          languages: ['en-US', 'en'],
        },
      };

      injectNativeStealthPreferences(tempStorageDir, mockProfile, mockSettings, '198.51.100.45');

      const prefsPath = path.join(tempStorageDir, 'Default', 'Preferences');
      expect(fs.existsSync(prefsPath)).toBe(true);

      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      expect(prefs.gologin).toBeDefined();

      const g = prefs.gologin;
      // 1. Canvas & DOM ClientRects
      expect(g.canvasMode).toBe('noise');
      expect(typeof g.canvasNoise).toBe('number');
      expect(g.canvasCntPixels).toBe(10);
      expect(g.client_rects_noise_enable).toBe(true);
      expect(g.get_client_rects_noise).toBe(true);

      // 2. WebGPU Dawn Descriptor
      expect(g.webGpu.supportedAdapters.highPerformance.info.vendor).toBe('nvidia');
      expect(g.webGpu.supportedAdapters.highPerformance.info.architecture).toBe('ampere');
      expect(g.webGpu.supportedAdapters.highPerformance.flags.isFallbackAdapter).toBe(false);

      // 3. WebGL Buffer Limits
      expect(g.webGl.maxTextureSize).toBe(16384);
      expect(g.webGl.maxRenderbufferSize).toBe(16384);
      expect(g.webGl.maxVaryingVectors).toBe(30);

      // 4. AudioContext
      expect(g.audioContext.enable).toBe(true);
      expect(g.audioContext.noiseValue).toBeGreaterThan(0);

      // 5. Network & WebRTC public IP
      expect(g.webrtc.publicIP).toBe('198.51.100.45');
      expect(g.webrtc.should_fill_empty_ice_list).toBe(true);
      expect(g.battery.is_masking).toBe(true);
      expect(g.unpinable_extension_names).toContain('mahi-stealth');
    });

    it('injects Apple Silicon M1 spoofing when Mac UA is specified', () => {
      const mockProfile: Profile = {
        id: 'prof_test_mac_02',
        name: 'Mac M1 Profile',
        storagePath: tempStorageDir,
        status: 'ready',
        ownerId: 'owner_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockSettings = {
        browser: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
        fingerprint: {
          isM1: true,
          webglVendor: 'Apple',
          webglRenderer: 'Apple M1',
        },
      };

      injectNativeStealthPreferences(tempStorageDir, mockProfile, mockSettings);

      const prefs = JSON.parse(fs.readFileSync(path.join(tempStorageDir, 'Default', 'Preferences'), 'utf8'));
      expect(prefs.gologin.is_m1).toBe(true);
      expect(prefs.gologin.webGpu.supportedAdapters.highPerformance.info.vendor).toBe('apple');
      expect(prefs.gologin.webGpu.supportedAdapters.highPerformance.info.architecture).toBe('apple-m1');
    });
  });

  describe('2. Multi-Core Version Resolution (MostLogin Parity)', () => {
    it('accurately parses major Chrome versions from diverse User-Agents', () => {
      expect(extractChromeMajorVersion('Mozilla/5.0 ... Chrome/120.0.6099.109 Safari/537.36')).toBe(120);
      expect(extractChromeMajorVersion('Mozilla/5.0 ... Chrome/124.0.6367.60 Safari/537.36')).toBe(124);
      expect(extractChromeMajorVersion('Mozilla/5.0 ... Chrome/128.0.6613.119 Safari/537.36')).toBe(128);
      expect(extractChromeMajorVersion('Mozilla/5.0 ... Chrome/149.0.7827.102 Safari/537.36')).toBe(149);
      expect(extractChromeMajorVersion(undefined)).toBeNull();
      expect(extractChromeMajorVersion('Safari without chrome')).toBeNull();
    });

    it('resolves multi-core path and flags fallback when exact version is unavailable', () => {
      const resolution = resolveMultiCoreExecutablePath(
        'Mozilla/5.0 ... Chrome/124.0.6367.60 Safari/537.36'
      );
      expect(resolution.executablePath).toBeDefined();
      expect(resolution.majorVersion).toBe(124);
      expect(['exact-multi-core', 'stealth-orbita', 'system-chromium']).toContain(resolution.coreType);
    });
  });

  describe('3. Virtual Video Capture Flags (KYC Bypass)', () => {
    it('returns empty flags when video capture is disabled', () => {
      const res = buildVideoCaptureFlags({ enable: false, filePath: '' });
      expect(res.flags).toHaveLength(0);
      expect(res.isValid).toBe(false);
    });

    it('validates video format and generates Chromium camera capture flags', () => {
      const tempVideo = path.join(tempStorageDir, 'kyc_feed.y4m');
      fs.writeFileSync(tempVideo, 'YUV4MPEG2 W320 H240 F30:1');

      const res = buildVideoCaptureFlags({ enable: true, filePath: tempVideo });
      expect(res.isValid).toBe(true);
      expect(res.flags).toContain('--use-fake-device-for-media-stream');
      expect(res.flags).toContain(`--use-file-for-fake-video-capture=${path.resolve(tempVideo)}`);
    });

    it('rejects non-existent video files safely', () => {
      const res = buildVideoCaptureFlags({ enable: true, filePath: 'C:\\non_existent_video_path.y4m' });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('not found');
    });
  });
});
