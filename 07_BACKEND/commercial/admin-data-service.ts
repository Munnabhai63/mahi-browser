/**
 * MAHI Platform — Central Admin Data Service
 * Provides dual-engine (PostgreSQL via Prisma, with seamless SQLite fallback)
 * query abstraction for Web Admin, Super Admin, and Platform telemetry.
 */

import { getPrismaClient, isPostgresConfigured } from '../../06_DATABASE/prisma-client.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { getAllUsers } from './commercial-auth-service.js';
import { getLicenses, evaluateServerStatus } from '../../04_LICENSING/license-engine.js';
import type { LicenseStatus } from '../../10_CONFIG/shared/types/license.js';
import { getAllCommercialDevices } from './commercial-device-service.js';
import { getCommercialPlans, DEFAULT_COMMERCIAL_PLANS } from './commercial-plan-service.js';
import { getCommercialAuditLogs } from './commercial-audit-service.js';
import { getSoftwareVersions } from './commercial-version-service.js';
import { paymentService } from './payment-service.js';
import { getFunnelMetrics } from './funnel-service.js';
import { getSupportTickets, getSupportTicketMetrics } from './support-ticket-service.js';
import { getDemoRequests } from './demo-service.js';
import type { DemoRequestStatus } from './demo-service.js';

export interface DashboardSummaryResponse {
  totalUsers: number;
  centralUsers: number;
  missingMirrorUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  activeLicenses: number;
  expiredLicenses: number;
  activeDevices: number;
  authorizedDevices: number;
  activeSubscriptions: number;
  totalPlans: number;
  activePlans: number;
  revenueEstMonthly: number;
  recentAuditLogs: any[];
  recentSignups: {
    id: string;
    email: string;
    name: string;
    planId: string;
    status: string;
    createdAt: string;
    mirrorMissing?: boolean;
  }[];
  openTickets: number;
  escalatedTickets: number;
  source: 'postgres' | 'sqlite';
}

export interface UserListFilter {
  status?: string;
  role?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface UserListResponse {
  users: any[];
  total: number;
  source: 'postgres' | 'sqlite';
}

export interface UserDetailResponse {
  user: any;
  plan: any;
  subscription: any;
  license: any;
  devices: any[];
  payments: any[];
  sessions: number;
  missingMirror?: boolean;
}

const warnedMissingPlans = new Set<string>();

/**
 * 1. Admin Dashboard Summary & KPI Telemetry
 */
export async function adminGetDashboardSummary(): Promise<DashboardSummaryResponse> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const [
        commUsers,
        authUsers,
        allLicenses,
        activeDevicesCount,
        allPlans,
        activeSubs,
        recentLogs,
        openTicketsCount,
        escalatedTicketsCount,
      ] = await Promise.all([
        prisma.commercial_users.findMany(),
        prisma.auth_users.findMany(),
        prisma.licenses.findMany(),
        prisma.commercial_devices.count({ where: { status: 'ACTIVE' } }),
        prisma.commercial_plans.findMany(),
        prisma.commercial_subscriptions.findMany({ where: { status: 'ACTIVE' } }),
        prisma.commercial_audit_logs.findMany({
          orderBy: { created_at: 'desc' },
          take: 10,
        }),
        prisma.support_tickets.count({ where: { status: 'OPEN' } }),
        prisma.support_tickets.count({ where: { is_escalated: 1 } }),
      ]);

      const commEmails = new Set(commUsers.map((u) => u.email.toLowerCase().trim()));
      const missingMirrorList: {
        id: string;
        email: string;
        name: string;
        planId: string;
        status: string;
        createdAt: string;
        mirrorMissing: boolean;
      }[] = [];

      for (const au of authUsers) {
        if (!commEmails.has(au.email.toLowerCase().trim())) {
          missingMirrorList.push({
            id: `central:${au.id}`,
            email: au.email,
            name: au.name,
            planId: 'plan_free',
            status: au.status || 'ACTIVE',
            createdAt: au.created_at,
            mirrorMissing: true,
          });
        }
      }

      const centralUsers = authUsers.length;
      const missingMirrorUsers = missingMirrorList.length;
      const totalUsers = commUsers.length + missingMirrorUsers;

