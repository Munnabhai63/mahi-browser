export interface PublicPlan {
  id: string;
  name: string;
  category: 'PERSONAL' | 'BUSINESS';
  tagline: string;
  profileLimit: number;
  seatLimit: number;
  monthlyPrice: {
    INR: number;
    USD: number;
    EUR: number;
  };
  annualPrice: {
    INR: number;
    USD: number;
    EUR: number;
  };
  features: string[];
  highlight?: boolean;
  ctaText: string;
  ctaHref: string;
}

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: 'free',
    name: 'Free Starter',
    category: 'PERSONAL',
    tagline: 'Ideal for trying out stealth browsing on a single machine',
    profileLimit: 15,
    seatLimit: 1,
    monthlyPrice: { INR: 0, USD: 0, EUR: 0 },
    annualPrice: { INR: 0, USD: 0, EUR: 0 },
    features: [
      '15 Browser Profiles (Offline SQLite)',
      'Dual Engine (Chromium 138 + Camoufox)',
      'JavaScript MV3 Stealth & Bezier Humanizer',
      'Canvas, WebGL & Audio Perturbation',
      'Custom Proxy (HTTP / SOCKS5)',
      'Community Support',
    ],
    ctaText: 'Start Free Forever',
    ctaHref: '/download',
  },
  {
    id: 'professional_10',
    name: 'Solo 10',
    category: 'PERSONAL',
    tagline: 'For solo creators and affiliate managers',
    profileLimit: 10,
    seatLimit: 1,
    monthlyPrice: { INR: 599, USD: 8, EUR: 7 },
    annualPrice: { INR: 299, USD: 4, EUR: 3.5 },
    features: [
      '10 Cloud-Synced Profiles (R2 Encrypted)',
      'Dual Engine (Chromium 138 + Camoufox)',
      'Rebrowser-Patches Zero CDP Leak',
      'Full Fingerprint Customization',
      'Encrypted Cloud Backup & Restore',
      'Standard Email Support',
    ],
    ctaText: 'Start 7-Day Trial',
    ctaHref: '/signup?plan=professional_10',
  },
  {
    id: 'professional_100',
    name: 'Professional 100',
    category: 'PERSONAL',
    tagline: 'Best for power affiliates, dropshippers & growth operators',
    profileLimit: 100,
    seatLimit: 5,
    monthlyPrice: { INR: 5999, USD: 75, EUR: 70 },
    annualPrice: { INR: 2999, USD: 38, EUR: 35 },
    highlight: true,
    features: [
      '100 Profiles with Distributed Locks',
      'Dual Engine (Chromium 138 + Camoufox)',
      'Visual RPA Studio & Automation Engine',
      'Built-in Cookie Warmer & Session Healer',
      '30 Min Cloud Browser Streaming',
      '1,000 Remote API Calls / Month',
      'Priority 24/7 WhatsApp & Email Support',
    ],
    ctaText: 'Start 7-Day Trial',
    ctaHref: '/signup?plan=professional_100',
  },
  {
    id: 'business_starter',
    name: 'Team 50',
    category: 'BUSINESS',
    tagline: 'For agile media buyer squads & e-commerce teams',
    profileLimit: 50,
    seatLimit: 5,
    monthlyPrice: { INR: 2999, USD: 39, EUR: 36 },
    annualPrice: { INR: 1499, USD: 20, EUR: 18 },
    features: [
      '50 Shared Profiles across Team Workspaces',
      '5 Team Member Seats with RBAC',
      'Visual RPA & Cookie Warmer Included',
      '1 Shared Workspace with Granular Sharing',
      '5 GB Residential Proxy Traffic',
      'Redis Distributed Concurrency Locks',
      'Priority Support Desk Access',
    ],
    ctaText: 'Start Team Trial',
    ctaHref: '/signup?plan=business_starter',
  },
  {
    id: 'business_scale',
    name: 'Team 200',
    category: 'BUSINESS',
    tagline: 'For high-scale marketing agencies & lead generation fleets',
    profileLimit: 200,
    seatLimit: 20,
    monthlyPrice: { INR: 9999, USD: 129, EUR: 120 },
    annualPrice: { INR: 4999, USD: 65, EUR: 60 },
    highlight: true,
    features: [
      '200 Shared Profiles with Multi-Device Sync',
      '20 Team Member Seats with Role Controls',
      '5 Workspaces & Profile Tag Grouping',
      '10 Concurrent Automation Threads',
      '15 GB High-Speed Proxy Traffic',
      '10,000 Developer REST API Calls',
      'Dedicated Account Manager & SLA',
    ],
    ctaText: 'Start Team Trial',
    ctaHref: '/signup?plan=business_scale',
  },
  {
    id: 'enterprise_custom',
    name: 'Enterprise Fleet',
    category: 'BUSINESS',
    tagline: 'Unlimited scale, dedicated infrastructure & custom C++ engine',
    profileLimit: 500,
    seatLimit: 50,
    monthlyPrice: { INR: 19999, USD: 249, EUR: 230 },
    annualPrice: { INR: 9999, USD: 125, EUR: 115 },
    features: [
      '500+ Profiles (Custom Scaling Available)',
      'Unlimited Team Members & Workspaces',
      'Custom C++ Chromium & Firefox Builds',
      'Self-Hosted Fastify Gateway & Postgres DB',
      'Unlimited Automation Concurrency',
      'Dedicated Residential Subnet Allocation',
      '100,000 API Calls & Webhook Endpoints',
      'Direct WhatsApp Line to Core Engineering',
    ],
    ctaText: 'Contact Enterprise Sales',
    ctaHref: '/book-demo',
  },
];
