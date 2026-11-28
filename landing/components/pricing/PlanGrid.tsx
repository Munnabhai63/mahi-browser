import type { PlanTier } from './pricing-data';

interface PlanGridProps {
  plans: PlanTier[];
  currency: 'INR' | 'USD';
  activeCheckoutPlanId: string | null;
  isYoupiEnabled: boolean;
  isStripeEnabled: boolean;
  isUsdtEnabled: boolean;
  usdtAddress: string;
  usdtNetwork: string;
  onPlanClick: (plan: PlanTier) => void;
  onOpenCryptoModal: (plan: PlanTier) => void;
}

export function PlanGrid({
  plans,
  currency,
  activeCheckoutPlanId,
  isYoupiEnabled,
  isStripeEnabled,
  isUsdtEnabled,
  usdtAddress,
  usdtNetwork,
  onPlanClick,
  onOpenCryptoModal,
}: PlanGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 xl:gap-8 max-w-[1380px] mx-auto text-left items-stretch">
      {plans.map((plan) => {
        const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
        const billingLabel = currency === 'INR' ? plan.billingLabelINR : plan.billingLabelUSD;
        const symbol = currency === 'INR' ? '₹' : '$';

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-9 xl:p-11 flex flex-col justify-between transition-all duration-300 ${
              plan.popular
                ? 'bg-[#111114] border border-zinc-700/80 shadow-[0_0_50px_rgba(255,255,255,0.05)]'
                : 'bg-[#0c0c0e] border border-white/[0.08]'
            }`}
          >
            <div>
              {/* Top Header: Title & Badge */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xl font-semibold text-white tracking-tight">
                  {plan.name}
                </h3>
                {plan.badge && (
                  <span className="rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-3 py-1">
                    {plan.badge}
                  </span>
                )}
              </div>

              {/* Tagline */}
              <p className="text-zinc-400 text-[14px] leading-relaxed min-h-[44px] mb-7">
                {plan.tagline}
              </p>

              {/* Price in Spectral Serif */}
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="text-3xl font-light text-zinc-400 font-['Spectral',serif]">
                  {symbol}
                </span>
                <span className="font-['Spectral',serif] text-5xl sm:text-6xl xl:text-[64px] font-light text-white tracking-tight leading-none">
                  {price.toLocaleString()}
                </span>
              </div>

              {/* Sub-line under Price (Exact Lateral uppercase font-mono) */}
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 pb-7 border-b border-white/[0.08]">
                {billingLabel}
              </div>

              {/* Features Group 1 */}
              <div className="mt-7">
                <div className="text-[13px] font-medium text-white mb-3.5 tracking-wide">
                  {plan.group1Title}
                </div>
                <div className="space-y-3">
                  {plan.group1Features.map((feat) => (
                    <div key={feat} className="flex items-start gap-3 text-[14px] text-zinc-200">
                      <svg className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                      </svg>
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features Group 2 */}
              <div className="mt-7 mb-9">
                <div className="text-[13px] font-medium text-white mb-3.5 tracking-wide">
                  {plan.group2Title}
                </div>
                <div className="space-y-3">
                  {plan.group2Features.map((feat) => (
                    <div key={feat} className="flex items-start gap-3 text-[14px] text-zinc-200">
                      <svg className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                      </svg>
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Single Clean White / Dark Pill Button */}
            <div className="pt-5 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => onPlanClick(plan)}
                disabled={activeCheckoutPlanId === plan.id}
                className={`inline-flex w-full items-center justify-center rounded-full py-3.5 px-6 text-sm sm:text-base font-medium transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-wait ${
                  plan.popular || plan.id === 'ultimate'
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700/80'
                }`}
              >
                {activeCheckoutPlanId === plan.id
                  ? 'Redirecting to Checkout...'
                  : currency === 'INR'
                    ? (isYoupiEnabled
                        ? 'Pay Now (Instant UPI)'
                        : `Pay with UPI (${symbol}${price.toLocaleString()})`)
                    : (isStripeEnabled
                        ? `Pay with Card (${symbol}${price})`
                        : isUsdtEnabled
                          ? `Pay with USDT (${symbol}${price})`
                          : `Pay with Card (${symbol}${price})`)}
              </button>
              {currency === 'INR' && !isYoupiEnabled && (
                <p className="text-[11px] text-zinc-500 font-mono text-center mt-2.5">
                  Instant checkout is being activated. Manual UPI is available now.
                </p>
              )}
              {currency === 'USD' && (
                <div className="mt-2.5 text-center space-y-1">
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {isStripeEnabled
                      ? 'Secure international Stripe checkout • Instant activation'
                      : isUsdtEnabled
                        ? `Zero-fee USDT (${usdtNetwork}) transfer • Verified activation`
                        : 'Secure international USD checkout'}
                  </p>
                  {isStripeEnabled && isUsdtEnabled && usdtAddress && (
                    <button
                      type="button"
                      onClick={() => onOpenCryptoModal(plan)}
                      className="text-[11px] text-zinc-300 hover:text-white underline font-mono"
                    >
                      Or pay with USDT (TRC-20) →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
