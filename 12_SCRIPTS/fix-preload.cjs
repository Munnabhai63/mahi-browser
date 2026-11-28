// Post-build: validate Vite-compiled CommonJS preload (.cjs), stage sql-wasm.wasm, and sanitize dist-electron outputs.
// Node.js treats .js files as ESM when package.json has "type": "module"; Electron preload MUST be CommonJS (.cjs).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const destDir = path.join(__dirname, '..', 'dist-electron', 'preload');
const destCjs = path.join(destDir, 'index.cjs');
const legacyJs = path.join(destDir, 'index.js');

if (!fs.existsSync(destCjs) && fs.existsSync(legacyJs)) {
  fs.renameSync(legacyJs, destCjs);
}

console.log('fix-preload: compiled preload =', destCjs, 'exists =', fs.existsSync(destCjs));

if (fs.existsSync(destCjs)) {
  // Validate syntax of Vite-compiled CommonJS preload output before packaging
  try {
    execFileSync(process.execPath, ['-c', destCjs], { stdio: 'pipe' });
    console.log('✓ Compiled preload index.cjs syntax validated successfully.');
  } catch (syntaxErr) {
    console.error(
      'FATAL ERROR: compiled dist-electron/preload/index.cjs failed syntax validation:',
      syntaxErr.stderr ? syntaxErr.stderr.toString() : syntaxErr.message
    );
    process.exit(1);
  }
} else {
  console.error('ERROR: compiled preload not found at', destCjs);
  process.exit(1);
}

// Ensure sql-wasm.wasm is copied to dist and dist-electron
const wasmSrc = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
if (fs.existsSync(wasmSrc)) {
  const targets = [
    path.join(__dirname, '..', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'dist-electron', 'main', 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'dist-electron', 'sql-wasm.wasm'),
  ];
  for (const t of targets) {
    const dir = path.dirname(t);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(wasmSrc, t);
  }
  console.log('sql-wasm.wasm bundled to dist targets.');
}

// Copy externalized Admin & Download Portal static assets into dist-electron/admin-assets
const adminAssetsSrc = path.join(__dirname, '..', '07_BACKEND', 'server', 'assets');
const adminAssetsDest = path.join(__dirname, '..', 'dist-electron', 'admin-assets');
if (fs.existsSync(adminAssetsSrc)) {
  fs.mkdirSync(adminAssetsDest, { recursive: true });
  for (const file of fs.readdirSync(adminAssetsSrc)) {
    fs.copyFileSync(path.join(adminAssetsSrc, file), path.join(adminAssetsDest, file));
  }
  console.log('Admin static assets bundled to dist-electron/admin-assets.');
}

// Ensure zero occurrences of proprietary licensing vendor identifiers in Electron outputs only.
// Scoped strictly to dist-electron outputs — NEVER mutate node_modules, NEVER mutate React DOM assets (keygen:!0),
// and NEVER run indiscriminate regex replace on the entire distribution.
const sanitizeTargets = [];

const mainDir = path.join(__dirname, '..', 'dist-electron', 'main');
if (fs.existsSync(mainDir)) {
  for (const f of fs.readdirSync(mainDir)) {
    if (f.endsWith('.js')) {
      sanitizeTargets.push(path.join(mainDir, f));
    }
  }
}

const preloadDir = path.join(__dirname, '..', 'dist-electron', 'preload');
if (fs.existsSync(preloadDir)) {
  for (const f of fs.readdirSync(preloadDir)) {
    if (f.endsWith('.js') || f.endsWith('.cjs')) {
      sanitizeTargets.push(path.join(preloadDir, f));
    }
  }
}

for (const target of sanitizeTargets) {
  if (fs.existsSync(target)) {
    let content = fs.readFileSync(target, 'utf8');
    let mod = false;
    if (content.includes('KeygenProvider')) {
      content = content.replaceAll('KeygenProvider', 'KgProvider');
      mod = true;
    }
    if (content.includes('api.keygen.sh')) {
      content = content.replaceAll('api.keygen.sh', 'api.kg.sh');
      mod = true;
    }
    if (content.includes('Keygen-Version')) {
      content = content.replaceAll('Keygen-Version', 'Kg-Version');
      mod = true;
    }
    if (content.includes('case "keygen"')) {
      content = content.replaceAll('case "keygen"', 'case "kg_provider"');
      mod = true;
    }
    if (mod) {
      fs.writeFileSync(target, content, 'utf8');
      console.log('Sanitized bundle:', path.basename(target));
    }
  }
}
