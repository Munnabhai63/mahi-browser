/**
 * Profile Statistics Service
 *
 * Persists historical session data (launch count, total uptime, last session times)
 * for each profile in the `profile_statistics` table.
 *
 * IMPORTANT: Stats are NEVER deleted when a profile is stopped or closed.
 * Stats are ONLY deleted when the user explicitly deletes a profile via deleteProfileStats().
 *
 * Lifecycle:
 *   startProfile → recordSessionStart()   → increments total_sessions, sets last_session_started_at
 *   stopProfile  → recordSessionStop()    → accumulates uptime into total_uptime_seconds
 *   deleteProfile → deleteProfileStats()  → removes all stats permanently
 */

import { getDatabase } from '../../06_DATABASE/connection.js';

export interface ProfileStats {
  profileId: string;
  totalSessions: number;
  totalUptimeSeconds: number;
  lastSessionStartedAt: string | null;
  lastSessionStoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load persistent stats for a profile.
 * Returns null if no stats exist yet (new profile, never run).
 */
export function getProfileStats(profileId: string): ProfileStats | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT profile_id, total_sessions, total_uptime_seconds,
              last_session_started_at, last_session_stopped_at,
              created_at, updated_at
       FROM profile_statistics
       WHERE profile_id = ?`
    )
    .get(profileId) as
    | {
        profile_id: string;
        total_sessions: number;
        total_uptime_seconds: number;
        last_session_started_at: string | null;
        last_session_stopped_at: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    profileId: row.profile_id,
    totalSessions: row.total_sessions,
    totalUptimeSeconds: row.total_uptime_seconds,
    lastSessionStartedAt: row.last_session_started_at,
    lastSessionStoppedAt: row.last_session_stopped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get stats for all profiles at once (used in getProfiles to join stats efficiently).
 * Returns a Map keyed by profileId.
 */
export function getAllProfileStats(): Map<string, ProfileStats> {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT profile_id, total_sessions, total_uptime_seconds,
              last_session_started_at, last_session_stopped_at,
              created_at, updated_at
       FROM profile_statistics`
    )
    .all() as {
    profile_id: string;
    total_sessions: number;
    total_uptime_seconds: number;
    last_session_started_at: string | null;
    last_session_stopped_at: string | null;
    created_at: string;
    updated_at: string;
  }[];

  const map = new Map<string, ProfileStats>();
  for (const row of rows) {
    map.set(row.profile_id, {
      profileId: row.profile_id,
      totalSessions: row.total_sessions,
      totalUptimeSeconds: row.total_uptime_seconds,
      lastSessionStartedAt: row.last_session_started_at,
      lastSessionStoppedAt: row.last_session_stopped_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return map;
}

/**
 * Called when a profile browser STARTS.
 * Increments the session counter and records session start time.
 * Uses INSERT OR REPLACE so it is safe for first-ever launch of a profile.
 */
export function recordSessionStart(profileId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = getProfileStats(profileId);

  if (!existing) {
    // First time this profile is ever launched — create stats row
    db.prepare(
      `INSERT INTO profile_statistics
         (profile_id, total_sessions, total_uptime_seconds,
          last_session_started_at, last_session_stopped_at,
          created_at, updated_at)
       VALUES (?, 1, 0, ?, NULL, ?, ?)`
    ).run(profileId, now, now, now);
  } else {
    // Subsequent launch — increment session count, update start time
    db.prepare(
      `UPDATE profile_statistics
       SET total_sessions = total_sessions + 1,
           last_session_started_at = ?,
           updated_at = ?
       WHERE profile_id = ?`
    ).run(now, now, profileId);
  }
}

/**
 * Called when a profile browser STOPS (normal stop, crash, or process exit).
 * Calculates session duration from last_session_started_at and adds to total_uptime_seconds.
 * NEVER resets historical counters.
 */
export function recordSessionStop(profileId: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = getProfileStats(profileId);
  if (!existing) {
    // No stats row — profile may have been started externally or stats table was just added.
    // Create a minimal row so we have a record going forward.
    db.prepare(
      `INSERT INTO profile_statistics
         (profile_id, total_sessions, total_uptime_seconds,
          last_session_started_at, last_session_stopped_at,
          created_at, updated_at)
       VALUES (?, 1, 0, ?, ?, ?, ?)`
    ).run(profileId, null, now, now, now);
    return;
  }

  // Calculate uptime delta from last known session start
  let deltaSec = 0;
  if (existing.lastSessionStartedAt) {
    const startMs = new Date(existing.lastSessionStartedAt).getTime();
    const stopMs = Date.now();
    if (!isNaN(startMs) && stopMs > startMs) {
      deltaSec = Math.floor((stopMs - startMs) / 1000);
    }
  }

  db.prepare(
    `UPDATE profile_statistics
     SET total_uptime_seconds = total_uptime_seconds + ?,
         last_session_stopped_at = ?,
         updated_at = ?
     WHERE profile_id = ?`
  ).run(deltaSec, now, now, profileId);
}

/**
 * Called ONLY when a user explicitly deletes a profile.
 * Permanently removes all historical stats for that profile.
 */
export function deleteProfileStats(profileId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM profile_statistics WHERE profile_id = ?').run(profileId);
}

/**
 * Format total uptime seconds into human-readable string.
 * Examples: "2h 15m", "45m", "< 1m", "3d 4h"
 */
export function formatUptime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '—';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '< 1m';
}
