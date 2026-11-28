import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { app, shell } from '../08_SECURITY/electron-bridge.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('distribution-service');

export interface DistributionInfo {
  localIps: string[];
  port: number;
  downloadUrl: string;
  networkDownloadUrls: string[];
  setupAvailable: boolean;
  portableAvailable: boolean;
  setupFileName: string;
  portableFileName: string;
  setupPath: string;
  portablePath: string;
  setupSizeMB: number;
  portableSizeMB: number;
  version: string;
}

export function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const ifaceName of Object.keys(interfaces)) {
    const addresses = interfaces[ifaceName];
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }

  if (ips.length === 0) {
    ips.push('127.0.0.1');
  }

  return ips;
}

export function getReleaseDirectory(): string {
  if (process.env.RELEASE_DIR && fs.existsSync(process.env.RELEASE_DIR)) {
    return process.env.RELEASE_DIR;
  }
  const cwd = process.cwd();
  const relDir = path.join(cwd, 'release');
  if (fs.existsSync(relDir)) {
    return relDir;
  }
  const appDir = (app && app.isPackaged) ? path.dirname(process.execPath) : cwd;
  const relInApp = path.join(appDir, 'release');
  if (fs.existsSync(relInApp)) {
    return relInApp;
  }
  const candidateDirs = [
    path.join(appDir, 'resources', 'release'),
    '/var/www/mahibrowser.com/releases',
    '/var/www/mahibrowser/releases',
    '/var/www/mahibrowser/release',
  ];
  for (const cand of candidateDirs) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return relDir;
}

export function getDistributionInfo(): DistributionInfo {
  const localIps = getLocalIpAddresses();
  const port = 32123;
  const downloadUrl = `http://127.0.0.1:${port}/download`;
  const networkDownloadUrls = localIps.map((ip) => `http://${ip}:${port}/download`);
  const releaseDir = getReleaseDirectory();

  let version = (app && typeof app.getVersion === 'function' ? app.getVersion() : null) || '1.1.7';
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) version = pkg.version;
    }
  } catch (err) {
    log.debug('distribution-service package.json version read failed', { err });
  }

  let setupFileName = `MAHI-Browser-Setup-${version}.exe`;
  let portableFileName = `MAHI-Browser-Portable-${version}.exe`;
  let setupPath = path.join(releaseDir, setupFileName);
  let portablePath = path.join(releaseDir, portableFileName);

  // If exact versioned file is not yet at target name, check for existing setup in releaseDir
  if (!fs.existsSync(setupPath) && fs.existsSync(releaseDir)) {
    const setupCandidate = fs.readdirSync(releaseDir).find((f) => f.includes('Setup') && f.endsWith('.exe'));
    if (setupCandidate) {
      setupFileName = setupCandidate;
      setupPath = path.join(releaseDir, setupCandidate);
    }
  }

  if (!fs.existsSync(portablePath) && fs.existsSync(releaseDir)) {
    const portableCandidate = fs.readdirSync(releaseDir).find((f) => f.includes('Portable') && f.endsWith('.exe'));
    if (portableCandidate) {
      portableFileName = portableCandidate;
      portablePath = path.join(releaseDir, portableCandidate);
    }
  }

  // Check desktop as fallback if in development
  const desktopDir = path.join(os.homedir(), 'Desktop');
  if (!fs.existsSync(setupPath)) {
    const desktopSetup = path.join(desktopDir, setupFileName);
    if (fs.existsSync(desktopSetup)) {
      setupPath = desktopSetup;
    }
  }

  if (!fs.existsSync(portablePath)) {
    const desktopPortable = path.join(desktopDir, portableFileName);
    if (fs.existsSync(desktopPortable)) {
      portablePath = desktopPortable;
    }
  }

  let setupSizeMB = 0;
  let portableSizeMB = 0;

  const setupAvailable = fs.existsSync(setupPath);
  if (setupAvailable) {
    try {
      const stats = fs.statSync(setupPath);
      setupSizeMB = Math.round((stats.size / (1024 * 1024)) * 10) / 10;
    } catch (err) {
      log.debug('distribution-service setup installer stat failed', { setupPath, err });
    }
  }

  const portableAvailable = fs.existsSync(portablePath);
  if (portableAvailable) {
    try {
      const stats = fs.statSync(portablePath);
      portableSizeMB = Math.round((stats.size / (1024 * 1024)) * 10) / 10;
    } catch (err) {
      log.debug('distribution-service portable binary stat failed', { portablePath, err });
    }
  }

  return {
    localIps,
    port,
    downloadUrl,
    networkDownloadUrls,
    setupAvailable,
    portableAvailable,
    setupFileName,
    portableFileName,
    setupPath,
    portablePath,
    setupSizeMB,
    portableSizeMB,
    version,
  };
}

