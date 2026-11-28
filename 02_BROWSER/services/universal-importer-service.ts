import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createProfile, getProfileStoragePath } from './profile-service.js';
import { createProxy } from './proxy-service.js';
import { getDefaultProfileSettings, generateConsistentEnvironmentSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import type { CookieItem } from '../../10_CONFIG/shared/types/cookie.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';

const log = createLogger('universal-importer-service');


export interface ParsedProxyInfo {
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ParsedAccountItem {
  name: string;
  usernameOrEmail?: string;
  password?: string;
  proxy?: ParsedProxyInfo;
  cookies?: CookieItem[];
  userAgent?: string;
  timezone?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  sourceFormat?: 'gologin' | 'adspower' | 'dolphin' | 'generic';
  notes?: string;
  tags?: string[];
  rawLine?: string;
}

export interface BulkImportOptions {
  folder?: string;
  os?: 'windows' | 'macos' | 'linux';
  browserEngine?: 'chrome' | 'edge';
  tags?: string[];
  autoGenerateFingerprints?: boolean;
}

export interface BulkImportResult {
  success: boolean;
  totalImported: number;
  failedCount: number;
  createdProfileIds: string[];
  createdProfiles: { id: string; name: string; proxyBound: boolean; cookiesCount: number }[];
  errors: string[];
  durationMs: number;
}

/**
 * Parses standard Netscape format cookie string
 */
export function parseNetscapeCookies(rawText: string, profileId = ''): CookieItem[] {
  const cookies: CookieItem[] = [];
  const lines = rawText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let isHttpOnly = false;
    let cleanLine = trimmed;
    if (cleanLine.startsWith('#HttpOnly_')) {
      isHttpOnly = true;
      cleanLine = cleanLine.replace(/^#HttpOnly_/, '');
    } else if (cleanLine.startsWith('#')) {
      continue; // Comment line
    }

    const parts = cleanLine.split('\t');
    if (parts.length >= 7) {
      const domain = parts[0].trim();
      const path = parts[2].trim() || '/';
      const secure = parts[3].trim().toUpperCase() === 'TRUE';
      const expiresRaw = parseInt(parts[4].trim(), 10);
      const name = parts[5].trim();
      const value = parts.slice(6).join('\t').trim();

      if (name && domain) {
        cookies.push({
          id: crypto.randomUUID(),
          profileId,
          domain,
          name,
          value,
          path,
          expires: Number.isNaN(expiresRaw) || expiresRaw <= 0 ? Math.floor(Date.now() / 1000) + 86400 * 365 : expiresRaw,
          httpOnly: isHttpOnly,
          secure,
          sameSite: 'Lax',
        });
      }
    }
  }

  return cookies;
}

/**
 * Parses JSON cookie array
 */
interface RawCookieEntry {
  domain?: unknown;
  name?: unknown;
  value?: unknown;
  path?: unknown;
  expirationDate?: unknown;
  expires?: unknown;
  httpOnly?: unknown;
  secure?: unknown;
  sameSite?: unknown;
}

export function parseJsonCookies(rawJson: string | RawCookieEntry[], profileId = ''): CookieItem[] {
  let list: RawCookieEntry[] = [];
  if (typeof rawJson === 'string') {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      list = Array.isArray(parsed) ? (parsed as RawCookieEntry[]) : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(rawJson)) {
    list = rawJson;
  }

  if (!Array.isArray(list)) return [];

  const cookies: CookieItem[] = [];
  for (const c of list) {
    if (!c?.name || !c.domain) continue;

    const rawExp = c.expirationDate ?? c.expires;
    let expires: number;
    if (typeof rawExp === 'number' && rawExp > 0) {
      expires = rawExp > 10000000000 ? Math.floor(rawExp / 1000) : rawExp;
    } else {
      expires = Math.floor(Date.now() / 1000) + 86400 * 365;
    }

    const sameSiteVal = c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None' ? c.sameSite : 'Lax';
    cookies.push({
      id: crypto.randomUUID(),
      profileId,
      domain: String(c.domain),
      name: String(c.name),
      value: String(c.value || ''),
      path: String(c.path || '/'),
      expires,
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
      sameSite: sameSiteVal,
    });
  }

  return cookies;
}

export type DetectedImportFormat = 'gologin' | 'adspower' | 'dolphin' | 'json' | 'csv' | 'delimited';

function normalizeProtocol(raw: unknown): ParsedProxyInfo['protocol'] {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'socks5' || s.startsWith('socks5')) return 'socks5';
  if (s === 'socks4' || s.startsWith('socks4')) return 'socks4';
  if (s === 'https') return 'https';
  return 'http';
}

type UnknownRecord = Record<string, unknown>;

function asRecord(val: unknown): UnknownRecord {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as UnknownRecord) : {};
}

function asStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function mapCompetitorJsonItems(rawObj: unknown): { format: 'gologin' | 'adspower' | 'dolphin' | null; items: UnknownRecord[] } | null {
  if (!rawObj || typeof rawObj !== 'object') return null;

  if (Array.isArray(rawObj)) {
    const items = rawObj as UnknownRecord[];
    const first = items[0];
    if (!first || typeof first !== 'object') return null;
    if (first.user_proxy_config || first.fingerprint_config || first.user_id) {
      return { format: 'adspower', items };
    }
    if (first.browserType === 'anty' || (first.useragent && typeof first.useragent === 'object') || first.mainWebsite !== undefined) {
      return { format: 'dolphin', items };
    }
    if (first.navigator || first.webGLMetadata || first.proxyEnabled !== undefined) {
      return { format: 'gologin', items };
    }
    return null;
  }

  const rec = rawObj as UnknownRecord;
  // GoLogin object export: { profiles: [...] } or single GoLogin profile
  if (Array.isArray(rec.profiles)) {
    return { format: 'gologin', items: rec.profiles as UnknownRecord[] };
  }
  // AdsPower object export: { list: [...] } or { data: { list: [...] } }
  if (Array.isArray(rec.list)) {
    return { format: 'adspower', items: rec.list as UnknownRecord[] };
  }
  const dataRec = asRecord(rec.data);
  if (Array.isArray(dataRec.list)) {
    return { format: 'adspower', items: dataRec.list as UnknownRecord[] };
  }
  // Dolphin{anty} object export: { data: [...] }
  if (Array.isArray(rec.data)) {
    return { format: 'dolphin', items: rec.data as UnknownRecord[] };
  }
  return null;
}

