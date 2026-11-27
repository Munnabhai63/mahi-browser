/**
 * MAHI Browser — Support Ticket & AI Assistant Service (Phase 20)
 * 
 * Provides:
 * 1. AI Assistant natural language query classification (Product, Pricing, Trial, Setup, Fingerprints, Profiles)
 * 2. Automated Smart Answers with branded, enterprise-grade clarity
 * 3. Strict Payment / Billing Query Escalation:
 *    - Automatic category classification
 *    - Creation of immutable support ticket in database
 *    - Email notification dispatched to configurable support/admin inbox
 *    - Clear user confirmation message: "Your payment-related query has been forwarded to our support team. We will review it shortly."
 * 4. Administrative ticket retrieval and management
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { getEmailProvider } from '../../05_AUTH/email-service.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { websiteUrl } from '../../10_CONFIG/shared/site-config.js';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  category: 'PAYMENT' | 'PRICING' | 'TRIAL' | 'SETUP' | 'FINGERPRINT' | 'PROFILES' | 'GENERAL';
  userEmail?: string;
  userName?: string;
  message: string;
  reply?: string;
  source: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  isEscalated: boolean;
  escalationReason?: string;
  emailSent: boolean;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportChatRequest {
  message: string;
  userEmail?: string;
  userName?: string;
  source?: string;
  accountOrPlan?: string;
}

export interface SupportChatResponse {
  success: boolean;
  reply: string;
  isPaymentEscalated: boolean;
  category: string;
  ticketNumber?: string;
  ticketId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NLP / INTENT CLASSIFICATION & KNOWLEDGE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export function classifySupportQuery(query: string): {
  isPaymentRelated: boolean;
  category: SupportTicket['category'];
  suggestedReply: string;
} {
  const q = (query || '').toLowerCase().trim();

  // Exclude purely non-payment trial queries (e.g., "7-day trial without credit card")
  const isCardlessTrialInquiry =
    /\b(without credit card|without card|no card|no credit card|free trial|try free)\b/i.test(q) &&
    !/\b(charged|charge|failed|deduct|deducted|refund|double charge|money deducted|paisa)\b/i.test(q);

  // Pattern A: Payment / Billing / Money / Refund / Invoice Issues (STRICT ESCALATION)
  const paymentPattern = /\b(payment|paid|pay|charged|charge|charges|deduct|deducted|money|refund|refunds|invoice|invoices|receipt|stripe|razorpay|billing|bill|credit card|debit|bank|transaction|failed payment|payment failed|money cut|cut ho gaye|paisa|rupaye|subscription charged)\b/i;
  if (!isCardlessTrialInquiry && paymentPattern.test(q)) {
    return {
      isPaymentRelated: true,
      category: 'PAYMENT',
      suggestedReply:
        'Your payment-related query has been forwarded to our support team. We will review it shortly. Our billing specialist will verify the transaction and reach out to you promptly.',
    };
  }

  // Pattern B: Pricing & Plans
  const pricingPattern = /\b(price|pricing|cost|costs|how much|rate|rates|plans|plan|pro 10|pro 25|pro 50|pro 100|tier|monthly|annual|discount|enterprise plan)\b/i;
  if (pricingPattern.test(q)) {
    return {
      isPaymentRelated: false,
      category: 'PRICING',
      suggestedReply:
        'MAHI Browser offers transparent, predictable pricing for every scale:\n' +
        '• Free Plan: 15 profiles, local vault, core fingerprint engine (₹0)\n' +
        '• Pro 10: 10 active profiles, automated profile warmer (₹599/mo)\n' +
        '• Pro 25: 25 profiles, 2 team seats (₹1,299/mo)\n' +
        '• Pro 50 (Most Popular): 50 profiles, 5 team seats, 7-day free trial included (₹2,199/mo)\n' +
        '• Pro 100: 100 profiles, 10 team seats, priority API (₹3,899/mo)\n' +
        '• Enterprise: Custom scale with dedicated infrastructure.\n' +
        `You can view full details or choose a plan at ${websiteUrl('/pricing', { productionFallback: true })}.`,
    };
  }

  // Pattern C: 7-Day Free Trial & Onboarding
  const trialPattern = /\b(trial|free trial|7-day|7 day|try free|test for free|demo|no card|card required|free demo)\b/i;
  if (trialPattern.test(q)) {
    return {
      isPaymentRelated: false,
      category: 'TRIAL',
      suggestedReply:
        'You can start our 100% Free 7-Day Trial of the Professional 50 plan immediately — no credit card required!\n' +
        '1. Click "Start Free 7-Day Trial" on the landing page or visit /signup?intent=trial.\n' +
        '2. Sign up via Email or 1-Click Continue with Google.\n' +
        '3. Your 7-day trial activates instantly with 50 profiles, cloud sync, and antidetect protection unlocked for download.',
    };
  }

  // Pattern D: Setup, Download, Windows Installation & SmartScreen
  const setupPattern = /\b(download|install|installation|setup|installer|exe|windows|windows 10|windows 11|portable|smartscreen|run anyway|how to install)\b/i;
  if (setupPattern.test(q)) {
    return {
      isPaymentRelated: false,
      category: 'SETUP',
      suggestedReply:
        'Installing MAHI Browser is fast and straightforward:\n' +
        `1. Create your account or log in at ${websiteUrl('/login', { productionFallback: true })}.\n` +
        `2. Go to ${websiteUrl('/download', { productionFallback: true })} to get the official Windows x64 v${APP_VERSION} installer (~85 MB).\n` +
        `3. Run MAHI-Browser-Setup-${APP_VERSION}.exe. If Microsoft Defender SmartScreen appears, click "More info" → "Run anyway".\n` +
        '4. Log into the desktop app with your credentials to sync your active trial or plan!',
    };
  }

  // Pattern E: Antidetect, Canvas, WebGL, Proxies & Warmer
  const fingerprintPattern = /\b(fingerprint|fingerprints|canvas|webgl|audio|webrtc|proxy|proxies|socks5|http proxy|spoof|spoofing|antidetect|detection|ban|bans|warmer|automation|rpa)\b/i;
  if (fingerprintPattern.test(q)) {
    return {
      isPaymentRelated: false,
      category: 'FINGERPRINT',
      suggestedReply:
        'MAHI Browser provides enterprise-grade antidetect isolation:\n' +
        '• 100% Isolated Canvas, WebGL, AudioContext, and Client Rects noise injection.\n' +
        '• Native loopback proxy manager supporting HTTP, HTTPS, SOCKS5, and SSH tunnels.\n' +
        '• Built-in Visual Profile Warmer and RPA to pre-warm cookie sessions before ad spend.\n' +
        '• Real-time IP, ISP, and latency diagnostics on profile launch.',
    };
  }

  // Pattern F: Multiple Profiles & Team Workspaces
  const profilePattern = /\b(profile|profiles|multiple account|multi-account|accounts|account|cookies|import cookies|export cookies|bulk|workspace|workspaces|team|share|sharing|facebook|google|amazon|tiktok|crypto)\b/i;
  if (profilePattern.test(q)) {
    return {
      isPaymentRelated: false,
      category: 'PROFILES',
      suggestedReply:
        'Each profile in MAHI is an independent, isolated sandbox browser container with separate cookies, local storage, cache, and hardware signatures.\n' +
        '• Create profiles manually or 1-click clone starter blueprints.\n' +
        '• Bulk import/export JSON or Netscape cookies.\n' +
        '• Organize profiles into role-based workspaces and share them securely with team members without sharing master passwords.',
    };
  }

  // Pattern G: General Assistant Greeting & Overview
  return {
    isPaymentRelated: false,
    category: 'GENERAL',
    suggestedReply:
      'Hello! I am your MAHI AI Support Assistant. I can help you with:\n' +
      '• Choosing the right plan & starting your 7-day free trial\n' +
      '• Downloading and setting up MAHI Browser on Windows 10 & 11\n' +
      '• Proxy configuration, antidetect fingerprints, and profile warmers\n' +
      '• Multi-account management and team workspace collaboration\n' +
      'Feel free to ask any question or describe what you need assistance with!',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHAT REQUEST HANDLER WITH AUTOMATIC ESCALATION & EMAIL DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSupportChatMessage(dto: SupportChatRequest): Promise<SupportChatResponse> {
  const message = (dto.message || '').trim();
  if (!message) {
    return {
      success: false,
      reply: 'Please provide a message so I can assist you.',
      isPaymentEscalated: false,
      category: 'GENERAL',
    };
  }

  const classification = classifySupportQuery(message);
  const db = getDatabase();
  const id = `tick_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const ticketNumber = `ESC-2026-${crypto.randomInt(1000, 9999)}`;
  const source = dto.source || 'landing_ai_chat';
  const userEmail = dto.userEmail ? dto.userEmail.trim().toLowerCase() : undefined;
  const userName = dto.userName ? dto.userName.trim() : undefined;

  let finalReply = classification.suggestedReply;
  let emailSent = false;

  if (classification.isPaymentRelated) {
    finalReply = `Your payment-related query has been forwarded to our support team. We will review it shortly. Reference Ticket: #${ticketNumber}.`;

    // 1. Persist escalated support ticket in SQLite
    try {
      db.prepare(`
        INSERT INTO support_tickets (
          id, ticket_number, category, user_email, user_name, message, reply,
          source, status, is_escalated, escalation_reason, email_sent, admin_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 1, 'Payment / Billing Query Auto-Escalation', ?, NULL, ?, ?)
      `).run(
        id,
        ticketNumber,
        classification.category,
        userEmail || null,
        userName || null,
        message,
        finalReply,
        source,
        0, // initially 0, updated after dispatch
        now,
        now
      );
    } catch (err) {
      console.error('[SupportService] Failed to insert support ticket:', err);
    }

    // 2. Dispatch email notification to support team
    try {
      const emailProvider = getEmailProvider();
      emailSent = await emailProvider.sendSupportEscalationEmail({
        ticketNumber,
        userName,
        userEmail,
        category: 'PAYMENT',
        message,
        timestamp: now,
        source,
        accountOrPlan: dto.accountOrPlan,
      });

      if (emailSent) {
        db.prepare('UPDATE support_tickets SET email_sent = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
      }
    } catch (err) {
      console.error('[SupportService] Failed to dispatch escalation email:', err);
    }

    // 3. Log audit event safely
    try {
      logCommercialAudit({
        actorId: userEmail || 'visitor',
        actorName: userName || 'Anonymous Visitor',
        actorRole: 'USER',
        action: 'SUPPORT_TICKET_ESCALATED',
        targetType: 'SUPPORT_TICKET',
        targetId: id,
        details: JSON.stringify({
          ticketNumber,
          category: classification.category,
          emailSent,
        }),
        result: 'SUCCESS',
      });
    } catch (auditErr) {
      console.warn('[SupportService] Audit logging warning:', auditErr);
    }

    return {
      success: true,
      reply: finalReply,
      isPaymentEscalated: true,
      category: 'PAYMENT',
      ticketNumber,
      ticketId: id,
    };
  }

  // Non-escalated general queries (smart answer provided directly)
  try {
    db.prepare(`
      INSERT INTO support_tickets (
        id, ticket_number, category, user_email, user_name, message, reply,
        source, status, is_escalated, escalation_reason, email_sent, admin_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RESOLVED', 0, NULL, 0, NULL, ?, ?)
    `).run(
      id,
      ticketNumber,
      classification.category,
      userEmail || null,
      userName || null,
      message,
      finalReply,
      source,
      now,
      now
    );
  } catch {}

  return {
    success: true,
    reply: finalReply,
    isPaymentEscalated: false,
    category: classification.category,
    ticketNumber,
    ticketId: id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADMIN TICKET RETRIEVAL & MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function getSupportTickets(filter?: { status?: string; category?: string; escalatedOnly?: boolean }): SupportTicket[] {
  const db = getDatabase();
  let query = 'SELECT * FROM support_tickets WHERE 1=1';
  const params: any[] = [];

  if (filter?.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter?.category) {
    query += ' AND category = ?';
    params.push(filter.category);
  }
  if (filter?.escalatedOnly) {
    query += ' AND is_escalated = 1';
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticket_number,
    category: r.category,
    userEmail: r.user_email || undefined,
    userName: r.user_name || undefined,
    message: r.message,
    reply: r.reply || undefined,
    source: r.source,
    status: r.status,
    isEscalated: Boolean(r.is_escalated),
    escalationReason: r.escalation_reason || undefined,
    emailSent: Boolean(r.email_sent),
    adminNotes: r.admin_notes || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function updateSupportTicketStatus(
  id: string,
  status: SupportTicket['status'],
  adminNotes?: string,
  actorName: string = 'Admin'
): { success: boolean; data?: SupportTicket; error?: string } {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
  if (!existing) {
    return { success: false, error: 'Support ticket not found.' };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE support_tickets 
    SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ?
    WHERE id = ?
  `).run(status, adminNotes || null, now, id);

  try {
    logCommercialAudit({
      actorId: 'admin',
      actorName: actorName,
      actorRole: 'ADMIN',
      action: 'SUPPORT_TICKET_UPDATED',
      targetType: 'SUPPORT_TICKET',
      targetId: id,
      details: JSON.stringify({ oldStatus: existing.status, newStatus: status, adminNotes }),
      result: 'SUCCESS',
    });
  } catch (auditErr) {
    console.warn('[SupportService] Audit logging warning:', auditErr);
  }

  const updated = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
  return {
    success: true,
    data: {
      id: updated.id,
      ticketNumber: updated.ticket_number,
      category: updated.category,
      userEmail: updated.user_email || undefined,
      userName: updated.user_name || undefined,
      message: updated.message,
      reply: updated.reply || undefined,
      source: updated.source,
      status: updated.status,
      isEscalated: Boolean(updated.is_escalated),
      escalationReason: updated.escalation_reason || undefined,
      emailSent: Boolean(updated.email_sent),
      adminNotes: updated.admin_notes || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  };
}

/**
 * Phase 23: Admin Live Reply Desk
 * Dispatches an official resolution or reply to a customer support ticket and updates status.
 */
