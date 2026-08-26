const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|cjs)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const fileMap = {
  // UI
  'src/admin/AdminApp.js': '01_UI/admin/AdminApp.js',
  'src/web/WebApp.js': '01_UI/web/WebApp.js',
  
  // BROWSER
  'src/main/browser/cdp-proxy-authenticator.js': '02_BROWSER/cdp-proxy-authenticator.js',
  'src/main/browser/detector.js': '02_BROWSER/detector.js',
  'src/main/browser/launcher.js': '02_BROWSER/launcher.js',
  'src/main/browser/process-manager.js': '02_BROWSER/process-manager.js',
  'src/main/browser/proxy-auth-extension.js': '02_BROWSER/proxy-auth-extension.js',
  'src/main/browser/proxy-tunnel.js': '02_BROWSER/proxy-tunnel.js',
  'src/main/services/profile-service.js': '02_BROWSER/services/profile-service.js',
  'src/main/services/proxy-service.js': '02_BROWSER/services/proxy-service.js',
  'src/main/services/proxy-test-service.js': '02_BROWSER/services/proxy-test-service.js',
  'src/main/services/cookie-service.js': '02_BROWSER/services/cookie-service.js',
  'src/main/services/history-service.js': '02_BROWSER/services/history-service.js',
  'src/main/services/extension-service.js': '02_BROWSER/services/extension-service.js',
  'src/main/services/archive-service.js': '02_BROWSER/services/archive-service.js',
  'src/main/services/profile-lock-service.js': '02_BROWSER/services/profile-lock-service.js',
  'src/main/services/folder-service.js': '02_BROWSER/services/folder-service.js',
  'src/main/services/workspace-service.js': '02_BROWSER/services/workspace-service.js',
  'src/main/services/universal-importer-service.js': '02_BROWSER/services/universal-importer-service.js',

  // HARDWARE
  'src/main/licensing/device-id.js': '03_HARDWARE/device-id.js',
  'src/main/services/mobile-rotator-service.js': '03_HARDWARE/mobile-rotator-service.js',
  'src/main/services/resource-monitor-service.js': '03_HARDWARE/resource-monitor-service.js',
  'src/main/services/diagnostics-service.js': '03_HARDWARE/diagnostics-service.js',
  'src/main/services/distribution-service.js': '03_HARDWARE/distribution-service.js',

  // LICENSING
  'src/main/licensing/license-engine.js': '04_LICENSING/license-engine.js',

  // AUTH
  'src/main/licensing/admin-auth.js': '05_AUTH/admin-auth.js',

  // DATABASE
  'src/main/database/connection.js': '06_DATABASE/connection.js',
  'src/main/database/schema.js': '06_DATABASE/schema.js',

  // BACKEND
  'src/main/index.js': '07_BACKEND/index.js',
  'src/main/ipc/register-handlers.js': '07_BACKEND/ipc/register-handlers.js',
  'src/main/api/local-api-server.js': '07_BACKEND/api/local-api-server.js',
  'src/server/app.js': '07_BACKEND/server/app.js',
  'src/server/web-admin-html.js': '07_BACKEND/server/web-admin-html.js',
  'src/server/super-admin-html.js': '07_BACKEND/server/super-admin-html.js',
  'src/server/download-portal-html.js': '07_BACKEND/server/download-portal-html.js',
  'src/main/services/api-v2-service.js': '07_BACKEND/services/api-v2-service.js',
  'src/main/services/fleet-service.js': '07_BACKEND/services/fleet-service.js',
  'src/main/services/feature-flag-service.js': '07_BACKEND/services/feature-flag-service.js',
  'src/main/services/audit-service.js': '07_BACKEND/services/audit-service.js',
  'src/main/services/stats-service.js': '07_BACKEND/services/stats-service.js',
  'src/main/services/settings-service.js': '07_BACKEND/services/settings-service.js',
  'src/main/services/updater-service.js': '07_BACKEND/services/updater-service.js',
  'src/main/services/vault-service.js': '07_BACKEND/services/vault-service.js',

  // SECURITY
  'src/main/security/encryption.js': '08_SECURITY/encryption.js',
  'src/main/security/sanitizer.js': '08_SECURITY/sanitizer.js',

  // AUTOMATION
  'src/main/automation/automation-engine.js': '09_AUTOMATION/automation-engine.js',
  'src/main/synchronizer/sync-hub.js': '09_AUTOMATION/sync-hub.js',
  'src/main/synchronizer/cdp-synchronizer.js': '09_AUTOMATION/cdp-synchronizer.js',
  'src/main/services/cookie-warmer-service.js': '09_AUTOMATION/cookie-warmer-service.js',
  'src/main/services/captcha-service.js': '09_AUTOMATION/captcha-service.js',
};

