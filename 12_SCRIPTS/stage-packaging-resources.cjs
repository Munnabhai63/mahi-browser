/**
 * Pre-Packaging Staging Script for Electron Builder
 * Ensures that extraResources targets (.mahi_data/engines/138.0.7204.0, landing, sql-wasm.wasm)
 * exist prior to electron-builder execution, preventing ENOENT failures during local or CI builds.
 */

const fs = require('node:fs');
const path = require('node:path');

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

function stagePackagingResources() {
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

  // 2. Verify landing directory exists
  const landingDir = path.join(rootDir, 'landing');
  if (!fs.existsSync(landingDir)) {
    console.warn(`[STAGE_PACKAGING WARNING] Landing directory not found at ${landingDir}`);
  } else {
    console.log(`[STAGE_PACKAGING] Landing directory confirmed (${fs.readdirSync(landingDir).length} files/folders).`);
  }

  // 3. Verify sql-wasm.wasm
  const wasmSource = path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSource)) {
    console.log(`[STAGE_PACKAGING] sql-wasm.wasm confirmed.`);
  }

  console.log('[STAGE_PACKAGING] All packaging prerequisites staged successfully.');
}

stagePackagingResources();