function parseCompetitorProfileEntry(item: UnknownRecord, idx: number, format: 'gologin' | 'adspower' | 'dolphin'): ParsedAccountItem {
  if (format === 'gologin') {
    const p = asRecord(item.proxy);
    let proxy: ParsedProxyInfo | undefined;
    if (item.proxy && typeof item.proxy === 'object' && p.mode !== 'none' && p.host && p.port) {
      proxy = {
        protocol: normalizeProtocol(p.mode || p.protocol),
        host: String(p.host),
        port: Number(p.port) || 8080,
        username: asStr(p.username),
        password: asStr(p.password),
      };
    }
    const nav = asRecord(item.navigator);
    const ua = asStr(nav.userAgent) || asStr(item.userAgent);
    const screenRes = typeof nav.resolution === 'string' ? nav.resolution.split('x') : [];
    const sw = Number(screenRes[0]) || Number(nav.screenWidth) || undefined;
    const sh = Number(screenRes[1]) || Number(nav.screenHeight) || undefined;
    const tzObj = asRecord(item.timezone);
    return {
      name: asStr(item.name) || asStr(item.profileName) || `GoLogin Profile ${idx + 1}`,
      proxy,
      cookies: Array.isArray(item.cookies) ? parseJsonCookies(item.cookies as RawCookieEntry[]) : undefined,
      userAgent: ua,
      timezone: asStr(tzObj.id) || asStr(item.timezone),
      language: asStr(nav.language),
      screenWidth: sw,
      screenHeight: sh,
      sourceFormat: 'gologin',
      notes: asStr(item.notes),
      tags: Array.isArray(item.folders) && item.folders.length > 0
        ? item.folders.map(String)
        : (Array.isArray(item.tags) ? item.tags.map(String) : ['GoLogin', 'Imported']),
      rawLine: JSON.stringify(item),
    };
  }

  if (format === 'adspower') {
    const upc = asRecord(item.user_proxy_config);
    let proxy: ParsedProxyInfo | undefined;
    if (upc.proxy_type && upc.proxy_type !== 'noproxy' && upc.proxy_host && upc.proxy_port) {
      proxy = {
        protocol: normalizeProtocol(upc.proxy_type),
        host: String(upc.proxy_host),
        port: Number(upc.proxy_port) || 8080,
        username: asStr(upc.proxy_user),
        password: asStr(upc.proxy_password),
      };
    } else if (typeof item.proxy === 'string') {
      proxy = parseProxyString(item.proxy);
    }
    const fp = asRecord(item.fingerprint_config);
    let cookies: CookieItem[] | undefined;
    if (Array.isArray(item.cookie)) cookies = parseJsonCookies(item.cookie as RawCookieEntry[]);
    else if (typeof item.cookie === 'string' && item.cookie.trim()) cookies = parseJsonCookies(item.cookie);
    else if (Array.isArray(item.cookies)) cookies = parseJsonCookies(item.cookies as RawCookieEntry[]);
    const langs = Array.isArray(fp.language) ? (fp.language as unknown[]) : undefined;
    return {
      name: asStr(item.name) || asStr(item.user_id) || asStr(item.username) || `AdsPower Profile ${idx + 1}`,
      usernameOrEmail: asStr(item.username) || asStr(item.email),
      password: asStr(item.password),
      proxy,
      cookies,
      userAgent: asStr(fp.ua) || asStr(item.ua) || asStr(item.userAgent),
      timezone: asStr(fp.timezone) || asStr(item.timezone),
      language: asStr(langs?.[0]) || asStr(fp.page_language),
      sourceFormat: 'adspower',
      notes: asStr(item.remark) || asStr(item.notes),
      tags: Array.isArray(item.tags)
        ? item.tags.map(String)
        : [asStr(item.group_name) || 'AdsPower', 'Imported'].filter(Boolean),
      rawLine: JSON.stringify(item),
    };
  }

  // Dolphin{anty}
  const dp = asRecord(item.proxy);
  let proxy: ParsedProxyInfo | undefined;
  if (item.proxy && typeof item.proxy === 'object' && dp.host && dp.port) {
    proxy = {
      protocol: normalizeProtocol(dp.type || dp.protocol),
      host: String(dp.host),
      port: Number(dp.port) || 8080,
      username: asStr(dp.login) || asStr(dp.username),
      password: asStr(dp.password),
    };
  }
  const uaObj = asRecord(item.useragent);
  const ua = typeof item.useragent === 'object' ? asStr(uaObj.value) : (asStr(item.useragent) || asStr(item.userAgent));
  const screenObj = asRecord(item.screen);
  const sw = Number(screenObj.width) || undefined;
  const sh = Number(screenObj.height) || undefined;
  let cookies: CookieItem[] | undefined;
  if (Array.isArray(item.cookies)) cookies = parseJsonCookies(item.cookies as RawCookieEntry[]);
  else if (typeof item.cookies === 'string') cookies = parseJsonCookies(item.cookies);
  const tzObj = asRecord(item.timezone);
  const localeObj = asRecord(item.locale);
  const notesObj = asRecord(item.notes);
  return {
    name: asStr(item.name) || `Dolphin Profile ${idx + 1}`,
    proxy,
    cookies,
    userAgent: ua,
    timezone: asStr(tzObj.value) || (typeof item.timezone === 'string' ? item.timezone : undefined),
    language: asStr(localeObj.value),
    screenWidth: sw,
    screenHeight: sh,
    sourceFormat: 'dolphin',
    notes: asStr(notesObj.content) || (typeof item.notes === 'string' ? item.notes : undefined),
    tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.map(String) : ['Dolphin', 'Imported'],
    rawLine: JSON.stringify(item),
  };
}