      const activeUsers =
        commUsers.filter((u) => u.status === 'ACTIVE').length +
        missingMirrorList.filter((u) => u.status === 'ACTIVE').length;
      const suspendedUsers =
        commUsers.filter((u) => u.status === 'SUSPENDED').length +
        missingMirrorList.filter((u) => u.status === 'SUSPENDED').length;
      const bannedUsers =
        commUsers.filter((u) => u.status === 'BANNED').length +
        missingMirrorList.filter((u) => u.status === 'BANNED').length;

      let activeLicenses = 0;
      let expiredLicenses = 0;
      for (const l of allLicenses) {
        const evaluated = evaluateServerStatus(l.status as LicenseStatus, l.expires_at, l.revoked_at);
        if (evaluated === 'ACTIVE') activeLicenses++;
        else if (evaluated === 'EXPIRED') expiredLicenses++;
      }

      const recentAuditLogs = recentLogs.map((l) => ({
        id: l.id,
        actorId: l.actor_id,
        actorName: l.actor_name,
        actorRole: l.actor_role,
        action: l.action,
        targetType: l.target_type,
        targetId: l.target_id,
        details: l.details || '',
        ipAddress: l.ip_address,
        result: l.result,
        createdAt: l.created_at,
      }));

      const allSignups = [
        ...commUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          planId: u.plan_id,
          status: u.status,
          createdAt: u.created_at,
          mirrorMissing: false,
        })),
        ...missingMirrorList,
      ];
      allSignups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const recentSignups = allSignups.slice(0, 10);

      const planMap = new Map(allPlans.map((p) => [p.id, p]));
      const rawRevenue = activeSubs.reduce((acc, sub) => {
        const plan = planMap.get(sub.plan_id);
        if (!plan) {
          const planId = sub.plan_id || 'unknown';
          if (!warnedMissingPlans.has(planId)) {
            warnedMissingPlans.add(planId);
            console.warn(`[AdminDataService] Active subscription references missing plan: ${planId}`);
          }
          return acc;
        }
        const price = typeof plan.price_monthly === 'number' ? plan.price_monthly : Number(plan.price_monthly) || 0;
        return price > 0 ? acc + price : acc;
      }, 0);
      const revenueEstMonthly = Math.round(rawRevenue * 100) / 100;

      return {
        totalUsers,
        centralUsers,
        missingMirrorUsers,
        activeUsers,
        suspendedUsers,
        bannedUsers,
        activeLicenses,
        expiredLicenses,
        activeDevices: activeDevicesCount,
        authorizedDevices: activeDevicesCount,
        activeSubscriptions: activeSubs.length,
        totalPlans: allPlans.length,
        activePlans: allPlans.filter((p) => p.is_active === 1).length,
        revenueEstMonthly,
        recentAuditLogs,
        recentSignups,
        openTickets: openTicketsCount,
        escalatedTickets: escalatedTicketsCount,
        source: 'postgres',
      };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminGetDashboardSummary failed, falling back to SQLite:', err?.message || err);
    }
  }

  // SQLite Fallback
  return sqliteGetDashboardSummary();
}

