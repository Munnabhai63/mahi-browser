#!/usr/bin/env node
/**
 * MAHI Browser — Engine Version Bump Utility
 *
 * Queries Chrome for Testing's official `last-known-good-versions-with-downloads.json`
 * manifest, compares with `10_CONFIG/engine-config.ts`, prints old -> new version
 * and platform download URLs, and updates `10_CONFIG/engine-config.ts` when `--apply` is passed.
 *
 * Usage:
 *   node 12_SCRIPTS/engine-bump.cjs            # Check latest CfT Stable (dry run)
 *   node 12_SCRIPTS/engine-bump.cjs --apply    # Update 10_CONFIG/engine-config.ts
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENGINE_CONFIG_PATH = path.join(ROOT_DIR, '10_CONFIG', 'engine-config.ts');
const CFT_LAST_KNOWN_GOOD_URL =
  'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const shaArg = argv.find((a) => a.startsWith('--sha256='));
  const sha256 = shaArg ? shaArg.slice('--sha256='.length).trim() : '';
  return { apply, sha256 };
}

function readCurrentVersion(configSource) {
  const m = configSource.match(/export const MANAGED_ENGINE_VERSION\s*=\s*'([^']+)'/);
  return m ? m[1] : 'unknown';
}

function applyEngineVersionToConfig(configSource, newVersion, sha256) {
  const oldVersion = readCurrentVersion(configSource);
  const oldMajor = oldVersion.split('.')[0] || '138';
  const newMajor = newVersion.split('.')[0] || oldMajor;

  let next = configSource;
  next = next.replace(
    /export const MANAGED_ENGINE_VERSION\s*=\s*'[^']+';/,
    `export const MANAGED_ENGINE_VERSION = '${newVersion}';`
  );
  next = next.replace(
    /export const LEGACY_CFT_VERSION\s*=\s*'[^']+';/,
    `export const LEGACY_CFT_VERSION = '${newVersion}';`
  );
  next = next.replace(
    /export const MANAGED_ENGINE_SHA256\s*=\s*'[^']*';/,
    `export const MANAGED_ENGINE_SHA256 = '${sha256}';`
  );
  next = next.replace(
    /export const LEGACY_CFT_SHA256\s*=\s*'[^']*';/,
    `export const LEGACY_CFT_SHA256 = '${sha256}';`
  );
  next = next.replace(
    new RegExp(`chrome-${oldMajor}(-[a-z0-9-]+)?\\.zip`, 'g'),
    (_full, suffix = '') => `chrome-${newMajor}${suffix}.zip`
  );
  next = next.replace(
    /(win64:\s*\{[\s\S]*?sha256:\s*)'[^']*'/,
    `$1'${sha256}'`
  );

  return { next, oldVersion };
}

async function fetchLatestStableCft() {
  const res = await fetch(CFT_LAST_KNOWN_GOOD_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`CfT manifest HTTP ${res.status}`);
  }
  const json = await res.json();
  const stable = json?.channels?.Stable;
  if (!stable?.version || !Array.isArray(stable?.downloads?.chrome)) {
    throw new Error('Malformed CfT Stable manifest payload');
  }
  const urls = {};
  for (const item of stable.downloads.chrome) {
    if (item?.platform && item?.url) {
      urls[item.platform] = item.url;
    }
  }
  return { version: String(stable.version), urls };
}

async function main() {
  const { apply, sha256 } = parseArgs(process.argv.slice(2));
  const rawConfig = fs.readFileSync(ENGINE_CONFIG_PATH, 'utf8');
  const currentVersion = readCurrentVersion(rawConfig);

  const stable = await fetchLatestStableCft();
  console.log(`[engine-bump] Current MANAGED_ENGINE_VERSION: ${currentVersion}`);
  console.log(`[engine-bump] Latest CfT Stable version:    ${stable.version}`);
  console.log(`[engine-bump] win64:     ${stable.urls.win64 || 'n/a'}`);
  console.log(`[engine-bump] mac-arm64: ${stable.urls['mac-arm64'] || 'n/a'}`);
  console.log(`[engine-bump] mac-x64:   ${stable.urls['mac-x64'] || 'n/a'}`);
  console.log(`[engine-bump] linux64:   ${stable.urls.linux64 || 'n/a'}`);

  if (!apply) {
    console.log('[engine-bump] Dry run complete. Pass --apply to write changes to 10_CONFIG/engine-config.ts.');
    return;
  }

  const { next, oldVersion } = applyEngineVersionToConfig(rawConfig, stable.version, sha256);
  fs.writeFileSync(ENGINE_CONFIG_PATH, next, 'utf8');
  console.log(`[engine-bump] Updated 10_CONFIG/engine-config.ts: ${oldVersion} -> ${stable.version}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[engine-bump ERROR] ${err?.message || err}`);
    process.exit(1);
  });
}

module.exports = {
  readCurrentVersion,
  applyEngineVersionToConfig,
  fetchLatestStableCft,
};
