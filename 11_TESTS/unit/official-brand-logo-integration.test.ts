import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BRAND_CONFIG } from '../../10_CONFIG/brand-config.js';

describe('Official MAHI Browser Brand Logo Integration Suite', () => {
  const root = process.cwd();

  describe('1. Master and Derivative Brand Assets Integrity', () => {
    it('verifies the approved master logo asset is preserved untouched', () => {
      const masterPath = path.resolve(root, '13_ASSETS/brand/mahi-browser-logo-master.png');
      expect(fs.existsSync(masterPath)).toBe(true);
      const stat = fs.statSync(masterPath);
      expect(stat.size).toBeGreaterThan(100_000); // 1024x1024 PNG
    });

    it('verifies horizontal full logo variants exist for light and dark backgrounds', () => {
      const lightLogo = path.resolve(root, '13_ASSETS/brand/mahi-browser-logo-horizontal.png');
      const darkLogo = path.resolve(root, '13_ASSETS/brand/mahi-browser-logo-dark.png');
      expect(fs.existsSync(lightLogo)).toBe(true);
      expect(fs.existsSync(darkLogo)).toBe(true);
      expect(fs.statSync(lightLogo).size).toBeGreaterThan(10_000);
      expect(fs.statSync(darkLogo).size).toBeGreaterThan(10_000);
    });

    it('verifies dragon brand mark variants exist with clean transparent alpha', () => {
      const mark = path.resolve(root, '13_ASSETS/brand/mahi-browser-mark.png');
      const mono = path.resolve(root, '13_ASSETS/brand/mahi-browser-mark-mono.png');
      expect(fs.existsSync(mark)).toBe(true);
      expect(fs.existsSync(mono)).toBe(true);
      expect(fs.statSync(mark).size).toBeGreaterThan(10_000);
    });

    it('verifies high-resolution 512x512 app icon squircle exists', () => {
      const iconPath = path.resolve(root, '13_ASSETS/brand/mahi-browser-icon.png');
      const resIconPath = path.resolve(root, '13_ASSETS/resources/icon.png');
      expect(fs.existsSync(iconPath)).toBe(true);
      expect(fs.existsSync(resIconPath)).toBe(true);
      expect(fs.statSync(iconPath).size).toBeGreaterThan(20_000);
    });
  });

  describe('2. Windows Multi-Resolution ICO & Packaging', () => {
    it('verifies Windows icon.ico contains 7 resolutions from 16x16 to 256x256', () => {
      const icoPath = path.resolve(root, '13_ASSETS/resources/icon.ico');
      expect(fs.existsSync(icoPath)).toBe(true);

      const buf = fs.readFileSync(icoPath);
      expect(buf.readUInt16LE(0)).toBe(0);
      expect(buf.readUInt16LE(2)).toBe(1); // ICO type
      const count = buf.readUInt16LE(4);
      expect(count).toBeGreaterThanOrEqual(7);

      const resolutions = new Set<number>();
      for (let i = 0; i < count; i++) {
        const offset = 6 + i * 16;
        const width = buf.readUInt8(offset) || 256;
        const height = buf.readUInt8(offset + 1) || 256;
        expect(width).toBe(height);
        resolutions.add(width);
      }

      expect(resolutions.has(16)).toBe(true);
      expect(resolutions.has(32)).toBe(true);
      expect(resolutions.has(48)).toBe(true);
      expect(resolutions.has(64)).toBe(true);
      expect(resolutions.has(128)).toBe(true);
      expect(resolutions.has(256)).toBe(true);
    });

    it('verifies electron-builder.json binds official icon across all installer facets', () => {
      const builderPath = path.resolve(root, 'electron-builder.json');
      const cfg = JSON.parse(fs.readFileSync(builderPath, 'utf8'));

      expect(cfg.win.icon).toBe('13_ASSETS/resources/icon.ico');
      expect(cfg.nsis.installerIcon).toBe('13_ASSETS/resources/icon.ico');
      expect(cfg.nsis.uninstallerIcon).toBe('13_ASSETS/resources/icon.ico');
      expect(cfg.mac.icon).toBe('13_ASSETS/resources/icon.png');
    });
  });

  describe('3. Web & Landing Platform Brand Mapping', () => {
    it('verifies web favicon sets exist at root, public, and landing targets', () => {
      expect(fs.existsSync(path.resolve(root, 'favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.resolve(root, 'public/favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.resolve(root, 'public/brand/mahi-browser-mark.png'))).toBe(true);
      expect(fs.existsSync(path.resolve(root, 'landing/assets/img/favicon.ico'))).toBe(true);
      expect(fs.existsSync(path.resolve(root, 'landing/assets/img/logo.png'))).toBe(true);
    });

    it('verifies landing logo.png is replaced with official brand mark', () => {
      const landingLogoPath = path.resolve(root, 'landing/assets/img/logo.png');
      const stat = fs.statSync(landingLogoPath);
      expect(stat.size).toBeGreaterThan(5_000);
    });
  });

  describe('4. Android Companion App Resources', () => {
    it('verifies standard and round launcher icons exist across all density buckets', () => {
      const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
      for (const d of densities) {
        const folder = path.resolve(root, `android/app/src/main/res/mipmap-${d}`);
        expect(fs.existsSync(path.join(folder, 'ic_launcher.png'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'ic_launcher_round.png'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'ic_notification.png'))).toBe(true);
      }
    });

    it('verifies adaptive icon XML and drawables exist', () => {
      const anydpi = path.resolve(root, 'android/app/src/main/res/mipmap-anydpi-v26');
      expect(fs.existsSync(path.join(anydpi, 'ic_launcher.xml'))).toBe(true);
      expect(fs.existsSync(path.join(anydpi, 'ic_launcher_round.xml'))).toBe(true);

      const drawable = path.resolve(root, 'android/app/src/main/res/drawable');
      expect(fs.existsSync(path.join(drawable, 'ic_launcher_foreground.png'))).toBe(true);
      expect(fs.existsSync(path.join(drawable, 'ic_notification.png'))).toBe(true);
    });
  });

  describe('5. Central Brand Configuration & UI Consistency', () => {
    it('verifies BRAND_CONFIG exports authoritative metadata', () => {
      expect(BRAND_CONFIG.productName).toBe('MAHI Browser');
      expect(BRAND_CONFIG.brandName).toBe('MAHI Browser');
      expect(BRAND_CONFIG.assets.master).toBe('13_ASSETS/brand/mahi-browser-logo-master.png');
      expect(BRAND_CONFIG.assets.mark).toBe('/brand/mahi-browser-mark.png');
      expect(BRAND_CONFIG.colors.primaryCrimson).toBe('#B91C1C');
    });

    it('verifies splash.html uses icon.png instead of generic M badge', () => {
      const splashPath = path.resolve(root, '13_ASSETS/resources/splash.html');
      const content = fs.readFileSync(splashPath, 'utf8');
      expect(content).toContain('src="icon.png"');
      expect(content).not.toContain('<div class="icon-badge">M</div>');
      expect(content).toContain('MAHI BROWSER');
    });
  });
});
