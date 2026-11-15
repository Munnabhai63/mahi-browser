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

const esmRequire = createRequire(import.meta.url);

export const isElectronRuntime: boolean = Boolean(
  typeof process !== 'undefined' &&
  process.versions &&
  process.versions.electron
);

let electronMod: any = null;
if (isElectronRuntime) {
  try {
    electronMod = esmRequire('electron');
  } catch {
    electronMod = null;
  }
}

export const app: App = (electronMod?.app ?? {
  isPackaged: false,
  getVersion: () => '1.1.9',
  getName: () => 'mahi-browser',
  getPath: (_name: string) => '',
  getAppPath: () => process.cwd(),
  whenReady: () => Promise.resolve(),
  on: () => {},
  quit: () => {},
  exit: () => {},
  setAsDefaultProtocolClient: () => false,
}) as any;

export const BrowserWindow: typeof ElectronBrowserWindow = (electronMod?.BrowserWindow ?? class MockBrowserWindow {
  static getAllWindows(): any[] {
    return [];
  }
  static getFocusedWindow(): any {
    return null;
  }
  static fromWebContents(): any {
    return null;
  }
  static fromId(): any {
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
}) as any;

export const Notification: typeof ElectronNotification = (electronMod?.Notification ?? class MockNotification {
  static isSupported(): boolean {
    return false;
  }
  show() {}
  on() {}
}) as any;

export const safeStorage: SafeStorage = (electronMod?.safeStorage ?? {
  isEncryptionAvailable: () => false,
  encryptString: (plainText: string) => Buffer.from(plainText, 'utf8'),
  decryptString: (encrypted: Buffer) => encrypted.toString('utf8'),
}) as any;

export const shell: Shell = (electronMod?.shell ?? {
  openExternal: async () => false,
  openPath: async () => '',
  showItemInFolder: () => {},
}) as any;

export const dialog: Dialog = (electronMod?.dialog ?? {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: '' }),
  showMessageBox: async () => ({ response: 0 }),
}) as any;

export const ipcMain: IpcMain = (electronMod?.ipcMain ?? {
  handle: () => {},
  on: () => {},
  removeHandler: () => {},
  removeAllListeners: () => {},
}) as any;

export const electron: any = electronMod ?? {
  app,
  BrowserWindow,
  Notification,
  safeStorage,
  shell,
  dialog,
  ipcMain,
};

export default electronMod;
