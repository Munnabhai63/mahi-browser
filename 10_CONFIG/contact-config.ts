/**
 * MAHI Browser - Authoritative Central Business Contact & Payment Configuration
 *
 * Production defaults preserve canonical public support & merchant coordinates while
 * allowing runtime environment overrides (`BUSINESS_EMAIL`, `SUPPORT_EMAIL`,
 * `WHATSAPP_NUMBER`, `UPI_ID`, `UPI_ACCOUNT_HOLDER`, `USDT_ADDRESS`, `USDT_NETWORK`,
 * `NEXT_PUBLIC_*`, `VITE_*`, `PAYMENT_*`, `SUPPORT_*`) cleanly across Gateway,
 * Electron Desktop, Web Dashboard, and Next.js Landing.
 */

export const APP_AUTHOR = 'Munna Bhai';

export const DEFAULT_BUSINESS_EMAIL = 'mahiverse.hub@gmail.com';
export const DEFAULT_SUPPORT_EMAIL = 'mahiverse.official@gmail.com';
export const DEFAULT_BILLING_EMAIL = 'mahiverse.official@gmail.com';
export const DEFAULT_SUPPORT_ESCALATION_EMAIL = 'mahiverse.official@gmail.com';

export const DEFAULT_WHATSAPP_RAW_NUMBER = '919376343629';
export const DEFAULT_WHATSAPP_NUMBER = '+919376343629';
export const DEFAULT_WHATSAPP_DISPLAY = '+91 9376343629';
export const WHATSAPP_DEFAULT_MESSAGE = 'Hello MAHI Browser Support, I need help with my account.';

export const X_URL = 'https://x.com/MunaBhai63';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/mahipal-choudhary-153ba83b1';

// Unconfigured socials MUST remain hidden (never generic root URLs)
export const FACEBOOK_URL = '';
export const TELEGRAM_URL = '';
export const INSTAGRAM_URL = '';
export const YOUTUBE_URL = '';

// Canonical production defaults (used when env overrides are unset)
export const DEFAULT_UPI_ID = '6375823589@slc';
export const DEFAULT_UPI_ACCOUNT_HOLDER = 'Mr Mahipal Choudhary';
export const DEFAULT_UPI_QR_ASSET = '/brand/mahi-upi-qr.png';
export const DEFAULT_UPI_QR_ASSET_WEB = '/assets/img/payments/mahi-upi-qr.png';
export const DEFAULT_UPI_ENABLED = true;

export const DEFAULT_USDT_ENABLED = true;
export const DEFAULT_USDT_ADDRESS = 'TPerRUMbJtNSmcRoBcQt1PpNpYCrEd5ziA';
export const DEFAULT_USDT_NETWORK = 'TRC-20 (TRON)';
export const DEFAULT_USDT_QR_ASSET = '/brand/mahi-usdt-trc20-qr.png';
export const DEFAULT_USDT_QR_ASSET_WEB = '/assets/img/payments/mahi-usdt-trc20-qr.png';

// Backward-compatible named constant defaults
export const BUSINESS_EMAIL = DEFAULT_BUSINESS_EMAIL;
export const SUPPORT_EMAIL = DEFAULT_SUPPORT_EMAIL;
export const BILLING_EMAIL = DEFAULT_BILLING_EMAIL;
export const SUPPORT_ESCALATION_EMAIL = DEFAULT_SUPPORT_ESCALATION_EMAIL;

export const WHATSAPP_RAW_NUMBER = DEFAULT_WHATSAPP_RAW_NUMBER;
export const WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
export const WHATSAPP_DISPLAY = DEFAULT_WHATSAPP_DISPLAY;

export const UPI_ID = DEFAULT_UPI_ID;
export const UPI_ACCOUNT_HOLDER = DEFAULT_UPI_ACCOUNT_HOLDER;
export const UPI_QR_ASSET = DEFAULT_UPI_QR_ASSET;
export const UPI_QR_ASSET_WEB = DEFAULT_UPI_QR_ASSET_WEB;
export const UPI_ENABLED = DEFAULT_UPI_ENABLED;

