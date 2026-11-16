import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fallbackMahiAPI } from '../../01_UI/api-fallback.js';

describe('MahiBrowserAPI Interface Parity Test Suite (FIX-1 Regression)', () => {
  it('guarantees fallbackMahiAPI implements every member of MahiBrowserAPI in ipc.ts', () => {
    const ipcPath = path.resolve(process.cwd(), '10_CONFIG/shared/types/ipc.ts');
    const content = fs.readFileSync(ipcPath, 'utf8');

    // Extract interface MahiBrowserAPI { ... }
    const match = content.match(/export\s+interface\s+MahiBrowserAPI\s*\{([\s\S]*?)\n\}/);
    expect(match).toBeDefined();
    const interfaceBody = match![1];

    // Find all member names: lines like "  methodName: (...)" or "  propName: type;"
    const memberRegex = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
    const members: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = memberRegex.exec(interfaceBody)) !== null) {
      members.push(m[1]);
    }

    expect(members.length).toBeGreaterThan(50);

    const missingMembers: string[] = [];
    for (const member of members) {
      if (!(member in fallbackMahiAPI)) {
        missingMembers.push(member);
      }
    }

    expect(missingMembers, `Missing members in fallbackMahiAPI: ${missingMembers.join(', ')}`).toEqual([]);
  });

  it('guarantees onCamoufoxDownloadProgress is present and returns a disposer function', () => {
    expect(typeof fallbackMahiAPI.onCamoufoxDownloadProgress).toBe('function');
    const disposer = fallbackMahiAPI.onCamoufoxDownloadProgress(() => {});
    expect(typeof disposer).toBe('function');
    expect(() => disposer()).not.toThrow();
  });
});
