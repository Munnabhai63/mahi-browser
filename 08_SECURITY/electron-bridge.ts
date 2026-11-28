/**
 * MAHI Platform V2 — Node-Safe Electron Runtime Bridge
 * Safely accesses Electron primitives in desktop Electron runtime,
 * and provides safe no-op stubs when executing in standalone Node.js 22 / Fastify / Docker.
 */

import { createRequire } from 'node:module';
import type {
  App,
  BrowserWindow as ElectronBrowserWindow,
  Notification as ElectronNotification,
  SafeStorage,
  Shell,
  Dialog,
  IpcMain,
} from 'electron';
import { APP_VERSION } from '../10_CONFIG/shared/version.js';

const esmRequire = createRequire(import.meta.url);

export const isElectronRuntime: boolean = Boolean(
  typeof process !== 'undefined' &&
  process.versions &&
  process.versions.electron
);

type ElectronModuleShape = {
  app: App;
  BrowserWindow: typeof ElectronBrowserWindow;
  Notification: typeof ElectronNotification;
  safeStorage: SafeStorage;
  shell: Shell;
  dialog: Dialog;
  ipcMain: IpcMain;
};

let electronMod: Partial<ElectronModuleShape> | null = null;
if (isElectronRuntime) {
  try {
    const processWithBuiltin = process as NodeJS.Process & {
      getBuiltinModule?: (id: string) => Partial<ElectronModuleShape> | undefined;
    };
    if (typeof processWithBuiltin.getBuiltinModule === 'function') {
      electronMod = processWithBuiltin.getBuiltinModule('electron') ?? null;
    }
  } catch { /* Non-fatal: Electron built-in module unavailable outside main process */ }

  if (!electronMod) {
    try {
      electronMod = esmRequire('electron') as Partial<ElectronModuleShape>;
    } catch { /* Non-fatal: headless CLI / gateway server runs without Electron */ }
  }

  if (!electronMod) {
    try {
      const globalWithRequire = globalThis as typeof globalThis & {
        require?: (id: string) => Partial<ElectronModuleShape>;
      };
      if (typeof globalWithRequire.require === 'function') {
        electronMod = globalWithRequire.require('electron');
      }
    } catch { /* Non-fatal: CJS electron fallback unavailable in pure Node */ }
  }
}

export const app: App = (electronMod?.app ?? ({
  isPackaged: false,
  getVersion: () => APP_VERSION,
  getName: () => 'mahi-browser',
  getPath: (_name: string) => '',
  getAppPath: () => process.cwd(),
  whenReady: () => Promise.resolve(),
  on: () => {},
  quit: () => {},
  exit: () => {},
  setAsDefaultProtocolClient: () => false,
} as unknown as App));

class MockBrowserWindow {
  static getAllWindows(): ElectronBrowserWindow[] {
    return [];
  }
  static getFocusedWindow(): ElectronBrowserWindow | null {
    return null;
  }
  static fromWebContents(): ElectronBrowserWindow | null {
    return null;
  }
  static fromId(): ElectronBrowserWindow | null {
    return null;
  }
  webContents = {
    send: () => {},
    on: () => {},
  };
  loadURL() {}
  loadFile() {}
  on() {}
  once() {}
  close() {}
  destroy() {}
}

export const BrowserWindow: typeof ElectronBrowserWindow = (
  electronMod?.BrowserWindow ?? (MockBrowserWindow as unknown as typeof ElectronBrowserWindow)
);

class MockNotification {
  static isSupported(): boolean {
    return false;
  }
  show() {}
  on() {}
}

export const Notification: typeof ElectronNotification = (
  electronMod?.Notification ?? (MockNotification as unknown as typeof ElectronNotification)
);

export const safeStorage: SafeStorage = (electronMod?.safeStorage ?? ({
  isEncryptionAvailable: () => false,
  encryptString: (plainText: string) => Buffer.from(plainText, 'utf8'),
  decryptString: (encrypted: Buffer) => encrypted.toString('utf8'),
} as unknown as SafeStorage));

export const shell: Shell = (electronMod?.shell ?? ({
  openExternal: async () => false,
  openPath: async () => '',
  showItemInFolder: () => {},
} as unknown as Shell));

export const dialog: Dialog = (electronMod?.dialog ?? ({
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: '' }),
  showMessageBox: async () => ({ response: 0 }),
} as unknown as Dialog));

export const ipcMain: IpcMain = (electronMod?.ipcMain ?? ({
  handle: () => {},
  on: () => {},
  removeHandler: () => {},
  removeAllListeners: () => {},
} as unknown as IpcMain));

export const electron: Partial<ElectronModuleShape> = electronMod ?? {
  app,
  BrowserWindow,
  Notification,
  safeStorage,
  shell,
  dialog,
  ipcMain,
};

export default electronMod;
