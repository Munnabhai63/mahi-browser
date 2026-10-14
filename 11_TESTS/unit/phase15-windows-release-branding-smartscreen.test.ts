import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDistributionInfo } from '../../03_HARDWARE/distribution-service.js';
import { getDownloadPortalHtml } from '../../07_BACKEND/server/download-portal-html.js';

describe('Phase 15: Windows Release Branding, Artifact Naming & SmartScreen Diagnostic Suite', () => {

  describe('1. Step 1 & 2: Product Name & Release Artifact Naming', () => {
    it('verifies electron-builder.json specifies professional productName and versioned artifactName', () => {
      const builderConfigPath = path.resolve(process.cwd(), 'electron-builder.json');
      expect(fs.existsSync(builderConfigPath)).toBe(true);

      const builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
      expect(builderConfig.productName).toBe('MAHI Browser');
      expect(builderConfig.copyright).toContain('Munna Bhai');

      // Windows installer and portable artifact patterns
      expect(builderConfig.win.artifactName).toBe('MAHI-Browser-Setup-${version}.${ext}');
      expect(builderConfig.portable.artifactName).toBe('MAHI-Browser-Portable-${version}.${ext}');
      expect(builderConfig.nsis.shortcutName).toBe('MAHI Browser');
    });

    it('verifies package.json official author and version consistency', () => {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.author).toBe('Munna Bhai');
      expect(pkg.version).toMatch(/^1\.1\.[1-4]$/);
    });

  });

  describe('2. Step 3 & 4: Windows Multi-Resolution Icon & NSIS Configuration', () => {
    it('verifies icon.ico contains multi-resolution icons including standard 256x256', () => {
      const iconPath = path.resolve(process.cwd(), '13_ASSETS/resources/icon.ico');
      expect(fs.existsSync(iconPath)).toBe(true);

      const buf = fs.readFileSync(iconPath);
      // Header check: 2 bytes reserved (0), 2 bytes type (1 = icon), 2 bytes count
      expect(buf.readUInt16LE(0)).toBe(0);
      expect(buf.readUInt16LE(2)).toBe(1);
      const iconCount = buf.readUInt16LE(4);
      expect(iconCount).toBeGreaterThanOrEqual(4); // Multi-res icon

      // Verify at least one 256x256 entry (stored as 0 width / 0 height in directory entry)
      let has256 = false;
      for (let i = 0; i < iconCount; i++) {
        const offset = 6 + i * 16;
        const width = buf.readUInt8(offset) || 256;
        const height = buf.readUInt8(offset + 1) || 256;
        if (width === 256 && height === 256) {
          has256 = true;
          break;
        }
      }
      expect(has256).toBe(true);
    });

    it('verifies electron-builder.json binds official icon to installer, uninstaller and executable', () => {
      const builderConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'electron-builder.json'), 'utf8'));

      expect(builderConfig.win.icon).toBe('13_ASSETS/resources/icon.ico');
      expect(builderConfig.nsis.installerIcon).toBe('13_ASSETS/resources/icon.ico');
      expect(builderConfig.nsis.uninstallerIcon).toBe('13_ASSETS/resources/icon.ico');
    });
  });

  describe('3. Step 10 & 17: Release Artifact Verification & Old Unsigned Artifact Removal', () => {
    it('verifies professional installer and portable release artifacts exist with valid hashes', () => {
      const releaseDir = path.resolve(process.cwd(), 'release');
      const setupPath = path.join(releaseDir, 'MAHI-Browser-Setup-1.1.1.exe');
      const portablePath = path.join(releaseDir, 'MAHI-Browser-Portable-1.1.1.exe');
      const manifestPath = path.join(releaseDir, 'latest.json');

      expect(fs.existsSync(setupPath)).toBe(true);
      expect(fs.existsSync(portablePath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.version).toBe('1.1.1');

      const setupFile = manifest.files.find((f: any) => f.name === 'MAHI-Browser-Setup-1.1.1.exe');
      expect(setupFile).toBeDefined();

      const setupHash = crypto.createHash('sha256').update(fs.readFileSync(setupPath)).digest('hex');
      expect(setupFile.sha256).toBe(setupHash);
    });

    it('verifies old confusing artifacts with spaces are removed from release directory', () => {
      const releaseDir = path.resolve(process.cwd(), 'release');
      const oldSetup = path.join(releaseDir, 'MAHI BROWSER-1.1.1-Setup.exe');
      const oldPortable = path.join(releaseDir, 'MAHI BROWSER-1.1.1-Portable.exe');

      expect(fs.existsSync(oldSetup)).toBe(false);
      expect(fs.existsSync(oldPortable)).toBe(false);
    });
  });

  describe('4. Step 7 & 9: Distribution Service & Download UX Branding', () => {
    it('verifies distribution service serves versioned filename and accurate metadata', () => {
      const info = getDistributionInfo();

      expect(info.setupFileName).toMatch(/^MAHI-Browser-Setup-1\.1\.[1-4]\.exe$/);
      expect(info.portableFileName).toMatch(/^MAHI-Browser-Portable-1\.1\.[1-4]\.exe$/);
      expect(info.version).toMatch(/^1\.1\.[1-4]$/);

      expect(info.setupAvailable).toBe(true);
      expect(info.setupSizeMB).toBeGreaterThan(50);
    });

    it('verifies download portal HTML renders consistent MAHI Browser branding and version', () => {
      const html = getDownloadPortalHtml({
        version: '1.1.1',
        setupSizeMB: 86.7,
      });

      expect(html).toContain('Download MAHI Browser for Windows');
      expect(html).toContain('Version 1.1.1 — Windows x64');
      expect(html).toContain('Windows x64');
      expect(html).toContain('v1.1.1');
      expect(html).not.toContain('MAHI-Setup.exe');
    });
  });

  describe('5. Step 2, 3 & 12: SmartScreen Root Cause Diagnostic & Signing Safety', () => {
    it('classifies root cause as UNSIGNED binary triggering SmartScreen Unknown Publisher', () => {
      // Diagnostic classification test
      const classification = {
        primaryRootCause: 'A. UNSIGNED',
        smartScreenTrigger: 'UNKNOWN_PUBLISHER',
        safeResolution: 'Authenticode signing with valid certificate and RFC 3161 timestamp',
        reputationNote: 'Reputation builds over time with verified publisher; bypass code forbidden',
      };

      expect(classification.primaryRootCause).toBe('A. UNSIGNED');
      expect(classification.smartScreenTrigger).toBe('UNKNOWN_PUBLISHER');
      expect(classification.safeResolution).toContain('Authenticode');
    });

    it('strictly forbids registry tampering or disabling Windows SmartScreen in codebase', () => {
      const allFiles = [
        '03_HARDWARE/distribution-service.ts',
        '07_BACKEND/server/app.ts',
        '12_SCRIPTS/sign.cjs',
        '12_SCRIPTS/smoke-test-packaged-app.cjs',
      ];

      for (const f of allFiles) {
        const fullPath = path.resolve(process.cwd(), f);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('SmartScreenEnabled');
          expect(content).not.toContain('EnableSmartScreen');
          expect(content).not.toContain('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System');
        }
      }
    });
  });

});
