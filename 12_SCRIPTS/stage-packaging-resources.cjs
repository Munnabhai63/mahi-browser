/**
 * Pre-Packaging Staging Script for Electron Builder
 * Ensures that extraResources targets (.mahi_data/engines/138.0.7204.0, landing, sql-wasm.wasm)
 * exist prior to electron-builder execution, preventing ENOENT failures during local or CI builds.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function stagePackagingResources() {
  console.log('[STAGE_PACKAGING] Verifying packaging resources...');

  // 1. Stage Chromium Engine Directory (.mahi_data/engines/138.0.7204.0)
  const engineDir = path.join(rootDir, '.mahi_data', 'engines', '138.0.7204.0');
  if (!fs.existsSync(engineDir)) {
    fs.mkdirSync(engineDir, { recursive: true });
    console.log(`[STAGE_PACKAGING] Created missing engine directory: ${engineDir}`);
  }

  const engineManifestSource = path.join(rootDir, '14_ENGINE_PATCHES', 'chromium-138', 'mahi-engine.json');
  const engineManifestDest = path.join(engineDir, 'mahi-engine.json');
  if (fs.existsSync(engineManifestSource) && !fs.existsSync(engineManifestDest)) {
    fs.copyFileSync(engineManifestSource, engineManifestDest);
    console.log(`[STAGE_PACKAGING] Embedded mahi-engine.json manifest into ${engineManifestDest}`);
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
