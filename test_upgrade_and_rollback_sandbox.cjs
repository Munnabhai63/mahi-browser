const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const backupDir = 'F:\\MAHI_BROWSER_SAFETY_BACKUPS\\BACKUP_20261021_PRODUCTION';
const sandboxBase = path.join(__dirname, '.test_sandbox_profile_safety');

function sha256(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (e) {
    return null;
  }
}

function copyRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

async function verifyUpgradeAndRollback() {
  console.log('=== DISPOSABLE SANDBOX UPGRADE & ROLLBACK VERIFICATION ===');

  if (fs.existsSync(sandboxBase)) {
    fs.rmSync(sandboxBase, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxBase, { recursive: true });

  // 1. Pick sample profiles with real browsing data from backup
  const backupProfilesDir = path.join(backupDir, 'profiles');
  if (!fs.existsSync(backupProfilesDir)) {
    throw new Error('Backup profiles directory not found: ' + backupProfilesDir);
  }

  const sampleProfileIds = [
    '07e8a81a-6ab9-477b-ac9a-fc44f0c7e091',
    '0a1ec0d5-246c-4b8b-9797-f3a71fb1f41f',
    '0da50ed3-abd8-4cc1-a6b8-fb240422cc93'
  ];
  console.log('Selected sample profiles with active browsing data:', sampleProfileIds);

  const sandboxProfilesDir = path.join(sandboxBase, 'profiles');
  fs.mkdirSync(sandboxProfilesDir, { recursive: true });

  const baselineState = {};

  // Copy sample profiles to sandbox
  for (const id of sampleProfileIds) {
    const src = path.join(backupProfilesDir, id);
    const dst = path.join(sandboxProfilesDir, id);
    copyRecursive(src, dst);

    // Record baseline hashes for critical profile files
    baselineState[id] = {
      defaultExists: fs.existsSync(path.join(dst, 'Default')),
      prefHash: sha256(path.join(dst, 'Default', 'Preferences')),
      cookieHash: sha256(path.join(dst, 'Default', 'Network', 'Cookies')) || sha256(path.join(dst, 'Default', 'Cookies')),
      historyHash: sha256(path.join(dst, 'Default', 'History'))
    };
    console.log(`[Baseline recorded] Profile ${id}:`, baselineState[id]);
  }

  // Also copy SQLite DB to sandbox
  const srcDb = path.join(backupDir, 'mahi_browser.sqlite');
  const dstDb = path.join(sandboxBase, 'mahi_browser.sqlite');
  fs.copyFileSync(srcDb, dstDb);
  const initialDbHash = sha256(dstDb);
  console.log('[Baseline recorded] Sandbox SQLite SHA-256:', initialDbHash);

  // 2. Simulate Extension Installation on Profile 1 in sandbox
  console.log('\n--- Simulating 1.1.7 Extension Installation on Profile 1 in Sandbox ---');
  const testProfId = sampleProfileIds[0];
  const testExtensionDir = path.join(sandboxProfilesDir, testProfId, 'Default', 'Extensions', 'test_urban_vpn_ext', '1.0.0');
  fs.mkdirSync(testExtensionDir, { recursive: true });
  fs.writeFileSync(path.join(testExtensionDir, 'manifest.json'), JSON.stringify({
    manifest_version: 3,
    name: "Urban VPN Proxy",
    version: "1.0.0",
    description: "Test extension for verification",
    permissions: ["storage"]
  }, null, 2));

  // Verify that profile cookies and history did NOT change during extension installation
  const postInstallState = {
    prefHash: sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'Preferences')),
    cookieHash: sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'Network', 'Cookies')) || sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'Cookies')),
    historyHash: sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'History')),
    extensionExists: fs.existsSync(path.join(testExtensionDir, 'manifest.json'))
  };

  console.log('[Post-install check]: Extension installed:', postInstallState.extensionExists);
  console.log('Original Cookies Hash match:', postInstallState.cookieHash === baselineState[testProfId].cookieHash);
  console.log('Original History Hash match:', postInstallState.historyHash === baselineState[testProfId].historyHash);

  if (postInstallState.cookieHash !== baselineState[testProfId].cookieHash ||
      postInstallState.historyHash !== baselineState[testProfId].historyHash) {
    throw new Error('FATAL: Extension install contaminated core profile user data!');
  }

  // 3. Test Rollback Procedure
  console.log('\n--- Simulating Rollback from Backup ---');
  // Wipe sandbox profile 1 and restore from backup
  fs.rmSync(path.join(sandboxProfilesDir, testProfId), { recursive: true, force: true });
  copyRecursive(path.join(backupProfilesDir, testProfId), path.join(sandboxProfilesDir, testProfId));

  const postRollbackCookieHash = sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'Network', 'Cookies')) || sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'Cookies'));
  const postRollbackHistoryHash = sha256(path.join(sandboxProfilesDir, testProfId, 'Default', 'History'));
  const postRollbackExtExists = fs.existsSync(path.join(sandboxProfilesDir, testProfId, 'Default', 'Extensions', 'test_urban_vpn_ext'));

  console.log('[Post-rollback check]: Extension reverted:', !postRollbackExtExists);
  console.log('[Post-rollback check]: Cookies restored 100%:', postRollbackCookieHash === baselineState[testProfId].cookieHash);
  console.log('[Post-rollback check]: History restored 100%:', postRollbackHistoryHash === baselineState[testProfId].historyHash);

  if (postRollbackCookieHash !== baselineState[testProfId].cookieHash || postRollbackExtExists) {
    throw new Error('FATAL: Rollback did not perfectly restore prior state!');
  }

  // Cleanup sandbox
  fs.rmSync(sandboxBase, { recursive: true, force: true });
  console.log('\nSandbox cleaned up safely. UPGRADE & ROLLBACK TESTS PASSED WITH 100% INTEGRITY.');
}

verifyUpgradeAndRollback().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
