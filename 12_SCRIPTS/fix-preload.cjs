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
  // Copy CJS preload as .cjs
  fs.copyFileSync(src, destCjs);
  // Also keep the .js version in case anything references it
  fs.copyFileSync(src, destJs);
  console.log('Preload CJS copied to', destCjs);
} else {
  console.error('ERROR: preload.cjs not found at', src);
  process.exit(1);
}