export async function openDistributionFolder(): Promise<boolean> {
  const releaseDir = getReleaseDirectory();
  if (fs.existsSync(releaseDir)) {
    await shell.openPath(releaseDir);
    return true;
  }
  const desktopDir = path.join(os.homedir(), 'Desktop');
  await shell.openPath(desktopDir);
  return true;
}

function psB64(value: string): string {
  return `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${Buffer.from(value, 'utf8').toString('base64')}'))`;
}

export async function fixDesktopShortcuts(): Promise<{ success: boolean; message: string; shortcuts: string[] }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({
        success: false,
        message: 'Desktop shortcuts are only supported on Windows operating systems.',
        shortcuts: [],
      });
    }

    const cwd = process.cwd();
    const desktopDir = path.join(os.homedir(), 'Desktop');
    const iconPath = path.join(cwd, '13_ASSETS', 'resources', 'icon.ico');

    // Prefer native unpacked exe if available, fallback to start-app.bat
    const unpackedExe = path.join(cwd, 'release', 'win-unpacked', 'MAHI Browser.exe');
    const legacyUnpackedExe = path.join(cwd, 'release', 'win-unpacked', 'MAHI BROWSER.exe');
    const appExe = fs.existsSync(unpackedExe)
      ? unpackedExe
      : (fs.existsSync(legacyUnpackedExe) ? legacyUnpackedExe : path.join(cwd, '12_SCRIPTS', 'start-app.bat'));

    const superAdminBat = path.join(cwd, '12_SCRIPTS', 'Start-Super-Admin.bat');
    const webAdminBat = path.join(cwd, '12_SCRIPTS', 'Start-Web-Admin.bat');

    const psScript = `
$desktop = [System.Environment]::GetFolderPath('Desktop')
$WshShell = New-Object -ComObject WScript.Shell
$created = @()
$appExe = ${psB64(appExe)}
$cwdPath = ${psB64(cwd)}
$iconFile = ${psB64(iconPath)}
$superBat = ${psB64(superAdminBat)}
$webBat = ${psB64(webAdminBat)}

# 1. Main App Shortcut
$appLnk = Join-Path $desktop "MAHI BROWSER.lnk"
$s1 = $WshShell.CreateShortcut($appLnk)
$s1.TargetPath = $appExe
$s1.WorkingDirectory = $cwdPath
$s1.Description = "MAHI BROWSER - Multi-Profile Browser & Automation Engine"
if (Test-Path -LiteralPath $iconFile) {
  $s1.IconLocation = "$iconFile,0"
}
$s1.Save()
$created += "MAHI BROWSER.lnk"

# 2. Super Admin Shortcut
$superLnk = Join-Path $desktop "MAHI Super Admin Console.lnk"
$s2 = $WshShell.CreateShortcut($superLnk)
if (Test-Path -LiteralPath $superBat) {
  $s2.TargetPath = $superBat
} else {
  $s2.TargetPath = "http://127.0.0.1:32123/super-admin"
}
$s2.WorkingDirectory = $cwdPath
$s2.Description = "MAHI BROWSER Secret Super Admin Console"
if (Test-Path -LiteralPath $iconFile) {
  $s2.IconLocation = "$iconFile,0"
}
$s2.Save()
$created += "MAHI Super Admin Console.lnk"

# 3. Web Admin Shortcut
$webLnk = Join-Path $desktop "MAHI Web Admin.lnk"
$s3 = $WshShell.CreateShortcut($webLnk)
if (Test-Path -LiteralPath $webBat) {
  $s3.TargetPath = $webBat
} else {
  $s3.TargetPath = "http://127.0.0.1:32123/admin"
}
$s3.WorkingDirectory = $cwdPath
$s3.Description = "MAHI BROWSER Enterprise Web Admin Control Center"
if (Test-Path -LiteralPath $iconFile) {
  $s3.IconLocation = "$iconFile,0"
}
$s3.Save()
$created += "MAHI Web Admin.lnk"

Write-Output ($created -join ",")
`;

    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand], (error, stdout) => {
      if (error) {
        return resolve({
          success: false,
          message: `Failed to create shortcuts: ${error.message}`,
          shortcuts: [],
        });
      }
      const shortcuts = stdout.trim().split(',').map((s) => s.trim()).filter(Boolean);
      resolve({
        success: true,
        message: 'Successfully updated and refreshed all desktop shortcuts with custom icons!',
        shortcuts: shortcuts.length > 0 ? shortcuts : ['MAHI BROWSER.lnk', 'MAHI Super Admin Console.lnk', 'MAHI Web Admin.lnk'],
      });
    });
  });
}

