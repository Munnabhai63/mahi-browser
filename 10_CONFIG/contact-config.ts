/**
 * MAHI Browser - Authoritative Central Business Contact & Payment Configuration
 * 
 * CANONICAL SINGLE SOURCE OF TRUTH:
 * - General / Business Email: mahiverse.hub@gmail.com
 * - Support / Billing / Escalation Email: mahiverse.official@gmail.com
 * - WhatsApp Support Number: +91 9376343629 (URL: https://wa.me/919376343629)
 * - Official X Profile: https://x.com/MunaBhai63
 * - Official LinkedIn Profile: https://www.linkedin.com/in/mahipal-choudhary-153ba83b1
 * - Official UPI ID: 6375823589@slc
 * - UPI Account Holder: Mr Mahipal Choudhary
 * - UPI QR Asset: /brand/mahi-upi-qr.png
 * - USDT Status: DISABLED (Fake placeholder removed; real wallet pending)
 */

export const BUSINESS_EMAIL = 'mahiverse.hub@gmail.com';
export const SUPPORT_EMAIL = 'mahiverse.official@gmail.com';
export const BILLING_EMAIL = 'mahiverse.official@gmail.com';
export const SUPPORT_ESCALATION_EMAIL = 'mahiverse.official@gmail.com';

export const WHATSAPP_RAW_NUMBER = '919376343629';
export const WHATSAPP_NUMBER = '+919376343629';
export const WHATSAPP_DISPLAY = '+91 9376343629';
export const WHATSAPP_DEFAULT_MESSAGE = 'Hello MAHI Browser Support, I need help with my account.';

export const X_URL = 'https://x.com/MunaBhai63';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/mahipal-choudhary-153ba83b1';

// Unconfigured socials MUST remain hidden (never generic root URLs)
export const FACEBOOK_URL = '';
export const TELEGRAM_URL = '';
export const INSTAGRAM_URL = '';
export const YOUTUBE_URL = '';

// Authoritative UPI Payment Configuration
export const UPI_ID = '6375823589@slc';
export const UPI_ACCOUNT_HOLDER = 'Mr Mahipal Choudhary';
export const UPI_QR_ASSET = '/brand/mahi-upi-qr.png';
export const UPI_QR_ASSET_WEB = '/assets/img/payments/mahi-upi-qr.png';
export const UPI_ENABLED = true;

// Crypto / USDT Configuration
export const USDT_ENABLED = false;
export const USDT_ADDRESS = '';
export const USDT_NETWORK = '';

// Pricing Defaults
export const DEFAULT_PRICE_INR = 599;
export const DEFAULT_PRICE_USDT = 7;

// Authoritative Legal Identity & Redressal Configuration
export const LEGAL_SELLER_NAME = 'Mahipal Choudhary';
export const LEGAL_BRAND_NAME = 'MAHI Browser';
export const LEGAL_COUNTRY = 'India';
export const LEGAL_STATE = 'Rajasthan';
export const LEGAL_GSTIN: string | null = null;          // NOT REGISTERED
export const LEGAL_REGISTERED_ADDRESS: string | null = null; // NOT ON FILE
export const GRIEVANCE_OFFICER_NAME = 'Mahipal Choudhary';
export const GRIEVANCE_OFFICER_EMAIL = SUPPORT_EMAIL;
export const GRIEVANCE_RESPONSE_DAYS = 15;
export const REFUND_WINDOW_DAYS = 7;

export const CONTACT_CONFIG = {
  LEGAL_SELLER_NAME,
  LEGAL_BRAND_NAME,
  LEGAL_COUNTRY,
  LEGAL_STATE,
  LEGAL_GSTIN,
  LEGAL_REGISTERED_ADDRESS,
  GRIEVANCE_OFFICER_NAME,
  GRIEVANCE_OFFICER_EMAIL,
  GRIEVANCE_RESPONSE_DAYS,
  REFUND_WINDOW_DAYS,
  legalSellerName: LEGAL_SELLER_NAME,
  legalBrandName: LEGAL_BRAND_NAME,
  legalCountry: LEGAL_COUNTRY,
  legalState: LEGAL_STATE,
  legalGstin: LEGAL_GSTIN,
  legalRegisteredAddress: LEGAL_REGISTERED_ADDRESS,
  grievanceOfficerName: GRIEVANCE_OFFICER_NAME,
  grievanceOfficerEmail: GRIEVANCE_OFFICER_EMAIL,
  grievanceResponseDays: GRIEVANCE_RESPONSE_DAYS,
  refundWindowDays: REFUND_WINDOW_DAYS,
  BUSINESS_EMAIL,
  SUPPORT_EMAIL,
  BILLING_EMAIL,
  SUPPORT_ESCALATION_EMAIL,
  WHATSAPP_RAW_NUMBER,
  WHATSAPP_NUMBER,
  WHATSAPP_DISPLAY,
  WHATSAPP_DEFAULT_MESSAGE,
  X_URL,
  LINKEDIN_URL,
  FACEBOOK_URL,
  TELEGRAM_URL,
  INSTAGRAM_URL,
  YOUTUBE_URL,
  UPI_ID,
  UPI_ACCOUNT_HOLDER,
  UPI_QR_ASSET,
  UPI_QR_ASSET_WEB,
  UPI_ENABLED,
  USDT_ENABLED,
  USDT_ADDRESS,
  USDT_NETWORK,
  DEFAULT_PRICE_INR,
  DEFAULT_PRICE_USDT,
  businessEmail: BUSINESS_EMAIL,
  supportEmail: SUPPORT_EMAIL,
  billingEmail: BILLING_EMAIL,
  supportEscalationEmail: SUPPORT_ESCALATION_EMAIL,
  whatsappNumber: WHATSAPP_NUMBER,
  whatsappDisplay: WHATSAPP_DISPLAY,
  whatsappUrl: `https://wa.me/${WHATSAPP_RAW_NUMBER}`,
};

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
  };
}

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
  if (trimmed.endsWith('@mahibrowser.com') && !process.env.ENABLE_INTERNAL_MAILBOXES) {
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
  const msg = encodeURIComponent(customMessage || WHATSAPP_DEFAULT_MESSAGE);
  return `https://wa.me/${WHATSAPP_RAW_NUMBER}?text=${msg}`;
}

export function getAuthoritativeContactConfig(): ContactConfig {
  return {
    businessEmail: BUSINESS_EMAIL,
    supportEmail: SUPPORT_EMAIL,
    billingEmail: BILLING_EMAIL,
    supportEscalationEmail: SUPPORT_ESCALATION_EMAIL,
    whatsappNumber: WHATSAPP_NUMBER,
    whatsappDisplay: WHATSAPP_DISPLAY,
    whatsappUrl: buildWhatsAppLink(),
    xUrl: X_URL,
    linkedinUrl: LINKEDIN_URL,
    facebookUrl: isValidSocialUrl(FACEBOOK_URL) ? FACEBOOK_URL : undefined,
    telegramUrl: isValidSocialUrl(TELEGRAM_URL) ? TELEGRAM_URL : undefined,
    instagramUrl: isValidSocialUrl(INSTAGRAM_URL) ? INSTAGRAM_URL : undefined,
    youtubeUrl: isValidSocialUrl(YOUTUBE_URL) ? YOUTUBE_URL : undefined,
    upi: {
      enabled: UPI_ENABLED,
      id: UPI_ID,
      accountHolder: UPI_ACCOUNT_HOLDER,
      qrAsset: UPI_QR_ASSET,
    },
    usdt: {
      enabled: USDT_ENABLED,
      address: USDT_ADDRESS,
      network: USDT_NETWORK,
    },
  };
}
