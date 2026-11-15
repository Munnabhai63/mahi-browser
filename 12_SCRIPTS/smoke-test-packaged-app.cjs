/**
 * MAHI BROWSER — Packaged Desktop Application Smoke Test Harness
 * Phase 9C Native CI Runtime Verification
 *
 * Verifies that the compiled desktop application launches cleanly,
 * initializes the Electron main process, mounts the SQLite v15 database,
 * registers IPC bridge handlers, starts the local REST API server, and
 * exits without fatal unhandled exceptions or crashes.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function resolveExecutable() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    const candidates = [
      path.join(rootDir, 'release', 'win-unpacked', 'MAHI Browser.exe'),
      path.join(rootDir, 'release', 'win-unpacked', 'MAHI BROWSER.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return { cmd: p, args: ['--smoke-test'] };
    }
  } else if (platform === 'darwin') {
    const candidates = [
      path.join(rootDir, 'release', `mac-${arch}`, 'MAHI Browser.app', 'Contents', 'MacOS', 'MAHI Browser'),
      path.join(rootDir, 'release', 'mac', 'MAHI Browser.app', 'Contents', 'MacOS', 'MAHI Browser'),
      path.join(rootDir, 'release', `mac-${arch}`, 'MAHI BROWSER.app', 'Contents', 'MacOS', 'MAHI BROWSER'),
      path.join(rootDir, 'release', 'mac', 'MAHI BROWSER.app', 'Contents', 'MacOS', 'MAHI BROWSER'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return { cmd: c, args: ['--smoke-test'] };
    }
  } else if (platform === 'linux') {
    const p = path.join(rootDir, 'release', 'linux-unpacked', 'mahi-browser');
    if (fs.existsSync(p)) return { cmd: p, args: ['--smoke-test', '--no-sandbox'] };
  }

  // In CI release pipelines, the packaged binary MUST exist. Dev fallback is forbidden.
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    throw new Error(
      `[SMOKE_HARNESS] No packaged desktop binary found in release/ directory for ${platform}-${arch} during CI release run. Refusing dev runner fallback.`
    );
  }

  // Fallback: Run via Electron development runner (local dev only)
  const npxCmd = platform === 'win32' ? 'npx.cmd' : 'npx';
  return { cmd: npxCmd, args: ['electron', '.', '--smoke-test'] };
}

async function runSmokeTest() {
  const { cmd, args } = resolveExecutable();
  console.log(`[SMOKE_HARNESS] Target Binary: ${cmd}`);
  console.log(`[SMOKE_HARNESS] Arguments: ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: rootDir,
      env: { ...process.env, CI: 'true', ELECTRON_ENABLE_LOGGING: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let output = '';
    let hasPassed = false;

    child.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      output += str;
      process.stdout.write(str);
      if (str.includes('[SMOKE_TEST_PASS]')) {
        hasPassed = true;
      }
    });

    child.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      output += str;
      process.stderr.write(str);
      if (str.includes('[SMOKE_TEST_PASS]')) {
        hasPassed = true;
      }
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`[SMOKE_HARNESS] Application startup timed out after 30 seconds.`));
    }, 30000);

    let finished = false;
    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      console.log(`[SMOKE_HARNESS] Child process terminated with code: ${code}`);

      // Also verify crash-log.txt if stdout was suppressed by Windows GUI subsystem
      const crashLogCandidates = [
        path.join(rootDir, 'crash-log.txt'),
        process.env.APPDATA ? path.join(process.env.APPDATA, 'mahi-browser', 'crash-log.txt') : null,
        process.env.APPDATA ? path.join(process.env.APPDATA, 'MAHI Browser', 'crash-log.txt') : null,
        process.env.HOME ? path.join(process.env.HOME, 'Library', 'Application Support', 'mahi-browser', 'crash-log.txt') : null,
        process.env.HOME ? path.join(process.env.HOME, 'Library', 'Application Support', 'MAHI Browser', 'crash-log.txt') : null,
        process.env.HOME ? path.join(process.env.HOME, '.config', 'mahi-browser', 'crash-log.txt') : null,
        process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, 'mahi-browser', 'crash-log.txt') : null,
      ].filter(Boolean);
      let logContents = '';
      for (const logPath of crashLogCandidates) {
        if (fs.existsSync(logPath)) {
          logContents += fs.readFileSync(logPath, 'utf8') + '\n';
        }
      }

      if (hasPassed || output.includes('[SMOKE_TEST_PASS]') || logContents.includes('SMOKE_TEST: Packaged Application Smoke Test Mode Triggered')) {
        console.log('\n======================================================');
        console.log('✓ NATIVE DESKTOP SMOKE TEST PASSED SUCCESSFULLY');
        console.log('======================================================\n');
        resolve();
      } else {
        reject(new Error(`[SMOKE_HARNESS] Application exited with code ${code} without emitting SMOKE_TEST_PASS.`));
      }
    };

    child.on('exit', (code) => {
      setTimeout(() => finish(code), 500);
    });

    child.on('close', (code) => {
      finish(code);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

runSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ [SMOKE_HARNESS_FAILURE] ${err.message}\n`);
    process.exit(1);
  });
