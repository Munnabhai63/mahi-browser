/**
 * MAHI Browser — Funnel Analytics Service
 * Privacy-safe conversion funnel event tracking and reporting.
 * Strictly NEVER stores passwords, payment credentials, or browsing history.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';

export type FunnelEventName =
  | 'trial_cta_clicked'
  | 'signup_started'
  | 'signup_completed'
  | 'email_verified'
  | 'trial_activated'
  | 'checkout_started'
  | 'payment_completed'
  | 'download_started'
  | 'desktop_first_login';

export interface FunnelEventDTO {
  eventName: FunnelEventName;
  userId?: string;
  anonymousId?: string;
  planId?: string;
  billingCycle?: string;
  sourceUrl?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface FunnelMetricsSummary {
  trialCtaClicks: number;
  landingCtaClicks: number;
  signupStarts: number;
  signupCompletions: number;
  emailVerifications: number;
  trialActivations: number;
  checkoutStarts: number;
  paymentCompletions: number;
  paidConversions: number;
  downloads: number;
  downloadsStarted: number;
  desktopLogins: number;
  conversionRateTrialToDownload: number;
  conversionRateSignupToTrial: number;
  signupRate: number;
  downloadRate: number;
  overallConversionRate: number;
}

export function recordFunnelEvent(dto: FunnelEventDTO): { success: boolean; eventId?: string; error?: string } {
  const db = getDatabase();
  const id = `fne_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO funnel_events (
        id, event_name, user_id, anonymous_id, plan_id,
        billing_cycle, source_url, ip_address, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.eventName,
      dto.userId || null,
      dto.anonymousId || null,
      dto.planId || null,
      dto.billingCycle || null,
      dto.sourceUrl || null,
      dto.ipAddress || null,
      JSON.stringify(dto.metadata || {}),
      now
    );

    return { success: true, eventId: id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getFunnelMetrics(): FunnelMetricsSummary {
  const db = getDatabase();

  try {
    const rows = db.prepare(`
      SELECT event_name, COUNT(*) as count
      FROM funnel_events
      GROUP BY event_name
    `).all() as { event_name: string; count: number }[];

    const countMap: Record<string, number> = {};
    for (const r of rows) {
      countMap[r.event_name] = Number(r.count);
    }

    const trialCtaClicks = countMap['trial_cta_clicked'] || 0;
    const signupStarts = countMap['signup_started'] || 0;
    const signupCompletions = countMap['signup_completed'] || 0;
    const emailVerifications = countMap['email_verified'] || 0;
    const trialActivations = countMap['trial_activated'] || 0;
    const checkoutStarts = countMap['checkout_started'] || 0;
    const paymentCompletions = countMap['payment_completed'] || 0;
    const downloads = countMap['download_started'] || 0;
    const desktopLogins = countMap['desktop_first_login'] || 0;

    const conversionRateSignupToTrial = signupCompletions > 0
      ? Math.round((trialActivations / signupCompletions) * 100)
      : 0;

    const conversionRateTrialToDownload = trialActivations > 0
      ? Math.round((downloads / trialActivations) * 100)
      : 0;

    return {
      trialCtaClicks,
      landingCtaClicks: trialCtaClicks,
      signupStarts,
      signupCompletions,
      emailVerifications,
      trialActivations,
      checkoutStarts,
      paymentCompletions,
      paidConversions: paymentCompletions,
      downloads,
      downloadsStarted: downloads,
      desktopLogins,
      conversionRateTrialToDownload,
      conversionRateSignupToTrial,
      signupRate: conversionRateSignupToTrial,
      downloadRate: conversionRateTrialToDownload,
      overallConversionRate: conversionRateTrialToDownload,
    };
  } catch {
    return {
      trialCtaClicks: 0,
      landingCtaClicks: 0,
      signupStarts: 0,
      signupCompletions: 0,
      emailVerifications: 0,
      trialActivations: 0,
      checkoutStarts: 0,
      paymentCompletions: 0,
      paidConversions: 0,
      downloads: 0,
      downloadsStarted: 0,
      desktopLogins: 0,
      conversionRateTrialToDownload: 0,
      conversionRateSignupToTrial: 0,
      signupRate: 0,
      downloadRate: 0,
      overallConversionRate: 0,
    };
  }
}
