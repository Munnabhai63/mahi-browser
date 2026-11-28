import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { ActivityLogItem, ActivityLogFilter, LogCategory, LogSeverity } from '../../10_CONFIG/shared/types/logs.js';
import { sanitizeSensitiveString, sanitizeObject } from '../../08_SECURITY/sanitizer.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('audit-service');

type LogListener = (log: ActivityLogItem) => void;
const listeners: Set<LogListener> = new Set();

export function addLogListener(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function logActivity(
  category: LogCategory,
  severity: LogSeverity,
  action: string,
  details: string,
  profileId?: string,
  profileName?: string,
  metadata?: Record<string, unknown>
): ActivityLogItem {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const cleanDetails = sanitizeSensitiveString(details);
  const cleanMeta = metadata ? sanitizeObject(metadata) : null;
  const metaJson = cleanMeta ? JSON.stringify(cleanMeta) : null;

  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, category, severity, action, details, profile_id, profile_name, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, timestamp, category, severity, action, cleanDetails, profileId || null, profileName || null, metaJson);

  const logItem: ActivityLogItem = {
    id,
    timestamp,
    category,
    severity,
    action,
    details: cleanDetails,
    profileId,
    profileName,
    metadata: cleanMeta || undefined,
  };

  // Notify active listeners
  for (const listener of listeners) {
    try {
      listener(logItem);
    } catch (listenerErr) {
      log.debug('Audit log listener threw asynchronously', {
        err: listenerErr instanceof Error ? listenerErr.message : String(listenerErr),
      });
    }
  }

  return logItem;
}

export function getActivityLogs(filter: ActivityLogFilter = {}): ActivityLogItem[] {
  const db = getDatabase();
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];

  if (filter.category) {
    query += ' AND category = ?';
    params.push(filter.category);
  }
  if (filter.severity) {
    query += ' AND severity = ?';
    params.push(filter.severity);
  }
  if (filter.profileId) {
    query += ' AND profile_id = ?';
    params.push(filter.profileId);
  }
  if (filter.searchQuery) {
    query += ' AND (action LIKE ? OR details LIKE ? OR profile_name LIKE ?)';
    const term = `%${filter.searchQuery}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(filter.limit || 200);

  const rows = db.prepare(query).all(...params) as {
    id: string;
    timestamp: string;
    category: string;
    severity: string;
    action: string;
    details: string;
    profile_id: string | null;
    profile_name: string | null;
    metadata_json: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    category: row.category as LogCategory,
    severity: row.severity as LogSeverity,
    action: row.action,
    details: row.details,
    profileId: row.profile_id || undefined,
    profileName: row.profile_name || undefined,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  }));
}

export function clearActivityLogs(): boolean {
  const db = getDatabase();
  db.prepare('DELETE FROM audit_logs').run();
  return true;
}
