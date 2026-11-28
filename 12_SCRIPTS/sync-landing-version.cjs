/**
 * MAHI BROWSER — Landing Page & Release Assets Version Synchronization
 *
 * Synchronizes landing/package.json, landing/lib/brand.ts,
 * landing/public/assets/js/main.js, and brand-assets.json
 * with package.json version as single source of truth.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`[SYNC_LANDING] Target version from package.json: ${version}`);

function writeIfChanged(filePath, nextContent, label) {
  const prevContent = fs.readFileSync(filePath, 'utf8');
  if (prevContent !== nextContent) {
    fs.writeFileSync(filePath, nextContent, 'utf8');
    console.log(`✓ Updated ${filePath} (${label})`);
  } else {
    console.log(`= Up-to-date ${filePath} (${label})`);
  }
}

// 1. landing/package.json
const landingPkgPath = path.join(rootDir, 'landing', 'package.json');
if (fs.existsSync(landingPkgPath)) {
  const lPkg = JSON.parse(fs.readFileSync(landingPkgPath, 'utf8'));
  lPkg.version = version;
  writeIfChanged(landingPkgPath, `${JSON.stringify(lPkg, null, 2)}\n`, `version: ${version}`);
}

// 2. brand-assets.json
const brandAssetsPath = path.join(rootDir, 'brand-assets.json');
if (fs.existsSync(brandAssetsPath)) {
  const brandAssets = JSON.parse(fs.readFileSync(brandAssetsPath, 'utf8'));
  brandAssets.app_version = version;
  writeIfChanged(brandAssetsPath, `${JSON.stringify(brandAssets, null, 2)}\n`, `app_version: ${version}`);
}

// 3. landing/lib/brand.ts
const brandTsPath = path.join(rootDir, 'landing', 'lib', 'brand.ts');
if (fs.existsSync(brandTsPath)) {
  const prev = fs.readFileSync(brandTsPath, 'utf8');
  const next = prev.replace(/version:\s*'[^']+'/g, `version: '${version}'`);
  writeIfChanged(brandTsPath, next, `v${version}`);
}

// 4. landing/assets/js/main.js and landing/public/assets/js/main.js
const mainJsPaths = [
  path.join(rootDir, 'landing', 'assets', 'js', 'main.js'),
  path.join(rootDir, 'landing', 'public', 'assets', 'js', 'main.js'),
];
for (const mainJsPath of mainJsPaths) {
  if (fs.existsSync(mainJsPath)) {
    const prev = fs.readFileSync(mainJsPath, 'utf8');
    const next = prev.replace(
      /MAHI-Browser-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe \(v[0-9]+\.[0-9]+\.[0-9]+\)/g,
      `MAHI-Browser-Setup-${version}.exe (v${version})`
    );
    writeIfChanged(mainJsPath, next, `v${version}`);
  }
}

console.log('[SYNC_LANDING] Complete.');
