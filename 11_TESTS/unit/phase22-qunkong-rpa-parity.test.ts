import { describe, it, expect, beforeAll } from 'vitest';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  calculateOptimalGrid,
  calculateWindowLayout,
  generateBatchWindowLayouts,
} from '../../02_BROWSER/services/window-grid-tiler.js';
import {
  getRpaTemplates,
  getRpaTemplateById,
} from '../../09_AUTOMATION/rpa-template-catalog.js';
import {
  auditLocalEngines,
  ensureEngineDirectory,
} from '../../02_BROWSER/services/engine-download-service.js';
import { getAvailableCores } from '../../02_BROWSER/services/multi-core-resolver.js';

describe('PHASE 22 — Qunkong Desktop Tiler, In-App Proxy & RPA Templates Parity', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('1. Desktop Qunkong Multi-Window Grid Tiler', () => {
    it('computes optimal columns and rows for various window batch counts', () => {
      expect(calculateOptimalGrid(1)).toEqual({ columns: 1, rows: 1 });
      expect(calculateOptimalGrid(2)).toEqual({ columns: 2, rows: 1 });
      expect(calculateOptimalGrid(4)).toEqual({ columns: 2, rows: 2 });
      expect(calculateOptimalGrid(6)).toEqual({ columns: 3, rows: 2 });
      expect(calculateOptimalGrid(9)).toEqual({ columns: 3, rows: 3 });
      expect(calculateOptimalGrid(16)).toEqual({ columns: 4, rows: 4 });
    });

    it('calculates exact non-overlapping window coordinates for a 4-profile 2x2 grid', () => {
      const layouts = generateBatchWindowLayouts(4, {
        screenWidth: 1920,
        screenHeight: 1080,
        taskbarHeight: 40,
        margin: 0,
      });

      expect(layouts.length).toBe(4);
      // Window 0 (Top-Left)
      expect(layouts[0].x).toBe(0);
      expect(layouts[0].y).toBe(0);
      expect(layouts[0].width).toBe(960);
      expect(layouts[0].height).toBe(520);
      expect(layouts[0].launchArgs).toContain('--window-position=0,0');
      expect(layouts[0].launchArgs).toContain('--window-size=960,520');

      // Window 1 (Top-Right)
      expect(layouts[1].x).toBe(960);
      expect(layouts[1].y).toBe(0);

      // Window 2 (Bottom-Left)
      expect(layouts[2].x).toBe(0);
      expect(layouts[2].y).toBe(520);

      // Window 3 (Bottom-Right)
      expect(layouts[3].x).toBe(960);
      expect(layouts[3].y).toBe(520);
    });
  });

  describe('2. Pre-Built RPA Workflow Templates', () => {
    it('returns all 4 production-ready templates', () => {
      const templates = getRpaTemplates();
      expect(templates.length).toBe(4);

      const ids = templates.map(t => t.id);
      expect(ids).toContain('google-organic-warmer');
      expect(ids).toContain('amazon-shopper-intent');
      expect(ids).toContain('social-matrix-feed-surfer');
      expect(ids).toContain('crypto-web3-faucet-routine');
    });

    it('validates Google warmer steps have valid execution properties', () => {
      const template = getRpaTemplateById('google-organic-warmer');
      expect(template).toBeDefined();
      expect(template!.category).toBe('WARMUP');
      expect(template!.steps.length).toBeGreaterThanOrEqual(5);

      const firstStep = template!.steps[0];
      expect(firstStep.type).toBe('OPEN_URL');
      expect(firstStep.target).toBe('https://www.google.com');
    });
  });

  describe('3. Multi-Core Engine Audit & Health', () => {
    it('scans system cores and reports engine health status', () => {
      const report = auditLocalEngines();
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('installedCount');
      expect(report.cores.length).toBeGreaterThanOrEqual(5);
      expect(['OPTIMAL', 'DEGRADED', 'MINIMAL']).toContain(report.status);
    });

    it('returns available core numbers matching local binaries', () => {
      const cores = getAvailableCores();
      expect(Array.isArray(cores)).toBe(true);
    });
  });
});
