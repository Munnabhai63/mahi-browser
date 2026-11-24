/**
 * MAHI Browser — Cloud Browser Session Scheduler & Worker Manager
 * Phase 10 Architecture
 */

import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CloudBrowserWorker,
  CloudBrowserRegion,
  CloudWorkerStatus,
  CloudResourceClass,
} from '../../10_CONFIG/shared/types/cloud-browser.js';

export class SessionScheduler {
  private static instance: SessionScheduler;

  private constructor() {
    this.ensureDefaultWorkerNode();
  }

  public static getInstance(): SessionScheduler {
    if (!SessionScheduler.instance) {
      SessionScheduler.instance = new SessionScheduler();
    }
    return SessionScheduler.instance;
  }

  /**
   * Ensures that at least one local production-ready worker node is registered in the database.
   */
  public ensureDefaultWorkerNode(): void {
    try {
      const db = getDatabase();
      const existing = db.prepare('SELECT id FROM cloud_browser_workers WHERE id = ?').get('worker-local-01');
      if (!existing) {
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO cloud_browser_workers (
            id, region_id, hostname, ip_address, status, capacity,
            active_sessions, cpu_usage_pct, memory_usage_mb, last_heartbeat_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'ONLINE', ?, 0, 5.0, 256.0, ?, ?, ?)
        `).run(
          'worker-local-01',
          'in-west',
          'node-01.mumbai.cloud.mahibrowser.com',
          '127.0.0.1',
          15,
          now,
          now,
          now
        );
      }
    } catch (err: any) {
      // Non-fatal if DB not yet initialized in specific test harnesses
    }
  }

  /**
   * Lists available cloud browser deployment regions.
   */
  public getRegions(): CloudBrowserRegion[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, name, endpoint_url as endpointUrl, status,
             is_default as isDefault, created_at as createdAt
      FROM cloud_browser_regions
      ORDER BY is_default DESC, name ASC
    `).all() as any[];

    return rows.map((r) => ({
      ...r,
      isDefault: Boolean(r.isDefault),
    }));
  }

  /**
   * Selects an optimal, healthy worker node in the specified region.
   */
  public allocateWorker(
    preferredRegionId = 'in-west',
    _resourceClass: CloudResourceClass = 'STANDARD'
  ): CloudBrowserWorker {
    const db = getDatabase();
    this.cleanupStaleWorkers();

    // Query online workers in target region with remaining capacity
    let workerRow = db.prepare(`
      SELECT id, region_id as regionId, hostname, ip_address as ipAddress,
             status, capacity, active_sessions as activeSessions,
             cpu_usage_pct as cpuUsagePct, memory_usage_mb as memoryUsageMb,
             last_heartbeat_at as lastHeartbeatAt, created_at as createdAt,
             updated_at as updatedAt
      FROM cloud_browser_workers
      WHERE region_id = ? AND status = 'ONLINE' AND active_sessions < capacity
      ORDER BY active_sessions ASC, cpu_usage_pct ASC
      LIMIT 1
    `).get(preferredRegionId) as any;

    // Fallback: If preferred region has no capacity, find any online worker
    if (!workerRow) {
      workerRow = db.prepare(`
        SELECT id, region_id as regionId, hostname, ip_address as ipAddress,
               status, capacity, active_sessions as activeSessions,
               cpu_usage_pct as cpuUsagePct, memory_usage_mb as memoryUsageMb,
               last_heartbeat_at as lastHeartbeatAt, created_at as createdAt,
               updated_at as updatedAt
        FROM cloud_browser_workers
        WHERE status = 'ONLINE' AND active_sessions < capacity
        ORDER BY active_sessions ASC
        LIMIT 1
      `).get() as any;
    }

    if (!workerRow) {
      throw new Error(`NO_CAPACITY: All cloud browser workers are at maximum capacity or offline. Please retry in a moment.`);
    }

    // Increment active session counter atomically
    db.prepare(`
      UPDATE cloud_browser_workers
      SET active_sessions = active_sessions + 1,
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), workerRow.id);

    return workerRow as CloudBrowserWorker;
  }

  /**
   * Releases an active session slot on the specified worker node.
   */
  public releaseWorkerSlot(workerId: string): void {
    try {
      const db = getDatabase();
      db.prepare(`
        UPDATE cloud_browser_workers
        SET active_sessions = MAX(0, active_sessions - 1),
            updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), workerId);
    } catch {}
  }

  /**
   * Record worker heartbeat to maintain active pool telemetry.
   */
  public recordHeartbeat(
    workerId: string,
    cpuUsagePct: number,
    memoryUsageMb: number,
    status: CloudWorkerStatus = 'ONLINE'
  ): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE cloud_browser_workers
      SET cpu_usage_pct = ?,
          memory_usage_mb = ?,
          status = ?,
          last_heartbeat_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(cpuUsagePct, memoryUsageMb, status, now, now, workerId);
  }

  /**
   * Automatically marks workers that haven't heartbeated within 3 minutes as OFFLINE.
   */
  public cleanupStaleWorkers(): void {
    try {
      const db = getDatabase();
      const staleThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE cloud_browser_workers
        SET status = 'OFFLINE', updated_at = ?
        WHERE last_heartbeat_at < ? AND status = 'ONLINE' AND id != 'worker-local-01'
      `).run(new Date().toISOString(), staleThreshold);
    } catch {}
  }
}

export const sessionScheduler = SessionScheduler.getInstance();