export async function createProfileShortcut(profileId: string, profileName: string): Promise<{ success: boolean; path: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      import('../02_BROWSER/services/platform-adapter.js')
        .then(({ platformAdapter }) => {
          const appExe = process.execPath;
          const iconPath = path.join(process.cwd(), '13_ASSETS', 'resources', 'icon.png');
          return platformAdapter.createShortcut(profileId, profileName, appExe, iconPath);
        })
        .then((res) => resolve({ success: res.success, path: res.shortcutPath }))
        .catch(() => resolve({ success: false, path: '' }));
      return;
    }

    const cwd = process.cwd();
    const desktopDir = path.join(os.homedir(), 'Desktop');
    const safeName = profileName.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Profile';
    const shortcutPath = path.join(desktopDir, `MAHI - ${safeName}.lnk`);
    const iconPath = path.join(cwd, '13_ASSETS', 'resources', 'icon.ico');

    const unpackedExe = path.join(cwd, 'release', 'win-unpacked', 'MAHI Browser.exe');
    const legacyUnpackedExe = path.join(cwd, 'release', 'win-unpacked', 'MAHI BROWSER.exe');
    const appExe = fs.existsSync(unpackedExe)
      ? unpackedExe
      : (fs.existsSync(legacyUnpackedExe) ? legacyUnpackedExe : path.join(cwd, '12_SCRIPTS', 'start-app.bat'));

    const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$lnkPath = ${psB64(shortcutPath)}
$appExe = ${psB64(appExe)}
$profileArg = ${psB64(`--profile-id=${profileId}`)}
$cwdPath = ${psB64(cwd)}
$desc = ${psB64(`Launch MAHI Profile: ${safeName}`)}
$iconFile = ${psB64(iconPath)}
$s = $WshShell.CreateShortcut($lnkPath)
$s.TargetPath = $appExe
$s.Arguments = $profileArg
$s.WorkingDirectory = $cwdPath
$s.Description = $desc
if (Test-Path -LiteralPath $iconFile) {
  $s.IconLocation = "$iconFile,0"
}
$s.Save()
Write-Output "OK"
`;

    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand], (error) => {
      if (error) {
        return resolve({ success: false, path: '' });
      }
      resolve({ success: true, path: shortcutPath });
    });
  });
}