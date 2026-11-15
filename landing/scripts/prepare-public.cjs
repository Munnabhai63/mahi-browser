const fs = require('node:fs');
const path = require('node:path');

const landingDir = path.resolve(__dirname, '..');
const assetsDir = path.join(landingDir, 'assets');
const publicDir = path.join(landingDir, 'public');
const targetAssets = path.join(publicDir, 'assets');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(targetAssets)) {
  try {
    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(assetsDir, targetAssets, symlinkType);
    console.log(`[prepare-public] Linked ${assetsDir} -> ${targetAssets}`);
  } catch (err) {
    console.log(`[prepare-public] Symlink failed (${err.message}), falling back to recursive copy...`);
    fs.cpSync(assetsDir, targetAssets, { recursive: true });
    console.log(`[prepare-public] Copied ${assetsDir} -> ${targetAssets}`);
  }
}
