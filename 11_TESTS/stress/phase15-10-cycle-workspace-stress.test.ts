import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createWorkspace,
  getWorkspaces,
  setActiveWorkspaceId,
  getActiveWorkspaceId,
  addWorkspaceMember,
  getWorkspaceMembers,
  updateMemberRole,
  assignProfileToMember,
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from '../../02_BROWSER/services/workspace-service.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 15: 10-Cycle Workspace & Team Collaboration Stress Suite', () => {
  let tempDir: string;
  let testProfileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase15-stress-'));
    const testDbPath = path.join(tempDir, 'stress_phase15.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Stress Shared Profile',
      settings: getDefaultProfileSettings(),
    });
    testProfileId = prof.id;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  for (let cycle = 1; cycle <= 10; cycle++) {
    it(`Cycle ${cycle}/10: Workspace isolation, member role life cycle, and bundle export`, async () => {
      // 1. Create Workspace
      const ws = createWorkspace({
        name: `Stress Workspace ${cycle}`,
        description: `Description for cycle ${cycle}`,
      });
      expect(ws.id).toBeDefined();

      // 2. Switch Active
      setActiveWorkspaceId(ws.id);
      expect(getActiveWorkspaceId()).toBe(ws.id);

      // 3. Add Members
      const member = addWorkspaceMember({
        workspaceId: ws.id,
        name: `Member ${cycle}`,
        email: `member${cycle}@agency.com`,
        role: cycle % 2 === 0 ? 'ADMIN' : 'EDITOR',
      });
      expect(member.id).toBeDefined();

      // 4. Update Role
      updateMemberRole(member.id, 'VIEWER');
      const members = getWorkspaceMembers(ws.id);
      const updated = members.find((m) => m.id === member.id);
      expect(updated?.role).toBe('VIEWER');

      // 5. Assign Profile
      assignProfileToMember(testProfileId, ws.id, member.id);

      // 6. Export and Import Bundle
      const bundle = await exportWorkspaceBundle({
        workspaceId: ws.id,
        includeCookies: true,
        includeExtensions: true,
      });
      expect(bundle).toContain('MAHI_WORKSPACE_BUNDLE_V1');

      const imported = await importWorkspaceBundle(bundle);
      expect(imported.importedProfilesCount).toBeGreaterThanOrEqual(1);
    });
  }
});
