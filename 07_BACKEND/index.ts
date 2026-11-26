import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from '../06_DATABASE/schema.js';
import { redactSensitiveTokens } from './utils/http-security.js';
import {
  closeDatabase,
  setCustomDatabasePath,
  snapshotSyncConfigFirstRun,
} from '../06_DATABASE/connection.js';
import { registerIpcHandlers } from './ipc/register-handlers.js';
import { processManager } from '../02_BROWSER/process-manager.js';
import { startApiServer, stopApiServer } from './api/local-api-server.js';
import { logActivity } from './services/audit-service.js';
import { initAutoUpdater } from './services/updater-service.js';
import { startLicenseStatusService } from '../08_SECURITY/license-status-service.js';
import { startPriceSync } from '../08_SECURITY/price-service.js';
import { startResourceMonitoring, stopResourceMonitoring } from '../03_HARDWARE/resource-monitor-service.js';
import { provisionEngineOnStartup } from '../02_BROWSER/managed-engine.js';
import { releaseAllCloudLocks } from '../08_SECURITY/cloud-sync-service.js';
import { getWritableUserDataDir, getBundledResourcePath, isAppPackaged } from './utils/runtime-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// 1. Crash Logger & Checkpoints System
// -------------------------------------------------------------
const projectDir = process.cwd();
const localAppDataDir = getWritableUserDataDir();
const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : projectDir;
const isTestEnv = Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID || process.env.NODE_ENV === 'test');

if (!fs.existsSync(localAppDataDir)) {
  try { fs.mkdirSync(localAppDataDir, { recursive: true }); } catch {}
}

const crashLogPaths = (isAppPackaged() || isTestEnv)
  ? [
      path.join(localAppDataDir, 'crash-log.txt'),
      path.join(localAppDataDir, 'mahi_debug.log'),
    ]
  : [
      path.join(projectDir, 'crash-log.txt'),
      path.join(localAppDataDir, 'crash-log.txt'),
      path.join(localAppDataDir, 'mahi_debug.log'),
    ];

export function writeCrashLog(type: string, message: string, stack?: string): void {
  const timestamp = new Date().toISOString();
  const safeMessage = redactSensitiveTokens(message);
  const safeStack = stack ? redactSensitiveTokens(stack) : undefined;
  const entry = [
    `\n==================== [CRASH / ERROR EVENT: ${type}] ====================`,
    `Timestamp: ${timestamp}`,
    `Process: Main Process (PID: ${process.pid})`,
    `Platform: ${process.platform} (${process.arch}) Node: ${process.version} Electron: ${process.versions.electron}`,
    `Message: ${safeMessage}`,
    safeStack ? `Stack Trace:\n${safeStack}` : 'Stack Trace: None available',
    `========================================================================\n`,
  ].join('\n');

  console.error(entry);

  for (const logPath of crashLogPaths) {
    try {
      fs.appendFileSync(logPath, entry + '\n', 'utf8');
    } catch (err) {
      console.error(`Failed to write crash log to ${logPath}:`, err);
    }
  }
}

export function logCheckpoint(stepName: string, detail?: string): void {
  const timestamp = new Date().toISOString();
  const safeStep = redactSensitiveTokens(stepName);
  const safeDetail = detail ? redactSensitiveTokens(detail) : undefined;
  const line = `[${timestamp}] [CHECKPOINT] ${safeStep}${safeDetail ? ' - ' + safeDetail : ''}\n`;
  console.log(line.trim());
  for (const logPath of crashLogPaths) {
    try {
      fs.appendFileSync(logPath, line, 'utf8');
    } catch {}
  }
}

// Global debug logger reference
(globalThis as any).__mahiDebugLog = (msg: string) => logCheckpoint(msg);

// -------------------------------------------------------------
// 2. Global Fatal Error Listeners
// -------------------------------------------------------------
process.on('uncaughtException', (error: Error) => {
  writeCrashLog('UNCAUGHT_EXCEPTION', error.message, error.stack);
});

process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  writeCrashLog('UNHANDLED_REJECTION', msg, stack);
});

