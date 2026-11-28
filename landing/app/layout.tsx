import type { Metadata } from 'next';
import { Inter, Spectral } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BRAND } from '../lib/brand';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.website),
  alternates: {
    canonical: './',
  },
  title: {
    default: 'MAHI Browser — Enterprise Dual-Engine Anti-Detect Browser',
    template: '%s | MAHI Browser',
  },
  description:
    'Enterprise Anti-Detect Browser with Chromium 138 JavaScript MV3 Stealth Injection, On-Demand Camoufox C++ Hardened Gecko, Rebrowser-Patches Automation, and Multi-Seat Sync.',
  keywords: [
    'anti-detect browser',
    'antidetect browser',
    'gologin alternative',
    'adspower alternative',
    'multilogin alternative',
    'chromium 138',
    'camoufox',
    'rebrowser-patches',
    'canvas fingerprint spoofing',
    'webgl fingerprint',
    'distributed profile lock',
    'residential proxy',
    'web scraping stealth',
    'multi-accounting browser',
  ],
  authors: [{ name: BRAND.creator, url: BRAND.website }],
  creator: BRAND.creator,
  publisher: BRAND.legalName,
  icons: {
    icon: BRAND.assets.favicon,
    shortcut: BRAND.assets.favicon,
    apple: BRAND.assets.logo,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BRAND.website,
    siteName: BRAND.name,
    title: 'MAHI Browser — Enterprise Dual-Engine Anti-Detect Browser',
    description:
      'Undetectable Chromium 138 with JS-layer MV3 stealth + on-demand Camoufox C++ Gecko engine, distributed Redis concurrency locks, and local SQLite offline operation.',
    images: [
      {
        url: BRAND.assets.logo,
        width: 512,
        height: 512,
        alt: 'MAHI Browser Enterprise Anti-Detect Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAHI Browser — Enterprise Dual-Engine Anti-Detect',
    description:
      'Undetectable Chromium 138 with JS-layer MV3 stealth + on-demand Camoufox C++ Gecko engine, distributed Redis locks, and local SQLite storage.',
    images: [BRAND.assets.logo],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${BRAND.website}/#website`,
        url: BRAND.website,
        name: BRAND.name,
        description:
          'Enterprise Anti-Detect Browser with Chromium 138 JavaScript MV3 Stealth Injection, On-Demand Camoufox C++ Hardened Gecko, and Instant 0% Fee UPI Settlements.',
        publisher: { '@id': `${BRAND.website}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${BRAND.website}/#organization`,
        name: BRAND.name,
        legalName: BRAND.legalName,
        url: BRAND.website,
        logo: `${BRAND.website}${BRAND.assets.logo}`,
        email: 'support@mahibrowser.com',
        founder: {
          '@type': 'Person',
          name: BRAND.creator,
        },
        sameAs: [
          'https://github.com/Munnabhai63/mahi-browser',
          'https://x.com/MunaBhai63',
          'https://www.linkedin.com/in/mahipal-choudhary-153ba83b1',
        ],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${BRAND.website}/#software`,
        name: BRAND.name,
        operatingSystem: 'Windows 10, Windows 11',
        applicationCategory: 'SecurityApplication, BrowserApplication, BusinessApplication',
        softwareVersion: BRAND.version,
        downloadUrl: `${BRAND.website}/download`,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: '0',
          highPrice: '1499',
          offerCount: '4',
        },
      },
    ],
  };

  return (
    <html lang="en" className={`dark scroll-smooth ${inter.variable} ${spectral.variable}`}>
      <head>
        <link rel="stylesheet" href="/assets/css/framer-theme.css" />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data script with '<' escaped
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-[#030303] text-[#ededed] antialiased selection:bg-white selection:text-black`}>
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
        {/* ChatWidget disabled on landing pages */}
      </body>
    </html>
  );
}
