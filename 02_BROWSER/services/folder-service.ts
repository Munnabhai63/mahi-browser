import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import type { ProfileFolder } from '../../10_CONFIG/shared/types/platform.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';

interface SqliteFolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export function getFolders(workspaceId?: string): ProfileFolder[] {
  const db = getDatabase();
  let query = 'SELECT * FROM profile_folders';
  const params: string[] = [];

  if (workspaceId) {
    query += ' WHERE workspace_id = ? OR workspace_id IS NULL';
    params.push(workspaceId);
  }
  query += ' ORDER BY name ASC';

  const rows = db.prepare(query).all<SqliteFolderRow>(...params);

  return rows.map((r) => {
    // Count active profiles in this folder
    const countRow = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE folder = ? AND deleted_at IS NULL').get<{ count: number }>(r.name);
    return {
      id: r.id,
      name: r.name,
      parentId: r.parent_id || null,
      color: r.color || '#14b8a6',
      icon: r.icon || 'Folder',
      workspaceId: r.workspace_id || undefined,
      profileCount: countRow?.count || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function createFolder(name: string, parentId?: string | null, color = '#14b8a6', icon = 'Folder', workspaceId?: string): ProfileFolder {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO profile_folders (id, name, parent_id, color, icon, workspace_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), parentId || null, color, icon, workspaceId || null, now, now);

  logActivity('SYSTEM', 'SUCCESS', 'Create Folder', `Created folder "${name}"`);

  return {
    id,
    name: name.trim(),
    parentId: parentId || null,
    color,
    icon,
    workspaceId,
    profileCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateFolder(id: string, updates: { name?: string; parentId?: string | null; color?: string; icon?: string }): ProfileFolder | null {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM profile_folders WHERE id = ?').get<SqliteFolderRow>(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = updates.name !== undefined ? updates.name.trim() : existing.name;
  const parentId = updates.parentId !== undefined ? updates.parentId : existing.parent_id;
  const color = updates.color !== undefined ? updates.color : (existing.color || '#14b8a6');
  const icon = updates.icon !== undefined ? updates.icon : (existing.icon || 'Folder');

  // If name changed, rename folder reference in profiles
  if (name !== existing.name) {
    db.prepare('UPDATE profiles SET folder = ? WHERE folder = ?').run(name, existing.name);
  }

  db.prepare(`
    UPDATE profile_folders
    SET name = ?, parent_id = ?, color = ?, icon = ?, updated_at = ?
    WHERE id = ?
  `).run(name, parentId, color, icon, now, id);

  logActivity('SYSTEM', 'INFO', 'Update Folder', `Updated folder "${name}"`);

  return {
    id,
    name,
    parentId,
    color,
    icon,
    workspaceId: existing.workspace_id || undefined,
    createdAt: existing.created_at,
    updatedAt: now,
  };
}

export function deleteFolder(id: string, targetFolderName = 'General'): boolean {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM profile_folders WHERE id = ?').get<SqliteFolderRow>(id);
  if (!existing) return false;

  // Move existing profiles to target folder
  db.prepare('UPDATE profiles SET folder = ? WHERE folder = ?').run(targetFolderName, existing.name);

  // Re-parent subfolders
  db.prepare('UPDATE profile_folders SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, id);

  db.prepare('DELETE FROM profile_folders WHERE id = ?').run(id);

  logActivity('SYSTEM', 'WARNING', 'Delete Folder', `Deleted folder "${existing.name}" and moved profiles to "${targetFolderName}"`);
  return true;
}
