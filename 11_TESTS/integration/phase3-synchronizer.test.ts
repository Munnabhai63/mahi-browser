import { describe, it, expect, beforeEach } from 'vitest';
import { synchronizerHub, SyncAction } from '../../09_AUTOMATION/sync-hub.js';

describe('Phase 3: Multi-Window Action Synchronizer Hub', () => {
  beforeEach(() => {
    synchronizerHub.stopSync();
  });

  it('should manage synchronizer state transitions correctly', () => {
    expect(synchronizerHub.getState().enabled).toBe(false);

    const started = synchronizerHub.startSync('master-p1', ['p1', 'p2', 'p3']);
    expect(started.enabled).toBe(true);
    expect(started.masterProfileId).toBe('master-p1');
    expect(started.activeProfiles).toEqual(['p1', 'p2', 'p3']);

    const stopped = synchronizerHub.stopSync();
    expect(stopped.enabled).toBe(false);
    expect(stopped.masterProfileId).toBeNull();
    expect(stopped.activeProfiles).toEqual([]);
  });

  it('should broadcast clicks and typing actions to active mirror subscribers', () => {
    synchronizerHub.startSync('master-p1');

    const receivedActions: string[] = [];
    const mockRes: any = {
      writeHead: () => {},
      write: (chunk: string) => {
        receivedActions.push(chunk);
      },
      on: () => {},
    };

    // Register mirror client for Profile 2
    synchronizerHub.registerClient('profile-2', mockRes);

    // Broadcast a click from Master (Profile 1)
    const clickAction: SyncAction = {
      type: 'CLICK',
      payload: { xRatio: 0.5, yRatio: 0.3, button: 0 },
      timestamp: Date.now(),
    };

    synchronizerHub.broadcastAction('master-p1', clickAction);

    expect(receivedActions.length).toBeGreaterThanOrEqual(2); // 1 connect + 1 click
    const lastMsg = receivedActions[receivedActions.length - 1];
    expect(lastMsg).toContain('"type":"CLICK"');
    expect(lastMsg).toContain('"xRatio":0.5');
  });

  it('should not echo actions back to the sender window', () => {
    synchronizerHub.startSync();

    let echoCount = 0;
    const mockSenderRes: any = {
      writeHead: () => {},
      write: (chunk: string) => {
        if (chunk.includes('CLICK')) echoCount++;
      },
      on: () => {},
    };

    synchronizerHub.registerClient('sender-p1', mockSenderRes);

    synchronizerHub.broadcastAction('sender-p1', {
      type: 'CLICK',
      payload: { xRatio: 0.1, yRatio: 0.1 },
      timestamp: Date.now(),
    });

    expect(echoCount).toBe(0);
  });

  it('should generate background.js service worker with unrestricted network permissions', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const { ensureProfileStealthExtension } = await import('../../02_BROWSER/launcher.js');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-ext-test-'));
    const extDir = ensureProfileStealthExtension(tempDir, 'sync-prof-1', 'Sync Profile');

    expect(fs.existsSync(path.join(extDir, 'background.js'))).toBe(true);
    expect(fs.existsSync(path.join(extDir, 'content.js'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.permissions).toContain('tabs');

    const bgCode = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');
    expect(bgCode).toContain('connectSSE');
    expect(bgCode).toContain('chrome.tabs.sendMessage');

    fs.rmSync(tempDir, { recursive: true, force: true });


  });
});

