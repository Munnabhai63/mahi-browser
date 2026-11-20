/**
 * MAHI BROWSER — Landing Page & Release Assets Version Synchronization
 * 
 * Synchronizes landing/index.html, landing/download.html, landing/assets/js/main.js,
 * and landing/content.json with package.json version as single source of truth.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`[SYNC_LANDING] Target version from package.json: ${version}`);

// 1. landing/content.json
const contentJsonPath = path.join(rootDir, 'landing', 'content.json');
if (fs.existsSync(contentJsonPath)) {
  const content = JSON.parse(fs.readFileSync(contentJsonPath, 'utf8'));
  content.version = version;
  content.app_version = version;
  fs.writeFileSync(contentJsonPath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`✓ Updated ${contentJsonPath} (version: ${version})`);
}

// 2. landing/index.html
const indexPath = path.join(rootDir, 'landing', 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/Download v[0-9]+\.[0-9]+\.[0-9]+/g, `Download v${version}`);
  html = html.replace(/Download MAHI Browser \(v[0-9]+\.[0-9]+\.[0-9]+\)/g, `Download MAHI Browser (v${version})`);
  html = html.replace(/Windows \(v[0-9]+\.[0-9]+\.[0-9]+ Now\)/g, `Windows (v${version} Now)`);
  html = html.replace(/MAHI-Browser-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe/g, `MAHI-Browser-Setup-${version}.exe`);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`✓ Synchronized ${indexPath} to v${version}`);
}

// 3. landing/download.html
const downloadPath = path.join(rootDir, 'landing', 'download.html');
if (fs.existsSync(downloadPath)) {
  let html = fs.readFileSync(downloadPath, 'utf8');
  html = html.replace(/Version:<\/strong> v[0-9]+\.[0-9]+\.[0-9]+/g, `Version:</strong> v${version}`);
  html = html.replace(/What's New in MAHI Browser v[0-9]+\.[0-9]+\.[0-9]+/g, `What's New in MAHI Browser v${version}`);
  html = html.replace(/MAHI-Browser-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe/g, `MAHI-Browser-Setup-${version}.exe`);
  html = html.replace(/MAHI-Browser-Portable-[0-9]+\.[0-9]+\.[0-9]+\.exe/g, `MAHI-Browser-Portable-${version}.exe`);
  html = html.replace(/metadata: \{ package: type, version: '[0-9]+\.[0-9]+\.[0-9]+' \}/g, `metadata: { package: type, version: '${version}' }`);
  fs.writeFileSync(downloadPath, html, 'utf8');
  console.log(`✓ Synchronized ${downloadPath} to v${version}`);
}

// 4. landing/assets/js/main.js and landing/public/assets/js/main.js
const mainJsPaths = [
  path.join(rootDir, 'landing', 'assets', 'js', 'main.js'),
  path.join(rootDir, 'landing', 'public', 'assets', 'js', 'main.js'),
];
for (const mainJsPath of mainJsPaths) {
  if (fs.existsSync(mainJsPath)) {
    let js = fs.readFileSync(mainJsPath, 'utf8');
    js = js.replace(/MAHI-Browser-Setup-[0-9]+\.[0-9]+\.[0-9]+\.exe \(v[0-9]+\.[0-9]+\.[0-9]+\)/g, `MAHI-Browser-Setup-${version}.exe (v${version})`);
    fs.writeFileSync(mainJsPath, js, 'utf8');
    console.log(`✓ Synchronized ${mainJsPath} to v${version}`);
  }
}

console.log('[SYNC_LANDING] Complete.');
