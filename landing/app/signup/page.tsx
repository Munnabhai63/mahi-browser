'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { sanitizeSafeRedirect } from '../../lib/redirect';

function getBillingCycleForPlan(planId: string): 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL' {
  const norm = planId.toLowerCase();
  if (norm === 'starter' || norm === 'mahi_starter' || norm === 'plan_1month') return 'MONTHLY';
  if (norm === 'growth' || norm === 'mahi_growth' || norm === 'plan_6months') return 'SEMI_ANNUAL';
  return 'ANNUAL';
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [planId, setPlanId] = useState('free');
  const [currency, setCurrency] = useState<'INR' | 'USD' | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('plan');
      const cur = (params.get('currency') || '').toUpperCase();
      const safeRedir = sanitizeSafeRedirect(params.get('redirect'));
      if (p) setPlanId(p);
      if (cur === 'USD' || cur === 'INR') setCurrency(cur);
      if (safeRedir) setRedirectPath(safeRedir);
    }
  }, []);

  const isUsdPaidFlow = currency === 'USD' && planId !== 'free';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!acceptedTerms) {
      setErrorMsg('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const cycle = getBillingCycleForPlan(planId);
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          planId,
          requestedPlan: planId,
          billingCycle: cycle.toLowerCase(),
          intent: isUsdPaidFlow ? 'paid' : (planId !== 'free' ? 'trial' : 'free'),
          acceptedTerms: true,
          termsVersion: BRAND.legal.lastUpdated,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && (data.token || data.user)) {
        try {
          localStorage.removeItem('mahi_auth_token');
          localStorage.removeItem('mahi_access_token');
        } catch (err) {
          console.debug('[signup] legacy localStorage token clear skipped', err);
        }

        if (isUsdPaidFlow) {
          let stripeEnabled = false;
          try {
            const gwResp = await fetch(`${BRAND.apiUrl}/api/v1/billing/gateways`, {
              credentials: 'include',
            });
            if (gwResp.ok) {
              const gwData = await gwResp.json();
              stripeEnabled = Boolean(
                Array.isArray(gwData?.gateways) &&
                  gwData.gateways.find((g: { id?: string; enabled?: boolean }) => g.id === 'stripe')?.enabled
              );
            }
          } catch (err) {
            console.debug('[signup] gateway capability probe failed', err);
          }

          if (stripeEnabled) {
            const checkoutResp = await fetch(`${BRAND.apiUrl}/api/v1/billing/checkout`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                planId,
                billingCycle: cycle,
                provider: 'stripe',
                currency: 'USD',
                successUrl: `${BRAND.website}/pricing?status=success&plan=${encodeURIComponent(planId)}&currency=USD`,
                cancelUrl: `${BRAND.website}/pricing?plan=${encodeURIComponent(planId)}&currency=USD`,
              }),
            });
            const checkoutData = await checkoutResp.json().catch(() => ({}));
            if (checkoutResp.ok && checkoutData?.checkoutUrl) {
              window.location.href = checkoutData.checkoutUrl;
              return;
            }
          }

          window.location.href = `/pricing?plan=${encodeURIComponent(planId)}&currency=USD&autoCheckout=1`;
          return;
        }

        if (redirectPath) {
          window.location.href = redirectPath;
          return;
        }

        window.location.href = `/download`;
      } else {
        const errorText =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message ||
              data.message ||
              'Failed to create account. Please try another email.';
        setErrorMsg(errorText);
      }
    } catch {
      setErrorMsg('Network error connecting to MAHI Cloud Auth Gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuth = () => {
    if (!acceptedTerms) {
      setErrorMsg('Please accept the Terms of Service and Privacy Policy before continuing with Google.');
      return;
    }
    const query = new URLSearchParams();
    const targetReturn = isUsdPaidFlow
      ? `${BRAND.website}/pricing?plan=${encodeURIComponent(planId)}&currency=USD&autoCheckout=1`
      : redirectPath
        ? (redirectPath.startsWith('https://') ? redirectPath : `${BRAND.website}${redirectPath}`)
        : `${BRAND.website}/download`;
    query.set('returnUrl', targetReturn);
    query.set('acceptedTerms', 'true');
    query.set('termsVersion', BRAND.legal.lastUpdated);
    if (planId && planId !== 'free') {
      query.set('plan', planId);
      query.set('billing', getBillingCycleForPlan(planId).toLowerCase());
      if (isUsdPaidFlow) {
        query.set('intent', 'paid');
      }
    }
    window.location.href = `${BRAND.apiUrl}/api/v1/auth/google/start?${query.toString()}`;
  };

  const loginQuery = new URLSearchParams();
  if (planId && planId !== 'free') loginQuery.set('plan', planId);
  if (currency) loginQuery.set('currency', currency);
  if (redirectPath) {
    loginQuery.set('redirect', redirectPath);
  } else if (isUsdPaidFlow) {
    loginQuery.set('redirect', `/pricing?plan=${encodeURIComponent(planId)}&currency=USD&autoCheckout=1`);
  }
  const loginHref = loginQuery.toString() ? `/login?${loginQuery.toString()}` : '/login';

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#030303] text-white selection:bg-white selection:text-black px-4 py-24 sm:py-32 overflow-hidden">
      
      {/* Subtle Atmospheric Background Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/assets/company/hero_walking.jpg"
          alt=""
          fill
          className="object-cover object-center opacity-15 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/80 via-[#030303]/95 to-[#030303]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_50%_20%,rgba(255,255,255,0.04),transparent)]" />
      </div>

      {/* Main Luxury Auth Card */}
      <div className="relative z-10 w-full max-w-[460px] rounded-[8px] bg-[#131517] border border-white/10 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
        
        {/* Subtle top highlight hairline */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Card Header & Brand Emblem */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group mb-4">
            <div className="w-11 h-11 rounded-lg bg-zinc-900 border border-zinc-700/60 p-2 shadow-sm flex items-center justify-center group-hover:border-zinc-500 transition-colors">
              <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
                <rect x="9" y="9" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="#18181b" />
              </svg>
            </div>
          </Link>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
            <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
              GET STARTED FREE
            </span>
          </div>

          {/* Heading in Spectral Serif */}
          <h1 className="font-['Spectral',serif] text-2xl sm:text-[32px] font-light tracking-[-0.03em] leading-tight text-white mb-2">
            Create Your Account
          </h1>

          {/* Subtitle */}
          <p className="text-white/60 text-[13px] leading-relaxed max-w-xs mx-auto">
            Includes 15 offline SQLite profiles and 7-day Pro trial with air-gapped cloud sync.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 rounded-[6px] border border-red-500/30 bg-red-950/20 px-3.5 py-2.5 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="signup-name" className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mahipal Choudhary"
              className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
              Work Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
              Password (Min 8 Characters)
            </label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
            />
          </div>

          {/* Plan Selection Badge */}
          <div className="rounded-[6px] border border-white/10 bg-[#080808] p-3 flex items-center justify-between text-xs">
            <div>
              <div className="font-mono text-[10px] uppercase text-[#969290]">Selected Tier</div>
              <div className="text-white font-medium capitalize mt-0.5">
                {planId === 'free'
                  ? 'Free Plan (15 Offline Profiles)'
                  : isUsdPaidFlow
                    ? `${planId} Plan (USD Checkout)`
                    : currency === 'INR'
                      ? `${planId} Plan (INR / UPI Checkout)`
                      : `${planId} Plan (Selected Tier)`}
              </div>
            </div>
            <Link href="/pricing" className="text-zinc-400 hover:text-white underline text-[11px] transition-colors">
              Change
            </Link>
          </div>

          {/* Terms and Privacy Consent Checkbox */}
          <div className="flex items-start gap-2.5 pt-1 text-xs text-white/70">
            <input
              type="checkbox"
              id="acceptTerms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#080808] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
            />
            <label htmlFor="acceptTerms" className="cursor-pointer leading-tight text-[12px] text-zinc-400 select-none">
              I agree to the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/90">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-white/90">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          {/* White Pill Create Account Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-white text-black py-3 text-[14px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/5 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Creating Account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#131517] px-3 text-[10px] font-mono uppercase tracking-[0.08em] text-[#969290]">
            OR SIGN UP WITH
          </span>
        </div>

        {/* Google Workspace OAuth Button */}
        <button
          onClick={handleGoogleOAuth}
          type="button"
          className="w-full flex items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 py-2.5 text-[13px] font-medium text-white transition-all shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google Workspace OAuth</span>
        </button>

        {/* Card Footer Link */}
        <p className="text-center text-[13px] text-zinc-400 mt-6 pt-4 border-t border-white/5">
          Already have an account?{' '}
          <Link href={loginHref} className="text-white hover:underline underline-offset-4 font-medium transition-colors">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