function sqliteGetDashboardSummary(): DashboardSummaryResponse {
  const db = getDatabase();
  const { users } = getAllUsers({ limit: 1000 });
  const commEmails = new Set(users.map((u: any) => u.email.toLowerCase().trim()));

  let authUsers: any[] = [];
  try {
    authUsers = db.prepare('SELECT id, email, name, status, created_at FROM auth_users').all() as any[];
  } catch {
    authUsers = [];
  }

  const missingMirrorList: any[] = [];
  for (const au of authUsers) {
    if (!commEmails.has(au.email.toLowerCase().trim())) {
      missingMirrorList.push({
        id: `central:${au.id}`,
        email: au.email,
        name: au.name,
        planId: 'plan_free',
        status: au.status || 'ACTIVE',
        createdAt: au.created_at,
        mirrorMissing: true,
      });
    }
  }

  const centralUsers = authUsers.length;
  const missingMirrorUsers = missingMirrorList.length;
  const totalUsers = users.length + missingMirrorUsers;

  const activeUsers =
    users.filter((u: any) => u.status === 'ACTIVE').length +
    missingMirrorList.filter((u: any) => u.status === 'ACTIVE').length;
  const suspendedUsers =
    users.filter((u: any) => u.status === 'SUSPENDED').length +
    missingMirrorList.filter((u: any) => u.status === 'SUSPENDED').length;
  const bannedUsers =
    users.filter((u: any) => u.status === 'BANNED').length +
    missingMirrorList.filter((u: any) => u.status === 'BANNED').length;

  const licenses = getLicenses();
  const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
  const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;

  const devices = getAllCommercialDevices();
  const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

  let activeSubs: any[] = [];
  try {
    activeSubs = db.prepare("SELECT * FROM commercial_subscriptions WHERE status = 'ACTIVE'").all() as any[];
  } catch {
    activeSubs = [];
  }

  let allPlans: any[] = [];
  try {
    allPlans = db.prepare('SELECT * FROM commercial_plans').all() as any[];
  } catch {
    allPlans = [];
  }

  const { logs: recentAuditLogs } = getCommercialAuditLogs({ limit: 10 });
  const ticketMetrics = getSupportTicketMetrics();

  const allSignups = [
    ...users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      planId: u.planId,
      status: u.status,
      createdAt: u.createdAt,
      mirrorMissing: false,
    })),
    ...missingMirrorList,
  ];
  allSignups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentSignups = allSignups.slice(0, 10);

  const planMap = new Map(allPlans.map((p: any) => [p.id, p]));
  const rawRevenue = activeSubs.reduce((acc: number, sub: any) => {
    const plan = planMap.get(sub.plan_id);
    if (!plan) {
      const planId = sub.plan_id || 'unknown';
      if (!warnedMissingPlans.has(planId)) {
        warnedMissingPlans.add(planId);
        console.warn(`[AdminDataService] Active subscription references missing plan: ${planId}`);
      }
      return acc;
    }
    const price = typeof plan.price_monthly === 'number' ? plan.price_monthly : Number(plan.price_monthly) || 0;
    return price > 0 ? acc + price : acc;
  }, 0);
  const revenueEstMonthly = Math.round(rawRevenue * 100) / 100;

  return {
    totalUsers,
    centralUsers,
    missingMirrorUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    activeLicenses,
    expiredLicenses,
    activeDevices,
    authorizedDevices: activeDevices,
    activeSubscriptions: activeSubs.length,
    totalPlans: allPlans.length,
    activePlans: allPlans.filter((p: any) => p.is_active === 1 || p.is_active === true).length,
    revenueEstMonthly,
    recentAuditLogs,
    recentSignups,
    openTickets: ticketMetrics.open,
    escalatedTickets: ticketMetrics.escalated,
    source: 'sqlite',
  };
}

/**
 * 2. Admin Users List with Central Auth Mirror Missing Merge
 */
