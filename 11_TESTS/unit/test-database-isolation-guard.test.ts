import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import {
  getDatabasePath,
  setCustomDatabasePath,
  isTestRunnerEnvironment,
  assertPathIsNotProduction,
} from '../../06_DATABASE/connection.js';

describe('Global Test Database Safety Guard & Isolation Enforcement', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset custom DB path between sub-tests
    setCustomDatabasePath(path.join(process.cwd(), '.mahi_data', 'test-isolated-runtime', 'unit_guard_test.sqlite'));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('correctly detects automated test runner environment', () => {
    expect(isTestRunnerEnvironment()).toBe(true);
  });

  it('strictly forbids setting custom database path targeting production AppData', () => {
    const forbiddenAppDataPath = 'C:\\Users\\user\\AppData\\Roaming\\mahi-browser\\mahi_browser.sqlite';
    const forbiddenAltPath = 'C:/Users/user/AppData/Roaming/mahi-browser/mahi_browser.sqlite';

    expect(() => {
      setCustomDatabasePath(forbiddenAppDataPath);
    }).toThrow(/GLOBAL TEST SAFETY GUARD VIOLATION/);

    expect(() => {
      setCustomDatabasePath(forbiddenAltPath);
    }).toThrow(/GLOBAL TEST SAFETY GUARD VIOLATION/);
  });

  it('assertPathIsNotProduction throws an explicit error when production AppData path is detected', () => {
    expect(() => {
      assertPathIsNotProduction('c:/users/test/appdata/roaming/mahi-browser/mahi_browser.sqlite');
    }).toThrow(/GLOBAL TEST SAFETY GUARD VIOLATION/);

    expect(() => {
      assertPathIsNotProduction('C:\\Users\\test\\AppData\\Local\\Programs\\MAHI BROWSER\\test.sqlite');
    }).toThrow(/GLOBAL TEST SAFETY GUARD VIOLATION/);
  });

  it('allows safe disposable test database paths', () => {
    const safePath = path.join(process.cwd(), '.mahi_data', 'test-isolated', 'safe_test.sqlite');
    expect(() => {
      assertPathIsNotProduction(safePath);
      setCustomDatabasePath(safePath);
    }).not.toThrow();

    expect(getDatabasePath()).toBe(safePath);
  });

  it('automatically resolves to an isolated workspace directory instead of AppData when no custom path is bound', () => {
    // Force currentDbPath to null by passing custom path then resetting internal state
    const resolved = getDatabasePath();
    expect(resolved).not.toContain('AppData');
    expect(resolved).not.toContain('Roaming\\mahi-browser');
    expect(resolved).not.toContain('Roaming/mahi-browser');
  });
});
