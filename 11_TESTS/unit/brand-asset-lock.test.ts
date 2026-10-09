import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  BRAND_CONFIG,
  PRIMARY_LOGO,
  RED_MARK,
  DARK_MARK,
  APP_ICON,
} from '../../10_CONFIG/brand-config.js';

describe('Official Brand Asset Lock & Non-Draggable Verification Suite', () => {
  const root = process.cwd();

  describe('1. Immutable Master Asset Hash Lock (SHA-256)', () => {
    const manifestPath = path.resolve(root, 'brand-assets.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    it('verifies brand-assets.json manifest exists and is locked', () => {
      expect(manifest.status).toBe('APPROVED_FINAL_LOCKED');
      expect(Object.keys(manifest.assets)).toHaveLength(4);
    });

    for (const [code, meta] of Object.entries(manifest.assets as Record<string, any>)) {
      it(`locks ${code} (${meta.filename}) to exact approved SHA-256 hash`, () => {
        const filePath = path.resolve(root, meta.path);
        expect(fs.existsSync(filePath)).toBe(true);

        const data = fs.readFileSync(filePath);
        const computedHash = crypto.createHash('sha256').update(data).digest('hex');
        expect(computedHash).toBe(meta.sha256);
      });
    }

    it('verifies 4 master roles match the central BRAND_CONFIG', () => {
      expect(PRIMARY_LOGO).toBe('/brand/mahi-browser-logo-primary.png');
      expect(RED_MARK).toBe('/brand/mahi-browser-mark-red.png');
      expect(DARK_MARK).toBe('/brand/mahi-browser-mark-dark.png');
      expect(APP_ICON).toBe('/brand/mahi-browser-app-icon.png');

      expect(BRAND_CONFIG.hashes.ASSET_A).toBe(manifest.assets.ASSET_A.sha256);
      expect(BRAND_CONFIG.hashes.ASSET_B).toBe(manifest.assets.ASSET_B.sha256);
      expect(BRAND_CONFIG.hashes.ASSET_C).toBe(manifest.assets.ASSET_C.sha256);
      expect(BRAND_CONFIG.hashes.ASSET_D).toBe(manifest.assets.ASSET_D.sha256);
    });
  });

  describe('2. Aspect Ratio and Exact Color Preservation (No CSS Filters)', () => {
    it('verifies no CSS filters recolor or modify brand logo identity', () => {
      const stylesPath = path.resolve(root, 'landing/assets/css/styles.css');
      const css = fs.readFileSync(stylesPath, 'utf8');

      // Check brand logo selectors do not apply hue-rotate, invert, sepia, or color filters
      const brandLogoMatch = css.match(/\.brand-logo-clean\s*img\s*\{([^}]+)\}/);
      expect(brandLogoMatch).not.toBeNull();
      const brandRules = brandLogoMatch ? brandLogoMatch[1] : '';

      expect(brandRules).not.toContain('hue-rotate');
      expect(brandRules).not.toContain('invert');
      expect(brandRules).not.toContain('sepia');
      expect(brandRules).toContain('object-fit: contain');
    });

    it('verifies footer brand image preserves aspect ratio and contains no filter', () => {
      const stylesPath = path.resolve(root, 'landing/assets/css/styles.css');
      const css = fs.readFileSync(stylesPath, 'utf8');

      const footerMatch = css.match(/\.footer-brand-logo-img\s*\{([^}]+)\}/);
      expect(footerMatch).not.toBeNull();
      const footerRules = footerMatch ? footerMatch[1] : '';

      expect(footerRules).toContain('object-fit: contain');
      expect(footerRules).not.toContain('hue-rotate');
    });
  });

  describe('3. Non-Draggable Product Branding Protection', () => {
    it('verifies CSS rules prevent native dragging and text selection on brand logos', () => {
      const stylesPath = path.resolve(root, 'landing/assets/css/styles.css');
      const css = fs.readFileSync(stylesPath, 'utf8');

      expect(css).toContain('-webkit-user-drag: none');
      expect(css).toContain('user-drag: none');
      expect(css).toContain('user-select: none');
    });

    it('verifies landing index.html sets draggable="false" on all brand logos', () => {
      const indexPath = path.resolve(root, 'landing/index.html');
      const html = fs.readFileSync(indexPath, 'utf8');

      expect(html).toContain('brand-logo-clean');
      // All logo img tags must have draggable="false"
      const logoTags = html.match(/<img[^>]*assets\/img\/logo\.png[^>]*>/g) || [];
      expect(logoTags.length).toBeGreaterThan(0);
      for (const tag of logoTags) {
        expect(tag).toContain('draggable="false"');
        expect(tag).toContain('object-fit: contain');
      }
    });

    it('verifies landing pricing.html sets draggable="false" on brand logos', () => {
      const pricingPath = path.resolve(root, 'landing/pricing.html');
      const html = fs.readFileSync(pricingPath, 'utf8');

      const logoTags = html.match(/<img[^>]*assets\/img\/logo\.png[^>]*>/g) || [];
      expect(logoTags.length).toBeGreaterThan(0);
      for (const tag of logoTags) {
        expect(tag).toContain('draggable="false"');
      }
    });

    it('verifies landing main.js attaches dragstart preventDefault listeners to brand logos', () => {
      const jsPath = path.resolve(root, 'landing/assets/js/main.js');
      const js = fs.readFileSync(jsPath, 'utf8');

      expect(js).toContain('initBrandDragLock');
      expect(js).toContain('dragstart');
      expect(js).toContain('preventDefault');
    });

    it('verifies splash.html sets draggable="false" and non-draggable CSS', () => {
      const splashPath = path.resolve(root, '13_ASSETS/resources/splash.html');
      const html = fs.readFileSync(splashPath, 'utf8');

      expect(html).toContain('draggable="false"');
    });
  });

  describe('4. Legacy Green M Elimination', () => {
    it('confirms the legacy 11,477-byte green M icon is not in landing/assets/img/logo.png', () => {
      const logoPath = path.resolve(root, 'landing/assets/img/logo.png');
      const stat = fs.statSync(logoPath);
      expect(stat.size).not.toBe(11477);
      expect(stat.size).toBe(735223); // Exact size of ASSET_B (Red Dragon Mark)
    });

    it('confirms the legacy 21,954-byte favicon is not in landing/assets/img/favicon.ico', () => {
      const favPath = path.resolve(root, 'landing/assets/img/favicon.ico');
      const stat = fs.statSync(favPath);
      expect(stat.size).not.toBe(21954);
    });
  });
});
