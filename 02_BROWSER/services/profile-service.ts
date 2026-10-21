import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  Profile,
  ProfileSettings,
  CreateProfileDTO,
  UpdateProfileDTO,
  CloneProfileDTO,
  ProfileFilterOptions,
  ProfileStatus,
} from '../../10_CONFIG/shared/types/profile.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { getAllProfileStats, getProfileStats, deleteProfileStats } from '../../07_BACKEND/services/stats-service.js';

export function getProfilesDirectory(): string {
  const userDataDir = app ? app.getPath('userData') : path.join(process.cwd(), '.mahi_data');
  const profilesDir = path.join(userDataDir, 'profiles');
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  return profilesDir;
}

export function getProfileStoragePath(profileId: string): string {
  const base = getProfilesDirectory();
  const dir = path.join(base, profileId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getProfiles(filter: ProfileFilterOptions = {}): Profile[] {
  const db = getDatabase();
  let query = 'SELECT p.*, ps.settings_json FROM profiles p LEFT JOIN profile_settings ps ON p.id = ps.profile_id WHERE (p.deleted_at IS NULL)';
  const params: unknown[] = [];

  // --- SECURITY: Profile Isolation by owner_id ---
  // If ownerId is provided, only return profiles owned by that user.
  // SYSTEM_OWNER profiles are accessible ONLY to machine-level / guest sessions.
  if (filter.ownerId) {
    if (filter.ownerId === 'SYSTEM_OWNER' || filter.ownerId === 'LOCAL_CLIENT') {
      query += " AND (p.owner_id = 'SYSTEM_OWNER' OR p.owner_id = 'LOCAL_CLIENT' OR p.owner_id IS NULL)";
    } else {
      query += " AND p.owner_id = ?";
      params.push(filter.ownerId);
    }
  }

  if (filter.status && filter.status !== 'ALL') {
    query += ' AND p.status = ?';
    params.push(filter.status);
  }

  if (filter.folder) {
    query += ' AND p.folder = ?';
    params.push(filter.folder);
  }

  if (filter.pinnedOnly) {
    query += ' AND p.pinned = 1';
  }

  if (filter.searchQuery) {
    query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.notes LIKE ?)';
    const term = `%${filter.searchQuery}%`;
    params.push(term, term, term);
  }

  // Sorting
  const sortBy = filter.sortBy || 'createdAt';
  const dir = (filter.sortDirection || 'desc').toUpperCase();
  const columnMap: Record<string, string> = {
    name: 'p.name',
    createdAt: 'p.created_at',
    lastUsedAt: 'p.last_used_at',
    status: 'p.status',
  };
  const col = columnMap[sortBy] || 'p.created_at';
  query += ` ORDER BY p.pinned DESC, ${col} ${dir}`;

  const rows = db.prepare(query).all(...params) as {
    id: string;
    name: string;
    description: string;
    folder: string;
    notes: string;
    status: string;
    storage_path: string;
    pinned: number;
    last_used_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    settings_json: string | null;
  }[];

  // Fetch tags for all profiles
  const tagRows = db.prepare('SELECT profile_id, tag_name FROM profile_tags').all() as {
    profile_id: string;
    tag_name: string;
  }[];
  const tagMap = new Map<string, string[]>();
  for (const t of tagRows) {
    if (!tagMap.has(t.profile_id)) tagMap.set(t.profile_id, []);
    tagMap.get(t.profile_id)!.push(t.tag_name);
  }

  // Fetch persistent stats for all profiles (single query, avoids N+1)
  const statsMap = getAllProfileStats();

  const profiles: Profile[] = [];
  for (const r of rows) {
    const tags = tagMap.get(r.id) || [];
    if (filter.tag && !tags.includes(filter.tag)) {
      continue;
    }

    let settings: ProfileSettings = getDefaultProfileSettings();
    if (r.settings_json) {
      try {
        settings = { ...settings, ...JSON.parse(r.settings_json) };
      } catch {
        // use default
      }
    }

    const profileStats = statsMap.get(r.id);

    profiles.push({
      id: r.id,
      name: r.name,
      description: r.description,
      folder: r.folder,
      tags,
      notes: r.notes,
      status: r.status as ProfileStatus,
      storagePath: r.storage_path,
      pinned: Boolean(r.pinned),
      ownerId: (r as any).owner_id || undefined,
      lastUsedAt: r.last_used_at || undefined,
      lastError: r.last_error || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      settings,
      stats: profileStats
        ? {
            totalSessions: profileStats.totalSessions,
            totalUptimeSeconds: profileStats.totalUptimeSeconds,
            lastSessionStartedAt: profileStats.lastSessionStartedAt,
            lastSessionStoppedAt: profileStats.lastSessionStoppedAt,
          }
        : {
            totalSessions: 0,
            totalUptimeSeconds: 0,
            lastSessionStartedAt: null,
            lastSessionStoppedAt: null,
          },
    });
  }

  return profiles;
}

/**
 * Finds a profile by its number/index for quick switching (e.g. 1 -> Profile 1 or first profile).
 */
export function findProfileByNumber(num: number): Profile | undefined {
  const all = getProfiles();
  if (all.length === 0) return undefined;

  // 1. Check exact name match e.g. "Profile 1", "Profile 2", "M1", "M2"
  const exact = all.find((p) => {
    const match = p.name.match(/\d+/);
    return match && parseInt(match[0], 10) === num;
  });
  if (exact) return exact;

  // 2. Check 1-based index in profile list sorted by creation or position
  if (num >= 1 && num <= all.length) {
    return all[num - 1];
  }

  return undefined;
}


export function getProfileById(id: string, ownerId?: string): Profile | null {
  const db = getDatabase();
  let query = `
    SELECT p.*, ps.settings_json 
    FROM profiles p 
    LEFT JOIN profile_settings ps ON p.id = ps.profile_id 
    WHERE p.id = ?
  `;
  const params: unknown[] = [id];

  if (ownerId) {
    if (ownerId === 'SYSTEM_OWNER' || ownerId === 'LOCAL_CLIENT') {
      query += " AND (p.owner_id = 'SYSTEM_OWNER' OR p.owner_id = 'LOCAL_CLIENT' OR p.owner_id IS NULL)";
    } else {
      query += " AND p.owner_id = ?";
      params.push(ownerId);
    }
  }

  const row = db.prepare(query).get(...params) as {
    id: string;
    name: string;
    description: string;
    folder: string;
    notes: string;
    status: string;
    storage_path: string;
    pinned: number;
    last_used_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
    settings_json: string | null;
  } | undefined;

  if (!row) return null;

  const tagRows = db.prepare('SELECT tag_name FROM profile_tags WHERE profile_id = ?').all(id) as {
    tag_name: string;
  }[];
  const tags = tagRows.map((t) => t.tag_name);

  let settings: ProfileSettings = getDefaultProfileSettings();
  if (row.settings_json) {
    try {
      settings = { ...settings, ...JSON.parse(row.settings_json) };
    } catch {
      // default
    }
  }

  const profileStats = getProfileStats(id);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    folder: row.folder,
    tags,
    notes: row.notes,
    status: row.status as ProfileStatus,
    storagePath: row.storage_path,
    pinned: Boolean(row.pinned),
    ownerId: (row as any).owner_id || undefined,
    lastUsedAt: row.last_used_at || undefined,
    lastError: row.last_error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings,
    stats: profileStats
      ? {
          totalSessions: profileStats.totalSessions,
          totalUptimeSeconds: profileStats.totalUptimeSeconds,
          lastSessionStartedAt: profileStats.lastSessionStartedAt,
          lastSessionStoppedAt: profileStats.lastSessionStoppedAt,
        }
      : {
          totalSessions: 0,
          totalUptimeSeconds: 0,
          lastSessionStartedAt: null,
          lastSessionStoppedAt: null,
        },
  };
}