export async function adminListUsers(filter?: UserListFilter): Promise<UserListResponse> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const [commUsers, authUsers] = await Promise.all([
        prisma.commercial_users.findMany({ orderBy: { created_at: 'desc' } }),
        prisma.auth_users.findMany({ orderBy: { created_at: 'desc' } }),
      ]);

      const existingEmails = new Set<string>();
      const authMap = new Map<string, typeof authUsers[0]>();
      for (const au of authUsers) {
        authMap.set(au.email.toLowerCase().trim(), au);
      }

      const commRows = commUsers.map((u) => {
        existingEmails.add(u.email.toLowerCase().trim());
        let featureOverrides: Record<string, boolean> = {};
        if (u.feature_overrides) {
          try {
            featureOverrides = typeof u.feature_overrides === 'string'
              ? JSON.parse(u.feature_overrides)
              : (u.feature_overrides || {});
          } catch {}
        }

        const authMatch = authMap.get(u.email.toLowerCase().trim()) as any;
        const acceptedTerms =
          authMatch?.accepted_terms !== null && authMatch?.accepted_terms !== undefined
            ? authMatch.accepted_terms === 1
            : true;
        const termsVersion = authMatch?.terms_version || undefined;

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          planId: u.plan_id,
          bonusProfiles: u.bonus_profiles || 0,
          bonusProxyBytes: Number(u.bonus_proxy_bytes || 0),
          featureOverrides,
          trialStartedAt: u.trial_started_at,
          trialExpiresAt: u.trial_expires_at,
          trialUsed: u.trial_used,
          signupIntent: u.signup_intent,
          pendingPlanId: u.pending_plan_id,
          pendingBillingCycle: u.pending_billing_cycle,
          googleSub: u.google_sub,
          avatarUrl: u.avatar_url,
          authProvider: u.auth_provider,
          acceptedTerms,
          termsVersion,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          lastLoginAt: u.last_login_at || undefined,
          mirrorMissing: false,
        };
      });

      const mirrorMissingRows: any[] = [];
      for (const au of authUsers) {
        const lower = au.email.toLowerCase().trim();
        if (!existingEmails.has(lower)) {
          mirrorMissingRows.push({
            id: `central:${au.id}`,
            email: au.email,
            name: au.name,
            role: au.role || 'USER',
            status: au.status || 'ACTIVE',
            planId: 'plan_free',
            bonusProfiles: 0,
            bonusProxyBytes: 0,
            featureOverrides: {},
            trialStartedAt: null,
            trialExpiresAt: null,
            trialUsed: 0,
            signupIntent: au.signup_intent || null,
            pendingPlanId: null,
            pendingBillingCycle: null,
            googleSub: au.google_sub || null,
            avatarUrl: au.avatar_url || null,
            authProvider: au.auth_provider || 'LOCAL',
            acceptedTerms: (au as any).accepted_terms === 1,
            termsVersion: (au as any).terms_version || undefined,
            createdAt: au.created_at,
            updatedAt: au.updated_at,
            lastLoginAt: au.last_login_at || undefined,
            mirrorMissing: true,
          });
        }
      }

      let allRows = [...commRows, ...mirrorMissingRows];

      if (filter?.status) {
        allRows = allRows.filter((u) => u.status === filter.status);
      }
      if (filter?.role) {
        allRows = allRows.filter((u) => u.role === filter.role);
      }
      if (filter?.searchQuery) {
        const term = filter.searchQuery.toLowerCase();
        allRows = allRows.filter(
          (u) => u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)
        );
      }

      allRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = allRows.length;
      const limit = Math.min(100, Math.max(1, filter?.limit || 50));
      const offset = Math.max(0, filter?.offset || 0);
      const paginated = allRows.slice(offset, offset + limit);

      return {
        users: paginated,
        total,
        source: 'postgres',
      };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListUsers failed, falling back to SQLite:', err?.message || err);
    }
  }

  // SQLite Fallback
  return sqliteListUsers(filter);
}

function sqliteListUsers(filter?: UserListFilter): UserListResponse {
  const db = getDatabase();
  const { users } = getAllUsers({
    status: filter?.status,
    role: filter?.role,
    searchQuery: filter?.searchQuery,
    limit: 1000,
    offset: 0,
  });

  const commEmails = new Set(users.map((u: any) => u.email.toLowerCase().trim()));
  let authUsers: any[] = [];
  try {
    authUsers = db.prepare('SELECT * FROM auth_users').all() as any[];
  } catch {
    authUsers = [];
  }

  const missingMirrorRows: any[] = [];
  for (const au of authUsers) {
    const lower = au.email.toLowerCase().trim();
    if (!commEmails.has(lower)) {
      missingMirrorRows.push({
        id: `central:${au.id}`,
        email: au.email,
        name: au.name,
        role: au.role || 'USER',
        status: au.status || 'ACTIVE',
        planId: 'plan_free',
        bonusProfiles: 0,
        bonusProxyBytes: 0,
        featureOverrides: {},
        trialStartedAt: null,
        trialExpiresAt: null,
        trialUsed: 0,
        signupIntent: au.signup_intent || null,
        pendingPlanId: null,
        pendingBillingCycle: null,
        googleSub: au.google_sub || null,
        avatarUrl: au.avatar_url || null,
        authProvider: au.auth_provider || 'LOCAL',
        acceptedTerms: au.accepted_terms === 1,
        termsVersion: au.terms_version || undefined,
        createdAt: au.created_at,
        updatedAt: au.updated_at,
        lastLoginAt: au.last_login_at || undefined,
        mirrorMissing: true,
      });
    }
  }

  let allRows = [
    ...users.map((row: any) => ({
      ...row,
      acceptedTerms: row.acceptedTerms ?? (row.accepted_terms !== undefined ? row.accepted_terms === 1 : null),
      termsVersion: row.termsVersion ?? (row.terms_version !== undefined ? row.terms_version : null),
      mirrorMissing: false,
    })),
    ...missingMirrorRows,
  ];

  if (filter?.status) {
    allRows = allRows.filter((u) => u.status === filter.status);
  }
  if (filter?.role) {
    allRows = allRows.filter((u) => u.role === filter.role);
  }
  if (filter?.searchQuery) {
    const term = filter.searchQuery.toLowerCase();
    allRows = allRows.filter(
      (u) => u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)
    );
  }

  allRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = allRows.length;
  const limit = Math.min(100, Math.max(1, filter?.limit || 50));
  const offset = Math.max(0, filter?.offset || 0);
  const paginated = allRows.slice(offset, offset + limit);

  return {
    users: paginated,
    total,
    source: 'sqlite',
  };
}

