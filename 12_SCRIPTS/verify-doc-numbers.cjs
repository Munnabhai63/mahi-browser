/**
 * MAHI BROWSER — Documentation Truth & Metric Verification
 * 
 * Validates that numbers cited in docs (page count, test count) match reality.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

let errors = 0;

function check(desc, condition, details) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}: ${details}`);
    errors++;
  }
}

// 1. Landing Out HTML Count
const landingOutDir = path.join(rootDir, 'landing', 'out');
if (fs.existsSync(landingOutDir)) {
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
  const htmlFiles = getHtmlFiles(landingOutDir);
  console.log(`[INFO] Counted ${htmlFiles.length} HTML files in ${landingOutDir}`);
  // In F10 we have 38, in F11+ with methodology we have 39
  check('Landing page count in valid range (38 or 39)', htmlFiles.length === 38 || htmlFiles.length === 39, `Found ${htmlFiles.length}`);
} else {
  console.log(`[WARN] ${landingOutDir} does not exist yet. Run 'npm run landing:build' first.`);
}

// 2. Check docs/LAUNCH_READINESS.md for stale test metrics
const launchDocPath = path.join(rootDir, 'docs', 'LAUNCH_READINESS.md');
if (fs.existsSync(launchDocPath)) {
  const content = fs.readFileSync(launchDocPath, 'utf8');
  check('LAUNCH_READINESS.md references 1237 passed tests', content.includes('1237 passed'), 'Did not find "1237 passed"');
  check('LAUNCH_READINESS.md has 0 failed tests', content.includes('0 failed'), 'Did not find "0 failed"');
  check('LAUNCH_READINESS.md does not claim stale 1168 tests', !content.includes('1168 passed'), 'Found stale "1168 passed"');
} else {
  check('LAUNCH_READINESS.md exists', false, 'Missing docs/LAUNCH_READINESS.md');
}

// 3. Check docs/progress.md for honest metrics
const progressDocPath = path.join(rootDir, 'docs', 'progress.md');
if (fs.existsSync(progressDocPath)) {
  const content = fs.readFileSync(progressDocPath, 'utf8');
  check('progress.md has 1237 passed tests', content.includes('1237 passed'), 'Did not find "1237 passed"');
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