export function createProfile(dto: CreateProfileDTO): Profile {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const storagePath = getProfileStoragePath(id);
  const ownerId = (dto as any).ownerId || 'SYSTEM_OWNER';

  const defaultSettings = getDefaultProfileSettings();
  const mergedSettings: ProfileSettings = {
    browser: { ...defaultSettings.browser, ...(dto.settings?.browser || {}) },
    display: { ...defaultSettings.display, ...(dto.settings?.display || {}) },
    locale: { ...defaultSettings.locale, ...(dto.settings?.locale || {}) },
    network: { ...defaultSettings.network, ...(dto.settings?.network || {}) },
    permissions: { ...defaultSettings.permissions, ...(dto.settings?.permissions || {}) },
    fingerprint: dto.settings?.fingerprint ? { ...(dto.settings?.fingerprint || {}) } : undefined,
  };

  db.prepare(`
    INSERT INTO profiles (id, name, description, folder, notes, status, storage_path, pinned, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'STOPPED', ?, 0, ?, ?, ?)
  `).run(
    id,
    dto.name,
    dto.description || '',
    dto.folder || 'General',
    dto.notes || '',
    storagePath,
    ownerId,
    now,
    now
  );

  db.prepare(`
    INSERT INTO profile_settings (profile_id, settings_json)
    VALUES (?, ?)
  `).run(id, JSON.stringify(mergedSettings));

  if (dto.tags && dto.tags.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO profile_tags (profile_id, tag_name) VALUES (?, ?)');
    for (const tag of dto.tags) {
      if (tag.trim()) {
        insertTag.run(id, tag.trim());
      }
    }
  }

  if (mergedSettings.network.proxyId) {
    db.prepare('INSERT OR REPLACE INTO profile_proxies (profile_id, proxy_id) VALUES (?, ?)').run(
      id,
      mergedSettings.network.proxyId
    );
  }

  logActivity('PROFILE', 'SUCCESS', 'Create Profile', `Created profile "${dto.name}"`, id, dto.name);

  return getProfileById(id)!;
}

