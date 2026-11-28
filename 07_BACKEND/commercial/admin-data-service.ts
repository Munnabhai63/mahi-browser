/**
 * MAHI Platform — Central Admin Data Service
 * Provides dual-engine (PostgreSQL via Prisma, with seamless SQLite fallback)
 * query abstraction for Web Admin, Super Admin, and Platform telemetry.
 */

import type { Prisma } from '@prisma/client';
import { getPrismaClient, isPostgresConfigured } from '../../06_DATABASE/prisma-client.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { getAllUsers } from './commercial-auth-service.js';
import { getLicenses, evaluateServerStatus } from '../../04_LICENSING/license-engine.js';
import type { LicenseRecord, LicenseStatus } from '../../10_CONFIG/shared/types/license.js';
import type {
  CommercialAuditLog,
  CommercialDevice,
  CommercialPlan,
  CommercialPlanLimits,
  CommercialUser,
  SoftwareVersionRecord,
} from '../../10_CONFIG/shared/types/commercial.js';
import { getAllCommercialDevices } from './commercial-device-service.js';
import { getCommercialPlans } from './commercial-plan-service.js';
import { getCommercialAuditLogs } from './commercial-audit-service.js';
import { getSoftwareVersions } from './commercial-version-service.js';
import { paymentService } from './payment-service.js';
import { getFunnelMetrics, type FunnelMetricsSummary } from './funnel-service.js';
import { getSupportTickets, getSupportTicketMetrics, type SupportTicket } from './support-ticket-service.js';
import { getDemoRequests, type DemoRequest, type DemoRequestStatus } from './demo-service.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('admin-data-service');

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface AdminAuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details: string;
  ipAddress?: string | null;
  result: string;
  createdAt: string;
}

export interface AdminRecentSignupItem {
  id: string;
  email: string;
  name: string;
  planId: string;
  status: string;
  createdAt: string;
  mirrorMissing?: boolean;
}

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
  recentAuditLogs: Array<AdminAuditLogItem | CommercialAuditLog>;
  recentSignups: AdminRecentSignupItem[];
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

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  planId: string;
  bonusProfiles?: number;
  bonusProxyBytes?: number;
  featureOverrides?: Record<string, boolean>;
  trialStartedAt?: string | null;
  trialExpiresAt?: string | null;
  trialUsed?: number | boolean | null;
  signupIntent?: string | null;
  pendingPlanId?: string | null;
  pendingBillingCycle?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  acceptedTerms?: boolean | null;
  termsVersion?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  mirrorMissing?: boolean;
}

export interface UserListResponse {
  users: AdminUserItem[];
  total: number;
  source: 'postgres' | 'sqlite';
}

export interface UserDetailResponse {
  user: AdminUserItem | Record<string, unknown>;
  plan: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  license: Record<string, unknown> | null;
  devices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  sessions: number;
  missingMirror?: boolean;
}

export interface AdminLicenseItem {
  id: string;
  keyMasked: string;
  customerName: string;
  accountId?: string;
  status: string;
  durationType: string;
  maxDevices: number;
  activeDevicesCount: number;
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  revokedAt?: string | null;
  notes?: string | null;
}

export interface AdminDeviceItem {
  id: string;
  userId: string;
  licenseId?: string;
  deviceId: string;
  deviceName: string;
  platform?: string;
  osInfo: string;
  clientVersion: string;
  ipAddress?: string;
  activatedAt: string;
  lastSeenAt: string;
  status: string;
}