/**
 * 3. User Details Deep Lookup (Commercial or Central User)
 */
export async function adminGetUserDetail(id: string): Promise<UserDetailResponse | null> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      if (id.startsWith('central:')) {
        const centralId = id.slice(8);
        const authUser = await prisma.auth_users.findUnique({ where: { id: centralId } });
        if (!authUser) return null;

        const sessionsCount = await prisma.auth_sessions.count({ where: { user_id: centralId } });

        return {
          user: {
            id,
            email: authUser.email,
            name: authUser.name,
            role: authUser.role || 'USER',
            status: authUser.status || 'ACTIVE',
            planId: 'plan_free',
            bonusProfiles: 0,
            bonusProxyBytes: 0,
            featureOverrides: {},
            acceptedTerms: (authUser as any).accepted_terms === 1,
            termsVersion: (authUser as any).terms_version,
            createdAt: authUser.created_at,
            updatedAt: authUser.updated_at,
            lastLoginAt: authUser.last_login_at,
          },
          plan: { id: 'plan_free', name: 'Free Tier', tier: 'FREE' },
          subscription: null,
          license: null,
          devices: [],
          payments: [],
          sessions: sessionsCount,
          missingMirror: true,
        };
      }

      const commUser = await prisma.commercial_users.findUnique({ where: { id } });
      if (!commUser) return null;

      const [plan, sub, devices, payments, sessionsCount] = await Promise.all([
        prisma.commercial_plans.findUnique({ where: { id: commUser.plan_id } }),
        prisma.commercial_subscriptions.findFirst({
          where: { user_id: id },
          orderBy: { created_at: 'desc' },
        }),
        prisma.commercial_devices.findMany({ where: { user_id: id } }),
        prisma.commercial_payments.findMany({
          where: { user_id: id },
          orderBy: { created_at: 'desc' },
        }),
        prisma.auth_sessions.count({ where: { user_id: id } }),
      ]);

      let license = null;
      if (sub?.license_id) {
        license = await prisma.licenses.findUnique({ where: { id: sub.license_id } });
      }

      return {
        user: commUser,
        plan: plan || { id: commUser.plan_id, name: 'Default Plan', tier: 'FREE' },
        subscription: sub,
        license,
        devices,
        payments,
        sessions: sessionsCount,
        missingMirror: false,
      };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminGetUserDetail failed, falling back to SQLite:', err?.message || err);
    }
  }

  // SQLite Fallback
  return sqliteGetUserDetail(id);
}