export function updateProfile(id: string, dto: UpdateProfileDTO, ownerId?: string): Profile {
  const db = getDatabase();
  const existing = getProfileById(id, ownerId);
  if (!existing) {
    throw new Error(`Profile with ID ${id} not found or access denied`);
  }

  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (dto.name !== undefined) { updates.push('name = ?'); params.push(dto.name); }
  if (dto.description !== undefined) { updates.push('description = ?'); params.push(dto.description); }
  if (dto.folder !== undefined) { updates.push('folder = ?'); params.push(dto.folder); }
  if (dto.notes !== undefined) { updates.push('notes = ?'); params.push(dto.notes); }
  if (dto.pinned !== undefined) { updates.push('pinned = ?'); params.push(dto.pinned ? 1 : 0); }

  params.push(id);
  db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  if (dto.settings) {
    const mergedSettings: ProfileSettings = {
      browser: { ...existing.settings.browser, ...(dto.settings.browser || {}) },
      fingerprint: { ...existing.settings.fingerprint, ...(dto.settings.fingerprint || {}) },
      display: { ...existing.settings.display, ...(dto.settings.display || {}) },
      locale: { ...existing.settings.locale, ...(dto.settings.locale || {}) },
      network: { ...existing.settings.network, ...(dto.settings.network || {}) },
      permissions: { ...existing.settings.permissions, ...(dto.settings.permissions || {}) },
    };


    db.prepare(`
      INSERT OR REPLACE INTO profile_settings (profile_id, settings_json)
      VALUES (?, ?)
    `).run(id, JSON.stringify(mergedSettings));

    if (mergedSettings.network.proxyId) {
      db.prepare('INSERT OR REPLACE INTO profile_proxies (profile_id, proxy_id) VALUES (?, ?)').run(
        id,
        mergedSettings.network.proxyId
      );
    } else {
      db.prepare('DELETE FROM profile_proxies WHERE profile_id = ?').run(id);
    }
  }

  if (dto.tags !== undefined) {
    db.prepare('DELETE FROM profile_tags WHERE profile_id = ?').run(id);
    const insertTag = db.prepare('INSERT OR IGNORE INTO profile_tags (profile_id, tag_name) VALUES (?, ?)');
    for (const tag of dto.tags) {
      if (tag.trim()) {
        insertTag.run(id, tag.trim());
      }
    }
  }

  logActivity('PROFILE', 'INFO', 'Update Profile', `Updated profile "${dto.name || existing.name}"`, id, dto.name || existing.name);

  return getProfileById(id)!;
}

export function updateProfileStatus(id: string, status: ProfileStatus, lastError?: string, activePid?: number): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  if (status === 'RUNNING') {
    db.prepare('UPDATE profiles SET status = ?, last_error = NULL, last_used_at = ?, updated_at = ? WHERE id = ?').run(
      status,
      now,
      now,
      id
    );
  } else {
    db.prepare('UPDATE profiles SET status = ?, last_error = ?, updated_at = ? WHERE id = ?').run(
      status,
      lastError || null,
      now,
      id
    );
  }
}

