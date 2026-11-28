import { getAccountSession } from '../../../08_SECURITY/account-service.js';
import type { CreateProxyDTO } from '../../../10_CONFIG/shared/types/proxy.js';
import { getActiveUserId } from '../../commercial/session-context.js';

export function toErrMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isEnoentError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'ENOENT');
}

export const VALID_BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;
export type ValidBillingCycle = (typeof VALID_BILLING_CYCLES)[number];

export function normalizeBillingCycle(raw: string | undefined, fallback: ValidBillingCycle): ValidBillingCycle {
  const upper = (raw || fallback).toUpperCase();
  return (VALID_BILLING_CYCLES as readonly string[]).includes(upper) ? (upper as ValidBillingCycle) : fallback;
}

export function getActiveOwnerId(): string {
  const session = getAccountSession();
  if (session?.account_id) return session.account_id;
  const activeUid = getActiveUserId();
  if (activeUid) return activeUid;
  return 'SYSTEM_OWNER';
}

export type ProxiesTestInput = Partial<CreateProxyDTO> & { proxyId?: string; id?: string };

export interface ManualUpiPaymentInput {
  plan_id?: string;
  planId?: string;
  billing_cycle?: string;
  billingCycle?: string;
  utr: string;
  proof_asset?: string;
  proofAsset?: string;
  extra_members?: number;
  extraMembers?: number;
  extra_proxy_gb?: number;
  extraProxyGb?: number;
}

export interface ManualCryptoPaymentInput {
  plan_id?: string;
  planId?: string;
  billing_cycle?: string;
  billingCycle?: string;
  tx_hash?: string;
  txHash?: string;
  utr?: string;
  network?: string;
  proof_asset?: string;
  proofAsset?: string;
  extra_members?: number;
  extraMembers?: number;
  extra_proxy_gb?: number;
  extraProxyGb?: number;
}
