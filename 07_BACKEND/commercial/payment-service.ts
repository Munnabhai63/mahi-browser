/**
 * MAHI Browser — Commercial Payment Service Facade
 * Modular facade delegating to provider adapters, transactional activation/webhooks,
 * manual UPI/Crypto workflows, and billing query helpers while preserving all exports.
 */

import { getCommercialPlans } from './commercial-plan-service.js';
import { CommercialPlan, BillingCycleType } from '../../10_CONFIG/shared/types/commercial.js';
import {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PaymentGatewayNotConfiguredError,
  PaymentInvoiceRecord,
  PaymentProvider,
  PaymentProviderType,
  PaymentWebhookEvent,
  UserSubscriptionSummary,
  calculatePlanAmountCents,
  resolveCommercialPlan,
  verifyRazorpayPaymentSignature,
} from './payments/payment-types.js';
import {
  RazorpayPaymentAdapter,
  SimulationPaymentAdapter,
  StripePaymentAdapter,
  YoupiPgPaymentAdapter,
} from './payments/payment-adapters.js';
import {
  activateSubscriptionFromPaymentImpl,
  createCheckoutSessionImpl,
  handleWebhookImpl,
} from './payments/payment-activation.js';
import {
  approveManualPaymentImpl,
  rejectManualPaymentImpl,
  submitManualCryptoPaymentImpl,
  submitManualUpiPaymentImpl,
} from './payments/manual-payment-handlers.js';
import {
  cancelSubscriptionImpl,
  getUserInvoicesAsyncImpl,
  getUserInvoicesImpl,
  getUserPaymentHistoryAsyncImpl,
  getUserPaymentHistoryImpl,
  getUserSubscriptionAsyncImpl,
  getUserSubscriptionImpl,
  listAdminPaymentsImpl,
  verifyYoupiPgOrderImpl,
} from './payments/payment-queries.js';

export type {
  PaymentProviderType,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PaymentWebhookEvent,
  PaymentInvoiceRecord,
  UserSubscriptionSummary,
  PaymentProvider,
};

export {
  resolveCommercialPlan,
  PaymentGatewayNotConfiguredError,
  verifyRazorpayPaymentSignature,
  StripePaymentAdapter,
  RazorpayPaymentAdapter,
  SimulationPaymentAdapter,
  YoupiPgPaymentAdapter,
};

export class PaymentService {
  private static instance: PaymentService | null = null;
  private providers = new Map<PaymentProviderType, PaymentProvider>();
  private defaultProvider: PaymentProviderType = 'youpi_pg';

  private constructor() {
    this.registerProvider(new StripePaymentAdapter());
    this.registerProvider(new RazorpayPaymentAdapter());
    this.registerProvider(new YoupiPgPaymentAdapter());
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      this.registerProvider(new SimulationPaymentAdapter());
    }

    const envProv = process.env.PAYMENT_PROVIDER?.toLowerCase() as PaymentProviderType;
    this.defaultProvider = envProv && this.providers.has(envProv) ? envProv : 'youpi_pg';
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  public registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  public setDefaultProvider(type: PaymentProviderType): void {
    if (this.providers.has(type)) {
      this.defaultProvider = type;
    }
  }

  public getProvider(type?: PaymentProviderType): PaymentProvider {
    const target = type || this.defaultProvider;
    const prov = this.providers.get(target);
    if (!prov) {
      throw new Error(`Payment provider "${target}" is not configured.`);
    }
    return prov;
  }

  public getPlanCatalog(): CommercialPlan[] {
    return getCommercialPlans(false);
  }

  public calculatePlanAmountCents(plan: CommercialPlan, billingCycle: BillingCycleType): number {
    return calculatePlanAmountCents(plan, billingCycle);
  }

  public createCheckoutSession(
    req: CheckoutSessionRequest,
    providerType?: PaymentProviderType
  ): Promise<CheckoutSessionResponse> {
    return createCheckoutSessionImpl(req, this.defaultProvider, (t) => this.getProvider(t), providerType);
  }

  public handleWebhook(
    providerType: PaymentProviderType,
    rawPayload: string,
    signature: string,
    options?: { secret?: string }
  ): Promise<{ success: boolean; eventId: string; type: string; message: string }> {
    return handleWebhookImpl(providerType, rawPayload, signature, (t) => this.getProvider(t), options);
  }

  public activateSubscriptionFromPayment(params: {
    userId: string;
    planId: string;
    billingCycle: BillingCycleType | string;
    amountCents: number;
    currency: string;
    provider: PaymentProviderType;
    externalPaymentId: string;
    externalOrderId?: string;
    receiptUrl?: string;
    metadata?: Record<string, any>;
    tx?: any;
    targetPaymentId?: string;
    alreadyClaimedPaymentId?: string;
  }) {
    return activateSubscriptionFromPaymentImpl(params);
  }

  public getUserInvoices(userId: string): PaymentInvoiceRecord[] {
    return getUserInvoicesImpl(userId);
  }

  public getUserInvoicesAsync(userId: string): Promise<PaymentInvoiceRecord[]> {
    return getUserInvoicesAsyncImpl(userId);
  }

  public getUserSubscription(userId: string): UserSubscriptionSummary | null {
    return getUserSubscriptionImpl(userId);
  }

  public getUserSubscriptionAsync(userId: string): Promise<UserSubscriptionSummary | null> {
    return getUserSubscriptionAsyncImpl(userId);
  }

  public cancelSubscription(userId: string): boolean {
    return cancelSubscriptionImpl(userId);
  }

  public submitManualUpiPayment(params: Parameters<typeof submitManualUpiPaymentImpl>[0]) {
    return submitManualUpiPaymentImpl(params);
  }

  public submitManualCryptoPayment(params: Parameters<typeof submitManualCryptoPaymentImpl>[0]) {
    return submitManualCryptoPaymentImpl(params);
  }

  public approveManualPayment(paymentId: string, adminActor: { id: string; name: string; role?: string }) {
    return approveManualPaymentImpl(paymentId, adminActor);
  }

  public rejectManualPayment(
    paymentId: string,
    adminActor: { id: string; name: string; role?: string },
    reason: string
  ) {
    return rejectManualPaymentImpl(paymentId, adminActor, reason);
  }

  public getUserPaymentHistoryAsync(userId: string): Promise<any[]> {
    return getUserPaymentHistoryAsyncImpl(userId);
  }

  public getUserPaymentHistory(userId: string): any[] {
    return getUserPaymentHistoryImpl(userId);
  }

  public listAdminPayments(statusFilter?: string): any[] {
    return listAdminPaymentsImpl(statusFilter);
  }

  public verifyYoupiPgOrder(paymentOrOrderId: string, expectedUserId?: string) {
    return verifyYoupiPgOrderImpl(paymentOrOrderId, (t) => this.getProvider(t), expectedUserId);
  }
}

export const paymentService = PaymentService.getInstance();