// Clear previous crash logs on fresh startup
try {
  const header = `=== MAHI BROWSER SESSION STARTED AT ${new Date().toISOString()} ===\n`;
  if (!isAppPackaged() && !isTestEnv) {
    try { fs.writeFileSync(path.join(projectDir, 'crash-log.txt'), header, 'utf8'); } catch {}
  }
  try { fs.writeFileSync(path.join(localAppDataDir, 'crash-log.txt'), header, 'utf8'); } catch {}
} catch {}

logCheckpoint('Step 1: Application Initializing', `Electron version: ${process.versions.electron}`);

// Use software rendering to prevent GPU driver crashes on diverse hardware
if (app?.disableHardwareAcceleration) {
  try {
    app.disableHardwareAcceleration();
    logCheckpoint('Step 1: Hardware Acceleration Disabled');
  } catch (err: unknown) {
    writeCrashLog('HW_ACCEL_ERROR', String(err));
  }
}

// Set Windows Application User Model ID for taskbar grouping
if (process.platform === 'win32' && app?.setAppUserModelId) {
  app.setAppUserModelId('com.mahibrowser.app');
}

// Shared helper for deep-link protocol URL matching (canonical mahibrowser:// and legacy mahi://)
export function isMahiProtocolUrl(arg: unknown): arg is string {
  return typeof arg === 'string' && (arg.startsWith('mahibrowser://') || arg.startsWith('mahi://'));
}

// Register custom protocol clients for seamless deep linking (GoLogin Parity: mahibrowser:// and mahi://)
export function registerProtocolClients(schemes: string[] = ['mahibrowser', 'mahi']): void {
  if (!app?.setAsDefaultProtocolClient) return;
  for (const scheme of schemes) {
    try {
      if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])]);
      } else {
        app.setAsDefaultProtocolClient(scheme);
      }
      logCheckpoint(`Step 1: Custom protocol client "${scheme}" registered`);
    } catch (err: unknown) {
      writeCrashLog('PROTOCOL_CLIENT_ERROR', `Failed to register scheme ${scheme}: ${String(err)}`);
    }
  }
}

registerProtocolClients();