export function detectCompetitorFormat(rawInput: string): DetectedImportFormat {
  const trimmed = rawInput.trim();
  if (!trimmed) return 'delimited';
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const mapped = mapCompetitorJsonItems(parsed);
      if (mapped?.format) return mapped.format;
      if (Array.isArray(parsed)) return 'json';
    } catch (err) {
      log.debug('universal-importer format detection JSON parse skipped', { err });
    }
  }
  const firstLine = trimmed.split(/\r?\n/)[0]?.toLowerCase() || '';
  if (firstLine.includes(',') && (firstLine.includes('name') || firstLine.includes('proxy') || firstLine.includes('email') || firstLine.includes('proxy_host') || firstLine.includes('proxyhost'))) {
    if (firstLine.includes('proxy_host') || firstLine.includes('user_id') || firstLine.includes('remark')) return 'adspower';
    if (firstLine.includes('proxylogin') || firstLine.includes('proxytype')) return 'dolphin';
    return 'csv';
  }
  return 'delimited';
}

/**
 * Intelligent Universal Account, GoLogin, AdsPower, Dolphin{anty} & Proxy Parser
 */
export function detectAndParseAccountData(rawInput: string): ParsedAccountItem[] {
  const trimmedInput = rawInput.trim();
  if (!trimmedInput) return [];

  // Check JSON exports (GoLogin, AdsPower, Dolphin{anty}, or generic array)
  if ((trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) || (trimmedInput.startsWith('{') && trimmedInput.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmedInput);
      const competitor = mapCompetitorJsonItems(parsed);
      if (competitor?.format && Array.isArray(competitor.items)) {
        const fmt = competitor.format;
        return competitor.items.map((item, idx) => parseCompetitorProfileEntry(item, idx, fmt));
      }
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          name: item.name || item.username || item.email || `Imported Profile ${idx + 1}`,
          usernameOrEmail: item.username || item.email,
          password: item.password,
          proxy: item.proxy ? normalizeProxy(item.proxy) : undefined,
          cookies: Array.isArray(item.cookies) ? parseJsonCookies(item.cookies) : undefined,
          userAgent: item.userAgent,
          sourceFormat: 'generic',
          notes: item.notes || (item.password ? `Username/Email: ${item.username || item.email}\nPassword: ${item.password}` : undefined),
          tags: Array.isArray(item.tags) ? item.tags : ['Imported'],
          rawLine: JSON.stringify(item),
        }));
      }
    } catch (err) {
      log.debug('universal-importer account data JSON parse skipped, falling back to delimited parser', { err });
    }
  }

  // Parse Line-by-Line (TXT, CSV, Delimited, AdsPower/Dolphin CSV)
  const lines = trimmedInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedAccountItem[] = [];

  let isCsv = false;
  let headers: string[] = [];

  if (
    lines.length > 0 &&
    lines[0].includes(',') &&
    (lines[0].toLowerCase().includes('name') ||
      lines[0].toLowerCase().includes('proxy') ||
      lines[0].toLowerCase().includes('email') ||
      lines[0].toLowerCase().includes('host') ||
      lines[0].toLowerCase().includes('remark'))
  ) {
    isCsv = true;
    headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  }

  const startIdx = isCsv ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#') || line.startsWith('//')) continue;

    if (isCsv) {
      const parsedCsv = parseCsvLine(line, headers, i);
      if (parsedCsv) results.push(parsedCsv);
    } else {
      const parsedDelimited = parseDelimitedLine(line, i + 1);
      if (parsedDelimited) results.push(parsedDelimited);
    }
  }

  return results;
}

