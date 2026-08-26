import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserEngine } from '../10_CONFIG/shared/types/profile.js';

export interface DetectedBrowser {
  name: string;
  engine: BrowserEngine;
  path: string;
  version?: string;
  isDefault?: boolean;
}

export function detectSystemBrowsers(): DetectedBrowser[] {
  const platform = os.platform();
  const detected: DetectedBrowser[] = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const chromeCandidates = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];

    const edgeCandidates = [
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    const chromiumCandidates = [
      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
    ];

    for (const p of chromeCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Google Chrome', engine: 'chrome', path: p });
        break;
      }
    }

    for (const p of edgeCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Microsoft Edge', engine: 'edge', path: p });
        break;
      }
    }

    for (const p of chromiumCandidates) {
      if (fs.existsSync(p)) {
        detected.push({ name: 'Chromium', engine: 'chromium', path: p });
        break;
      }
    }
  } else if (platform === 'darwin') {
    const macCandidates = [
      { name: 'Google Chrome', engine: 'chrome' as BrowserEngine, path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Microsoft Edge', engine: 'edge' as BrowserEngine, path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Chromium', engine: 'chromium' as BrowserEngine, path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
    ];
    for (const c of macCandidates) {
      if (fs.existsSync(c.path)) {
        detected.push(c);
      }
    }
  } else {
    // Linux
    const linuxCandidates = [
      { name: 'Google Chrome', engine: 'chrome' as BrowserEngine, path: '/usr/bin/google-chrome' },
      { name: 'Google Chrome Stable', engine: 'chrome' as BrowserEngine, path: '/usr/bin/google-chrome-stable' },
      { name: 'Chromium Browser', engine: 'chromium' as BrowserEngine, path: '/usr/bin/chromium-browser' },
      { name: 'Chromium', engine: 'chromium' as BrowserEngine, path: '/usr/bin/chromium' },
      { name: 'Microsoft Edge', engine: 'edge' as BrowserEngine, path: '/usr/bin/microsoft-edge' },
    ];
    for (const c of linuxCandidates) {
      if (fs.existsSync(c.path)) {
        detected.push(c);
        break;
      }
    }
  }

  return detected;
}

export function resolveExecutablePath(engine: BrowserEngine, customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const detected = detectSystemBrowsers();
  const match = detected.find((b) => b.engine === engine) || detected[0];
  if (match) {
    return match.path;
  }

  // Fallback defaults
  if (os.platform() === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return '/usr/bin/google-chrome';
}
