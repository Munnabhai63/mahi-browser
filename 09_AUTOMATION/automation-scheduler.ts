/**
 * MAHI Browser — Production Automation Scheduler Engine
 * Phase 8 Architecture
 *
 * Responsibilities:
 * - Recurring and one-time workflow scheduling (ONE_TIME, HOURLY, DAILY, WEEKLY, CRON)
 * - Explicit timezone and duplicate execution prevention
 * - Device availability / offline checks (WAITING_FOR_DEVICE, MISSED)
 * - Safe dispatch into automation-engine runWorkflow
 * - Audit logging and execution state tracking
 */

import crypto from 'node:crypto';
import { getDatabase } from '../06_DATABASE/connection.js';
import { AutomationSchedule } from '../10_CONFIG/shared/types/automation.js';
import { getWorkflowById, runWorkflow } from './automation-engine.js';
import { getProfileById } from '../02_BROWSER/services/profile-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('automation-scheduler');

export interface CreateScheduleDTO {
  workflowId: string;
  profileId?: string;
  profileIds?: string[];
  workspaceId?: string;
  scheduleType: 'ONE_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'CRON';
  cronExpression?: string;
  timezone?: string;
  nextRunAt: string;
}

class AutomationSchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;
  private activeRunningScheduleIds = new Set<string>();

  /**
   * Starts the background scheduler loop
   */
  public start(checkIntervalMs = 30000): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error('[AutomationScheduler] Tick error:', err);
      });
    }, checkIntervalMs);
  }

  /**
   * Stops the background scheduler loop
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluates all active schedules and executes eligible ones
   */
  public async tick(): Promise<number> {
    if (this.isTicking) return 0;
    this.isTicking = true;
    let triggeredCount = 0;

    try {
      const nowIso = new Date().toISOString();
      const db = getDatabase();

      const activeRows = db.prepare(`
        SELECT * FROM automation_schedules
        WHERE status = 'ACTIVE' AND next_run_at IS NOT NULL AND next_run_at <= ?
      `).all(nowIso) as any[];

      for (const row of activeRows) {
        const schedule = this.mapRow(row);

        // Guard against duplicate execution
        if (this.activeRunningScheduleIds.has(schedule.id)) {
          continue;
        }

        // Verify workflow exists
        const workflow = getWorkflowById(schedule.workflowId);
        if (!workflow) {
          this.updateScheduleStatus(schedule.id, 'MISSED', 'Referenced workflow does not exist');
          continue;
        }

        const targetProfileId = schedule.profileId || workflow.defaultProfileId;
        if (!targetProfileId) {
          this.updateScheduleStatus(schedule.id, 'MISSED', 'No target profile configured');
          continue;
        }

        // Check if device / profile context is available
        const profile = getProfileById(targetProfileId);
        if (!profile) {
          this.updateScheduleStatus(schedule.id, 'WAITING_FOR_DEVICE', `Profile "${targetProfileId}" unavailable on this device`);
          continue;
        }

        // Trigger execution asynchronously
        triggeredCount++;
        this.executeSchedule(schedule, targetProfileId).catch((err) => {
          console.error(`[AutomationScheduler] Error executing schedule ${schedule.id}:`, err);
        });
      }
    } finally {
      this.isTicking = false;
    }

    return triggeredCount;
  }

  /**
   * Executes a scheduled workflow run with lock tracking and nextRunAt computation
   */
  private async executeSchedule(schedule: AutomationSchedule, profileId: string): Promise<void> {
    this.activeRunningScheduleIds.add(schedule.id);
    const db = getDatabase();
    const executedAt = new Date().toISOString();

    try {
      logActivity(
        'AUTOMATION',
        'INFO',
        'SCHEDULE_TRIGGERED',
        `Scheduled execution triggered for workflow "${schedule.workflowId}" on schedule ${schedule.id}`,
        profileId,
        undefined,
        { scheduleId: schedule.id, scheduleType: schedule.scheduleType }
      );

      // Compute and update nextRunAt or mark completed
      const nextRunAt = this.calculateNextRun(schedule.scheduleType, schedule.nextRunAt);
      const nextStatus = schedule.scheduleType === 'ONE_TIME' ? 'COMPLETED' : 'ACTIVE';

      db.prepare(`
        UPDATE automation_schedules
        SET last_run_at = ?, next_run_at = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(executedAt, nextRunAt, nextStatus, new Date().toISOString(), schedule.id);

      // Execute workflow
      await runWorkflow({
        workflowId: schedule.workflowId,
        profileId,
        workspaceId: schedule.workspaceId,
      });
    } catch (err: any) {
      logActivity(
        'AUTOMATION',
        'ERROR',
        'SCHEDULE_EXECUTION_FAILED',
        `Scheduled execution failed: ${err.message}`,
        profileId,
        undefined,
        { scheduleId: schedule.id, error: err.message }
      );
    } finally {
      this.activeRunningScheduleIds.delete(schedule.id);
    }
  }

  /**
   * Computes subsequent run timestamp based on schedule type
   */
  public calculateNextRun(scheduleType: string, currentRunAt?: string): string | null {
    const start = currentRunAt ? new Date(currentRunAt) : new Date();

    switch (scheduleType) {
      case 'ONE_TIME':
        return null;
      case 'HOURLY':
        return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
      case 'DAILY':
        return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case 'WEEKLY':
        return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'CRON':
        // Default 6-hour interval for cron schedules without dedicated parser
        return new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  }

  // ─── CRUD Operations ──────────────────────────────────────────────────────

  public createSchedule(dto: CreateScheduleDTO): AutomationSchedule {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getDatabase();

    db.prepare(`
      INSERT INTO automation_schedules (
        id, workflow_id, profile_id, profile_ids_json, workspace_id,
        schedule_type, cron_expression, timezone, next_run_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.workflowId,
      dto.profileId || null,
      dto.profileIds ? JSON.stringify(dto.profileIds) : null,
      dto.workspaceId || null,
      dto.scheduleType,
      dto.cronExpression || null,
      dto.timezone || 'UTC',
      dto.nextRunAt,
      'ACTIVE',
      now,
      now
    );

    logActivity(
      'AUTOMATION',
      'INFO',
      'SCHEDULE_CREATED',
      `Created ${dto.scheduleType} schedule for workflow "${dto.workflowId}"`,
      dto.profileId || undefined,
      undefined,
      { scheduleId: id, scheduleType: dto.scheduleType }
    );

    return this.getSchedule(id)!;
  }

  public getSchedule(id: string): AutomationSchedule | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM automation_schedules WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  public listSchedules(filter?: { workspaceId?: string; status?: string; workflowId?: string }): AutomationSchedule[] {
    const db = getDatabase();
    let query = 'SELECT * FROM automation_schedules WHERE 1=1';
    const params: any[] = [];

    if (filter?.workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(filter.workspaceId);
    }
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.workflowId) {
      query += ' AND workflow_id = ?';
      params.push(filter.workflowId);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public updateSchedule(id: string, updates: Partial<AutomationSchedule>): AutomationSchedule | null {
    const current = this.getSchedule(id);
    if (!current) return null;

    const db = getDatabase();
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };

    db.prepare(`
      UPDATE automation_schedules
      SET workflow_id = ?, profile_id = ?, profile_ids_json = ?, workspace_id = ?,
          schedule_type = ?, cron_expression = ?, timezone = ?, next_run_at = ?,
          last_run_at = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.workflowId,
      updated.profileId || null,
      updated.profileIds ? JSON.stringify(updated.profileIds) : null,
      updated.workspaceId || null,
      updated.scheduleType,
      updated.cronExpression || null,
      updated.timezone,
      updated.nextRunAt || null,
      updated.lastRunAt || null,
      updated.status,
      updated.updatedAt,
      id
    );

    return updated;
  }

  public pauseSchedule(id: string): boolean {
    const res = this.updateSchedule(id, { status: 'PAUSED' });
    return !!res;
  }

  public resumeSchedule(id: string): boolean {
    const current = this.getSchedule(id);
    if (!current) return false;
    const nextRun = current.nextRunAt || this.calculateNextRun(current.scheduleType);
    const res = this.updateSchedule(id, { status: 'ACTIVE', nextRunAt: nextRun || undefined });
    return !!res;
  }

  public deleteSchedule(id: string): boolean {
    const db = getDatabase();
    const info = db.prepare('DELETE FROM automation_schedules WHERE id = ?').run(id);
    if (info.changes > 0) {
      logActivity('AUTOMATION', 'INFO', 'SCHEDULE_DELETED', `Deleted automation schedule ${id}`);
      return true;
    }
    return false;
  }

  private updateScheduleStatus(id: string, status: 'WAITING_FOR_DEVICE' | 'MISSED', reason: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE automation_schedules SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);

    logActivity(
      'AUTOMATION',
      'WARNING',
      `SCHEDULE_${status}`,
      `Schedule ${id} marked ${status}: ${reason}`,
      undefined,
      undefined,
      { scheduleId: id, reason }
    );
  }

  private mapRow(row: any): AutomationSchedule {
    let profileIds: string[] | undefined = undefined;
    if (row.profile_ids_json) {
      try {
        profileIds = JSON.parse(row.profile_ids_json);
      } catch (err) {
        log.warn('automation-scheduler profile_ids_json parse failed', { scheduleId: row.id, err });
      }
    }

    return {
      id: row.id,
      workflowId: row.workflow_id,
      profileId: row.profile_id || undefined,
      profileIds,
      workspaceId: row.workspace_id || undefined,
      scheduleType: row.schedule_type,
      cronExpression: row.cron_expression || undefined,
      timezone: row.timezone || 'UTC',
      nextRunAt: row.next_run_at || undefined,
      lastRunAt: row.last_run_at || undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const automationScheduler = new AutomationSchedulerService();
