import type { AccountPricingCatalog } from '../../../10_CONFIG/shared/types/commercial.js';
import { getSiteConfig } from '../../../10_CONFIG/shared/site-config.js';

export type CanonicalBillingCycle = 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface DesktopPlanOption {
  id: 'mahi_starter' | 'mahi_growth' | 'mahi_ultimate';
  name: string;
  profiles: number;
  concurrent: number;
  priceInr: number;
  priceUsd: number;
  billingCycle: CanonicalBillingCycle;
  durationLabel: string;
  rateSubtext: string;
  badge?: string;
}

export const DESKTOP_PLANS: DesktopPlanOption[] = [
  {
    id: 'mahi_starter',
    name: 'Starter',
    profiles: 25,
    concurrent: 3,
    priceInr: 599,
    priceUsd: 9,
    billingCycle: 'MONTHLY',
    durationLabel: '1 Month',
    rateSubtext: '₹599/mo • 25 Proxy Slots',
  },
  {
    id: 'mahi_growth',
    name: 'Growth',
    profiles: 100,
    concurrent: 10,
    priceInr: 999,
    priceUsd: 15,
    billingCycle: 'SEMI_ANNUAL',
    durationLabel: '6 Months',
    rateSubtext: '₹166/mo (Save 72%) • 25 Cloud Backups',
    badge: 'Popular',
  },
  {
    id: 'mahi_ultimate',
    name: 'Ultimate',
    profiles: 1000000,
    concurrent: 25,
    priceInr: 1499,
    priceUsd: 24,
    billingCycle: 'ANNUAL',
    durationLabel: '1 Year',
    rateSubtext: '₹125/mo (Save 79%) • Unlimited Backup & 2 Devices',
    badge: 'Best Value',
  },
];

export function getAdminApiBaseUrl(): string {
  return getSiteConfig({ productionFallback: true }).apiUrl;
}

export function getErrorMessageText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message || fallback;
  }
  return fallback;
}

export function formatAuthError(err: unknown): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const errRec = typeof err === 'object' ? (err as { message?: unknown; error?: unknown }) : null;
  let msg = typeof err === 'string'
    ? err
    : typeof errRec?.message === 'string'
      ? errRec.message
      : typeof errRec?.error === 'string'
        ? errRec.error
        : '';
  msg = msg.replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '');
  msg = msg.replace(/^Error invoking remote method '[^']+':\s*/i, '');
  msg = msg.replace(/^Error:\s*/i, '');

  const lower = msg.toLowerCase();
  if (
    lower.includes('http 401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid credentials') ||
    lower.includes('password incorrect') ||
    lower.includes('user not found')
  ) {
    return 'Invalid email or password. Please verify your credentials or continue with Google.';
  }
  if (lower.includes('already exists') || lower.includes('already registered')) {
    return 'This email is already registered on MAHI Browser. Switched to Sign In — please enter your password or continue with Google.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('offline')
  ) {
    return 'Unable to reach MAHI authentication servers. Please check your internet connection.';
  }
  if (lower.includes('google')) {
    return 'This account was registered using Google Sign-In. Please click "Continue with Google" above.';
  }
  return msg || 'Authentication request failed. Please try again.';
}

export function mergeDynamicPlans(pricingCatalog: AccountPricingCatalog | null): DesktopPlanOption[] {
  if (!pricingCatalog) return DESKTOP_PLANS;
  const remoteRows = [
    ...(Array.isArray(pricingCatalog.personal) ? pricingCatalog.personal : []),
    ...(Array.isArray(pricingCatalog.business) ? pricingCatalog.business : []),
  ];
  return DESKTOP_PLANS.map((basePlan) => {
    const remote = remoteRows.find((r) => r?.planId === basePlan.id);
    if (!remote) return basePlan;
    const authoritativePaise =
      basePlan.billingCycle === 'MONTHLY'
        ? remote.monthlyPricePaise
        : remote.annualPricePaise || remote.monthlyPricePaise;
    const remotePriceInr =
      typeof authoritativePaise === 'number' && authoritativePaise > 0
        ? Math.round(authoritativePaise / 100)
        : basePlan.priceInr;
    return {
      ...basePlan,
      name: remote.displayName || basePlan.name,
      profiles:
        typeof remote.profileLimit === 'number' && remote.profileLimit > 0
          ? remote.profileLimit
          : basePlan.profiles,
      priceInr: remotePriceInr,
    };
  });
}