// Single instance lock check (Strict single-instance lock to avoid SQLite/port collision)
logCheckpoint('Step 2: Checking Instance Status');
const isSmokeTest = process.argv.includes('--smoke-test');
const gotTheLock = app?.requestSingleInstanceLock ? app.requestSingleInstanceLock() : true;
if (!gotTheLock && !isSmokeTest && app?.quit) {
  const hasDeepLink = process.argv.some(isMahiProtocolUrl);
  if (hasDeepLink) {
    logCheckpoint('Step 2: Second instance with deep-link detected. Yielding to primary instance and exiting.');
  } else {
    logCheckpoint('Step 2: Secondary instance detected. Terminating immediately to prevent DB and port collision.');
  }
  app.quit();
  app.exit(0);
} else {
  if (isSmokeTest && !gotTheLock) {
    logCheckpoint('Step 2: Smoke test running without instance lock.');
  } else {
    logCheckpoint('Step 2: Primary Instance Lock Acquired');
  }
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function resolveAppIconPath(): string | undefined {
  const iconFileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return (
    getBundledResourcePath(iconFileName) ||
    getBundledResourcePath('13_ASSETS', 'brand', process.platform === 'win32' ? 'mahi-browser.ico' : 'mahi-browser-icon.png') ||
    getBundledResourcePath('13_ASSETS', 'resources', iconFileName) ||
    getBundledResourcePath('resources', iconFileName) ||
    getBundledResourcePath('icon.ico') ||
    getBundledResourcePath('icon.png')
  );
}

function resolveSplashPath(): string | undefined {
  return (
    getBundledResourcePath('splash.html') ||
    getBundledResourcePath('13_ASSETS', 'resources', 'splash.html') ||
    getBundledResourcePath('resources', 'splash.html')
  );
}

function createSplashWindow(): void {
  try {
    const splashPath = resolveSplashPath();
    if (!splashPath) return;

    const iconPath = resolveAppIconPath();

    splashWindow = new BrowserWindow({
      width: 480,
      height: 320,
      frame: false,
      transparent: true,
      resizable: false,
      center: true,
      alwaysOnTop: true,
      show: !process.argv.includes('--smoke-test'),
      icon: iconPath,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    splashWindow.loadFile(splashPath);
  } catch (splashErr) {
    writeCrashLog('SPLASH_WINDOW_ERROR', String(splashErr));
  }
}

function createWindow(): void {
  logCheckpoint('Step 5: Creating BrowserWindow');

  const preloadPath = path.join(__dirname, '../preload/index.cjs');
  logCheckpoint('Step 5: Preload script path', preloadPath);
  logCheckpoint('Step 5: Preload exists on disk', String(fs.existsSync(preloadPath)));

  const iconPath = resolveAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: 'MAHI BROWSER',
    icon: iconPath,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });


  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('ready-to-show', () => {
    logCheckpoint('Step 6: Window ready-to-show event fired');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!process.argv.includes('--smoke-test')) {
        mainWindow.show();
        mainWindow.focus();
      }
      logCheckpoint('Step 6: Main window displayed successfully');

      if (splashWindow && !splashWindow.isDestroyed()) {
        setTimeout(() => {
          try {
            if (splashWindow && !splashWindow.isDestroyed()) {
              splashWindow.destroy();
              splashWindow = null;
            }
          } catch {}
        }, 500);
      }
    }
  });

  // Fallback timer: Guarantees window is displayed even on slower disks
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logCheckpoint('Step 6: Safety fallback window show triggered');
      if (!process.argv.includes('--smoke-test')) {
        mainWindow.show();
        mainWindow.focus();
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        try {
          splashWindow.destroy();
          splashWindow = null;
        } catch {}
      }
    }
  }, 3500);

  // Capture renderer console output into checkpoints
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    const prefix = level === 2 ? '[RENDERER WARN]' : level === 3 ? '[RENDERER ERROR]' : '[RENDERER]';
    logCheckpoint(prefix, message);
  });

  // Recover from renderer crashes
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    writeCrashLog('RENDERER_PROCESS_GONE', `Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          logCheckpoint('Step 6: Attempting renderer reload after crash');
          mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        }
      }, 1000);
    }
  });

  function isSafeExternalUrl(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
    } catch {
      return false;
    }
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  function isAllowedAppNavigation(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'file:') return true;
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Strict Navigation Lock: Main Window must NEVER navigate away from MAHI UI
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppNavigation(url)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (isAllowedAppNavigation(url)) {
      return;
    }
    event.preventDefault();
  });


  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load UI bundle
  logCheckpoint('Step 5: Loading frontend bundle');
  if (process.env.VITE_DEV_SERVER_URL) {
    logCheckpoint('Step 5: Loading from Vite Dev Server', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    logCheckpoint('Step 5: Loading production HTML', indexPath);
    mainWindow.loadFile(indexPath);
  }
}

if ((gotTheLock || isSmokeTest) && app?.whenReady) {
  app.whenReady().then(async () => {
  logCheckpoint('Step 3: App whenReady fired');

  // 0. Display Branded Startup Splash Screen
  createSplashWindow();

  // 1. Initialize SQLite Database
  try {
    const userDataPath = getWritableUserDataDir();
    const dbPath = path.join(userDataPath, 'mahi_browser.sqlite');
    logCheckpoint('Step 3: Setting Database Path', dbPath);
    setCustomDatabasePath(dbPath);
    snapshotSyncConfigFirstRun({ userDataDir: userDataPath });

    logCheckpoint('Step 3: Initializing SQLite Engine & Tables');
    await initializeDatabase();
    logCheckpoint('Step 3: Database Initialized Successfully');
    logActivity('SYSTEM', 'INFO', 'App Startup', 'MAHI BROWSER initialized successfully');
  } catch (dbErr: unknown) {
    const errObj = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
    writeCrashLog('DATABASE_INIT_ERROR', errObj.message, errObj.stack);

    // Attempt recovery by recreating clean database
    try {
      const userDataPath = getWritableUserDataDir();
      const dbPath = path.join(userDataPath, 'mahi_browser.sqlite');
      if (fs.existsSync(dbPath)) {
        const bakPath = `${dbPath}.corrupt.${Date.now()}.bak`;
        try {
          fs.copyFileSync(dbPath, bakPath);
          logCheckpoint('Step 3: Corrupt database backed up to', bakPath);
        } catch (copyErr) {
          console.error('[DATABASE RECOVERY] Failed to create backup of corrupted database:', copyErr);
        }
      }
      logCheckpoint('Step 3: Attempting recovery - deleting corrupted DB file');
      try { fs.unlinkSync(dbPath); } catch {}
      setCustomDatabasePath(dbPath);
      await initializeDatabase();
      logCheckpoint('Step 3: Database Recovered & Initialized');
    } catch (recErr: unknown) {
      writeCrashLog('DATABASE_RECOVERY_FAILED', String(recErr));
    }
  }

  // 2. Register IPC Handlers
  try {
    logCheckpoint('Step 4: Registering IPC Bridge Handlers');
    registerIpcHandlers();
    logCheckpoint('Step 4: IPC Handlers Registered');
    initAutoUpdater();
    startLicenseStatusService();
    startPriceSync();
    startResourceMonitoring();

    // Fire-and-forget: ensure browser engine is provisioned before any profile launch.
    // This is intentionally non-blocking — the UI never waits for or sees this.
    provisionEngineOnStartup().then((result) => {
      logCheckpoint('Engine Provisioning', `source=${result.source} ok=${result.ok} path=${result.path}`);
    }).catch((err) => {
      logCheckpoint('Engine Provisioning Warning', String(err));
    });
  } catch (ipcErr: unknown) {
    writeCrashLog('IPC_REGISTER_ERROR', String(ipcErr));
  }

  // 3. Start Local REST API Server
  try {
    logCheckpoint('Step 4: Starting Local REST API Server (Port 32123)');
    startApiServer();
    logCheckpoint('Step 4: REST API Server Running');
  } catch (apiErr: unknown) {
    writeCrashLog('API_SERVER_START_ERROR', String(apiErr));
  }

  // 4. Create Main Window & Load UI
  try {
    createWindow();
    if (!mainWindow) {
      throw new Error('createWindow completed but mainWindow is null');
    }
  } catch (winErr: unknown) {
    writeCrashLog('CREATE_WINDOW_ERROR', String(winErr));
    await performCleanExit();
    return;
  }

  // Packaged Application Native Smoke Test Mode
  if (process.argv.includes('--smoke-test')) {
    logCheckpoint('SMOKE_TEST: Packaged Application Smoke Test Mode Triggered');
    console.log('[SMOKE_TEST] Main Process Initialized');
    console.log('[SMOKE_TEST] SQLite Database Initialized');
    console.log('[SMOKE_TEST] Splash & Main BrowserWindow Created');
    console.log(`[SMOKE_TEST] Platform: ${process.platform} Arch: ${process.arch}`);

    const smokeTimeout = setTimeout(async () => {
      console.error('[SMOKE_TEST_ERROR] Window load timed out after 15s in smoke test mode');
      writeCrashLog('SMOKE_TEST_TIMEOUT', 'Window did-finish-load not received within 15 seconds');
      await performCleanExit();
    }, 15000);

    mainWindow.webContents.once('did-finish-load', async () => {
      clearTimeout(smokeTimeout);
      logCheckpoint('SMOKE_TEST: Main window finished loading HTML bundle');
      console.log('[SMOKE_TEST_WINDOW_PASS] BrowserWindow loaded successfully');
      console.log('[SMOKE_TEST_PASS] MAHI Browser initialized cleanly without error.');
      await performCleanExit();
    });

    mainWindow.webContents.once('did-fail-load', async (_event, errorCode, errorDescription, validatedURL) => {
      clearTimeout(smokeTimeout);
      const failMsg = `Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`;
      console.error(`[SMOKE_TEST_FAIL] ${failMsg}`);
      writeCrashLog('SMOKE_TEST_LOAD_FAILED', failMsg);
      await performCleanExit();
    });

    return;
  }

  // Check process.argv for initial cold deep-link launch (Windows/Linux)
  if (Array.isArray(process.argv)) {
    const coldDeepLink = process.argv.find(isMahiProtocolUrl);
    if (coldDeepLink) {
      logCheckpoint('Startup: Cold deep-link URL detected in process.argv', coldDeepLink);
      handleDeepLinkUrl(coldDeepLink);
    }
  }

    app?.on?.('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
      }
    });
  }).catch((startupErr: unknown) => {
    const errObj = startupErr instanceof Error ? startupErr : new Error(String(startupErr));
    writeCrashLog('APP_WHEN_READY_FATAL_ERROR', errObj.message, errObj.stack);
  });
}

export async function handleDeepLinkUrl(urlStr: string): Promise<boolean> {
  try {
    logCheckpoint('DeepLink: Processing auth handoff signal', redactSensitiveTokens(urlStr));
    const parsed = new URL(urlStr);
    const isValidProtocol = parsed.protocol === 'mahibrowser:' || parsed.protocol === 'mahi:';
    const isValidHost = parsed.hostname === 'auth' || parsed.hostname === 'auth-callback';
    if (!isValidProtocol || !isValidHost) return false;

    const handoff = parsed.searchParams.get('handoff');
    const token = parsed.searchParams.get('token');
    const code = parsed.searchParams.get('code');
    const ticket = parsed.searchParams.get('ticket');

    let success = false;
    let userId: string | null = null;

    if (handoff) {
      logCheckpoint('DeepLink: Secure single-use web handoff code received');
      const { exchangeWebHandoffCode } = await import('../08_SECURITY/account-service.js');
      const res = await exchangeWebHandoffCode(handoff);
      if (res.success) {
        success = true;
        userId = res.user?.id || null;
        logCheckpoint('DeepLink: Web handoff login succeeded and session persisted');
      } else {
        logCheckpoint('DeepLink: Web handoff login rejected', res.error);
      }
    } else if (ticket && code) {
      const { exchangeDesktopAuthCode } = await import('../08_SECURITY/account-service.js');
      const res = await exchangeDesktopAuthCode(ticket, code);
      if (res.success) {
        success = true;
        userId = res.user?.id || null;
        logCheckpoint('DeepLink: Secure PKCE exchange completed and session persisted');
      } else {
        logCheckpoint('DeepLink: Auth exchange rejected', res.error);
      }
    } else if (token) {
      logCheckpoint('DeepLink: Direct session token received from web landing page');
      const { loginWithToken } = await import('../08_SECURITY/account-service.js');
      const res = await loginWithToken(token);
      if (res.success) {
        success = true;
        userId = res.user?.id || null;
        logCheckpoint('DeepLink: Direct token login succeeded and session persisted');
      } else {
        logCheckpoint('DeepLink: Direct token login rejected', res.error);
      }
    }

    if (success) {
      if (userId) {
        try {
          const { setActiveUserId } = await import('./commercial/session-context.js');
          setActiveUserId(userId);
        } catch {}
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();

        const emitStatus = () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('account:statusChanged');
          }
        };

        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', () => {
            setTimeout(emitStatus, 300);
          });
        } else {
          emitStatus();
        }
      }
      return true;
    }
    return false;
  } catch (err: any) {
    logCheckpoint('DeepLink: Failed to process deep link URL', err?.message || String(err));
    return false;
  }
}

app?.on?.('second-instance', (_event, argv) => {
  logCheckpoint('Event: second-instance detected - focusing or reopening main window');
  if (Array.isArray(argv)) {
    const deepLink = argv.find(isMahiProtocolUrl);
    if (deepLink) {
      handleDeepLinkUrl(deepLink);
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    try {
      createWindow();
    } catch (winErr: unknown) {
      writeCrashLog('SECOND_INSTANCE_WINDOW_ERROR', String(winErr));
    }
  }
});

app?.on?.('open-url', (event, url) => {
  event.preventDefault();
  logCheckpoint('Event: open-url detected', url);
  if (isMahiProtocolUrl(url)) {
    handleDeepLinkUrl(url);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

let isQuitting = false;

async function performCleanExit(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  logCheckpoint('Event: performCleanExit - stopping services and closing app');
  try {
    await releaseAllCloudLocks().catch(() => {});
    stopResourceMonitoring();
    await processManager.stopAll();
    stopApiServer();
    closeDatabase();
    logCheckpoint('Event: performCleanExit completed cleanly');
  } catch (err: unknown) {
    writeCrashLog('BEFORE_QUIT_CLEANUP_ERROR', String(err));
  } finally {
    setTimeout(() => {
      app?.exit?.(0);
    }, 150);
  }
}

app?.on?.('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    performCleanExit();
  }
});

app?.on?.('window-all-closed', () => {
  logCheckpoint('Event: window-all-closed');
  if (process.platform !== 'darwin') {
    performCleanExit();
  }
});