export function deleteProfile(id: string, ownerId?: string): boolean {
  const db = getDatabase();
  const existing = getProfileById(id, ownerId);
  if (!existing) return false;

  // Remove all related records from associated tables
  db.prepare('DELETE FROM profile_settings WHERE profile_id = ?').run(id);
  db.prepare('DELETE FROM profile_tags WHERE profile_id = ?').run(id);
  db.prepare('DELETE FROM profile_proxies WHERE profile_id = ?').run(id);
  db.prepare('DELETE FROM extensions WHERE profile_id = ?').run(id);
  // Permanently delete persistent session statistics (only on explicit profile delete)
  deleteProfileStats(id);
  db.prepare('DELETE FROM profiles WHERE id = ?').run(id);

  // Clean filesystem storage
  if (fs.existsSync(existing.storagePath)) {
    try {
      fs.rmSync(existing.storagePath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  logActivity('PROFILE', 'WARNING', 'Delete Profile', `Deleted profile "${existing.name}"`, id, existing.name);
  return true;
}

export function cloneProfile(dtoOrSourceId: CloneProfileDTO | string, maybeNewName?: string, ownerId?: string): Profile {
  const dto: CloneProfileDTO = typeof dtoOrSourceId === 'string'
    ? { sourceProfileId: dtoOrSourceId, newName: maybeNewName || 'Cloned Profile', copyBrowserSettings: true, copyCookies: true, copyHistory: true }
    : dtoOrSourceId;

  const source = getProfileById(dto.sourceProfileId, ownerId);
  if (!source) {
    throw new Error(`Source profile ${dto.sourceProfileId} not found`);
  }

  const newSettings = dto.copyBrowserSettings !== false ? JSON.parse(JSON.stringify(source.settings)) : getDefaultProfileSettings();

  const newProfile = createProfile({
    name: dto.newName,
    description: `Cloned from ${source.name}`,
    folder: source.folder,
    tags: [...source.tags],
    notes: source.notes,
    ownerId: ownerId || source.ownerId,
    settings: newSettings,
  });

  const sourceStorage = source.storagePath;
  const targetStorage = newProfile.storagePath;

  // Copy cookies if requested
  if (dto.copyCookies && fs.existsSync(path.join(sourceStorage, 'Default', 'Network', 'Cookies'))) {
    const targetNetDir = path.join(targetStorage, 'Default', 'Network');
    fs.mkdirSync(targetNetDir, { recursive: true });
    try {
      fs.copyFileSync(
        path.join(sourceStorage, 'Default', 'Network', 'Cookies'),
        path.join(targetNetDir, 'Cookies')
      );
    } catch {
      // ignore
    }
  }

  // Copy history if requested
  if (dto.copyHistory && fs.existsSync(path.join(sourceStorage, 'Default', 'History'))) {
    const targetDefDir = path.join(targetStorage, 'Default');
    fs.mkdirSync(targetDefDir, { recursive: true });
    try {
      fs.copyFileSync(
        path.join(sourceStorage, 'Default', 'History'),
        path.join(targetDefDir, 'History')
      );
    } catch {
      // ignore
    }
  }

  // Copy extensions if requested
  if (dto.copyExtensions) {
    const db = getDatabase();
    const sourceExtensions = db.prepare('SELECT * FROM extensions WHERE profile_id = ?').all(source.id) as {
      extension_id: string;
      name: string;
      version: string;
      description: string | null;
      enabled: number;
      source_type: string;
      source_path: string;
      icon_path: string | null;
    }[];

    for (const ext of sourceExtensions) {
      const extId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO extensions (id, profile_id, extension_id, name, version, description, enabled, source_type, source_path, icon_path, installed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        extId,
        newProfile.id,
        ext.extension_id,
        ext.name,
        ext.version,
        ext.description,
        ext.enabled,
        ext.source_type,
        ext.source_path,
        ext.icon_path,
        new Date().toISOString()
      );
    }
  }

  logActivity('PROFILE', 'SUCCESS', 'Clone Profile', `Cloned profile "${source.name}" to "${dto.newName}"`, newProfile.id, dto.newName);

  return getProfileById(newProfile.id)!;
}

export interface BulkCreateProfileDTO {
  count: number;
  namePrefix?: string;
  folder?: string;
  tags?: string[];
  proxyId?: string;
  osType?: 'windows' | 'mac' | 'random';
  startingIndex?: number;
  ownerId?: string;
}

export function bulkCreateProfiles(dto: BulkCreateProfileDTO): Profile[] {
  const count = Math.max(1, Math.min(dto.count || 1, 100));
  const prefix = dto.namePrefix?.trim() || 'Profile';
  const folder = dto.folder?.trim() || 'General';
  const tags = dto.tags && dto.tags.length > 0 ? dto.tags : ['Workspace'];

  const allProfiles = getProfiles();
  const startIndex = dto.startingIndex ?? (allProfiles.length + 1);

  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1366, height: 768 },
    { width: 2560, height: 1440 },
  ];

  const windowsUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ];

  const macUserAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  ];

  const createdProfiles: Profile[] = [];

  for (let i = 0; i < count; i++) {
    const profileNum = startIndex + i;
    const name = `${prefix} ${profileNum}`;
    const defaults = getDefaultProfileSettings();

    const res = resolutions[Math.floor(Math.random() * resolutions.length)];

    let chosenOS = dto.osType || 'random';
    if (chosenOS === 'random') {
      chosenOS = Math.random() > 0.3 ? 'windows' : 'mac';
    }

    const userAgent = chosenOS === 'mac'
      ? macUserAgents[Math.floor(Math.random() * macUserAgents.length)]
      : windowsUserAgents[Math.floor(Math.random() * windowsUserAgents.length)];

    const created = createProfile({
      name,
      folder,
      tags,
      notes: `Batch created #${profileNum}`,
      ownerId: dto.ownerId,
      settings: {
        ...defaults,
        browser: {
          ...defaults.browser,
          userAgent,
        },
        display: {
          ...defaults.display,
          screenWidth: res.width,
          screenHeight: res.height,
        },

        network: {
          ...defaults.network,
          proxyId: dto.proxyId || undefined,
        },
      },
    });

    createdProfiles.push(created);
  }

  logActivity('PROFILE', 'SUCCESS', 'Bulk Create Profiles', `Batch created ${createdProfiles.length} profiles under folder "${folder}"`);

  return createdProfiles;
}

