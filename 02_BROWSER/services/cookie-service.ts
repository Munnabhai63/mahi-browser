import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { getProfileStoragePath } from './profile-service.js';
import {
  CookieItem,
  CookieFilterOptions,
  CookieExportOptions,
  CookieImportResult,
} from '../../10_CONFIG/shared/types/cookie.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';

function getProfileCookieDbPath(profileId: string): string | null {
  const base = getProfileStoragePath(profileId);
  const candidate1 = path.join(base, 'Default', 'Network', 'Cookies');
  const candidate2 = path.join(base, 'Default', 'Cookies');

  if (fs.existsSync(candidate1)) return candidate1;
  if (fs.existsSync(candidate2)) return candidate2;

  return null;
}

function getMahiCustomCookiesPath(profileId: string): string {
  const base = getProfileStoragePath(profileId);
  return path.join(base, 'mahi_cookies.json');
}

function loadMahiCustomCookies(profileId: string): CookieItem[] {
  const filePath = getMahiCustomCookiesPath(profileId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveMahiCustomCookies(profileId: string, cookies: CookieItem[]): void {
  const filePath = getMahiCustomCookiesPath(profileId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2), 'utf8');
}

/**
 * Reads cookies from Chromium's actual SQLite Cookies database for a profile.
 * Copies the DB file to memory to avoid locking issues when Chrome is running.
 */
function loadChromiumCookies(profileId: string): CookieItem[] {
  const dbPath = getProfileCookieDbPath(profileId);
  if (!dbPath || !fs.existsSync(dbPath)) return [];

  try {
    // Read file into buffer (avoids locking conflicts with running Chrome)
    const fileBuffer = fs.readFileSync(dbPath);
    const SQL = require('sql.js');
    // Use synchronous sql.js constructor with the buffer
    let db: any;
    try {
      // sql.js Database constructor can accept a buffer directly when SQL is already loaded
      const sqlJs = SQL.default || SQL;
      if (sqlJs.Database) {
        db = new sqlJs.Database(fileBuffer);
      } else {
        return [];
      }
    } catch {
      // If synchronous constructor not available, skip Chromium cookies
      return [];
    }

    const cookies: CookieItem[] = [];
    try {
      const results = db.exec(
        `SELECT host_key, name, path, expires_utc, is_secure, is_httponly, 
                last_access_utc, samesite, creation_utc
         FROM cookies ORDER BY last_access_utc DESC LIMIT 500`
      );
      if (results.length > 0) {
        const rows = results[0].values;
        for (const row of rows) {
          const hostKey = String(row[0] || '');
          const name = String(row[1] || '');
          const cookiePath = String(row[2] || '/');
          const expiresUtc = Number(row[3] || 0);
          const isSecure = Number(row[4]) === 1;
          const isHttpOnly = Number(row[5]) === 1;
          const sameSiteVal = Number(row[7] || 0);
          const creationUtc = Number(row[8] || 0);

          // Chromium stores time as microseconds since Jan 1, 1601
          // Convert to Unix seconds: (chromiumTime / 1000000) - 11644473600
          const expiresUnix = expiresUtc > 0
            ? Math.floor(expiresUtc / 1000000) - 11644473600
            : 0;

          const sameSiteMap: Record<number, 'Strict' | 'Lax' | 'None'> = { 0: 'None', 1: 'Lax', 2: 'Strict' };

          cookies.push({
            id: `chromium-${creationUtc}-${name}`,
            profileId,
            domain: hostKey,
            name,
            value: '[Browser Cookie]', // Chromium encrypts values with DPAPI — metadata is still useful
            path: cookiePath,
            expires: expiresUnix > 0 ? expiresUnix : undefined,
            secure: isSecure,
            httpOnly: isHttpOnly,
            sameSite: sameSiteMap[sameSiteVal] || 'Lax',
          });
        }
      }
    } finally {
      try { db.close(); } catch {}
    }
    return cookies;
  } catch {
    return [];
  }
}

export function getCookies(options: CookieFilterOptions): CookieItem[] {
  const { profileId, searchQuery, domain } = options;

  // Load from both sources: manually imported + real Chromium browser cookies
  const mahiCookies = loadMahiCustomCookies(profileId);
  const chromiumCookies = loadChromiumCookies(profileId);

  // Merge: mahi custom cookies first, then Chromium cookies (deduplicated by domain+name)
  const seen = new Set<string>();
  const merged: CookieItem[] = [];

  for (const c of mahiCookies) {
    const key = `${c.domain}|${c.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  for (const c of chromiumCookies) {
    const key = `${c.domain}|${c.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  // Filter
  return merged.filter((c) => {
    if (domain && !c.domain.toLowerCase().includes(domain.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q);
    }
    return true;
  });
}

export function deleteCookie(profileId: string, cookieId: string): boolean {
  const current = loadMahiCustomCookies(profileId);
  const updated = current.filter((c) => c.id !== cookieId);
  saveMahiCustomCookies(profileId, updated);
  logActivity('COOKIE', 'INFO', 'Delete Cookie', `Deleted cookie from profile`, profileId);
  return true;
}

export function deleteAllCookies(profileId: string): boolean {
  saveMahiCustomCookies(profileId, []);
  const dbPath = getProfileCookieDbPath(profileId);
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  }
  logActivity('COOKIE', 'WARNING', 'Clear Cookies', `Cleared all cookies for profile`, profileId);
  return true;
}

export function parseNetscapeCookies(content: string, profileId: string): CookieItem[] {
  const lines = content.split('\n');
  const cookies: CookieItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('# HttpOnly_') || trimmed.startsWith('#')) {
      if (trimmed.startsWith('# HttpOnly_')) {
        // Netscape format with httpOnly prefix
        const parts = trimmed.substring(11).split('\t');
        if (parts.length >= 7) {
          cookies.push({
            id: crypto.randomUUID(),
            profileId,
            domain: parts[0],
            secure: parts[3].toLowerCase() === 'true',
            path: parts[2],
            expires: parseInt(parts[4], 10) || undefined,
            name: parts[5],
            value: parts[6],
            httpOnly: true,
          });
        }
      }
      continue;
    }

    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        id: crypto.randomUUID(),
        profileId,
        domain: parts[0],
        secure: parts[3].toLowerCase() === 'true',
        path: parts[2],
        expires: parseInt(parts[4], 10) || undefined,
        name: parts[5],
        value: parts[6],
        httpOnly: false,
      });
    }
  }

  return cookies;
}

