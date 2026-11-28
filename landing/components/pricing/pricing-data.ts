export interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  popular?: boolean;
  badge?: string;
  priceINR: number;
  priceUSD: number;
  billingLabelINR: string;
  billingLabelUSD: string;
  group1Title: string;
  group1Features: string[];
  group2Title: string;
  group2Features: string[];
  ctaText: string;
  ctaHref: string;
}

export type BillingCycle = 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface SelectedPlanModalInfo {
  id: string;
  name: string;
  price: number;
  billingLabel: string;
  cycle: BillingCycle;
}

export const PRICING_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo affiliates and growth operators deploying their first stealth fleet.',
    priceINR: 599,
    priceUSD: 9,
    billingLabelINR: '1 MONTH ACCESS • ₹599 / MO',
    billingLabelUSD: '1 MONTH ACCESS • $9 / MO',
    group1Title: 'Engines & Profiles',
    group1Features: [
      '25 Air-Gapped Profiles (Offline SQLite)',
      'Dual Engine (Chromium 138 + Camoufox)',
      '25 Custom Proxy Slots (HTTP/SOCKS5)',
      '1 Active Device Seat',
    ],
    group2Title: 'Stealth & Isolation',
    group2Features: [
      'Zero CDP Artifacts (Rebrowser-Patches)',
      'Natural Bézier Curves & Typing Cadence',
      '3 Max Concurrent Browser Windows',
      '0% Instant UPI Payments (Slice UPI)',
    ],
    ctaText: 'Start 1 Month',
    ctaHref: '/signup?plan=starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    popular: true,
    badge: 'Popular',
    tagline: 'For agile media buyer squads, scraping clusters, and multi-store operators.',
    priceINR: 999,
    priceUSD: 15,
    billingLabelINR: '6 MONTHS ACCESS • ₹166 / MO (SAVE 72%)',
    billingLabelUSD: '6 MONTHS ACCESS • $2.5 / MO (SAVE 72%)',
    group1Title: 'Engines & Unlocked Quotas',
    group1Features: [
      '100 High-Entropy Profiles (Offline SQLite)',
      'Unlimited Custom Proxies (BYOP)',
      'Unlimited Fingerprint Perturbation & Re-gen',
      'Unlimited Bulk Cookie & Session Importer',
    ],
    group2Title: 'Workflows & Cloud Backup',
    group2Features: [
      'Visual RPA Studio & Cookie Warmer',
      '25 Encrypted Cloud Backup Profiles',
      '10 Concurrent Running Windows',
      'Priority Chat & Ticket Support',
    ],
    ctaText: 'Get Growth (6 Months)',
    ctaHref: '/signup?plan=growth',
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    badge: 'Best Value',
    tagline: 'For enterprise fleets requiring unlimited offline profiles and dedicated VIP support.',
    priceINR: 1499,
    priceUSD: 24,
    billingLabelINR: 'ANNUAL ACCESS • ₹125 / MO (SAVE 79%)',
    billingLabelUSD: 'ANNUAL ACCESS • $2.0 / MO (SAVE 79%)',
    group1Title: 'Unlimited Fleets & Hardware',
    group1Features: [
      'Unlimited Air-Gapped Profiles (Offline SQLite)',
      'Unlimited Dual-Engine Stealth Fingerprints',
      'Unlimited Proxy Management & Routing',
      'Unlimited RPA & Headless Playwright API',
    ],
    group2Title: 'Governance & VIP Support',
    group2Features: [
      'Encrypted Cloud Backup & Workspace Sync',
      '2 Authorized Device Workspaces',
      'Up to 25 Concurrent Running Windows',
      '24/7 Dedicated VIP WhatsApp Support',
    ],
    ctaText: 'Get Ultimate (1 Year)',
    ctaHref: '/signup?plan=ultimate',
  },
];

export const PLATFORM_LOGOS = [
  { name: 'Meta', src: '/assets/img/platforms/meta-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'Google Ads', src: '/assets/img/platforms/g-ads-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'TikTok', src: '/assets/img/platforms/tiktok-logo-1.svg', h: 'h-4.5 sm:h-5' },
  { name: 'Amazon', src: '/assets/img/platforms/amazon-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'eBay', src: '/assets/img/platforms/ebay-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'YouTube', src: '/assets/img/platforms/youTube-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'Reddit', src: '/assets/img/platforms/reddit-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'LinkedIn', src: '/assets/img/platforms/linkedin-logo-1.svg', h: 'h-5 sm:h-5.5' },
];

