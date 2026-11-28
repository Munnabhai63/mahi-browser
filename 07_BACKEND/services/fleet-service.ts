import os from 'node:os';
import { getDatabase } from '../../06_DATABASE/connection.js';
import type { DeviceRecord, FleetTelemetry } from '../../10_CONFIG/shared/types/platform.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import { logActivity } from './audit-service.js';

export function getLocalDeviceRecord(): DeviceRecord {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();

  return {
    id: deviceId,
    deviceId,
    userId: 'owner',
    deviceName,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    clientVersion: '1.0.0',
    ipAddress: '127.0.0.1',
    status: 'ONLINE',
    lastSeenAt: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
  };
}

interface SqliteFleetDeviceRow {
  id: string;
  device_id: string;
  user_id: string;
  device_name: string;
  os: string;
  client_version: string;
  ip_address: string;
  status: string;
  last_seen_at: string;
  registered_at: string;
}

export function getFleetDevices(): DeviceRecord[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM fleet_devices ORDER BY last_seen_at DESC').all<SqliteFleetDeviceRow>();

  // Always ensure local device is present in list
  const local = getLocalDeviceRecord();
  const existingLocal = rows.find((r) => r.device_id === local.deviceId);

  if (!existingLocal) {
    db.prepare(`
      INSERT OR REPLACE INTO fleet_devices (id, device_id, user_id, device_name, os, client_version, ip_address, status, last_seen_at, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(local.id, local.deviceId, local.userId, local.deviceName, local.os, local.clientVersion, local.ipAddress, local.status, local.lastSeenAt, local.registeredAt);
    return [local, ...rows.map(mapRowToDevice)];
  }

  // Update local heartbeat
  db.prepare('UPDATE fleet_devices SET last_seen_at = ?, status = ? WHERE device_id = ?').run(new Date().toISOString(), 'ONLINE', local.deviceId);

  return rows.map(mapRowToDevice);
}

function mapRowToDevice(r: SqliteFleetDeviceRow): DeviceRecord {
  return {
    id: r.id,
    deviceId: r.device_id,
    userId: r.user_id,
    deviceName: r.device_name,
    os: r.os,
    clientVersion: r.client_version,
    ipAddress: r.ip_address,
    status: r.status as DeviceRecord['status'],
    lastSeenAt: r.last_seen_at,
    registeredAt: r.registered_at,
  };
}

export function getLiveTelemetry(): FleetTelemetry {
  const runningPids = processManager.getRunningPids();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemMb = Math.round((totalMem - freeMem) / (1024 * 1024));

  // Calculate approximate CPU load
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const timeVal of Object.values(cpu.times)) {
      totalTick += timeVal;
    }
    totalIdle += cpu.times.idle;
  }
  const cpuPercent = Math.min(100, Math.max(5, Math.round(((totalTick - totalIdle) / totalTick) * 100)));

  return {
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
    status: runningPids.length > 0 ? 'RUNNING_TASKS' : 'IDLE',
    activeProfilesCount: runningPids.length,
    runningProfilePids: runningPids,
    cpuUsagePercent: cpuPercent,
    memoryUsageMb: usedMemMb,
    diskFreeMb: Math.round(freeMem / (1024 * 1024)),
    uptimeSeconds: Math.round(os.uptime()),
    clientVersion: '1.0.0',
    syncState: 'SYNCED',
    timestamp: new Date().toISOString(),
  };
}

export function revokeDevice(deviceId: string): boolean {
  const db = getDatabase();
  db.prepare("UPDATE fleet_devices SET status = 'REVOKED' WHERE device_id = ?").run(deviceId);
  logActivity('FLEET', 'WARNING', 'Revoke Device', `Revoked authorization for device ID: ${deviceId}`);
  return true;
}