export interface BulkUpdateProfilesDTO {
  profileIds: string[];
  folder?: string;
  addTags?: string[];
  removeTags?: string[];
  notes?: string;
}

export function bulkUpdateProfiles(dto: BulkUpdateProfilesDTO, ownerId?: string): { updatedCount: number; profiles: Profile[] } {
  const { profileIds, folder, addTags, removeTags, notes } = dto;
  if (!profileIds || profileIds.length === 0) {
    return { updatedCount: 0, profiles: [] };
  }

  const updatedProfiles: Profile[] = [];
  for (const id of profileIds) {
    const existing = getProfileById(id, ownerId);
    if (!existing) continue;

    let newTags = [...existing.tags];
    if (addTags && addTags.length > 0) {
      for (const t of addTags) {
        if (!newTags.includes(t)) newTags.push(t);
      }
    }
    if (removeTags && removeTags.length > 0) {
      newTags = newTags.filter((t) => !removeTags.includes(t));
    }

    const updated = updateProfile(id, {
      folder: folder !== undefined ? folder : existing.folder,
      tags: newTags,
      notes: notes !== undefined ? notes : existing.notes,
    }, ownerId);
    updatedProfiles.push(updated);
  }

  logActivity('PROFILE', 'SUCCESS', 'Bulk Update Profiles', `Updated ${updatedProfiles.length} profiles.`);
  return { updatedCount: updatedProfiles.length, profiles: updatedProfiles };
}

export interface BulkAssignProxiesDTO {
  profileIds: string[];
  proxyIds: string[];
  distributionMode: 'single' | 'round-robin' | 'clear';
}