function sqliteGetUserDetail(id: string): UserDetailResponse | null {
  const db = getDatabase();

  if (id.startsWith('central:')) {
    const centralId = id.slice(8);
    let authUser: any = null;
    try {
      authUser = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(centralId);
    } catch {}
    if (!authUser) return null;

    let sessionsCount = 0;
    try {
      sessionsCount = (db.prepare('SELECT COUNT(*) as c FROM auth_sessions WHERE user_id = ?').get(centralId) as any)?.c || 0;
    } catch {}

    return {
      user: {
        id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role || 'USER',
        status: authUser.status || 'ACTIVE',
        planId: 'plan_free',
        bonusProfiles: 0,
        bonusProxyBytes: 0,
        featureOverrides: {},
        acceptedTerms: authUser.accepted_terms === 1,
        termsVersion: authUser.terms_version,
        createdAt: authUser.created_at,
        updatedAt: authUser.updated_at,
        lastLoginAt: authUser.last_login_at,
      },
      plan: { id: 'plan_free', name: 'Free Tier', tier: 'FREE' },
      subscription: null,
      license: null,
      devices: [],
      payments: [],
      sessions: sessionsCount,
      missingMirror: true,
    };
  }

  let commUser: any = null;
  try {
    commUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(id);
  } catch {}
  if (!commUser) return null;

  let plan: any = null;
  try {
    plan = db.prepare('SELECT * FROM commercial_plans WHERE id = ?').get(commUser.plan_id);
  } catch {}

  let sub: any = null;
  try {
    sub = db.prepare('SELECT * FROM commercial_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
  } catch {}

  let license: any = null;
  if (sub?.license_id) {
    try {
      license = db.prepare('SELECT * FROM licenses WHERE id = ?').get(sub.license_id);
    } catch {}
  }

  let devices: any[] = [];
  try {
    devices = db.prepare('SELECT * FROM commercial_devices WHERE user_id = ?').all(id) as any[];
  } catch {}

  let payments: any[] = [];
  try {
    payments = db.prepare('SELECT * FROM commercial_payments WHERE user_id = ? ORDER BY created_at DESC').all(id) as any[];
  } catch {}

  let sessionsCount = 0;
  try {
    sessionsCount = (db.prepare('SELECT COUNT(*) as c FROM auth_sessions WHERE user_id = ?').get(id) as any)?.c || 0;
  } catch {}

  return {
    user: commUser,
    plan: plan || { id: commUser.plan_id, name: 'Default Plan', tier: 'FREE' },
    subscription: sub,
    license,
    devices,
    payments,
    sessions: sessionsCount,
    missingMirror: false,
  };
}

/**
 * 4. Licenses List
 */
export async function adminListLicenses(filter?: { status?: string; searchQuery?: string }): Promise<{
  items: any[];
  total: number;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const allLicenses = await prisma.licenses.findMany({
        include: {
          devices: {
            where: { status: 'ACTIVE' },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      let items = allLicenses.map((l: any) => {
        const evaluatedStatus = evaluateServerStatus(l.status as LicenseStatus, l.expires_at, l.revoked_at);
        return {
          id: l.id,
          keyMasked: l.key_masked,
          customerName: l.customer_name,
          accountId: l.account_id || undefined,
          status: evaluatedStatus,
          durationType: l.duration_type,
          maxDevices: l.max_devices,
          activeDevicesCount: (l.devices || []).length,
          startsAt: l.starts_at,
          expiresAt: l.expires_at,
          createdAt: l.created_at,
          createdBy: l.created_by,
          revokedAt: l.revoked_at,
          notes: l.notes,
        };
      });

      if (filter?.status) {
        items = items.filter((l) => l.status === filter.status);
      }
      if (filter?.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        items = items.filter(
          (l) =>
            l.customerName.toLowerCase().includes(q) ||
            l.keyMasked.toLowerCase().includes(q) ||
            (l.notes && l.notes.toLowerCase().includes(q))
        );
      }

      return { items, total: items.length, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListLicenses failed, falling back to SQLite:', err?.message || err);
    }
  }

  const licenses = getLicenses(filter);
  return { items: licenses, total: licenses.length, source: 'sqlite' };
}

/**
 * 5. Devices Fleet List
 */
export async function adminListDevices(filter?: { status?: string; searchQuery?: string }): Promise<{
  items: any[];
  total: number;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const devices = await prisma.commercial_devices.findMany({
        orderBy: { last_seen_at: 'desc' },
      });

      let items = devices.map((d) => ({
        id: d.id,
        userId: d.user_id,
        licenseId: d.license_id || undefined,
        deviceId: d.device_id,
        deviceName: d.device_name,
        platform: d.platform || undefined,
        osInfo: d.os_info,
        clientVersion: d.client_version,
        ipAddress: d.ip_address || undefined,
        activatedAt: d.activated_at,
        lastSeenAt: d.last_seen_at,
        status: d.status,
      }));

      if (filter?.status) {
        items = items.filter((d) => d.status === filter.status);
      }
      if (filter?.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        items = items.filter(
          (d) =>
            d.deviceName.toLowerCase().includes(q) ||
            d.deviceId.toLowerCase().includes(q) ||
            d.userId.toLowerCase().includes(q)
        );
      }

      return { items, total: items.length, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListDevices failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = getAllCommercialDevices(filter);
  return { items, total: items.length, source: 'sqlite' };
}

/**
 * 6. Commercial Payments List
 */
export async function adminListPayments(filter?: { status?: string }): Promise<{
  items: any[];
  total: number;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const whereClause = filter?.status ? { status: filter.status } : {};
      const rows = await prisma.commercial_payments.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
      });

      const items = rows.map((r) => {
        let metadata: any = {};
        try {
          metadata = JSON.parse(r.metadata_json || '{}');
        } catch {}
        return {
          id: r.id,
          userId: r.user_id,
          planId: r.subscription_id || '',
          billingCycle: 'MONTHLY',
          amountCents: r.amount_cents,
          currency: r.currency,
          provider: r.provider,
          status: r.status,
          externalPaymentId: r.external_payment_id,
          externalOrderId: r.external_order_id,
          receiptUrl: r.receipt_url,
          metadata,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });

      return { items, total: items.length, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListPayments failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = paymentService.listAdminPayments(filter?.status);
  return { items, total: items.length, source: 'sqlite' };
}

/**
 * 7. System Audit Logs
 */
export async function adminListAuditLogs(filter?: {
  action?: string;
  actorRole?: string;
  result?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: any[]; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where: any = {};
      if (filter?.action) where.action = filter.action;
      if (filter?.actorRole) where.actor_role = filter.actorRole;
      if (filter?.result) where.result = filter.result;

      const limit = Math.min(100, Math.max(1, filter?.limit || 50));
      const offset = Math.max(0, filter?.offset || 0);

      const [total, rows] = await Promise.all([
        prisma.commercial_audit_logs.count({ where }),
        prisma.commercial_audit_logs.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
        }),
      ]);

      const items = rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorRole: r.actor_role,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details || '',
        ipAddress: r.ip_address,
        result: r.result,
        createdAt: r.created_at,
      }));

      return { items, total, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListAuditLogs failed, falling back to SQLite:', err?.message || err);
    }
  }

  const res = getCommercialAuditLogs(filter);
  return { items: res.logs, total: res.total, source: 'sqlite' };
}

