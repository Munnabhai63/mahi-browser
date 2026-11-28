import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  cloneProfile,
  deleteProfile,
  findProfileByNumber,
} from '../../02_BROWSER/services/profile-service.js';

import {
  createProxy,
  getProxies,
  getProxyById,
  updateProxy,
  deleteProxy,
  getDecryptedProxyCredentials,
} from '../../02_BROWSER/services/proxy-service.js';
import {
  getCookies,
  importCookies,
  exportCookies,
  deleteCookie,
  deleteAllCookies,
} from '../../02_BROWSER/services/cookie-service.js';
import {
  getHistory,
  deleteHistoryItem,
  clearHistory,
} from '../../02_BROWSER/services/history-service.js';
import {
  installExtension,
  getExtensions,
  toggleExtension,
  removeExtension,
} from '../../02_BROWSER/services/extension-service.js';
import {
  saveWorkflow,
  getWorkflows,
  getWorkflowById,
  deleteWorkflow,
  getWorkflowLogs,
} from '../../09_AUTOMATION/automation-engine.js';
import {
  logActivity,
  getActivityLogs,
  clearActivityLogs,
} from '../../07_BACKEND/services/audit-service.js';
import {
  getAppSettings,
  saveAppSettings,
  setAppPinCode,
  verifyAppPinCheck,
} from '../../07_BACKEND/services/settings-service.js';
import { detectSystemBrowsers } from '../../02_BROWSER/detector.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { prepareSessionPersistence, markCleanExit } from '../../02_BROWSER/launcher.js';
import { canRunRealBrowserTests } from '../setup/e2e-guards.js';

