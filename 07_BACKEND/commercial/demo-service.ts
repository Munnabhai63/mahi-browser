/**
 * MAHI Browser — Demo Lead Management Service
 * Handles Enterprise / Team Demo Requests from landing page leads.
 * Enforces server-side validation and administrative lead lifecycle.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { logCommercialAudit } from './commercial-audit-service.js';

export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'CLOSED';

export interface DemoRequest {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  teamSize: string;
  useCase: string;
  contactMethod: string;
  preferredDatetime?: string;
  message?: string;
  status: DemoRequestStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDemoRequestDTO {
  fullName: string;
  email: string;
  companyName?: string;
  teamSize?: string;
  useCase?: string;
  contactMethod?: string;
  preferredDatetime?: string;
  message?: string;
}

export function createDemoRequest(dto: CreateDemoRequestDTO): { success: boolean; data?: DemoRequest; error?: string } {
  const db = getDatabase();
  const fullName = (dto.fullName || '').trim();
  const email = (dto.email || '').trim().toLowerCase();

  if (!fullName || fullName.length < 2) {
    return { success: false, error: 'Full name is required (min 2 characters).' };
  }

  if (!email || !email.includes('@') || email.length < 5) {
    return { success: false, error: 'A valid business email address is required.' };
  }

  const id = `demo_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const companyName = (dto.companyName || '').trim();
  const teamSize = (dto.teamSize || '1-5').trim();
  const useCase = (dto.useCase || 'Multi-Account Management').trim();
  const contactMethod = (dto.contactMethod || 'Email').trim();
  const preferredDatetime = (dto.preferredDatetime || '').trim();
  const message = (dto.message || '').trim();
  const status: DemoRequestStatus = 'NEW';

  try {
    db.prepare(`
      INSERT INTO demo_requests (
        id, full_name, email, company_name, team_size, use_case,
        contact_method, preferred_datetime, message, status, admin_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
    `).run(
      id, fullName, email, companyName, teamSize, useCase,
      contactMethod, preferredDatetime, message, status, now, now
    );

    logCommercialAudit({
      actorId: 'anonymous_visitor',
      actorName: fullName,
      actorRole: 'USER',
      action: 'DEMO_REQUEST_SUBMITTED',
      targetType: 'DEMO_REQUEST',
      targetId: id,
      details: `Demo requested by ${fullName} (${email}, Company: ${companyName || 'N/A'}, Team: ${teamSize})`,
    });

    const created: DemoRequest = {
      id,
      fullName,
      email,
      companyName,
      teamSize,
      useCase,
      contactMethod,
      preferredDatetime,
      message,
      status,
      createdAt: now,
      updatedAt: now,
    };

    return { success: true, data: created };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit demo request' };
  }
}

export function getDemoRequests(statusFilter?: DemoRequestStatus): DemoRequest[] {
  const db = getDatabase();
  let query = 'SELECT * FROM demo_requests';
  const params: any[] = [];

  if (statusFilter) {
    query += ' WHERE status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      companyName: r.company_name || '',
      teamSize: r.team_size || '',
      useCase: r.use_case || '',
      contactMethod: r.contact_method || '',
      preferredDatetime: r.preferred_datetime || '',
      message: r.message || '',
      status: r.status as DemoRequestStatus,
      adminNotes: r.admin_notes || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export function updateDemoRequestStatus(
  id: string,
  status: DemoRequestStatus,
  adminNotes?: string,
  actorName = 'Admin'
): { success: boolean; data?: DemoRequest; error?: string } {
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    const existing = db.prepare('SELECT id FROM demo_requests WHERE id = ?').get(id);
    if (!existing) {
      return { success: false, error: 'Demo request not found' };
    }

    if (adminNotes !== undefined) {
      db.prepare(`
        UPDATE demo_requests
        SET status = ?, admin_notes = ?, updated_at = ?
        WHERE id = ?
      `).run(status, adminNotes, now, id);
    } else {
      db.prepare(`
        UPDATE demo_requests
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(status, now, id);
    }

    logCommercialAudit({
      actorId: 'admin',
      actorName,
      actorRole: 'ADMIN',
      action: 'DEMO_REQUEST_STATUS_UPDATED',
      targetType: 'DEMO_REQUEST',
      targetId: id,
      details: `Demo request ${id} updated to status ${status}`,
    });

    const updated = db.prepare('SELECT * FROM demo_requests WHERE id = ?').get(id) as any;
    return {
      success: true,
      data: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        companyName: updated.company_name,
        teamSize: updated.team_size,
        useCase: updated.use_case,
        contactMethod: updated.contact_method,
        preferredDatetime: updated.preferred_datetime || undefined,
        message: updated.message || undefined,
        status: updated.status as DemoRequestStatus,
        adminNotes: updated.admin_notes || undefined,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
