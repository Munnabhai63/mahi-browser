/**
 * Pre-Packaging Staging Script for Electron Builder
 * Ensures that extraResources targets (.mahi_data/engines/<version>, .mahi_data/platform-tools, landing, sql-wasm.wasm)
 * exist prior to electron-builder execution, preventing ENOENT failures during local or CI builds.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

function resolveAuthoritativeEngineVersion() {
  try {
    const engineConfigPath = path.join(rootDir, '10_CONFIG', 'engine-config.ts');
    const raw = fs.readFileSync(engineConfigPath, 'utf8');
    const prodMatch = raw.match(/export const AUTHORITATIVE_PRODUCTION_VERSION\s*=\s*'([^']+)'/);
    if (prodMatch && prodMatch[1]) return prodMatch[1];
    const managedMatch = raw.match(/export const MANAGED_ENGINE_VERSION\s*=\s*'([^']+)'/);
    if (managedMatch && managedMatch[1]) return managedMatch[1];
  } catch {}
  return '138.0.7204.0';
}

function getPlatformToolsDownloadUrl(platform = process.platform) {
  if (platform === 'win32') {
    return 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
  }
  if (platform === 'darwin') {
    return 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
  }
  return 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip';
}

function hasCompleteBundledAdb(targetDir, platform = process.platform) {
  const adbName = platform === 'win32' ? 'adb.exe' : 'adb';
  if (!fs.existsSync(path.join(targetDir, adbName))) {
    return false;
  }
  if (platform === 'win32') {
    return (
      fs.existsSync(path.join(targetDir, 'AdbWinApi.dll')) &&
      fs.existsSync(path.join(targetDir, 'AdbWinUsbApi.dll'))
    );
  }
  return true;
}

function extractZipSync(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  try {
    execFileSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'ignore', timeout: 60000 });
    return;
  } catch {}

  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'ignore', timeout: 60000 }
    );
  } else {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'ignore', timeout: 60000 });
  }
}

function copyDirectoryRecursive(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function stageAdbPlatformTools() {
  const platformToolsDir = path.join(rootDir, '.mahi_data', 'platform-tools');
  const adbExeName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const requireBundledAdb = process.env.MAHI_REQUIRE_BUNDLED_ADB === '1';

  if (hasCompleteBundledAdb(platformToolsDir)) {
    const sizeKb = Math.round(fs.statSync(path.join(platformToolsDir, adbExeName)).size / 1024);
    console.log(`[STAGE_PACKAGING] Android Platform Tools (ADB) confirmed (${adbExeName}, ${sizeKb} KB).`);
    return;
  }

  fs.mkdirSync(platformToolsDir, { recursive: true });

  if (process.env.MAHI_SKIP_ADB_STAGE === '1') {
    console.log('[STAGE_PACKAGING] Skipping ADB download because MAHI_SKIP_ADB_STAGE=1.');
    return;
  }

  const downloadUrl = getPlatformToolsDownloadUrl();
  const tempWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-stage-adb-'));
  const tempZipPath = path.join(tempWorkDir, 'platform-tools.zip');
  const tempExtractDir = path.join(tempWorkDir, 'extract');

  try {
    console.log(`[STAGE_PACKAGING] Downloading official Android Platform Tools from ${downloadUrl}...`);
    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'MAHI-Browser-Packager/1.0' },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${response.statusText})`);
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    if (zipBuffer.length < 500_000) {
      throw new Error('Downloaded platform-tools zip archive was unexpectedly small.');
    }

    fs.writeFileSync(tempZipPath, zipBuffer);
    extractZipSync(tempZipPath, tempExtractDir);

    const extractedRoot = path.join(tempExtractDir, 'platform-tools');
    if (!fs.existsSync(extractedRoot)) {
      throw new Error('Extracted archive is missing top-level platform-tools directory.');
    }

    // Keep ADB runtime binary, required shared/DLL dependencies, license notice, and revision metadata
    const filesToCopy =
      process.platform === 'win32'
        ? ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll', 'NOTICE.txt', 'source.properties']
        : ['adb', 'NOTICE.txt', 'source.properties'];

    for (const fileName of filesToCopy) {
      const src = path.join(extractedRoot, fileName);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(platformToolsDir, fileName));
      }
    }

    const lib64Src = path.join(extractedRoot, 'lib64');
    if (fs.existsSync(lib64Src) && fs.statSync(lib64Src).isDirectory()) {
      copyDirectoryRecursive(lib64Src, path.join(platformToolsDir, 'lib64'));
    }

    const finalAdbPath = path.join(platformToolsDir, adbExeName);
    if (process.platform !== 'win32' && fs.existsSync(finalAdbPath)) {
      fs.chmodSync(finalAdbPath, 0o755);
    }

    if (!hasCompleteBundledAdb(platformToolsDir)) {
      throw new Error(`Staged ADB bundle incomplete inside ${platformToolsDir}`);
    }

    const versionOut = execFileSync(finalAdbPath, ['version'], { encoding: 'utf8', timeout: 10000 });
    const firstLine = versionOut.split(/\r?\n/)[0]?.trim() || 'ready';
    console.log(`[STAGE_PACKAGING] Android Platform Tools staged cleanly: ${firstLine}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (requireBundledAdb) {
      throw new Error(`[STAGE_PACKAGING FATAL] Failed to bundle Android Platform Tools: ${msg}`);
    }
    console.warn(`[STAGE_PACKAGING WARNING] Could not download ADB Platform Tools (${msg}). Build continues cleanly; release CI requires MAHI_REQUIRE_BUNDLED_ADB=1.`);
  } finally {
    try {
      fs.rmSync(tempWorkDir, { recursive: true, force: true });
    } catch {}
  }
}

async function stagePackagingResources() {
  console.log('[STAGE_PACKAGING] Verifying packaging resources...');

  // 1. Stage Chromium Engine Directory (.mahi_data/engines/<AUTHORITATIVE_PRODUCTION_VERSION>)
  const productionVersion = resolveAuthoritativeEngineVersion();
  const engineDir = path.join(rootDir, '.mahi_data', 'engines', productionVersion);
  if (!fs.existsSync(engineDir)) {
    fs.mkdirSync(engineDir, { recursive: true });
    console.log(`[STAGE_PACKAGING] Created missing engine directory: ${engineDir}`);
  }

  // Ensure stock Chromium snapshots do NOT inherit custom C++ engine manifest
  const engineManifestDest = path.join(engineDir, 'mahi-engine.json');
  if (fs.existsSync(engineManifestDest)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(engineManifestDest, 'utf8'));
      if (!parsed?.executablePath) {
        fs.unlinkSync(engineManifestDest);
        console.log(`[STAGE_PACKAGING] Removed spurious mahi-engine.json from stock engine folder: ${engineManifestDest}`);
      }
    } catch {
      try {
        fs.unlinkSync(engineManifestDest);
      } catch {}
    }
  }

  // 2. Stage Android Platform Tools (ADB + DLL dependencies) for out-of-the-box Mobile IP Rotator
  await stageAdbPlatformTools();

  // 3. Verify landing directory exists
  const landingDir = path.join(rootDir, 'landing');
  if (!fs.existsSync(landingDir)) {
    console.warn(`[STAGE_PACKAGING WARNING] Landing directory not found at ${landingDir}`);
  } else {
    console.log(`[STAGE_PACKAGING] Landing directory confirmed (${fs.readdirSync(landingDir).length} files/folders).`);
  }

  // 4. Verify sql-wasm.wasm
  const wasmSource = path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSource)) {
    console.log('[STAGE_PACKAGING] sql-wasm.wasm confirmed.');
  }

  console.log('[STAGE_PACKAGING] All packaging prerequisites staged successfully.');
}

stagePackagingResources().catch((err) => {
  console.error(err);
  process.exit(1);
});
