import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import * as cleanerService from '../../07_BACKEND/services/profile-cache-cleaner.js';
import {
  handlePreviewCacheCleanup,
  handleApplyCacheCleanup,
} from '../../07_BACKEND/ipc/register-handlers.js';
import { fallbackMahiAPI } from '../../01_UI/api-fallback.js';

describe('Layer 1 Step 2 — In-App Profile Cache Cleaner IPC & Preload Contract', () => {
  const rootDir = path.resolve(__dirname, '../../');
  let tempDataDir: string;
  let originalEnvDataDir: string | undefined;

  beforeEach(() => {
    originalEnvDataDir = process.env.MAHI_USER_DATA_DIR;
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-inapp-cache-test-'));
    process.env.MAHI_USER_DATA_DIR = tempDataDir;

    const profDir = path.join(tempDataDir, 'profiles', 'prof-1', 'Default');
    fs.mkdirSync(path.join(profDir, 'Cache'), { recursive: true });
    fs.writeFileSync(path.join(profDir, 'Cache', 'data_0'), 'cached-bytes-payload');
    fs.mkdirSync(path.join(profDir, 'GPUCache'), { recursive: true });
    fs.writeFileSync(path.join(profDir, 'GPUCache', 'gpu.bin'), 'shader-bytes');

    // Critical files that must stay untouched
    fs.writeFileSync(path.join(tempDataDir, 'mahi_browser.sqlite'), 'SQLITE-USER-DB');
    fs.mkdirSync(path.join(profDir, 'Network'), { recursive: true });
    fs.writeFileSync(path.join(profDir, 'Network', 'Cookies'), 'AUTH-COOKIES');
    fs.mkdirSync(path.join(tempDataDir, 'engines', '138.0.7204.0'), { recursive: true });
    fs.writeFileSync(path.join(tempDataDir, 'engines', '138.0.7204.0', 'chrome.exe'), 'CHROME-BIN');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnvDataDir === undefined) {
      delete process.env.MAHI_USER_DATA_DIR;
    } else {
      process.env.MAHI_USER_DATA_DIR = originalEnvDataDir;
    }
    if (fs.existsSync(tempDataDir)) {
      try {
        fs.rmSync(tempDataDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('1. verifies exact IPC channel parity across register-handlers.ts, preload/index.ts, and api-fallback.ts', () => {
    const handlersSrc = fs.readFileSync(path.join(rootDir, '07_BACKEND/ipc/register-handlers.ts'), 'utf8');
    const preloadTsSrc = fs.readFileSync(path.join(rootDir, '10_CONFIG/preload/index.ts'), 'utf8');
    const ipcTypesSrc = fs.readFileSync(path.join(rootDir, '10_CONFIG/shared/types/ipc.ts'), 'utf8');
    const fallbackSrc = fs.readFileSync(path.join(rootDir, '01_UI/api-fallback.ts'), 'utf8');

    expect(handlersSrc).toContain("ipcMain.handle('profiles:previewCacheCleanup'");
    expect(handlersSrc).toContain("ipcMain.handle('profiles:applyCacheCleanup'");

    expect(preloadTsSrc).toContain("previewProfileCacheCleanup: () => ipcRenderer.invoke('profiles:previewCacheCleanup')");
    expect(preloadTsSrc).toContain("applyProfileCacheCleanup: () => ipcRenderer.invoke('profiles:applyCacheCleanup')");

    expect(ipcTypesSrc).toContain('previewProfileCacheCleanup: () => Promise<ProfileCacheCleanupResult>');
    expect(ipcTypesSrc).toContain('applyProfileCacheCleanup: () => Promise<ProfileCacheCleanupResult>');

    expect(fallbackSrc).toContain('previewProfileCacheCleanup:');
    expect(fallbackSrc).toContain('applyProfileCacheCleanup:');
  });

  it('2. compiles preload/index.ts to CommonJS and forwards preview/apply IPC invocations in mocked Electron runtime', async () => {
    const preloadTs = fs.readFileSync(path.join(rootDir, '10_CONFIG/preload/index.ts'), 'utf8');
    const { code: preloadCode } = esbuild.transformSync(preloadTs, {
      loader: 'ts',
      format: 'cjs',
      target: 'node20',
    });
    let exposedApi: any = null;

    const mockIpcRenderer = {
      invoke: vi.fn(async (channel: string) => ({ channel })),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockContextBridge = {
      exposeInMainWorld: vi.fn((key: string, api: any) => {
        if (key === 'mahiAPI') exposedApi = api;
      }),
    };

    vm.runInNewContext(preloadCode, {
      exports: {},
      module: { exports: {} },
      require: (mod: string) => {
        if (mod === 'electron') {
          return { contextBridge: mockContextBridge, ipcRenderer: mockIpcRenderer };
        }
        throw new Error(`Unexpected require: ${mod}`);
      },
      console,
    });

    await exposedApi.previewProfileCacheCleanup();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('profiles:previewCacheCleanup');

    await exposedApi.applyProfileCacheCleanup();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('profiles:applyCacheCleanup');
  });

  it('3. handlePreviewCacheCleanup passes apply: false on resolved runtime data dir and leaves caches intact', async () => {
    const spy = vi.spyOn(cleanerService, 'cleanProfileCaches');
    const preview = await handlePreviewCacheCleanup();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir: path.resolve(tempDataDir),
        apply: false,
        silent: true,
      })
    );
    expect(preview.dryRun).toBe(true);
    expect(preview.cacheFoldersMatched).toBe(2);
    expect(preview.filesMatched).toBe(2);
    expect(preview.deletedFolders).toBe(0);
    expect(fs.existsSync(path.join(tempDataDir, 'profiles', 'prof-1', 'Default', 'Cache', 'data_0'))).toBe(true);
  });

  it('4. handleApplyCacheCleanup passes apply: true on resolved runtime data dir and protects DB, cookies, and engines', async () => {
    const spy = vi.spyOn(cleanerService, 'cleanProfileCaches');
    const result = await handleApplyCacheCleanup();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir: path.resolve(tempDataDir),
        apply: true,
        silent: true,
      })
    );
    expect(result.dryRun).toBe(false);
    expect(result.deletedFolders).toBe(2);
    expect(fs.existsSync(path.join(tempDataDir, 'profiles', 'prof-1', 'Default', 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(tempDataDir, 'profiles', 'prof-1', 'Default', 'GPUCache'))).toBe(false);

    // Critical files remain untouched
    expect(fs.existsSync(path.join(tempDataDir, 'mahi_browser.sqlite'))).toBe(true);
    expect(fs.existsSync(path.join(tempDataDir, 'profiles', 'prof-1', 'Default', 'Network', 'Cookies'))).toBe(true);
    expect(fs.existsSync(path.join(tempDataDir, 'engines', '138.0.7204.0', 'chrome.exe'))).toBe(true);
  });

  it('5. api-fallback provides safe non-destructive responses in browser-only dev mode', async () => {
    const preview = await fallbackMahiAPI.previewProfileCacheCleanup();
    expect(preview.dryRun).toBe(true);
    expect(preview.deletedFolders).toBe(0);

    const applied = await fallbackMahiAPI.applyProfileCacheCleanup();
    expect(applied.dryRun).toBe(false);
    expect(applied.deletedFolders).toBe(0);
  });
});
