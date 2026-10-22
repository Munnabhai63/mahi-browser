import crypto from 'node:crypto';
import os from 'node:os';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { CommercialDevice, CommercialDeviceStatus, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';
import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import { logCommercialAudit } from './commercial-audit-service.js';

export function registerOrUpdateDevice(params: {
  userId: string;
  licenseId?: string;
  deviceId?: string;
  deviceName?: string;
  maxAllowedDevices?: number;
  ipAddress?: string;
}): { success: boolean; device?: CommercialDevice; message?: string } {
  const db = getDatabase();
  const deviceId = params.deviceId || getDeviceId();
  const deviceName = params.deviceName || getDeviceName();
  const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
  const clientVersion = '1.0.0';
  const now = new Date().toISOString();
  const maxAllowed = params.maxAllowedDevices && params.maxAllowedDevices > 0 ? params.maxAllowedDevices : 1;

  // Check if device already exists for this user
  const existing = db.prepare(
    'SELECT * FROM commercial_devices WHERE user_id = ? AND device_id = ?'
  ).get(params.userId, deviceId) as any;

  if (existing) {
    if (existing.status === 'REVOKED') {
      return {
        success: false,
        message: 'This device has been revoked. Please contact an administrator or remove other devices to reactivate.',
      };
    }

    // Update last seen & heartbeat
    db.prepare(`
      UPDATE commercial_devices 
      SET last_seen_at = ?, device_name = ?, ip_address = ?, status = 'ACTIVE'
      WHERE id = ?
    `).run(now, deviceName, params.ipAddress || existing.ip_address || '127.0.0.1', existing.id);

    return {
      success: true,
      device: getDeviceRecordById(existing.id)!,
      message: 'Device active.',
    };
  }

  // Count current active devices for this user
  const activeCount = (db.prepare(
    "SELECT COUNT(*) as count FROM commercial_devices WHERE user_id = ? AND status = 'ACTIVE'"
  ).get(params.userId) as any)?.count || 0;

  if (activeCount >= maxAllowed) {
    logCommercialAudit({
      actorId: params.userId,
      actorName: 'User',
      actorRole: 'USER',
      action: 'DEVICE_LIMIT_DENIED',
      targetType: 'DEVICE',
      targetId: deviceId,
      details: `Device activation denied. Active devices (${activeCount}/${maxAllowed}) reached for device "${deviceName}"`,
      ipAddress: params.ipAddress,
      result: 'WARNING',
    });

    return {
      success: false,
      message: `Device activation limit reached (${activeCount}/${maxAllowed}). Please remove an existing device first.`,
    };
  }

  const id = `dev_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO commercial_devices (
      id, user_id, license_id, device_id, device_name, os_info, client_version, ip_address, activated_at, last_seen_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(
    id,
    params.userId,
    params.licenseId || null,
    deviceId,
    deviceName,
    osInfo,
    clientVersion,
    params.ipAddress || '127.0.0.1',
    now,
    now
  );

  logCommercialAudit({
    actorId: params.userId,
    actorName: 'User',
    actorRole: 'USER',
    action: 'DEVICE_ACTIVATED',
    targetType: 'DEVICE',
    targetId: deviceId,
    details: `New device activated: "${deviceName}" (ID: ${deviceId})`,
    ipAddress: params.ipAddress,
    result: 'SUCCESS',
  });

  return {
    success: true,
    device: getDeviceRecordById(id)!,
    message: 'Device registered successfully.',
  };
}

export function getUserDevices(userId: string): CommercialDevice[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM commercial_devices WHERE user_id = ? ORDER BY activated_at DESC').all(userId) as any[];
  return rows.map(mapRowToDevice);
}

export function getAllCommercialDevices(filter?: { status?: string; searchQuery?: string }): CommercialDevice[] {
  const db = getDatabase();
  let query = 'SELECT * FROM commercial_devices WHERE 1=1';
  const params: any[] = [];

  if (filter?.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter?.searchQuery) {
    const term = `%${filter.searchQuery}%`;
    query += ' AND (device_name LIKE ? OR device_id LIKE ? OR user_id LIKE ?)';
    params.push(term, term, term);
  }

  query += ' ORDER BY last_seen_at DESC';
  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(mapRowToDevice);
}

export function getDeviceRecordById(id: string): CommercialDevice | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM commercial_devices WHERE id = ?').get(id) as any;
  if (!row) return null;
  return mapRowToDevice(row);
}

export function revokeCommercialDevice(
  deviceId: string,
  actor: { id: string; name: string; role: CommercialRole },
  userId?: string
): boolean {
  const db = getDatabase();
  let res;
  if (userId) {
    res = db.prepare("UPDATE commercial_devices SET status = 'REVOKED' WHERE device_id = ? AND user_id = ?").run(deviceId, userId);
  } else {
    res = db.prepare("UPDATE commercial_devices SET status = 'REVOKED' WHERE device_id = ?").run(deviceId);
  }

  if (res.changes > 0) {
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'DEVICE_REVOKED',
      targetType: 'DEVICE',
      targetId: deviceId,
      details: `Revoked authorization for device ID: ${deviceId}`,
      result: 'WARNING',
    });
    return true;
  }
  return false;
}

export function deleteCommercialDevice(deviceId: string, userId: string): boolean {
  const db = getDatabase();
  const res = db.prepare('DELETE FROM commercial_devices WHERE device_id = ? AND user_id = ?').run(deviceId, userId);
  return res.changes > 0;
}

/**
 * Phase 23: 1-Click HWID & Machine Unbind (GoLogin Parity)
 * Completely clears all device locks for a user so they can sign in from new hardware immediately.
 */
export function resetAllUserDevices(
  userId: string,
  actor?: { id: string; name: string; role: CommercialRole }
): { success: boolean; unbindCount: number } {
  const db = getDatabase();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM commercial_devices WHERE user_id = ?').get(userId) as any;
  const unbindCount = typeof countRow?.count === 'number' ? countRow.count : 0;
  db.prepare('DELETE FROM commercial_devices WHERE user_id = ?').run(userId);

  if (actor) {
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'USER_DEVICES_RESET_ALL',
      targetType: 'USER',
      targetId: userId,
      details: `1-Click HWID unbind executed: removed ${unbindCount} active device bindings for user ${userId}`,
      result: 'SUCCESS',
    });
  }

  return { success: true, unbindCount };
}

function mapRowToDevice(r: any): CommercialDevice {
  return {
    id: r.id,
    userId: r.user_id,
    licenseId: r.license_id || undefined,
    deviceId: r.device_id,
    deviceName: r.device_name,
    osInfo: r.os_info,
    clientVersion: r.client_version,
    ipAddress: r.ip_address || undefined,
    activatedAt: r.activated_at,
    lastSeenAt: r.last_seen_at,
    status: r.status as CommercialDeviceStatus,
  };
}
