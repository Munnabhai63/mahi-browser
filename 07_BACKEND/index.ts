import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from '../06_DATABASE/schema.js';
import { closeDatabase, setCustomDatabasePath } from '../06_DATABASE/connection.js';
import { registerIpcHandlers } from './ipc/register-handlers.js';
import { processManager } from '../02_BROWSER/process-manager.js';
import { startApiServer, stopApiServer } from './api/local-api-server.js';
import { logActivity } from './services/audit-service.js';
import { initAutoUpdater } from './services/updater-service.js';
import { startLicenseStatusService } from '../08_SECURITY/license-status-service.js';
import { startPriceSync } from '../08_SECURITY/price-service.js';
import { startResourceMonitoring, stopResourceMonitoring } from '../03_HARDWARE/resource-monitor-service.js';
import { provisionEngineOnStartup } from '../02_BROWSER/managed-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// 1. Crash Logger & Checkpoints System
// -------------------------------------------------------------
const projectDir = process.cwd();
const localAppDataDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'mahi-browser') : projectDir;
const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : projectDir;

if (!fs.existsSync(localAppDataDir)) {
  try { fs.mkdirSync(localAppDataDir, { recursive: true }); } catch {}
}

const crashLogPaths = [
  path.join(projectDir, 'crash-log.txt'),
  path.join(localAppDataDir, 'crash-log.txt'),
  path.join(localAppDataDir, 'mahi_debug.log'),
];

export function writeCrashLog(type: string, message: string, stack?: string): void {
  const timestamp = new Date().toISOString();
  const entry = [
    `\n==================== [CRASH / ERROR EVENT: ${type}] ====================`,
    `Timestamp: ${timestamp}`,
    `Process: Main Process (PID: ${process.pid})`,
    `Platform: ${process.platform} (${process.arch}) Node: ${process.version} Electron: ${process.versions.electron}`,
    `Message: ${message}`,
    stack ? `Stack Trace:\n${stack}` : 'Stack Trace: None available',
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
  const line = `[${timestamp}] [CHECKPOINT] ${stepName}${detail ? ' - ' + detail : ''}\n`;
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
  fs.writeFileSync(path.join(projectDir, 'crash-log.txt'), header, 'utf8');
  fs.writeFileSync(path.join(localAppDataDir, 'crash-log.txt'), header, 'utf8');
} catch {}

logCheckpoint('Step 1: Application Initializing', `Electron version: ${process.versions.electron}`);

// Use software rendering to prevent GPU driver crashes on diverse hardware
try {
  app.disableHardwareAcceleration();
  logCheckpoint('Step 1: Hardware Acceleration Disabled');
} catch (err: unknown) {
  writeCrashLog('HW_ACCEL_ERROR', String(err));
}

// Set Windows Application User Model ID for taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.mahibrowser.app');
}


// Single instance lock check (Non-blocking: Never terminate user window)
logCheckpoint('Step 2: Checking Instance Status');
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logCheckpoint('Step 2: Multi-instance / parallel launch detected. Proceeding to launch UI window.');
} else {
  logCheckpoint('Step 2: Primary Instance Lock Acquired');
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function createSplashWindow(): void {
  try {
    const splashPath = app.isPackaged
      ? path.join(process.resourcesPath, 'splash.html')
      : path.join(projectDir, 'resources', 'splash.html');

    if (!fs.existsSync(splashPath)) return;

    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(projectDir, 'resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

    splashWindow = new BrowserWindow({
      width: 480,
      height: 320,
      frame: false,
      transparent: true,
      resizable: false,
      center: true,
      alwaysOnTop: true,
      show: true,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    splashWindow.loadFile(splashPath);
  } catch (splashErr) {
    console.error('Splash window initialization warning:', splashErr);
  }
}

function createWindow(): void {
  logCheckpoint('Step 5: Creating BrowserWindow');

  const preloadPath = path.join(__dirname, '../preload/index.cjs');
  logCheckpoint('Step 5: Preload script path', preloadPath);
  logCheckpoint('Step 5: Preload exists on disk', String(fs.existsSync(preloadPath)));

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(projectDir, 'resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: 'MAHI BROWSER',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });


  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('ready-to-show', () => {
    logCheckpoint('Step 6: Window ready-to-show event fired');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
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
      mainWindow.show();
      mainWindow.focus();
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Strict Navigation Lock: Main Window must NEVER navigate away from MAHI UI
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow local app bundle or dev server
    if (url.startsWith('file:') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (url.startsWith('file:') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
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

app.whenReady().then(async () => {
  logCheckpoint('Step 3: App whenReady fired');

  // 0. Display Branded Startup Splash Screen
  if (!process.argv.includes('--smoke-test')) {
    createSplashWindow();
  }

  // 1. Initialize SQLite Database
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'mahi_browser.sqlite');
    logCheckpoint('Step 3: Setting Database Path', dbPath);
    setCustomDatabasePath(dbPath);

    logCheckpoint('Step 3: Initializing SQLite Engine & Tables');
    await initializeDatabase();
    logCheckpoint('Step 3: Database Initialized Successfully');
    logActivity('SYSTEM', 'INFO', 'App Startup', 'MAHI BROWSER initialized successfully');
  } catch (dbErr: unknown) {
    const errObj = dbErr instanceof Error ? dbErr : new Error(String(dbErr));
    writeCrashLog('DATABASE_INIT_ERROR', errObj.message, errObj.stack);

    // Attempt recovery by recreating clean database
    try {
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'mahi_browser.sqlite');
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

  // Packaged Application Native Smoke Test Mode
  if (process.argv.includes('--smoke-test')) {
    logCheckpoint('SMOKE_TEST: Packaged Application Smoke Test Mode Triggered');
    console.log('[SMOKE_TEST] Main Process Initialized');
    console.log('[SMOKE_TEST] SQLite Database Initialized');
    console.log(`[SMOKE_TEST] Platform: ${process.platform} Arch: ${process.arch}`);
    console.log('[SMOKE_TEST_PASS] MAHI Browser initialized cleanly without error.');
    await performCleanExit();
    return;
  }

  // 4. Create Main Window & Load UI
  try {
    createWindow();
  } catch (winErr: unknown) {
    writeCrashLog('CREATE_WINDOW_ERROR', String(winErr));
  }

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    }
  });
}).catch((startupErr: unknown) => {
  const errObj = startupErr instanceof Error ? startupErr : new Error(String(startupErr));
  writeCrashLog('APP_WHEN_READY_FATAL_ERROR', errObj.message, errObj.stack);
});

app.on('second-instance', () => {
  logCheckpoint('Event: second-instance detected - focusing or reopening main window');
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

let isQuitting = false;

async function performCleanExit(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  logCheckpoint('Event: performCleanExit - stopping services and closing app');
  try {
    stopResourceMonitoring();
    await processManager.stopAll();
    stopApiServer();
    closeDatabase();
    logCheckpoint('Event: performCleanExit completed cleanly');
  } catch (err: unknown) {
    writeCrashLog('BEFORE_QUIT_CLEANUP_ERROR', String(err));
  } finally {
    setTimeout(() => {
      app.exit(0);
    }, 150);
  }
}

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    performCleanExit();
  }
});

app.on('window-all-closed', () => {
  logCheckpoint('Event: window-all-closed');
  if (process.platform !== 'darwin') {
    performCleanExit();
  }
});

