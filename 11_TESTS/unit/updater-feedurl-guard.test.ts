import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DEFAULT_UPDATE_FEED_URL,
  sanitizeFeedUrl,
  loadUpdateConfig,
  setUpdateConfig,
  getUpdateConfig,
  resetUpdaterStateForTesting,
} from '../../07_BACKEND/services/updater-service.js';

describe('FEED URL GUARD & SANITIZATION', () => {
  let tempDir: string;
  const originalUserDataDir = process.env.MAHI_USER_DATA_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-feedurl-test-'));
    process.env.MAHI_USER_DATA_DIR = tempDir;
    resetUpdaterStateForTesting();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
    if (originalUserDataDir !== undefined) {
      process.env.MAHI_USER_DATA_DIR = originalUserDataDir;
    } else {
      delete process.env.MAHI_USER_DATA_DIR;
    }
  });

  // Case 1
  it('case 1: sanitizeFeedUrl rejects http localhost port and collapses to default', () => {
    expect(sanitizeFeedUrl('http://127.0.0.1:54346/update/')).toBe(DEFAULT_UPDATE_FEED_URL);
  });

  // Case 2
  it('case 2: sanitizeFeedUrl rejects http protocol even on allowlisted host', () => {
    expect(sanitizeFeedUrl('http://mahibrowser.com/update/')).toBe(DEFAULT_UPDATE_FEED_URL);
  });

  // Case 3
  it('case 3: sanitizeFeedUrl rejects non-allowlisted host over https', () => {
    expect(sanitizeFeedUrl('https://evil.example/update/')).toBe(DEFAULT_UPDATE_FEED_URL);
  });

  // Case 4
  it('case 4: sanitizeFeedUrl accepts https on allowlisted host', () => {
    expect(sanitizeFeedUrl('https://mahibrowser.com/update/')).toBe('https://mahibrowser.com/update/');
  });

  // Case 5
  it('case 5: loadUpdateConfig collapses tampered/stale localhost feedUrl in updater_config.json to default', () => {
    const configPath = path.join(tempDir, 'updater_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ feedUrl: 'http://127.0.0.1:54346/update/' }), 'utf8');
    const loaded = loadUpdateConfig();
    expect(loaded.feedUrl).toBe(DEFAULT_UPDATE_FEED_URL);
  });

  // Case 6
  it('case 6: config object in updater_config.json containing evil url collapses to default on loadUpdateConfig', () => {
    const configPath = path.join(tempDir, 'updater_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ feedUrl: 'https://evil.example/update/' }), 'utf8');
    const loaded = loadUpdateConfig();
    expect(loaded.feedUrl).toBe(DEFAULT_UPDATE_FEED_URL);
  });
});