export function replySupportTicket(
  id: string,
  replyText: string,
  status: SupportTicket['status'] = 'RESOLVED',
  adminNotes?: string,
  actorName: string = 'Admin'
): { success: boolean; data?: SupportTicket; error?: string } {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
  if (!existing) {
    return { success: false, error: 'Support ticket not found.' };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE support_tickets 
    SET reply = ?, status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ?
    WHERE id = ?
  `).run(replyText, status, adminNotes || null, now, id);

  try {
    logCommercialAudit({
      actorId: 'admin',
      actorName: actorName,
      actorRole: 'ADMIN',
      action: 'SUPPORT_TICKET_REPLIED',
      targetType: 'SUPPORT_TICKET',
      targetId: id,
      details: JSON.stringify({ ticketNumber: existing.ticket_number, status, replyPreview: replyText.substring(0, 80) }),
      result: 'SUCCESS',
    });
  } catch (auditErr) {
    console.warn('[SupportService] Audit logging warning:', auditErr);
  }

  const updated = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
  return {
    success: true,
    data: {
      id: updated.id,
      ticketNumber: updated.ticket_number,
      category: updated.category,
      userEmail: updated.user_email || undefined,
      userName: updated.user_name || undefined,
      message: updated.message,
      reply: updated.reply || undefined,
      source: updated.source,
      status: updated.status,
      isEscalated: Boolean(updated.is_escalated),
      escalationReason: updated.escalation_reason || undefined,
      emailSent: Boolean(updated.email_sent),
      adminNotes: updated.admin_notes || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  };
}

export function getSupportTicketMetrics(): {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  escalated: number;
} {
  const db = getDatabase();
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM support_tickets').get() as any)?.c || 0;
    const open = (db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'OPEN'").get() as any)?.c || 0;
    const inProgress = (db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'IN_PROGRESS'").get() as any)?.c || 0;
    const resolved = (db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status IN ('RESOLVED', 'CLOSED')").get() as any)?.c || 0;
    const escalated = (db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE is_escalated = 1 AND status != 'CLOSED'").get() as any)?.c || 0;

    return { total, open, inProgress, resolved, escalated };
  } catch {
    return { total: 0, open: 0, inProgress: 0, resolved: 0, escalated: 0 };
  }
}

