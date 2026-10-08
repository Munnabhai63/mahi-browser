/**
 * MAHI BROWSER — Release Manifest & Checksum Generator
 * 
 * Generates cryptographic release manifests (latest.json and latest-beta.json)
 * containing SHA-256 and SHA-512 checksums, file sizes, and release metadata.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function calculateHash(filePath, algorithm) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(content).digest('hex');
}

function generateReleaseManifest(options = {}) {
  const releaseDir = options.releaseDir || path.join(__dirname, '..', 'release');
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const version = options.version || pkg.version || '1.1.1';
  const channel = options.channel || (version.includes('beta') ? 'BETA' : 'STABLE');
  const releaseNotes = options.releaseNotes || 'Production release with multi-user workspaces and performance optimizations.';

  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // Find installer files
  const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.exe') && !f.includes('elevate'));

  const manifestFiles = files.map((fileName) => {
    const fullPath = path.join(releaseDir, fileName);
    const stats = fs.statSync(fullPath);
    const sha256 = calculateHash(fullPath, 'sha256');
    const sha512 = calculateHash(fullPath, 'sha512');

    return {
      name: fileName,
      url: `https://mahibrowser.com/update/${encodeURIComponent(fileName)}`,
      size: stats.size,
      sha256,
      sha512,
      arch: 'x64',
    };
  });

  const primaryFile = manifestFiles.find((f) => f.name.includes('Setup')) || manifestFiles[0];

  const manifest = {
    version,
    releaseDate: new Date().toISOString(),
    channel,
    minAppVersion: '1.0.0',
    mandatory: Boolean(options.mandatory),
    releaseNotes,
    sha256: primaryFile ? primaryFile.sha256 : undefined,
    sha512: primaryFile ? primaryFile.sha512 : undefined,
    files: manifestFiles,
  };

  const outputName = channel === 'BETA' ? 'latest-beta.json' : 'latest.json';
  const outputPath = path.join(releaseDir, outputName);
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`[ReleaseManifest] Generated ${outputName} for v${version} (${manifestFiles.length} file(s))`);
  return manifest;
}

if (require.main === module) {
  generateReleaseManifest();
}

module.exports = { generateReleaseManifest, calculateHash };