function parseCsvLine(line: string, headers: string[], rowIdx: number): ParsedAccountItem | null {
  const parts = splitCsvRow(line);
  if (parts.length === 0) return null;

  const data: Record<string, string> = {};
  headers.forEach((h, idx) => {
    if (idx < parts.length) data[h] = parts[idx].trim();
  });

  const name = data.name || data.profilename || data.email || data.username || `Imported Profile ${rowIdx + 1}`;
  let proxy: ParsedProxyInfo | undefined;
  const csvProxyHost = data.host || data.proxy_host || data.proxyhost;
  const csvProxyPort = data.port || data.proxy_port || data.proxyport;
  const csvProxyType = data.proxytype || data.proxy_type || data.protocol || 'http';
  const csvProxyUser = data.proxyuser || data.proxy_user || data.proxylogin || '';
  const csvProxyPass = data.proxypass || data.proxy_password || data.proxypassword || '';
  if (data.proxy && data.proxy !== 'noproxy') {
    proxy = parseProxyString(data.proxy);
  } else if (csvProxyHost && csvProxyType !== 'noproxy') {
    const rawProxy = `${normalizeProtocol(csvProxyType)}://${csvProxyHost}:${csvProxyPort || '8080'}:${csvProxyUser}:${csvProxyPass}`;
    proxy = parseProxyString(rawProxy);
  }

  let cookies: CookieItem[] | undefined;
  const rawCookieCell = data.cookies || data.cookie;
  if (rawCookieCell) {
    if (rawCookieCell.startsWith('[')) {
      cookies = parseJsonCookies(rawCookieCell);
    } else {
      cookies = parseNetscapeCookies(rawCookieCell);
    }
  }

  return {
    name,
    usernameOrEmail: data.email || data.username,
    password: data.password || data.pass,
    proxy,
    cookies,
    userAgent: data.useragent || data.user_agent || data.ua,
    timezone: data.timezone || undefined,
    notes: data.notes || data.remark || ((data.email || data.username) ? `Email/User: ${data.email || data.username}` : undefined),
    tags: data.tags ? data.tags.split(/[;|]/).map((t) => t.trim()).filter(Boolean) : ['Imported'],
    rawLine: line,
  };
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

function parseDelimitedLine(line: string, index: number): ParsedAccountItem | null {
  // Check delimiters: colon (:), pipe (|), semicolon (;)
  let delimiter = ':';
  if (line.includes('|')) delimiter = '|';
  else if (line.includes(';') && !line.includes('://')) delimiter = ';';

  // Check if line has embedded JSON at the end
  let jsonCookiesStr = '';
  let cleanLine = line;
  const jsonMatch = line.match(/(\[\{.*\}\])/);
  if (jsonMatch) {
    jsonCookiesStr = jsonMatch[1];
    cleanLine = line.replace(jsonMatch[1], '').trim().replace(/[:|;]$/, '');
  }

  const parts = cleanLine.split(delimiter).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let name = `Imported Profile ${index}`;
  let usernameOrEmail: string | undefined;
  let password: string | undefined;
  let proxy: ParsedProxyInfo | undefined;

  if (parts.length >= 6) {
    // email:password:proxy_host:proxy_port:proxy_user:proxy_pass
    usernameOrEmail = parts[0];
    password = parts[1];
    name = usernameOrEmail;
    proxy = {
      protocol: 'http',
      host: parts[2],
      port: parseInt(parts[3], 10) || 8080,
      username: parts[4],
      password: parts[5],
    };
  } else if (parts.length === 5) {
    // name:host:port:user:pass
    name = parts[0];
    proxy = {
      protocol: 'http',
      host: parts[1],
      port: parseInt(parts[2], 10) || 8080,
      username: parts[3],
      password: parts[4],
    };
  } else if (parts.length === 4) {
    if (Number.isNaN(Number(parts[1])) && !Number.isNaN(Number(parts[3]))) {
      // email:password:host:port
      usernameOrEmail = parts[0];
      password = parts[1];
      name = usernameOrEmail;
      proxy = { protocol: 'http', host: parts[2], port: parseInt(parts[3], 10) || 8080 };
    } else if (!Number.isNaN(Number(parts[1]))) {
      // host:port:user:pass
      name = `Proxy Profile ${parts[0]}:${parts[1]}`;
      proxy = { protocol: 'http', host: parts[0], port: parseInt(parts[1], 10) || 8080, username: parts[2], password: parts[3] };
    }
  } else if (parts.length === 3) {
    // name:host:port
    name = parts[0];
    proxy = { protocol: 'http', host: parts[1], port: parseInt(parts[2], 10) || 8080 };
  } else if (parts.length === 2) {
    if (!Number.isNaN(Number(parts[1]))) {
      // host:port
      name = `Proxy ${parts[0]}:${parts[1]}`;
      proxy = { protocol: 'http', host: parts[0], port: parseInt(parts[1], 10) || 8080 };
    } else {

      // email:pass
      usernameOrEmail = parts[0];
      password = parts[1];
      name = usernameOrEmail;
    }
  } else {
    name = parts[0];
  }

  let cookies: CookieItem[] | undefined;
  if (jsonCookiesStr) {
    cookies = parseJsonCookies(jsonCookiesStr);
  }

  return {
    name,
    usernameOrEmail,
    password,
    proxy,
    cookies,
    notes: usernameOrEmail ? `Email/Username: ${usernameOrEmail}` : undefined,
    tags: ['Imported', 'Batch-Import'],
    rawLine: line,
  };
}

function parseProxyString(raw: string): ParsedProxyInfo | undefined {
  try {
    let clean = raw.trim();
    let protocol: 'http' | 'https' | 'socks4' | 'socks5' = 'http';

    if (clean.includes('://')) {
      const proto = clean.split('://')[0].toLowerCase();
      if (proto.startsWith('socks5')) protocol = 'socks5';
      else if (proto.startsWith('socks4')) protocol = 'socks4';
      else if (proto.startsWith('https')) protocol = 'https';
      clean = clean.split('://')[1];
    }

    const parts = clean.split(':');
    if (parts.length >= 4) {
      return { protocol, host: parts[0], port: parseInt(parts[1], 10) || 8080, username: parts[2], password: parts[3] };
    } else if (parts.length >= 2) {
      return { protocol, host: parts[0], port: parseInt(parts[1], 10) || 8080 };
    }
  } catch (err) {
    log.debug('universal-importer proxy string parse failed', { err });
  }
  return undefined;
}

function normalizeProxy(p: {
  protocol?: unknown;
  host?: unknown;
  port?: unknown;
  username?: unknown;
  password?: unknown;
}): ParsedProxyInfo {
  return {
    protocol: normalizeProtocol(p.protocol),
    host: typeof p.host === 'string' && p.host ? p.host : '127.0.0.1',
    port: Number(p.port) || 8080,
    username: typeof p.username === 'string' ? p.username : undefined,
    password: typeof p.password === 'string' ? p.password : undefined,
  };
}

/**
 * Executes Bulk Account Import with Fingerprint Synthesis, Proxy Binding & Cookie Injection
 */
export async function executeBulkImport(
  accounts: ParsedAccountItem[],
  options: BulkImportOptions = {}
): Promise<BulkImportResult> {
  const startTime = Date.now();
  const createdProfileIds: string[] = [];
  const createdProfilesSummary: { id: string; name: string; proxyBound: boolean; cookiesCount: number }[] = [];
  const errors: string[] = [];

  const folder = options.folder || 'General';
  const os = options.os || 'windows';
  const engine = options.browserEngine || 'chrome';

  for (let idx = 0; idx < accounts.length; idx++) {
    const acc = accounts[idx];
    try {
      // 1. Generate Stealth Fingerprint & Profile Settings
      const baseDefaults = getDefaultProfileSettings(os === 'macos' ? 'mac' : os === 'linux' ? 'linux' : 'windows');
      const envSettings = generateConsistentEnvironmentSettings();

      // 2. Create Proxy (if proxy configured)
      let boundProxyId: string | undefined;
      if (acc.proxy?.host && acc.proxy.port) {
        try {
          const proxyRec = createProxy({
            name: `${acc.name} Proxy (${acc.proxy.host})`,
            protocol: acc.proxy.protocol,
            host: acc.proxy.host,
            port: acc.proxy.port,
            username: acc.proxy.username,
            password: acc.proxy.password,
            notes: `Auto-imported for profile "${acc.name}"`,
          });
          boundProxyId = proxyRec.id;
        } catch (proxyErr: unknown) {
          errors.push(`Proxy creation warning for "${acc.name}": ${proxyErr instanceof Error ? proxyErr.message : String(proxyErr)}`);
        }
      }

      // 3. Build Profile DTO
      const combinedTags = Array.from(new Set([...(acc.tags || ['Imported']), ...(options.tags || [])]));

      const profileDto = {
        name: acc.name,
        description: acc.usernameOrEmail ? `Account: ${acc.usernameOrEmail}` : 'Bulk imported profile',
        folder,
        notes: acc.notes || '',
        tags: combinedTags,
        settings: {
          ...baseDefaults,
          ...envSettings,
          browser: {
            ...baseDefaults.browser,
            engine,
            userAgent: acc.userAgent || envSettings.browser.userAgent || baseDefaults.browser.userAgent,
            hardwareAcceleration: true,
            restoreSessionOnStartup: true,
          },
          fingerprint: {
            ...baseDefaults.fingerprint,
            canvasNoise: true,
            audioContextNoise: true,
          },
          display: {
            ...baseDefaults.display,
            ...(acc.screenWidth && acc.screenHeight
              ? { screenWidth: acc.screenWidth, screenHeight: acc.screenHeight }
              : {}),
          },
          locale: {
            ...baseDefaults.locale,
            ...(acc.timezone ? { timezone: acc.timezone } : {}),
            ...(acc.language ? { language: acc.language, languagesList: [acc.language, 'en'] } : {}),
          },
          network: {
            ...baseDefaults.network,
            directConnection: !boundProxyId,
            proxyId: boundProxyId,
          },
        },
      };


      const created = createProfile(profileDto);
      createdProfileIds.push(created.id);

      // 4. Inject Cookies (if provided)
      let cookieCount = 0;
      if (acc.cookies && acc.cookies.length > 0) {
        try {
          const storageDir = getProfileStoragePath(created.id);
          if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
          const cookiesFile = path.join(storageDir, 'mahi_cookies.json');

          const readyCookies = acc.cookies.map((c) => ({ ...c, id: crypto.randomUUID(), profileId: created.id }));
          fs.writeFileSync(cookiesFile, JSON.stringify(readyCookies, null, 2), 'utf8');
          cookieCount = readyCookies.length;
        } catch (cErr: unknown) {
          errors.push(`Cookie injection failed for "${acc.name}": ${cErr instanceof Error ? cErr.message : String(cErr)}`);
        }
      }

      createdProfilesSummary.push({
        id: created.id,
        name: created.name,
        proxyBound: Boolean(boundProxyId),
        cookiesCount: cookieCount,
      });
    } catch (err: unknown) {
      errors.push(`Failed to import account "${acc.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const durationMs = Date.now() - startTime;

  logActivity(
    'PROFILE',
    'INFO',
    'BULK_ACCOUNTS_IMPORTED',
    `Bulk imported ${createdProfileIds.length} profiles with full stealth fingerprints & proxies in ${durationMs}ms.`,
    undefined,
    undefined,
    { total: accounts.length, success: createdProfileIds.length, errorsCount: errors.length }
  );

  return {
    success: createdProfileIds.length > 0,
    totalImported: createdProfileIds.length,
    failedCount: accounts.length - createdProfileIds.length,
    createdProfileIds,
    createdProfiles: createdProfilesSummary,
    errors,
    durationMs,
  };
}