const oldToNewMap = {};
for (const [k, v] of Object.entries(fileMap)) {
  oldToNewMap[k] = v;
}

function resolveOldPath(currentFileOldPath, importPath) {
  const currentDir = path.posix.dirname(currentFileOldPath);
  return path.posix.normalize(path.posix.join(currentDir, importPath));
}

function findNewTargetPath(resolvedOld) {
  if (oldToNewMap[resolvedOld]) return oldToNewMap[resolvedOld];
  
  if (resolvedOld.startsWith('src/shared/')) {
    return resolvedOld.replace('src/shared/', '10_CONFIG/shared/');
  }
  if (resolvedOld.startsWith('src/preload/')) {
    return resolvedOld.replace('src/preload/', '10_CONFIG/preload/');
  }
  if (resolvedOld.startsWith('src/renderer/')) {
    return resolvedOld.replace('src/renderer/', '01_UI/');
  }
  return null;
}

const dirsToProcess = [
  '01_UI',
  '02_BROWSER',
  '03_HARDWARE',
  '04_LICENSING',
  '05_AUTH',
  '06_DATABASE',
  '07_BACKEND',
  '08_SECURITY',
  '09_AUTOMATION',
  '10_CONFIG',
  '11_TESTS'
];

let allFiles = [];
for (const d of dirsToProcess) {
  allFiles = allFiles.concat(getFiles(d));
}

const newToOldFileMap = {};
for (const [oldP, newP] of Object.entries(fileMap)) {
  newToOldFileMap[newP.replace(/\.js$/, '.ts')] = oldP.replace(/\.js$/, '.ts');
}

for (const f of allFiles) {
  const norm = f.replace(/\\/g, '/');
  if (!newToOldFileMap[norm]) {
    if (norm.startsWith('01_UI/')) {
      newToOldFileMap[norm] = norm.replace('01_UI/', 'src/renderer/');
    } else if (norm.startsWith('10_CONFIG/shared/')) {
      newToOldFileMap[norm] = norm.replace('10_CONFIG/shared/', 'src/shared/');
    } else if (norm.startsWith('10_CONFIG/preload/')) {
      newToOldFileMap[norm] = norm.replace('10_CONFIG/preload/', 'src/preload/');
    } else if (norm.startsWith('11_TESTS/')) {
      const baseName = path.posix.basename(norm);
      newToOldFileMap[norm] = 'tests/' + baseName;
    }
  }
}

let modifiedCount = 0;

for (const f of allFiles) {
  const normNew = f.replace(/\\/g, '/');
  const oldPath = newToOldFileMap[normNew];
  if (!oldPath) continue;

  let content = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Match import and export statements
  const newContent = content.replace(/(from\s+['])([\.\/][^']+)(['])/g, (match, prefix, importPath, suffix) => {
 const resolvedOld = resolveOldPath(oldPath, importPath);
 const newTarget = findNewTargetPath(resolvedOld);

 if (newTarget) {
 const currentNewDir = path.posix.dirname(normNew);
 let relativeNew = path.posix.relative(currentNewDir, newTarget);
 if (!relativeNew.startsWith('.')) {
 relativeNew = './' + relativeNew;
 }
 changed = true;
 return prefix + relativeNew + suffix;
 }

 return match;
 });

 if (changed) {
 fs.writeFileSync(f, newContent, 'utf8');
 modifiedCount++;
 }
}

console.log('Modified files with updated imports:', modifiedCount, 'of', allFiles.length);
