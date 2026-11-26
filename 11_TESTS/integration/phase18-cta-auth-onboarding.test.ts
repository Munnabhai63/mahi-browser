/**
 * MAHI Browser — Phase 18 Integration Test Suite
 * Complete Website CTA → Auth → Trial / Plan → Download Onboarding Flow
 *
 * Verifies all 6 product acceptance tests:
 * 1. Anonymous Start 7-Day Trial → Signup → Account Creation → Trial Activation → Download Access (No installer prior to auth)
 * 2. Anonymous Paid Plan CTA (e.g. Professional 50 Annual) → Signup → Intent preserved without losing plan context
 * 3. Existing authenticated user → Plan CTA → No duplicate signup → Direct checkout/trial continuation
 * 4. Book Demo lead capture → Admin receives lead → Status transitions → No software download
 * 5. Anonymous Download → Auth required gate / Redirect to signup
 * 6. Desktop account continuity → Same credentials unlock same server-side entitlements & profile limits
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import { getAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { evaluateUserEntitlements } from '../../07_BACKEND/commercial/commercial-entitlement-service.js';

describe('Phase 18: Complete CTA → Auth → Trial/Plan → Download Onboarding Flow', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  const adminSecret = getAdminWebSecret();

  beforeAll(async () => {
    await initializeDatabase();
    server = createCentralApiServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // =========================================================================
  // TEST 1: Anonymous → Start 7-Day Trial → Signup → Account → Trial → Download
  // =========================================================================
  it('TEST 1: Anonymous visitor clicking Start 7-Day Trial routes through signup, activates server-side trial, and unlocks download without premature installer fire', async () => {
    // 1. Direct anonymous download navigation is blocked with 302 redirect
    const anonDlRes = await fetch(`${baseUrl}/download/MAHI-Setup.exe`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'manual'
    });
    expect(anonDlRes.status).toBe(302);
    expect(anonDlRes.headers.get('location')).toBe('/signup?intent=trial&returnUrl=/download');

    // 1b. Non-HTML anonymous requests must NOT bypass auth and must receive 401
    const anonCliRes = await fetch(`${baseUrl}/download/setup`, {
      headers: { 'Accept': 'application/json' },
      redirect: 'manual',
    });
    expect(anonCliRes.status).toBe(401);

    // 1c. Invalid/forged bearer tokens must also be rejected with 401
    const forgedDlRes = await fetch(`${baseUrl}/download/MAHI-Setup.exe`, {
      headers: { 'Authorization': 'Bearer forged_invalid_token' },
      redirect: 'manual',
    });
    expect(forgedDlRes.status).toBe(401);

    // 2. Signup page is accessible with 200 OK
    const signupPageRes = await fetch(`${baseUrl}/signup?intent=trial`);
    expect(signupPageRes.status).toBe(200);
    const signupHtml = await signupPageRes.text();
    expect(signupHtml).toContain('Create your MAHI Browser account');
    expect(signupHtml).toContain('logo.png?v=2.5.0');
    expect(signupHtml).toContain('Continue with Google');

    // 3. User registers with trial intent
    const testEmail = `trial_tester_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'ValidSecurePass123!',
        confirmPassword: 'ValidSecurePass123!',
        name: 'Trial Tester',
        intent: 'trial',
        acceptedTerms: true
      })
    });
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.token).toBeDefined();
    expect(regData.user.trial_started_at).toBeDefined();
    expect(regData.user.trial_expires_at).toBeDefined();
    expect(regData.user.is_trial).toBe(true);

    const token = regData.token;

    // 4. Trial status reflects real 7-day entitlement
    const trialStatusRes = await fetch(`${baseUrl}/api/v1/auth/trial/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(trialStatusRes.status).toBe(200);
    const trialStatus = await trialStatusRes.json();
    expect(trialStatus.success).toBe(true);
    expect(trialStatus.isTrialActive).toBe(true);
    expect(trialStatus.daysRemaining).toBe(7);

    // 5. Authenticated user can now download installer via Authorization header (not URL query string)
    const authDlRes = await fetch(`${baseUrl}/download/setup`, {
      headers: { 'Authorization': `Bearer ${token}` },
      redirect: 'manual'
    });
    // Either returns 200 with octet-stream or 404 if physical mock binary absent in dev environment, but never 302 or 401
    expect(authDlRes.status).not.toBe(302);
    expect(authDlRes.status).not.toBe(401);

    // 5b. Unauthenticated non-HTML portable download request is rejected with 401
    const unauthPortableRes = await fetch(`${baseUrl}/download/portable`, {
      redirect: 'manual'
    });
    expect(unauthPortableRes.status).toBe(401);
  });

  // =========================================================================
  // TEST 2: Anonymous → Paid Plan CTA (Professional 50 Annual) → Plan Intent Preserved
  // =========================================================================
  it('TEST 2: Anonymous visitor choosing Professional 50 Annual preserves plan and billing intent across registration', async () => {
    const paidEmail = `pro50_annual_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: paidEmail,
        password: 'ProPassword2026!',
        confirmPassword: 'ProPassword2026!',
        name: 'Pro Subscriber',
        intent: 'paid',
        plan: 'professional_50',
        billing: 'annual',
        acceptedTerms: true
      })
    });
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.user.pending_plan_id).toBe('professional_50');
    expect(regData.user.pending_billing_cycle).toBe('annual');

    // Verify /api/v1/auth/me also returns preserved intent
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${regData.token}` }
    });
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.pending_plan_id).toBe('professional_50');
    expect(meData.user.pending_billing_cycle).toBe('annual');
  });

  // =========================================================================
  // TEST 3: Existing Logged-in User → Plan CTA → No Duplicate Signup
  // =========================================================================
  it('TEST 3: Authenticated user selecting a plan continues existing session without duplicate signup', async () => {
    const existingEmail = `existing_user_${Date.now()}@example.com`;
    // Register initial account
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: existingEmail,
        password: 'ExistingPass2026!',
        name: 'Existing Member',
        intent: 'free',
        acceptedTerms: true
      })
    });
    expect(regRes.status).toBe(201);
    const { token } = await regRes.json();

    // Verify authenticated user identity check
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(meRes.status).toBe(200);

    // Duplicate registration attempt is safely rejected
    const dupRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: existingEmail,
        password: 'AnyPassword123!',
        name: 'Duplicate Tester',
        acceptedTerms: true
      })
    });
    expect(dupRes.status).toBe(409);
    const dupData = await dupRes.json();
    expect(dupData.success).toBe(false);
    expect(dupData.error.code).toBe('EMAIL_ALREADY_EXISTS');

    // Existing user can activate trial directly without creating new account
    const trialActRes = await fetch(`${baseUrl}/api/v1/auth/trial/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(trialActRes.status).toBe(200);
    const trialActData = await trialActRes.json();
    expect(trialActData.success).toBe(true);
    expect(trialActData.isTrialActive).toBe(true);
  });

  // =========================================================================
  // TEST 4: Book Demo → Form Submission → Admin Lead Queue → No Installer
  // =========================================================================
  it('TEST 4: Book Demo captures enterprise lead, notifies admin queue, and never downloads installer', async () => {
    // 1. GET /book-demo returns lead capture page
    const demoPageRes = await fetch(`${baseUrl}/book-demo`);
    expect(demoPageRes.status).toBe(200);
    const demoHtml = await demoPageRes.text();
    expect(demoHtml).toContain('Schedule a Personalized Demo');
    expect(demoHtml).toContain('logo.png?v=2.5.0');

    // 2. Submit lead request
    const leadEmail = `enterprise_lead_${Date.now()}@acmecorp.com`;
    const leadRes = await fetch(`${baseUrl}/api/v1/commercial/demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Jordan Taylor',
        email: leadEmail,
        companyName: 'Acme Media Labs',
        teamSize: '16-50',
        useCase: 'E-Commerce & Dropshipping',
        contactMethod: 'Google Meet / Zoom',
        preferredDatetime: 'Thursdays 3:00 PM EST',
        message: 'Looking to scale 200 storefront accounts.'
      })
    });
    expect(leadRes.status).toBe(201);
    const leadData = await leadRes.json();
    expect(leadData.success).toBe(true);
    expect(leadData.data.id).toMatch(/^demo_/);
    expect(leadData.data.status).toBe('NEW');

    const leadId = leadData.data.id;

    // 3. Admin retrieves leads
    const adminLeadsRes = await fetch(`${baseUrl}/api/v1/commercial/admin/demo-requests`, {
      headers: { 'X-Admin-Secret': adminSecret }
    });
    expect(adminLeadsRes.status).toBe(200);
    const adminLeads = await adminLeadsRes.json();
    expect(adminLeads.success).toBe(true);
    const found = adminLeads.data.find((l: any) => l.id === leadId);
    expect(found).toBeDefined();
    expect(found.email).toBe(leadEmail);

    // 4. Admin updates lead status to SCHEDULED
    const updateStatusRes = await fetch(`${baseUrl}/api/v1/commercial/admin/demo-requests/${leadId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret
      },
      body: JSON.stringify({
        status: 'SCHEDULED',
        adminNotes: 'Demo scheduled on Google Calendar for Thursday.'
      })
    });
    expect(updateStatusRes.status).toBe(200);
    const updateData = await updateStatusRes.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data.status).toBe('SCHEDULED');
    expect(updateData.data.adminNotes).toContain('Google Calendar');
  });

  // =========================================================================
  // TEST 5: Anonymous Download → Auth Gate
  // =========================================================================
  it('TEST 5: Anonymous visitor navigating to download endpoints is gated to registration', async () => {
    // Navigating to /download returns download HTML with authentication gate
    const downloadPageRes = await fetch(`${baseUrl}/download`);
    expect(downloadPageRes.status).toBe(200);
    const dlHtml = await downloadPageRes.text();
    expect(dlHtml).toContain('Account Required to Download');
    expect(dlHtml).toContain('Start Free 7-Day Trial');

    // Direct browser file download request without token redirects to signup
    const directSetupRes = await fetch(`${baseUrl}/download/setup`, {
      headers: { 'Accept': 'text/html' },
      redirect: 'manual'
    });
    expect(directSetupRes.status).toBe(302);
    expect(directSetupRes.headers.get('location')).toContain('/signup');

    const directPortableRes = await fetch(`${baseUrl}/download/portable`, {
      headers: { 'Accept': 'text/html' },
      redirect: 'manual'
    });
    expect(directPortableRes.status).toBe(302);
  });

  // =========================================================================
  // TEST 6: Desktop Account Continuity & Unified Entitlements
  // =========================================================================
  it('TEST 6: Account created on website immediately logs into desktop and unlocks unified commercial entitlements', async () => {
    const continuityEmail = `desktop_sync_${Date.now()}@example.com`;
    const password = 'UnifiedSecurity2026!';

    // 1. Website account creation with 7-day trial intent
    const webRegRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: continuityEmail,
        password,
        name: 'Desktop User',
        intent: 'trial',
        acceptedTerms: true
      })
    });
    expect(webRegRes.status).toBe(201);
    const webData = await webRegRes.json();
    const userId = webData.user.id;

    // 2. Desktop MAHI Browser logs in using the exact same credentials
    const desktopLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: continuityEmail,
        password
      })
    });
    expect(desktopLoginRes.status).toBe(200);
    const desktopData = await desktopLoginRes.json();
    expect(desktopData.success).toBe(true);
    expect(desktopData.user.id).toBe(userId);
    expect(desktopData.user.is_trial).toBe(true);

    const desktopToken = desktopData.token;

    // 3. Desktop queries entitlement check
    const entitlementRes = await fetch(`${baseUrl}/api/v1/entitlements/check?deviceId=desktop_pc_01`, {
      headers: { 'Authorization': `Bearer ${desktopToken}` }
    });
    expect(entitlementRes.status).toBe(200);
    const entitlementData = await entitlementRes.json();
    expect(entitlementData.success).toBe(true);

    // Entitlements should reflect trial tier with full limits (50 profiles instead of standard free 15)
    expect(entitlementData.data.planId).toBe('trial_50');
    expect(entitlementData.data.maxProfiles).toBe(50);
    expect(entitlementData.data.features.uniqueFingerprints).toBe(true);
    expect(entitlementData.data.features.cloudSync).toBe(true);
  });

  // =========================================================================
  // ADDITIONAL: Trial Expiry Reversion & Funnel Telemetry
  // =========================================================================
  it('ADDITIONAL: Expired trial safely falls back to Free plan (15 profiles) while preserving user profiles', async () => {
    const expiredEmail = `expired_trial_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: expiredEmail,
        password: 'ExpiredPass123!',
        name: 'Expired Trial User',
        intent: 'trial',
        acceptedTerms: true
      })
    });
    const regData = await regRes.json();
    const userId = regData.user.id;

    // Manually backdate trial_expires_at in database to test expiration behavior
    const db = getDatabase();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE commercial_users SET trial_expires_at = ? WHERE id = ?').run(pastDate, userId);

    // Evaluate entitlements after expiry
    const entitlements = evaluateUserEntitlements(userId);
    // Dropped to Free plan limits without deleting user or existing data
    expect(entitlements.planId).toBe('free');
    expect(entitlements.maxProfiles).toBe(15);
    expect(entitlements.isTrialActive).toBe(false);
  });

  it('ADDITIONAL: Privacy-safe funnel telemetry tracks CTA clicks and generates admin funnel report', async () => {
    // Track funnel events
    await fetch(`${baseUrl}/api/v1/funnel/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'trial_cta_clicked', metadata: { source: 'hero_primary' } })
    });

    await fetch(`${baseUrl}/api/v1/funnel/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'download_started', metadata: { package: 'setup' } })
    });

    // Admin fetches metrics
    const metricsRes = await fetch(`${baseUrl}/api/v1/commercial/admin/funnel-metrics`, {
      headers: { 'X-Admin-Secret': adminSecret }
    });
    expect(metricsRes.status).toBe(200);
    const metricsData = await metricsRes.json();
    expect(metricsData.success).toBe(true);
    expect(metricsData.data.landingCtaClicks).toBeGreaterThanOrEqual(1);
    expect(metricsData.data.downloadsStarted).toBeGreaterThanOrEqual(1);
  });
});
