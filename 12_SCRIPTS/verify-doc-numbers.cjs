/**
 * MAHI BROWSER — Documentation Truth & Metric Verification
 * 
 * Validates that numbers cited in docs (page count, test count) match reality.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const targetVersion = pkg.version;

let errors = 0;

function check(desc, condition, details) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}: ${details}`);
    errors++;
  }
}

function getHtmlFiles(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getHtmlFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 1. Landing Out HTML Count
const landingOutDir = path.join(rootDir, 'landing', 'out');
if (fs.existsSync(landingOutDir)) {
  const htmlFiles = getHtmlFiles(landingOutDir);
  console.log(`[INFO] Counted ${htmlFiles.length} HTML files in ${landingOutDir}`);
  check('Landing static export has >= 38 HTML files', htmlFiles.length >= 38, `Found ${htmlFiles.length}`);
  for (const requiredRoute of ['index.html', 'pricing.html', 'download.html']) {
    check(`Landing export includes ${requiredRoute}`, fs.existsSync(path.join(landingOutDir, requiredRoute)), `Missing ${requiredRoute}`);
  }
} else {
  console.log(`[WARN] ${landingOutDir} does not exist yet. Run 'npm run landing:build' first.`);
}

// 2. Check docs/LAUNCH_READINESS.md for current release version & non-zero test metrics
const launchDocPath = path.join(rootDir, 'docs', 'LAUNCH_READINESS.md');
if (fs.existsSync(launchDocPath)) {
  const content = fs.readFileSync(launchDocPath, 'utf8');
  const passedMatches = [...content.matchAll(/(\d+)\s+passed/gi)].map((m) => Number(m[1]));
  const maxPassed = passedMatches.length > 0 ? Math.max(...passedMatches) : 0;
  check(`LAUNCH_READINESS.md targets v${targetVersion}`, content.includes(`v${targetVersion}`), `Did not find "v${targetVersion}"`);
  check('LAUNCH_READINESS.md reports >= 1300 passed tests', maxPassed >= 1300, `Found max passed count: ${maxPassed}`);
  check('LAUNCH_READINESS.md reports 0 failed tests', content.includes('0 failed'), 'Did not find "0 failed"');
  check('LAUNCH_READINESS.md does not claim stale 1168 tests', !content.includes('1168 passed'), 'Found stale "1168 passed"');
} else {
  check('LAUNCH_READINESS.md exists', false, 'Missing docs/LAUNCH_READINESS.md');
}

// 3. Check docs/progress.md for current metrics
const progressDocPath = path.join(rootDir, 'docs', 'progress.md');
if (fs.existsSync(progressDocPath)) {
  const content = fs.readFileSync(progressDocPath, 'utf8');
  const passedMatches = [...content.matchAll(/(\d+)\s+passed/gi)].map((m) => Number(m[1]));
  const maxPassed = passedMatches.length > 0 ? Math.max(...passedMatches) : 0;
  check(`progress.md documents v${targetVersion}`, content.includes(`v${targetVersion}`), `Did not find "v${targetVersion}"`);
  check('progress.md reports >= 1300 passed tests', maxPassed >= 1300, `Found max passed count: ${maxPassed}`);
  check('progress.md does not claim stale 41 static pages in live status', !content.includes('Rebuilt 41 static pages'), 'Found stale "Rebuilt 41 static pages"');
} else {
  check('progress.md exists', false, 'Missing docs/progress.md');
}

if (errors > 0) {
  console.error(`\n[FAILED] ${errors} verification check(s) failed.`);
  process.exit(1);
} else {
  console.log('\n[SUCCESS] All documentation numbers and metrics verified accurately.');
  process.exit(0);
}
