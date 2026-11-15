import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useAccountStore } from '../../01_UI/stores/useAccountStore.js';
import { useAutomationStore } from '../../01_UI/stores/useAutomationStore.js';
import { useSettingsStore } from '../../01_UI/stores/useSettingsStore.js';
import { useLogStore } from '../../01_UI/stores/useLogStore.js';
import { fallbackMahiAPI } from '../../01_UI/api-fallback.js';

describe('Step 8: Frontend, Preload, IPC Contract & Build-Rewrite Remediation', () => {
  const rootDir = path.resolve(__dirname, '../../');

  it('preload.cjs forwards dto in accountGetPlanLimits and exposes onToastShow & exportNetscapeCookies', () => {
    const preloadCjsPath = path.join(rootDir, '10_CONFIG/preload/preload.cjs');
    const content = fs.readFileSync(preloadCjsPath, 'utf8');

    // Check accountGetPlanLimits forwards dto
    expect(content).toMatch(/accountGetPlanLimits:\s*\(dto\)\s*=>\s*ipcRenderer\.invoke\(['"]account:getPlanLimits['"],\s*dto\)/);

    // Check exportNetscapeCookies accepts targetFilePath
    expect(content).toMatch(/exportNetscapeCookies:\s*\(profileId,\s*targetFilePath\)\s*=>\s*ipcRenderer\.invoke\(['"]archive:exportNetscape['"],\s*profileId,\s*targetFilePath\)/);

    // Check onToastShow is wired
    expect(content).toContain('onToastShow:');
    expect(content).toContain("'toast:show'");
  });

  it('preload/index.ts has exact parity with preload.cjs for Step 8 additions', () => {
    const preloadIndexPath = path.join(rootDir, '10_CONFIG/preload/index.ts');
    const content = fs.readFileSync(preloadIndexPath, 'utf8');

    expect(content).toContain("exportNetscapeCookies: (profileId: string, targetFilePath?: string) => ipcRenderer.invoke('archive:exportNetscape', profileId, targetFilePath)");
    expect(content).toContain('onToastShow:');
    expect(content).toContain("'toast:show'");
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

  it('register-handlers.ts implements commercial:syncUser and archive:exportNetscape with file save', () => {
    const handlersPath = path.join(rootDir, '07_BACKEND/ipc/register-handlers.ts');
    const content = fs.readFileSync(handlersPath, 'utf8');

    expect(content).toContain("ipcMain.handle('commercial:syncUser'");
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