export const USDT_ENABLED = DEFAULT_USDT_ENABLED;
export const USDT_ADDRESS = DEFAULT_USDT_ADDRESS;
export const USDT_NETWORK = DEFAULT_USDT_NETWORK;
export const USDT_QR_ASSET = DEFAULT_USDT_QR_ASSET;
export const USDT_QR_ASSET_WEB = DEFAULT_USDT_QR_ASSET_WEB;

// Pricing Defaults
export const DEFAULT_PRICE_INR = 599;
export const DEFAULT_PRICE_USDT = 9;

// Authoritative Legal Identity & Redressal Configuration
export const LEGAL_SELLER_NAME = 'Mahipal Choudhary';
export const LEGAL_BRAND_NAME = 'MAHI Browser';
export const LEGAL_COUNTRY = 'India';
export const LEGAL_STATE = 'Rajasthan';
export const LEGAL_GSTIN: string | null = null;          // NOT REGISTERED
export const LEGAL_REGISTERED_ADDRESS: string | null = null; // NOT ON FILE
export const GRIEVANCE_OFFICER_NAME = 'Mahipal Choudhary';
export const GRIEVANCE_OFFICER_EMAIL = DEFAULT_SUPPORT_EMAIL;
export const GRIEVANCE_RESPONSE_DAYS = 15;
export const REFUND_WINDOW_DAYS = 7;

export interface ContactConfig {
  businessEmail: string;
  supportEmail: string;
  billingEmail: string;
  supportEscalationEmail: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  whatsappUrl: string;
  xUrl: string;
  linkedinUrl: string;
  facebookUrl?: string;
  telegramUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  upi: {
    enabled: boolean;
    id: string;
    accountHolder: string;
    qrAsset: string;
  };
  usdt: {
    enabled: boolean;
    address: string;
    network: string;
    qrAsset: string;
  };
}

export interface RuntimePaymentMetadata extends ContactConfig {
  appAuthor: string;
  whatsappRawNumber: string;
  legalSellerName: string;
  legalBrandName: string;
  legalCountry: string;
  legalState: string;
  legalGstin: string | null;
  legalRegisteredAddress: string | null;
  grievanceOfficerName: string;
  grievanceOfficerEmail: string;
  grievanceResponseDays: number;
  refundWindowDays: number;
  defaultPriceInr: number;
  defaultPriceUsdt: number;
  upi: ContactConfig['upi'] & { qrAssetWeb: string };
  usdt: ContactConfig['usdt'] & { qrAssetWeb: string };
}

function readNodeEnv(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      return String(process.env[key]).trim();
    }
  } catch {
    // Ignore in browser runtimes without Node process
  }
  return '';
}

function getViteEnv(): Record<string, unknown> | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      return (import.meta as unknown as { env?: Record<string, unknown> }).env;
    }
  } catch {
    // Ignore in CJS contexts
  }
  return undefined;
}

function readNextPublicLiteral(val: string | undefined, key: string): string {
  return (val || readNodeEnv(key)).trim();
}

function readViteLiteral(key: string): string {
  const env = getViteEnv();
  const val = env?.[key];
  return typeof val === 'string' ? val.trim() : '';
}