export interface AdminPaymentItem {
  id: string;
  userId: string;
  planId: string;
  billingCycle: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: string;
  externalPaymentId?: string | null;
  externalOrderId?: string | null;
  receiptUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVersionItem {
  id: string;
  version: string;
  releaseNotes: string;
  minSupportedVersion: string;
  downloadUrlSetup?: string | null;
  downloadUrlPortable?: string | null;
  isMandatory: boolean;
  releasedAt: string;
}

export interface AdminSupportTicketItem {
  id: string;
  ticketNumber: string;
  category: string;
  userEmail?: string;
  userName?: string;
  message: string;
  reply?: string;
  source: string;
  status: string;
  isEscalated: boolean;
  escalationReason?: string;
  emailSent: boolean;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanItem {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceAnnual: number;
  limits: CommercialPlanLimits | Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminTermsComplianceResponse {
  totalUsers: number;
  accepted: number;
  missing: number;
  byVersion: Record<string, number>;
}

interface SqliteAuthUserBasicRow {
  id: string;
  email: string;
  name: string;
  status: string | null;
  created_at: string;
}

interface SqliteAuthUserFullRow extends SqliteAuthUserBasicRow {
  role: string | null;
  signup_intent: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  accepted_terms: number | null;
  terms_version: string | null;
  updated_at: string;
  last_login_at: string | null;
}

interface SqlitePlanRow {
  id: string;
  price_monthly: number | string | null;
  is_active: number | boolean;
}

interface SqliteSubRow {
  plan_id: string | null;
  license_id?: string | null;
}

interface SqliteCountRow {
  c?: number;
}

interface SqliteTermsRow {
  id: string;
  accepted_terms: number | null;
  terms_version: string | null;
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
      const missingMirrorList: AdminRecentSignupItem[] = [];

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

      const recentAuditLogs: AdminAuditLogItem[] = recentLogs.map((l) => ({
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

      const allSignups: AdminRecentSignupItem[] = [
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
            log.warn(`[AdminDataService] Active subscription references missing plan: ${planId}`);
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminGetDashboardSummary failed, falling back to SQLite:', errMsg(err));
    }
  }

  return sqliteGetDashboardSummary();
}

function sqliteGetDashboardSummary(): DashboardSummaryResponse {
  const db = getDatabase();
  const { users } = getAllUsers({ limit: 1000 });
  const commEmails = new Set(users.map((u: CommercialUser) => u.email.toLowerCase().trim()));

  let authUsers: SqliteAuthUserBasicRow[] = [];
  try {
    authUsers = db
      .prepare('SELECT id, email, name, status, created_at FROM auth_users')
      .all() as unknown as SqliteAuthUserBasicRow[];
  } catch {
    authUsers = [];
  }

  const missingMirrorList: AdminRecentSignupItem[] = [];
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
    users.filter((u: CommercialUser) => u.status === 'ACTIVE').length +
    missingMirrorList.filter((u) => u.status === 'ACTIVE').length;
  const suspendedUsers =
    users.filter((u: CommercialUser) => u.status === 'SUSPENDED').length +
    missingMirrorList.filter((u) => u.status === 'SUSPENDED').length;
  const bannedUsers =
    users.filter((u: CommercialUser) => u.status === 'BANNED').length +
    missingMirrorList.filter((u) => u.status === 'BANNED').length;

  const licenses = getLicenses();
  const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
  const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;

  const devices = getAllCommercialDevices();
  const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

  let activeSubs: SqliteSubRow[] = [];
  try {
    activeSubs = db
      .prepare("SELECT * FROM commercial_subscriptions WHERE status = 'ACTIVE'")
      .all() as unknown as SqliteSubRow[];
  } catch {
    activeSubs = [];
  }

  let allPlans: SqlitePlanRow[] = [];
  try {
    allPlans = db.prepare('SELECT * FROM commercial_plans').all() as unknown as SqlitePlanRow[];
  } catch {
    allPlans = [];
  }

  const { logs: recentAuditLogs } = getCommercialAuditLogs({ limit: 10 });
  const ticketMetrics = getSupportTicketMetrics();

  const allSignups: AdminRecentSignupItem[] = [
    ...users.map((u: CommercialUser) => ({
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

  const planMap = new Map(allPlans.map((p) => [p.id, p]));
  const rawRevenue = activeSubs.reduce((acc: number, sub: SqliteSubRow) => {
    const plan = sub.plan_id ? planMap.get(sub.plan_id) : undefined;
    if (!plan) {
      const planId = sub.plan_id || 'unknown';
      if (!warnedMissingPlans.has(planId)) {
        warnedMissingPlans.add(planId);
        log.warn(`[AdminDataService] Active subscription references missing plan: ${planId}`);
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
    activePlans: allPlans.filter((p) => p.is_active === 1 || p.is_active === true).length,
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
      const authMap = new Map<string, (typeof authUsers)[0]>();
      for (const au of authUsers) {
        authMap.set(au.email.toLowerCase().trim(), au);
      }

      const commRows: AdminUserItem[] = commUsers.map((u) => {
        existingEmails.add(u.email.toLowerCase().trim());
        let featureOverrides: Record<string, boolean> = {};
        if (u.feature_overrides) {
          try {
            featureOverrides =
              typeof u.feature_overrides === 'string'
                ? (JSON.parse(u.feature_overrides) as Record<string, boolean>)
                : ((u.feature_overrides as unknown as Record<string, boolean>) || {});
          } catch (parseErr) {
            log.warn('Failed parsing user feature_overrides JSON in admin list', {
              userId: u.id,
              err: errMsg(parseErr),
            });
          }
        }

        const authMatch = authMap.get(u.email.toLowerCase().trim());
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

      const mirrorMissingRows: AdminUserItem[] = [];
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
            acceptedTerms: au.accepted_terms === 1,
            termsVersion: au.terms_version || undefined,
            createdAt: au.created_at,
            updatedAt: au.updated_at,
            lastLoginAt: au.last_login_at || undefined,
            mirrorMissing: true,
          });
        }
      }

      let allRows: AdminUserItem[] = [...commRows, ...mirrorMissingRows];

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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListUsers failed, falling back to SQLite:', errMsg(err));
    }
  }

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

  const commEmails = new Set(users.map((u: CommercialUser) => u.email.toLowerCase().trim()));
  let authUsers: SqliteAuthUserFullRow[] = [];
  try {
    authUsers = db.prepare('SELECT * FROM auth_users').all() as unknown as SqliteAuthUserFullRow[];
  } catch {
    authUsers = [];
  }

  const missingMirrorRows: AdminUserItem[] = [];
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

  let allRows: AdminUserItem[] = [
    ...users.map((row: CommercialUser) => ({
      ...row,
      acceptedTerms: row.acceptedTerms ?? null,
      termsVersion: row.termsVersion ?? null,
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

      let license: Record<string, unknown> | null = null;
      if (sub?.license_id) {
        license = (await prisma.licenses.findUnique({ where: { id: sub.license_id } })) as unknown as Record<
          string,
          unknown
        > | null;
      }

      return {
        user: commUser as unknown as Record<string, unknown>,
        plan: (plan as unknown as Record<string, unknown>) || { id: commUser.plan_id, name: 'Default Plan', tier: 'FREE' },
        subscription: sub as unknown as Record<string, unknown> | null,
        license,
        devices: devices as unknown as Array<Record<string, unknown>>,
        payments: payments as unknown as Array<Record<string, unknown>>,
        sessions: sessionsCount,
        missingMirror: false,
      };
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminGetUserDetail failed, falling back to SQLite:', errMsg(err));
    }
  }

  return sqliteGetUserDetail(id);
}

function sqliteGetUserDetail(id: string): UserDetailResponse | null {
  const db = getDatabase();

  if (id.startsWith('central:')) {
    const centralId = id.slice(8);
    let authUser: SqliteAuthUserFullRow | undefined;
    try {
      authUser = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(centralId) as unknown as
        | SqliteAuthUserFullRow
        | undefined;
    } catch (err) {
      log.warn('Failed reading SQLite auth_users for central user detail', {
        centralId,
        err: errMsg(err),
      });
    }
    if (!authUser) return null;

    let sessionsCount = 0;
    try {
      const row = db.prepare('SELECT COUNT(*) as c FROM auth_sessions WHERE user_id = ?').get(centralId) as unknown as
        | SqliteCountRow
        | undefined;
      sessionsCount = row?.c || 0;
    } catch (err) {
      log.debug('Skipped SQLite auth_sessions count for central user detail', {
        centralId,
        err: errMsg(err),
      });
    }

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

  let commUser: (Record<string, unknown> & { plan_id?: string }) | undefined;
  try {
    commUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(id) as
      | (Record<string, unknown> & { plan_id?: string })
      | undefined;
  } catch (err) {
    log.warn('Failed querying commercial_users in sqliteGetUserDetail', {
      userId: id,
      err: errMsg(err),
    });
  }
  if (!commUser) return null;

  let plan: Record<string, unknown> | null = null;
  try {
    plan = (db.prepare('SELECT * FROM commercial_plans WHERE id = ?').get(commUser.plan_id) as Record<
      string,
      unknown
    > | undefined) ?? null;
  } catch (err) {
    log.debug('Skipped commercial_plans lookup in sqliteGetUserDetail', {
      planId: commUser.plan_id,
      err: errMsg(err),
    });
  }

  let sub: (Record<string, unknown> & SqliteSubRow) | null = null;
  try {
    sub =
      (db
        .prepare('SELECT * FROM commercial_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(id) as (Record<string, unknown> & SqliteSubRow) | undefined) ?? null;
  } catch (err) {
    log.debug('Skipped commercial_subscriptions lookup in sqliteGetUserDetail', {
      userId: id,
      err: errMsg(err),
    });
  }

  let license: Record<string, unknown> | null = null;
  if (sub?.license_id) {
    try {
      license =
        (db.prepare('SELECT * FROM licenses WHERE id = ?').get(sub.license_id) as Record<
          string,
          unknown
        > | undefined) ?? null;
    } catch (err) {
      log.debug('Skipped licenses lookup in sqliteGetUserDetail', {
        licenseId: sub.license_id,
        err: errMsg(err),
      });
    }
  }

  let devices: Array<Record<string, unknown>> = [];
  try {
    devices = db.prepare('SELECT * FROM commercial_devices WHERE user_id = ?').all(id);
  } catch (err) {
    log.debug('Skipped commercial_devices lookup in sqliteGetUserDetail', {
      userId: id,
      err: errMsg(err),
    });
  }

  let payments: Array<Record<string, unknown>> = [];
  try {
    payments = db.prepare('SELECT * FROM commercial_payments WHERE user_id = ? ORDER BY created_at DESC').all(id);
  } catch (err) {
    log.debug('Skipped commercial_payments lookup in sqliteGetUserDetail', {
      userId: id,
      err: errMsg(err),
    });
  }

  let sessionsCount = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM auth_sessions WHERE user_id = ?').get(id) as unknown as
      | SqliteCountRow
      | undefined;
    sessionsCount = row?.c || 0;
  } catch (err) {
    log.debug('Skipped auth_sessions count in sqliteGetUserDetail', {
      userId: id,
      err: errMsg(err),
    });
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
}

/**
 * 4. Licenses List
 */
export async function adminListLicenses(filter?: { status?: string; searchQuery?: string }): Promise<{
  items: Array<AdminLicenseItem | LicenseRecord>;
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

      let items: AdminLicenseItem[] = allLicenses.map((l) => {
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
            (Boolean(l.notes) && (l.notes as string).toLowerCase().includes(q))
        );
      }

      return { items, total: items.length, source: 'postgres' };
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListLicenses failed, falling back to SQLite:', errMsg(err));
    }
  }

  const licenses = getLicenses(filter);
  return { items: licenses, total: licenses.length, source: 'sqlite' };
}

/**
 * 5. Devices Fleet List
 */
export async function adminListDevices(filter?: { status?: string; searchQuery?: string }): Promise<{
  items: Array<AdminDeviceItem | CommercialDevice>;
  total: number;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const devices = await prisma.commercial_devices.findMany({
        orderBy: { last_seen_at: 'desc' },
      });

      let items: AdminDeviceItem[] = devices.map((d) => ({
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListDevices failed, falling back to SQLite:', errMsg(err));
    }
  }

  const items = getAllCommercialDevices(filter);
  return { items, total: items.length, source: 'sqlite' };
}

/**
 * 6. Commercial Payments List
 */
export async function adminListPayments(filter?: { status?: string }): Promise<{
  items: AdminPaymentItem[];
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

      const items: AdminPaymentItem[] = rows.map((r) => {
        let metadata: Record<string, unknown> = {};
        try {
          metadata = JSON.parse(r.metadata_json || '{}') as Record<string, unknown>;
        } catch (parseErr) {
          log.warn('Failed parsing payment metadata_json in admin payments list', {
            paymentId: r.id,
            err: errMsg(parseErr),
          });
        }
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListPayments failed, falling back to SQLite:', errMsg(err));
    }
  }

  const items = paymentService.listAdminPayments(filter?.status) as AdminPaymentItem[];
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
}): Promise<{ items: Array<AdminAuditLogItem | CommercialAuditLog>; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where: Prisma.commercial_audit_logsWhereInput = {};
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

      const items: AdminAuditLogItem[] = rows.map((r) => ({
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListAuditLogs failed, falling back to SQLite:', errMsg(err));
    }
  }

  const res = getCommercialAuditLogs(filter);
  return { items: res.logs, total: res.total, source: 'sqlite' };
}

/**
 * 8. Software Versions List
 */
export async function adminListVersions(): Promise<{
  items: Array<AdminVersionItem | SoftwareVersionRecord>;
  source: string;
}> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const rows = await prisma.software_versions.findMany({
        orderBy: { released_at: 'desc' },
      });

      if (rows.length > 0) {
        const items: AdminVersionItem[] = rows.map((r) => ({
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListVersions failed, falling back to SQLite:', errMsg(err));
    }
  }

  const items = getSoftwareVersions();
  return { items, source: 'sqlite' };
}

/**
 * 9. Conversion Funnel Metrics
 */
export async function adminFunnelMetrics(_days?: number): Promise<FunnelMetricsSummary> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const events = await prisma.funnel_events.findMany();
      const countMap: Record<string, number> = {};
      for (const e of events) {
        countMap[e.event_name] = (countMap[e.event_name] || 0) + 1;
      }

      const trialCtaClicks = countMap.trial_cta_clicked || 0;
      const signupStarts = countMap.signup_started || 0;
      const signupCompletions = countMap.signup_completed || 0;
      const emailVerifications = countMap.email_verified || 0;
      const trialActivations = countMap.trial_activated || 0;
      const checkoutStarts = countMap.checkout_started || 0;
      const paymentCompletions = countMap.payment_completed || 0;
      const downloads = countMap.download_started || 0;
      const desktopLogins = countMap.desktop_first_login || 0;

      const conversionRateSignupToTrial =
        signupCompletions > 0 ? Math.round((trialActivations / signupCompletions) * 100) : 0;

      const conversionRateTrialToDownload =
        trialActivations > 0 ? Math.round((downloads / trialActivations) * 100) : 0;

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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminFunnelMetrics failed, falling back to SQLite:', errMsg(err));
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
}): Promise<{ items: Array<AdminSupportTicketItem | SupportTicket>; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where: Prisma.support_ticketsWhereInput = {};
      if (filter?.status) where.status = filter.status;
      if (filter?.category) where.category = filter.category;
      if (filter?.escalatedOnly) where.is_escalated = 1;

      const rows = await prisma.support_tickets.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 100,
      });

      const items: AdminSupportTicketItem[] = rows.map((r) => ({
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListSupportTickets failed, falling back to SQLite:', errMsg(err));
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
}): Promise<{ items: DemoRequest[]; total: number; source: string }> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const where = filter?.status ? { status: filter.status } : {};
      const rows = await prisma.demo_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });

      const items: DemoRequest[] = rows.map((r) => ({
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListDemoRequests failed, falling back to SQLite:', errMsg(err));
    }
  }

  const items = getDemoRequests(filter?.status);
  return { items, total: items.length, source: 'sqlite' };
}

function summarizeTermsRows(rows: SqliteTermsRow[]): AdminTermsComplianceResponse {
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
        byVersion.unversioned = (byVersion.unversioned || 0) + 1;
      }
    } else {
      missing++;
    }
  }

  return { totalUsers, accepted, missing, byVersion };
}

/**
 * 12. Legal Terms Compliance Overview
 */
export async function adminTermsCompliance(): Promise<AdminTermsComplianceResponse> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;

  if (prisma) {
    try {
      const rows = await prisma.auth_users.findMany({
        select: { id: true, accepted_terms: true, terms_version: true },
      });
      return summarizeTermsRows(rows);
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminTermsCompliance failed, falling back to SQLite:', errMsg(err));
    }
  }

  const db = getDatabase();
  let rows: SqliteTermsRow[] = [];
  try {
    rows = db.prepare('SELECT id, accepted_terms, terms_version FROM commercial_users').all() as unknown as SqliteTermsRow[];
  } catch {
    rows = [];
  }
  try {
    const authRows = db
      .prepare('SELECT id, accepted_terms, terms_version FROM auth_users')
      .all() as unknown as SqliteTermsRow[];
    const existingIds = new Set(rows.map((r) => r.id));
    for (const ar of authRows) {
      if (!existingIds.has(ar.id)) {
        rows.push(ar);
      }
    }
  } catch (err) {
    log.debug('Skipped SQLite auth_users merge during terms acceptance summary', {
      err: errMsg(err),
    });
  }

  return summarizeTermsRows(rows);
}

/**
 * 13. Commercial Plans List (Forward Compatible)
 */
export async function adminListPlans(includeInactive = true): Promise<{
  items: Array<AdminPlanItem | CommercialPlan>;
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
        let items: AdminPlanItem[] = rows.map((p) => {
          let limits: Record<string, unknown> = {};
          try {
            limits = JSON.parse(p.limits_json || '{}') as Record<string, unknown>;
          } catch (parseErr) {
            log.warn('Failed parsing plan limits_json in adminListPlans', {
              planId: p.id,
              err: errMsg(parseErr),
            });
          }
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
    } catch (err: unknown) {
      log.error('[AdminDataService] Postgres adminListPlans failed, falling back to SQLite:', errMsg(err));
    }
  }

  const items = getCommercialPlans(includeInactive);
  return { items, total: items.length, source: 'sqlite' };
}
