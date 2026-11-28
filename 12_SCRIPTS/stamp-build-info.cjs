/**
 * MAHI Browser — Build Info & Provenance Stamping Script (Block F8)
 * Generates build-info.json with tamper-evident git commit, engine provenance,
 * and build timestamp for packaging and runtime verification.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || 'unknown';
  }
}

function stampBuildInfo() {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;
  const gitCommit = getGitCommit();
  const buildTimestamp = new Date().toISOString();

  const engineDir = path.join(rootDir, '.mahi_data', 'engines', '138.0.7204.0');
  const chromeExe = path.join(engineDir, 'chrome.exe');
  const isBundled = fs.existsSync(chromeExe);

  const buildInfo = {
    version,
    gitCommit,
    buildTimestamp,
    engine: {
      type: 'stock-snapshot',
      version: '138.0.7204.0',
      commitPosition: 1465706,
      nativeStealth: false,
      bundled: isBundled,
      sha256: '26237e603d68f909f2ba62162a30c51fa1ba94683ca61358e5489b0a08461bc2',
      sizeBytes: 296108021,
    },
  };

  const outputPath = path.join(rootDir, 'build-info.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
  console.log(`[STAMP_BUILD_INFO] Successfully stamped build-info.json:`);
  console.log(JSON.stringify(buildInfo, null, 2));

  return buildInfo;
}

if (require.main === module) {
  stampBuildInfo();
}

module.exports = { stampBuildInfo };
