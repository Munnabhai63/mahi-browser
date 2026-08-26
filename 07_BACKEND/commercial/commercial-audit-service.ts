import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { CommercialAuditLog, CommercialAuditResult, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';

export function logCommercialAudit(params: {
  actorId: string;
  actorName: string;
  actorRole: CommercialRole;
  action: string;
  targetType: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  result?: CommercialAuditResult;
}): CommercialAuditLog {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = params.result || 'SUCCESS';

  // Sanitize details to never log raw passwords, authorization tokens, or full secrets
  const sanitizedDetails = params.details
    .replace(/("?password"?\s*[:=]\s*)"[^"]+"/gi, '$1"***"')
    .replace(/("?token"?\s*[:=]\s*)"[^"]+"/gi, '$1"***"')
    .replace(/("?secret"?\s*[:=]\s*)"[^"]+"/gi, '$1"***"');

  db.prepare(`
    INSERT INTO commercial_audit_logs (
      id, actor_id, actor_name, actor_role, action,
      target_type, target_id, details, ip_address, result, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.actorId,
    params.actorName,
    params.actorRole,
    params.action,
    params.targetType,
    params.targetId || null,
    sanitizedDetails,
    params.ipAddress || '127.0.0.1',
    result,
    now
  );

  return {
    id,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: sanitizedDetails,
    ipAddress: params.ipAddress || '127.0.0.1',
    result,
    createdAt: now,
  };
}

export function getCommercialAuditLogs(filter?: {
  action?: string;
  actorRole?: string;
  result?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): { logs: CommercialAuditLog[]; total: number } {
  const db = getDatabase();
  let query = 'SELECT * FROM commercial_audit_logs WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM commercial_audit_logs WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (filter?.action) {
    query += ' AND action = ?';
    countQuery += ' AND action = ?';
    params.push(filter.action);
    countParams.push(filter.action);
  }

  if (filter?.actorRole) {
    query += ' AND actor_role = ?';
    countQuery += ' AND actor_role = ?';
    params.push(filter.actorRole);
    countParams.push(filter.actorRole);
  }

  if (filter?.result) {
    query += ' AND result = ?';
    countQuery += ' AND result = ?';
    params.push(filter.result);
    countParams.push(filter.result);
  }

  if (filter?.searchQuery) {
    const term = `%${filter.searchQuery}%`;
    query += ' AND (actor_name LIKE ? OR action LIKE ? OR details LIKE ? OR target_type LIKE ?)';
    countQuery += ' AND (actor_name LIKE ? OR action LIKE ? OR details LIKE ? OR target_type LIKE ?)';
    params.push(term, term, term, term);
    countParams.push(term, term, term, term);
  }

  query += ' ORDER BY created_at DESC';

  const limit = Math.min(100, Math.max(1, filter?.limit || 50));
  const offset = Math.max(0, filter?.offset || 0);

  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const total = (db.prepare(countQuery).get(...countParams) as any)?.count || 0;
  const rows = db.prepare(query).all(...params) as any[];

  const logs = rows.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorRole: r.actor_role as CommercialRole,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id || undefined,
    details: r.details,
    ipAddress: r.ip_address || undefined,
    result: r.result as CommercialAuditResult,
    createdAt: r.created_at,
  }));

  return { logs, total };
}
