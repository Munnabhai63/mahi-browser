/**
 * MAHI Browser — Cloud Browser Resource Limiter & Usage Accounting
 * Phase 10 Architecture
 *
 * Enforces:
 * - Maximum session duration (e.g. 3600s / plan bound)
 * - Idle timeout limits with graceful warning
 * - Accurate usage recording in `cloud_browser_usage`
 * - Cost guard: Prevents unbounded background compute consumption
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CloudBrowserSession,
  CloudResourceClass,
} from '../../10_CONFIG/shared/types/cloud-browser.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cloud-browser-resource-limiter');

export interface ResourceLimitConfig {
  maxDurationSeconds: number;
  idleTimeoutSeconds: number;
  resourceClass: CloudResourceClass;
}

export class ResourceLimiter {
  private static instance: ResourceLimiter;
  private monitorTimer?: NodeJS.Timeout;
  private trackedSessions = new Map<
    string,
    {
      sessionId: string;
      userId: string;
      workspaceId?: string;
      startedAt: number;
      lastActivityAt: number;
      maxDurationSeconds: number;
      idleTimeoutSeconds: number;
      resourceClass: CloudResourceClass;
      regionId: string;
      onTimeout: (reason: string) => Promise<void>;
      onWarning: () => void;
    }
  >();

  private constructor() {
    this.startMonitorLoop();
  }

  public static getInstance(): ResourceLimiter {
    if (!ResourceLimiter.instance) {
      ResourceLimiter.instance = new ResourceLimiter();
    }
    return ResourceLimiter.instance;
  }

  /**
   * Begins tracking a new cloud browser session.
   */
  public trackSession(params: {
    session: CloudBrowserSession;
    onTimeout: (reason: string) => Promise<void>;
    onWarning: () => void;
  }): void {
    const { session, onTimeout, onWarning } = params;
    this.trackedSessions.set(session.id, {
      sessionId: session.id,
      userId: session.userId,
      workspaceId: session.workspaceId,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      maxDurationSeconds: session.maxDurationSeconds || 3600,
      idleTimeoutSeconds: session.idleTimeoutSeconds || 600,
      resourceClass: session.resourceClass,
      regionId: session.regionId,
      onTimeout,
      onWarning,
    });
  }

  /**
   * Updates last activity timestamp when user interacts with remote browser.
   */
  public touchActivity(sessionId: string): void {
    const item = this.trackedSessions.get(sessionId);
    if (item) {
      item.lastActivityAt = Date.now();
    }
  }

  /**
   * Stops tracking a session and records final usage into `cloud_browser_usage`.
   */
  public finalizeUsage(sessionId: string): number {
    const item = this.trackedSessions.get(sessionId);
    if (!item) return 0;

    const durationSeconds = Math.max(1, Math.round((Date.now() - item.startedAt) / 1000));

    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO cloud_browser_usage (
          id, user_id, workspace_id, session_id, duration_seconds,
          resource_class, region_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        item.userId,
        item.workspaceId || null,
        item.sessionId,
        durationSeconds,
        item.resourceClass,
        item.regionId,
        now
      );
    } catch (err) {
      log.warn('Failed recording cloud_browser_usage entry', {
        sessionId: item.sessionId,
        durationSeconds,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    this.trackedSessions.delete(sessionId);
    return durationSeconds;
  }

  /**
   * Retrieves usage summary for an authenticated user.
   */
  public getUserUsageSummary(userId: string): {
    totalDurationSeconds: number;
    totalSessions: number;
    activeSessions: number;
  } {
    const db = getDatabase();
    const sumRow = db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) as totalSeconds,
             COUNT(id) as totalSessions
      FROM cloud_browser_usage
      WHERE user_id = ?
    `).get(userId) as any;

    const activeCount = Array.from(this.trackedSessions.values()).filter((s) => s.userId === userId).length;

    return {
      totalDurationSeconds: sumRow?.totalSeconds || 0,
      totalSessions: sumRow?.totalSessions || 0,
      activeSessions: activeCount,
    };
  }

  /**
   * Periodic health and timeout evaluation loop.
   */
  private startMonitorLoop(): void {
    if (this.monitorTimer) return;

    this.monitorTimer = setInterval(async () => {
      const now = Date.now();
      for (const [sessionId, tracker] of this.trackedSessions.entries()) {
        const elapsedSeconds = (now - tracker.startedAt) / 1000;
        const idleSeconds = (now - tracker.lastActivityAt) / 1000;

        // 1. Max duration check
        if (elapsedSeconds >= tracker.maxDurationSeconds) {
          this.trackedSessions.delete(sessionId);
          await tracker.onTimeout('MAX_DURATION_EXCEEDED');
          continue;
        }

        // 2. Idle timeout check
        if (idleSeconds >= tracker.idleTimeoutSeconds) {
          this.trackedSessions.delete(sessionId);
          await tracker.onTimeout('IDLE_TIMEOUT_EXCEEDED');
          continue;
        }

        // 3. Idle warning (2 minutes before timeout)
        if (idleSeconds >= tracker.idleTimeoutSeconds - 120 && idleSeconds < tracker.idleTimeoutSeconds - 110) {
          tracker.onWarning();
        }
      }
    }, 10000);

    if (this.monitorTimer.unref) {
      this.monitorTimer.unref();
    }
  }

  public stopMonitorLoop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }
}

export const resourceLimiter = ResourceLimiter.getInstance();