export function bulkAssignProxies(dto: BulkAssignProxiesDTO, ownerId?: string): { assignedCount: number; profiles: Profile[] } {
  const { profileIds, proxyIds, distributionMode } = dto;
  if (!profileIds || profileIds.length === 0) {
    return { assignedCount: 0, profiles: [] };
  }

  const updatedProfiles: Profile[] = [];

  for (let i = 0; i < profileIds.length; i++) {
    const pId = profileIds[i];
    const existing = getProfileById(pId, ownerId);
    if (!existing) continue;

    let targetProxyId: string | undefined = undefined;
    if (distributionMode === 'clear') {
      targetProxyId = undefined;
    } else if (distributionMode === 'single') {
      targetProxyId = proxyIds[0];
    } else if (distributionMode === 'round-robin') {
      if (proxyIds && proxyIds.length > 0) {
        targetProxyId = proxyIds[i % proxyIds.length];
      }
    }

    const updatedSettings = {
      ...existing.settings,
      network: {
        ...existing.settings.network,
        directConnection: !targetProxyId,
        proxyId: targetProxyId,
      },
    };

    const updated = updateProfile(pId, {
      settings: updatedSettings,
    }, ownerId);
    updatedProfiles.push(updated);
  }

  logActivity('PROFILE', 'SUCCESS', 'Bulk Assign Proxies', `Assigned proxies to ${updatedProfiles.length} profiles (Mode: ${distributionMode}).`);
  return { assignedCount: updatedProfiles.length, profiles: updatedProfiles };
}

export function bulkDeleteProfiles(profileIds: string[], ownerId?: string): { deletedCount: number; success: boolean } {
  if (!profileIds || profileIds.length === 0) {
    return { deletedCount: 0, success: true };
  }

  let deletedCount = 0;
  for (const id of profileIds) {
    try {
      const ok = deleteProfile(id, ownerId);
      if (ok) deletedCount++;
    } catch {}
  }

  logActivity('PROFILE', 'WARNING', 'Bulk Delete Profiles', `Deleted ${deletedCount} profiles.`);
  return { deletedCount, success: true };
}

/**
 * Soft deletes a profile by moving it to the 30-Day Trash Bin (preserves files & settings).
 */
export function softDeleteProfile(id: string, ownerId?: string): boolean {
  const db = getDatabase();
  const existing = getProfileById(id, ownerId);
  if (!existing) return false;

  const now = new Date().toISOString();
  db.prepare('UPDATE profiles SET deleted_at = ?, status = ?, updated_at = ? WHERE id = ?').run(
    now,
    'STOPPED',
    now,
    id
  );

  logActivity('PROFILE', 'WARNING', 'Move to Trash', `Moved profile "${existing.name}" to Trash Bin`, id, existing.name);
  return true;
}

/**
 * Retrieves all soft-deleted profiles in the Trash Bin.
 */
export function getTrashProfiles(ownerId?: string): Profile[] {
  const db = getDatabase();
  let query = 'SELECT p.*, ps.settings_json FROM profiles p LEFT JOIN profile_settings ps ON p.id = ps.profile_id WHERE p.deleted_at IS NOT NULL';
  const params: unknown[] = [];
  if (ownerId) {
    if (ownerId === 'SYSTEM_OWNER' || ownerId === 'LOCAL_CLIENT') {
      query += " AND (p.owner_id = 'SYSTEM_OWNER' OR p.owner_id = 'LOCAL_CLIENT' OR p.owner_id IS NULL)";
    } else {
      query += " AND p.owner_id = ?";
      params.push(ownerId);
    }
  }
  query += ' ORDER BY p.deleted_at DESC';
  const rows = db.prepare(query).all(...params) as {
    id: string;
    name: string;
    description: string;
    folder: string;
    notes: string;
    status: string;
    storage_path: string;
    pinned: number;
    last_used_at: string | null;
    last_error: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
    settings_json: string | null;
  }[];

  const tagRows = db.prepare('SELECT profile_id, tag_name FROM profile_tags').all() as {
    profile_id: string;
    tag_name: string;
  }[];
  const tagMap = new Map<string, string[]>();
  for (const t of tagRows) {
    if (!tagMap.has(t.profile_id)) tagMap.set(t.profile_id, []);
    tagMap.get(t.profile_id)!.push(t.tag_name);
  }

  const statsMap = getAllProfileStats();
  const profiles: Profile[] = [];

  for (const r of rows) {
    const tags = tagMap.get(r.id) || [];
    let settings: ProfileSettings = getDefaultProfileSettings();
    if (r.settings_json) {
      try {
        settings = { ...settings, ...JSON.parse(r.settings_json) };
      } catch {}
    }

    const profileStats = statsMap.get(r.id);
    profiles.push({
      id: r.id,
      name: r.name,
      description: r.description,
      folder: r.folder,
      tags,
      notes: r.notes,
      status: r.status as ProfileStatus,
      storagePath: r.storage_path,
      pinned: Boolean(r.pinned),
      lastUsedAt: r.last_used_at || undefined,
      lastError: r.last_error || undefined,
      deletedAt: r.deleted_at || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      settings,
      stats: profileStats
        ? {
            totalSessions: profileStats.totalSessions,
            totalUptimeSeconds: profileStats.totalUptimeSeconds,
            lastSessionStartedAt: profileStats.lastSessionStartedAt,
            lastSessionStoppedAt: profileStats.lastSessionStoppedAt,
          }
        : undefined,
    });
  }

  return profiles;
}

