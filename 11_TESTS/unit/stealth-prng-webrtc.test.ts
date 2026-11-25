import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {
  fnv1a32,
  createMulberry32,
  deriveProfileStealthSeed,
  ensureProfileStealthExtension,
  buildSanitizedLaunchArgs,
} from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

function createStealthVmHarness(stealthJs: string) {
  class MockDOMRect {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number
    ) {}
  }

  class MockElement {
    getBoundingClientRect() {
      return new MockDOMRect(10, 20, 120, 40);
    }
    getClientRects() {
      const list: any = [new MockDOMRect(10, 20, 120, 40)];
      list.item = (i: number) => list[i] || null;
      return list;
    }
  }

  class MockRange {
    getBoundingClientRect() {
      return new MockDOMRect(5, 15, 80, 20);
    }
    getClientRects() {
      const list: any = [new MockDOMRect(5, 15, 80, 20)];
      list.item = (i: number) => list[i] || null;
      return list;
    }
  }

  class MockAudioBuffer {
    private _data: Float32Array;
    constructor(length = 400) {
      this._data = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        this._data[i] = Math.sin(i * 0.1) * 0.5 + 0.1;
      }
    }
    getChannelData() {
      return this._data;
    }
    copyFromChannel(dest: Float32Array, _ch = 0, offset = 0) {
      for (let i = 0; i < dest.length && i + offset < this._data.length; i++) {
        dest[i] = this._data[i + offset];
      }
    }
  }

  class MockAnalyserNode {
    getFloatFrequencyData(arr: Float32Array) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = -40 - (i % 10) * 1.5;
      }
    }
  }

  function createPixelBuffer(w: number, h: number): Uint8ClampedArray {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = (i * 3) & 255;
      buf[i + 1] = (i * 7) & 255;
      buf[i + 2] = (i * 11) & 255;
      buf[i + 3] = 255; // Opaque pixels so anti-detect noise applies
    }
    return buf;
  }

  class MockCanvasRenderingContext2D {
    constructor(public canvas: MockHTMLCanvasElement) {}
    getImageData(sx = 0, sy = 0, sw = this.canvas.width, sh = this.canvas.height) {
      const out = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const srcIdx = ((sy + y) * this.canvas.width + (sx + x)) * 4;
          const dstIdx = (y * sw + x) * 4;
          out[dstIdx] = this.canvas._pixels[srcIdx];
          out[dstIdx + 1] = this.canvas._pixels[srcIdx + 1];
          out[dstIdx + 2] = this.canvas._pixels[srcIdx + 2];
          out[dstIdx + 3] = this.canvas._pixels[srcIdx + 3];
        }
      }
      return { width: sw, height: sh, data: out };
    }
    putImageData(imgData: { width: number; height: number; data: Uint8ClampedArray }, dx = 0, dy = 0) {
      for (let y = 0; y < imgData.height; y++) {
        for (let x = 0; x < imgData.width; x++) {
          const srcIdx = (y * imgData.width + x) * 4;
          const dstIdx = ((dy + y) * this.canvas.width + (dx + x)) * 4;
          this.canvas._pixels[dstIdx] = imgData.data[srcIdx];
          this.canvas._pixels[dstIdx + 1] = imgData.data[srcIdx + 1];
          this.canvas._pixels[dstIdx + 2] = imgData.data[srcIdx + 2];
          this.canvas._pixels[dstIdx + 3] = imgData.data[srcIdx + 3];
        }
      }
    }
    drawImage(srcCanvas: MockHTMLCanvasElement) {
      this.canvas._pixels.set(srcCanvas._pixels);
    }
  }

  class MockHTMLCanvasElement {
    width = 64;
    height = 64;
    _pixels = createPixelBuffer(64, 64);
    getContext(type: string) {
      if (type === '2d') return new MockCanvasRenderingContext2D(this);
      return null;
    }
    toDataURL() {
      const hash = crypto.createHash('sha256').update(this._pixels).digest('hex');
      return `data:image/png;base64,${hash}`;
    }
    toBlob(cb: (blob: { hash: string }) => void) {
      const hash = crypto.createHash('sha256').update(this._pixels).digest('hex');
      cb({ hash });
    }
  }

  class MockNavigator {}
  const mockWindow: any = {
    navigator: new MockNavigator(),
    Navigator: MockNavigator,
    document: {
      createElement: (tag: string) => {
        if (tag === 'canvas') return new MockHTMLCanvasElement();
        return {};
      },
    },
    HTMLCanvasElement: MockHTMLCanvasElement,
    CanvasRenderingContext2D: MockCanvasRenderingContext2D,
    DOMRect: MockDOMRect,
    Element: MockElement,
    Range: MockRange,
    AudioBuffer: MockAudioBuffer,
    AnalyserNode: MockAnalyserNode,
    Function,
    Float32Array,
    Uint8ClampedArray,
    Math,
  };
  mockWindow.window = mockWindow;

  vm.runInNewContext(stealthJs, mockWindow);
  return mockWindow;
}

