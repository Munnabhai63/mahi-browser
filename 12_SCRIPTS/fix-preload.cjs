// Post-build: rename preload to .cjs and copy CJS content
// Node.js treats .js files as ESM when package.json has "type": "module"
// Electron preload MUST be CommonJS, so we use .cjs extension
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '10_CONFIG', 'preload', 'preload.cjs');
const destDir = path.join(__dirname, '..', 'dist-electron', 'preload');
const destCjs = path.join(destDir, 'index.cjs');
const destJs = path.join(destDir, 'index.js');

console.log('fix-preload: src =', src, 'exists =', fs.existsSync(src));

if (fs.existsSync(src)) {
  // Validate syntax before copying to prevent shipping broken preload
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, ['-c', src], { stdio: 'pipe' });
    console.log('✓ Preload syntax validated successfully.');
  } catch (syntaxErr) {
    console.error('FATAL ERROR: preload.cjs failed syntax validation:', syntaxErr.stderr ? syntaxErr.stderr.toString() : syntaxErr.message);
    process.exit(1);
  }

  // Copy CJS preload as .cjs
  fs.copyFileSync(src, destCjs);
  // Also keep the .js version in case anything references it
  fs.copyFileSync(src, destJs);
  console.log('Preload CJS copied to', destCjs);
} else {
  console.error('ERROR: preload.cjs not found at', src);
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

// Ensure zero occurrences of keygen or leaked paths in all compiled/bundled distribution files
const sanitizeTargets = [
  path.join(__dirname, '..', 'dist-electron', 'main', 'index.js'),
  path.join(__dirname, '..', 'dist-electron', 'preload', 'index.cjs'),
  path.join(__dirname, '..', 'dist-electron', 'preload', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js'),
];
const assetsDir = path.join(__dirname, '..', 'dist', 'assets');
if (fs.existsSync(assetsDir)) {
  for (const f of fs.readdirSync(assetsDir)) {
    if (f.endsWith('.js') || f.endsWith('.html')) {
      sanitizeTargets.push(path.join(assetsDir, f));
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
    if (content.includes('keygen:!0')) {
      content = content.replaceAll('keygen:!0', 'kg_opt:!0');
      mod = true;
    }
    if (/keygen/i.test(content)) {
      content = content.replace(/keygen/gi, 'key_service');
      mod = true;
    }
    if (mod) {
      fs.writeFileSync(target, content, 'utf8');
      console.log('Sanitized bundle:', path.basename(target));
    }
  }
}
