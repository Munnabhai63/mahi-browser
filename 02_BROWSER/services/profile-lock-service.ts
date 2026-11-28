import { getDatabase } from '../../06_DATABASE/connection.js';
import type { ProfileLock } from '../../10_CONFIG/shared/types/platform.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';

// Auto lock expiry: 30 minutes in milliseconds
const LOCK_TIMEOUT_MS = 30 * 60 * 1000;

interface SqliteProfileLockRow {
  profile_id: string;
  locked_by_user_id: string;
  locked_by_user_name: string;
  locked_by_device_id: string;
  locked_at: string;
  expires_at: string;
}

export function getProfileLock(profileId: string): ProfileLock | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM profile_locks WHERE profile_id = ?').get(profileId) as SqliteProfileLockRow | undefined;
  if (!row) return null;

  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();

  // If expired, clean up and return null
  if (now > expiresAt) {
    db.prepare('DELETE FROM profile_locks WHERE profile_id = ?').run(profileId);
    return null;
  }

  return {
    profileId: row.profile_id,
    lockedByUserId: row.locked_by_user_id,
    lockedByUserName: row.locked_by_user_name,
    lockedByDeviceId: row.locked_by_device_id,
    lockedAt: row.locked_at,
    expiresAt: row.expires_at,
  };
}

export function acquireProfileLock(
  profileId: string,
  userId: string,
  userName: string,
  deviceId: string
): { success: boolean; lock?: ProfileLock; currentLock?: ProfileLock } {
  const db = getDatabase();
  const current = getProfileLock(profileId);

  // If locked by someone else, reject
  if (current && current.lockedByUserId !== userId && current.lockedByDeviceId !== deviceId) {
    return { success: false, currentLock: current };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS);

  db.prepare(`
    INSERT OR REPLACE INTO profile_locks (profile_id, locked_by_user_id, locked_by_user_name, locked_by_device_id, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    profileId,
    userId,
    userName,
    deviceId,
    now.toISOString(),
    expiresAt.toISOString()
  );

  const lock: ProfileLock = {
    profileId,
    lockedByUserId: userId,
    lockedByUserName: userName,
    lockedByDeviceId: deviceId,
    lockedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  logActivity('PROFILE', 'INFO', 'Acquire Profile Lock', `User "${userName}" locked profile`, profileId);

  return { success: true, lock };
}

export function releaseProfileLock(profileId: string, userId?: string): boolean {
  const db = getDatabase();
  if (userId) {
    db.prepare('DELETE FROM profile_locks WHERE profile_id = ? AND locked_by_user_id = ?').run(profileId, userId);
  } else {
    db.prepare('DELETE FROM profile_locks WHERE profile_id = ?').run(profileId);
  }
  logActivity('PROFILE', 'INFO', 'Release Profile Lock', `Profile lock released`, profileId);
  return true;
}