export function importCookies(profileId: string, content: string): CookieImportResult {
  const errors: string[] = [];
  let parsedCookies: CookieItem[] = [];

  // Try JSON format first
  try {
    const raw = JSON.parse(content);
    if (Array.isArray(raw)) {
      parsedCookies = raw.map((item) => ({
        id: item.id || crypto.randomUUID(),
        profileId,
        domain: item.domain || item.host || '',
        name: item.name || '',
        value: item.value || '',
        path: item.path || '/',
        expires: item.expires || item.expirationDate,
        httpOnly: Boolean(item.httpOnly),
        secure: Boolean(item.secure),
        sameSite: item.sameSite || 'Lax',
      }));
    }
  } catch {
    // If not JSON, parse as Netscape
    parsedCookies = parseNetscapeCookies(content, profileId);
  }

  if (parsedCookies.length === 0) {
    return { importedCount: 0, failedCount: 1, errors: ['Could not parse any cookies from provided data'] };
  }

  const existing = loadMahiCustomCookies(profileId);
  const combined = [...existing, ...parsedCookies];
  saveMahiCustomCookies(profileId, combined);

  logActivity('COOKIE', 'SUCCESS', 'Import Cookies', `Imported ${parsedCookies.length} cookies into profile`, profileId);

  return {
    importedCount: parsedCookies.length,
    failedCount: errors.length,
    errors,
  };
}

export function exportCookies(options: CookieExportOptions): string {
  const cookies = getCookies({ profileId: options.profileId });
  logActivity('COOKIE', 'INFO', 'Export Cookies', `Exported ${cookies.length} cookies (${options.format.toUpperCase()})`, options.profileId);

  if (options.format === 'json') {
    return JSON.stringify(cookies, null, 2);
  }

  // Netscape format
  const lines = ['# Netscape HTTP Cookie File', '# Created by MAHI BROWSER', ''];
  for (const c of cookies) {
    const prefix = c.httpOnly ? '# HttpOnly_' : '';
    const secureFlag = c.secure ? 'TRUE' : 'FALSE';
    const expires = c.expires || 2147483647;
    lines.push(`${prefix}${c.domain}\tTRUE\t${c.path}\t${secureFlag}\t${expires}\t${c.name}\t${c.value}`);
  }
  return lines.join('\n');
}
