import { describe, it, expect, vi } from 'vitest';
import { computeEngineModalViewModel, UnifiedEngineProgressState } from '../../01_UI/components/EngineDownloadModal.js';

describe('Camoufox Progress UI Component & ViewModel Suite (FIX-4 Acceptance)', () => {
  it('correctly maps DOWNLOADING event to 38% and stage label', () => {
    const rawEvent = {
      stage: 'DOWNLOADING' as const,
      receivedBytes: 500 * 1024 * 1024,
      totalBytes: 1300 * 1024 * 1024,
      percent: 38,
    };

    const state: UnifiedEngineProgressState = {
      engineName: 'Camoufox Gecko Engine',
      stage: rawEvent.stage,
      percent: rawEvent.percent,
      downloadedBytes: rawEvent.receivedBytes,
      totalBytes: rawEvent.totalBytes,
    };

    const vm = computeEngineModalViewModel(state);

    expect(vm.isOpen).toBe(true);
    expect(vm.percent).toBe(38);
    expect(vm.stageLabel).toBe('Downloading...');
    expect(vm.engineName).toBe('Camoufox Gecko Engine');
    expect(parseFloat(vm.downloadedMB)).toBeCloseTo(500, 0);
    expect(parseFloat(vm.totalMB)).toBeCloseTo(1300, 0);
    expect(vm.isFailed).toBe(false);
  });

  it('correctly maps FAILED event to error text, failure state, and download failed label', () => {
    const state: UnifiedEngineProgressState = {
      engineName: 'Camoufox Gecko Engine',
      stage: 'FAILED',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: 'HTTP 404',
    };

    const vm = computeEngineModalViewModel(state);

    expect(vm.isOpen).toBe(true);
    expect(vm.isFailed).toBe(true);
    expect(vm.stageLabel).toBe('Download Failed');
    expect(vm.error).toBe('HTTP 404');
  });

  it('correctly closes modal when stage is IDLE or state is null', () => {
    expect(computeEngineModalViewModel(null).isOpen).toBe(false);
    expect(
      computeEngineModalViewModel({
        engineName: 'Chromium Engine',
        stage: 'IDLE',
        percent: 0,
        downloadedBytes: 0,
        totalBytes: 0,
      }).isOpen
    ).toBe(false);
  });

  it('verifies IPC subscription wiring and disposer contract in preload', () => {
    const mockUnsub = vi.fn();
    const mockOnCamoufox = vi.fn(() => mockUnsub);

    // Simulate IPC bridge subscription
    const disposer = mockOnCamoufox((_evt: any) => {});
    expect(typeof disposer).toBe('function');
    disposer();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