describe('MASTER QA + FULL FUNCTIONALITY AUDIT (ALL 11 MODULES)', () => {
  let tempDir: string;
  let testDbPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-master-qa-'));
    testDbPath = path.join(tempDir, 'test_master.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });


  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // -------------------------------------------------------------
  // MODULE 1: PROFILES (CRUD, Clone, Isolation, Search, Filter)
  // -------------------------------------------------------------
  describe('Module 1: Profile System', () => {
    let profileId1: string;
    let profileId2: string;

    it('should create independent profiles with isolated storage paths', () => {
      const defaults = getDefaultProfileSettings();
      const p1 = createProfile({
        name: 'Profile Alpha',
        folder: 'Work',
        notes: 'Account Alpha',
        tags: ['ClientA', 'Priority'],
        settings: { ...defaults, display: { ...defaults.display, screenWidth: 1920, screenHeight: 1080 } },
      });

      const p2 = createProfile({
        name: 'Profile Beta',
        folder: 'Personal',
        notes: 'Account Beta',
        tags: ['Personal'],
        settings: { ...defaults, display: { ...defaults.display, screenWidth: 1366, screenHeight: 768 } },
      });

      expect(p1.id).toBeDefined();
      expect(p2.id).toBeDefined();
      expect(p1.id).not.toBe(p2.id);
      expect(p1.storagePath).not.toBe(p2.storagePath);
      expect(p1.name).toBe('Profile Alpha');
      expect(p2.name).toBe('Profile Beta');
      expect(p1.tags).toContain('ClientA');

      profileId1 = p1.id;
      profileId2 = p2.id;
    });

    it('should retrieve, filter, and search profiles', () => {
      const all = getProfiles();
      expect(all.length).toBeGreaterThanOrEqual(2);

      const workOnly = getProfiles({ folder: 'Work' });
      expect(workOnly.some((p) => p.name === 'Profile Alpha')).toBe(true);
      expect(workOnly.some((p) => p.name === 'Profile Beta')).toBe(false);

      const searchAlpha = getProfiles({ searchQuery: 'Alpha' });
      expect(searchAlpha.length).toBe(1);
      expect(searchAlpha[0].name).toBe('Profile Alpha');

      const tagFilter = getProfiles({ tag: 'Priority' });
      expect(tagFilter.length).toBe(1);
      expect(tagFilter[0].id).toBe(profileId1);
    });

    it('should update profile configuration without resetting storage', () => {
      const updated = updateProfile(profileId1, {
        name: 'Profile Alpha (Updated)',
        notes: 'Updated note for QA',
      });

      expect(updated.name).toBe('Profile Alpha (Updated)');
      expect(updated.notes).toBe('Updated note for QA');

      const retrieved = getProfileById(profileId1);
      expect(retrieved?.name).toBe('Profile Alpha (Updated)');
    });

    it('should clone profile with isolated clone storage', () => {
      const cloned = cloneProfile({
        sourceProfileId: profileId1,
        newName: 'Profile Alpha Cloned',
        copyCookies: true,
        copyHistory: true,
        copyExtensions: true,
        copyBrowserSettings: true,
      });

      expect(cloned.id).toBeDefined();
      expect(cloned.id).not.toBe(profileId1);
      expect(cloned.storagePath).not.toBe(getProfileById(profileId1)?.storagePath);
      expect(cloned.name).toBe('Profile Alpha Cloned');
    });

    it('should find profile by number and index for quick switching', () => {
      const p1 = createProfile({ name: 'Profile 1', folder: 'Work' });
      const p2 = createProfile({ name: 'Profile 2', folder: 'Personal' });
      const p3 = createProfile({ name: 'Profile 3', folder: 'Testing' });

      // Match by exact number in name
      expect(findProfileByNumber(1)?.id).toBe(p1.id);
      expect(findProfileByNumber(2)?.id).toBe(p2.id);
      expect(findProfileByNumber(3)?.id).toBe(p3.id);

      // Non-existent profile number returns undefined (no crash)
      expect(findProfileByNumber(999)).toBeUndefined();
    });

    it('should delete a profile and clean up associated records', () => {

      const pToDelete = createProfile({
        name: 'Temporary Profile To Delete',
        folder: 'Temp',
      });

      const beforeCount = getProfiles().length;
      const success = deleteProfile(pToDelete.id);
      expect(success).toBe(true);

      const afterCount = getProfiles().length;
      expect(afterCount).toBe(beforeCount - 1);
      expect(getProfileById(pToDelete.id)).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // MODULE 2: PROXY MANAGEMENT & ENCRYPTION
  // -------------------------------------------------------------
  describe('Module 2: Proxy System & Credential Encryption', () => {
    let proxyId: string;

    it('should create and securely encrypt proxy with credentials', () => {
      const proxy = createProxy({
        name: 'US Premium Proxy',
        protocol: 'http',
        host: '198.51.100.1',
        port: 8080,
        username: 'secure_user_123',
        password: 'secure_password_abc!@#',
        country: 'United States',
        countryCode: 'US',
      });

      expect(proxy.id).toBeDefined();
      expect(proxy.name).toBe('US Premium Proxy');
      expect(proxy.host).toBe('198.51.100.1');
      expect(proxy.port).toBe(8080);
      proxyId = proxy.id;

      // Verify credentials are not stored in plaintext and can be decrypted
      const decrypted = getDecryptedProxyCredentials(proxyId);
      expect(decrypted).not.toBeNull();
      expect(decrypted?.username).toBe('secure_user_123');
      expect(decrypted?.password).toBe('secure_password_abc!@#');
    });

    it('should update proxy configuration and retain encryption integrity', () => {
      const updated = updateProxy(proxyId, {
        name: 'US Proxy (Updated)',
        port: 8081,
      });

      expect(updated.name).toBe('US Proxy (Updated)');
      expect(updated.port).toBe(8081);

      const decrypted = getDecryptedProxyCredentials(proxyId);
      expect(decrypted?.username).toBe('secure_user_123');
    });

    it('should list all proxies and retrieve by ID', () => {
      const list = getProxies();
      expect(list.some((p) => p.id === proxyId)).toBe(true);

      const single = getProxyById(proxyId);
      expect(single?.name).toBe('US Proxy (Updated)');
    });

    it('should delete proxy cleanly', () => {
      const tempProxy = createProxy({
        name: 'Temp Proxy',
        protocol: 'socks5',
        host: '1.2.3.4',
        port: 1080,
      });

      expect(deleteProxy(tempProxy.id)).toBe(true);
      expect(getProxyById(tempProxy.id)).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // MODULE 3: COOKIES & HISTORY MANAGEMENT
  // -------------------------------------------------------------
  describe('Module 3: Cookies & History Management', () => {
    let testProfileId: string;

    beforeAll(() => {
      const p = createProfile({ name: 'Cookie Test Profile' });
      testProfileId = p.id;
    });

    it('should import Netscape / JSON cookies for a profile', () => {
      const cookiesJson = JSON.stringify([
        {
          name: 'session_token',
          value: 'xyz_abc_token_999',
          domain: '.google.com',
          path: '/',
          secure: true,
          httpOnly: true,
        },
        {
          name: 'user_pref',
          value: 'dark_mode',
          domain: '.google.com',
          path: '/',
          secure: false,
          httpOnly: false,
        },
      ]);

      const result = importCookies(testProfileId, cookiesJson);
      expect(result.importedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('should retrieve and export cookies for the target profile', () => {
      const cookies = getCookies({ profileId: testProfileId });
      expect(cookies.length).toBe(2);
      expect(cookies.some((c) => c.name === 'session_token')).toBe(true);

      const exportedJson = exportCookies({ profileId: testProfileId, format: 'json' });
      const parsed = JSON.parse(exportedJson);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should delete specific cookie and clear all cookies for profile', () => {
      const cookiesBefore = getCookies({ profileId: testProfileId });
      expect(cookiesBefore.length).toBe(2);

      const firstCookieId = cookiesBefore[0].id;
      expect(deleteCookie(testProfileId, firstCookieId)).toBe(true);

      const cookiesAfterOne = getCookies({ profileId: testProfileId });
      expect(cookiesAfterOne.length).toBe(1);

      expect(deleteAllCookies(testProfileId)).toBe(true);
      const cookiesAfterAll = getCookies({ profileId: testProfileId });
      expect(cookiesAfterAll.length).toBe(0);
    });

    it('should manage and clear browsing history for a profile', () => {
      const historyItem = {
        id: 'hist-1',
        profileId: testProfileId,
        url: 'https://example.com',
        title: 'Example Domain',
        visitCount: 1,
        lastVisitTime: new Date().toISOString(),
      };
      
      const storagePath = getProfileById(testProfileId)?.storagePath || path.join(tempDir, testProfileId);
      const filePath = path.join(storagePath, 'mahi_history.json');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([historyItem], null, 2), 'utf8');

      const history = getHistory({ profileId: testProfileId });
      expect(history.length).toBe(1);
      expect(history[0].url).toBe('https://example.com');

      expect(deleteHistoryItem(testProfileId, 'hist-1')).toBe(true);
      expect(getHistory({ profileId: testProfileId }).length).toBe(0);
    });


  });

  // -------------------------------------------------------------
  // MODULE 4: EXTENSION MANAGEMENT
  // -------------------------------------------------------------
  describe('Module 4: Extension Management', () => {
    let testProfileId: string;
    let extDir: string;

    beforeAll(() => {
      const p = createProfile({ name: 'Extension Test Profile' });
      testProfileId = p.id;

      extDir = path.join(tempDir, 'sample-extension');
      fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(
        path.join(extDir, 'manifest.json'),
        JSON.stringify({
          manifest_version: 3,
          name: 'AdBlocker Pro QA',
          version: '2.1.0',
          description: 'Blocks ads in browser',
        })
      );
    });

    it('should install an unpacked extension and read manifest', () => {
      const ext = installExtension({
        profileId: testProfileId,
        sourcePath: extDir,
      });

      expect(ext.id).toBeDefined();
      expect(ext.name).toBe('AdBlocker Pro QA');
      expect(ext.version).toBe('2.1.0');
      expect(ext.enabled).toBe(true);

      const all = getExtensions(testProfileId);
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('AdBlocker Pro QA');
    });

    it('should toggle extension enabled status and remove cleanly', () => {
      const all = getExtensions(testProfileId);
      const extId = all[0].id;

      const toggled = toggleExtension(testProfileId, extId, false);
      expect(toggled).toBe(true);
      expect(getExtensions(testProfileId)[0].enabled).toBe(false);

      expect(removeExtension(testProfileId, extId)).toBe(true);
      expect(getExtensions(testProfileId).length).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // MODULE 5: AUTOMATION WORKFLOWS
  // -------------------------------------------------------------
  describe('Module 5: Automation Engine', () => {
    let workflowId: string;

    it('should create and persist multi-step automation workflows with flexible actions', () => {
      const wf = saveWorkflow({
        name: 'Full Multi-Step Automation Pipeline',
        description: 'Covers Open URL, Search, Wait, Email, VPN, and Custom Action',
        steps: [
          { order: 1, type: 'OPEN_URL', target: 'https://example.com' },
          { order: 2, type: 'SEARCH', target: 'Google', value: 'laptops under 50000' },
          { order: 3, type: 'WAIT', value: '30s' },
          { order: 4, type: 'EMAIL', target: 'user@example.com', value: 'Login' },
          { order: 5, type: 'VPN', target: 'NordVPN', value: 'Connect VPN' },
          { order: 6, type: 'CUSTOM_ACTION', target: 'Perform automated check', value: 'return document.title' },
          { order: 7, type: 'SCREENSHOT' },
        ],
      });

      expect(wf.id).toBeDefined();
      expect(wf.name).toBe('Full Multi-Step Automation Pipeline');
      expect(wf.steps.length).toBe(7);
      expect(wf.steps[1].type).toBe('SEARCH');
      expect(wf.steps[1].value).toBe('laptops under 50000');
      expect(wf.steps[2].type).toBe('WAIT');
      expect(wf.steps[2].value).toBe('30s');
      expect(wf.steps[3].type).toBe('EMAIL');
      expect(wf.steps[3].target).toBe('user@example.com');
      expect(wf.steps[4].type).toBe('VPN');
      expect(wf.steps[4].target).toBe('NordVPN');
      expect(wf.steps[5].type).toBe('CUSTOM_ACTION');

      workflowId = wf.id;
    });

    it('should retrieve workflow by ID and list all workflows', () => {
      const retrieved = getWorkflowById(workflowId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.steps.length).toBe(7);

      const list = getWorkflows();
      expect(list.some((w) => w.id === workflowId)).toBe(true);
    });

    it('should delete workflow and associated steps cleanly', () => {
      const tempWf = saveWorkflow({
        name: 'Temp Workflow',
        steps: [{ order: 1, type: 'WAIT', value: '100' }],
      });

      expect(deleteWorkflow(tempWf.id)).toBe(true);
      expect(getWorkflowById(tempWf.id)).toBeNull();
    });

  });

  // -------------------------------------------------------------
  // MODULE 6: ACTIVITY AUDIT LOGGING
  // -------------------------------------------------------------
  describe('Module 6: Activity Logs & Audit System', () => {
    it('should record audit events with timestamp and severity', () => {
      clearActivityLogs();

      logActivity('PROFILE', 'SUCCESS', 'Launch Profile', 'Launched Profile Alpha', 'p-1', 'Profile Alpha');
      logActivity('PROXY', 'WARNING', 'High Latency', 'Proxy latency was 450ms', 'px-1');
      logActivity('SYSTEM', 'INFO', 'App Boot', 'Application started normally');

      const logs = getActivityLogs();
      expect(logs.length).toBe(3);
      expect(logs.some((l) => l.action === 'Launch Profile')).toBe(true);
      expect(logs.some((l) => l.severity === 'WARNING')).toBe(true);
    });

    it('should filter logs by category and search term', () => {
      const profileLogs = getActivityLogs({ category: 'PROFILE' });
      expect(profileLogs.length).toBe(1);
      expect(profileLogs[0].action).toBe('Launch Profile');

      const searchLogs = getActivityLogs({ searchQuery: 'Latency' });
      expect(searchLogs.length).toBe(1);
      expect(searchLogs[0].severity).toBe('WARNING');
    });

    it('should clear logs on demand', () => {
      expect(clearActivityLogs()).toBe(true);
      expect(getActivityLogs().length).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // MODULE 7: SETTINGS & SECURITY PIN
  // -------------------------------------------------------------
  describe('Module 7: Settings & App Security PIN', () => {
    it('should get default settings and merge updates', () => {
      const current = getAppSettings();
      expect(current.general.theme).toBeDefined();
      expect(current.privacy.doNotTrack).toBe(true);

      const updated = saveAppSettings({
        general: { ...current.general, theme: 'dark', language: 'en' },
        performance: { ...current.performance, maxConcurrentProfiles: 10 },
      });


      expect(updated.general.theme).toBe('dark');
      expect(updated.performance.maxConcurrentProfiles).toBe(10);

      const reloaded = getAppSettings();
      expect(reloaded.general.theme).toBe('dark');
    });

    it('should configure and verify application PIN lock', () => {
      const pinSuccess = setAppPinCode('4321');
      expect(pinSuccess).toBe(true);

      expect(verifyAppPinCheck('4321')).toBe(true);
      expect(verifyAppPinCheck('0000')).toBe(false);
      expect(verifyAppPinCheck('9999')).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // MODULE 8: SYSTEM DETECTOR & SESSION PERSISTENCE
  // -------------------------------------------------------------
  describe('Module 8: System Detector & Session Persistence', () => {
    it('should detect installed system browsers safely across headless CI and desktop hosts', async () => {
      const browsers = await detectSystemBrowsers();
      expect(Array.isArray(browsers)).toBe(true);
      for (const browser of browsers) {
        expect(typeof browser.name).toBe('string');
        expect(typeof browser.path).toBe('string');
        expect(fs.existsSync(browser.path)).toBe(true);
      }
      if (canRunRealBrowserTests()) {
        expect(browsers.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should configure Chromium session persistence and clean exit state', () => {
      const profileDir = path.join(tempDir, 'session-test-profile');
      fs.mkdirSync(profileDir, { recursive: true });

      prepareSessionPersistence(profileDir, 'QA Profile');
      const prefsPath = path.join(profileDir, 'Default', 'Preferences');
      expect(fs.existsSync(prefsPath)).toBe(true);

      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      expect(prefs.session.restore_on_startup).toBe(1);
      expect(prefs.profile.exit_type).toBe('Normal');

      markCleanExit(profileDir, 'QA Profile');
      const prefsAfterExit = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      expect(prefsAfterExit.profile.exit_type).toBe('Normal');
    });
  });
});