function parsePositiveInt(raw: string, fallback: number): number {
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function parsePositiveNumber(raw: string, fallback: number): number {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function formatWhatsAppDisplay(rawOrNormalized: string, rawDigits: string): string {
  if (!rawDigits || rawDigits === DEFAULT_WHATSAPP_RAW_NUMBER) {
    return DEFAULT_WHATSAPP_DISPLAY;
  }
  if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    return `+91 ${rawDigits.slice(2)}`;
  }
  return rawOrNormalized.startsWith('+') ? rawOrNormalized : `+${rawDigits}`;
}

export function getRuntimePaymentMetadata(): RuntimePaymentMetadata {
  const businessEmail =
    readNodeEnv('BUSINESS_EMAIL') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BUSINESS_EMAIL : undefined, 'NEXT_PUBLIC_BUSINESS_EMAIL') ||
    readViteLiteral('VITE_BUSINESS_EMAIL') ||
    DEFAULT_BUSINESS_EMAIL;

  const supportEmail =
    readNodeEnv('SUPPORT_EMAIL') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPPORT_EMAIL : undefined, 'NEXT_PUBLIC_SUPPORT_EMAIL') ||
    readViteLiteral('VITE_SUPPORT_EMAIL') ||
    DEFAULT_SUPPORT_EMAIL;

  const billingEmail =
    readNodeEnv('BILLING_EMAIL') ||
    readNodeEnv('SUPPORT_EMAIL') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPPORT_EMAIL : undefined, 'NEXT_PUBLIC_SUPPORT_EMAIL') ||
    supportEmail ||
    DEFAULT_BILLING_EMAIL;

  const supportEscalationEmail =
    readNodeEnv('SUPPORT_ESCALATION_EMAIL') ||
    readNodeEnv('SUPPORT_EMAIL') ||
    supportEmail ||
    DEFAULT_SUPPORT_ESCALATION_EMAIL;

  const configuredWhatsapp =
    readNodeEnv('SUPPORT_WHATSAPP') ||
    readNodeEnv('WHATSAPP_NUMBER') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_WHATSAPP_NUMBER : undefined, 'NEXT_PUBLIC_WHATSAPP_NUMBER') ||
    readViteLiteral('VITE_WHATSAPP_NUMBER') ||
    DEFAULT_WHATSAPP_NUMBER;

  const whatsappRawNumber = configuredWhatsapp.replace(/[^0-9]/g, '') || DEFAULT_WHATSAPP_RAW_NUMBER;
  const whatsappNumber = configuredWhatsapp || DEFAULT_WHATSAPP_NUMBER;
  const whatsappDisplay = formatWhatsAppDisplay(whatsappNumber, whatsappRawNumber);

  const upiId =
    readNodeEnv('PAYMENT_UPI_ID') ||
    readNodeEnv('UPI_ID') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_UPI_ID : undefined, 'NEXT_PUBLIC_UPI_ID') ||
    readViteLiteral('VITE_UPI_ID') ||
    DEFAULT_UPI_ID;

  const upiAccountHolder =
    readNodeEnv('PAYMENT_UPI_HOLDER') ||
    readNodeEnv('UPI_ACCOUNT_HOLDER') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_UPI_ACCOUNT_HOLDER : undefined, 'NEXT_PUBLIC_UPI_ACCOUNT_HOLDER') ||
    readViteLiteral('VITE_UPI_ACCOUNT_HOLDER') ||
    DEFAULT_UPI_ACCOUNT_HOLDER;

  const upiQrAsset = readNodeEnv('PAYMENT_UPI_QR_ASSET') || readNodeEnv('UPI_QR_ASSET') || DEFAULT_UPI_QR_ASSET;
  const upiQrAssetWeb = readNodeEnv('PAYMENT_UPI_QR_ASSET_WEB') || readNodeEnv('UPI_QR_ASSET_WEB') || DEFAULT_UPI_QR_ASSET_WEB;

  const upiEnabledEnv =
    readNodeEnv('PAYMENT_UPI_ENABLED') ||
    readNodeEnv('UPI_ENABLED') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_UPI_ENABLED : undefined, 'NEXT_PUBLIC_UPI_ENABLED') ||
    readViteLiteral('VITE_UPI_ENABLED');
  const upiEnabled = upiEnabledEnv ? upiEnabledEnv.toLowerCase() === 'true' : Boolean(DEFAULT_UPI_ENABLED && upiId);

  const usdtAddress =
    readNodeEnv('PAYMENT_USDT_ADDRESS') ||
    readNodeEnv('USDT_ADDRESS') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_USDT_ADDRESS : undefined, 'NEXT_PUBLIC_USDT_ADDRESS') ||
    readViteLiteral('VITE_USDT_ADDRESS') ||
    DEFAULT_USDT_ADDRESS;

  const usdtNetwork =
    readNodeEnv('PAYMENT_USDT_NETWORK') ||
    readNodeEnv('USDT_NETWORK') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_USDT_NETWORK : undefined, 'NEXT_PUBLIC_USDT_NETWORK') ||
    readViteLiteral('VITE_USDT_NETWORK') ||
    DEFAULT_USDT_NETWORK;

  const usdtQrAsset = readNodeEnv('PAYMENT_USDT_QR_ASSET') || readNodeEnv('USDT_QR_ASSET') || DEFAULT_USDT_QR_ASSET;
  const usdtQrAssetWeb = readNodeEnv('PAYMENT_USDT_QR_ASSET_WEB') || readNodeEnv('USDT_QR_ASSET_WEB') || DEFAULT_USDT_QR_ASSET_WEB;

  const usdtEnabledEnv =
    readNodeEnv('PAYMENT_USDT_ENABLED') ||
    readNodeEnv('USDT_ENABLED') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_USDT_ENABLED : undefined, 'NEXT_PUBLIC_USDT_ENABLED') ||
    readViteLiteral('VITE_USDT_ENABLED');
  const usdtEnabled = usdtEnabledEnv ? usdtEnabledEnv.toLowerCase() === 'true' : Boolean(DEFAULT_USDT_ENABLED && usdtAddress);

  const defaultPriceInr = parsePositiveInt(
    readNodeEnv('DEFAULT_PRICE_INR') ||
      readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_DEFAULT_PRICE_INR : undefined, 'NEXT_PUBLIC_DEFAULT_PRICE_INR'),
    DEFAULT_PRICE_INR
  );
  const defaultPriceUsdt = parsePositiveNumber(
    readNodeEnv('DEFAULT_PRICE_USDT') ||
      readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_DEFAULT_PRICE_USDT : undefined, 'NEXT_PUBLIC_DEFAULT_PRICE_USDT'),
    DEFAULT_PRICE_USDT
  );

  const legalSellerName =
    readNodeEnv('LEGAL_SELLER_NAME') ||
    readNextPublicLiteral(typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_LEGAL_SELLER_NAME : undefined, 'NEXT_PUBLIC_LEGAL_SELLER_NAME') ||
    LEGAL_SELLER_NAME;

  const grievanceOfficerEmail =
    readNodeEnv('GRIEVANCE_OFFICER_EMAIL') || supportEmail || DEFAULT_SUPPORT_EMAIL;

  return {
    appAuthor: APP_AUTHOR,
    businessEmail,
    supportEmail,
    billingEmail,
    supportEscalationEmail,
    whatsappRawNumber,
    whatsappNumber,
    whatsappDisplay,
    whatsappUrl: `https://wa.me/${whatsappRawNumber}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`,
    legalSellerName,
    legalBrandName: LEGAL_BRAND_NAME,
    legalCountry: LEGAL_COUNTRY,
    legalState: LEGAL_STATE,
    legalGstin: LEGAL_GSTIN,
    legalRegisteredAddress: LEGAL_REGISTERED_ADDRESS,
    grievanceOfficerName: GRIEVANCE_OFFICER_NAME,
    grievanceOfficerEmail,
    grievanceResponseDays: GRIEVANCE_RESPONSE_DAYS,
    refundWindowDays: REFUND_WINDOW_DAYS,
    defaultPriceInr,
    defaultPriceUsdt,
    xUrl: X_URL,
    linkedinUrl: LINKEDIN_URL,
    facebookUrl: isValidSocialUrl(FACEBOOK_URL) ? FACEBOOK_URL : undefined,
    telegramUrl: isValidSocialUrl(TELEGRAM_URL) ? TELEGRAM_URL : undefined,
    instagramUrl: isValidSocialUrl(INSTAGRAM_URL) ? INSTAGRAM_URL : undefined,
    youtubeUrl: isValidSocialUrl(YOUTUBE_URL) ? YOUTUBE_URL : undefined,
    upi: {
      enabled: upiEnabled,
      id: upiId,
      accountHolder: upiAccountHolder,
      qrAsset: upiQrAsset,
      qrAssetWeb: upiQrAssetWeb,
    },
    usdt: {
      enabled: usdtEnabled,
      address: usdtAddress,
      network: usdtNetwork,
      qrAsset: usdtQrAsset,
      qrAssetWeb: usdtQrAssetWeb,
    },
  };
}

