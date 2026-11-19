/**
 * MAHI Browser — Payment Email Notifications Unit Tests
 * Verifies admin alerts on UTR submission and customer notifications on approve/reject.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';
import {
  EmailProvider,
  getEmailProvider,
  setEmailProvider,
  createProductionEmailProvider,
  DevelopmentEmailProvider,
} from '../../05_AUTH/email-service.js';
import { SUPPORT_EMAIL } from '../../10_CONFIG/contact-config.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';

class StubEmailProvider implements EmailProvider {
  public billingAlerts: Array<{
    email: string;
    invoiceId: string;
    amount: string;
    reason: string;
    metadata?: any;
    body: string;
  }> = [];

  public paymentApprovedEmails: Array<{
    email: string;
    planName: string;
    amountInr: string;
    paidAt: string;
    licenceKey?: string;
    validUntil?: string;
  }> = [];

  public paymentRejectedEmails: Array<{
    email: string;
    planName: string;
    reason: string;
    supportEmail: string;
  }> = [];

  public paymentPendingEmails: Array<{
    email: string;
    planName: string;
    amountInr: string;
    utr: string;
    submittedAt: string;
  }> = [];

  public shouldThrow: boolean = false;

  async sendVerificationEmail(email: string, token: string, verifyUrl: string): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    return true;
  }

  async sendPasswordResetEmail(email: string, token: string, resetUrl: string): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    return true;
  }

  async sendSecurityAlert(email: string, alertType: string, details: string): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    return true;
  }

  async sendWorkspaceInvitationEmail(
    email: string,
    token: string,
    workspaceName: string,
    inviterName: string,
    inviteUrl: string
  ): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    return true;
  }

  async sendBillingAlert(
    email: string,
    invoiceId: string,
    amount: string,
    reason: string,
    metadata?: any
  ): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    const body = `<p>Payment ID: ${invoiceId}</p><p>Amount: ${amount}</p><p>Reason: ${reason}</p><p>Plan: ${metadata?.planName}</p>`;
    this.billingAlerts.push({ email, invoiceId, amount, reason, metadata, body });
    return true;
  }

  async sendSupportEscalationEmail(payload: any): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    return true;
  }

  async sendPaymentPendingEmail(payload: any): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    this.paymentPendingEmails.push(payload);
    return true;
  }

  async sendPaymentApprovedEmail(payload: any): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    this.paymentApprovedEmails.push(payload);
    return true;
  }

  async sendPaymentRejectedEmail(payload: any): Promise<boolean> {
    if (this.shouldThrow) throw new Error('SIMULATED_EMAIL_FAILURE');
    this.paymentRejectedEmails.push(payload);
    return true;
  }

  clear(): void {
    this.billingAlerts = [];
    this.paymentApprovedEmails = [];
    this.paymentRejectedEmails = [];
    this.paymentPendingEmails = [];
    this.shouldThrow = false;
  }
}

describe('Payment Email Notifications Suite (Block B)', () => {
  let stubProvider: StubEmailProvider;
  let originalProvider: EmailProvider;
  let originalEnv: NodeJS.ProcessEnv;
  let testUserId: string;
  let testUserEmail: string;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    originalProvider = getEmailProvider();
    await initializeDatabase();

    stubProvider = new StubEmailProvider();
    setEmailProvider(stubProvider);

    // Register a persistent test customer
    testUserEmail = `pay_notify_${Date.now()}@testmahibrowser.com`;
    const regRes = await registerCentralUser({
      email: testUserEmail,
      password: 'StrongPassword123!',
      name: 'Payment Notification Tester',
    });
    testUserId = regRes.user!.id;

    const db = getDatabase();
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(testUserId);
    db.prepare(`
      INSERT OR REPLACE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'salt', 'Payment Notification Tester', 'plan_free', datetime('now'), datetime('now'))
    `).run(testUserId, testUserEmail);
  });

  afterAll(() => {
    setEmailProvider(originalProvider);
    process.env = originalEnv;
  });

  beforeEach(() => {
    stubProvider.clear();
    process.env = { ...originalEnv };
  });

  it('1. submitManualUpiPayment triggers exactly ONE admin alert, addressed to ADMIN_PAYMENT_EMAIL when set, else SUPPORT_EMAIL', async () => {
    // 1a: With custom ADMIN_PAYMENT_EMAIL
    process.env.ADMIN_PAYMENT_EMAIL = 'custom-ops-admin@mahibrowser.com';
    const utr1 = `UTRADM1${Date.now()}`;
    const res1 = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr: utr1,
    });

    expect(res1.status).toBe('PENDING_VERIFICATION');
    expect(stubProvider.billingAlerts.length).toBe(1);
    expect(stubProvider.billingAlerts[0].email).toBe('custom-ops-admin@mahibrowser.com');

    // 1b: Without ADMIN_PAYMENT_EMAIL (falls back to SUPPORT_EMAIL)
    delete process.env.ADMIN_PAYMENT_EMAIL;
    stubProvider.clear();

    const utr2 = `UTRADM2${Date.now()}`;
    const res2 = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_25',
      billingCycle: 'ANNUAL',
      utr: utr2,
    });

    expect(res2.status).toBe('PENDING_VERIFICATION');
    expect(stubProvider.billingAlerts.length).toBe(1);
    expect(stubProvider.billingAlerts[0].email).toBe(SUPPORT_EMAIL);
  });

  it('2. The admin alert body contains the UTR and the amount in rupees', async () => {
    const utr = `UTRBODY${Date.now()}`;
    await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr,
    });

    expect(stubProvider.billingAlerts.length).toBe(1);
    const alert = stubProvider.billingAlerts[0];
    // Amount in rupees e.g. ₹999 or ₹999.00
    expect(alert.amount).toMatch(/₹\s*\d+/);
    // Reason contains UTR
    expect(alert.reason).toContain(utr);
    // Alert body contains UTR and amount
    expect(alert.body).toContain(utr);
    expect(alert.body).toMatch(/₹\s*\d+/);
  });

  it('3. approveManualPayment triggers exactly ONE user email with the right address', async () => {
    const utr = `UTRAPP${Date.now()}`;
    const submitRes = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'ANNUAL',
      utr,
    });
    stubProvider.clear();

    const approveRes = await paymentService.approveManualPayment(submitRes.paymentId, {
      id: 'admin_test_1',
      name: 'Super Admin',
      role: 'ADMIN',
    });

    expect(approveRes.status).toBe('SUCCEEDED');
    expect(stubProvider.paymentApprovedEmails.length).toBe(1);
    const approvedEmail = stubProvider.paymentApprovedEmails[0];
    expect(approvedEmail.email).toBe(testUserEmail);
    expect(approvedEmail.planName).toBeDefined();
    expect(approvedEmail.paidAt).toBeDefined();
    // licenceKey should be undefined since activateSubscriptionFromPayment does not surface one
    expect(approvedEmail.licenceKey).toBeUndefined();
  });

  it('4. rejectManualPayment triggers exactly ONE user email containing the reason', async () => {
    const utr = `UTRREJ${Date.now()}`;
    const submitRes = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr,
    });
    stubProvider.clear();

    const rejectionReason = 'Bank reference number does not match banking statement records';
    const rejectRes = await paymentService.rejectManualPayment(
      submitRes.paymentId,
      { id: 'admin_test_1', name: 'Super Admin', role: 'ADMIN' },
      rejectionReason
    );

    expect(rejectRes.status).toBe('REJECTED');
    expect(stubProvider.paymentRejectedEmails.length).toBe(1);
    const rejectedEmail = stubProvider.paymentRejectedEmails[0];
    expect(rejectedEmail.email).toBe(testUserEmail);
    expect(rejectedEmail.reason).toBe(rejectionReason);
    expect(rejectedEmail.supportEmail).toBe(SUPPORT_EMAIL);
  });

  it('5. When the email provider THROWS, submitManualUpiPayment still succeeds and still returns status PENDING_VERIFICATION', async () => {
    stubProvider.shouldThrow = true;
    const utr = `UTRTHROW${Date.now()}`;

    // submitManualUpiPayment must succeed even if email throws
    const submitRes = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr,
    });

    expect(submitRes).toBeDefined();
    expect(submitRes.status).toBe('PENDING_VERIFICATION');

    // approveManualPayment must also succeed when email throws
    const approveRes = await paymentService.approveManualPayment(submitRes.paymentId, {
      id: 'admin_test_1',
      name: 'Super Admin',
      role: 'ADMIN',
    });
    expect(approveRes.status).toBe('SUCCEEDED');

    // rejectManualPayment must also succeed when email throws
    const utr3 = `UTRREJTHROW${Date.now()}`;
    const submitRes3 = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr: utr3,
    });
    const rejectRes = await paymentService.rejectManualPayment(
      submitRes3.paymentId,
      { id: 'admin_test_1', name: 'Super Admin', role: 'ADMIN' },
      'Testing rejection under email failure'
    );
    expect(rejectRes.status).toBe('REJECTED');
  });

  it('6. When NODE_ENV=production and no SMTP/API key is configured, createProductionEmailProvider throws PRODUCTION_EMAIL_UNCONFIGURED, and the payment paths still succeed', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;

    // Factory throws intentionally in unconfigured production
    expect(() => createProductionEmailProvider()).toThrow(/PRODUCTION_EMAIL_UNCONFIGURED/);

    // When a broken/throwing provider is active, payments still succeed
    class ThrowingEmailProvider extends DevelopmentEmailProvider {
      async sendBillingAlert(): Promise<boolean> {
        throw new Error('PRODUCTION_EMAIL_UNCONFIGURED: Real delivery requires SMTP or API credentials.');
      }
      async sendPaymentApprovedEmail(): Promise<boolean> {
        throw new Error('PRODUCTION_EMAIL_UNCONFIGURED: Real delivery requires SMTP or API credentials.');
      }
      async sendPaymentRejectedEmail(): Promise<boolean> {
        throw new Error('PRODUCTION_EMAIL_UNCONFIGURED: Real delivery requires SMTP or API credentials.');
      }
    }

    setEmailProvider(new ThrowingEmailProvider());

    const utr = `UTRPROD${Date.now()}`;
    const submitRes = await paymentService.submitManualUpiPayment({
      userId: testUserId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      utr,
    });

    expect(submitRes.status).toBe('PENDING_VERIFICATION');

    const approveRes = await paymentService.approveManualPayment(submitRes.paymentId, {
      id: 'admin_prod_1',
      name: 'Prod Admin',
      role: 'ADMIN',
    });
    expect(approveRes.status).toBe('SUCCEEDED');
  });
});