/**
 * Restores a soft-deleted profile from the Trash Bin back to active status.
 */
export function restoreProfile(id: string, ownerId?: string): Profile {
  const db = getDatabase();
  const existing = getProfileById(id, ownerId);
  if (!existing) {
    throw new Error(`Profile ${id} not found or access denied`);
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE profiles SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id);
  logActivity('PROFILE', 'SUCCESS', 'Restore Profile', `Restored profile "${existing.name}" from Trash Bin`, id, existing.name);
  return getProfileById(id, ownerId)!;
}

/**
 * Permanently deletes a profile (purges database row and disk files).
 */
export function permanentDeleteProfile(id: string, ownerId?: string): boolean {
  return deleteProfile(id, ownerId);
}

/**
 * Empties the entire Trash Bin for the specified owner.
 */
export function emptyTrash(ownerId?: string): { deletedCount: number; success: boolean } {
  const trash = getTrashProfiles(ownerId);
  let deletedCount = 0;
  for (const p of trash) {
    try {
      if (permanentDeleteProfile(p.id, ownerId)) deletedCount++;
    } catch {}
  }
  logActivity('PROFILE', 'WARNING', 'Empty Trash', `Permanently deleted ${deletedCount} profiles from Trash Bin.`);
  return { deletedCount, success: true };
}

/**
 * Safe Owner-Claim process for legacy unassigned SYSTEM_OWNER profiles.
 * Preserves unassigned profiles until their rightful owner explicitly claims them with confirmation.
 */
export interface ClaimLegacyProfilesResult {
  success: boolean;
  claimedCount: number;
  claimedIds: string[];
  skippedIds: string[];
  error?: string;
}

export function claimLegacyProfiles(
  targetOwnerId: string,
  profileIds: string[],
  evidence: {
    userConfirmed: boolean;
    machineHwid?: string;
  }
): ClaimLegacyProfilesResult {
  if (!targetOwnerId || targetOwnerId === 'SYSTEM_OWNER' || targetOwnerId === 'LOCAL_CLIENT') {
    return { success: false, claimedCount: 0, claimedIds: [], skippedIds: profileIds, error: 'Target owner must be an authenticated account' };
  }
  if (!evidence || !evidence.userConfirmed) {
    return { success: false, claimedCount: 0, claimedIds: [], skippedIds: profileIds, error: 'User explicit confirmation required to claim unassigned legacy profiles' };
  }

  const db = getDatabase();
  const claimedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const id of profileIds) {
    // Only allow claiming if the profile is currently unassigned (SYSTEM_OWNER or LOCAL_CLIENT or NULL)
    const row = db.prepare(`
      SELECT id, name, owner_id FROM profiles 
      WHERE id = ? AND (owner_id = 'SYSTEM_OWNER' OR owner_id = 'LOCAL_CLIENT' OR owner_id IS NULL)
    `).get(id) as { id: string; name: string; owner_id: string } | undefined;

    if (row) {
      db.prepare(`UPDATE profiles SET owner_id = ?, updated_at = ? WHERE id = ?`).run(targetOwnerId, new Date().toISOString(), id);
      claimedIds.push(id);
      logActivity('PROFILE', 'INFO', 'Claim Legacy Profile', `User ${targetOwnerId} claimed unassigned legacy profile "${row.name}" (${id})`, id, row.name);
    } else {
      skippedIds.push(id);
    }
  }

  return {
    success: true,
    claimedCount: claimedIds.length,
    claimedIds,
    skippedIds,
  };
}

/**
 * Returns unassigned historical legacy profiles that are available to be claimed by an authenticated owner.
 */
export function getUnassignedLegacyProfiles(): Profile[] {
  return getProfiles({ ownerId: 'SYSTEM_OWNER' });
}



