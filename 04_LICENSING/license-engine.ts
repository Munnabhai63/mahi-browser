import crypto from 'node:crypto';
import { getDatabase } from '../06_DATABASE/connection.js';
import { isPostgresConfigured } from '../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../06_DATABASE/prisma-client.js';
import {
  LicenseRecord,
  LicenseDurationType,
  LicenseStatus,
  CreateLicenseDTO,
  CreateLicenseResponse,
  ActivatedDevice,
  LicenseValidationResult,
  ExtendLicenseDTO,
} from '../10_CONFIG/shared/types/license.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { getDeviceId, getLegacyDeviceId, getDeviceName } from '../03_HARDWARE/device-id.js';

// Offline grace period in milliseconds (72 hours)
const OFFLINE_GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;

export function normalizeLicenseKey(key: string): string {
  if (!key) return '';
  return key.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

export function hashLicenseKey(normalizedKey: string): string {
  return crypto.createHash('sha256').update(normalizedKey.replace(/-/g, '')).digest('hex');
}

export function generateLicenseKey(): { rawKey: string; keyHash: string; keyMasked: string } {
  const bytes = crypto.randomBytes(16).toString('hex').toUpperCase();
  const rawKey = `MAHI-${bytes.substring(0, 4)}-${bytes.substring(4, 8)}-${bytes.substring(8, 12)}-${bytes.substring(12, 16)}`;
  const keyHash = hashLicenseKey(rawKey);
  const last4 = bytes.substring(12, 16);
  const keyMasked = `MAHI-****-****-${last4}`;

  return { rawKey, keyHash, keyMasked };
}

export function calculateExpiryDate(durationType: LicenseDurationType, startsAtISO: string, customExpiresAt?: string): string | null {
  const start = new Date(startsAtISO).getTime();

  switch (durationType) {
    case '1_DAY':
      return new Date(start + 1 * 24 * 60 * 60 * 1000).toISOString();
    case '7_DAYS':
      return new Date(start + 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30_DAYS':
      return new Date(start + 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90_DAYS':
      return new Date(start + 90 * 24 * 60 * 60 * 1000).toISOString();
    case '1_YEAR':
      return new Date(start + 365 * 24 * 60 * 60 * 1000).toISOString();
    case 'LIFETIME':
      return null;
    case 'CUSTOM':
      return customExpiresAt ? new Date(customExpiresAt).toISOString() : new Date(start + 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(start + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

/**
 * Server-side evaluation of real license status based on current UTC time standard.
 */
export function evaluateServerStatus(status: LicenseStatus, expiresAt: string | null, revokedAt: string | null): LicenseStatus {
  if (status === 'REVOKED' || revokedAt) {
    return 'REVOKED';
  }
  if (status === 'SUSPENDED') {
    return 'SUSPENDED';
  }
  if (expiresAt) {
    const now = Date.now();
    const expiryTime = new Date(expiresAt).getTime();
    if (now >= expiryTime) {
      return 'EXPIRED';
    }
  }
  return status;
}

/**
 * Owner/Admin creates a new cryptographically generated license.
 */
export function createLicense(dto: CreateLicenseDTO, createdBy = 'OWNER'): CreateLicenseResponse {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const startsAt = dto.startsAt ? new Date(dto.startsAt).toISOString() : now;
  const expiresAt = calculateExpiryDate(dto.durationType, startsAt, dto.expiresAt);

  const { rawKey, keyHash, keyMasked } = generateLicenseKey();

  db.prepare(`
    INSERT INTO licenses (
      id, license_key_hash, key_masked, customer_name, account_id,
      status, duration_type, max_devices, starts_at, expires_at,
      created_at, created_by, revoked_at, last_validation_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    keyHash,
    keyMasked,
    dto.customerName.trim(),
    dto.accountId?.trim() || null,
    'ACTIVE',
    dto.durationType,
    dto.maxDevices && dto.maxDevices > 0 ? dto.maxDevices : 1,
    startsAt,
    expiresAt,
    now,
    createdBy,
    null,
    null,
    dto.notes || null
  );

  logActivity(
    'SECURITY',
    'SUCCESS',
    'Create License',
    `Created ${dto.durationType} license for "${dto.customerName}" (Max Devices: ${dto.maxDevices || 1})`
  );

  const license = getLicenseById(id)!;
  return {
    success: true,
    rawLicenseKey: rawKey,
    license,
  };
}

/**
 * Retrieves a license by its ID with active device counts.
 */
export function getLicenseById(id: string): LicenseRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(id) as any;
  if (!row) return null;

  const devicesCount = (db.prepare(
    "SELECT COUNT(*) as count FROM license_devices WHERE license_id = ? AND status = 'ACTIVE'"
  ).get(id) as any)?.count || 0;

  const evaluatedStatus = evaluateServerStatus(row.status, row.expires_at, row.revoked_at);
  if (evaluatedStatus !== row.status) {
    db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run(evaluatedStatus, id);
  }

  return {
    id: row.id,
    keyMasked: row.key_masked,
    customerName: row.customer_name,
    accountId: row.account_id || undefined,
    status: evaluatedStatus,
    durationType: row.duration_type,
    maxDevices: row.max_devices,
    activeDevicesCount: devicesCount,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    revokedAt: row.revoked_at,
    lastValidationAt: row.last_validation_at,
    notes: row.notes || undefined,
  };
}

/**
 * Retrieves all licenses for the Owner/Admin dashboard.
 */
export function getLicenses(filter?: { status?: string; searchQuery?: string }): LicenseRecord[] {
  const db = getDatabase();
  let query = 'SELECT * FROM licenses WHERE 1=1';
  const params: any[] = [];

  if (filter?.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.searchQuery) {
    query += ' AND (customer_name LIKE ? OR key_masked LIKE ? OR notes LIKE ?)';
    const term = `%${filter.searchQuery}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => {
    const devicesCount = (db.prepare(
      "SELECT COUNT(*) as count FROM license_devices WHERE license_id = ? AND status = 'ACTIVE'"
    ).get(r.id) as any)?.count || 0;

    const evaluatedStatus = evaluateServerStatus(r.status, r.expires_at, r.revoked_at);

    return {
      id: r.id,
      keyMasked: r.key_masked,
      customerName: r.customer_name,
      accountId: r.account_id || undefined,
      status: evaluatedStatus,
      durationType: r.duration_type,
      maxDevices: r.max_devices,
      activeDevicesCount: devicesCount,
      startsAt: r.starts_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      createdBy: r.created_by,
      revokedAt: r.revoked_at,
      lastValidationAt: r.last_validation_at,
      notes: r.notes || undefined,
    };
  });
}

/**
 * Activates a license on the user's device.
 */
export function activateLicense(
  rawKey: string,
  deviceId = getDeviceId(),
  deviceName = getDeviceName(),
  accountId?: string
): { success: boolean; status: LicenseStatus; license?: LicenseRecord; message?: string } {
  const db = getDatabase();
  const normalizedKey = normalizeLicenseKey(rawKey);
  if (!normalizedKey || normalizedKey.length < 10) {
    return { success: false, status: 'NOT_ACTIVATED', message: 'Invalid license key format.' };
  }

  const keyHash = hashLicenseKey(normalizedKey);
  const row = db.prepare('SELECT * FROM licenses WHERE license_key_hash = ?').get(keyHash) as any;

  if (!row) {
    return { success: false, status: 'NOT_ACTIVATED', message: 'Invalid license key. No matching license found.' };
  }

  const evaluatedStatus = evaluateServerStatus(row.status, row.expires_at, row.revoked_at);

  if (evaluatedStatus === 'REVOKED') {
    return { success: false, status: 'REVOKED', message: 'Your MAHI Pro license has been revoked.' };
  }

  if (evaluatedStatus === 'EXPIRED') {
    return { success: false, status: 'EXPIRED', message: 'This license has expired.' };
  }

  if (row.account_id && accountId && row.account_id !== accountId) {
    return { success: false, status: evaluatedStatus, message: 'Account mismatch: License is bound to a different MAHI account.' };
  }

  // Check device registration (supports both new stable HWID and legacy v1.2.2 deviceId)
  const legacyDeviceId = deviceId === getDeviceId() ? getLegacyDeviceId() : undefined;
  const existingDevice = legacyDeviceId
    ? (db.prepare(
        'SELECT * FROM license_devices WHERE license_id = ? AND device_id IN (?, ?)'
      ).get(row.id, deviceId, legacyDeviceId) as any)
    : (db.prepare(
        'SELECT * FROM license_devices WHERE license_id = ? AND device_id = ?'
      ).get(row.id, deviceId) as any);

  const now = new Date().toISOString();

  if (existingDevice) {
    db.prepare("UPDATE license_devices SET status = 'ACTIVE', device_id = ?, last_seen_at = ? WHERE id = ?").run(
      deviceId,
      now,
      existingDevice.id
    );
  } else {
    // Check max devices limit
    const activeCount = (db.prepare(
      "SELECT COUNT(*) as count FROM license_devices WHERE license_id = ? AND status = 'ACTIVE'"
    ).get(row.id) as any)?.count || 0;

    if (activeCount >= row.max_devices) {
      return {
        success: false,
        status: 'SUSPENDED',
        message: `Device activation limit reached (${activeCount}/${row.max_devices}). Please deactivate an existing device first.`,
      };
    }

    db.prepare(`
      INSERT INTO license_devices (id, license_id, device_id, device_name, activated_at, last_seen_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(crypto.randomUUID(), row.id, deviceId, deviceName, now, now);
  }

  // Update validation timestamp
  db.prepare("UPDATE licenses SET status = 'ACTIVE', last_validation_at = ? WHERE id = ?").run(now, row.id);

  // Cache locally
  const graceExpires = new Date(Date.now() + OFFLINE_GRACE_PERIOD_MS).toISOString();
  db.prepare('DELETE FROM local_license_cache').run();
  db.prepare(`
    INSERT INTO local_license_cache (id, license_id, license_key_hash, device_id, cached_status, last_verified_at, grace_expires_at, signature)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    row.id,
    keyHash,
    deviceId,
    now,
    graceExpires,
    crypto.createHmac('sha256', 'mahi_salt').update(`${row.id}|ACTIVE|${graceExpires}`).digest('hex')
  );

  logActivity('SECURITY', 'SUCCESS', 'Activate License', `Device "${deviceName}" activated for "${row.customer_name}"`, undefined, row.customer_name);

  const fullLicense = getLicenseById(row.id)!;
  return {
    success: true,
    status: 'ACTIVE',
    license: fullLicense,
    message: 'MAHI Pro license successfully activated!',
  };
}

/**
 * Validates the currently active license for the device.
 */
export function validateCurrentLicense(targetDeviceId?: string): LicenseValidationResult {
  const db = getDatabase();
  const cache = db.prepare('SELECT * FROM local_license_cache LIMIT 1').get() as any;

  if (!cache) {
    return { isValid: false, status: 'NOT_ACTIVATED', message: 'No license active on this device.' };
  }

  const license = getLicenseById(cache.license_id);
  if (!license) {
    return { isValid: false, status: 'NOT_ACTIVATED', message: 'License record not found.' };
  }

  if (license.status === 'REVOKED') {
    return { isValid: false, status: 'REVOKED', license, message: 'Your MAHI Pro license has been revoked.' };
  }

  if (license.status === 'EXPIRED') {
    return { isValid: false, status: 'EXPIRED', license, message: 'Your MAHI Pro license has expired.' };
  }

  // Check device status (backward-compatible against stable HWID, cached device_id, and legacy v1.2.2 ID)
  const candidateDeviceIds = targetDeviceId
    ? [targetDeviceId]
    : Array.from(new Set([getDeviceId(), cache.device_id, getLegacyDeviceId()].filter(Boolean)));

  let device: any = null;
  for (const cid of candidateDeviceIds) {
    device = db.prepare(
      "SELECT * FROM license_devices WHERE license_id = ? AND device_id = ? AND status = 'ACTIVE'"
    ).get(license.id, cid);
    if (device) break;
  }

  if (!device) {
    return { isValid: false, status: 'SUSPENDED', license, message: 'This device is not authorized or was deactivated.' };
  }

  // Update last seen
  const now = new Date().toISOString();
  db.prepare('UPDATE license_devices SET last_seen_at = ? WHERE id = ?').run(
    now,
    device.id
  );
  db.prepare('UPDATE licenses SET last_validation_at = ? WHERE id = ?').run(now, license.id);

  return {
    isValid: true,
    status: 'ACTIVE',
    license,
    message: 'License is active.',
  };
}

/**
 * Revokes a license (Admin/Owner action).
 */
export function revokeLicense(licenseId: string, reason = 'Revoked by administrator'): boolean | Promise<boolean> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  const pgReady = !!(prisma && (prisma as any).licenses && (prisma as any).license_devices
      && typeof (prisma as any).licenses.findFirst === 'function'
      && typeof (prisma as any).licenses.update === 'function'
      && (prisma as any).commercial_audit_logs
      && typeof (prisma as any).commercial_audit_logs.create === 'function'
      && typeof (prisma as any).license_devices.updateMany === 'function');
  if (prisma && !pgReady) console.warn('[LicenseEngine][PG_CAPABILITY_MISSING] licenses models unavailable; using local SQLite');
  const pgPath = !!(prisma && pgReady);

  if (!pgPath) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const res = db.prepare(`
      UPDATE licenses 
      SET status = 'REVOKED', revoked_at = ?, notes = COALESCE(notes || ' | ', '') || ?
      WHERE id = ?
    `).run(now, `[REVOKED: ${reason}]`, licenseId);

    if (res.changes > 0) {
      db.prepare("UPDATE license_devices SET status = 'DEACTIVATED' WHERE license_id = ?").run(licenseId);
      db.prepare("UPDATE local_license_cache SET cached_status = 'REVOKED' WHERE license_id = ?").run(licenseId);
      logActivity('SECURITY', 'WARNING', 'Revoke License', `License ID ${licenseId} revoked: ${reason}`);
      return true;
    }
    return false;
  }

  // PG branch - SEQUENTIAL ops ONLY (NO $transaction; same contract as F5/3B1-REPAIR):
  return (async () => {
    // 1) const existing = await prisma.licenses.findFirst({ where: { id: licenseId } });
    const existing = await (prisma as any).licenses.findFirst({ where: { id: licenseId } });
    if (!existing) return false;

    // 2) const now = new Date().toISOString();
    const now = new Date().toISOString();
    try {
      await (prisma as any).licenses.update({
        where: { id: existing.id },
        data: {
          status: 'REVOKED',
          revoked_at: now,
          notes: [existing.notes, `[REVOKED: ${reason}]`].filter(Boolean).join(' | '),
        },
      });
    } catch (e: any) {
      throw e;
    }

    // 3) try { await prisma.license_devices.updateMany({ where: { license_id: existing.id }, data: { status: 'DEACTIVATED' } }); } catch (e: any) { console.warn(...); }
    try {
      await (prisma as any).license_devices.updateMany({
        where: { license_id: existing.id },
        data: { status: 'DEACTIVATED' },
      });
    } catch (e: any) {
      console.warn('[LicenseEngine] Failed to deactivate license devices in PG:', e?.message || e);
    }

    // 4) local_license_cache UNTOUCHED (log: '[LicenseEngine][PG_SKIP] local_license_cache is desktop-only; not applicable in Postgres')
    console.log('[LicenseEngine][PG_SKIP] local_license_cache is desktop-only; not applicable in Postgres');

    // 5) audit (warn-only): action 'LICENSE_REVOKED', target_type 'LICENSE', target_id licenseId, details JSON.stringify({ reason })
    try {
      await (prisma as any).commercial_audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          actor_id: 'ADMIN',
          actor_name: 'ADMIN',
          actor_role: 'ADMIN',
          action: 'LICENSE_REVOKED',
          target_type: 'LICENSE',
          target_id: licenseId,
          details: JSON.stringify({ reason }),
          result: 'SUCCESS',
          created_at: now,
        },
      });
    } catch (e: any) {
      console.warn('[LicenseEngine] Failed to create audit log in PG:', e?.message || e);
    }

    // 6) try { logActivity(...) } catch warn
    try {
      logActivity('SECURITY', 'WARNING', 'Revoke License', `License ID ${licenseId} revoked: ${reason}`);
    } catch (e: any) {
      console.warn('[LicenseEngine] logActivity failed:', e?.message || e);
    }

    // 7) return true;
    return true;
  })();
}

/**
 * Extends the expiry of an existing license (Admin/Owner action).
 */
export function extendLicense(dto: ExtendLicenseDTO): LicenseRecord | null | Promise<LicenseRecord | null> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  const pgReady = !!(prisma && (prisma as any).licenses && (prisma as any).license_devices
      && typeof (prisma as any).licenses.findFirst === 'function'
      && typeof (prisma as any).licenses.update === 'function'
      && (prisma as any).commercial_audit_logs
      && typeof (prisma as any).commercial_audit_logs.create === 'function'
      && typeof (prisma as any).license_devices.updateMany === 'function');
  if (prisma && !pgReady) console.warn('[LicenseEngine][PG_CAPABILITY_MISSING] licenses models unavailable; using local SQLite');
  const pgPath = !!(prisma && pgReady);

  if (!pgPath) {
    const db = getDatabase();
    const current = getLicenseById(dto.licenseId);
    if (!current) return null;

    let newExpiresAt: string | null = null;
    if (dto.newExpiresAt) {
      newExpiresAt = new Date(dto.newExpiresAt).toISOString();
    } else if (dto.additionalDays && dto.additionalDays > 0) {
      const baseTime = current.expiresAt ? Math.max(Date.now(), new Date(current.expiresAt).getTime()) : Date.now();
      newExpiresAt = new Date(baseTime + dto.additionalDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const newStatus = current.status === 'EXPIRED' ? 'ACTIVE' : current.status;

    db.prepare(`
      UPDATE licenses 
      SET expires_at = ?, status = ?, revoked_at = NULL
      WHERE id = ?
    `).run(newExpiresAt, newStatus, dto.licenseId);

    logActivity(
      'SECURITY',
      'SUCCESS',
      'Extend License',
      `Extended license "${current.customerName}" to ${newExpiresAt || 'Lifetime'}`
    );

    return getLicenseById(dto.licenseId);
  }

  // PG branch - SEQUENTIAL ops ONLY:
  return (async () => {
    // 1) const existing = await prisma.licenses.findFirst({ where: { id: dto.licenseId } });
    const existing = await (prisma as any).licenses.findFirst({ where: { id: dto.licenseId } });
    if (!existing) return null;

    // 2) calculate newExpiresAt from dto (same Math.max(Date.now(), new Date(expires_at).getTime()) base time).
    let newExpiresAt: string | null = null;
    if (dto.newExpiresAt) {
      newExpiresAt = new Date(dto.newExpiresAt).toISOString();
    } else if (dto.additionalDays && dto.additionalDays > 0) {
      const baseTime = existing.expires_at ? Math.max(Date.now(), new Date(existing.expires_at).getTime()) : Date.now();
      newExpiresAt = new Date(baseTime + dto.additionalDays * 24 * 60 * 60 * 1000).toISOString();
    }

    // 3) const newStatus = existing.status === 'EXPIRED' ? 'ACTIVE' : existing.status;
    const newStatus = existing.status === 'EXPIRED' ? 'ACTIVE' : existing.status;

    // 4) await prisma.licenses.update({ where: { id: existing.id }, data: { expires_at: newExpiresAt, status: newStatus, revoked_at: null } });
    await (prisma as any).licenses.update({
      where: { id: existing.id },
      data: { expires_at: newExpiresAt, status: newStatus, revoked_at: null },
    });

    // 5) audit (warn-only): action 'LICENSE_EXTENDED', details JSON.stringify({ newExpiresAt, customerName: existing.customer_name })
    const now = new Date().toISOString();
    try {
      await (prisma as any).commercial_audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          actor_id: 'ADMIN',
          actor_name: 'ADMIN',
          actor_role: 'ADMIN',
          action: 'LICENSE_EXTENDED',
          target_type: 'LICENSE',
          target_id: dto.licenseId,
          details: JSON.stringify({ newExpiresAt, customerName: existing.customer_name }),
          result: 'SUCCESS',
          created_at: now,
        },
      });
    } catch (e: any) {
      console.warn('[LicenseEngine] Failed to create audit log in PG:', e?.message || e);
    }

    // 6) try { logActivity(...) } catch warn
    try {
      logActivity(
        'SECURITY',
        'SUCCESS',
        'Extend License',
        `Extended license "${existing.customer_name}" to ${newExpiresAt || 'Lifetime'}`
      );
    } catch (e: any) {
      console.warn('[LicenseEngine] logActivity failed:', e?.message || e);
    }

    // 7) return record shaped EXACTLY like legacy getLicenseById would return:
    let devicesCount = 0;
    try {
      devicesCount = await (prisma as any).license_devices.count({
        where: { license_id: dto.licenseId, status: 'ACTIVE' },
      });
    } catch (e: any) {
      console.warn('[LicenseEngine] Failed to count devices in PG:', e?.message || e);
    }

    const evaluatedStatus = evaluateServerStatus(newStatus as LicenseStatus, newExpiresAt, null);
    if (evaluatedStatus !== newStatus) {
      try {
        await (prisma as any).licenses.update({
          where: { id: existing.id },
          data: { status: evaluatedStatus },
        });
      } catch (e: any) {
        console.warn('[LicenseEngine] Failed to update evaluated status in PG:', e?.message || e);
      }
    }

    const record: LicenseRecord = {
      id: existing.id,
      keyMasked: existing.key_masked,
      customerName: existing.customer_name,
      accountId: existing.account_id || undefined,
      status: evaluatedStatus,
      durationType: existing.duration_type as LicenseDurationType,
      maxDevices: existing.max_devices,
      activeDevicesCount: devicesCount,
      startsAt: existing.starts_at,
      expiresAt: newExpiresAt,
      createdAt: existing.created_at,
      createdBy: existing.created_by,
      revokedAt: null,
      lastValidationAt: existing.last_validation_at,
      notes: existing.notes || undefined,
    };

    return record;
  })();
}

/**
 * Retrieves activated devices for a license.
 */
export function getLicenseDevices(licenseId: string): ActivatedDevice[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM license_devices WHERE license_id = ? ORDER BY activated_at DESC').all(licenseId) as any[];
  return rows.map((r) => ({
    id: r.id,
    licenseId: r.license_id,
    deviceId: r.device_id,
    deviceName: r.device_name,
    ipAddress: r.ip_address || undefined,
    activatedAt: r.activated_at,
    lastSeenAt: r.last_seen_at,
    status: r.status,
  }));
}

/**
 * Deactivates a device from a license.
 */
export function deactivateDevice(licenseId: string, deviceId: string): boolean {
  const db = getDatabase();
  const res = db.prepare(
    "UPDATE license_devices SET status = 'DEACTIVATED' WHERE license_id = ? AND device_id = ?"
  ).run(licenseId, deviceId);

  if (res.changes > 0) {
    db.prepare('DELETE FROM local_license_cache WHERE license_id = ? AND device_id = ?').run(licenseId, deviceId);
    logActivity('SECURITY', 'INFO', 'Deactivate Device', `Device ${deviceId} deactivated from license ${licenseId}`);
    return true;
  }
  return false;
}
