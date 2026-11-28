import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { useAccountStore } from '../../01_UI/stores/useAccountStore.js';
import { useAutomationStore } from '../../01_UI/stores/useAutomationStore.js';
import { useSettingsStore } from '../../01_UI/stores/useSettingsStore.js';
import { useLogStore } from '../../01_UI/stores/useLogStore.js';
import { fallbackMahiAPI } from '../../01_UI/api-fallback.js';
import * as proxyService from '../../02_BROWSER/services/proxy-service.js';
import { handleProxiesTest } from '../../07_BACKEND/ipc/register-handlers.js';

vi.mock('../../02_BROWSER/services/proxy-service.js', () => ({
  getProxyById: vi.fn(),
  testAndSaveProxyStatus: vi.fn(),
  getDecryptedProxyCredentials: vi.fn(),
  testProxyConnection: vi.fn(),
}));

describe('Step 8: Frontend, Preload, IPC Contract & Build-Rewrite Remediation', () => {
  const rootDir = path.resolve(__dirname, '../../');

  it('single preload/index.ts source forwards dto in accountGetPlanLimits, exposes onToastShow & exportNetscapeCookies, and legacy preload.cjs is removed', () => {
    const preloadTsPath = path.join(rootDir, '10_CONFIG/preload/index.ts');
    expect(fs.existsSync(path.join(rootDir, '10_CONFIG/preload/preload.cjs'))).toBe(false);
    const content = fs.readFileSync(preloadTsPath, 'utf8');

    expect(content).toMatch(/accountGetPlanLimits:\s*\(dto\)\s*=>\s*ipcRenderer\.invoke\(['"]account:getPlanLimits['"],\s*dto\)/);
    expect(content).toContain("exportNetscapeCookies: (profileId: string, targetFilePath?: string) => ipcRenderer.invoke('archive:exportNetscape', profileId, targetFilePath)");
    expect(content).toContain('onToastShow:');
    expect(content).toContain("'toast:show'");
    expect(content).not.toContain('commercialSyncUser');
  });

  it('compiles preload/index.ts to CJS and executes in mocked Electron runtime: proves accountGetPlanLimits({ force: true }) and onToastShow forward arguments and callbacks', async () => {
    const preloadTsPath = path.join(rootDir, '10_CONFIG/preload/index.ts');
    const preloadTs = fs.readFileSync(preloadTsPath, 'utf8');
    const { code: preloadCode } = esbuild.transformSync(preloadTs, {
      loader: 'ts',
      format: 'cjs',
      target: 'node20',
    });

    let exposedApi: any = null;
    const eventListeners = new Map<string, Function>();

    const mockIpcRenderer = {
      invoke: vi.fn(async (channel: string, ...args: any[]) => {
        return { channel, args };
      }),
      on: vi.fn((channel: string, handler: Function) => {
        eventListeners.set(channel, handler);
      }),
      removeListener: vi.fn((channel: string, handler: Function) => {
        if (eventListeners.get(channel) === handler) {
          eventListeners.delete(channel);
        }
      }),
    };

    const mockContextBridge = {
      exposeInMainWorld: vi.fn((key: string, api: any) => {
        if (key === 'mahiAPI') {
          exposedApi = api;
        }
      }),
    };

    const sandbox = {
      exports: {},
      module: { exports: {} },
      require: (mod: string) => {
        if (mod === 'electron') {
          return {
            contextBridge: mockContextBridge,
            ipcRenderer: mockIpcRenderer,
          };
        }
        throw new Error(`Unexpected require in preload: ${mod}`);
      },
      console,
    };

    vm.runInNewContext(preloadCode, sandbox);

    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith('mahiAPI', expect.any(Object));
    expect(exposedApi).toBeDefined();
    expect(exposedApi.isDesktop).toBe(true);
    expect(exposedApi.commercialSyncUser).toBeUndefined();

    // Verify accountGetPlanLimits passes { force: true }
    await exposedApi.accountGetPlanLimits({ force: true });
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('account:getPlanLimits', { force: true });

    // Verify onToastShow callback registration, delivery and cleanup
    let receivedToast: any = null;
    const unsub = exposedApi.onToastShow((t: any) => {
      receivedToast = t;
    });

    expect(mockIpcRenderer.on).toHaveBeenCalledWith('toast:show', expect.any(Function));
    const registeredHandler = eventListeners.get('toast:show');
    expect(registeredHandler).toBeDefined();

    registeredHandler!({}, { message: 'Plan limits refreshed', type: 'info' });
    expect(receivedToast).toEqual({ message: 'Plan limits refreshed', type: 'info' });

    // Verify unsub invokes removeListener
    unsub();
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('toast:show', registeredHandler);
    expect(eventListeners.has('toast:show')).toBe(false);
  });

  it('handleProxiesTest routes unchanged proxy to testAndSaveProxyStatus and edited proxy to testProxyConnection', async () => {
    const saved = {
      id: 'px-1',
      protocol: 'http',
      host: '10.0.0.1',
      port: 8080,
      username: 'user1',
      hasPassword: true,
      status: 'CONNECTED',
    };

    (proxyService.getProxyById as any).mockReturnValue(saved);
    (proxyService.testAndSaveProxyStatus as any).mockResolvedValue({ success: true, latencyMs: 45 });
    (proxyService.testProxyConnection as any).mockResolvedValue({ success: true, latencyMs: 70 });
    (proxyService.getDecryptedProxyCredentials as any).mockReturnValue({ username: 'user1', password: 'vault-password' });

    // 1. Unchanged proxy test (no overrides, no new password)
    const res1 = await handleProxiesTest({ proxyId: 'px-1' });
    expect(proxyService.testAndSaveProxyStatus).toHaveBeenCalledWith('px-1');
    expect(res1.success).toBe(true);

    // 2. Unchanged proxy with explicit matching fields
    await handleProxiesTest({ proxyId: 'px-1', host: '10.0.0.1', port: 8080, protocol: 'http', username: 'user1' });
    expect(proxyService.testAndSaveProxyStatus).toHaveBeenCalledWith('px-1');

    // 3. Edited proxy with changed host -> calls testProxyConnection
    await handleProxiesTest({ proxyId: 'px-1', host: '10.0.0.99' });
    expect(proxyService.testProxyConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '10.0.0.99',
        port: 8080,
        protocol: 'http',
      })
    );

    // 4. Edited proxy with unchanged host/port but keeping saved password
    await handleProxiesTest({ proxyId: 'px-1', username: 'user2' });
    expect(proxyService.testProxyConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '10.0.0.1',
        port: 8080,
        username: 'user2',
        password: 'vault-password',
      })
    );

    // 5. Edited proxy with new password
    await handleProxiesTest({ proxyId: 'px-1', password: 'brand-new-password' });
    expect(proxyService.testProxyConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'brand-new-password',
      })
    );

    // 6. Raw proxy without saved ID
    (proxyService.getProxyById as any).mockReturnValue(null);
    await handleProxiesTest({ host: '9.9.9.9', port: 1080, protocol: 'socks5' });
    expect(proxyService.testProxyConnection).toHaveBeenCalledWith({
      host: '9.9.9.9',
      port: 1080,
      protocol: 'socks5',
    });
  });

  it('12_SCRIPTS/fix-preload.cjs scopes only to dist-electron and protects React DOM assets', () => {
    const fixScriptPath = path.join(rootDir, '12_SCRIPTS/fix-preload.cjs');
    const content = fs.readFileSync(fixScriptPath, 'utf8');

    // Never mutates dist/assets or playwright-core
    expect(content).not.toContain("dist/assets");
    expect(content).not.toContain("playwright-core");

    // No dangerous keygen regex that breaks React void elements
    expect(content).not.toContain("/keygen/gi");

    // Targets dist-electron cleanly
    expect(content).toContain("'dist-electron', 'main'");
    expect(content).toContain("'dist-electron', 'preload'");
  });

  it('register-handlers.ts removes commercial:syncUser and implements archive:exportNetscape with file save', () => {
    const handlersPath = path.join(rootDir, '07_BACKEND/ipc/register-handlers.ts');
    const content = fs.readFileSync(handlersPath, 'utf8');

    expect(content).not.toContain("ipcMain.handle('commercial:syncUser'");
    expect(content).toContain("ipcMain.handle('archive:exportNetscape'");
    expect(content).toContain('testAndSaveProxyStatus');
    expect(content).toContain('getDecryptedProxyCredentials');
  });

  it('api-fallback.ts has safe defaults with no hardcoded paths or fake entitlements', async () => {
    expect(typeof fallbackMahiAPI.onToastShow).toBe('function');
    const unsub = fallbackMahiAPI.onToastShow(() => {});
    expect(typeof unsub).toBe('function');

    const cap = await fallbackMahiAPI.checkCapability('anything');
    expect(cap.entitled).toBe(false);
    expect(cap.reason).toBe('DESKTOP_OR_LICENSE_REQUIRED');

    const shortcutRes = await fallbackMahiAPI.createProfileShortcut('p-1', 'Profile 1');
    expect(shortcutRes.success).toBe(false);
    expect(shortcutRes.path).toBe('');
  });

  it('useAccountStore unified logout clears auth, commercial state and never partialize raw tokens', async () => {
    // Populate store state
    useAccountStore.setState({
      accountSession: { token: 'secret-acc-token' } as any,
      commercialToken: 'secret-comm-token',
      commercialUser: { id: 'u1', email: 'test@example.com' } as any,
      currentUser: { id: 'u1', email: 'test@example.com' } as any,
      entitlements: { user: { id: 'u1' } } as any,
      planLimits: { isPro: true, plan: 'pro', maxProfiles: 100, expiresAt: null },
    });

    // Test partialize output does NOT contain raw tokens
    const partializeFn = (useAccountStore as any).persist?.getOptions()?.partialize;
    if (partializeFn) {
      const persisted = partializeFn(useAccountStore.getState());
      expect(persisted.commercialToken).toBeUndefined();
      expect(persisted.accountSession).toBeUndefined();
    }

    // Call unified logout
    await useAccountStore.getState().logout();

    const state = useAccountStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.commercialUser).toBeNull();
    expect(state.commercialToken).toBeNull();
    expect(state.accountSession).toBeNull();
    expect(state.entitlements).toBeNull();
    expect(state.planLimits.isPro).toBe(false);
  });

  it('stores reset loading state cleanly in finally blocks', async () => {
    // Automation Store
    useAutomationStore.setState({ loading: true });
    await useAutomationStore.getState().fetchWorkflows();
    expect(useAutomationStore.getState().loading).toBe(false);

    // Settings Store
    useSettingsStore.setState({ loading: true });
    await useSettingsStore.getState().fetchSettings();
    expect(useSettingsStore.getState().loading).toBe(false);

    // Log Store
    useLogStore.setState({ loading: true });
    await useLogStore.getState().fetchLogs();
    expect(useLogStore.getState().loading).toBe(false);
  });
});