/**
 * 8. Software Versions List
 */
export async function adminListVersions(): Promise<{ items: any[]; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const rows = await prisma.software_versions.findMany({
        orderBy: { released_at: 'desc' },
      });

      if (rows.length > 0) {
        const items = rows.map((r) => ({
          id: r.id,
          version: r.version,
          releaseNotes: r.release_notes,
          minSupportedVersion: r.min_supported_version,
          downloadUrlSetup: r.download_url_setup,
          downloadUrlPortable: r.download_url_portable,
          isMandatory: Boolean(r.is_mandatory),
          releasedAt: r.released_at,
        }));
        return { items, source: 'postgres' };
      }
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListVersions failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = getSoftwareVersions();
  return { items, source: 'sqlite' };
}

/**
 * 9. Conversion Funnel Metrics
 */
export async function adminFunnelMetrics(days?: number): Promise<any> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const events = await prisma.funnel_events.findMany();
      const countMap: Record<string, number> = {};
      for (const e of events) {
        countMap[e.event_name] = (countMap[e.event_name] || 0) + 1;
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
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminFunnelMetrics failed, falling back to SQLite:', err?.message || err);
    }
  }

  return getFunnelMetrics();
}

/**
 * 10. Support Tickets List
 */
export async function adminListSupportTickets(filter?: {
  status?: string;
  category?: string;
  escalatedOnly?: boolean;
}): Promise<{ items: any[]; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where: any = {};
      if (filter?.status) where.status = filter.status;
      if (filter?.category) where.category = filter.category;
      if (filter?.escalatedOnly) where.is_escalated = 1;

      const rows = await prisma.support_tickets.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 100,
      });

      const items = rows.map((r) => ({
        id: r.id,
        ticketNumber: r.ticket_number,
        category: r.category,
        userEmail: r.user_email || undefined,
        userName: r.user_name || undefined,
        message: r.message,
        reply: r.reply || undefined,
        source: r.source || 'landing_ai_chat',
        status: r.status || 'OPEN',
        isEscalated: Boolean(r.is_escalated),
        escalationReason: r.escalation_reason || undefined,
        emailSent: Boolean(r.email_sent),
        adminNotes: r.admin_notes || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return { items, total: items.length, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListSupportTickets failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = getSupportTickets(filter);
  return { items, total: items.length, source: 'sqlite' };
}

/**
 * 11. Demo Leads List
 */
export async function adminListDemoRequests(filter?: {
  status?: DemoRequestStatus;
}): Promise<{ items: any[]; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where = filter?.status ? { status: filter.status } : {};
      const rows = await prisma.demo_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      const items = rows.map((r) => ({
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

      return { items, total: items.length, source: 'postgres' };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListDemoRequests failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = getDemoRequests(filter?.status);
  return { items, total: items.length, source: 'sqlite' };
}

/**
 * 12. Legal Terms Compliance Overview
 */
export async function adminTermsCompliance(): Promise<any> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const rows = (await prisma.auth_users.findMany()) as any[];

      const totalUsers = rows.length;
      let accepted = 0;
      let missing = 0;
      const byVersion: Record<string, number> = {};

      for (const r of rows) {
        if (r.accepted_terms === 1) {
          accepted++;
          if (r.terms_version !== null && r.terms_version !== undefined && String(r.terms_version).trim() !== '') {
            const v = String(r.terms_version).trim();
            byVersion[v] = (byVersion[v] || 0) + 1;
          } else {
            byVersion['unversioned'] = (byVersion['unversioned'] || 0) + 1;
          }
        } else {
          missing++;
        }
      }

      return { totalUsers, accepted, missing, byVersion };
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminTermsCompliance failed, falling back to SQLite:', err?.message || err);
    }
  }

  // SQLite Fallback
  const db = getDatabase();
  let rows: any[] = [];
  try {
    rows = db.prepare('SELECT id, accepted_terms, terms_version FROM commercial_users').all() as any[];
  } catch {
    rows = [];
  }
  try {
    const authRows = db.prepare('SELECT id, accepted_terms, terms_version FROM auth_users').all() as any[];
    const existingIds = new Set(rows.map((r: any) => r.id));
    for (const ar of authRows) {
      if (!existingIds.has(ar.id)) {
        rows.push(ar);
      }
    }
  } catch {}

  const totalUsers = rows.length;
  let accepted = 0;
  let missing = 0;
  const byVersion: Record<string, number> = {};

  for (const r of rows) {
    if (r.accepted_terms === 1) {
      accepted++;
      if (r.terms_version !== null && r.terms_version !== undefined && String(r.terms_version).trim() !== '') {
        const v = String(r.terms_version).trim();
        byVersion[v] = (byVersion[v] || 0) + 1;
      } else {
        byVersion['unversioned'] = (byVersion['unversioned'] || 0) + 1;
      }
    } else {
      missing++;
    }
  }

  return { totalUsers, accepted, missing, byVersion };
}

/**
 * 13. Commercial Plans List (Forward Compatible)
 */
export async function adminListPlans(includeInactive = true): Promise<{
  items: any[];
  total: number;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const rows = await prisma.commercial_plans.findMany({
        orderBy: { price_monthly: 'asc' },
      });

      if (rows.length > 0) {
        let items = rows.map((p) => {
          let limits: any = {};
          try {
            limits = JSON.parse(p.limits_json || '{}');
          } catch {}
          return {
            id: p.id,
            name: p.name,
            tier: p.tier,
            priceMonthly: p.price_monthly,
            priceAnnual: p.price_annual,
            limits,
            isActive: p.is_active === 1,
            createdAt: p.created_at,
            updatedAt: p.updated_at || undefined,
          };
        });

        if (!includeInactive) {
          items = items.filter((p) => p.isActive);
        }

        return { items, total: items.length, source: 'postgres' };
      }
    } catch (err: any) {
      console.error('[AdminDataService] Postgres adminListPlans failed, falling back to SQLite:', err?.message || err);
    }
  }

  const items = getCommercialPlans(includeInactive);
  return { items, total: items.length, source: 'sqlite' };
}
