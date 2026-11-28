import { COMPARISON_CATEGORIES, type PlanTier } from './pricing-data';

interface ComparisonMatrixProps {
  plans: PlanTier[];
  currency: 'INR' | 'USD';
  isYoupiEnabled: boolean;
  isStripeEnabled: boolean;
  isUsdtEnabled: boolean;
  onPlanClick: (plan: PlanTier) => void;
}

export function ComparisonMatrix({
  plans,
  currency,
  isYoupiEnabled,
  isStripeEnabled,
  isUsdtEnabled,
  onPlanClick,
}: ComparisonMatrixProps) {
  return (
    <section className="w-full py-20 bg-[#f9f9f9] text-[#080808]">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
            <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
              PLANS
            </span>
          </div>
          <h2 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[56px] font-light tracking-[-0.02em] leading-tight text-[#080808] mb-4">
            Compare Plans
          </h2>
          <p className="text-[#555555] text-sm sm:text-base leading-relaxed">
            All MAHI plans include full C++ dual-engine stealth. Choose the quota that fits your operational scale.
          </p>
        </div>

        {/* Comparison Table Container */}
        <div className="w-full overflow-x-auto no-scrollbar">
          <div className="min-w-[760px] w-full">
            {/* Sticky Table Header with Plan Names and CTAs */}
            <div className="grid grid-cols-4 pb-6 border-b border-[#e6e3e3] items-end">
              <div className="text-[13px] font-mono text-[#888888] uppercase tracking-wider">
                Features
              </div>
              {plans.map((plan) => {
                const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
                const symbol = currency === 'INR' ? '₹' : '$';

                return (
                  <div key={plan.id} className="text-center px-4 space-y-3">
                    <div className="text-lg font-semibold text-[#080808]">
                      {plan.name}
                    </div>
                    <div className="text-xs text-[#666666] font-mono">
                      {symbol}{price.toLocaleString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlanClick(plan)}
                      className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-medium transition-colors shadow-sm ${
                        plan.popular || plan.id === 'ultimate'
                          ? 'bg-[#080808] text-white hover:bg-zinc-800'
                          : 'bg-zinc-200 text-[#080808] hover:bg-zinc-300'
                      }`}
                    >
                      {currency === 'INR'
                        ? (isYoupiEnabled ? 'Pay Now (Instant UPI)' : 'Pay with UPI')
                        : (isStripeEnabled ? 'Get Started' : isUsdtEnabled ? 'Pay with USDT' : 'Get Started')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Categorized Rows */}
            {COMPARISON_CATEGORIES.map((cat) => (
              <div key={cat.name} className="pt-8">
                <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#888888] font-semibold mb-4">
                  {cat.name}
                </div>
                <div className="divide-y divide-[#eceae7]">
                  {cat.features.map((feat) => (
                    <div key={feat.name} className="grid grid-cols-4 py-3.5 items-center text-sm">
                      <div className="text-[#333333] font-normal pr-4">
                        {feat.name}
                      </div>

                      {/* Starter Value */}
                      <div className="text-center text-[#555555]">
                        {typeof feat.starter === 'boolean' ? (
                          feat.starter ? (
                            <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )
                        ) : (
                          <span className="font-mono text-xs">{feat.starter}</span>
                        )}
                      </div>

                      {/* Growth Value */}
                      <div className="text-center text-[#555555]">
                        {typeof feat.growth === 'boolean' ? (
                          feat.growth ? (
                            <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )
                        ) : (
                          <span className="font-mono text-xs font-medium text-black">{feat.growth}</span>
                        )}
                      </div>

                      {/* Ultimate Value */}
                      <div className="text-center text-[#555555]">
                        {typeof feat.ultimate === 'boolean' ? (
                          feat.ultimate ? (
                            <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )
                        ) : (
                          <span className="font-mono text-xs font-semibold text-black">{feat.ultimate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
