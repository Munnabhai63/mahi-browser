export const BRAND = {
  name: 'MAHI Browser',
  legalName: 'MAHI Browser — By Mahipal Choudhary',
  creator: 'Mahipal Choudhary',
  tagline: 'Enterprise Anti-Detect Browser with JS-Layer MV3 Stealth & Camoufox C++ Engine',
  officialEmail: 'mahiverse.official@gmail.com',
  hubEmail: 'mahiverse.hub@gmail.com',
  upiId: '6375823589@slc',
  version: '1.1.9',
  website: 'https://mahibrowser.com',
  appUrl: 'https://app.mahibrowser.com',
  apiUrl: 'https://api.mahibrowser.com',
  assets: {
    logo: '/assets/img/logo.png',
    favicon: '/assets/img/favicon.ico',
    upiQr: '/assets/img/payments/mahi-upi-qr.png',
    masterLogo: '/assets/img/mahi-browser-logo-primary.png',
  },
  downloads: {
    windowsSetup: '/download/setup',
    windowsPortable: '/download/portable',
    macDmg: '/releases/MAHI-Browser-1.1.9-macOS-arm64.dmg',
    linuxAppImage: '/releases/MAHI-Browser-1.1.9-Linux-x64.AppImage',
    macDmgAvailable: false,
    linuxAvailable: false,
  },
  legal: {
    sellerName: 'Mahipal Choudhary',
    brandName: 'MAHI Browser',
    country: 'India',
    state: 'Rajasthan',
    // Placeholders on purpose — must never be fabricated.
    gstin: null as string | null,
    registeredAddress: null as string | null,
    grievanceOfficer: 'Mahipal Choudhary',
    grievanceOfficerEmail: 'mahiverse.official@gmail.com',
    grievanceResponseDays: 15,
    refundWindowDays: 7,
    effectiveDate: '2026-11-16',
    lastUpdated: '2026-11-19',
  },
  whatsapp: {
    rawNumber: '919376343629',
    number: '+919376343629',
    display: '+91 9376343629',
    url: 'https://wa.me/919376343629',
  },
};

export function buildWhatsAppLink(customMessage?: string): string {
  const defaultMsg = 'Hello MAHI Browser Support, I need help with my account.';
  const msg = encodeURIComponent(customMessage || defaultMsg);
  return `https://wa.me/919376343629?text=${msg}`;
}

