import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChatWidget from '../components/ChatWidget';
import { BRAND } from '../lib/brand';

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.website),
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
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: BRAND.website,
    logo: `${BRAND.website}${BRAND.assets.logo}`,
    email: BRAND.officialEmail,
    telephone: BRAND.phone,
    founder: {
      '@type': 'Person',
      name: BRAND.creator,
    },
    sameAs: [
      'https://github.com/Munnabhai63/mahi-browser',
      'https://x.com/MunaBhai63',
      'https://linkedin.com/in/mahipal-choudhary-153ba83b1',
    ],
  };

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Spectral:ital,wght@1,200;1,300;1,400;1,500;1,600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/css/framer-theme.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#050505] text-[#ededed] antialiased selection:bg-white selection:text-black">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
        {/* ChatWidget disabled for 1:1 Lateral aesthetic */}
      </body>
    </html>
  );
}
