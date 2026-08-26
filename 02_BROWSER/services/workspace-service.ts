import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  Workspace,
  TeamMember,
  MemberRole,
  CreateWorkspaceDTO,
  CreateMemberDTO,
  WorkspaceBundleExportOptions,
} from '../../10_CONFIG/shared/types/workspace.js';
import { getProfiles, createProfile, getProfileById } from './profile-service.js';
import { exportProfileToArchive, importProfileFromArchive } from './archive-service.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';

let activeWorkspaceId: string | null = null;

export function ensureDefaultWorkspace(): Workspace {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM workspaces WHERE is_default = 1').get() as {
    id: string;
    name: string;
    description: string;
    color: string;
    is_default: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (existing) {
    if (!activeWorkspaceId) activeWorkspaceId = existing.id;
    const memberCount = (db.prepare('SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ?').get(existing.id) as any)?.count || 0;
    const profileCount = (db.prepare('SELECT COUNT(*) as count FROM profile_workspaces WHERE workspace_id = ?').get(existing.id) as any)?.count || 0;
    return {
      id: existing.id,
      name: existing.name,
      description: existing.description,
      color: existing.color,
      isDefault: Boolean(existing.is_default),
      memberCount,
      profileCount,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workspaces (id, name, description, color, is_default, created_at, updated_at)
    VALUES (?, 'Personal Workspace', 'Default primary workspace', '#14b8a6', 1, ?, ?)
  `).run(id, now, now);

  // Add default Admin owner member
  const memberId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, name, email, role, status, assigned_profiles_json, created_at)
    VALUES (?, ?, 'Workspace Owner', 'owner@mahibrowser.local', 'ADMIN', 'ACTIVE', '[]', ?)
  `).run(memberId, id, now);

  activeWorkspaceId = id;

  return {
    id,
    name: 'Personal Workspace',
    description: 'Default primary workspace',
    color: '#14b8a6',
    isDefault: true,
    memberCount: 1,
    profileCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getWorkspaces(): Workspace[] {
  ensureDefaultWorkspace();
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM workspaces ORDER BY is_default DESC, name ASC').all() as {
    id: string;
    name: string;
    description: string;
    color: string;
    is_default: number;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((r) => {
    const memberCount = (db.prepare('SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ?').get(r.id) as any)?.count || 0;
    const profileCount = (db.prepare('SELECT COUNT(*) as count FROM profile_workspaces WHERE workspace_id = ?').get(r.id) as any)?.count || 0;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      isDefault: Boolean(r.is_default),
      memberCount,
      profileCount,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function getWorkspaceById(id: string): Workspace | null {
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as {
    id: string;
    name: string;
    description: string;
    color: string;
    is_default: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!r) return null;

  const memberCount = (db.prepare('SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ?').get(r.id) as any)?.count || 0;
  const profileCount = (db.prepare('SELECT COUNT(*) as count FROM profile_workspaces WHERE workspace_id = ?').get(r.id) as any)?.count || 0;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    isDefault: Boolean(r.is_default),
    memberCount,
    profileCount,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createWorkspace(dto: CreateWorkspaceDTO): Workspace {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO workspaces (id, name, description, color, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, dto.name.trim(), dto.description?.trim() || '', dto.color || '#14b8a6', now, now);

  // Add default Admin member
  const memberId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, name, email, role, status, assigned_profiles_json, created_at)
    VALUES (?, ?, 'Admin', 'admin@mahibrowser.local', 'ADMIN', 'ACTIVE', '[]', ?)
  `).run(memberId, id, now);

  logActivity('SETTINGS', 'SUCCESS', 'Create Workspace', `Created workspace "${dto.name}"`);
  return getWorkspaceById(id)!;
}

export function updateWorkspace(id: string, dto: Partial<CreateWorkspaceDTO>): Workspace {
  const db = getDatabase();
  const existing = getWorkspaceById(id);
  if (!existing) throw new Error(`Workspace ${id} not found`);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE workspaces
    SET name = ?, description = ?, color = ?, updated_at = ?
    WHERE id = ?
  `).run(
    dto.name ? dto.name.trim() : existing.name,
    dto.description !== undefined ? dto.description.trim() : existing.description || '',
    dto.color || existing.color || '#14b8a6',
    now,
    id
  );

  return getWorkspaceById(id)!;
}

export function deleteWorkspace(id: string): boolean {
  const db = getDatabase();
  const existing = getWorkspaceById(id);
  if (!existing) return false;
  if (existing.isDefault) throw new Error('Cannot delete default personal workspace');

  db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').run(id);
  db.prepare('DELETE FROM profile_workspaces WHERE workspace_id = ?').run(id);
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);

  if (activeWorkspaceId === id) {
    const defaultWs = ensureDefaultWorkspace();
    activeWorkspaceId = defaultWs.id;
  }

  logActivity('SETTINGS', 'WARNING', 'Delete Workspace', `Deleted workspace "${existing.name}"`);
  return true;
}

export function getActiveWorkspaceId(): string {
  if (!activeWorkspaceId) {
    activeWorkspaceId = ensureDefaultWorkspace().id;
  }
  return activeWorkspaceId;
}

export function setActiveWorkspaceId(id: string): boolean {
  const ws = getWorkspaceById(id);
  if (!ws) return false;
  activeWorkspaceId = ws.id;
  logActivity('SETTINGS', 'INFO', 'Switch Workspace', `Switched active workspace to "${ws.name}"`);
  return true;
}

export function getWorkspaceMembers(workspaceId: string): TeamMember[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY role ASC, name ASC').all(workspaceId) as {
    id: string;
    workspace_id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    assigned_profiles_json: string;
    created_at: string;
  }[];

  return rows.map((r) => {
    let assignedProfileIds: string[] = [];
    try {
      assignedProfileIds = JSON.parse(r.assigned_profiles_json || '[]');
    } catch {}

    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      email: r.email,
      role: r.role as MemberRole,
      status: r.status as any,
      assignedProfileIds,
      createdAt: r.created_at,
    };
  });
}

export function addWorkspaceMember(dto: CreateMemberDTO): TeamMember {
  const db = getDatabase();
  const ws = getWorkspaceById(dto.workspaceId);
  if (!ws) throw new Error(`Workspace ${dto.workspaceId} not found`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO workspace_members (id, workspace_id, name, email, role, status, assigned_profiles_json, created_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', '[]', ?)
  `).run(id, dto.workspaceId, dto.name.trim(), dto.email.trim(), dto.role, now);

  logActivity('SETTINGS', 'INFO', 'Add Member', `Added member "${dto.name}" (${dto.role}) to workspace "${ws.name}"`);

  return {
    id,
    workspaceId: dto.workspaceId,
    name: dto.name.trim(),
    email: dto.email.trim(),
    role: dto.role,
    status: 'ACTIVE',
    assignedProfileIds: [],
    createdAt: now,
  };
}

export function updateMemberRole(memberId: string, role: MemberRole): boolean {
  const db = getDatabase();
  db.prepare('UPDATE workspace_members SET role = ? WHERE id = ?').run(role, memberId);
  return true;
}

export function deleteWorkspaceMember(memberId: string): boolean {
  const db = getDatabase();
  db.prepare('DELETE FROM workspace_members WHERE id = ?').run(memberId);
  db.prepare('UPDATE profile_workspaces SET assigned_member_id = NULL WHERE assigned_member_id = ?').run(memberId);
  return true;
}

export function assignProfileToMember(profileId: string, workspaceId: string, memberId: string | null): boolean {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO profile_workspaces (profile_id, workspace_id, assigned_member_id)
    VALUES (?, ?, ?)
  `).run(profileId, workspaceId, memberId || null);

  // Update member assigned_profiles_json
  if (memberId) {
    const member = db.prepare('SELECT assigned_profiles_json FROM workspace_members WHERE id = ?').get(memberId) as { assigned_profiles_json: string } | undefined;
    if (member) {
      let ids: string[] = [];
      try { ids = JSON.parse(member.assigned_profiles_json || '[]'); } catch {}
      if (!ids.includes(profileId)) ids.push(profileId);
      db.prepare('UPDATE workspace_members SET assigned_profiles_json = ? WHERE id = ?').run(JSON.stringify(ids), memberId);
    }
  }

  return true;
}

export async function exportWorkspaceBundle(options: WorkspaceBundleExportOptions): Promise<string> {
  const ws = getWorkspaceById(options.workspaceId);
  if (!ws) throw new Error(`Workspace ${options.workspaceId} not found`);

  const db = getDatabase();
  const mappingRows = db.prepare('SELECT profile_id FROM profile_workspaces WHERE workspace_id = ?').all(options.workspaceId) as { profile_id: string }[];
  
  let targetProfileIds = mappingRows.map((m) => m.profile_id);
  if (targetProfileIds.length === 0) {
    // If no explicit mapping, export top profiles in workspace
    targetProfileIds = getProfiles().map((p) => p.id);
  }

  const bundleData = {
    format: 'MAHI_WORKSPACE_BUNDLE_V1',
    workspace: {
      name: ws.name,
      description: ws.description,
      color: ws.color,
    },
    members: getWorkspaceMembers(ws.id),
    profiles: targetProfileIds.map((id) => getProfileById(id)).filter(Boolean),
    exportedAt: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(bundleData, null, 2);
  return jsonStr;
}

export async function importWorkspaceBundle(bundleJson: string, targetWorkspaceId?: string): Promise<{ importedProfilesCount: number; workspaceId: string }> {
  const data = JSON.parse(bundleJson);
  if (!data.format || !data.format.startsWith('MAHI_WORKSPACE_BUNDLE')) {
    throw new Error('Invalid workspace bundle format');
  }

  let wsId = targetWorkspaceId;
  if (!wsId) {
    const ws = createWorkspace({
      name: data.workspace?.name ? `${data.workspace.name} (Imported)` : 'Imported Workspace',
      description: data.workspace?.description || '',
      color: data.workspace?.color || '#14b8a6',
    });
    wsId = ws.id;
  }

  let count = 0;
  if (Array.isArray(data.profiles)) {
    for (const p of data.profiles) {
      if (p && p.name) {
        const created = createProfile({
          name: p.name,
          folder: p.folder || 'Imported',
          settings: p.settings,
          tags: p.tags,
        });
        assignProfileToMember(created.id, wsId, null);
        count++;
      }
    }
  }

  return {
    importedProfilesCount: count,
    workspaceId: wsId,
  };
}
