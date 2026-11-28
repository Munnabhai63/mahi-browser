import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getProfileStoragePath } from './profile-service.js';
import type { HistoryItem, HistoryFilterOptions } from '../../10_CONFIG/shared/types/history.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
import crypto from 'node:crypto';

const log = createLogger('history-service');

const esmRequire = createRequire(import.meta.url);

function getMahiCustomHistoryPath(profileId: string): string {
  const base = getProfileStoragePath(profileId);
  return path.join(base, 'mahi_history.json');
}

function getChromiumHistoryDbPath(profileId: string): string | null {
  const base = getProfileStoragePath(profileId);
  const candidate = path.join(base, 'Default', 'History');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

function loadMahiCustomHistory(profileId: string): HistoryItem[] {
  const filePath = getMahiCustomHistoryPath(profileId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveMahiCustomHistory(profileId: string, history: HistoryItem[]): void {
  const filePath = getMahiCustomHistoryPath(profileId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
}

/**
 * Reads browsing history from Chromium's actual SQLite History database for a profile.
 * Copies the DB file into memory to avoid locking issues when Chrome is running.
 */
interface SqlJsDatabaseInstance {
  exec(sql: string): Array<{ values: unknown[][] }>;
  close(): void;
}

interface SqlJsModuleShape {
  Database?: new (data: Uint8Array) => SqlJsDatabaseInstance;
  default?: {
    Database?: new (data: Uint8Array) => SqlJsDatabaseInstance;
  };
}

function loadChromiumHistory(profileId: string): HistoryItem[] {
  const dbPath = getChromiumHistoryDbPath(profileId);
  if (!dbPath) return [];

  try {
    const fileBuffer = fs.readFileSync(dbPath);
    let SQL: SqlJsModuleShape;
    try {
      SQL = esmRequire('sql.js') as SqlJsModuleShape;
    } catch {
      return [];
    }
    let db: SqlJsDatabaseInstance;
    try {
      const sqlJs = SQL.default || SQL;
      if (sqlJs.Database) {
        db = new sqlJs.Database(fileBuffer);
      } else {
        return [];
      }
    } catch {
      return [];
    }

    const items: HistoryItem[] = [];
    try {
      const results = db.exec(
        `SELECT url, title, visit_count, last_visit_time
         FROM urls
         ORDER BY last_visit_time DESC
         LIMIT 500`
      );
      if (results.length > 0) {
        const rows = results[0].values;
        for (const row of rows) {
          const url = String(row[0] || '');
          const title = String(row[1] || '');
          const visitCount = Number(row[2] || 1);
          const lastVisitTime = Number(row[3] || 0);

          // Chromium stores time as microseconds since Jan 1, 1601
          // Convert to JS Date: (chromiumTime / 1000) - 11644473600000 (in ms)
          const jsTimestamp = lastVisitTime > 0
            ? Math.floor(lastVisitTime / 1000) - 11644473600000
            : Date.now();

          items.push({
            id: `chromium-${lastVisitTime}-${crypto.createHash('md5').update(url).digest('hex').substring(0, 8)}`,
            profileId,
            url,
            title: title || url,
            visitCount,
            lastVisitTime: new Date(jsTimestamp).toISOString(),
          });
        }
      }
    } finally {
      try { db.close(); } catch (closeErr) { log.debug('history-service sqlite close failed', { err: closeErr }); }
    }
    return items;
  } catch {
    return [];
  }
}

export function getHistory(options: HistoryFilterOptions): HistoryItem[] {
  const { profileId, searchQuery, startDate, endDate, sortBy = 'visitTime', sortDirection = 'desc' } = options;

  // Load from both sources: manually imported + real Chromium browser history
  const mahiHistory = loadMahiCustomHistory(profileId);
  const chromiumHistory = loadChromiumHistory(profileId);

  // Merge: mahi custom history first, then Chromium history (deduplicated by URL)
  const seen = new Set<string>();
  const merged: HistoryItem[] = [];

  for (const h of mahiHistory) {
    if (!seen.has(h.url)) {
      seen.add(h.url);
      merged.push(h);
    }
  }
  for (const h of chromiumHistory) {
    if (!seen.has(h.url)) {
      seen.add(h.url);
      merged.push(h);
    }
  }

  // Filter
  const filtered = merged.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.url.toLowerCase().includes(q) && !item.title.toLowerCase().includes(q)) return false;
    }
    if (startDate && new Date(item.lastVisitTime) < new Date(startDate)) return false;
    if (endDate && new Date(item.lastVisitTime) > new Date(endDate)) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'visitTime') {
      cmp = new Date(a.lastVisitTime).getTime() - new Date(b.lastVisitTime).getTime();
    } else if (sortBy === 'visitCount') {
      cmp = a.visitCount - b.visitCount;
    } else if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy === 'domain') {
      try {
        const dA = new URL(a.url).hostname;
        const dB = new URL(b.url).hostname;
        cmp = dA.localeCompare(dB);
      } catch {
        cmp = a.url.localeCompare(b.url);
      }
    }
    return sortDirection === 'desc' ? -cmp : cmp;
  });

  return filtered;
}

export function deleteHistoryItem(profileId: string, historyId: string): boolean {
  const current = loadMahiCustomHistory(profileId);
  const updated = current.filter((h) => h.id !== historyId);
  saveMahiCustomHistory(profileId, updated);
  logActivity('HISTORY', 'INFO', 'Delete History Item', `Removed history item`, profileId);
  return true;
}

export function clearHistory(profileId: string): boolean {
  saveMahiCustomHistory(profileId, []);
  const customPath = getMahiCustomHistoryPath(profileId);
  if (fs.existsSync(customPath)) {
    try {
      fs.unlinkSync(customPath);
    } catch (err) {
      log.warn('history-service custom history file unlink failed', { profileId, customPath, err });
    }
  }
  logActivity('HISTORY', 'WARNING', 'Clear History', `Cleared all browsing history for profile`, profileId);
  return true;
}
