/**
 * MAHI Browser — Mobile Companion Service
 * Phase 11 Architecture
 *
 * Capabilities:
 * - Device registration and FCM/Android push token management
 * - Category notification preferences (Security, Cloud, Automation, Workspace, Proxy)
 * - Strict push payload sanitization (Zero passwords, cookies, session tokens, or keys in notifications)
 * - Mobile notification history and read tracking
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  MobileDeviceTokenRecord,
  RegisterMobileDeviceDTO,
  MobileNotificationPreferences,
  MobileNotificationRecord,
  MobileNotificationCategory,
} from '../../10_CONFIG/shared/types/mobile.js';

const SENSITIVE_KEYWORDS = [
  'token',
  'password',
  'cookie',
  'secret',
  'key',
  'envelope',
  'credential',
  'auth',
  'bearer',
];

export function sanitizePushData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const clean: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
    const isSensitive = SENSITIVE_KEYWORDS.some((kw) => lowerKey.includes(kw));

    if (isSensitive) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      clean[k] = sanitizePushData(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }

  return clean;
}


export class MobileCompanionService {
  private static instance: MobileCompanionService;

  private constructor() {}

  public static getInstance(): MobileCompanionService {
    if (!MobileCompanionService.instance) {
      MobileCompanionService.instance = new MobileCompanionService();
    }
    return MobileCompanionService.instance;
  }

  public static resetForTest(): void {
    try {
      const db = getDatabase();
      db.prepare(`DELETE FROM mobile_device_tokens`).run();
      db.prepare(`DELETE FROM mobile_notification_preferences`).run();
      db.prepare(`DELETE FROM mobile_notifications`).run();
    } catch {
      // Table may not be initialized yet in memory
    }
  }

  public static async registerDeviceToken(userId: string, dto: RegisterMobileDeviceDTO): Promise<MobileDeviceTokenRecord> {
    return MobileCompanionService.getInstance().registerDeviceToken(userId, dto);
  }

  public static async revokeDeviceToken(userId: string, deviceId: string): Promise<boolean> {
    MobileCompanionService.getInstance().revokeDeviceToken(userId, deviceId);
    return true;
  }

  public static async getActiveDeviceTokens(userId: string): Promise<MobileDeviceTokenRecord[]> {
    return MobileCompanionService.getInstance().getActiveDeviceTokens(userId);
  }

  public static async getNotificationPreferences(userId: string): Promise<MobileNotificationPreferences> {
    return MobileCompanionService.getInstance().getNotificationPreferences(userId);
  }

  public static async updateNotificationPreferences(
    userId: string,
    prefs: Partial<Omit<MobileNotificationPreferences, 'userId' | 'updatedAt'>>
  ): Promise<MobileNotificationPreferences> {
    return MobileCompanionService.getInstance().updateNotificationPreferences(userId, prefs);
  }

  public static async sendNotification(
    userId: string,
    category: MobileNotificationCategory,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<MobileNotificationRecord | null> {
    return MobileCompanionService.getInstance().dispatchNotification({ userId, category, title, body, data });
  }

  public static async getUserNotifications(userId: string, limit = 50, unreadOnly = false): Promise<MobileNotificationRecord[]> {
    return MobileCompanionService.getInstance().getUserNotifications(userId, limit, unreadOnly);
  }


  /**
   * Registers or updates an Android device's push notification token.
   */
  public registerDeviceToken(userId: string, dto: RegisterMobileDeviceDTO): MobileDeviceTokenRecord {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = db.prepare(`
      SELECT * FROM mobile_device_tokens WHERE user_id = ? AND device_id = ?
    `).get(userId, dto.deviceId) as any;

    if (existing) {
      db.prepare(`
        UPDATE mobile_device_tokens
        SET push_token = ?,
            device_model = COALESCE(?, device_model),
            os_version = COALESCE(?, os_version),
            app_version = COALESCE(?, app_version),
            status = 'ACTIVE',
            last_seen_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        dto.pushToken,
        dto.deviceModel || null,
        dto.osVersion || null,
        dto.appVersion || null,
        now,
        now,
        existing.id
      );

      return {
        ...existing,
        pushToken: dto.pushToken,
        status: 'ACTIVE',
        lastSeenAt: now,
        updatedAt: now,
      };
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO mobile_device_tokens (
        id, user_id, device_id, push_token, platform, device_model,
        os_version, app_version, status, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'android', ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(
      id,
      userId,
      dto.deviceId,
      dto.pushToken,
      dto.deviceModel || null,
      dto.osVersion || null,
      dto.appVersion || null,
      now,
      now,
      now
    );

    return {
      id,
      userId,
      deviceId: dto.deviceId,
      pushToken: dto.pushToken,
      platform: 'android',
      deviceModel: dto.deviceModel,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
      status: 'ACTIVE',
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Revokes a registered mobile device token upon logout or session termination.
   */
  public revokeDeviceToken(userId: string, deviceId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE mobile_device_tokens
      SET status = 'REVOKED', updated_at = ?
      WHERE user_id = ? AND device_id = ?
    `).run(new Date().toISOString(), userId, deviceId);
  }

  /**
   * Retrieves active registered device tokens for a user.
   */
  public getActiveDeviceTokens(userId: string): MobileDeviceTokenRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM mobile_device_tokens WHERE user_id = ? AND status = 'ACTIVE'
    `).all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      deviceId: r.device_id,
      pushToken: r.push_token,
      platform: r.platform,
      deviceModel: r.device_model,
      osVersion: r.os_version,
      appVersion: r.app_version,
      status: r.status,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }


  /**
   * Retrieves mobile notification preferences for a user.
   */
  public getNotificationPreferences(userId: string): MobileNotificationPreferences {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM mobile_notification_preferences WHERE user_id = ?
    `).get(userId) as any;

    if (!row) {
      return {
        userId,
        securityAlerts: true,
        cloudSessions: true,
        automationAlerts: true,
        workspaceAlerts: true,
        proxyAlerts: true,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      userId: row.user_id,
      securityAlerts: Boolean(row.security_alerts),
      cloudSessions: Boolean(row.cloud_sessions),
      automationAlerts: Boolean(row.automation_alerts),
      workspaceAlerts: Boolean(row.workspace_alerts),
      proxyAlerts: Boolean(row.proxy_alerts),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Updates mobile notification category preferences.
   */
  public updateNotificationPreferences(
    userId: string,
    prefs: Partial<Omit<MobileNotificationPreferences, 'userId' | 'updatedAt'>>
  ): MobileNotificationPreferences {
    const current = this.getNotificationPreferences(userId);
    const updated = {
      ...current,
      ...prefs,
      updatedAt: new Date().toISOString(),
    };

    const db = getDatabase();
    db.prepare(`
      INSERT INTO mobile_notification_preferences (
        user_id, security_alerts, cloud_sessions, automation_alerts,
        workspace_alerts, proxy_alerts, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        security_alerts = excluded.security_alerts,
        cloud_sessions = excluded.cloud_sessions,
        automation_alerts = excluded.automation_alerts,
        workspace_alerts = excluded.workspace_alerts,
        proxy_alerts = excluded.proxy_alerts,
        updated_at = excluded.updated_at
    `).run(
      userId,
      updated.securityAlerts ? 1 : 0,
      updated.cloudSessions ? 1 : 0,
      updated.automationAlerts ? 1 : 0,
      updated.workspaceAlerts ? 1 : 0,
      updated.proxyAlerts ? 1 : 0,
      updated.updatedAt
    );

    return updated;
  }

  /**
   * Dispatches a mobile notification, checking user category preferences
   * and sanitizing sensitive secrets from payloads.
   */
  public dispatchNotification(params: {
    userId: string;
    category: MobileNotificationCategory;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): MobileNotificationRecord | null {
    const { userId, category, title, body, data } = params;
    const prefs = this.getNotificationPreferences(userId);

    // Verify category preference
    if (category === 'SECURITY' && !prefs.securityAlerts) return null;
    if (category === 'CLOUD_SESSION' && !prefs.cloudSessions) return null;
    if (category === 'AUTOMATION' && !prefs.automationAlerts) return null;
    if (category === 'WORKSPACE' && !prefs.workspaceAlerts) return null;
    if (category === 'PROXY' && !prefs.proxyAlerts) return null;

    // Strict push payload sanitization
    const sanitizedData = sanitizePushData(data);

    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO mobile_notifications (
        id, user_id, category, title, body, data_json, read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      userId,
      category,
      title,
      body,
      sanitizedData ? JSON.stringify(sanitizedData) : null,
      now
    );

    return {
      id,
      userId,
      category,
      title,
      body,
      data: sanitizedData,
      read: false,
      createdAt: now,
    };
  }

  /**
   * Retrieves notification history for mobile user.
   */
  public getUserNotifications(userId: string, limit = 50, unreadOnly = false): MobileNotificationRecord[] {
    const db = getDatabase();
    let query = `
      SELECT id, user_id as userId, category, title, body, data_json as dataJson,
             read, created_at as createdAt
      FROM mobile_notifications
      WHERE user_id = ?
    `;

    if (unreadOnly) {
      query += ' AND read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';

    const rows = db.prepare(query).all(userId, Math.min(limit, 100)) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      category: r.category as MobileNotificationCategory,
      title: r.title,
      body: r.body,
      data: r.dataJson ? JSON.parse(r.dataJson) : undefined,
      read: Boolean(r.read),
      createdAt: r.createdAt,
    }));
  }

  /**
   * Marks a notification as read.
   */
  public markNotificationRead(userId: string, notificationId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE mobile_notifications SET read = 1 WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);
  }
}

export const mobileCompanionService = MobileCompanionService.getInstance();
