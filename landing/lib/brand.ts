import { getSiteConfig } from './site-config';
import {
  buildWhatsAppLink as buildContactWhatsAppLink,
  getRuntimePaymentMetadata,
} from '../../10_CONFIG/contact-config';

export const BRAND = {
  name: 'MAHI Browser',
  legalName: 'MAHI Browser — By Mahipal Choudhary',
  creator: 'Mahipal Choudhary',
  tagline: 'Enterprise Anti-Detect Browser with JS-Layer MV3 Stealth & Camoufox C++ Engine',
  get officialEmail(): string {
    return getRuntimePaymentMetadata().supportEmail;
  },
  get hubEmail(): string {
    return getRuntimePaymentMetadata().businessEmail;
  },
  get upiId(): string {
    return getRuntimePaymentMetadata().upi.id;
  },
  get upiAccountHolder(): string {
    return getRuntimePaymentMetadata().upi.accountHolder;
  },
  get usdt() {
    return getRuntimePaymentMetadata().usdt;
  },
  version: '1.4.0',
  get website(): string {
    return getSiteConfig({ productionFallback: true }).websiteUrl;
  },
  get appUrl(): string {
    return getSiteConfig({ productionFallback: true }).appUrl;
  },
  get apiUrl(): string {
    return getSiteConfig({ productionFallback: true }).apiUrl;
  },
  assets: {
    logo: '/assets/img/logo.png',
    favicon: '/assets/img/favicon.ico',
    upiQr: '/assets/img/payments/mahi-upi-qr.png',
    masterLogo: '/assets/img/mahi-browser-logo-primary.png',
  },
  downloads: {
    windowsSetup: '/download/setup',
    windowsPortable: '/download/portable',
    macDmg: '',
    linuxAppImage: '',
    macDmgAvailable: false,
    linuxAvailable: false,
  },
  legal: {
    get sellerName(): string {
      return getRuntimePaymentMetadata().legalSellerName;
    },
    brandName: 'MAHI Browser',
    country: 'India',
    state: 'Rajasthan',
    // Placeholders on purpose — must never be fabricated.
    gstin: null as string | null,
    registeredAddress: null as string | null,
    grievanceOfficer: 'Mahipal Choudhary',
    get grievanceOfficerEmail(): string {
      return getRuntimePaymentMetadata().grievanceOfficerEmail;
    },
    grievanceResponseDays: 15,
    refundWindowDays: 7,
    effectiveDate: '2026-11-16',
    lastUpdated: '2026-11-19',
  },
  whatsapp: {
    get rawNumber(): string {
      return getRuntimePaymentMetadata().whatsappRawNumber;
    },
    get number(): string {
      return getRuntimePaymentMetadata().whatsappNumber;
    },
    get display(): string {
      return getRuntimePaymentMetadata().whatsappDisplay;
    },
    get url(): string {
      return `https://wa.me/${getRuntimePaymentMetadata().whatsappRawNumber}`;
    },
  },
};

export function buildWhatsAppLink(customMessage?: string): string {
  return buildContactWhatsAppLink(customMessage);
}

