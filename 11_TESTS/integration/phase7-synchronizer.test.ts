import { describe, it, expect, beforeAll } from 'vitest';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { synchronizerHub } from '../../09_AUTOMATION/sync-hub.js';

describe('Phase 7: Multi-Window Action Synchronizer Engine', () => {
  beforeAll(async () => {
    await initSqlEngine();
  });

  it('should start synchronizer with designated master profile and slave targets', () => {
    const masterId = 'master-profile-001';
    const slaves = ['slave-profile-002', 'slave-profile-003'];

    const state = synchronizerHub.startSync(masterId, slaves, {
      syncClicks: true,
      syncTyping: true,
      syncScroll: true,
      syncNavigation: true,
      humanDelayMinMs: 0,
      humanDelayMaxMs: 0,
    });

    expect(state.enabled).toBe(true);
    expect(state.masterProfileId).toBe(masterId);
    expect(state.activeProfiles).toEqual(slaves);
    expect(state.config.syncClicks).toBe(true);
    expect(state.config.humanDelayMinMs).toBe(0);
    expect(state.startedAt).toBeDefined();
  });

  it('should update synchronizer feature toggles on the fly', () => {
    const updated = synchronizerHub.updateConfig({
      syncClicks: false,
      humanDelayMaxMs: 200,
    });

    expect(updated.config.syncClicks).toBe(false);
    expect(updated.config.syncTyping).toBe(true);
    expect(updated.config.humanDelayMaxMs).toBe(200);

    const current = synchronizerHub.getState();
    expect(current.config.syncClicks).toBe(false);
  });

  it('should deliver broadcasted actions to multiple connected tabs per profile', () => {
    synchronizerHub.updateConfig({ syncClicks: true, syncTyping: true });

    const receivedTab1: string[] = [];
    const receivedTab2: string[] = [];

    // Mock HTTP response objects for 2 tabs
    const mockRes1 = new EventEmitter() as any;
    mockRes1.writeHead = () => {};
    mockRes1.write = (chunk: string) => receivedTab1.push(chunk);

    const mockRes2 = new EventEmitter() as any;
    mockRes2.writeHead = () => {};
    mockRes2.write = (chunk: string) => receivedTab2.push(chunk);

    // Register 2 tabs for slave-profile-002
    synchronizerHub.registerClient('slave-profile-002', mockRes1);
    synchronizerHub.registerClient('slave-profile-002', mockRes2);

    expect(synchronizerHub.isClientConnected('slave-profile-002')).toBe(true);

    // Broadcast click from master
    synchronizerHub.broadcastAction('master-profile-001', {
      type: 'CLICK',
      payload: { xRatio: 0.25, yRatio: 0.75, button: 0 },
      timestamp: Date.now(),
    });

    // Both tabs should receive the click action
    expect(receivedTab1.some((msg) => msg.includes('"type":"CLICK"'))).toBe(true);
    expect(receivedTab2.some((msg) => msg.includes('"type":"CLICK"'))).toBe(true);

    // Clean up connections
    mockRes1.emit('close');
    mockRes2.emit('close');
  });

  it('should accept and route actions from master profile and increment mirrored action count', () => {
    const initialCount = synchronizerHub.getState().mirroredActionCount;

    synchronizerHub.broadcastAction('master-profile-001', {
      type: 'CLICK',
      payload: { xRatio: 0.5, yRatio: 0.5, button: 0 },
      timestamp: Date.now(),
    });

    synchronizerHub.broadcastAction('master-profile-001', {
      type: 'TYPE',
      payload: { value: 'MAHI Browser Test Query', name: 'q' },
      timestamp: Date.now(),
    });

    expect(synchronizerHub.getState().mirroredActionCount).toBe(initialCount + 2);
  });

  it('should reject unauthorized actions from non-master profiles', () => {
    const countBefore = synchronizerHub.getState().mirroredActionCount;

    // Send action from a rogue/slave profile
    synchronizerHub.broadcastAction('rogue-slave-profile', {
      type: 'CLICK',
      payload: { xRatio: 0.1, yRatio: 0.1 },
      timestamp: Date.now(),
    });

    // Count should not increment because only master is accepted
    expect(synchronizerHub.getState().mirroredActionCount).toBe(countBefore);
  });

  it('should stop synchronizer and reset state cleanly', () => {
    const stoppedState = synchronizerHub.stopSync();

    expect(stoppedState.enabled).toBe(false);
    expect(stoppedState.masterProfileId).toBeNull();
    expect(stoppedState.activeProfiles.length).toBe(0);

    const current = synchronizerHub.getState();
    expect(current.enabled).toBe(false);
  });
});
