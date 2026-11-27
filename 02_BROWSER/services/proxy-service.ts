import crypto from 'node:crypto';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  ProxyItem,
  CreateProxyDTO,
  UpdateProxyDTO,
  ProxyTestResult,
  ProxyStatus,
} from '../../10_CONFIG/shared/types/proxy.js';
import { encryptData, decryptData } from '../../08_SECURITY/encryption.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { testProxy } from './proxy-test-service.js';
import { assertCanCreateProxy } from '../../08_SECURITY/freemium-guard.js';

export function getProxies(): ProxyItem[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM profile_proxies pp WHERE pp.proxy_id = p.id) as assigned_count
    FROM proxies p
    ORDER BY p.name ASC
  `).all() as {
    id: string;
    name: string;
    protocol: string;
    host: string;
    port: number;
    username: string | null;
    password_encrypted: string | null;
    country_region: string | null;
    country_name: string | null;
    public_ip: string | null;
    notes: string | null;
    status: string;
    latency_ms: number | null;
    last_tested_at: string | null;
    assigned_count: number;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    protocol: r.protocol as ProxyItem['protocol'],
    host: r.host,
    port: r.port,
    username: r.username || undefined,
    hasPassword: Boolean(r.password_encrypted),
    countryRegion: r.country_region || undefined,
    countryName: r.country_name || undefined,
    city: (r as any).city || undefined,
    ip: r.public_ip || undefined,
    notes: r.notes || undefined,
    status: r.status as ProxyStatus,
    latencyMs: r.latency_ms || undefined,
    lastTestedAt: r.last_tested_at || undefined,
    assignedProfileCount: Number(r.assigned_count) || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getProxyById(id: string): ProxyItem | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM profile_proxies pp WHERE pp.proxy_id = p.id) as assigned_count
    FROM proxies p
    WHERE p.id = ?
  `).get(id) as {
    id: string;
    name: string;
    protocol: string;
    host: string;
    port: number;
    username: string | null;
    password_encrypted: string | null;
    country_region: string | null;
    country_name: string | null;
    public_ip: string | null;
    notes: string | null;
    status: string;
    latency_ms: number | null;
    last_tested_at: string | null;
    assigned_count: number;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    protocol: row.protocol as ProxyItem['protocol'],
    host: row.host,
    port: row.port,
    username: row.username || undefined,
    hasPassword: Boolean(row.password_encrypted),
    countryRegion: row.country_region || undefined,
    countryName: row.country_name || undefined,
    city: (row as any).city || undefined,
    ip: row.public_ip || undefined,
    notes: row.notes || undefined,
    status: row.status as ProxyStatus,
    latencyMs: row.latency_ms || undefined,
    lastTestedAt: row.last_tested_at || undefined,
    assignedProfileCount: Number(row.assigned_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDecryptedProxyCredentials(id: string): { username?: string; password?: string } | null {
  const db = getDatabase();
  const row = db.prepare('SELECT username, password_encrypted FROM proxies WHERE id = ?').get(id) as {
    username: string | null;
    password_encrypted: string | null;
  } | undefined;

  if (!row) return null;

  let password: string | undefined = undefined;
  if (row.password_encrypted) {
    try {
      password = decryptData(row.password_encrypted);
    } catch {
      password = undefined;
    }
  }

  return {
    username: row.username || undefined,
    password,
  };
}

export function createProxy(dto: CreateProxyDTO): ProxyItem {
  assertCanCreateProxy(1, (dto as any)?.ownerId);

  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const encryptedPassword = dto.password ? encryptData(dto.password) : null;

  db.prepare(`
    INSERT INTO proxies (id, name, protocol, host, port, username, password_encrypted, country_region, country_name, public_ip, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNKNOWN', ?, ?)
  `).run(
    id,
    dto.name,
    dto.protocol,
    dto.host,
    dto.port,
    dto.username || null,
    encryptedPassword,
    dto.countryRegion || null,
    dto.countryName || null,
    dto.ip || null,
    dto.notes || null,
    now,
    now
  );

  if (dto.city) {
    try { db.prepare('UPDATE proxies SET city = ? WHERE id = ?').run(dto.city, id); } catch {}
  }

  logActivity('PROXY', 'SUCCESS', 'Create Proxy', `Created proxy "${dto.name}" (${dto.protocol}://${dto.host}:${dto.port})`);

  return getProxyById(id)!;
}

export function updateProxy(id: string, dto: UpdateProxyDTO): ProxyItem {
  const db = getDatabase();
  const existing = getProxyById(id);
  if (!existing) {
    throw new Error(`Proxy with ID ${id} not found`);
  }

  const now = new Date().toISOString();
  let encryptedPassword = undefined;
  if (dto.password !== undefined) {
    encryptedPassword = dto.password ? encryptData(dto.password) : null;
  }

  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (dto.name !== undefined) { updates.push('name = ?'); params.push(dto.name); }
  if (dto.protocol !== undefined) { updates.push('protocol = ?'); params.push(dto.protocol); }
  if (dto.host !== undefined) { updates.push('host = ?'); params.push(dto.host); }
  if (dto.port !== undefined) { updates.push('port = ?'); params.push(dto.port); }
  if (dto.username !== undefined) { updates.push('username = ?'); params.push(dto.username || null); }
  if (encryptedPassword !== undefined) { updates.push('password_encrypted = ?'); params.push(encryptedPassword); }
  if (dto.countryRegion !== undefined) { updates.push('country_region = ?'); params.push(dto.countryRegion || null); }
  if (dto.countryName !== undefined) { updates.push('country_name = ?'); params.push(dto.countryName || null); }
  if (dto.ip !== undefined) { updates.push('public_ip = ?'); params.push(dto.ip || null); }
  if (dto.notes !== undefined) { updates.push('notes = ?'); params.push(dto.notes || null); }

  params.push(id);
  db.prepare(`UPDATE proxies SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logActivity('PROXY', 'INFO', 'Update Proxy', `Updated proxy "${dto.name || existing.name}"`);

  return getProxyById(id)!;
}

export function deleteProxy(id: string): boolean {
  const db = getDatabase();
  const existing = getProxyById(id);
  if (!existing) return false;

  db.prepare('DELETE FROM profile_proxies WHERE proxy_id = ?').run(id);
  db.prepare('DELETE FROM proxies WHERE id = ?').run(id);
  logActivity('PROXY', 'WARNING', 'Delete Proxy', `Deleted proxy "${existing.name}"`);
  return true;
}

export async function testProxyConnection(dto: Partial<CreateProxyDTO>): Promise<ProxyTestResult> {
  return await testProxy(dto);
}

export async function testAndSaveProxyStatus(id: string): Promise<ProxyTestResult> {
  const proxy = getProxyById(id);
  if (!proxy) {
    return { success: false, latencyMs: 0, errorMessage: 'Proxy not found' };
  }

  const credentials = getDecryptedProxyCredentials(id);
  const result = await testProxy({
    host: proxy.host,
    port: proxy.port,
    protocol: proxy.protocol,
    username: credentials?.username,
    password: credentials?.password,
  });

  const db = getDatabase();
  const now = new Date().toISOString();
  const status: ProxyStatus = result.success ? 'CONNECTED' : 'FAILED';

  db.prepare(`
    UPDATE proxies 
    SET status = ?, latency_ms = ?, country_region = COALESCE(?, country_region), country_name = COALESCE(?, country_name), public_ip = COALESCE(?, public_ip), last_tested_at = ?, updated_at = ?
    WHERE id = ?
  `).run(status, result.latencyMs, result.countryCode || null, result.country || null, result.ip || null, now, now, id);

  return result;
}

/**
 * Universal Proxy String Parser
 * Handles:
 * 1. ip:port:username:password
 * 2. username:password@ip:port
 * 3. protocol://username:password@ip:port
 * 4. protocol://ip:port:username:password
 * 5. ip:port
 */
export function parseUniversalProxyString(raw: string): CreateProxyDTO | null {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str) return null;

  let protocol: ProxyItem['protocol'] = 'http';
  let host = '';
  let port = 0;
  let username: string | undefined;
  let password: string | undefined;

  let clean = str;

  // Check URL scheme
  const schemeMatch = clean.match(/^([a-zA-Z0-9]+):\/\/(.*)$/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === 'http' || scheme === 'https' || scheme === 'socks4' || scheme === 'socks5') {
      protocol = scheme as ProxyItem['protocol'];
    }
    clean = schemeMatch[2];
  }

  // Format 1: user:pass@host:port
  if (clean.includes('@')) {
    const [authPart, hostPart] = clean.split('@');
    if (authPart && hostPart) {
      const [u, ...pParts] = authPart.split(':');
      username = u;
      password = pParts.join(':');

      const [h, p] = hostPart.split(':');
      host = h;
      port = parseInt(p, 10);
    }
  } else if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts.length === 2) {
      // host:port
      host = parts[0];
      port = parseInt(parts[1], 10);
    } else if (parts.length >= 4) {
      // host:port:user:pass
      host = parts[0];
      port = parseInt(parts[1], 10);
      username = parts[2];
      password = parts.slice(3).join(':');
    } else if (parts.length === 3) {
      host = parts[0];
      port = parseInt(parts[1], 10);
      username = parts[2];
    }
  }

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    return null;
  }

  const name = `${protocol.toUpperCase()} · ${host}:${port}`;

  return {
    name,
    protocol,
    host: host.trim(),
    port,
    username: username ? username.trim() : undefined,
    password: password ? password.trim() : undefined,
  };
}

/**
 * Parses raw proxy string, saves to database, tests latency, and returns the record.
 */
export async function parseAndCreateProxy(rawString: string, customName?: string): Promise<{ proxy: ProxyItem; testResult: ProxyTestResult }> {
  const parsed = parseUniversalProxyString(rawString);
  if (!parsed) {
    throw new Error('Invalid proxy format. Supported formats: ip:port:user:pass, http://user:pass@ip:port, or ip:port');
  }

  if (customName && customName.trim()) {
    parsed.name = customName.trim();
  }

  const proxy = createProxy(parsed);
  const testResult = await testAndSaveProxyStatus(proxy.id);

  const updatedProxy = getProxyById(proxy.id)!;
  return { proxy: updatedProxy, testResult };
}