describe('Phase 1.3 — Deterministic Mulberry32 PRNG & Strict WebRTC Guard', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-stealth-prng-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe('1. Deterministic Mulberry32 PRNG & Hash Consistency', () => {
    it('derives identical FNV-1a seeds and Mulberry32 sequences for identical profileId across runs', () => {
      const seedA1 = deriveProfileStealthSeed('prof-uuid-1234');
      const seedA2 = deriveProfileStealthSeed('prof-uuid-1234');
      const seedSalted = deriveProfileStealthSeed('prof-uuid-1234', { fingerprintSeed: 'salt-xyz' });

      expect(seedA1).toBe(seedA2);
      expect(seedA1).toBe(fnv1a32('prof-uuid-1234'));
      expect(seedSalted).not.toBe(seedA1);

      const rng1 = createMulberry32(seedA1);
      const rng2 = createMulberry32(seedA2);
      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());
      expect(seq1).toEqual(seq2);
    });

    it('produces identical Canvas (toDataURL, getImageData, toBlob), Audio, and ClientRects outputs for same profile.id even across reloads or rename', () => {
      const settings = getDefaultProfileSettings();
      const dir1 = path.join(tempDir, 'run1');
      const dir2 = path.join(tempDir, 'run2');

      const ext1 = ensureProfileStealthExtension(dir1, 'profile-alpha-001', 'Original Name', settings);
      const ext2 = ensureProfileStealthExtension(dir2, 'profile-alpha-001', 'Renamed Profile', settings);

      const vm1 = createStealthVmHarness(fs.readFileSync(path.join(ext1, 'stealth-core.js'), 'utf8'));
      const vm2 = createStealthVmHarness(fs.readFileSync(path.join(ext2, 'stealth-core.js'), 'utf8'));

      // Canvas toDataURL twice on same canvas & across separate reload VM
      const c1 = vm1.document.createElement('canvas');
      const c1Again = vm1.document.createElement('canvas');
      const c2 = vm2.document.createElement('canvas');

      const url1a = c1.toDataURL();
      const url1b = c1.toDataURL();
      const url1Clone = c1Again.toDataURL();
      const url2 = c2.toDataURL();

      expect(url1a).toBe(url1b);
      expect(url1a).toBe(url1Clone);
      expect(url1a).toBe(url2);

      // Canvas getImageData consistency
      const img1 = c1.getContext('2d').getImageData(0, 0, 64, 64).data;
      const img2 = c2.getContext('2d').getImageData(0, 0, 64, 64).data;
      expect(Buffer.from(img1).equals(Buffer.from(img2))).toBe(true);

      // Canvas toBlob consistency
      let blobHash1 = '';
      let blobHash2 = '';
      c1.toBlob((b: any) => { blobHash1 = b.hash; });
      c2.toBlob((b: any) => { blobHash2 = b.hash; });
      expect(blobHash1).toBeTruthy();
      expect(blobHash1).toBe(blobHash2);

      // AudioBuffer getChannelData consistency across fresh buffers in same/reloaded profile
      const ab1 = new vm1.AudioBuffer(400);
      const ab2 = new vm2.AudioBuffer(400);
      expect(Array.from(ab1.getChannelData())).toEqual(Array.from(ab2.getChannelData()));

      // AnalyserNode getFloatFrequencyData consistency
      const freq1 = new Float32Array(32);
      const freq2 = new Float32Array(32);
      new vm1.AnalyserNode().getFloatFrequencyData(freq1);
      new vm2.AnalyserNode().getFloatFrequencyData(freq2);
      expect(Array.from(freq1)).toEqual(Array.from(freq2));

      // ClientRects consistency
      const el1 = new vm1.Element();
      const el2 = new vm2.Element();
      expect(el1.getBoundingClientRect().x).toBe(el2.getBoundingClientRect().x);
      expect(el1.getBoundingClientRect().y).toBe(el2.getBoundingClientRect().y);
      expect(el1.getClientRects()[0].x).toBe(el2.getClientRects()[0].x);
    });
  });

  describe('2. Profile Isolation Across Distinct Profile IDs', () => {
    it('produces distinct Canvas, Audio, and ClientRects hashes for profileA vs profileB', () => {
      const settings = getDefaultProfileSettings();
      const dirA = path.join(tempDir, 'profA');
      const dirB = path.join(tempDir, 'profB');

      const extA = ensureProfileStealthExtension(dirA, 'profile-A-111', 'Profile A', settings);
      const extB = ensureProfileStealthExtension(dirB, 'profile-B-222', 'Profile B', settings);

      const vmA = createStealthVmHarness(fs.readFileSync(path.join(extA, 'stealth-core.js'), 'utf8'));
      const vmB = createStealthVmHarness(fs.readFileSync(path.join(extB, 'stealth-core.js'), 'utf8'));

      // Canvas isolation
      const cA = vmA.document.createElement('canvas');
      const cB = vmB.document.createElement('canvas');
      expect(cA.toDataURL()).not.toBe(cB.toDataURL());

      let blobA = '';
      let blobB = '';
      cA.toBlob((b: any) => { blobA = b.hash; });
      cB.toBlob((b: any) => { blobB = b.hash; });
      expect(blobA).not.toBe(blobB);

      const imgA = cA.getContext('2d').getImageData(0, 0, 64, 64).data;
      const imgB = cB.getContext('2d').getImageData(0, 0, 64, 64).data;
      expect(Buffer.from(imgA).equals(Buffer.from(imgB))).toBe(false);

      // WebAudio isolation (both getChannelData and getFloatFrequencyData)
      const abA = new vmA.AudioBuffer(400);
      const abB = new vmB.AudioBuffer(400);
      expect(Array.from(abA.getChannelData())).not.toEqual(Array.from(abB.getChannelData()));

      const freqA = new Float32Array(32);
      const freqB = new Float32Array(32);
      new vmA.AnalyserNode().getFloatFrequencyData(freqA);
      new vmB.AnalyserNode().getFloatFrequencyData(freqB);
      expect(Array.from(freqA)).not.toEqual(Array.from(freqB));

      // ClientRects isolation
      const rectA = new vmA.Element().getBoundingClientRect();
      const rectB = new vmB.Element().getBoundingClientRect();
      expect(rectA.x === rectB.x && rectA.y === rectB.y).toBe(false);
    });
  });

  describe('3. Strict WebRTC IPv6 & UDP Leak Guard', () => {
    it('enforces disable_non_proxied_udp and permission check whenever a proxy is active without duplicates', () => {
      const settings = getDefaultProfileSettings();
      settings.network = {
        directConnection: false,
        proxyId: 'proxy-123',
        webrtc: 'default',
      };

      const args = buildSanitizedLaunchArgs({
        storageDir: tempDir,
        debugPort: 9222,
        settings,
      });

      const policyFlags = args.filter((a) => a === '--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
      const permFlags = args.filter((a) => a === '--enforce-webrtc-ip-permission-check');

      expect(policyFlags).toHaveLength(1);
      expect(permFlags).toHaveLength(1);
    });

    it('enforces disable_non_proxied_udp and permission check for altered and disabled modes', () => {
      for (const mode of ['altered', 'disabled', 'proxy_only'] as const) {
        const settings = getDefaultProfileSettings();
        settings.network = {
          directConnection: true,
          webrtc: mode as any,
        };

        const args = buildSanitizedLaunchArgs({
          storageDir: tempDir,
          debugPort: 9222,
          settings,
        });

        expect(args.filter((a) => a === '--force-webrtc-ip-handling-policy=disable_non_proxied_udp')).toHaveLength(1);
        expect(args.filter((a) => a === '--enforce-webrtc-ip-permission-check')).toHaveLength(1);
      }
    });

    it('does not force disable_non_proxied_udp for explicit real mode without proxy', () => {
      const settings = getDefaultProfileSettings();
      settings.network = {
        directConnection: true,
        webrtc: 'real' as any,
      };
      settings.fingerprint = { webrtc: 'real' };

      const args = buildSanitizedLaunchArgs({
        storageDir: tempDir,
        debugPort: 9222,
        settings,
      });

      expect(args).not.toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
      expect(args).not.toContain('--enforce-webrtc-ip-permission-check');
    });
  });
});
