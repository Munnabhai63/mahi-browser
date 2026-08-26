import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  ensureDefaultWorkspace,
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateMemberRole,
  deleteWorkspaceMember,
  assignProfileToMember,
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from '../../02_BROWSER/services/workspace-service.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 15: Team Workspaces, Member Roles & Bundle Sharing Suite', () => {
  let tempDir: string;
  let testProfileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase15-'));
    const testDbPath = path.join(tempDir, 'test_phase15.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Workspace Shared Profile',
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

  it('should initialize default workspace with owner member', () => {
    const defWs = ensureDefaultWorkspace();
    expect(defWs).toBeDefined();
    expect(defWs.isDefault).toBe(true);
    expect(defWs.name).toBe('Personal Workspace');

    const members = getWorkspaceMembers(defWs.id);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(members[0].role).toBe('ADMIN');
  });

  it('should create custom workspace and switch active workspace', () => {
    const ws = createWorkspace({
      name: 'Crypto Agency Workspace',
      description: 'Agency multi-user workspace',
      color: '#6366f1',
    });

    expect(ws).toBeDefined();
    expect(ws.name).toBe('Crypto Agency Workspace');
    expect(ws.isDefault).toBe(false);

    const switched = setActiveWorkspaceId(ws.id);
    expect(switched).toBe(true);
    expect(getActiveWorkspaceId()).toBe(ws.id);

    const all = getWorkspaces();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('should invite, update roles, and manage team members', () => {
    const activeWsId = getActiveWorkspaceId();
    const newMember = addWorkspaceMember({
      workspaceId: activeWsId,
      name: 'Alex Rivera',
      email: 'alex@agency.com',
      role: 'EDITOR',
    });

    expect(newMember).toBeDefined();
    expect(newMember.name).toBe('Alex Rivera');
    expect(newMember.role).toBe('EDITOR');

    // Update role
    const updated = updateMemberRole(newMember.id, 'ADMIN');
    expect(updated).toBe(true);

    const members = getWorkspaceMembers(activeWsId);
    const found = members.find((m) => m.id === newMember.id);
    expect(found?.role).toBe('ADMIN');

    // Assign Profile
    const assigned = assignProfileToMember(testProfileId, activeWsId, newMember.id);
    expect(assigned).toBe(true);

    // Delete Member
    const deleted = deleteWorkspaceMember(newMember.id);
    expect(deleted).toBe(true);
  });

  it('should export and import encrypted workspace bundle', async () => {
    const activeWsId = getActiveWorkspaceId();
    const bundleJson = await exportWorkspaceBundle({
      workspaceId: activeWsId,
      includeCookies: true,
      includeExtensions: true,
    });

    expect(bundleJson).toBeDefined();
    expect(bundleJson).toContain('MAHI_WORKSPACE_BUNDLE_V1');

    const importRes = await importWorkspaceBundle(bundleJson);
    expect(importRes.importedProfilesCount).toBeGreaterThanOrEqual(1);
    expect(importRes.workspaceId).toBeDefined();
  });
});
