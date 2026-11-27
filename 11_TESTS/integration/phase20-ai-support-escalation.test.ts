import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import { classifySupportQuery, handleSupportChatMessage } from '../../07_BACKEND/commercial/support-ticket-service.js';
import { getEmailProvider, DevelopmentEmailProvider } from '../../05_AUTH/email-service.js';
import { getInstallSecrets } from '../../08_SECURITY/install-secrets.js';

describe('Phase 20 — AI Support Assistant & Payment Escalation Integration Suite', () => {
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase20-support-'));
  const testDbPath = path.join(testDbDir, 'support_phase20.sqlite');
  let server: http.Server;
  let baseUrl: string;
  const testPort = 39885;

  beforeAll(async () => {
    fs.mkdirSync(testDbDir, { recursive: true });
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    server = createCentralApiServer();
    await new Promise<void>((resolve) => {
      server.listen(testPort, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${testPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    closeDatabase();
    try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch {}
  });

  async function request(endpoint: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.json();
    return { status: res.status, data };
  }

  // 1. NLP / Intent Classification Unit Tests
  describe('Query Intent Classification', () => {
    it('classifies pricing questions correctly', () => {
      const result = classifySupportQuery('How much does the Pro 50 plan cost per month?');
      expect(result.isPaymentRelated).toBe(false);
      expect(result.category).toBe('PRICING');
      expect(result.suggestedReply).toContain('MAHI Browser offers transparent, predictable pricing');
    });

    it('classifies trial & onboarding questions correctly', () => {
      const result = classifySupportQuery('Is there a 7-day free trial without credit card?');
      expect(result.isPaymentRelated).toBe(false);
      expect(result.category).toBe('TRIAL');
      expect(result.suggestedReply).toContain('100% Free 7-Day Trial');
    });

    it('classifies setup & Windows installation questions correctly', () => {
      const result = classifySupportQuery('How do I install the .exe file on Windows 11?');
      expect(result.isPaymentRelated).toBe(false);
      expect(result.category).toBe('SETUP');
      expect(result.suggestedReply).toMatch(/MAHI-Browser-Setup-\d+\.\d+\.\d+\.exe/);
    });

    it('classifies fingerprint isolation questions correctly', () => {
      const result = classifySupportQuery('Does MAHI mask Canvas, WebGL and audio fingerprints?');
      expect(result.isPaymentRelated).toBe(false);
      expect(result.category).toBe('FINGERPRINT');
      expect(result.suggestedReply).toContain('Isolated Canvas, WebGL, AudioContext');
    });

    it('classifies multi-accounting questions correctly', () => {
      const result = classifySupportQuery('Can I run 20 Facebook and Google accounts at the same time?');
      expect(result.isPaymentRelated).toBe(false);
      expect(result.category).toBe('PROFILES');
      expect(result.suggestedReply).toContain('isolated sandbox');
    });

    it('strictly classifies payment failure queries as PAYMENT escalation', () => {
      const queries = [
        'My payment failed but money was deducted from my bank account',
        'Money deducted but plan not activated in dashboard',
        'I need an invoice and receipt for my company subscription',
        'Please process a refund for transaction #92831',
        'My credit card was charged twice on Stripe',
        'Razorpay payment problem during checkout',
        'paisa kat gaya par plan nahi mila',
      ];

      for (const q of queries) {
        const result = classifySupportQuery(q);
        expect(result.isPaymentRelated).toBe(true);
        expect(result.category).toBe('PAYMENT');
        expect(result.suggestedReply).toContain('Your payment-related query has been forwarded to our support team');
      }
    });
  });

  // 2. Direct Service Chat & Ticket Creation
  describe('handleSupportChatMessage Service', () => {
    it('handles general question without escalation or email', async () => {
      const res = await handleSupportChatMessage({
        message: 'What proxies are supported?',
        userEmail: 'user@example.com',
        userName: 'Alex Dev',
        source: 'landing_chat',
      });

      expect(res.success).toBe(true);
      expect(res.isPaymentEscalated).toBe(false);
      expect(res.category).toBe('FINGERPRINT');
      expect(res.reply).toContain('SOCKS5');
    });

    it('handles payment escalation: creates DB ticket and triggers email', async () => {
      const emailProvider = getEmailProvider();
      if (emailProvider instanceof DevelopmentEmailProvider) {
        emailProvider.clear();
      }

      const res = await handleSupportChatMessage({
        message: 'Payment failed on Razorpay, 2199 rupees charged from my bank account',
        userEmail: 'alex.billing@example.com',
        userName: 'Alex Customer',
        source: 'landing_chat',
        accountOrPlan: 'Pro 50',
      });

      expect(res.success).toBe(true);
      expect(res.isPaymentEscalated).toBe(true);
      expect(res.category).toBe('PAYMENT');
      expect(res.ticketNumber).toMatch(/^ESC-2026-\d{4}$/);
      expect(res.reply).toContain('Your payment-related query has been forwarded to our support team');

      // Verify DB ticket record
      const db = getDatabase();
      const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(res.ticketId) as any;
      expect(ticket).toBeDefined();
      expect(ticket.ticket_number).toBe(res.ticketNumber);
      expect(ticket.category).toBe('PAYMENT');
      expect(ticket.user_email).toBe('alex.billing@example.com');
      expect(ticket.is_escalated).toBe(1);
      expect(ticket.status).toBe('OPEN');

      // Verify email was dispatched
      if (emailProvider instanceof DevelopmentEmailProvider) {
        const emails = emailProvider.getSentEmails();
        expect(emails.length).toBeGreaterThanOrEqual(1);
        const escalationEmail = emails.find((e) => e.subject.includes('[MAHI Support] Payment Query Escalation'));
        expect(escalationEmail).toBeDefined();
        expect(escalationEmail?.html).toContain(res.ticketNumber);
        expect(escalationEmail?.html).toContain('alex.billing@example.com');
      }
    });
  });

  // 3. Commercial API Router Endpoints
  describe('Commercial Support Chat & Admin REST API', () => {
    it('POST /api/v1/commercial/support/chat answers general query', async () => {
      const res = await request('/api/v1/commercial/support/chat', {
        method: 'POST',
        body: {
          message: 'Can I download MAHI browser for Windows?',
          userName: 'Visitor User',
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.isPaymentEscalated).toBe(false);
      expect(res.data.reply).toContain('Windows');
    });

    it('POST /api/v1/commercial/support/chat escalates payment issue with ticket number', async () => {
      const res = await request('/api/v1/commercial/support/chat', {
        method: 'POST',
        body: {
          message: 'Money deducted from credit card but subscription status is still inactive',
          userEmail: 'vip.trader@crypto.org',
          userName: 'VIP Trader',
          source: 'landing_support_section',
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.isPaymentEscalated).toBe(true);
      expect(res.data.category).toBe('PAYMENT');
      expect(res.data.ticketNumber).toMatch(/^ESC-2026-\d{4}$/);
      expect(res.data.reply).toContain('Your payment-related query has been forwarded to our support team');
    });

    it('GET /api/v1/commercial/admin/support-tickets lists created tickets with admin auth', async () => {
      const validSecret = getInstallSecrets().adminWebSecret;
      const res = await request('/api/v1/commercial/admin/support-tickets?category=PAYMENT', {
        headers: { 'X-Admin-Secret': validSecret },
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
      expect(res.data.data.length).toBeGreaterThanOrEqual(2);
      expect(res.data.data[0].category).toBe('PAYMENT');
    });

    it('PUT /api/v1/commercial/admin/support-tickets/:id/status updates ticket status', async () => {
      const validSecret = getInstallSecrets().adminWebSecret;
      const listRes = await request('/api/v1/commercial/admin/support-tickets', {
        headers: { 'X-Admin-Secret': validSecret },
      });
      const firstTicket = listRes.data.data[0];

      const updateRes = await request(`/api/v1/commercial/admin/support-tickets/${firstTicket.id}/status`, {
        method: 'PUT',
        headers: { 'X-Admin-Secret': validSecret },
        body: {
          status: 'RESOLVED',
          adminNotes: 'Payment verified and transaction approved manually',
        },
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.data.success).toBe(true);
      expect(updateRes.data.data.status).toBe('RESOLVED');
      expect(updateRes.data.data.adminNotes).toBe('Payment verified and transaction approved manually');
    });
  });
});
