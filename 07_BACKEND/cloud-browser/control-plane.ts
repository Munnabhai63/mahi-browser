/**
 * MAHI Browser — Real Cloud Browser Infrastructure Control Plane
 * Phase 10 Architecture
 *
 * Responsibilities:
 * - Session request handling, authorization & plan entitlement check
 * - Workspace RBAC verification
 * - Distributed profile locking & heartbeat management
 * - Explicit lifecycle state machine:
 *   REQUESTED -> ALLOCATING -> PREPARING_PROFILE -> STARTING_BROWSER -> RUNNING -> STOPPING -> SYNCING -> COMPLETED
 * - Pinned worker scheduling & isolated runtime provisioning
 * - Interactive streaming gateway token generation & reconnect handling
 * - Clean shutdown, state packaging, zero-knowledge encryption, and sync back
 * - Resource accounting, cost guards, and audit event emission
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { getWritableSubdir } from '../utils/runtime-paths.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CloudBrowserSession,
  CloudSessionState,
  RequestCloudSessionDTO,
} from '../../10_CONFIG/shared/types/cloud-browser.js';
import {
  verifyUserProfileAccess,
  acquireProfileLock,
  releaseProfileLock,
} from '../services/cloud-profile-service.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cloud-browser-control-plane');
import { evaluateUserEntitlements } from '../commercial/commercial-entitlement-service.js';
import { getCentralUserById } from '../../05_AUTH/central-auth-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { sessionScheduler } from './session-scheduler.js';
import { workerProfileLoader } from './worker-profile-loader.js';
import { browserWorkerManager } from './browser-worker.js';
import { sessionGateway } from './session-gateway.js';
import { resourceLimiter } from './resource-limiter.js';

export interface StartCloudSessionResult {
  sessionId: string;
  status: CloudSessionState;
  streamGatewayUrl: string;
  streamToken: string;
  regionId: string;
  workerId: string;
  startedAt: string;
  maxDurationSeconds: number;
  idleTimeoutSeconds: number;
}

export class CloudBrowserControlPlane {
  private static instance: CloudBrowserControlPlane;
  private basePath = getWritableSubdir('cloud-workers');

  private constructor() {}

  public static getInstance(): CloudBrowserControlPlane {
    if (!CloudBrowserControlPlane.instance) {
      CloudBrowserControlPlane.instance = new CloudBrowserControlPlane();
    }
    return CloudBrowserControlPlane.instance;
  }

  /**
   * Validates authorization, entitlements, and locks, then schedules and launches
   * a real isolated cloud browser session.
   */
  public async requestSession(
    userId: string,
    dto: RequestCloudSessionDTO
  ): Promise<StartCloudSessionResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    // 1. Central Account Validation
    const user = getCentralUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('AUTH_FAILED: User account is inactive, suspended, or does not exist.');
    }

    // 2. Entitlement & Quota Check
    const entitlements = evaluateUserEntitlements(userId);
    if (!entitlements.limits.cloudSync && entitlements.plan.tier === 'FREE') {
      // Free accounts can test cloud browser if active sessions < 1
      const activeSessionsCount = this.getActiveSessionCountForUser(userId);
      if (activeSessionsCount >= 1) {
        throw new Error('QUOTA_EXCEEDED: Free plan allows maximum 1 concurrent cloud browser session. Please stop existing session or upgrade.');
      }
    }

    // 3. Profile Access & Workspace RBAC Check
    const access = verifyUserProfileAccess(userId, dto.profileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('ACCESS_DENIED: You do not have permission to launch this profile in Cloud Browser.');
    }

    // 4. Distributed Lock Acquisition
    const lockDeviceName = `MAHI Cloud Worker`;
    const lockDeviceId = `cloud-worker-session-${crypto.randomBytes(4).toString('hex')}`;
    const lockRes = acquireProfileLock(userId, dto.profileId, lockDeviceId, lockDeviceName, 3600);
    if (!lockRes.acquired) {
      throw new Error(`PROFILE_LOCKED: Profile is currently in use by ${lockRes.heldBy || 'another device/session'}. Wait for previous session to close.`);
    }

    // 5. Create Cloud Session Entity
    const sessionId = crypto.randomUUID();
    const regionId = dto.regionId || 'in-west';
    const resourceClass = dto.resourceClass || 'STANDARD';
    const maxDurationSeconds = dto.maxDurationSeconds || 3600;
    const idleTimeoutSeconds = dto.idleTimeoutSeconds || 600;
    const profileVersion = access.profile.current_version || 1;

    db.prepare(`
      INSERT INTO cloud_browser_sessions (
        id, user_id, workspace_id, profile_id, region_id, status,
        resource_class, profile_version, lock_id, max_duration_seconds,
        idle_timeout_seconds, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      dto.workspaceId || null,
      dto.profileId,
      regionId,
      resourceClass,
      profileVersion,
      lockDeviceId,
      maxDurationSeconds,
      idleTimeoutSeconds,
      now,
      now,
      now
    );

    this.recordEvent(sessionId, userId, 'SESSION_REQUESTED', { profileId: dto.profileId, regionId });

    // 6. State Machine: ALLOCATING
    this.updateSessionStatus(sessionId, 'ALLOCATING');
    let worker;
    try {
      worker = sessionScheduler.allocateWorker(regionId, resourceClass);
    } catch (allocErr: any) {
      this.updateSessionStatus(sessionId, 'FAILED', allocErr.message);
      releaseProfileLock(userId, dto.profileId, lockDeviceId);
      throw allocErr;
    }

    db.prepare(`
      UPDATE cloud_browser_sessions
      SET worker_id = ?, updated_at = ?
      WHERE id = ?
    `).run(worker.id, new Date().toISOString(), sessionId);

    this.recordEvent(sessionId, userId, 'WORKER_ALLOCATED', { workerId: worker.id, hostname: worker.hostname });

    // 7. State Machine: PREPARING_PROFILE
    this.updateSessionStatus(sessionId, 'PREPARING_PROFILE');
    const runtimeDir = path.join(this.basePath, sessionId);
    let preparedProfile;
    try {
      preparedProfile = await workerProfileLoader.prepareWorkerProfile({
        sessionId,
        userId,
        profileId: dto.profileId,
        workspaceId: dto.workspaceId,
        targetDir: runtimeDir,
      });
    } catch (prepErr: any) {
      this.updateSessionStatus(sessionId, 'FAILED', prepErr.message);
      sessionScheduler.releaseWorkerSlot(worker.id);
      releaseProfileLock(userId, dto.profileId, lockDeviceId);
      await workerProfileLoader.cleanWorkerDirectoryAsync(runtimeDir);
      throw prepErr;
    }

    // 8. State Machine: STARTING_BROWSER
    this.updateSessionStatus(sessionId, 'STARTING_BROWSER');
    let workerInstance;
    try {
      workerInstance = await browserWorkerManager.launchWorker({
        sessionId,
        userId,
        profileId: dto.profileId,
        runtimeDir,
        settings: preparedProfile.profileSettings,
        startupUrl: dto.startupUrl,
        resourceClass,
      });
    } catch (launchErr: any) {
      this.updateSessionStatus(sessionId, 'FAILED', launchErr.message);
      sessionScheduler.releaseWorkerSlot(worker.id);
      releaseProfileLock(userId, dto.profileId, lockDeviceId);
      await workerProfileLoader.cleanWorkerDirectoryAsync(runtimeDir);
      throw launchErr;
    }

    // 9. State Machine: Attach Session Gateway & Generate Token
    const streamToken = sessionGateway.createStreamToken(sessionId, userId);
    const streamGatewayUrl = `/api/v1/remote/cloud-browser/sessions/${sessionId}/stream`;

    try {
      await sessionGateway.attachSession(sessionId, workerInstance.cdpPort);
    } catch (attachErr: any) {
      await workerInstance.stop();
      this.updateSessionStatus(sessionId, 'FAILED', attachErr.message);
      sessionScheduler.releaseWorkerSlot(worker.id);
      releaseProfileLock(userId, dto.profileId, lockDeviceId);
      await workerProfileLoader.cleanWorkerDirectoryAsync(runtimeDir);
      throw attachErr;
    }

    // 10. State Machine: RUNNING
    const startedAt = new Date().toISOString();
    db.prepare(`
      UPDATE cloud_browser_sessions
      SET status = 'RUNNING',
          cdp_port = ?,
          stream_gateway_url = ?,
          started_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(workerInstance.cdpPort, streamGatewayUrl, startedAt, startedAt, sessionId);

    this.recordEvent(sessionId, userId, 'SESSION_RUNNING', { cdpPort: workerInstance.cdpPort, startedAt });

    // 11. Register Resource Limiter
    const sessionRecord = this.getSession(sessionId)!;
    resourceLimiter.trackSession({
      session: sessionRecord,
      onTimeout: async (reason) => {
        await this.stopSession(sessionId, userId, reason);
      },
      onWarning: () => {
        this.updateSessionStatus(sessionId, 'IDLE_WARNING');
        this.recordEvent(sessionId, userId, 'IDLE_WARNING', { warning: 'Session approaching idle timeout.' });
      },
    });

    // 12. Emit Webhook
    try {
      const webhookService = WebhookService.getInstance();
      webhookService.dispatchEvent('cloud_session.started', {
        sessionId,
        userId,
        profileId: dto.profileId,
        regionId,
        startedAt,
      }, { userId, workspaceId: dto.workspaceId });
    } catch (webhookErr) {
      log.warn('Failed dispatching cloud_session.started webhook', {
        sessionId,
        err: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
      });
    }

    return {
      sessionId,
      status: 'RUNNING',
      streamGatewayUrl,
      streamToken,
      regionId,
      workerId: worker.id,
      startedAt,
      maxDurationSeconds,
      idleTimeoutSeconds,
    };
  }

  /**
   * Gracefully ends a cloud browser session:
   * Stops Chromium cleanly -> Packages & encrypts profile -> Syncs back -> Wipes worker disk -> Releases lock.
   */
  public async stopSession(
    sessionId: string,
    userId: string,
    reason = 'USER_REQUESTED'
  ): Promise<{ success: boolean; status: CloudSessionState }> {
    const db = getDatabase();
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Cloud session ${sessionId} does not exist.`);
    }

    // Permission check
    if (session.userId !== userId) {
      throw new Error(`FORBIDDEN: You do not own cloud session ${sessionId}.`);
    }

    if (['COMPLETED', 'FAILED', 'TIMED_OUT', 'TERMINATED'].includes(session.status)) {
      return { success: true, status: session.status };
    }

    // 1. State: STOPPING
    this.updateSessionStatus(sessionId, 'STOPPING');
    this.recordEvent(sessionId, userId, 'SESSION_STOPPING', { reason });

    // 2. Terminate Browser Worker
    const workerInstance = browserWorkerManager.getWorker(sessionId);
    if (workerInstance) {
      await workerInstance.stop();
    }
    sessionGateway.detachSession(sessionId);

    // 3. State: SYNCING
    this.updateSessionStatus(sessionId, 'SYNCING');
    this.recordEvent(sessionId, userId, 'SESSION_SYNCING', { profileId: session.profileId });

    const runtimeDir = path.join(this.basePath, sessionId);
    let newVersion = session.profileVersion;
    try {
      const syncRes = await workerProfileLoader.packageAndSyncProfile({
        sessionId,
        userId,
        profileId: session.profileId,
        targetDir: runtimeDir,
        baseVersion: session.profileVersion,
      });
      newVersion = syncRes.newVersion;
      this.recordEvent(sessionId, userId, 'PROFILE_SYNC_COMPLETED', { newVersion });
    } catch (syncErr: any) {
      this.recordEvent(sessionId, userId, 'PROFILE_SYNC_FAILED', { error: syncErr.message });
    }

    // 4. Secure Cleanup of Worker Directory
    await workerProfileLoader.cleanWorkerDirectoryAsync(runtimeDir);

    // 5. Release Worker Capacity Slot
    if (session.workerId) {
      sessionScheduler.releaseWorkerSlot(session.workerId);
    }

    // 6. Release Distributed Profile Lock
    if (session.lockId) {
      releaseProfileLock(userId, session.profileId, session.lockId);
    }

    // 7. Finalize Usage Accounting
    const durationSeconds = resourceLimiter.finalizeUsage(sessionId);

    // 8. State: COMPLETED (or TIMED_OUT)
    const finalState: CloudSessionState = reason.includes('TIMEOUT') ? 'TIMED_OUT' : 'COMPLETED';
    const endedAt = new Date().toISOString();

    db.prepare(`
      UPDATE cloud_browser_sessions
      SET status = ?,
          duration_seconds = ?,
          ended_at = ?,
          termination_reason = ?,
          profile_version = ?,
          updated_at = ?
      WHERE id = ?
    `).run(finalState, durationSeconds, endedAt, reason, newVersion, endedAt, sessionId);

    this.recordEvent(sessionId, userId, 'SESSION_ENDED', { finalState, durationSeconds, reason });

    // 9. Webhook Notification
    try {
      const webhookService = WebhookService.getInstance();
      webhookService.dispatchEvent('cloud_session.ended', {
        sessionId,
        userId,
        profileId: session.profileId,
        durationSeconds,
        finalState,
        reason,
      }, { userId, workspaceId: session.workspaceId });
    } catch (webhookErr) {
      log.warn('Failed dispatching cloud_session.ended webhook', {
        sessionId,
        err: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
      });
    }

    return { success: true, status: finalState };
  }

  /**
   * Generates a fresh stream token for an active running session (reconnect flow).
   */
  public generateReconnectToken(sessionId: string, userId: string): string {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Cloud session ${sessionId} not found.`);
    }
    if (session.userId !== userId) {
      throw new Error('FORBIDDEN: You do not own this cloud session.');
    }
    if (session.status !== 'RUNNING' && session.status !== 'IDLE_WARNING') {
      throw new Error(`CANNOT_RECONNECT: Session is not running (status: ${session.status}).`);
    }

    return sessionGateway.createStreamToken(sessionId, userId);
  }

  /**
   * Retrieves a cloud session record.
   */
  public getSession(sessionId: string): CloudBrowserSession | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, user_id as userId, workspace_id as workspaceId,
             profile_id as profileId, worker_id as workerId, region_id as regionId,
             status, resource_class as resourceClass, profile_version as profileVersion,
             lock_id as lockId, session_token_hash as sessionTokenHash,
             stream_gateway_url as streamGatewayUrl, cdp_port as cdpPort,
             duration_seconds as durationSeconds, max_duration_seconds as maxDurationSeconds,
             idle_timeout_seconds as idleTimeoutSeconds, last_activity_at as lastActivityAt,
             started_at as startedAt, ended_at as endedAt, termination_reason as terminationReason,
             error_message as errorMessage, created_at as createdAt, updated_at as updatedAt
      FROM cloud_browser_sessions
      WHERE id = ?
    `).get(sessionId) as any;

    return row || null;
  }

  /**
   * Lists recent cloud sessions for a user or workspace.
   */
  public listSessions(userId: string, workspaceId?: string, limit = 20): CloudBrowserSession[] {
    const db = getDatabase();
    let rows: any[];
    if (workspaceId) {
      rows = db.prepare(`
        SELECT id, user_id as userId, workspace_id as workspaceId,
               profile_id as profileId, worker_id as workerId, region_id as regionId,
               status, resource_class as resourceClass, profile_version as profileVersion,
               lock_id as lockId, duration_seconds as durationSeconds,
               started_at as startedAt, ended_at as endedAt, termination_reason as terminationReason,
               created_at as createdAt, updated_at as updatedAt
        FROM cloud_browser_sessions
        WHERE workspace_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(workspaceId, limit);
    } else {
      rows = db.prepare(`
        SELECT id, user_id as userId, workspace_id as workspaceId,
               profile_id as profileId, worker_id as workerId, region_id as regionId,
               status, resource_class as resourceClass, profile_version as profileVersion,
               lock_id as lockId, duration_seconds as durationSeconds,
               started_at as startedAt, ended_at as endedAt, termination_reason as terminationReason,
               created_at as createdAt, updated_at as updatedAt
        FROM cloud_browser_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(userId, limit);
    }

    return rows;
  }

  private getActiveSessionCountForUser(userId: string): number {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT COUNT(id) as count
      FROM cloud_browser_sessions
      WHERE user_id = ? AND status IN ('REQUESTED', 'ALLOCATING', 'PREPARING_PROFILE', 'STARTING_BROWSER', 'RUNNING', 'IDLE_WARNING')
    `).get(userId) as any;
    return row?.count || 0;
  }

  private updateSessionStatus(sessionId: string, status: CloudSessionState, errorMessage?: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE cloud_browser_sessions
      SET status = ?,
          error_message = COALESCE(?, error_message),
          updated_at = ?
      WHERE id = ?
    `).run(status, errorMessage || null, new Date().toISOString(), sessionId);
  }

  private recordEvent(sessionId: string, userId: string, eventType: string, details?: Record<string, unknown>): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO cloud_browser_events (id, session_id, user_id, event_type, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        sessionId,
        userId,
        eventType,
        details ? JSON.stringify(details) : null,
        new Date().toISOString()
      );
    } catch (err) {
      log.debug('Failed recording cloud_browser_events row', {
        sessionId,
        eventType,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const cloudBrowserControlPlane = CloudBrowserControlPlane.getInstance();
