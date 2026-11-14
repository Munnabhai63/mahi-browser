import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { ensureProfileStealthExtension, getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import {
  resolveEngineManifest,
  hasNativeStealthEngine,
  DEFAULT_MAHI_ENGINE_MANIFEST,
} from '../../02_BROWSER/managed-engine.js';
import {
  validateAndNormalizeFingerprintCoherence,
  injectNativeStealthPreferences,
} from '../../02_BROWSER/stealth-native-preferences.js';
import { generateHumanPath } from '../../09_AUTOMATION/ai-humanizer.js';
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';

describe('Step 5: Native C++ Chromium Anti-Detect Engine & Build Pipeline', () => {
  let tempBaseDir: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(() => {
    tempBaseDir = path.join(os.tmpdir(), `mahi-step5-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempBaseDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempBaseDir)) {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ==========================================================================
  // Test 1: mahi-engine.json Resolution & Zero Double-Noise Invariant
  // ==========================================================================
  it('1. resolveEngineManifest detects native C++ engine and ensureProfileStealthExtension omits stealth-core.js', () => {
    const engineDir = path.join(tempBaseDir, 'custom-mahi-chromium');
    fs.mkdirSync(engineDir, { recursive: true });

    const chromeExePath = path.join(engineDir, os.platform() === 'win32' ? 'chrome.exe' : 'chrome');
    fs.writeFileSync(chromeExePath, 'mock binary content', 'utf8');

    // Initially without mahi-engine.json -> hasNativeStealthEngine should be false
    expect(hasNativeStealthEngine(chromeExePath)).toBe(false);
    expect(resolveEngineManifest(chromeExePath)).toBeNull();

    // Place mahi-engine.json alongside executable
    const manifestPath = path.join(engineDir, 'mahi-engine.json');
    fs.writeFileSync(manifestPath, JSON.stringify(DEFAULT_MAHI_ENGINE_MANIFEST, null, 2), 'utf8');

    // Now resolveEngineManifest should succeed
    const manifest = resolveEngineManifest(chromeExePath);
    expect(manifest).toBeDefined();
    expect(manifest?.engine).toBe('mahi-chromium');
    expect(manifest?.nativeStealth).toBe(true);
    expect(manifest?.capabilities.canvas).toBe(true);
    expect(manifest?.capabilities.webgl).toBe(true);
    expect(manifest?.capabilities.cdpIsolation).toBe(true);
    expect(hasNativeStealthEngine(chromeExePath)).toBe(true);

    // Profile extension generation with nativeStealthActive = true
    const profileDirNative = path.join(tempBaseDir, 'profile-native-stealth');
    fs.mkdirSync(profileDirNative, { recursive: true });

    const extDirNative = ensureProfileStealthExtension(
      profileDirNative,
      'prof_native_1',
      'Native Stealth Profile',
      { browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0' } },
      { nativeStealthActive: true }
    );

    const extManifestNative = JSON.parse(fs.readFileSync(path.join(extDirNative, 'manifest.json'), 'utf8'));
    // Zero Double-Noise Invariant: stealth-core.js MUST NOT be present in content_scripts
    const scriptsNative = extManifestNative.content_scripts.map((cs: any) => cs.js).flat();
    expect(scriptsNative).not.toContain('stealth-core.js');
    expect(scriptsNative).toContain('content.js');
    expect(fs.existsSync(path.join(extDirNative, 'stealth-core.js'))).toBe(false);

    // Rules.json CDP port blocking must still be active
    const rulesNative = JSON.parse(fs.readFileSync(path.join(extDirNative, 'rules.json'), 'utf8'));
    const debugPort = getProfileDebugPort('prof_native_1');
    expect(rulesNative.some((r: any) => r.id === 2 && r.condition.urlFilter === '||127.0.0.1:9222')).toBe(true);
    expect(rulesNative.some((r: any) => r.id === 3 && r.condition.urlFilter === `||127.0.0.1:${debugPort}`)).toBe(true);

    // Fallback: profile extension generation with nativeStealthActive = false
    const profileDirFallback = path.join(tempBaseDir, 'profile-fallback-stealth');
    fs.mkdirSync(profileDirFallback, { recursive: true });

    const extDirFallback = ensureProfileStealthExtension(
      profileDirFallback,
      'prof_fallback_1',
      'Fallback Stealth Profile',
      { browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0' } },
      { nativeStealthActive: false }
    );

    const extManifestFallback = JSON.parse(fs.readFileSync(path.join(extDirFallback, 'manifest.json'), 'utf8'));
    const scriptsFallback = extManifestFallback.content_scripts.map((cs: any) => cs.js).flat();
    expect(scriptsFallback).toContain('stealth-core.js');
    expect(scriptsFallback).toContain('content.js');
    expect(fs.existsSync(path.join(extDirFallback, 'stealth-core.js'))).toBe(true);
  });

  // ==========================================================================
  // Test 2: Structural Verification of C++ Patchset & Build Workflow
  // ==========================================================================
  it('2. verifies 14_ENGINE_PATCHES/chromium-138 structure, series, prefs.mahi references, and GitHub workflow', () => {
    const patchesDir = path.resolve('14_ENGINE_PATCHES/chromium-138');
    expect(fs.existsSync(patchesDir)).toBe(true);

    // Check series file
    const seriesPath = path.join(patchesDir, 'series');
    expect(fs.existsSync(seriesPath)).toBe(true);
    const seriesContent = fs.readFileSync(seriesPath, 'utf8');
    const patchFiles = seriesContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    expect(patchFiles.length).toBe(8);

    // Every patch file must exist and reference prefs.mahi
    for (const patchFile of patchFiles) {
      const fullPath = path.join(patchesDir, patchFile);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(100);
      if (patchFile.includes('canvas') || patchFile.includes('webgl') || patchFile.includes('webaudio') ||
          patchFile.includes('clientrects') || patchFile.includes('icu') || patchFile.includes('privacy')) {
        expect(content).toContain('prefs.mahi');
      }
    }

    // Strict Unified Diff Parsing: Validate all @@ -old,count +new,count @@ headers in all 8 patches
    for (const patchFile of patchFiles) {
      const fullPath = path.join(patchesDir, patchFile);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      let inHunk = false;
      let expOld = 0, expNew = 0, actOld = 0, actNew = 0;
      let hunkHeader = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('diff --git')) {
          if (inHunk) {
            expect(actOld).toBe(expOld);
            expect(actNew).toBe(expNew);
            inHunk = false;
          }
        } else if (line.startsWith('@@ ')) {
          if (inHunk) {
            expect(actOld).toBe(expOld);
            expect(actNew).toBe(expNew);
          }
          const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          expect(m).not.toBeNull();
          expOld = m![2] !== undefined ? parseInt(m![2], 10) : 1;
          expNew = m![4] !== undefined ? parseInt(m![4], 10) : 1;
          actOld = 0;
          actNew = 0;
          hunkHeader = line;
          inHunk = true;
        } else if (inHunk) {
          if (line.startsWith('-- ') || line.startsWith('diff --git')) {
            expect(actOld).toBe(expOld);
            expect(actNew).toBe(expNew);
            inHunk = false;
          } else if (line.startsWith(' ')) {
            actOld++;
            actNew++;
          } else if (line.startsWith('-')) {
            actOld++;
          } else if (line.startsWith('+')) {
            actNew++;
          } else if (line.startsWith('\\')) {
            // ignore \ No newline
          } else {
            expect(actOld).toBe(expOld);
            expect(actNew).toBe(expNew);
            inHunk = false;
          }
        }
      }
      if (inHunk) {
        expect(actOld).toBe(expOld);
        expect(actNew).toBe(expNew);
      }
    }

    // Anti-Stub & Flag Parity Assertions
    for (const patchFile of patchFiles) {
      const content = fs.readFileSync(path.join(patchesDir, patchFile), 'utf8');
      // Blink renderer modules must NOT include components/prefs or call GetPrefService()
      if (patchFile !== '0005-mahi-icu-timezone-locale-hardware-ch.patch') {
        expect(content).not.toContain('components/prefs/pref_service.h');
      }
      expect(content).not.toContain('GetPrefService()');
    }

    // Real upstream SHA headers: no placeholder hashes
    for (const patchFile of patchFiles) {
      const content = fs.readFileSync(path.join(patchesDir, patchFile), 'utf8');
      expect(content).not.toContain('index 1111111..2222222');
      expect(content).toMatch(/index [0-9a-f]{7}\.\.[0-9a-f]{7} 100644/);
    }

    // 0001 must include <algorithm>, use RawByteSpan(), and std::clamp
    const p1Content = fs.readFileSync(path.join(patchesDir, '0001-mahi-canvas-skia-fingerprint-noise.patch'), 'utf8');
    expect(p1Content).toContain('#include <algorithm>');
    expect(p1Content).toContain('raw_bytes = image_data->RawByteSpan()');
    expect(p1Content).toContain('std::clamp');

    // 0002 must read dotted paths for webgl metadata, check webgl noise, guard buffer, and construct GPUAdapterInfo in CreateAdapterInfoForAdapter
    const p2Content = fs.readFileSync(path.join(patchesDir, '0002-mahi-webgl-webgpu-metadata-and-noise.patch'), 'utf8');
    expect(p2Content).toContain('FindStringByDottedPath("webgl.metadata.renderer")');
    expect(p2Content).toContain('FindStringByDottedPath("webgl.metadata.vendor")');
    expect(p2Content).toContain('webgl_noise_enable');
    expect(p2Content).toContain('webgl_noise_value');
    expect(p2Content).toContain('!buffer.has_value()');
    expect(p2Content).toContain('offset_in_bytes.ValueOrDie()');
    expect(p2Content).toContain('GPUAdapter::CreateAdapterInfoForAdapter()');
    expect(p2Content).toContain('FindDictByDottedPath("webGpu.supportedAdapters.highPerformance.info")');

    // 0003 must read audioContext dotted paths and derive persistent seed via ApplyMahiNoiseToChannel in both getChannelData and copyFromChannel
    const p3Content = fs.readFileSync(path.join(patchesDir, '0003-mahi-webaudio-acoustic-jitter.patch'), 'utf8');
    expect(p3Content).toContain('FindBoolByDottedPath("audioContext.enable")');
    expect(p3Content).toContain('FindDoubleByDottedPath("audioContext.noiseValue")');
    expect(p3Content).toContain('noise_val * 1000000.0');
    expect(p3Content).toContain('ApplyMahiNoiseToChannel(unsigned channel_index)');
    expect(p3Content).toContain('ApplyMahiNoiseToChannel(channel_index)');
    expect(p3Content).toContain('ApplyMahiNoiseToChannel(static_cast<unsigned>(channel_number))');
    expect(p3Content).toContain('copyFromChannel');
    expect(p3Content).not.toContain('0x1337c0de');

    // 0004 must preserve GetFontPlatformData fallback, split on ';', and enforce IsMahiFontAllowed across all match methods
    const p4Content = fs.readFileSync(path.join(patchesDir, '0004-mahi-clientrects-and-fontcache-masking.patch'), 'utf8');
    expect(p4Content).toContain('SplitString(raw_list, ";",');
    expect(p4Content).toContain('mode != "1" && mode != "2"');
    expect(p4Content).toContain('IsMahiFontAllowed');
    expect(p4Content).toContain('GetFontData(');
    expect(p4Content).toContain('IsPlatformFamilyMatchAvailable(');
    expect(p4Content).toContain('IsPlatformFontUniqueNameMatchAvailable(');

    // 0005 must register/read root 'mahi'/'gologin' prefs, patch navigator_events.cc, navigator_base.cc, and persist timezone override
    const p5Content = fs.readFileSync(path.join(patchesDir, '0005-mahi-icu-timezone-locale-hardware-ch.patch'), 'utf8');
    expect(p5Content).toContain('int child_process_id');
    expect(p5Content).toContain('RenderProcessHost::FromID(child_process_id)');
    expect(p5Content).toContain('RegisterDictionaryPref("mahi")');
    expect(p5Content).toContain('RegisterDictionaryPref("gologin")');
    expect(p5Content).not.toContain('RegisterDictionaryPref("prefs.mahi")');
    expect(p5Content).not.toContain('RegisterDictionaryPref("prefs.gologin")');
    expect(p5Content).toContain('HasPrefPath("mahi")');
    expect(p5Content).toContain('HasPrefPath("gologin")');
    expect(p5Content).not.toContain('HasPrefPath("prefs.mahi")');
    expect(p5Content).not.toContain('HasPrefPath("prefs.gologin")');
    expect(p5Content).toContain('#include "base/json/json_writer.h"');
    expect(p5Content).toContain('core/events/navigator_events.cc');
    expect(p5Content).toContain('NavigatorEvents::maxTouchPoints');
    expect(p5Content).toContain('core/execution_context/navigator_base.cc');
    expect(p5Content).toContain('NavigatorBase::platform()');
    expect(p5Content).toContain('instance().override_timezone_id_ = tz_str;');
    expect(p5Content).not.toContain('int Navigator::maxTouchPoints() const');
    expect(p5Content).toContain('FindStringByDottedPath("navigator.platform")');
    expect(p5Content).toContain('FindIntByDottedPath("navigator.max_touch_points")');
    expect(p5Content).toContain('FindInt("hardwareConcurrency")');
    expect(p5Content).toContain('FindDouble("deviceMemory")');
    expect(p5Content).toContain('FindString("langHeader")');
    expect(p5Content).toContain('FindList("languages")');
    expect(p5Content).toContain('FindStringByDottedPath("timezone.id")');
    expect(p5Content).toContain('NavigatorBase::GetUserAgentMetadata()');
    expect(p5Content).toContain('UserAgentMetadata metadata = execution_context');
    expect(p5Content).toContain('major_brands.emplace_back("Chromium", major_ver);');
    expect(p5Content).toContain('command_line->AppendSwitch("mahi-cdp-isolated");');

    // 0006 must omit navigator_automation_information.cc, use dotted path for webrtc.mode and set kRelay
    const p6Content = fs.readFileSync(path.join(patchesDir, '0006-mahi-ungoogled-privacy-telemetry-webrtc.patch'), 'utf8');
    expect(p6Content).not.toContain('navigator_automation_information.cc');
    expect(p6Content).toContain('components/metrics/metrics_service.cc');
    expect(p6Content).toContain('third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc');
    expect(p6Content).toContain('FindStringByDottedPath("webrtc.mode")');
    expect(p6Content).toContain('FindBoolByDottedPath("webrtc.should_fill_empty_ice_list")');
    expect(p6Content).toContain('FindStringByDottedPath("network.webrtc")');
    expect(p6Content).toContain('webrtc::PeerConnectionInterface::IceTransportsType::kRelay');

    // 0007 must contain ONLY v8 inspector changes, use v8::Global, and mahiSuppressContextCreated
    const p7Content = fs.readFileSync(path.join(patchesDir, '0007-mahi-rebrowser-v8-inspector-isolation.patch'), 'utf8');
    expect(p7Content).toContain('v8/src/inspector/v8-runtime-agent-impl.cc');
    expect(p7Content).not.toContain('content/browser/devtools/protocol/page_handler.cc');
    expect(p7Content).toContain('void V8RuntimeAgentImpl::evaluate(');
    expect(p7Content).toContain('v8::Global<v8::Value> orig_prepare_stack_trace;');
    expect(p7Content).toContain('v8::Global<v8::Object> error_obj;');
    expect(p7Content).toContain('orig_prepare_stack_trace.Reset();');
    expect(p7Content).toContain('m_state->booleanProperty("mahiSuppressContextCreated", false)');
    expect(p7Content).toContain('std::getenv("MAHI_CDP_ISOLATED")');
    expect(p7Content).toContain('V8RuntimeAgentImpl::reportExecutionContextCreated(');
    expect(p7Content).toContain('#include <cstdlib>');
    expect(p7Content).toContain('#include <cstring>');
    expect(p7Content).not.toContain('__mahi_isolate_cdp__');

    // 0008 must contain ONLY PageHandler navigation lifecycle isolation
    const p8Content = fs.readFileSync(path.join(patchesDir, '0008-mahi-rebrowser-page-handler-isolation.patch'), 'utf8');
    expect(p8Content).toContain('content/browser/devtools/protocol/page_handler.cc');
    expect(p8Content).not.toContain('v8/src/inspector');
    expect(p8Content).toContain('PageHandler::Enable(');
    expect(p8Content).toContain('mahi-cdp-isolated');

    // Check args.gn
    const argsGnPath = path.join(patchesDir, 'args.gn');
    expect(fs.existsSync(argsGnPath)).toBe(true);
    const argsGn = fs.readFileSync(argsGnPath, 'utf8');
    expect(argsGn).toContain('is_official_build = true');
    expect(argsGn).toContain('is_chrome_for_testing = false');
    expect(argsGn).toContain('google_api_key = ""');

    // Check apply-patches scripts
    expect(fs.existsSync(path.join(patchesDir, 'apply-patches.sh'))).toBe(true);
    expect(fs.existsSync(path.join(patchesDir, 'apply-patches.ps1'))).toBe(true);
    expect(fs.existsSync(path.join(patchesDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(patchesDir, 'mahi-engine.json'))).toBe(true);

    // Check GitHub Actions Build Workflow
    const workflowPath = path.resolve('.github/workflows/build-mahi-chromium.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('win64');
    expect(workflow).toContain('mac-arm64');
    expect(workflow).toContain('mac-x64');
    expect(workflow).toContain('linux64');
    expect(workflow).toContain('138.0.7204.0');
    expect(workflow).toContain('mahi-engine.json');
    expect(workflow).toContain('timeout-minutes: 360');
    expect(workflow).toContain('Free Disk Space (Ubuntu)');
    expect(workflow).toContain('Free Disk Space (Windows)');
    expect(workflow).toContain('--no-history');
    expect(workflow).toContain('retention-days: 30');
    expect(workflow).toContain('if-no-files-found: error');
  });

  // ==========================================================================
  // Test 3: browserforge-style Statistical Cross-Signal Coherence
  // ==========================================================================
  it('3. validateAndNormalizeFingerprintCoherence detects and normalizes contradictory fingerprint signals', () => {
    // Case A: Contradictory Windows tuple (Win32 UA paired with MacIntel platform and Apple M1 GPU)
    const contradictoryWindows = {
      browser: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      fingerprint: {
        platform: 'MacIntel',
        isM1: true,
        webglRenderer: 'Apple M1 Metal',
        hardwareConcurrency: 99, // Unrealistic anomaly
        deviceMemory: 100,       // Unrealistic anomaly
      },
    };

    const resultA = validateAndNormalizeFingerprintCoherence(contradictoryWindows);
    expect(resultA.valid).toBe(false);
    expect(resultA.warnings.length).toBeGreaterThanOrEqual(4);
    expect(resultA.normalizedSettings.fingerprint.platform).toBe('Win32');
    expect(resultA.normalizedSettings.fingerprint.isM1).toBe(false);
    expect(resultA.normalizedSettings.fingerprint.webglRenderer).toContain('Direct3D11');
    expect([2, 4, 6, 8, 12, 16, 24, 32]).toContain(resultA.normalizedSettings.fingerprint.hardwareConcurrency);
    expect([1, 2, 4, 8, 16]).toContain(resultA.normalizedSettings.fingerprint.deviceMemory);

    // Case B: Contradictory Mobile tuple (Android UA paired with maxTouchPoints: 0 and Direct3D11)
    const contradictoryMobile = {
      browser: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      },
      fingerprint: {
        platform: 'Win32',
        maxTouchPoints: 0,
        webglRenderer: 'ANGLE (NVIDIA, Direct3D11)',
      },
    };

    const resultB = validateAndNormalizeFingerprintCoherence(contradictoryMobile);
    expect(resultB.valid).toBe(false);
    expect(resultB.normalizedSettings.fingerprint.platform).toBe('Linux armv8l');
    expect(resultB.normalizedSettings.fingerprint.maxTouchPoints).toBe(5);
    expect(resultB.normalizedSettings.fingerprint.webglRenderer).toContain('Mali');
    expect(resultB.normalizedSettings.mobile.enable).toBe(true);

    // Case C: Coherent Windows Profile
    const coherentWindows = {
      browser: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      fingerprint: {
        platform: 'Win32',
        hardwareConcurrency: 16,
        deviceMemory: 16,
        webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
    };

    const resultC = validateAndNormalizeFingerprintCoherence(coherentWindows);
    expect(resultC.valid).toBe(true);
    expect(resultC.warnings.length).toBe(0);

    // Case D: Intel macOS Profile (Platform normalization to MacIntel & non-M1)
    const intelMac = {
      browser: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      fingerprint: {
        platform: 'Win32',
        isM1: false,
        architecture: 'x86_64',
        webglRenderer: 'Direct3D11 vs_5_0',
      },
    };
    const resultD = validateAndNormalizeFingerprintCoherence(intelMac);
    expect(resultD.valid).toBe(false);
    expect(resultD.normalizedSettings.fingerprint.platform).toBe('MacIntel');
    expect(resultD.normalizedSettings.fingerprint.isM1).toBe(false);
    expect(resultD.normalizedSettings.fingerprint.webglRenderer).toContain('Apple');

    // Case E: Linux Desktop Profile (Normalizes Win32/Direct3D11 to Linux x86_64 / Mesa)
    const linuxDesktop = {
      browser: {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      fingerprint: {
        platform: 'Win32',
        webglRenderer: 'Direct3D11 vs_5_0',
      },
    };
    const resultE = validateAndNormalizeFingerprintCoherence(linuxDesktop);
    expect(resultE.valid).toBe(false);
    expect(resultE.normalizedSettings.fingerprint.platform).toBe('Linux x86_64');
    expect(resultE.normalizedSettings.fingerprint.webglRenderer).toContain('Mesa');

    // Case F: Verify injectNativeStealthPreferences schema population for native C++ Client Hints
    const storageDir = path.join(tempBaseDir, 'prefs-storage-test');
    injectNativeStealthPreferences(
      storageDir,
      { id: 'test_prof_1', name: 'Profile 1' } as any,
      intelMac
    );
    const prefsWritten = JSON.parse(fs.readFileSync(path.join(storageDir, 'Default', 'Preferences'), 'utf8'));
    expect(prefsWritten.mahi.userAgent).toBe(intelMac.browser.userAgent);
    expect(prefsWritten.mahi.os).toBe('MacIntel');
    expect(prefsWritten.mahi.hardwareArchitecture).toBe('x86_64');
    expect(prefsWritten.gologin.userAgent).toBe(intelMac.browser.userAgent);
  });

  // ==========================================================================
  // Test 4: ai-humanizer.ts Fitts's Law Path Generation & Overshoot Bounds
  // ==========================================================================
  it('4. generateHumanPath generates organic trajectory with ballistic Fitts law acceleration and exact termination', () => {
    const start = { x: 50, y: 50 };
    const end = { x: 650, y: 480 };

    const trajectory = generateHumanPath(start, end, 35, 1.5);
    expect(trajectory.length).toBeGreaterThanOrEqual(30);

    // First point must match start
    expect(trajectory[0].x).toBe(start.x);
    expect(trajectory[0].y).toBe(start.y);

    // Last point must terminate exactly on target
    expect(trajectory[trajectory.length - 1].x).toBe(end.x);
    expect(trajectory[trajectory.length - 1].y).toBe(end.y);

    // Verify all points have finite numeric coordinates
    for (const pt of trajectory) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }

    // Verify movement is not a flat linear progression
    const midPoint = trajectory[Math.floor(trajectory.length / 2)];
    const linearMidX = (start.x + end.x) / 2;
    const linearMidY = (start.y + end.y) / 2;
    // Deviation from straight line due to natural human arc
    const deviation = Math.hypot(midPoint.x - linearMidX, midPoint.y - linearMidY);
    expect(deviation).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Test 5: Step 4 Polish Fixes (RTCPeerConnection onicecandidate & Bogus Plan Webhook)
  // ==========================================================================
  it('5. RTCPeerConnection prototype descriptor leaves pc.onicecandidate undefined, and handleWebhook rejects unknown planId with PLAN_NOT_FOUND', async () => {
    // 5A: WebRTC onicecandidate own-property absence and candidate filtering
    const profileDir = path.join(tempBaseDir, 'profile-webrtc-polish');
    fs.mkdirSync(profileDir, { recursive: true });

    const extDir = ensureProfileStealthExtension(
      profileDir,
      'prof_rtc_polish',
      'RTC Polish Profile',
      { network: { webrtc: 'disabled' } },
      { nativeStealthActive: false }
    );

    const coreScript = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

    function MockRTCPeerConnection(this: any, config?: any) {
      this.config = config;
      this.localDescription = null;
    }
    MockRTCPeerConnection.prototype = {
      _mockHandler: null as any,
      get onicecandidate() {
        return this._mockHandler;
      },
      set onicecandidate(val: any) {
        this._mockHandler = val;
      },
      addEventListener: function () {},
      dispatchEvent: function (e: any) {
        if (this.onicecandidate) this.onicecandidate(e);
      },
    };

    const sandbox = {
      window: {
        RTCPeerConnection: MockRTCPeerConnection,
      },
      navigator: { userAgent: 'Mozilla/5.0' },
      Intl: { DateTimeFormat: Intl.DateTimeFormat },
      Date: Date,
      console: console,
    } as any;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(coreScript, ctx);

    // Instantiate wrapped peer connection
    const pc = new sandbox.window.RTCPeerConnection();

    // Critical Inspection Invariant: pc MUST NOT have own property 'onicecandidate'
    expect(Object.getOwnPropertyDescriptor(pc, 'onicecandidate')).toBeUndefined();
    // Prototype MUST possess the descriptor
    expect(Object.getOwnPropertyDescriptor(sandbox.window.RTCPeerConnection.prototype, 'onicecandidate')).toBeDefined();

    // Verify candidate filtering via prototype setter
    const receivedCandidates: any[] = [];
    pc.onicecandidate = (event: any) => {
      receivedCandidates.push(event);
    };

    // Dispatch host candidate -> should be filtered
    pc.dispatchEvent({ candidate: { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.50 54321 typ host' } });
    expect(receivedCandidates.length).toBe(0);

    // Dispatch relay candidate -> should be permitted
    pc.dispatchEvent({ candidate: { candidate: 'candidate:3 1 UDP 41885695 198.51.100.1 54323 typ relay' } });
    expect(receivedCandidates.length).toBe(1);

    // Verify shared prototype (RTCPeerConnection === webkitRTCPeerConnection) does not double-wrap
    const sandboxShared = {
      window: {
        RTCPeerConnection: MockRTCPeerConnection,
        webkitRTCPeerConnection: MockRTCPeerConnection,
      },
      navigator: { userAgent: 'Mozilla/5.0' },
      Intl: { DateTimeFormat: Intl.DateTimeFormat },
      Date: Date,
      console: console,
    } as any;
    const ctxShared = vm.createContext(sandboxShared);
    vm.runInContext(coreScript, ctxShared);
    const pcShared = new sandboxShared.window.RTCPeerConnection();
    expect(Object.getOwnPropertyDescriptor(pcShared, 'onicecandidate')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(sandboxShared.window.RTCPeerConnection.prototype, 'onicecandidate')).toBeDefined();

    // 5B: handleWebhook immediately rejects unknown or empty planId with PLAN_NOT_FOUND on both succeeded and failed events
    const secret = 'whsec_simulation_test_secret';

    // Empty planId checks
    const emptyPlanPayloadSucceeded = JSON.stringify({
      id: `evt_empty_plan_${Date.now()}_1`,
      type: 'payment.succeeded',
      provider: 'simulation',
      userId: 'test_user_id',
      planId: '',
      billingCycle: 'MONTHLY',
      amountCents: 5000,
      currency: 'INR',
      externalPaymentId: `sim_pay_empty_${Date.now()}`,
    });
    const sigEmptySucceeded = crypto.createHmac('sha256', secret).update(emptyPlanPayloadSucceeded).digest('hex');
    await expect(
      paymentService.handleWebhook('simulation', emptyPlanPayloadSucceeded, sigEmptySucceeded, { secret })
    ).rejects.toThrow('PLAN_NOT_FOUND');

    const emptyPlanPayloadFailed = JSON.stringify({
      id: `evt_empty_plan_${Date.now()}_2`,
      type: 'payment.failed',
      provider: 'simulation',
      userId: 'test_user_id',
      planId: '   ',
      billingCycle: 'MONTHLY',
      amountCents: 5000,
      currency: 'INR',
      externalPaymentId: `sim_pay_empty_fail_${Date.now()}`,
    });
    const sigEmptyFailed = crypto.createHmac('sha256', secret).update(emptyPlanPayloadFailed).digest('hex');
    await expect(
      paymentService.handleWebhook('simulation', emptyPlanPayloadFailed, sigEmptyFailed, { secret })
    ).rejects.toThrow('PLAN_NOT_FOUND');

    const unknownPlanPayloadSucceeded = JSON.stringify({
      id: `evt_unknown_plan_${Date.now()}_1`,
      type: 'payment.succeeded',
      provider: 'simulation',
      userId: 'test_user_id',
      planId: 'bogus_nonexistent_plan_xyz',
      billingCycle: 'MONTHLY',
      amountCents: 5000,
      currency: 'INR',
      externalPaymentId: `sim_pay_${Date.now()}`,
    });
    const sigSucceeded = crypto.createHmac('sha256', secret).update(unknownPlanPayloadSucceeded).digest('hex');

    await expect(
      paymentService.handleWebhook('simulation', unknownPlanPayloadSucceeded, sigSucceeded, { secret })
    ).rejects.toThrow('PLAN_NOT_FOUND');

    const unknownPlanPayloadFailed = JSON.stringify({
      id: `evt_unknown_plan_${Date.now()}_2`,
      type: 'payment.failed',
      provider: 'simulation',
      userId: 'test_user_id',
      planId: 'bogus_nonexistent_plan_xyz',
      billingCycle: 'MONTHLY',
      amountCents: 5000,
      currency: 'INR',
      externalPaymentId: `sim_pay_fail_${Date.now()}`,
    });
    const sigFailed = crypto.createHmac('sha256', secret).update(unknownPlanPayloadFailed).digest('hex');

    await expect(
      paymentService.handleWebhook('simulation', unknownPlanPayloadFailed, sigFailed, { secret })
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