export const COMPARISON_CATEGORIES = [
  {
    name: 'Engines & Profile Quotas',
    features: [
      { name: 'Profiles Included', starter: '25 Air-Gapped', growth: '100 Profiles', ultimate: 'Unlimited' },
      { name: 'Chromium 138 MV3 World Stealth', starter: true, growth: true, ultimate: true },
      { name: 'Camoufox C++ Anti-Detect Firefox', starter: true, growth: true, ultimate: true },
      { name: 'Offline SQLite Database (Air-Gapped)', starter: true, growth: true, ultimate: true },
    ],
  },
  {
    name: 'Stealth & Fingerprinting',
    features: [
      { name: 'Integrated Rebrowser-Patches (Zero CDP Artifacts)', starter: true, growth: true, ultimate: true },
      { name: 'CreepJS Detection Benchmark', starter: '0.0% (A+)', growth: '0.0% (A+)', ultimate: '0.0% (A+)' },
      { name: 'Custom Proxy Slots (HTTP/SOCKS5)', starter: '25 Slots', growth: 'Unlimited', ultimate: 'Unlimited' },
      { name: 'Fingerprint Perturbation & Re-generations', starter: 'Standard', growth: 'Unlimited', ultimate: 'Unlimited' },
      { name: 'Bulk Cookie & Session Importer (JSON/Netscape)', starter: 'Standard', growth: 'Unlimited', ultimate: 'Unlimited' },
    ],
  },
  {
    name: 'Automation & Hardware Concurrency',
    features: [
      { name: 'Visual RPA Studio & Flow Builder', starter: 'Basic', growth: 'Advanced', ultimate: 'Unlimited' },
      { name: 'Automated Cookie Warmer & Session Healer', starter: false, growth: true, ultimate: true },
      { name: 'Playwright / Puppeteer Remote API Access', starter: false, growth: true, ultimate: true },
      { name: 'Simultaneous Active Browser Windows', starter: '3 Windows', growth: '10 Windows', ultimate: '25 Windows' },
    ],
  },
  {
    name: 'Governance, Sync & Support',
    features: [
      { name: '0% Fee Instant Indian UPI Payments (Slice UPI)', starter: true, growth: true, ultimate: true },
      { name: 'Authorized Device Workspaces', starter: '1 Device', growth: '1 Device', ultimate: '2 Devices' },
      { name: 'Encrypted Cloud Backup & Session Sync', starter: false, growth: '25 Profiles', ultimate: 'Included' },
      { name: 'Support SLA', starter: 'Standard Email', growth: 'Priority Chat', ultimate: '24/7 Dedicated WhatsApp' },
    ],
  },
];

export function getPricingFaqs(upiId: string) {
  return [
    {
      question: 'How are browser profiles stored and isolated in MAHI Browser?',
      answer:
        'Unlike legacy cloud tools that send your session data to external cloud servers, MAHI Browser stores all profile cookies, local storage, and proxy configurations in local-first encrypted SQLite databases on your machine. Your profiles run completely air-gapped without leaking data.',
    },
    {
      question: 'What is the difference between Starter (1M), Growth (6M), and Ultimate (1Y)?',
      answer:
        'Starter (₹599) includes 25 air-gapped profiles for 1 month. Growth (₹999) provides 6 months of access (effective ₹166/month) with 100 profiles and unlimited proxy slots. Ultimate (₹1,499) provides 1 full year of access (effective ₹125/month) with unlimited offline profiles, 2 device workspaces, and 24/7 dedicated VIP WhatsApp support.',
    },
    {
      question: 'How does 0% fee Indian UPI payment work?',
      answer: `You can pay directly via any Indian UPI app (PhonePe, Google Pay, Paytm, CRED, BHIM) to our registered merchant VPA ${upiId}. There are zero international credit card markups or foreign transaction fees. Your license key is verified and activated promptly.`,
    },
    {
      question: 'Can I import my existing GoLogin or AdsPower profiles and cookies?',
      answer:
        'Yes. MAHI Browser features a Universal Bulk Importer. Simply export your profiles from GoLogin, AdsPower, or Multilogin as JSON, drag and drop the file into MAHI Browser, and our engine automatically maps proxies, User-Agents, and cookies into isolated profiles.',
    },
    {
      question: 'Can I upgrade from 1 Month or 6 Months to 1 Year later?',
      answer:
        'Yes. You can upgrade at any time. Any remaining days on your current subscription will be prorated and stacked seamlessly onto your new 1-Year Ultimate plan.',
    },
    {
      question: 'What is the 7-day money-back guarantee?',
      answer:
        'If our dual-engine architecture (Chromium 138 + Camoufox) fails to pass your target platform’s anti-fraud checks (Cloudflare Turnstile, DataDome, CreepJS), simply message our WhatsApp support within 7 days for a full, unconditional refund.',
    },
  ];
}

export function getPlanBillingCycle(planId: string): BillingCycle {
  if (planId === 'starter') return 'MONTHLY';
  if (planId === 'growth') return 'SEMI_ANNUAL';
  return 'ANNUAL';
}