export function getRuntimeContactConfig(): ContactConfig {
  const meta = getRuntimePaymentMetadata();
  return {
    businessEmail: meta.businessEmail,
    supportEmail: meta.supportEmail,
    billingEmail: meta.billingEmail,
    supportEscalationEmail: meta.supportEscalationEmail,
    whatsappNumber: meta.whatsappNumber,
    whatsappDisplay: meta.whatsappDisplay,
    whatsappUrl: meta.whatsappUrl,
    xUrl: meta.xUrl,
    linkedinUrl: meta.linkedinUrl,
    facebookUrl: meta.facebookUrl,
    telegramUrl: meta.telegramUrl,
    instagramUrl: meta.instagramUrl,
    youtubeUrl: meta.youtubeUrl,
    upi: {
      enabled: meta.upi.enabled,
      id: meta.upi.id,
      accountHolder: meta.upi.accountHolder,
      qrAsset: meta.upi.qrAsset,
    },
    usdt: {
      enabled: meta.usdt.enabled,
      address: meta.usdt.address,
      network: meta.usdt.network,
      qrAsset: meta.usdt.qrAsset,
    },
  };
}

export const CONTACT_CONFIG = {
  APP_AUTHOR,
  appAuthor: APP_AUTHOR,
  LEGAL_BRAND_NAME,
  LEGAL_COUNTRY,
  LEGAL_STATE,
  LEGAL_GSTIN,
  LEGAL_REGISTERED_ADDRESS,
  GRIEVANCE_OFFICER_NAME,
  GRIEVANCE_RESPONSE_DAYS,
  REFUND_WINDOW_DAYS,
  legalBrandName: LEGAL_BRAND_NAME,
  legalCountry: LEGAL_COUNTRY,
  legalState: LEGAL_STATE,
  legalGstin: LEGAL_GSTIN,
  legalRegisteredAddress: LEGAL_REGISTERED_ADDRESS,
  grievanceOfficerName: GRIEVANCE_OFFICER_NAME,
  grievanceResponseDays: GRIEVANCE_RESPONSE_DAYS,
  refundWindowDays: REFUND_WINDOW_DAYS,
  WHATSAPP_DEFAULT_MESSAGE,
  X_URL,
  LINKEDIN_URL,
  FACEBOOK_URL,
  TELEGRAM_URL,
  INSTAGRAM_URL,
  YOUTUBE_URL,
  get LEGAL_SELLER_NAME() {
    return getRuntimePaymentMetadata().legalSellerName;
  },
  get legalSellerName() {
    return getRuntimePaymentMetadata().legalSellerName;
  },
  get GRIEVANCE_OFFICER_EMAIL() {
    return getRuntimePaymentMetadata().grievanceOfficerEmail;
  },
  get grievanceOfficerEmail() {
    return getRuntimePaymentMetadata().grievanceOfficerEmail;
  },
  get BUSINESS_EMAIL() {
    return getRuntimePaymentMetadata().businessEmail;
  },
  get SUPPORT_EMAIL() {
    return getRuntimePaymentMetadata().supportEmail;
  },
  get BILLING_EMAIL() {
    return getRuntimePaymentMetadata().billingEmail;
  },
  get SUPPORT_ESCALATION_EMAIL() {
    return getRuntimePaymentMetadata().supportEscalationEmail;
  },
  get WHATSAPP_RAW_NUMBER() {
    return getRuntimePaymentMetadata().whatsappRawNumber;
  },
  get WHATSAPP_NUMBER() {
    return getRuntimePaymentMetadata().whatsappNumber;
  },
  get WHATSAPP_DISPLAY() {
    return getRuntimePaymentMetadata().whatsappDisplay;
  },
  get UPI_ID() {
    return getRuntimePaymentMetadata().upi.id;
  },
  get UPI_ACCOUNT_HOLDER() {
    return getRuntimePaymentMetadata().upi.accountHolder;
  },
  get UPI_QR_ASSET() {
    return getRuntimePaymentMetadata().upi.qrAsset;
  },
  get UPI_QR_ASSET_WEB() {
    return getRuntimePaymentMetadata().upi.qrAssetWeb;
  },
  get UPI_ENABLED() {
    return getRuntimePaymentMetadata().upi.enabled;
  },
  get USDT_ENABLED() {
    return getRuntimePaymentMetadata().usdt.enabled;
  },
  get USDT_ADDRESS() {
    return getRuntimePaymentMetadata().usdt.address;
  },
  get USDT_NETWORK() {
    return getRuntimePaymentMetadata().usdt.network;
  },
  get USDT_QR_ASSET() {
    return getRuntimePaymentMetadata().usdt.qrAsset;
  },
  get USDT_QR_ASSET_WEB() {
    return getRuntimePaymentMetadata().usdt.qrAssetWeb;
  },
  get DEFAULT_PRICE_INR() {
    return getRuntimePaymentMetadata().defaultPriceInr;
  },
  get DEFAULT_PRICE_USDT() {
    return getRuntimePaymentMetadata().defaultPriceUsdt;
  },
  get businessEmail() {
    return getRuntimePaymentMetadata().businessEmail;
  },
  get supportEmail() {
    return getRuntimePaymentMetadata().supportEmail;
  },
  get billingEmail() {
    return getRuntimePaymentMetadata().billingEmail;
  },
  get supportEscalationEmail() {
    return getRuntimePaymentMetadata().supportEscalationEmail;
  },
  get whatsappNumber() {
    return getRuntimePaymentMetadata().whatsappNumber;
  },
  get whatsappDisplay() {
    return getRuntimePaymentMetadata().whatsappDisplay;
  },
  get whatsappUrl() {
    return `https://wa.me/${getRuntimePaymentMetadata().whatsappRawNumber}`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export const WHATSAPP_REGEX = /^\+?[1-9]\d{7,14}$/;
export const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Exclude placeholder domain-based addresses that bounce
  if (trimmed.endsWith('@mahibrowser.com') && !readNodeEnv('ENABLE_INTERNAL_MAILBOXES')) {
    return false;
  }
  return EMAIL_REGEX.test(trimmed);
}

export function isValidWhatsAppNumber(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s-]/g, '');
  if (!WHATSAPP_REGEX.test(clean)) return false;
  // Reject dummy placeholders
  const digits = clean.replace(/[^0-9]/g, '');
  if (digits.includes('9999999999') || digits.includes('9876543210') || digits.length < 10) {
    return false;
  }
  return true;
}

export function isValidUpiId(upi: string | null | undefined): boolean {
  if (!upi || typeof upi !== 'string') return false;
  const trimmed = upi.trim();
  if (trimmed === 'mahibrowser@upi' || trimmed.endsWith('@example') || trimmed.length < 5) {
    return false;
  }
  return UPI_REGEX.test(trimmed);
}

export function isValidSocialUrl(url: string | null | undefined, expectedHost?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    // Disallow bare root domains (e.g. https://x.com, https://linkedin.com with no profile path)
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '') return false;
    if (expectedHost && !parsed.hostname.includes(expectedHost)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildWhatsAppLink(customMessage?: string): string {
  const { whatsappRawNumber } = getRuntimePaymentMetadata();
  const msg = encodeURIComponent(customMessage || WHATSAPP_DEFAULT_MESSAGE);
  return `https://wa.me/${whatsappRawNumber}?text=${msg}`;
}

export function getAuthoritativeContactConfig(): ContactConfig {
  return getRuntimeContactConfig();
}
